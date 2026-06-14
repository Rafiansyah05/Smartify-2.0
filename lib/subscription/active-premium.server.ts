import { supabaseServer } from '@/lib/supabase/server';

export const PREMIUM_GROSS_IDR = 79000;

export function parseOrderUserId(orderId: string): number | null {
  const m = String(orderId).match(/^SUB-(\d+)-/);
  return m ? parseInt(m[1], 10) : null;
}

export function isPremiumGrossAmount(gross: string | number | undefined | null): boolean {
  if (gross === undefined || gross === null) return false;
  const n = parseFloat(String(gross).replace(/,/g, '').trim());
  return !Number.isNaN(n) && Math.abs(n - PREMIUM_GROSS_IDR) < 0.01;
}

export async function activatePremiumForOrder(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = parseOrderUserId(orderId);
  if (userId === null) {
    return { ok: false, error: 'order_id tidak dikenali' };
  }

  const { data: existingLog } = await supabaseServer.from('midtrans_notification_log').select('order_id').eq('order_id', orderId).maybeSingle();

  if (existingLog) {
    return { ok: true };
  }

  const expired = new Date();
  expired.setDate(expired.getDate() + 30);

  const { error: updErr } = await supabaseServer
    .from('users')
    .update({
      subscription_status: 'premium',
      expired_at: expired.toISOString(),
    })
    .eq('user_id', userId);

  if (updErr) {
    console.error('activatePremiumForOrder user update:', updErr);
    return { ok: false, error: 'Gagal memperbarui user' };
  }

  const { error: logErr } = await supabaseServer.from('midtrans_notification_log').insert({ order_id: orderId });

  if (logErr) {
    console.warn('activatePremiumForOrder notification log:', logErr);
  }

  return { ok: true };
}
