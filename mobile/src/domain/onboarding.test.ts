import { describe, expect, it } from 'vitest';

import cases from '../../../docs/fixtures/identity-cases.json';
import {
  initialPermissions,
  localpartOf,
  normalizePhone,
  OnboardingFailure,
  stepAfter,
  stepNumber,
  validateUsername,
} from '@/domain/onboarding';

describe('identity rules (shared with the bridge)', () => {
  it.each(cases.phone.valid)('normalizes phone %j', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });
  it.each(cases.phone.invalid)('rejects phone %j', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
  it.each(cases.username.valid)('accepts username %j', (raw, expected) => {
    expect(validateUsername(raw)).toBe(expected);
  });
  it.each(cases.username.invalid)('rejects username %j', (raw) => {
    expect(validateUsername(raw)).toBeNull();
  });
});

describe('steps', () => {
  it('moves forward on each event', () => {
    expect(stepAfter('phoneNew')).toBe('username');
    expect(stepAfter('signedIn')).toBe('permissions');
    expect(stepAfter('finished')).toBe('done');
    expect(stepAfter('reset')).toBe('phone');
  });
  it('numbers the visible steps for the rail', () => {
    expect([stepNumber('booting'), stepNumber('phone'), stepNumber('username')]).toEqual([1, 1, 2]);
    expect([stepNumber('permissions'), stepNumber('done')]).toEqual([3, 3]);
  });
});

describe('helpers', () => {
  it('extracts the localpart of a Matrix id', () => {
    expect(localpartOf('@marina.costa:hq.local:8448')).toBe('marina.costa');
  });
  it('starts every permission undetermined', () => {
    expect(Object.values(initialPermissions())).toEqual(['undetermined', 'undetermined', 'undetermined', 'undetermined']);
  });
  it('carries the code and the existing account', () => {
    const failure = new OnboardingFailure('phone_taken', '@marina:hq.local');
    expect([failure.code, failure.userId, failure instanceof Error]).toEqual(['phone_taken', '@marina:hq.local', true]);
  });
});
