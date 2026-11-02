import {
  initialPermissions,
  localpartOf,
  normalizePhone,
  OnboardingFailure,
  PERMISSION_KINDS,
  stepAfter,
  validateUsername,
  type MatrixCredentials,
  type MatrixSession,
  type OnboardingErrorCode,
  type OnboardingStep,
  type PermissionKind,
  type PermissionMap,
} from '@/domain/onboarding';
import type { OnboardingPorts } from '@/ports/onboarding-ports';

export type OnboardingState = {
  step: OnboardingStep;
  phone: string | null;
  userId: string | null;
  error: OnboardingErrorCode | null;
  busy: boolean;
  permissions: PermissionMap;
};

const initialState = (): OnboardingState => ({
  step: 'booting',
  phone: null,
  userId: null,
  error: null,
  busy: false,
  permissions: initialPermissions(),
});

/** Application service: phone → Matrix account → permissions, on top of the onboarding ports. */
export class OnboardingFlow {
  private state = initialState();
  private session: MatrixSession | null = null;
  private booting: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly ports: OnboardingPorts) {}

  // Arrow properties so React can call them detached (useSyncExternalStore).
  snapshot = (): OnboardingState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  boot() {
    this.booting ??= this.restore();
    return this.booting;
  }

  async submitPhone(raw: string) {
    const phone = normalizePhone(raw);
    if (!phone) return this.patch({ error: 'invalid_phone' });
    await this.attempt(async () => {
      const known = await this.ports.provisioning.lookup(phone);
      this.patch({ phone });
      if (known) return this.signIn(phone, localpartOf(known));
      this.patch({ step: stepAfter('phoneNew') });
    });
  }

  async submitUsername(raw: string) {
    const username = validateUsername(raw);
    const phone = this.state.phone;
    if (!username || !phone) return this.patch({ error: 'invalid_username' });
    await this.attempt(() => this.signIn(phone, username));
  }

  async loadPermissions() {
    const statuses = await Promise.all(PERMISSION_KINDS.map((kind) => this.ports.permissions.check(kind)));
    const entries = PERMISSION_KINDS.map((kind, index) => [kind, statuses[index]] as const);
    this.patch({ permissions: { ...this.state.permissions, ...Object.fromEntries(entries) } });
  }

  async requestPermission(kind: PermissionKind) {
    const status = await this.ports.permissions.request(kind);
    this.patch({ permissions: { ...this.state.permissions, [kind]: status } });
  }

  async finish() {
    if (!this.session) return;
    await this.ports.store.save({ session: this.session, onboarded: true });
    this.patch({ step: stepAfter('finished') });
  }

  private async restore(): Promise<void> {
    const account = await this.ports.store.load().catch(() => null);
    if (!account) return this.patch({ step: stepAfter('reset') });
    try {
      await this.ports.matrix.restore(account.session);
    } catch {
      await this.ports.store.clear();
      return this.patch({ step: stepAfter('reset') });
    }
    this.session = account.session;
    this.patch({ step: account.onboarded ? 'done' : 'permissions', userId: account.session.userId });
  }


  private async signIn(phone: string, username: string) {
    const credentials = await this.provisionOrAdopt(phone, username);
    const session = await this.ports.matrix.login(credentials).catch(() => {
      throw new OnboardingFailure('login_failed');
    });
    await this.ports.matrix.setDisplayName(localpartOf(session.userId)).catch(() => {});
    await this.ports.store.save({ session, onboarded: false });
    this.session = session;
    this.patch({ step: stepAfter('signedIn'), userId: session.userId });
  }

  private async provisionOrAdopt(phone: string, username: string): Promise<MatrixCredentials> {
    try {
      return await this.ports.provisioning.provision(phone, username);
    } catch (error) {
      const existing = error instanceof OnboardingFailure && error.code === 'phone_taken' ? error.userId : undefined;
      if (!existing) throw error;
      return this.ports.provisioning.provision(phone, localpartOf(existing));
    }
  }

  private async attempt(work: () => Promise<void>) {
    this.patch({ error: null, busy: true });
    try {
      await work();
    } catch (error) {
      this.patch({ error: error instanceof OnboardingFailure ? error.code : 'bridge_unreachable' });
    } finally {
      this.patch({ busy: false });
    }
  }

  private patch(change: Partial<OnboardingState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }
}
