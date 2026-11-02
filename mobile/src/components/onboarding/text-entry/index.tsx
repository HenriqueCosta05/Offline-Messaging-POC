import { TextInput } from 'react-native';

import { EntryShell } from '@/components/onboarding/text-entry/entry-shell';
import type { TextEntryProps } from '@/components/onboarding/text-entry/types';
import { Brand } from '@/constants/theme';

export function TextEntry(props: TextEntryProps) {
  return (
    <EntryShell prefix={props.prefix} error={props.error}>
      <TextInput
        autoFocus
        accessibilityLabel={props.label}
        placeholder={props.placeholder}
        placeholderTextColor={Brand.pending}
        keyboardType={props.kind === 'phone' ? 'phone-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={props.onChangeText}
        onSubmitEditing={props.onSubmit}
        style={{ flex: 1, color: Brand.onGround, fontSize: 17 }}
      />
    </EntryShell>
  );
}
