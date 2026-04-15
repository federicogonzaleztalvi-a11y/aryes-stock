// api/whatsapp.js — WhatsApp Cloud API webhook
// Receives incoming messages and status updates from Meta
// Also used to send messages (OTP, notifications) via WhatsApp Cloud API

import { setCorsHeaders } from './_cors.js';

const WA_TOKEN = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'pazque_webhook_2026';
const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Webhook verification (GET) — Meta sends this to verify the endpoint ──
function handleVerify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
    console.log('[whatsapp] Webhook verified');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Verification failed' });
}

// ── Webhook notification (POST) — Meta sends incoming messages here ──
async function handleWebhook(req, res) {
  const body = req.body;

  if (!body?.object) return res.status(400).json({ error: 'Invalid payload' });

  // Process each entry
  if (body.entry) {
    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};

        // Incoming messages
        if (value.messages) {
          for (const msg of value.messages) {
            console.log('[whatsapp] Incoming message:', {
              from: msg.from,
              type: msg.type,
              text: msg.text?.body?.slice(0, 100),
              timestamp: msg.timestamp,
            });

            // Store incoming message in Supabase for future bot processing
            if (SB_URL && SB_SVC) {
              try {
                await fetch(SB_URL + '/rest/v1/wa_messages', {
                  method: 'POST',
                  headers: {
                    apikey: SB_SVC,
                    Authorization: 'Bearer ' + SB_SVC,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                  },
                  body: JSON.stringify({
                    phone_number_id: value.metadata?.phone_number_id || WA_PHONE_ID,
                    from_number: msg.from,
                    message_type: msg.type,
                    message_body: msg.text?.body || null,
                    message_id: msg.id,
                    timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
                    direction: 'incoming',
                    raw: JSON.stringify(msg),
                  }),
                });
              } catch (e) {
                console.error('[whatsapp] Failed to store message:', e.message);
              }
            }
          }
        }

        // Status updates (sent, delivered, read)
        if (value.statuses) {
          for (const status of value.statuses) {
            console.log('[whatsapp] Status update:', {
              id: status.id,
              status: status.status,
              recipient: status.recipient_id,
            });
          }
        }
      }
    }
  }

  // Always return 200 quickly — Meta retries if it doesn't get 200 within 20s
  return res.status(200).json({ received: true });
}

// ── Send WhatsApp message via Cloud API ──
export async function sendWhatsApp(to, text, phoneId) {
  const pid = phoneId || WA_PHONE_ID;
  if (!WA_TOKEN || !pid) {
    console.warn('[whatsapp] Missing WA_ACCESS_TOKEN or WA_PHONE_NUMBER_ID');
    return null;
  }

  const url = `https://graph.facebook.com/v25.0/${pid}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + WA_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[whatsapp] Send failed:', err);
    return null;
  }

  const data = await res.json();
  console.log('[whatsapp] Message sent to', to);
  return data;
}

// ── Send template message (for OTP, notifications) ──
export async function sendWhatsAppTemplate(to, templateName, languageCode, components, phoneId) {
  const pid = phoneId || WA_PHONE_ID;
  if (!WA_TOKEN || !pid) return null;

  const url = `https://graph.facebook.com/v25.0/${pid}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode || 'es' },
    },
  };
  if (components) body.template.components = components;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + WA_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[whatsapp] Template send failed:', err);
    return null;
  }

  return await res.json();
}

// ── Router ──
export default async function handler(req, res) {
  await setCorsHeaders(req, res);

  if (req.method === 'GET') return handleVerify(req, res);
  if (req.method === 'POST') return handleWebhook(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
