import { useState } from 'react';

import { PrimaryButton } from '@/components/onboarding/primary-button';
import { StepFrame } from '@/components/onboarding/step-frame';
import { TextEntry } from '@/components/onboarding/text-entry';
import { errorMessage } from '@/lib/onboarding-copy';
import { useOnboardingFlow } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const { error, busy } = useOnboarding();
  const flow = useOnboardingFlow();
  const send = () => flow.submitPhone(phone);
  return (
    <StepFrame step={1} title="Qual é o seu número?" subtitle="Ele identifica sua conta. Não mandamos SMS.">
      <TextEntry
        kind="phone"
        label="Número de telefone"
        placeholder="+55 11 99999-0000"
        error={error ? errorMessage(error) : null}
        onChangeText={setPhone}
        onSubmit={send}
      />
      <PrimaryButton label={error === 'bridge_unreachable' ? 'Tentar de novo' : 'Continuar'} busy={busy} onPress={send} />
    </StepFrame>
  );
}
