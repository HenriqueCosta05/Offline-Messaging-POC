import { describe, expect, it } from 'vitest';

import { routeForStep } from '@/lib/onboarding-routes';

describe('routeForStep', () => {
  it.each([
    ['phone', '/phone'],
    ['username', '/username'],
    ['permissions', '/permissions'],
    ['booting', null],
    ['done', null],
  ] as const)('%s → %s', (step, route) => {
    expect(routeForStep(step)).toBe(route);
  });
});
