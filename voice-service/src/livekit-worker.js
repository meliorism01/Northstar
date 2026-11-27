/**
 * NORTHSTAR LiveKit Voice Worker (Sarvam AI Saaras v3 STT + Bulbul v3 TTS + OpenAI LLM).
 * Adapted from ai-voice-agent (MIT License) and wired to NORTHSTAR's signed
 * Spring Boot webhook contract (zero local Prisma database state).
 */
import { fileURLToPath } from 'node:url';
import { cli, defineAgent, llm, ServerOptions, voice } from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as sarvam from '@livekit/agents-plugin-sarvam';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as openai from '@livekit/agents-plugin-openai';
import { RoomServiceClient } from 'livekit-server-sdk';
import {
  buildSystemPrompt,
  buildWelcome,
  postOutcomeWebhook,
  renderContext,
  TERMINAL_TOOLS,
} from '../profiles/northstar-cod-verify/agent.js';

const BACKEND_BASE_URL = process.env.NORTHSTAR_BACKEND_URL || 'http://127.0.0.1:8080';
const WEBHOOK_SECRET = process.env.CALLING_WEBHOOK_SECRET || '';

const VOICEMAIL_PATTERNS = [
  /व[ोॉ]इस[\s-]*मे/,
  /इस\s+समय\s+उपलब्ध\s+नहीं/,
  /कृपया\s+संदेश\s+छोड़/,
  /voicemail|voice\s*mail/i,
  /answering\s*machine/i,
  /please\s+(record|leave)\s+(your\s+)?(message|name)/i,
  /(after|at)\s+the\s+(tone|beep)/i,
];

function buildSTT(lang) {
  if (lang === 'en-IN') {
    return new openai.STT({ model: 'gpt-4o-transcribe', language: 'en', detectLanguage: false });
  }
  return new sarvam.STT({ model: 'saaras:v3', languageCode: lang || 'hi-IN' });
}

function buildTTS(lang) {
  if ((process.env.TTS_PROVIDER || 'sarvam').toLowerCase() === 'elevenlabs' && process.env.ELEVENLABS_VOICE_ID) {
    return new elevenlabs.TTS({
      voiceId: process.env.ELEVENLABS_VOICE_ID,
      model: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5',
      language: lang,
      encoding: 'pcm_8000',
    });
  }
  return new sarvam.TTS({
    model: 'bulbul:v3',
    speaker: process.env.SARVAM_SPEAKER || 'neha',
    targetLanguageCode: lang || 'hi-IN',
    pace: 1.0,
    sampleRate: 8000,
  });
}

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load({ sampleRate: 8000, minSilenceDuration: 400 });
  },
  entry: async (jobCtx) => {
    await jobCtx.connect();
    const participant = await jobCtx.waitForParticipant();
    const attrs = { ...(participant.attributes || {}), room_name: jobCtx.room?.name || '' };
    const lang = attrs.language || 'hi-IN';
    const callCtx = renderContext(attrs, lang);
    const startedMs = Date.now();
    const turns = [];
    let turnIndex = 0;

    function buildOutcomeTool(outcome, description) {
      return llm.tool({
        description,
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Concise factual summary of buyer response' },
            customerOptOut: { type: 'boolean', description: 'True if buyer asked not to be called again' },
          },
          required: ['summary'],
        },
        execute: async ({ summary, customerOptOut }) => {
          const durationSeconds = Math.max(1, Math.round((Date.now() - startedMs) / 1000));
          await postOutcomeWebhook({
            backendBaseUrl: BACKEND_BASE_URL,
            webhookSecret: WEBHOOK_SECRET,
            ctx: callCtx,
            outcome,
            summary,
            customerIntent: outcome,
            customerOptOut: Boolean(customerOptOut),
            durationSeconds,
            transcriptTurns: turns,
          });
          return 'recorded';
        },
      });
    }

    const session = new voice.AgentSession({
      vad: jobCtx.proc.userData.vad,
      stt: buildSTT(lang),
      llm: new openai.LLM({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.5, maxTokens: 90 }),
      tts: buildTTS(lang),
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      preemptiveGeneration: true,
      minInterruptionWords: 2,
    });

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, async (ev) => {
      if (!ev.isFinal) return;
      const text = ev.transcript || '';
      turns.push({ turnIndex: turnIndex++, role: 'CUSTOMER', text, language: lang, occurredAt: new Date().toISOString() });

      if (turns.length <= 6 && VOICEMAIL_PATTERNS.some((p) => p.test(text))) {
        await postOutcomeWebhook({
          backendBaseUrl: BACKEND_BASE_URL,
          webhookSecret: WEBHOOK_SECRET,
          ctx: callCtx,
          outcome: 'NO_ANSWER',
          summary: 'Voicemail / answering machine detected; hung up immediately.',
          customerIntent: 'Voicemail Detected',
          durationSeconds: Math.max(1, Math.round((Date.now() - startedMs) / 1000)),
          transcriptTurns: turns,
        });
        if (process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && jobCtx.room?.name) {
          const rs = new RoomServiceClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
          await rs.deleteRoom(jobCtx.room.name).catch(() => {});
        }
      }
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      if (ev.item?.role === 'assistant') {
        turns.push({
          turnIndex: turnIndex++,
          role: 'AGENT',
          text: ev.item.textContent || '',
          language: lang,
          occurredAt: new Date().toISOString(),
        });
      }
    });

    session.on(voice.AgentSessionEventTypes.FunctionToolsExecuted, (ev) => {
      const firedTerminal = (ev.functionCalls || []).some((c) => TERMINAL_TOOLS.has(c.name));
      if (firedTerminal && jobCtx.room?.name && process.env.LIVEKIT_URL) {
        setTimeout(() => {
          const rs = new RoomServiceClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
          rs.deleteRoom(jobCtx.room.name).catch(() => {});
        }, 8000);
      }
    });

    const agent = new voice.Agent({
      instructions: buildSystemPrompt(callCtx, lang),
      tools: {
        confirm_order: buildOutcomeTool('CONFIRMED', 'Customer confirmed the COD order and delivery readiness.'),
        reject_order: buildOutcomeTool('REJECTED', 'Customer denied placing the order.'),
        request_cancellation: buildOutcomeTool('CANCELLATION_REQUESTED', 'Customer asked to cancel the order.'),
        escalate_to_human: buildOutcomeTool('HUMAN_ESCALATION', 'Customer asked for a human support agent.'),
        mark_uncertain: buildOutcomeTool('UNCERTAIN', 'Conversation ended without clear confirmation or rejection.'),
      },
    });

    await session.start({ agent, room: jobCtx.room });
    session.say(buildWelcome(callCtx, lang), { allowInterruptions: false });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: process.env.LIVEKIT_AGENT_NAME || 'northstar-cod-agent',
    host: process.env.LIVEKIT_AGENT_HTTP_HOST || '127.0.0.1',
  })
);
