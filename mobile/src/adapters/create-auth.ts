import { Paths } from 'expo-file-system';
import { Platform, TurboModuleRegistry } from 'react-native';

import { MemoryCredentialStore } from '@/adapters/credentials/memory-credential-store';
import { SecureCredentialStore } from '@/adapters/credentials/secure-credential-store';
import { DemoMatrixAuth } from '@/adapters/matrix/demo-matrix-auth';
import { SdkMatrixAuth } from '@/adapters/matrix/sdk-matrix-auth';
import { DemoPermissions } from '@/adapters/permissions/demo-permissions';
import { ExpoPermissions } from '@/adapters/permissions/expo-permissions';
import { DemoProvisioning } from '@/adapters/provisioning/demo-provisioning';
import { HttpProvisioning, type ProvisioningConfig } from '@/adapters/provisioning/http-provisioning';
import type { OnboardingPorts } from '@/ports/onboarding-ports';

export type AuthConfig = {
  provisioning: ProvisioningConfig | null;
  nativeMatrix: boolean;
  platform: string;
  storageRoot: string;
};

// EXPO_PUBLIC_* must be read with literal names: Metro inlines them at build time.
export function readAuthConfig(): AuthConfig {
  const url = process.env.EXPO_PUBLIC_PROVISION_URL;
  const token = process.env.EXPO_PUBLIC_PROVISION_TOKEN ?? '';
  const documents = decodeURI(Paths.document.uri.replace(/^file:\/\//, '')).replace(/\/$/, '');
  return {
    provisioning: url ? { url, token } : null,
    nativeMatrix: TurboModuleRegistry.get('ReactNativeMatrixSdk') != null,
    platform: Platform.OS,
    storageRoot: `${documents}/matrix`,
  };
}

export function createAuthServices(config: AuthConfig): OnboardingPorts {
  const web = config.platform === 'web';
  return {
    provisioning: config.provisioning ? new HttpProvisioning(config.provisioning) : new DemoProvisioning(),
    matrix: config.nativeMatrix ? new SdkMatrixAuth(config.storageRoot) : new DemoMatrixAuth(),
    permissions: web ? new DemoPermissions() : new ExpoPermissions(),
    store: web ? new MemoryCredentialStore() : new SecureCredentialStore(),
  };
}
