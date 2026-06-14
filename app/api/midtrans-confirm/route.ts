import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/auth-service';
import { fetchTransactionStatus, isChargeSuccess, type MidtransNotificationBody } from '@/lib/midtrans';
import { activatePremiumForOrder, isPremiumGrossAmount } from '@/lib/subscription/activate-premium.server';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
    if (!orderId || !orderId.startsWith(`SUB-${user.user_id}-`)) {
      return NextResponse.json({ error: 'order_id tidak valid' }, { status: 400 });
    }

    const statusJson = await fetchTransactionStatus(orderId);

    const mapped: MidtransNotificationBody = {
      order_id: String(statusJson.order_id ?? orderId),
      status_code: String(statusJson.status_code ?? ''),
      gross_amount: String(statusJson.gross_amount ?? ''),
      transaction_status: String(statusJson.transaction_status ?? ''),
      fraud_status: statusJson.fraud_status != null ? String(statusJson.fraud_status) : undefined,
      payment_type: statusJson.payment_type != null ? String(statusJson.payment_type) : undefined,
    };

    if (!isChargeSuccess(mapped)) {
      return NextResponse.json(
        { error: 'Pembayaran belum sukses atau masih diproses', transaction_status: mapped.transaction_status },
        { status: 409 },
      );
    }

    if (!isPremiumGrossAmount(mapped.gross_amount)) {
      return NextResponse.json({ error: 'Nominal transaksi tidak sesuai paket' }, { status: 400 });
    }

    const result = await activatePremiumForOrder(orderId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Gagal konfirmasi pembayaran';
    console.error('midtrans-confirm:', e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
