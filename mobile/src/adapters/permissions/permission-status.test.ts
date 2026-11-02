import { describe, expect, it } from 'vitest';

import { androidResultsStatus, toPermissionStatus } from '@/adapters/permissions/permission-status';

describe('toPermissionStatus', () => {
  it.each([
    [{ status: 'granted' }, 'granted'],
    [{ status: 'denied', canAskAgain: true }, 'denied'],
    [{ status: 'denied', canAskAgain: false }, 'blocked'],
    [{ status: 'undetermined' }, 'undetermined'],
  ] as const)('maps %j', (response, expected) => {
    expect(toPermissionStatus(response)).toBe(expected);
  });
});

describe('androidResultsStatus', () => {
  it.each([
    [['granted', 'granted'], 'granted'],
    [['granted', 'denied'], 'denied'],
    [['granted', 'never_ask_again'], 'blocked'],
    [[], 'undetermined'],
  ])('reduces %j', (results, expected) => {
    expect(androidResultsStatus(results)).toBe(expected);
  });
});
