import { describe, expect, it } from 'vitest';

import { DemoMatrixAuth } from '@/adapters/matrix/demo-matrix-auth';

describe('DemoMatrixAuth', () => {
  it('returns a session for the credentials and accepts restore and display name', async () => {
    const demo = new DemoMatrixAuth();
    const session = await demo.login({ userId: '@m:demo.local', homeserver: 'http://demo.local', password: 'pw' });
    expect(session).toMatchObject({ userId: '@m:demo.local', homeserver: 'http://demo.local', deviceId: 'DEMO' });
    await expect(demo.restore(session)).resolves.toBeUndefined();
    await expect(demo.setDisplayName('m')).resolves.toBeUndefined();
  });
});
