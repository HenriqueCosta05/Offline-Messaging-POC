import { describe, expect, it } from 'vitest';

import { PERMISSION_KINDS, type OnboardingErrorCode } from '@/domain/onboarding';
import { errorMessage, PERMISSION_COPY, statusLabel } from '@/lib/onboarding-copy';

const CODES: OnboardingErrorCode[] = [
  'invalid_phone', 'invalid_username', 'username_taken', 'phone_taken', 'bridge_unreachable', 'login_failed',
];

describe('onboarding copy', () => {
  it('has a calm message for every error code', () => {
    CODES.forEach((code) => expect(errorMessage(code)).toMatch(/\.$/));
    expect(errorMessage('invalid_phone')).toContain('+55 11 99999-0000');
  });

  it('explains every permission without jargon', () => {
    PERMISSION_KINDS.forEach((kind) => {
      expect(PERMISSION_COPY[kind].reason).not.toMatch(/mesh|peer|matrix/i);
    });
  });

  it('labels statuses, with the iPhone Bluetooth exception', () => {
    expect(statusLabel('granted', 'android', 'contacts')).toBe('Permitido');
    expect(statusLabel('blocked', 'android', 'contacts')).toBe('Bloqueado nos Ajustes');
    expect(statusLabel('denied', 'android', 'contacts')).toBe('Não permitido');
    expect(statusLabel('undetermined', 'android', 'contacts')).toBe('');
    expect(statusLabel('undetermined', 'ios', 'nearby')).toBe('O iPhone pergunta na primeira conexão');
  });
});
