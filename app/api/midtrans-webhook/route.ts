import { NextRequest, NextResponse } from 'next/server';
import { isChargeSuccess, verifyMidtransSignature, type MidtransNotificationBody } from '@/lib/midtrans';
import { activatePremiumForOrder, isPremiumGrossAmount } from '@/lib/subscription/activate-premium.server';

export async function POST(request: NextRequest) {
  let body: MidtransNotificationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  if (!verifyMidtransSignature(body)) {
    console.warn('[midtrans-webhook] signature gagal', {
      order_id: body.order_id,
      status_code: body.status_code,
      gross_amount: body.gross_amount,
      transaction_status: body.transaction_status,
    });
    return NextResponse.json({ error: 'signature_key tidak valid' }, { status: 403 });
  }

  const transactionStatus = String(body.transaction_status || '').toLowerCase();

  if (transactionStatus === 'pending') {
    return NextResponse.json({ ok: true, ignored: 'pending' });
  }

  if (transactionStatus === 'expire' || transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'failure') {
    return NextResponse.json({ ok: true, ignored: transactionStatus });
  }

  if (!isChargeSuccess(body)) {
    console.log('[midtrans-webhook] bukan sukses', { transaction_status: body.transaction_status, status_code: body.status_code });
    return NextResponse.json({ ok: true, ignored: 'not_success' });
  }

  if (!isPremiumGrossAmount(body.gross_amount)) {
    console.warn('[midtrans-webhook] nominal tidak sesuai', { gross_amount: body.gross_amount });
    return NextResponse.json({ error: 'Nominal tidak sesuai paket Premium' }, { status: 400 });
  }

  const orderId = String(body.order_id || '');
  const match = orderId.match(/^SUB-(\d+)-/);
  if (!match) {
    return NextResponse.json({ error: 'order_id tidak dikenali' }, { status: 400 });
  }

  const result = await activatePremiumForOrder(orderId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
