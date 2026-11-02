import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import type { TextEntryProps } from '@/components/onboarding/text-entry/types';
import { Brand } from '@/constants/theme';

type EntryShellProps = Pick<TextEntryProps, 'prefix' | 'error'> & { children: ReactNode };

export function EntryShell({ prefix, error, children }: EntryShellProps) {
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  return (
    <View style={styles.wrap}>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        {children}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  field: { minHeight: 52, borderRadius: 12, backgroundColor: Brand.field, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  fieldError: { borderWidth: 2, borderColor: Brand.error },
  prefix: { color: Brand.muted, fontSize: 17, fontWeight: '600' },
  error: { color: Brand.error, fontSize: 14 },
});
