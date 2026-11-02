import { OnboardingFailure, type MatrixCredentials, type OnboardingErrorCode } from '@/domain/onboarding';
import type { ProvisioningPort } from '@/ports/provisioning-port';

export type ProvisioningConfig = { url: string; token: string; timeoutMs?: number };
type ProvisionBody = { user_id?: string | null; homeserver?: string; password?: string; code?: string };

const USER_FACING = new Set<string>(['invalid_phone', 'invalid_username', 'username_taken', 'phone_taken']);
const DEFAULT_TIMEOUT_MS = 10_000;

export function failureFrom(status: number, body: ProvisionBody): OnboardingFailure {
  if (body.code && USER_FACING.has(body.code)) {
    return new OnboardingFailure(body.code as OnboardingErrorCode, body.user_id ?? undefined);
  }
  if (status === 401) console.warn('Bridge refused the token: check EXPO_PUBLIC_PROVISION_TOKEN');
  return new OnboardingFailure('bridge_unreachable');
}

/** Talks to the bridge's provisioning endpoints over the LAN. */
export class HttpProvisioning implements ProvisioningPort {
  constructor(
    private readonly config: ProvisioningConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async lookup(phone: string) {
    const body = await this.post('/lookup', { phone });
    return body.user_id ?? null;
  }

  async provision(phone: string, username: string): Promise<MatrixCredentials> {
    const body = await this.post('/provision', { phone, username });
    return { userId: String(body.user_id), homeserver: String(body.homeserver), password: String(body.password) };
  }

  private async post(path: string, payload: object): Promise<ProvisionBody> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.fetchFn(this.config.url.replace(/\/$/, '') + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as ProvisionBody;
      if (!response.ok) throw failureFrom(response.status, body);
      return body;
    } catch (error) {
      throw error instanceof OnboardingFailure ? error : new OnboardingFailure('bridge_unreachable');
    } finally {
      clearTimeout(timer);
    }
  }
}
