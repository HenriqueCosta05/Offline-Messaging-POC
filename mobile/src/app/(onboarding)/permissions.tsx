import { useEffect } from 'react';
import { Platform } from 'react-native';

import { PermissionRow } from '@/components/onboarding/permission-row';
import { PrimaryButton } from '@/components/onboarding/primary-button';
import { StepFrame } from '@/components/onboarding/step-frame';
import { PERMISSION_KINDS, type PermissionKind, type PermissionStatus } from '@/domain/onboarding';
import { PERMISSION_COPY, statusLabel } from '@/lib/onboarding-copy';
import { useOnboardingFlow } from '@/state/onboarding-provider';
import { useOnboarding } from '@/state/use-onboarding';

const askable = (kind: PermissionKind, status: PermissionStatus) =>
  status === 'undetermined' && !(Platform.OS === 'ios' && kind === 'nearby');

export default function PermissionsScreen() {
  const { permissions } = useOnboarding();
  const flow = useOnboardingFlow();
  useEffect(() => {
    flow.loadPermissions();
  }, [flow]);
  return (
    <StepFrame step={3} title="O que o app pode usar" subtitle="Tudo é opcional. Dá para mudar depois nos Ajustes.">
      {PERMISSION_KINDS.map((kind) => (
        <PermissionRow
          key={kind}
          {...PERMISSION_COPY[kind]}
          status={statusLabel(permissions[kind], Platform.OS, kind)}
          actionable={askable(kind, permissions[kind])}
          onRequest={() => flow.requestPermission(kind)}
        />
      ))}
      <PrimaryButton label="Concluir" onPress={() => flow.finish()} />
    </StepFrame>
  );
}
