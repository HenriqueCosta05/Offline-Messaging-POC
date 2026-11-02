// Same rules as bridge/provisioning.py; both test against docs/fixtures/identity-cases.json.
const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const USERNAME_RE = /^[a-z0-9._=-]{3,32}$/;
const PHONE_NOISE = /[\s\-().]/g;

export type OnboardingStep = 'booting' | 'phone' | 'username' | 'permissions' | 'done';
export type OnboardingEvent = 'phoneNew' | 'signedIn' | 'finished' | 'reset';

export const PERMISSION_KINDS = ['nearby', 'notifications', 'microphone', 'contacts'] as const;
export type PermissionKind = (typeof PERMISSION_KINDS)[number];
export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';
export type PermissionMap = Record<PermissionKind, PermissionStatus>;

export type OnboardingErrorCode =
  | 'invalid_phone'
  | 'invalid_username'
  | 'username_taken'
  | 'phone_taken'
  | 'bridge_unreachable'
  | 'login_failed';

export type MatrixCredentials = { userId: string; homeserver: string; password: string };
export type MatrixSession = { userId: string; homeserver: string; accessToken: string; deviceId: string };

export class OnboardingFailure extends Error {
  constructor(
    readonly code: OnboardingErrorCode,
    readonly userId?: string,
  ) {
    super(code);
  }
}

const NEXT_STEP: Record<OnboardingEvent, OnboardingStep> = {
  phoneNew: 'username',
  signedIn: 'permissions',
  finished: 'done',
  reset: 'phone',
};

const STEP_NUMBER: Record<OnboardingStep, 1 | 2 | 3> = { booting: 1, phone: 1, username: 2, permissions: 3, done: 3 };

export function normalizePhone(raw: string): string | null {
  const phone = raw.trim().replace(PHONE_NOISE, '');
  return PHONE_RE.test(phone) ? phone : null;
}

export function validateUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase();
  const dotted = username.startsWith('.') || username.endsWith('.');
  return USERNAME_RE.test(username) && !dotted ? username : null;
}

export const localpartOf = (userId: string) => userId.replace(/^@/, '').split(':')[0];
export const stepAfter = (event: OnboardingEvent) => NEXT_STEP[event];
export const stepNumber = (step: OnboardingStep) => STEP_NUMBER[step];

export function initialPermissions(): PermissionMap {
  return { nearby: 'undetermined', notifications: 'undetermined', microphone: 'undetermined', contacts: 'undetermined' };
}
