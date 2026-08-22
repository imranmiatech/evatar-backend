import { SubscriptionInterval } from '@prisma/client';

type MembershipPlanLike = {
  name: string;
  price: number;
  currency: string;
  maxChildren: number;
  interval: SubscriptionInterval;
  additionalChildPrice?: number | null;
  additionalChildCurrency?: string | null;
  description?: string | null;
  badgeText?: string | null;
};

export type MembershipPricingBreakdown = {
  childCount: number;
  includedChildren: number;
  additionalChildren: number;
  basePrice: number;
  baseCurrency: string;
  additionalChildPrice: number;
  additionalChildCurrency: string;
  additionalChildrenAmount: number;
  totalAmount: number;
  totalCurrency: string;
  periodLabel: 'month' | 'year';
  description: string | null;
  badgeText: string | null;
  additionalChildText: string;
  trialPlanLabel: string;
};

export function computeMembershipPricing(
  plan: MembershipPlanLike,
  childCount: number,
): MembershipPricingBreakdown {
  const normalizedChildCount = Math.max(0, childCount);
  const additionalChildPrice = Number(plan.additionalChildPrice ?? 35);
  const additionalChildCurrency = (
    plan.additionalChildCurrency ||
    plan.currency ||
    'AED'
  ).toUpperCase();
  const additionalChildren = Math.max(0, normalizedChildCount - plan.maxChildren);
  const additionalChildrenAmount = additionalChildren * additionalChildPrice;
  const totalAmount = Number(plan.price) + additionalChildrenAmount;

  return {
    childCount: normalizedChildCount,
    includedChildren: plan.maxChildren,
    additionalChildren,
    basePrice: Number(plan.price),
    baseCurrency: (plan.currency || 'AED').toUpperCase(),
    additionalChildPrice,
    additionalChildCurrency,
    additionalChildrenAmount,
    totalAmount,
    totalCurrency: (plan.currency || additionalChildCurrency || 'AED').toUpperCase(),
    periodLabel:
      plan.interval === SubscriptionInterval.ANNUALLY ? 'year' : 'month',
    description: plan.description ?? null,
    badgeText: plan.badgeText ?? null,
    additionalChildText: `+${formatMoneyInline(
      additionalChildPrice,
      additionalChildCurrency,
    )} / month per additional child.`,
    trialPlanLabel: `${Math.max(1, normalizedChildCount)} Child Subscription Plan`,
  };
}

export function formatMoneyInline(amount: number, currency: string) {
  const normalized = (currency || 'AED').toUpperCase();
  const formattedAmount = Number.isInteger(amount)
    ? amount.toLocaleString('en-US')
    : amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

  if (normalized === 'USD') {
    return `$${formattedAmount} ${normalized}`;
  }

  return `${normalized} ${formattedAmount}`;
}
