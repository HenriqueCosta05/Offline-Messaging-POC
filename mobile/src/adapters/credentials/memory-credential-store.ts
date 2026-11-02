import type { CredentialStore, StoredAccount } from '@/ports/credential-store';

/** Web has no secure store: the session lasts until the tab closes. */
export class MemoryCredentialStore implements CredentialStore {
  private account: StoredAccount | null = null;

  async load() {
    return this.account;
  }

  async save(account: StoredAccount) {
    this.account = account;
  }

  async clear() {
    this.account = null;
  }
}
