'use client';

import { useState } from 'react';
import { UpgradeModal } from '@/components/upgrade-modal';
import { isPremiumEffective } from '@/lib/subscription/plan';

export interface NavbarSubscriptionProps {
  subscriptionStatus?: string | null;
  expiredAt?: string | null;
  onRefetchUser?: () => void;
}

export function NavbarSubscription({ subscriptionStatus, expiredAt, onRefetchUser }: NavbarSubscriptionProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const premium = isPremiumEffective(subscriptionStatus, expiredAt);

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-block ${
            premium ? 'border border-primary/30 bg-primary/10 text-primary' : 'border border-gray-200 bg-gray-50 text-gray-600'
          }`}
        >
          {premium ? 'Premium' : 'Free Trial'}
        </span>
        {!premium && (
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Upgrade
          </button>
        )}
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onAfterPaymentFlow={() => {
          onRefetchUser?.();
        }}
      />
    </>
  );
}
