import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepRail } from '@/components/onboarding/step-rail';
import { Brand } from '@/constants/theme';

type StepFrameProps = { step: 1 | 2 | 3; title: string; subtitle: string; children: ReactNode };

/** One step owns the whole screen: content anchored low, lifted with the keyboard. */
export function StepFrame({ step, title, subtitle, children }: StepFrameProps) {
  return (
    <SafeAreaView style={styles.ground}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fill}>
        <StepRail step={step} />
        <View style={styles.bottom}>
          <Text style={styles.kicker}>{`${step} de 3`}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: Brand.ground },
  fill: { flex: 1, justifyContent: 'flex-end' },
  bottom: { paddingHorizontal: 20, paddingRight: 44, paddingBottom: 24, gap: 10 },
  kicker: { color: Brand.muted, fontSize: 13, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: Brand.onGround, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  subtitle: { color: Brand.muted, fontSize: 17, lineHeight: 22, marginBottom: 14 },
});
