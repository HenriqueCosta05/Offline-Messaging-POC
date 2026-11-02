import { Button, Host } from '@expo/ui/swift-ui';
import { buttonStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { RowText, rowStyles } from '@/components/onboarding/permission-row/row-text';
import type { PermissionRowProps } from '@/components/onboarding/permission-row/types';
import { Brand } from '@/constants/theme';

export function SwiftPermissionRow({ actionable, onRequest, ...text }: PermissionRowProps) {
  return (
    <View style={rowStyles.row}>
      <RowText {...text} />
      {actionable ? (
        <Host matchContents>
          <Button label="Permitir" onPress={onRequest} modifiers={[buttonStyle('bordered'), tint(Brand.onGround)]} />
        </Host>
      ) : null}
    </View>
  );
}
