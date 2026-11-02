import * as Audio from 'expo-audio';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { PermissionsAndroid, Platform } from 'react-native';

import { androidRadios } from '@/adapters/permissions/android-radios';
import { androidResultsStatus, toPermissionStatus } from '@/adapters/permissions/permission-status';
import type { PermissionKind, PermissionStatus } from '@/domain/onboarding';
import type { PermissionsPort } from '@/ports/permissions-port';

type ExpoResponse = { status: string; canAskAgain?: boolean };
type ExpoModule = { check: () => Promise<ExpoResponse>; request: () => Promise<ExpoResponse> };

const MODULES: Record<Exclude<PermissionKind, 'nearby'>, ExpoModule> = {
  notifications: { check: Notifications.getPermissionsAsync, request: Notifications.requestPermissionsAsync },
  microphone: { check: Audio.getRecordingPermissionsAsync, request: Audio.requestRecordingPermissionsAsync },
  contacts: { check: Contacts.getPermissionsAsync, request: Contacts.requestPermissionsAsync },
};

const radios = () => androidRadios(Number(Platform.Version));

/** iOS asks for Bluetooth itself on first use, so nearby stays undetermined there. */
export class ExpoPermissions implements PermissionsPort {
  async check(kind: PermissionKind): Promise<PermissionStatus> {
    if (kind !== 'nearby') return toPermissionStatus(await MODULES[kind].check());
    if (Platform.OS !== 'android') return 'undetermined';
    const granted = await Promise.all(radios().map((permission) => PermissionsAndroid.check(permission)));
    return granted.every(Boolean) ? 'granted' : 'denied';
  }

  async request(kind: PermissionKind): Promise<PermissionStatus> {
    if (kind !== 'nearby') return toPermissionStatus(await MODULES[kind].request());
    if (Platform.OS !== 'android') return 'undetermined';
    const results = await PermissionsAndroid.requestMultiple(radios());
    return androidResultsStatus(Object.values(results));
  }
}
