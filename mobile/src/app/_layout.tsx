import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { createAuthServices, readAuthConfig } from '@/adapters/create-auth';
import { OnboardingFlow } from '@/application/onboarding-flow';
import { OnboardingProvider } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';

SplashScreen.preventAutoHideAsync();

// Composition root: the only place that picks concrete adapters for the ports.
const createFlow = () => new OnboardingFlow(createAuthServices(readAuthConfig()));

function AppStack() {
  const { step } = useOnboarding();
  useEffect(() => {
    if (step !== 'booting') SplashScreen.hideAsync();
  }, [step]);
  if (step === 'booting') return null;
  const done = step === 'done';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!done}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={done}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [flow] = useState(createFlow);
  return (
    <OnboardingProvider flow={flow}>
      <AppStack />
    </OnboardingProvider>
  );
}
