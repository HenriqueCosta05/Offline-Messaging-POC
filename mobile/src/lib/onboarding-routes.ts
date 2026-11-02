import type { OnboardingStep } from '@/domain/onboarding';

const ROUTES = { phone: '/phone', username: '/username', permissions: '/permissions' } as const;
type OnboardingRoute = (typeof ROUTES)[keyof typeof ROUTES];

export function routeForStep(step: OnboardingStep): OnboardingRoute | null {
  return step in ROUTES ? ROUTES[step as keyof typeof ROUTES] : null;
}
