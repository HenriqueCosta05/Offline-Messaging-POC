import { describe, expect, it, vi } from 'vitest';

import { failureFrom, HttpProvisioning } from '@/adapters/provisioning/http-provisioning';

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const client = (fetchFn: typeof fetch, timeoutMs?: number) =>
  new HttpProvisioning({ url: 'http://192.168.0.10:8766/', token: 't0ken', timeoutMs }, fetchFn);

describe('HttpProvisioning', () => {
  it('posts the phone with the bearer token and reads the user id', async () => {
    const fetchFn = reply(200, { user_id: '@marina:hq.local' });
    expect(await client(fetchFn).lookup('+5511999990000')).toBe('@marina:hq.local');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://192.168.0.10:8766/lookup');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer t0ken' });
    expect(JSON.parse(String(init.body))).toEqual({ phone: '+5511999990000' });
  });

  it('maps an unknown phone to null', async () => {
    expect(await client(reply(200, { user_id: null })).lookup('+5511999990000')).toBeNull();
  });

  it('returns credentials from provision', async () => {
    const fetchFn = reply(200, { user_id: '@m:hq', homeserver: 'http://hs', password: 'pw' });
    expect(await client(fetchFn).provision('+5511999990000', 'm')).toEqual({
      userId: '@m:hq',
      homeserver: 'http://hs',
      password: 'pw',
    });
  });

  it('passes domain errors through with the existing account', async () => {
    const fetchFn = reply(409, { code: 'phone_taken', user_id: '@old:hq' });
    await expect(client(fetchFn).provision('+5511999990000', 'm')).rejects.toMatchObject({
      code: 'phone_taken',
      userId: '@old:hq',
    });
  });

  it('turns network failures into bridge_unreachable', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(client(fetchFn).lookup('+5511999990000')).rejects.toMatchObject({ code: 'bridge_unreachable' });
  });

  it('aborts after the timeout', async () => {
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    await expect(client(fetchFn as typeof fetch, 5).lookup('+5511999990000')).rejects.toMatchObject({
      code: 'bridge_unreachable',
    });
  });
});

describe('failureFrom', () => {
  it.each([
    [422, 'invalid_phone'],
    [422, 'invalid_username'],
    [409, 'username_taken'],
  ])('keeps %i %s', (status, code) => {
    expect(failureFrom(status, { code }).code).toBe(code);
  });

  it('hides server problems behind bridge_unreachable and warns on a bad token', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(failureFrom(401, { code: 'unauthorized' }).code).toBe('bridge_unreachable');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('EXPO_PUBLIC_PROVISION_TOKEN'));
    expect(failureFrom(503, {}).code).toBe('bridge_unreachable');
    warn.mockRestore();
  });
});
