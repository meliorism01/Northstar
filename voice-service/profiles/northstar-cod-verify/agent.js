import crypto from 'node:crypto';
import { signPayload } from '../../src/lib/signature.js';

export const TERMINAL_TOOLS = new Set([
  'confirm_order',
  'reject_order',
  'request_cancellation',
  'escalate_to_human',
  'mark_uncertain',
]);

export function renderContext(attrs = {}, lang = 'hi-IN') {
  return {
    callSessionId: attrs.call_session_id || '',
    callAttemptId: attrs.call_attempt_id || '',
    providerCallId: attrs.sip_call_id || attrs.provider_call_id || '',
    roomName: attrs.room_name || '',
    storeName: attrs.store_name || 'our store',
    customerName: attrs.customer_name || 'Customer',
    orderNumber: attrs.order_number || '',
    productName: attrs.product_name || 'your items',
    quantity: attrs.quantity || '1',
    totalAmount: attrs.total_amount || '',
    currency: attrs.currency || 'INR',
    shippingAddress: attrs.shipping_address || '',
    callbackWebhookUrl: attrs.callback_webhook_url || '',
    lang,
  };
}

export function buildWelcome(ctx, lang = 'hi-IN') {
  if (lang === 'en-IN') {
    return `Hello ${ctx.customerName}, I am Priya, an automated assistant calling on behalf of ${ctx.storeName}. This call may be recorded for order verification. You placed Cash on Delivery order ${ctx.orderNumber} for ${ctx.productName} (quantity ${ctx.quantity}, total ${ctx.currency} ${ctx.totalAmount}) to ${ctx.shippingAddress}. Did you place this order, and will you be available to receive delivery?`;
  }
  return `Namaste ${ctx.customerName} ji, main Priya bol rahi hoon, ${ctx.storeName} ki automated verification assistant. Yeh call quality ke liye record ho sakti hai. Aapne Cash on Delivery order ${ctx.orderNumber} mein ${ctx.productName} (quantity ${ctx.quantity}, kul rashi ${ctx.currency} ${ctx.totalAmount}) ${ctx.shippingAddress} ke pate par book kiya hai. Kya aap yeh order confirm karte hain aur delivery lene ke liye upalabdh rahenge?`;
}

export function buildSystemPrompt(ctx, lang = 'hi-IN') {
  return `You are Priya, an automated voice assistant calling on behalf of ${ctx.storeName} (powered by NORTHSTAR).
Your sole objective is to politely verify a Cash-on-Delivery (COD) order.

Verified Order Facts (DO NOT invent information beyond these):
- Customer Name: ${ctx.customerName}
- Order Number: ${ctx.orderNumber}
- Product & Quantity: ${ctx.productName} (Qty: ${ctx.quantity})
- Total COD Payable: ${ctx.currency} ${ctx.totalAmount}
- Shipping Address: ${ctx.shippingAddress}
- Preferred Language: ${lang}

Conversation Rules:
1. Speak naturally, concisely (1-2 short sentences per turn), and switch smoothly between Hindi/Hinglish and English if the customer switches.
2. Confirm: (a) they placed the order, (b) product/quantity and address are accurate, and (c) they still want the order and will be available to pay cash on delivery.
3. Never make unverified promises about exact delivery dates, discounts, or refund timelines.
4. Never ask for OTPs, UPI PINs, card numbers, or unnecessary personal data.
5. Invoke exactly ONE terminal tool as soon as buyer intent is clear:
   - confirm_order -> Customer confirms order and delivery readiness.
   - reject_order -> Customer says they never placed this order.
   - request_cancellation -> Customer placed it by mistake or wants to cancel (pass optOut=true if they ask not to be called again).
   - escalate_to_human -> Customer asks for a human representative or asks an out-of-scope policy question.
   - mark_uncertain -> After 2 polite clarifications, intent remains ambiguous.`;
}

export async function postOutcomeWebhook({ backendBaseUrl, webhookSecret, ctx, outcome, summary, customerIntent, customerOptOut = false, durationSeconds = 45, transcriptTurns = [] }) {
  const payload = {
    eventId: `voice-${crypto.randomUUID()}`,
    eventType: 'CALL_COMPLETED',
    callSessionId: ctx.callSessionId || null,
    callAttemptId: ctx.callAttemptId || null,
    providerCallId: ctx.providerCallId || null,
    roomName: ctx.roomName || null,
    outcome,
    durationSeconds,
    aiSummary: summary,
    customerIntent,
    customerOptOut,
    transcriptTurns,
  };
  const rawBody = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const signature = signPayload(webhookSecret, ts, rawBody);
  const url = `${backendBaseUrl.replace(/\/+$/, '')}${ctx.callbackWebhookUrl || '/api/v1/calling/webhooks/provider'}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Northstar-Timestamp': String(ts),
      'X-Northstar-Signature': signature,
    },
    body: rawBody,
  });
  return { status: res.status, ok: res.ok };
}
