import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIRoute } from 'astro';

const MAX_PAYLOAD_BYTES = 1_000_000;
const FORWARD_TIMEOUT_MS = 8_000;

// This API route must be available after the static site has been built.
export const prerender = false;

function textResponse(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function isValidSignature(rawBody: Uint8Array, signatureHeader: string | null, appSecret: string) {
  const signature = signatureHeader?.match(/^sha256=([a-f0-9]{64})$/i)?.[1];
  if (!signature) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

export const GET: APIRoute = ({ url }) => {
  // `process.env` is intentionally used here: these secrets are supplied when
  // the Docker container starts, not when Astro creates the production build.
  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error('Instagram webhook is not configured: INSTAGRAM_WEBHOOK_VERIFY_TOKEN is missing.');
    return textResponse('Webhook configuration error', 500);
  }

  const mode = url.searchParams.get('hub.mode');
  const challenge = url.searchParams.get('hub.challenge');
  const receivedToken = url.searchParams.get('hub.verify_token');

  if (mode !== 'subscribe' || !challenge || !receivedToken || receivedToken !== verifyToken) {
    return textResponse('Forbidden', 403);
  }

  return textResponse(challenge, 200);
};

export const POST: APIRoute = async ({ request }) => {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    console.error('Instagram webhook is not configured: INSTAGRAM_APP_SECRET is missing.');
    return textResponse('Webhook configuration error', 500);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_PAYLOAD_BYTES) {
    return textResponse('Payload too large', 413);
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (rawBody.byteLength > MAX_PAYLOAD_BYTES) return textResponse('Payload too large', 413);

  if (!isValidSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    return textResponse('Invalid signature', 401);
  }

  let body: { object?: string; entry?: unknown[] };
  try {
    body = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return textResponse('Invalid JSON', 400);
  }

  // The JSON string is deliberate: it keeps the full event readable in
  // container log aggregators such as EasyPanel instead of showing [Object].
  console.log(
    'Webhook Instagram recebido',
    JSON.stringify({
      horario: new Date().toISOString(),
      tipo: body.object,
      entradas: body.entry?.length ?? 0,
      payload: body,
    }),
  );

  const forwardUrl = process.env.INSTAGRAM_WEBHOOK_FORWARD_URL;
  if (!forwardUrl) return textResponse('EVENT_RECEIVED', 200);

  let destination: URL;
  try {
    destination = new URL(forwardUrl);
    if (destination.protocol !== 'https:') throw new Error('Only HTTPS destinations are allowed.');
  } catch {
    console.error('Instagram webhook is not configured: INSTAGRAM_WEBHOOK_FORWARD_URL must be a valid HTTPS URL.');
    return textResponse('Webhook configuration error', 500);
  }

  try {
    const response = await fetch(destination, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'instagram-meta',
        'X-Webhook-Signature-Verified': 'sha256',
      },
      body: rawBody,
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`Instagram webhook destination returned HTTP ${response.status}.`);
      return textResponse('Webhook destination failed', 502);
    }
  } catch (error) {
    console.error('Instagram webhook destination could not be reached.', error);
    return textResponse('Webhook destination unavailable', 502);
  }

  return textResponse('EVENT_RECEIVED', 200);
};
