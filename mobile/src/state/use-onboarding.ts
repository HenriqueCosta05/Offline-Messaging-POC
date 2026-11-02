import { useSyncExternalStore } from 'react';

import type { OnboardingState } from '@/application/onboarding-flow';
import { useOnboardingFlow } from '@/state/onboarding-provider';

export function useOnboarding(): OnboardingState {
  const flow = useOnboardingFlow();
  return useSyncExternalStore(flow.subscribe, flow.snapshot);
}
