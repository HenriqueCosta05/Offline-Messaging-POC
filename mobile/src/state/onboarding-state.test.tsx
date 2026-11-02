// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { OnboardingFlow } from '@/application/onboarding-flow';
import { OnboardingProvider, useOnboardingFlow } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';
import { fakeOnboardingPorts } from '@/test/fakes';

let flow: OnboardingFlow;

const wrapper = ({ children }: { children: ReactNode }) => (
  <OnboardingProvider flow={flow}>{children}</OnboardingProvider>
);

beforeEach(() => {
  flow = new OnboardingFlow(fakeOnboardingPorts());
});

describe('OnboardingProvider', () => {
  it('boots the flow and re-renders on every change', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.step).toBe('phone'));
    await act(() => flow.submitPhone('+5511999990000'));
    expect(result.current.step).toBe('username');
  });

  it('hands the flow to the screens', () => {
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper });
    expect(result.current).toBe(flow);
  });

  it('requires the provider', () => {
    expect(() => renderHook(() => useOnboardingFlow())).toThrow('inside <OnboardingProvider>');
  });
});
