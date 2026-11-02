import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useOnboarding } from '@/state/use-onboarding';

export default function HomeScreen() {
  const { userId } = useOnboarding();
  return (
    <SafeAreaView style={styles.ground}>
      <Text accessibilityRole="header" style={styles.title}>
        Tudo pronto
      </Text>
      <Text style={styles.subtitle}>{userId ? `Você entrou como ${userId.split(':')[0]}.` : ''}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: Brand.ground, justifyContent: 'center', paddingHorizontal: 20, gap: 10 },
  title: { color: Brand.onGround, fontSize: 34, fontWeight: '700' },
  subtitle: { color: Brand.muted, fontSize: 17 },
});
