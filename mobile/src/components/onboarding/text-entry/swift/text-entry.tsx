import { Host, TextField } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  foregroundStyle,
  keyboardType,
  onSubmit,
  submitLabel,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';

import { EntryShell } from '@/components/onboarding/text-entry/entry-shell';
import type { TextEntryProps } from '@/components/onboarding/text-entry/types';
import { Brand } from '@/constants/theme';

export function SwiftTextEntry(props: TextEntryProps) {
  const phone = props.kind === 'phone';
  return (
    <EntryShell prefix={props.prefix} error={props.error}>
      <Host matchContents={{ vertical: true }} style={{ flex: 1 }}>
        <TextField
          autoFocus
          placeholder={props.placeholder}
          onTextChange={props.onChangeText}
          modifiers={[
            keyboardType(phone ? 'phone-pad' : 'ascii-capable'),
            textContentType(phone ? 'telephoneNumber' : 'username'),
            textInputAutocapitalization('never'),
            autocorrectionDisabled(),
            submitLabel('continue'),
            onSubmit(props.onSubmit),
            foregroundStyle(Brand.onGround),
            accessibilityLabel(props.label),
          ]}
        />
      </Host>
    </EntryShell>
  );
}
