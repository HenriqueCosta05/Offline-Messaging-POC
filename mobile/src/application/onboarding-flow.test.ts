import { beforeEach, describe, expect, it } from 'vitest';

import { OnboardingFlow } from '@/application/onboarding-flow';
import { OnboardingFailure } from '@/domain/onboarding';
import { fakeOnboardingPorts, SESSION } from '@/test/fakes';

const PHONE = '+5511999990000';
let ports: ReturnType<typeof fakeOnboardingPorts>;
let flow: OnboardingFlow;

beforeEach(() => {
  ports = fakeOnboardingPorts();
  flow = new OnboardingFlow(ports);
});

describe('boot', () => {
  it('starts at the phone step without a stored account', async () => {
    await flow.boot();
    expect(flow.snapshot().step).toBe('phone');
  });

  it('restores a finished account straight to done', async () => {
    ports.store.account = { session: SESSION, onboarded: true };
    await flow.boot();
    expect(flow.snapshot()).toMatchObject({ step: 'done', userId: SESSION.userId });
    expect(ports.matrix.restored).toEqual([SESSION]);
  });

  it('resumes at permissions when onboarding was not finished', async () => {
    ports.store.account = { session: SESSION, onboarded: false };
    await flow.boot();
    expect(flow.snapshot().step).toBe('permissions');
  });

  it('clears a session the homeserver rejects and starts over', async () => {
    ports.store.account = { session: SESSION, onboarded: true };
    ports.matrix.failRestore = true;
    await flow.boot();
    expect(flow.snapshot().step).toBe('phone');
    expect(ports.store.account).toBeNull();
  });

  it('treats an unreadable store as no account', async () => {
    ports.store.failLoad = true;
    await flow.boot();
    expect(flow.snapshot().step).toBe('phone');
  });

  it('runs once even when called twice', async () => {
    await Promise.all([flow.boot(), flow.boot()]);
    expect(ports.store.loads).toBe(1);
  });
});

describe('phone step', () => {
  beforeEach(() => flow.boot());

  it('rejects an invalid phone without calling the bridge', async () => {
    await flow.submitPhone('11 99999');
    expect(flow.snapshot()).toMatchObject({ step: 'phone', error: 'invalid_phone' });
    expect(ports.provisioning.calls).toEqual([]);
  });

  it('asks for a username when the phone is new', async () => {
    await flow.submitPhone('+55 11 99999-0000');
    expect(flow.snapshot()).toMatchObject({ step: 'username', phone: PHONE, error: null });
  });

  it('signs a known phone straight in with its existing username', async () => {
    ports.provisioning.accounts.set(PHONE, '@marina:fake.local');
    await flow.submitPhone(PHONE);
    expect(flow.snapshot()).toMatchObject({ step: 'permissions', userId: '@marina:fake.local' });
    expect(ports.provisioning.calls).toEqual([`lookup ${PHONE}`, `provision ${PHONE} marina`]);
  });

  it('reports an unreachable bridge and stays put', async () => {
    ports.provisioning.failNext = new Error('Network request failed');
    await flow.submitPhone(PHONE);
    expect(flow.snapshot()).toMatchObject({ step: 'phone', error: 'bridge_unreachable' });
  });

  it('is busy only while the request runs', async () => {
    const seen: boolean[] = [];
    flow.subscribe(() => seen.push(flow.snapshot().busy));
    await flow.submitPhone(PHONE);
    expect(seen[0]).toBe(true);
    expect(flow.snapshot().busy).toBe(false);
  });
});

describe('username step', () => {
  beforeEach(async () => {
    await flow.boot();
    await flow.submitPhone(PHONE);
  });

  it('provisions, signs in, names the user and stores the session without the password', async () => {
    await flow.submitUsername(' Marina ');
    expect(flow.snapshot()).toMatchObject({ step: 'permissions', userId: '@marina:fake.local', error: null });
    expect(ports.matrix.displayName).toBe('marina');
    expect(ports.store.saves).toEqual([{ session: { ...SESSION, userId: '@marina:fake.local' }, onboarded: false }]);
    expect(JSON.stringify(ports.store.saves)).not.toContain('pw-');
  });

  it('rejects an invalid username locally', async () => {
    await flow.submitUsername('a');
    expect(flow.snapshot()).toMatchObject({ step: 'username', error: 'invalid_username' });
  });

  it('keeps the user on the step when the name is taken', async () => {
    ports.provisioning.failNext = new OnboardingFailure('username_taken');
    await flow.submitUsername('marina');
    expect(flow.snapshot()).toMatchObject({ step: 'username', error: 'username_taken' });
  });

  it('adopts the existing account when the phone is already taken', async () => {
    ports.provisioning.failNext = new OnboardingFailure('phone_taken', '@antiga:fake.local');
    await flow.submitUsername('marina');
    expect(flow.snapshot()).toMatchObject({ step: 'permissions', userId: '@antiga:fake.local' });
  });

  it('reports a failed login', async () => {
    ports.matrix.failLogin = true;
    await flow.submitUsername('marina');
    expect(flow.snapshot()).toMatchObject({ step: 'username', error: 'login_failed' });
  });

  it('signs in even if the display name cannot be set', async () => {
    ports.matrix.failDisplayName = true;
    await flow.submitUsername('marina');
    expect(flow.snapshot().step).toBe('permissions');
  });

  it('clears the previous error on a new attempt', async () => {
    await flow.submitUsername('a');
    await flow.submitUsername('marina');
    expect(flow.snapshot().error).toBeNull();
  });
});

describe('permissions step', () => {
  beforeEach(async () => {
    await flow.boot();
    await flow.submitPhone(PHONE);
    await flow.submitUsername('marina');
  });

  it('loads and requests each permission', async () => {
    ports.permissions.answers = { contacts: 'blocked' };
    await flow.loadPermissions();
    expect(flow.snapshot().permissions.contacts).toBe('blocked');
    await flow.requestPermission('microphone');
    expect(flow.snapshot().permissions.microphone).toBe('granted');
  });

  it('finishes even with denied permissions and remembers it', async () => {
    ports.permissions.answers = { nearby: 'denied' };
    await flow.requestPermission('nearby');
    await flow.finish();
    expect(flow.snapshot().step).toBe('done');
    expect(ports.store.account?.onboarded).toBe(true);
  });
});

describe('subscribe', () => {
  it('notifies on change and stops after unsubscribe', async () => {
    let calls = 0;
    const unsubscribe = flow.subscribe(() => calls++);
    await flow.boot();
    unsubscribe();
    await flow.submitPhone('x');
    expect(calls).toBe(1);
  });

  it('finish without a session does nothing', async () => {
    await flow.finish();
    expect(flow.snapshot().step).toBe('booting');
  });
});
