export function getMidtransSnapScriptUrl(): string {
  const isProd = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true' || process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === '1';
  return isProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
}
