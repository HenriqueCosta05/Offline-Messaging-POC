import type { MatrixCredentials } from '@/domain/onboarding';

/** Creates or recovers the Matrix account bound to a phone number (the bridge, or a simulation). */
export interface ProvisioningPort {
  lookup(phone: string): Promise<string | null>;
  provision(phone: string, username: string): Promise<MatrixCredentials>;
}
