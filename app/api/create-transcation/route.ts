import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/auth-service';
import { createSnapTransaction } from '@/lib/midtrans';
import { isPremiumEffective } from '@/lib/subscription/plan';
import { PREMIUM_GROSS_IDR } from '@/lib/subscription/active-premium.server';


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

    const subscriptionStatus = (user as { subscription_status?: string | null }).subscription_status;
    const expiredAt = (user as { expired_at?: string | null }).expired_at;
    if (isPremiumEffective(subscriptionStatus, expiredAt)) {
      return NextResponse.json({ error: 'Akun Anda sudah berstatus Premium aktif.' }, { status: 400 });
    }

    const orderId = `SUB-${user.user_id}-${Date.now()}`;

    const { token: snapToken } = await createSnapTransaction({
      orderId,
      grossAmount: PREMIUM_GROSS_IDR,
      customerName: user.nama,
      customerEmail: user.email,
      enabledPayments: ['bank_transfer'],
    });

    return NextResponse.json({
      snap_token: snapToken,
      order_id: orderId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal membuat transaksi';
    console.error('create-transaction:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
