import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';

type StepRailProps = { step: 1 | 2 | 3 };

export function StepRail({ step }: StepRailProps) {
  const color = (n: number) => {
    if (n === step) return Brand.onGround;
    return n < step ? Brand.muted : Brand.field;
  };
  return (
    <View accessible accessibilityLabel={`Etapa ${step} de 3`} style={styles.rail}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={[styles.dash, { backgroundColor: color(n) }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', right: 16, top: '38%', gap: 10 },
  dash: { width: 6, height: 28, borderRadius: 3 },
});
