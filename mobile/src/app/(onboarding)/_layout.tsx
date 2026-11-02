import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { routeForStep } from '@/lib/onboarding-routes';
import { useOnboarding } from '@/state/use-onboarding';

export const unstable_settings = { initialRouteName: 'phone' };

export default function OnboardingLayout() {
  const { step } = useOnboarding();
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const route = routeForStep(step);
    if (route) router.navigate(route);
  }, [step]);
  const animation = Platform.OS === 'android' ? 'fade_from_bottom' : 'default';
  return <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'fade' : animation }} />;
}
