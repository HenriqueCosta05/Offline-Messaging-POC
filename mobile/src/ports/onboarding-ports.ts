import type { CredentialStore } from '@/ports/credential-store';
import type { MatrixAuthPort } from '@/ports/matrix-auth-port';
import type { PermissionsPort } from '@/ports/permissions-port';
import type { ProvisioningPort } from '@/ports/provisioning-port';

export type OnboardingPorts = {
  provisioning: ProvisioningPort;
  matrix: MatrixAuthPort;
  permissions: PermissionsPort;
  store: CredentialStore;
};
