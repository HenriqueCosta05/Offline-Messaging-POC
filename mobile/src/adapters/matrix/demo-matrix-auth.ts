import type { MatrixCredentials, MatrixSession } from '@/domain/onboarding';
import type { MatrixAuthPort } from '@/ports/matrix-auth-port';

/** Accepts any credentials; used where the native SDK is missing (Expo Go, web). */
export class DemoMatrixAuth implements MatrixAuthPort {
  async login({ userId, homeserver }: MatrixCredentials): Promise<MatrixSession> {
    return { userId, homeserver, accessToken: `demo-${userId}`, deviceId: 'DEMO' };
  }

  async restore(_session: MatrixSession) {}

  async setDisplayName(_name: string) {}
}
