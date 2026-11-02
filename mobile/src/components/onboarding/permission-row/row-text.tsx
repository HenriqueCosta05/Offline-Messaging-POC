import { StyleSheet, Text, View } from 'react-native';

import type { PermissionRowProps } from '@/components/onboarding/permission-row/types';
import { Brand } from '@/constants/theme';

export function RowText({ title, reason, status }: Pick<PermissionRowProps, 'title' | 'reason' | 'status'>) {
  return (
    <View style={styles.text}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.reason}>{reason}</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

export const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  webButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Brand.field, justifyContent: 'center' },
  webLabel: { color: Brand.onGround, fontWeight: '600' },
});

const styles = StyleSheet.create({
  text: { flex: 1, gap: 2 },
  title: { color: Brand.onGround, fontSize: 17, fontWeight: '600' },
  reason: { color: Brand.muted, fontSize: 14, lineHeight: 19 },
  status: { color: Brand.pending, fontSize: 13 },
});
