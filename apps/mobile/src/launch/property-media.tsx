import { useRef, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import * as ImagePicker from '@/lib/image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button, Txt } from '@/ui';
import { assertAccountContext, captureAccountContext, errorMessage, img, uploadUri } from '@/lib/api';

export function NativePropertyMedia({
  photos,
  videos = [],
  onAdd,
  onRemove,
  onUploading,
  disabled = false,
  onlyPhotos = false,
}: {
  photos: readonly string[];
  videos?: readonly string[];
  onAdd?: (kind: 'photoUrls' | 'videoUrls', url: string) => void | Promise<void>;
  onRemove?: (kind: 'photoUrls' | 'videoUrls', index: number) => void;
  onUploading?: (busy: boolean) => void;
  disabled?: boolean;
  onlyPhotos?: boolean;
}) {
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function add(video: boolean) {
    if (!onAdd || running.current || disabled) return;
    const remaining = video ? 10 - videos.length : 50 - photos.length;
    if (remaining <= 0) return;
    const owner = captureAccountContext();
    running.current = true;
    setPending(true);
    onUploading?.(true);
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: video ? ['videos'] : ['images'],
        allowsMultipleSelection: !!onRemove,
        selectionLimit: remaining,
        ...(video ? { videoExportPreset: ImagePicker.VideoExportPreset.Passthrough } : {}),
      });
      if (result.canceled) return;
      if (result.assets.length > remaining) throw new Error('Too many files selected for this property.');
      for (const asset of result.assets) {
        const maxMB = video ? 100 : 20;
        if ((asset.fileSize ?? 0) > maxMB * 1024 * 1024) throw new Error(`Selected file exceeds the ${maxMB} MB limit.`);
        const path = video
          ? asset.uri
          : (
              await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: Math.min(asset.width || 1800, 1800) } }], {
                compress: 0.85,
                format: ImageManipulator.SaveFormat.JPEG,
              })
            ).uri;
        const mime = video ? (asset.mimeType ?? (/\.mov$/i.test(asset.fileName ?? '') ? 'video/quicktime' : 'video/mp4')) : 'image/jpeg';
        if (video && !mime.startsWith('video/')) throw new Error('Choose a supported video file.');
        assertAccountContext(owner);
        const { url } = await uploadUri(path, 'listing', mime);
        assertAccountContext(owner);
        await onAdd(video ? 'videoUrls' : 'photoUrls', url);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      running.current = false;
      setPending(false);
      onUploading?.(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Txt v="h3">Property photos</Txt>
      {!!onAdd && photos.length < 50 && (
        <Button title={pending ? 'Uploading…' : 'Upload photos'} variant="secondary" disabled={disabled || pending} onPress={() => void add(false)} />
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {photos.map((url, i) => (
          <View key={`${url}-${i}`} style={{ gap: 4 }}>
            <Image source={{ uri: img(url, 320) }} accessibilityLabel={`Property photo ${i + 1}`} style={{ width: 100, height: 76, borderRadius: 10 }} />
            {onRemove && (
              <Button size="sm" title={`Remove photo ${i + 1}`} variant="ghost" disabled={disabled || pending} onPress={() => onRemove('photoUrls', i)} />
            )}
          </View>
        ))}
      </View>
      {!onlyPhotos && (
        <>
          <Txt v="h3">Property videos</Txt>
          {!!onAdd && videos.length < 10 && (
            <Button title={pending ? 'Uploading…' : 'Upload videos'} variant="secondary" disabled={disabled || pending} onPress={() => void add(true)} />
          )}
          {videos.map((url, i) => (
            <View key={`${url}-${i}`} style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                size="sm"
                title={`Preview video ${i + 1}`}
                variant="secondary"
                onPress={() => void Linking.openURL(url).catch((cause) => setError(errorMessage(cause)))}
              />
              {onRemove && (
                <Button size="sm" title={`Remove video ${i + 1}`} variant="ghost" disabled={disabled || pending} onPress={() => onRemove('videoUrls', i)} />
              )}
            </View>
          ))}
        </>
      )}
      {!!error && <Txt color="danger">{error}</Txt>}
    </View>
  );
}
