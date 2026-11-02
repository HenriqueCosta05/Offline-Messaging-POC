import { Host, Text, TextField } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import { EntryShell } from '@/components/onboarding/text-entry/entry-shell';
import type { TextEntryProps } from '@/components/onboarding/text-entry/types';
import { Brand } from '@/constants/theme';

const COLORS = {
  focusedContainerColor: Brand.field,
  unfocusedContainerColor: Brand.field,
  errorContainerColor: Brand.field,
  focusedTextColor: Brand.onGround,
  unfocusedTextColor: Brand.onGround,
  cursorColor: Brand.onGround,
  focusedIndicatorColor: Brand.onGround,
  unfocusedIndicatorColor: Brand.accent,
  errorIndicatorColor: Brand.error,
  focusedPlaceholderColor: Brand.pending,
  unfocusedPlaceholderColor: Brand.pending,
};

export function ComposeTextEntry(props: TextEntryProps) {
  return (
    <EntryShell prefix={props.prefix} error={props.error}>
      <Host matchContents={{ vertical: true }} style={{ flex: 1 }}>
        <TextField
          autoFocus
          singleLine
          isError={Boolean(props.error)}
          colors={COLORS}
          onValueChange={props.onChangeText}
          keyboardOptions={{
            keyboardType: props.kind === 'phone' ? 'phone' : 'ascii',
            capitalization: 'none',
            autoCorrectEnabled: false,
            imeAction: 'done',
          }}
          keyboardActions={{ onDone: props.onSubmit }}
          modifiers={[fillMaxWidth()]}>
          <TextField.Placeholder>
            <Text>{props.placeholder}</Text>
          </TextField.Placeholder>
        </TextField>
      </Host>
    </EntryShell>
  );
}
