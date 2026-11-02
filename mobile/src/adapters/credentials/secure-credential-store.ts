import * as SecureStore from 'expo-secure-store';

import type { CredentialStore, StoredAccount } from '@/ports/credential-store';

const KEY = 'onboarding.account';

/** Keeps the Matrix session in the Keychain / Keystore. */
export class SecureCredentialStore implements CredentialStore {
  async load(): Promise<StoredAccount | null> {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredAccount;
    } catch {
      return null;
    }
  }

  async save(account: StoredAccount) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(account));
  }

  async clear() {
    await SecureStore.deleteItemAsync(KEY);
  }
}
