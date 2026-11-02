import { useState } from 'react';

import { PrimaryButton } from '@/components/onboarding/primary-button';
import { StepFrame } from '@/components/onboarding/step-frame';
import { TextEntry } from '@/components/onboarding/text-entry';
import { errorMessage } from '@/lib/onboarding-copy';
import { useOnboardingFlow } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';

export default function UsernameScreen() {
  const [username, setUsername] = useState('');
  const { error, busy } = useOnboarding();
  const flow = useOnboardingFlow();
  const send = () => flow.submitUsername(username);
  return (
    <StepFrame step={2} title="Escolha seu nome" subtitle="É o endereço pelo qual as pessoas te encontram. Ele não muda depois.">
      <TextEntry
        kind="username"
        label="Nome de usuário"
        placeholder="seu.nome"
        prefix="@"
        error={error ? errorMessage(error) : null}
        onChangeText={setUsername}
        onSubmit={send}
      />
      <PrimaryButton label={error === 'bridge_unreachable' ? 'Tentar de novo' : 'Continuar'} busy={busy} onPress={send} />
    </StepFrame>
  );
}
