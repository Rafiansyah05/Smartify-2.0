export const FREE_TRIAL_MAX_QUESTIONS = 15;
export const PREMIUM_MAX_QUESTIONS = 50;
export const FREE_MAX_GENERATES_PER_24H = 2;

export type Plan = 'free' | 'premium';

export function isPremiumEffective(subscriptionStatus: string | null | undefined, expiredAt: string | null | undefined): boolean {
  if (subscriptionStatus !== 'premium') return false;
  if (!expiredAt) return false;
  let iso = expiredAt;
  if (typeof iso === 'string' && !iso.endsWith('Z') && !iso.includes('+')) iso += 'Z';
  return new Date(iso).getTime() > Date.now();
}
