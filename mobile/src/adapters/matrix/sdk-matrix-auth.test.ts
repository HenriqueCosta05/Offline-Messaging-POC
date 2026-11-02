import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const client = {
    login: vi.fn(async () => {}),
    restoreSession: vi.fn(async () => {}),
    setDisplayName: vi.fn(async () => {}),
    session: vi.fn(() => ({
      accessToken: 'tok',
      userId: '@marina:hq.local',
      deviceId: 'DEV',
      homeserverUrl: 'http://hs',
      slidingSyncVersion: 0,
    })),
  };
  const builder = {
    homeserverUrl: vi.fn(() => builder),
    sessionPaths: vi.fn(() => builder),
    build: vi.fn(async () => client),
  };
  return { client, builder };
});

vi.mock('@unomed/react-native-matrix-sdk', () => ({
  ClientBuilder: vi.fn(function ClientBuilder() {
    return sdk.builder;
  }),
  SlidingSyncVersion: { None: 0, Native: 1 },
}));

const { SdkMatrixAuth } = await import('@/adapters/matrix/sdk-matrix-auth');
const CREDS = { userId: '@marina:hq.local', homeserver: 'http://hs', password: 'pw' };

beforeEach(() => vi.clearAllMocks());

describe('SdkMatrixAuth', () => {
  it('logs in with the password and returns the session without it', async () => {
    const session = await new SdkMatrixAuth('/docs/matrix').login(CREDS);
    expect(sdk.builder.homeserverUrl).toHaveBeenCalledWith('http://hs');
    expect(sdk.builder.sessionPaths).toHaveBeenCalledWith('/docs/matrix/data', '/docs/matrix/cache');
    expect(sdk.client.login).toHaveBeenCalledWith('@marina:hq.local', 'pw', 'Offline Protocol PoC', undefined);
    expect(session).toEqual({ userId: '@marina:hq.local', homeserver: 'http://hs', accessToken: 'tok', deviceId: 'DEV' });
  });

  it('restores a stored session', async () => {
    const auth = new SdkMatrixAuth('/docs/matrix');
    await auth.restore({ userId: '@m:hq', homeserver: 'http://hs', accessToken: 'tok', deviceId: 'DEV' });
    expect(sdk.client.restoreSession).toHaveBeenCalledWith({
      accessToken: 'tok',
      userId: '@m:hq',
      deviceId: 'DEV',
      homeserverUrl: 'http://hs',
      slidingSyncVersion: 0,
    });
  });

  it('sets the display name on the signed-in client and refuses without one', async () => {
    const auth = new SdkMatrixAuth('/docs/matrix');
    await expect(auth.setDisplayName('marina')).rejects.toThrow('not signed in');
    await auth.login(CREDS);
    await auth.setDisplayName('marina');
    expect(sdk.client.setDisplayName).toHaveBeenCalledWith('marina');
  });
});
