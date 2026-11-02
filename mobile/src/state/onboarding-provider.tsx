import { createContext, useContext, useEffect, type ReactNode } from 'react';

import type { OnboardingFlow } from '@/application/onboarding-flow';

const FlowContext = createContext<OnboardingFlow | null>(null);

export function useOnboardingFlow() {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error('useOnboardingFlow must be used inside <OnboardingProvider>');
  return flow;
}

type OnboardingProviderProps = { flow: OnboardingFlow; children: ReactNode };

/** Shares the flow with the screens and boots it once mounted. */
export function OnboardingProvider({ flow, children }: OnboardingProviderProps) {
  useEffect(() => {
    flow.boot();
  }, [flow]);

  return <FlowContext.Provider value={flow}>{children}</FlowContext.Provider>;
}
