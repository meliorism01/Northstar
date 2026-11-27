/**
 * NORTHSTAR Stateless AI Voice Gateway (`voice-service`).
 *
 * Uses zero external npm dependencies for the HTTP gateway so it runs out-of-the-box
 * in DRY_RUN / SANDBOX mode on any Node 18+ host, and dynamically loads
 * `livekit-server-sdk` when `CALLING_DISPATCH_MODE=LIVE` is explicitly enabled.
 *
 * IMPORTANT: Spring Boot + Supabase PostgreSQL is the sole source of truth.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePhone, isIndianMobile } from './lib/phone.js';
import { isDnd } from './lib/dnd.js';
import { verifySignature } from './lib/signature.js';
import { postOutcomeWebhook } from '../profiles/northstar-cod-verify/agent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE = JSON.parse(
  readFileSync(resolve(__dirname, '../profiles/northstar-cod-verify/profile.json'), 'utf8')
);

const PORT = Number(process.env.VOICE_SERVICE_PORT || 3104);
const HOST = process.env.VOICE_SERVICE_HOST || '0.0.0.0';
const DISPATCH_MODE = (process.env.CALLING_DISPATCH_MODE || 'DRY_RUN').toUpperCase();
const WEBHOOK_SECRET =
  process.env.CALLING_WEBHOOK_SECRET || 'northstar-dev-calling-webhook-signing-secret-min-32b';
const BACKEND_URL = process.env.NORTHSTAR_BACKEND_URL || 'http://127.0.0.1:8080';

// Bounded in-memory idempotency cache (Spring Boot PostgreSQL enforces durable uniqueness)
const recentDispatches = new Map();
const MAX_CACHE = 2000;

function rememberDispatch(key, value) {
  if (recentDispatches.size >= MAX_CACHE) {
    const oldest = recentDispatches.keys().next().value;
    recentDispatches.delete(oldest);
  }
  recentDispatches.set(key, value);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_048_576) {
        rejectBody(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectBody);
  });
}

async function dispatchLiveKitSip(reqBody, phone, roomName) {
  const { AgentDispatchClient, SipClient } = await import('livekit-server-sdk');
  const lkUrl = process.env.LIVEKIT_URL;
  const lkKey = process.env.LIVEKIT_API_KEY;
  const lkSecret = process.env.LIVEKIT_API_SECRET;
  const trunkId = isIndianMobile(phone)
    ? process.env.LIVEKIT_SIP_TRUNK_ID_VOBIZ
    : process.env.LIVEKIT_SIP_TRUNK_ID_TWILIO;

  if (!lkUrl || !lkKey || !lkSecret || !trunkId) {
    throw new Error('LIVE mode requires LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and SIP trunk ID');
  }

  const agentName = process.env.LIVEKIT_AGENT_NAME || 'northstar-cod-agent';
  const dispatchClient = new AgentDispatchClient(lkUrl, lkKey, lkSecret);
  await dispatchClient.createDispatch(roomName, agentName, {
    metadata: JSON.stringify({
      profile: PROFILE.id,
      lang: reqBody.lang || 'hi-IN',
      call_session_id: reqBody.callSessionId,
      call_attempt_id: reqBody.callAttemptId,
    }),
  });

  const sipClient = new SipClient(lkUrl, lkKey, lkSecret);
  const p = reqBody.payload || {};
  const sip = await sipClient.createSipParticipant(trunkId, phone, roomName, {
    participantIdentity: `customer-${reqBody.customerId || 'cod'}`,
    participantName: p.customer_name || 'Customer',
    participantAttributes: {
      profile: PROFILE.id,
      language: String(reqBody.lang || 'hi-IN'),
      call_session_id: String(reqBody.callSessionId || ''),
      call_attempt_id: String(reqBody.callAttemptId || ''),
      callback_webhook_url: String(reqBody.callbackWebhookUrl || '/api/v1/calling/webhooks/provider'),
      store_name: String(p.store_name || reqBody.merchantName || ''),
      customer_name: String(p.customer_name || ''),
      order_number: String(p.order_number || reqBody.orderNumber || ''),
      product_name: String(p.product_name || ''),
      quantity: String(p.quantity || '1'),
      total_amount: String(p.total_amount || ''),
      currency: String(p.currency || 'INR'),
      shipping_address: String(p.shipping_address || ''),
    },
    playRingtone: true,
    ringingTimeout: 30,
    maxCallDuration: 240,
    waitUntilAnswered: false,
  });

  return sip?.sipCallId || sip?.sip_call_id || `lk-sip-${crypto.randomUUID().slice(0, 12)}`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, {
        status: 'UP',
        service: 'northstar-voice-service',
        dispatchMode: DISPATCH_MODE,
        liveCallsEnabled: DISPATCH_MODE === 'LIVE',
        inDndWindowNow: isDnd(new Date()),
        profile: PROFILE.id,
        supportedLanguages: PROFILE.languages,
      });
    }

    if (req.method === 'GET' && url.pathname === '/v1/profiles') {
      return sendJson(res, 200, { ok: true, profiles: [PROFILE] });
    }

    if (req.method === 'POST' && url.pathname === '/v1/calls/dispatch') {
      const rawBody = await readBody(req);
      const tsHeader = req.headers['x-northstar-timestamp'];
      const sigHeader = req.headers['x-northstar-signature'];

      if (!verifySignature(WEBHOOK_SECRET, tsHeader, sigHeader, rawBody)) {
        return sendJson(res, 401, { ok: false, error: 'Invalid HMAC signature' });
      }

      const body = JSON.parse(rawBody || '{}');
      const idempKey = req.headers['x-idempotency-key'] || body.idempotencyKey;
      if (!idempKey) {
        return sendJson(res, 400, { ok: false, error: 'Missing idempotencyKey' });
      }

      if (recentDispatches.has(idempKey)) {
        return sendJson(res, 200, { ...recentDispatches.get(idempKey), deduplicated: true });
      }

      const normalizedPhone = normalizePhone(body.phone);
      if (!normalizedPhone) {
        return sendJson(res, 422, { ok: false, error: 'Unroutable E.164 phone number' });
      }

      const slug = String(body.orderNumber || 'order').replace(/[^A-Za-z0-9-]/g, '');
      const roomName = `northstar-cod-${slug}-att${body.attemptNumber || 1}-${Date.now()}`;

      let providerCallId;
      if (DISPATCH_MODE === 'LIVE') {
        providerCallId = await dispatchLiveKitSip(body, normalizedPhone, roomName);
      } else {
        // Safe DRY_RUN default: never dials real customer numbers!
        providerCallId = `dryrun-${crypto.randomUUID().slice(0, 12)}`;
        console.log(
          `[northstar-voice] DRY_RUN accepted order=${body.orderNumber} attempt=${body.attemptNumber} lang=${body.lang} room=${roomName}`
        );
      }

      const result = {
        ok: true,
        accepted: true,
        dispatchMode: DISPATCH_MODE,
        providerCallId,
        roomName,
      };
      rememberDispatch(idempKey, result);
      return sendJson(res, 202, result);
    }

    if (req.method === 'POST' && url.pathname === '/v1/calls/simulate-callback') {
      const rawBody = await readBody(req);
      const tsHeader = req.headers['x-northstar-timestamp'];
      const sigHeader = req.headers['x-northstar-signature'];
      if (!verifySignature(WEBHOOK_SECRET, tsHeader, sigHeader, rawBody)) {
        return sendJson(res, 401, { ok: false, error: 'Invalid HMAC signature' });
      }
      const b = JSON.parse(rawBody || '{}');
      const callbackRes = await postOutcomeWebhook({
        backendBaseUrl: BACKEND_URL,
        webhookSecret: WEBHOOK_SECRET,
        ctx: {
          callSessionId: b.callSessionId,
          callAttemptId: b.callAttemptId,
          providerCallId: b.providerCallId,
          roomName: b.roomName,
          callbackWebhookUrl: b.callbackWebhookUrl,
        },
        outcome: b.outcome || 'CONFIRMED',
        summary: b.summary || 'Simulated callback from voice-service',
        customerIntent: b.customerIntent || b.outcome || 'CONFIRMED',
        customerOptOut: Boolean(b.customerOptOut),
        durationSeconds: b.durationSeconds ?? 42,
        transcriptTurns: b.transcriptTurns || [],
      });
      return sendJson(res, 200, { ok: callbackRes.ok, webhookHttpStatus: callbackRes.status });
    }

    return sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (err) {
    console.error('[northstar-voice] Request error:', err?.message || err);
    return sendJson(res, 500, { ok: false, error: 'Internal voice service error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `[northstar-voice] Listening on ${HOST}:${PORT} | mode=${DISPATCH_MODE} (real calls=${DISPATCH_MODE === 'LIVE'})`
  );
});
