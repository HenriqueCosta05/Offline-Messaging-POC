import {
  OnboardingFailure,
  type MatrixCredentials,
  type MatrixSession,
  type PermissionKind,
  type PermissionStatus,
} from '@/domain/onboarding';
import type { CredentialStore, StoredAccount } from '@/ports/credential-store';
import type { MatrixAuthPort } from '@/ports/matrix-auth-port';
import type { OnboardingPorts } from '@/ports/onboarding-ports';
import type { PermissionsPort } from '@/ports/permissions-port';
import type { ProvisioningPort } from '@/ports/provisioning-port';

export const SESSION: MatrixSession = {
  userId: '@marina:fake.local',
  homeserver: 'http://fake.local',
  accessToken: 'token-1',
  deviceId: 'DEVICE1',
};

export class FakeProvisioning implements ProvisioningPort {
  accounts = new Map<string, string>();
  failNext: OnboardingFailure | Error | null = null;
  calls: string[] = [];

  async lookup(phone: string) {
    this.calls.push(`lookup ${phone}`);
    this.throwIfArmed();
    return this.accounts.get(phone) ?? null;
  }

  async provision(phone: string, username: string): Promise<MatrixCredentials> {
    this.calls.push(`provision ${phone} ${username}`);
    this.throwIfArmed();
    const userId = `@${username}:fake.local`;
    this.accounts.set(phone, userId);
    return { userId, homeserver: 'http://fake.local', password: `pw-${phone}` };
  }

  private throwIfArmed() {
    const failure = this.failNext;
    this.failNext = null;
    if (failure) throw failure;
  }
}

export class FakeMatrixAuth implements MatrixAuthPort {
  failLogin = false;
  failRestore = false;
  failDisplayName = false;
  loggedIn: MatrixCredentials[] = [];
  restored: MatrixSession[] = [];
  displayName: string | null = null;

  async login(credentials: MatrixCredentials) {
    if (this.failLogin) throw new Error('M_FORBIDDEN');
    this.loggedIn.push(credentials);
    return { ...SESSION, userId: credentials.userId };
  }

  async restore(session: MatrixSession) {
    if (this.failRestore) throw new Error('M_UNKNOWN_TOKEN');
    this.restored.push(session);
  }

  async setDisplayName(name: string) {
    if (this.failDisplayName) throw new Error('offline');
    this.displayName = name;
  }
}

export class FakePermissions implements PermissionsPort {
  answers: Partial<Record<PermissionKind, PermissionStatus>> = {};
  requested: PermissionKind[] = [];

  async check(kind: PermissionKind) {
    return this.answers[kind] ?? 'undetermined';
  }

  async request(kind: PermissionKind) {
    this.requested.push(kind);
    return this.answers[kind] ?? 'granted';
  }
}

export class FakeCredentialStore implements CredentialStore {
  account: StoredAccount | null = null;
  failLoad = false;
  loads = 0;
  saves: StoredAccount[] = [];

  async load() {
    this.loads++;
    if (this.failLoad) throw new Error('keychain locked');
    return this.account;
  }

  async save(account: StoredAccount) {
    this.saves.push(account);
    this.account = account;
  }

  async clear() {
    this.account = null;
  }
}

export function fakeOnboardingPorts() {
  return {
    provisioning: new FakeProvisioning(),
    matrix: new FakeMatrixAuth(),
    permissions: new FakePermissions(),
    store: new FakeCredentialStore(),
  } satisfies OnboardingPorts;
}
