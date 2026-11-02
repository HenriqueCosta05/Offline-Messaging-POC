import { describe, expect, it } from 'vitest';

import { DemoProvisioning } from '@/adapters/provisioning/demo-provisioning';

describe('DemoProvisioning', () => {
  it('creates an account and finds it again', async () => {
    const demo = new DemoProvisioning(0);
    expect(await demo.lookup('+5511999990000')).toBeNull();
    const creds = await demo.provision('+5511999990000', 'marina');
    expect(creds.userId).toBe('@marina:demo.local');
    expect(await demo.lookup('+5511999990000')).toBe('@marina:demo.local');
    expect(await demo.provision('+5511999990000', 'marina')).toEqual(creds);
  });

  it('refuses a taken username and a second username for a phone', async () => {
    const demo = new DemoProvisioning(0);
    await expect(demo.provision('+5511999990000', 'admin')).rejects.toMatchObject({ code: 'username_taken' });
    await demo.provision('+5511999990000', 'marina');
    await expect(demo.provision('+5511999990000', 'outra')).rejects.toMatchObject({
      code: 'phone_taken',
      userId: '@marina:demo.local',
    });
  });
});
