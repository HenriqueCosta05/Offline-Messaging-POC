import { PermissionsAndroid, type Permission } from 'react-native';

// Android 12 split Bluetooth out of location; Android 13 added a Wi-Fi permission.
export function androidRadios(apiLevel: number): Permission[] {
  const { PERMISSIONS } = PermissionsAndroid;
  if (apiLevel < 31) return [PERMISSIONS.ACCESS_FINE_LOCATION];
  const bluetooth = [PERMISSIONS.BLUETOOTH_SCAN, PERMISSIONS.BLUETOOTH_ADVERTISE, PERMISSIONS.BLUETOOTH_CONNECT];
  return apiLevel >= 33 ? [...bluetooth, PERMISSIONS.NEARBY_WIFI_DEVICES] : bluetooth;
}
