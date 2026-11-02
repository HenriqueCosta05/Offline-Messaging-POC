import { Button, Host, LoadingIndicator, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import type { PrimaryButtonProps } from '@/components/onboarding/primary-button/types';
import { Brand } from '@/constants/theme';

export function ComposePrimaryButton({ label, busy = false, onPress }: PrimaryButtonProps) {
  return (
    <Host matchContents={{ vertical: true }}>
      <Button
        onClick={onPress}
        enabled={!busy}
        colors={{ containerColor: Brand.cta, contentColor: Brand.onCta, disabledContainerColor: Brand.muted }}
        modifiers={[fillMaxWidth()]}>
        {busy ? <LoadingIndicator /> : <Text>{label}</Text>}
      </Button>
    </Host>
  );
}
