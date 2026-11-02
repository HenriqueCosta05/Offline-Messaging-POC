import { FilledTonalButton, Host, Text } from '@expo/ui/jetpack-compose';
import { View } from 'react-native';

import { RowText, rowStyles } from '@/components/onboarding/permission-row/row-text';
import type { PermissionRowProps } from '@/components/onboarding/permission-row/types';
import { Brand } from '@/constants/theme';

export function ComposePermissionRow({ actionable, onRequest, ...text }: PermissionRowProps) {
  return (
    <View style={rowStyles.row}>
      <RowText {...text} />
      {actionable ? (
        <Host matchContents>
          <FilledTonalButton onClick={onRequest} colors={{ containerColor: Brand.field, contentColor: Brand.onGround }}>
            <Text>Permitir</Text>
          </FilledTonalButton>
        </Host>
      ) : null}
    </View>
  );
}
