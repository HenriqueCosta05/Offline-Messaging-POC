export type TextEntryProps = {
  kind: 'phone' | 'username';
  label: string;
  placeholder: string;
  prefix?: string;
  error?: string | null;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
};
