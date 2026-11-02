import { OnboardingFailure, type MatrixCredentials } from '@/domain/onboarding';
import type { ProvisioningPort } from '@/ports/provisioning-port';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Simulated bridge for Expo Go and the web: accounts live in memory. */
export class DemoProvisioning implements ProvisioningPort {
  private readonly phones = new Map<string, string>();
  private readonly taken = new Set(['admin']);

  constructor(private readonly latencyMs = 400) {}

  async lookup(phone: string) {
    await wait(this.latencyMs);
    return this.phones.get(phone) ?? null;
  }

  async provision(phone: string, username: string): Promise<MatrixCredentials> {
    await wait(this.latencyMs);
    const userId = `@${username}:demo.local`;
    const existing = this.phones.get(phone);
    if (existing && existing !== userId) throw new OnboardingFailure('phone_taken', existing);
    if (!existing && this.taken.has(username)) throw new OnboardingFailure('username_taken');
    this.phones.set(phone, userId);
    this.taken.add(username);
    return { userId, homeserver: 'http://demo.local', password: `demo-${phone}` };
  }
}
