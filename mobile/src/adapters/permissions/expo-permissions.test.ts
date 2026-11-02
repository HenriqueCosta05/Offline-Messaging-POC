import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  platform: { OS: 'android', Version: 34 },
  requestMultiple: vi.fn(async () => ({ a: 'granted', b: 'granted' })),
  check: vi.fn(async () => true),
  notifications: { status: 'granted', canAskAgain: true },
  audio: { status: 'denied', canAskAgain: false },
  contacts: { status: 'undetermined', canAskAgain: true },
}));

vi.mock('react-native', () => ({
  Platform: native.platform,
  PermissionsAndroid: {
    PERMISSIONS: { BLUETOOTH_SCAN: 'scan', BLUETOOTH_ADVERTISE: 'adv', BLUETOOTH_CONNECT: 'conn', NEARBY_WIFI_DEVICES: 'wifi', ACCESS_FINE_LOCATION: 'loc' },
    requestMultiple: native.requestMultiple,
    check: native.check,
  },
}));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn(async () => native.notifications),
  requestPermissionsAsync: vi.fn(async () => native.notifications),
}));
vi.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: vi.fn(async () => native.audio),
  requestRecordingPermissionsAsync: vi.fn(async () => native.audio),
}));
vi.mock('expo-contacts', () => ({
  getPermissionsAsync: vi.fn(async () => native.contacts),
  requestPermissionsAsync: vi.fn(async () => native.contacts),
}));

const { ExpoPermissions } = await import('@/adapters/permissions/expo-permissions');
const { DemoPermissions } = await import('@/adapters/permissions/demo-permissions');
const { androidRadios } = await import('@/adapters/permissions/android-radios');

beforeEach(() => {
  native.platform.OS = 'android';
  vi.clearAllMocks();
});

describe('androidRadios', () => {
  it.each([
    [30, ['loc']],
    [31, ['scan', 'adv', 'conn']],
    [34, ['scan', 'adv', 'conn', 'wifi']],
  ])('API %i asks for %j', (apiLevel, expected) => {
    expect(androidRadios(apiLevel)).toEqual(expected);
  });
});

describe('ExpoPermissions', () => {
  it('requests the radios on Android', async () => {
    expect(await new ExpoPermissions().request('nearby')).toBe('granted');
    expect(native.requestMultiple).toHaveBeenCalledWith(['scan', 'adv', 'conn', 'wifi']);
  });

  it('checks the radios on Android', async () => {
    native.check.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await new ExpoPermissions().check('nearby')).toBe('denied');
  });

  it('leaves Bluetooth to the system prompt on iOS', async () => {
    native.platform.OS = 'ios';
    expect(await new ExpoPermissions().request('nearby')).toBe('undetermined');
    expect(await new ExpoPermissions().check('nearby')).toBe('undetermined');
  });

  it('maps the expo modules', async () => {
    const permissions = new ExpoPermissions();
    expect(await permissions.request('notifications')).toBe('granted');
    expect(await permissions.request('microphone')).toBe('blocked');
    expect(await permissions.check('contacts')).toBe('undetermined');
  });
});

describe('DemoPermissions', () => {
  it('grants on request', async () => {
    const demo = new DemoPermissions();
    expect(await demo.check('contacts')).toBe('undetermined');
    expect(await demo.request('contacts')).toBe('granted');
    expect(await demo.check('contacts')).toBe('granted');
  });
});
