import type { ClientLike } from '@unomed/react-native-matrix-sdk';

import type { MatrixCredentials, MatrixSession } from '@/domain/onboarding';
import type { MatrixAuthPort } from '@/ports/matrix-auth-port';

const DEVICE_NAME = 'Offline Protocol PoC';
// Lazy: importing the SDK installs its Rust crate, which only exists in a development build.
const loadSdk = () => import('@unomed/react-native-matrix-sdk');

/** MatrixAuthPort backed by matrix-rust-sdk; the store lives under storageRoot. */
export class SdkMatrixAuth implements MatrixAuthPort {
  private client: ClientLike | null = null;

  constructor(private readonly storageRoot: string) {}

  async login({ userId, homeserver, password }: MatrixCredentials): Promise<MatrixSession> {
    const client = await this.build(homeserver);
    await client.login(userId, password, DEVICE_NAME, undefined);
    this.client = client;
    const session = client.session();
    return { userId: session.userId, homeserver: session.homeserverUrl, accessToken: session.accessToken, deviceId: session.deviceId };
  }

  async restore(session: MatrixSession) {
    const { SlidingSyncVersion } = await loadSdk();
    const client = await this.build(session.homeserver);
    await client.restoreSession({
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId,
      homeserverUrl: session.homeserver,
      slidingSyncVersion: SlidingSyncVersion.None,
    });
    this.client = client;
  }

  async setDisplayName(name: string) {
    if (!this.client) throw new Error('not signed in');
    await this.client.setDisplayName(name);
  }

  private async build(homeserver: string): Promise<ClientLike> {
    const { ClientBuilder } = await loadSdk();
    return new ClientBuilder()
      .homeserverUrl(homeserver)
      .sessionPaths(`${this.storageRoot}/data`, `${this.storageRoot}/cache`)
      .build();
  }
}
