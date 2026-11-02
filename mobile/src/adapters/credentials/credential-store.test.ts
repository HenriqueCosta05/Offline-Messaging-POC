import { describe, expect, it, vi } from 'vitest';

const secure = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secure.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => void secure.set(key, value)),
  deleteItemAsync: vi.fn(async (key: string) => void secure.delete(key)),
}));

const { SecureCredentialStore } = await import('@/adapters/credentials/secure-credential-store');
const { MemoryCredentialStore } = await import('@/adapters/credentials/memory-credential-store');
const ACCOUNT = {
  session: { userId: '@m:hq', homeserver: 'http://hs', accessToken: 'tok', deviceId: 'DEV' },
  onboarded: true,
};

describe.each([
  ['SecureCredentialStore', () => new SecureCredentialStore()],
  ['MemoryCredentialStore', () => new MemoryCredentialStore()],
])('%s', (_name, create) => {
  it('saves, loads and clears the account', async () => {
    const store = create();
    expect(await store.load()).toBeNull();
    await store.save(ACCOUNT);
    expect(await store.load()).toEqual(ACCOUNT);
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

it('treats unreadable secure data as no account', async () => {
  secure.set('onboarding.account', '{broken');
  expect(await new SecureCredentialStore().load()).toBeNull();
});
