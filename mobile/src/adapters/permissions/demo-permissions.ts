import type { PermissionKind, PermissionStatus } from '@/domain/onboarding';
import type { PermissionsPort } from '@/ports/permissions-port';

/** Grants whatever is asked; used where system prompts are missing (Expo Go, web). */
export class DemoPermissions implements PermissionsPort {
  private readonly granted = new Set<PermissionKind>();

  async check(kind: PermissionKind): Promise<PermissionStatus> {
    return this.granted.has(kind) ? 'granted' : 'undetermined';
  }

  async request(kind: PermissionKind): Promise<PermissionStatus> {
    this.granted.add(kind);
    return 'granted';
  }
}
