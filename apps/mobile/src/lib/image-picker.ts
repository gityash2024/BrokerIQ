import { Platform } from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';
import { getDocumentAsync } from 'expo-document-picker';

export { requestCameraPermissionsAsync, requestMediaLibraryPermissionsAsync, VideoExportPreset } from 'expo-image-picker';

let picking = false;
async function pick(run: () => Promise<ExpoImagePicker.ImagePickerResult>): Promise<ExpoImagePicker.ImagePickerResult> {
  if (picking) return { canceled: true, assets: null };
  picking = true;
  try {
    return await run();
  } finally {
    picking = false;
  }
}

function launcherLost(error: unknown) {
  return Platform.OS === 'android' && error instanceof Error && error.message.includes('unregistered ActivityResultLauncher');
}

export function launchImageLibraryAsync(options: ExpoImagePicker.ImagePickerOptions = {}) {
  return pick(async () => {
    try {
      return await ExpoImagePicker.launchImageLibraryAsync(options);
    } catch (error) {
      if (!launcherLost(error)) throw error;
      const types = Array.isArray(options.mediaTypes) ? options.mediaTypes : [options.mediaTypes];
      const type = types.includes('videos') ? (types.includes('images') ? ['image/*', 'video/*'] : 'video/*') : 'image/*';
      const result = await getDocumentAsync({ type, multiple: options.allowsMultipleSelection, copyToCacheDirectory: true });
      if (result.canceled) return { canceled: true, assets: null };
      const limit = options.selectionLimit || result.assets.length;
      return {
        canceled: false,
        assets: result.assets.slice(0, limit).map(({ uri, name, mimeType, size }) => ({
          uri,
          fileName: name,
          mimeType,
          fileSize: size,
          width: 0,
          height: 0,
          type: mimeType?.startsWith('video/') ? 'video' : 'image',
        })),
      };
    }
  });
}

export function launchCameraAsync(options?: ExpoImagePicker.ImagePickerOptions) {
  return pick(async () => {
    try {
      return await ExpoImagePicker.launchCameraAsync(options);
    } catch (error) {
      if (!launcherLost(error)) throw error;
      throw new Error('Camera could not open. Close and reopen BrokerIQ, then try again.');
    }
  });
}
