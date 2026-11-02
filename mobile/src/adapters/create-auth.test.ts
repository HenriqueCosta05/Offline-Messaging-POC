import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios', Version: '18' }, TurboModuleRegistry: { get: vi.fn(() => null) }, PermissionsAndroid: { PERMISSIONS: {} } }));
vi.mock('expo-file-system', () => ({ Paths: { document: { uri: 'file:///var/mobile/Documents/' } } }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('expo-notifications', () => ({ getPermissionsAsync: vi.fn(), requestPermissionsAsync: vi.fn() }));
vi.mock('expo-audio', () => ({ getRecordingPermissionsAsync: vi.fn(), requestRecordingPermissionsAsync: vi.fn() }));
vi.mock('expo-contacts', () => ({ getPermissionsAsync: vi.fn(), requestPermissionsAsync: vi.fn() }));

const { createAuthServices, readAuthConfig } = await import('@/adapters/create-auth');

const BASE = { provisioning: null, nativeMatrix: false, platform: 'ios', storageRoot: '/docs/matrix' };

describe('createAuthServices', () => {
  it('uses demo adapters when nothing native is configured', () => {
    const ports = createAuthServices(BASE);
    expect(ports.provisioning.constructor.name).toBe('DemoProvisioning');
    expect(ports.matrix.constructor.name).toBe('DemoMatrixAuth');
    expect(ports.permissions.constructor.name).toBe('ExpoPermissions');
    expect(ports.store.constructor.name).toBe('SecureCredentialStore');
  });

  it('uses the real adapters in a configured development build', () => {
    const ports = createAuthServices({ ...BASE, provisioning: { url: 'http://pc:8766', token: 't' }, nativeMatrix: true });
    expect(ports.provisioning.constructor.name).toBe('HttpProvisioning');
    expect(ports.matrix.constructor.name).toBe('SdkMatrixAuth');
  });

  it('falls back to memory and demo permissions on the web', () => {
    const ports = createAuthServices({ ...BASE, platform: 'web' });
    expect(ports.permissions.constructor.name).toBe('DemoPermissions');
    expect(ports.store.constructor.name).toBe('MemoryCredentialStore');
  });
});

describe('readAuthConfig', () => {
  it('reads the environment and the documents directory', () => {
    vi.stubEnv('EXPO_PUBLIC_PROVISION_URL', 'http://pc:8766');
    vi.stubEnv('EXPO_PUBLIC_PROVISION_TOKEN', 't0ken');
    expect(readAuthConfig()).toEqual({
      provisioning: { url: 'http://pc:8766', token: 't0ken' },
      nativeMatrix: false,
      platform: 'ios',
      storageRoot: '/var/mobile/Documents/matrix',
    });
    vi.unstubAllEnvs();
  });

  it('skips provisioning without a URL', () => {
    vi.stubEnv('EXPO_PUBLIC_PROVISION_URL', '');
    expect(readAuthConfig().provisioning).toBeNull();
    vi.unstubAllEnvs();
  });
});
