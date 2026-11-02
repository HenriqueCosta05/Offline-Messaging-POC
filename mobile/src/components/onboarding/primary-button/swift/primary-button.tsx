import { Button, Host, ProgressView, Text } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, foregroundStyle, frame, tint } from '@expo/ui/swift-ui/modifiers';

import type { PrimaryButtonProps } from '@/components/onboarding/primary-button/types';
import { Brand } from '@/constants/theme';

export function SwiftPrimaryButton({ label, busy = false, onPress }: PrimaryButtonProps) {
  return (
    <Host matchContents={{ vertical: true }}>
      <Button
        onPress={onPress}
        modifiers={[buttonStyle('borderedProminent'), controlSize('large'), tint(Brand.cta), disabled(busy)]}>
        {busy ? (
          <ProgressView modifiers={[frame({ maxWidth: Infinity })]} />
        ) : (
          <Text modifiers={[foregroundStyle(Brand.onCta), frame({ maxWidth: Infinity })]}>{label}</Text>
        )}
      </Button>
    </Host>
  );
}
