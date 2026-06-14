import { createHash } from 'crypto';

const SNAP_PATH = '/snap/v1/transactions';

function getMidtransBaseUrl(): string {
  const isProd = process.env.MIDTRANS_PRODUCTION === 'true' || process.env.MIDTRANS_PRODUCTION === '1';
  return isProd ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
}

function getCoreApiBaseUrl(): string {
  const isProd = process.env.MIDTRANS_PRODUCTION === 'true' || process.env.MIDTRANS_PRODUCTION === '1';
  return isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

export interface CreateSnapParams {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  enabledPayments?: string[];
}

function cleanObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out as T;
}

export async function createSnapTransaction(params: CreateSnapParams): Promise<{ token: string }> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi');
  }

  const baseUrl = getMidtransBaseUrl();
  const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;

  const payloadWithEnabled = cleanObject({
    transaction_details: cleanObject({
      order_id: String(params.orderId),
      gross_amount: Number(params.grossAmount),
    }),
    customer_details: cleanObject({
      first_name: (params.customerName || 'Customer').trim(),
      email: (params.customerEmail || '').trim(),
    }),
    enabled_payments: ['credit_card'],
  });

  const debugLog = (label: string, value: unknown) => {
    if (process.env.NODE_ENV !== 'production') console.log(label, value);
  };

  async function postSnap(body: unknown) {
    debugLog('[midtrans] snap request', body);
    const res = await fetch(`${baseUrl}${SNAP_PATH}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    debugLog('[midtrans] snap response status', res.status);
    debugLog('[midtrans] snap response body', text);
    return { res, text };
  }

  let snapRes = await postSnap(payloadWithEnabled);

  if (!snapRes.res.ok) {
    const payloadNoEnabled = cleanObject({
      transaction_details: payloadWithEnabled.transaction_details,
      customer_details: payloadWithEnabled.customer_details,
    });
    snapRes = await postSnap(payloadNoEnabled);
  }

  const { res, text } = snapRes;
  let json: { token?: string; redirect_url?: string; error_messages?: string[]; message?: string } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Respons Midtrans tidak valid: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg = json.error_messages?.join('; ') || json.message || text || `HTTP ${res.status}`;
    throw new Error(`Midtrans: ${msg}`);
  }

  if (!json.token) {
    throw new Error('Midtrans tidak mengembalikan snap token');
  }

  return { token: json.token };
}

export interface MidtransNotificationBody {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  gross_amount_raw?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
}


/**
 * @see https://docs.midtrans.com/reference/http-notification
 */
export function verifyMidtransSignature(body: MidtransNotificationBody): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey || !body.signature_key || !body.order_id || body.status_code === undefined || body.gross_amount === undefined) {
    return false;
  }

  const orderId = String(body.order_id);
  const statusCode = String(body.status_code);
  const grossRaw = body.gross_amount;

  const grossCandidates = new Set<string>();
  grossCandidates.add(String(grossRaw).trim());
  const num = parseFloat(String(grossRaw).replace(/,/g, ''));
  if (!Number.isNaN(num)) {
    grossCandidates.add(String(num));
    grossCandidates.add(num.toFixed(2));
    grossCandidates.add(num.toFixed(1));
  }

  for (const grossAmount of grossCandidates) {
    const input = `${orderId}${statusCode}${grossAmount}${serverKey}`;
    const expected = createHash('sha512').update(input).digest('hex');
    if (expected === body.signature_key) return true;
  }
  return false;
}

export function isChargeSuccess(body: MidtransNotificationBody): boolean {
  if (String(body.status_code) !== '200') return false;
  const ts = String(body.transaction_status || '').toLowerCase();
  if (ts === 'settlement') return true;
  if (ts === 'capture') {
    const fraud = String(body.fraud_status || '').toLowerCase();
    return fraud === 'accept' || fraud === '';
  }
  return false;
}

export async function fetchTransactionStatus(orderId: string): Promise<MidtransNotificationBody & Record<string, unknown>> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi');
  }

  const base = getCoreApiBaseUrl();
  const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
  const url = `${base}/v2/${encodeURIComponent(orderId)}/status`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: authHeader,
    },
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Status Midtrans tidak valid: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(String(json.status_message || json.message || `HTTP ${res.status}`));
  }

  return json as MidtransNotificationBody & Record<string, unknown>;
}
