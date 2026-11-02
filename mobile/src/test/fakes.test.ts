import { describe, expect, it } from 'vitest';

import { OnboardingFailure } from '@/domain/onboarding';
import { fakeOnboardingPorts, SESSION } from '@/test/fakes';

describe('onboarding fakes', () => {
  it('provision registers once and lookup finds it', async () => {
    const { provisioning } = fakeOnboardingPorts();
    const creds = await provisioning.provision('+5511999990000', 'marina');
    expect(creds).toEqual({ userId: '@marina:fake.local', homeserver: 'http://fake.local', password: 'pw-+5511999990000' });
    expect(await provisioning.lookup('+5511999990000')).toBe('@marina:fake.local');
  });

  it('can be told to fail with a code', async () => {
    const ports = fakeOnboardingPorts();
    ports.provisioning.failNext = new OnboardingFailure('username_taken');
    await expect(ports.provisioning.provision('+5511999990000', 'x')).rejects.toMatchObject({ code: 'username_taken' });
    ports.matrix.failLogin = true;
    await expect(ports.matrix.login({ userId: 'u', homeserver: 'h', password: 'p' })).rejects.toThrow();
  });

  it('store keeps what it saved and counts loads', async () => {
    const { store } = fakeOnboardingPorts();
    await store.save({ session: SESSION, onboarded: true });
    expect(await store.load()).toEqual({ session: SESSION, onboarded: true });
    await store.clear();
    expect(await store.load()).toBeNull();
    expect(store.loads).toBe(2);
  });
});
