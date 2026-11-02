import type { PermissionStatus } from '@/domain/onboarding';

type ExpoPermissionResponse = { status: string; canAskAgain?: boolean };

export function toPermissionStatus({ status, canAskAgain }: ExpoPermissionResponse): PermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return canAskAgain === false ? 'blocked' : 'denied';
  return 'undetermined';
}

export function androidResultsStatus(results: string[]): PermissionStatus {
  if (results.length === 0) return 'undetermined';
  if (results.includes('never_ask_again')) return 'blocked';
  return results.every((result) => result === 'granted') ? 'granted' : 'denied';
}
