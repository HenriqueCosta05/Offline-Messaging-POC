import type { PermissionKind, PermissionStatus } from '@/domain/onboarding';

export interface PermissionsPort {
  check(kind: PermissionKind): Promise<PermissionStatus>;
  request(kind: PermissionKind): Promise<PermissionStatus>;
}
