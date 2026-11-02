import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import type { PrimaryButtonProps } from '@/components/onboarding/primary-button/types';
import { Brand } from '@/constants/theme';

export function PrimaryButton({ label, busy = false, onPress }: PrimaryButtonProps) {
  return (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={styles.button}>
      {busy ? <ActivityIndicator color={Brand.onCta} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 14, backgroundColor: Brand.cta, alignItems: 'center', justifyContent: 'center' },
  label: { color: Brand.onCta, fontSize: 17, fontWeight: '600' },
});
