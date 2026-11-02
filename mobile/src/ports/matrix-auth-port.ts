import type { MatrixCredentials, MatrixSession } from '@/domain/onboarding';

/** Signs in to the homeserver and keeps the client session alive. */
export interface MatrixAuthPort {
  login(credentials: MatrixCredentials): Promise<MatrixSession>;
  restore(session: MatrixSession): Promise<void>;
  setDisplayName(name: string): Promise<void>;
}
