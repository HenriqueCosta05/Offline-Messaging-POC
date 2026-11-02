import { Pressable, Text, View } from 'react-native';

import { RowText, rowStyles } from '@/components/onboarding/permission-row/row-text';
import type { PermissionRowProps } from '@/components/onboarding/permission-row/types';

export function PermissionRow({ actionable, onRequest, ...text }: PermissionRowProps) {
  return (
    <View style={rowStyles.row}>
      <RowText {...text} />
      {actionable ? (
        <Pressable accessibilityRole="button" onPress={onRequest} style={rowStyles.webButton}>
          <Text style={rowStyles.webLabel}>Permitir</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
