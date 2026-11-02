import type { MatrixSession } from '@/domain/onboarding';

export type StoredAccount = { session: MatrixSession; onboarded: boolean };

/** Persists the signed-in session; never the password. */
export interface CredentialStore {
  load(): Promise<StoredAccount | null>;
  save(account: StoredAccount): Promise<void>;
  clear(): Promise<void>;
}
