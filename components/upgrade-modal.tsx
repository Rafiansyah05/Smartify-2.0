'use client';

import { useCallback, useState } from 'react';
import { X, Loader2, Sparkles, Check } from 'lucide-react';
import { getMidtransSnapScriptUrl } from '@/lib/midtrans-public';

declare global {
  interface Window {
    snap?: {
      pay(token: string, opts?: Record<string, unknown>): void;
    };
  }
}

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  onAfterPaymentFlow?: () => void;
  limitBanner?: string;
}

const FREE_BENEFITS = ['Generate soal maks. 2× per 24 jam', 'Maksimal 15 soal', 'Hanya pilihan ganda'];
const PREMIUM_BENEFITS = ['Unlimited generate', 'Maksimal 50 soal', 'Isian singkat & campuran'];

function loadSnapJs(clientKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.snap) return resolve();

    const src = getMidtransSnapScriptUrl();
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (window.snap) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Gagal memuat Midtrans Snap')));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-client-key', clientKey);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat Midtrans Snap'));
    document.body.appendChild(script);
  });
}

export function UpgradeModal({ open, onClose, onAfterPaymentFlow, limitBanner }: UpgradeModalProps) {
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePremiumCheckout = useCallback(async () => {
    setError('');
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    if (!clientKey) {
      setError('NEXT_PUBLIC_MIDTRANS_CLIENT_KEY belum diset.');
      return;
    }

    setPayLoading(true);
    try {
      const res = await fetch('/api/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat transaksi');

      const snapToken = data.snap_token as string;
      if (!snapToken) throw new Error('Token pembayaran tidak tersedia');
      const orderId = typeof data.order_id === 'string' ? data.order_id : '';

      await loadSnapJs(clientKey);

      if (!window.snap?.pay) {
        throw new Error('Midtrans Snap tidak tersedia setelah memuat script');
      }

      window.snap.pay(snapToken, {
        onSuccess: async () => {
          if (orderId) {
            try {
              const confirmRes = await fetch('/api/midtrans-confirm', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId }),
              });
              if (!confirmRes.ok) {
                const errBody = await confirmRes.json().catch(() => ({}));
                console.warn('[upgrade] midtrans-confirm gagal', confirmRes.status, errBody);
              }
            } catch (e) {
              console.warn('[upgrade] midtrans-confirm error', e);
            }
          }
          onAfterPaymentFlow?.();
        },
        onPending: () => {
          onAfterPaymentFlow?.();
        },
        onError: () => {
          setError('Payment method tidak tersedia, silakan hubungi admin');
          onAfterPaymentFlow?.();
        },
        onClose: () => {
          onAfterPaymentFlow?.();
        },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setPayLoading(false);
    }
  }, [onAfterPaymentFlow]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Pilih paket</h2>
            <p className="text-sm text-gray-500">Sesuaikan dengan kebutuhan mengajar Anda</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {limitBanner && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{limitBanner}</div>}
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Free Trial */}
            <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Free Trial</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">Rp0</p>
                <p className="text-sm text-gray-500">Mulai tanpa biaya</p>
              </div>
              <ul className="mb-6 flex-1 space-y-3">
                {FREE_BENEFITS.map((b) => (
                  <li key={b} className="flex gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {b}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Pilih paket
              </button>
            </div>

            {/* Premium */}
            <div className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-white p-6 shadow-md">
              <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Populer
              </div>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Premium</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  Rp79.000
                  <span className="text-base font-medium text-gray-500"> / bulan</span>
                </p>
                <p className="text-sm text-gray-600">Akses penuh fitur generate</p>
              </div>
              <ul className="mb-6 flex-1 space-y-3">
                {PREMIUM_BENEFITS.map((b) => (
                  <li key={b} className="flex gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {b}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={payLoading}
                onClick={handlePremiumCheckout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {payLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyiapkan pembayaran...
                  </>
                ) : (
                  'Pilih paket'
                )}
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">Pembayaran aman melalui Midtrans. Status premium diperbarui otomatis setelah pembayaran berhasil.</p>
        </div>
      </div>
    </div>
  );
}
