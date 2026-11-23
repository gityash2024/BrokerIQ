import { useRef, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import * as ImagePicker from '@/lib/image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { File } from 'expo-file-system';
import type { PropertyVideoStatus, PropertyVideoUpload } from '@brokeriq/shared';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button, Txt } from '@/ui';
import { api, assertAccountContext, captureAccountContext, errorMessage, img, uploadUri } from '@/lib/api';

export async function preparePropertyPhoto(asset: ImagePickerAsset) {
  const result = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: Math.min(asset.width || 1800, 1800) } }], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

export function NativePropertyMedia({
  photos,
  videos = [],
  onAdd,
  onRemove,
  onUploading,
  disabled = false,
  onlyPhotos = false,
  camera = false,
  photoLabel = 'Property photos',
}: {
  photos: readonly string[];
  videos?: readonly string[];
  onAdd?: (kind: 'photoUrls' | 'videoUrls', url: string) => void | Promise<void>;
  onRemove?: (kind: 'photoUrls' | 'videoUrls', index: number) => void;
  onUploading?: (busy: boolean) => void;
  disabled?: boolean;
  onlyPhotos?: boolean;
  camera?: boolean;
  photoLabel?: string;
}) {
  const running = useRef(false);
  const attachedFrames = useRef(new Set<string>());
  const [extraction, setExtraction] = useState<{ id: string; result: PropertyVideoStatus; selected: number[] }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function add(video: boolean, useCamera = false) {
    if (!onAdd || running.current || disabled) return;
    const remaining = video ? 10 - videos.length : 50 - photos.length;
    if (remaining <= 0) return;
    const owner = captureAccountContext();
    running.current = true;
    setPending(true);
    onUploading?.(true);
    setError('');
    try {
      if (useCamera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access to take a property photo.');
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] })
        : await ImagePicker.launchImageLibraryAsync({
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
        const path = video ? asset.uri : await preparePropertyPhoto(asset);
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

  async function extract() {
    if (!onAdd || running.current || disabled) return;
    const ownerContext = captureAccountContext();
    running.current = true;
    setPending(true);
    onUploading?.(true);
    setError('');
    let id: string | undefined;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoExportPreset: ImagePicker.VideoExportPreset.Passthrough });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      const contentType = asset.mimeType ?? (/\.mov$/i.test(asset.fileName ?? '') ? 'video/quicktime' : 'video/mp4');
      const file = new File(asset.uri);
      const signed = await api<PropertyVideoUpload>('/media/property-video', { body: { contentType }, ownerContext });
      id = signed.id;
      if (!file.size || file.size > signed.maxBytes) throw new Error('Choose a nonempty video up to 100 MB.');
      const bytes = await file.bytes();
      assertAccountContext(ownerContext);
      const uploaded = await fetch(signed.uploadUrl, { method: 'PUT', headers: signed.headers, body: bytes as Uint8Array<ArrayBuffer> });
      if (!uploaded.ok) throw new Error('Video upload failed. Select it again.');
      await api(`/media/property-video/${id}/start`, { method: 'POST', ownerContext });
      for (let attempt = 0; attempt < 75; attempt++) {
        const result = await api<PropertyVideoStatus>(`/media/property-video/${id}`, { ownerContext });
        if (result.state === 'READY') {
          attachedFrames.current.clear();
          setExtraction({ id, result, selected: result.frames.slice(0, 50 - photos.length).map((_, index) => index) });
          return;
        }
        if (result.state === 'FAILED') throw new Error('No usable photos were found. Try another video.');
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      throw new Error('Video extraction timed out. Try another video.');
    } catch (cause) {
      if (id) await api(`/media/property-video/${id}`, { method: 'DELETE', ownerContext }).catch(() => undefined);
      setError(errorMessage(cause));
    } finally {
      running.current = false;
      setPending(false);
      onUploading?.(false);
    }
  }

  async function finishExtraction(save: boolean) {
    if (!extraction || !onAdd || running.current || disabled) return;
    const ownerContext = captureAccountContext();
    running.current = true;
    setPending(true);
    onUploading?.(true);
    setError('');
    try {
      if (save) {
        const { urls: generated } = await api<{ urls: string[] }>(`/media/property-video/${extraction.id}/save`, { body: { indices: extraction.selected }, ownerContext });
        for (const url of generated) {
          assertAccountContext(ownerContext);
          if (attachedFrames.current.has(url) || photos.includes(url)) continue;
          await onAdd('photoUrls', url);
          attachedFrames.current.add(url);
        }
        await api(`/media/property-video/${extraction.id}/complete`, { method: 'POST', ownerContext });
      } else {
        await api(`/media/property-video/${extraction.id}`, { method: 'DELETE', ownerContext });
      }
      setExtraction(undefined);
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
      <Txt v="h3">{photoLabel}</Txt>
      {camera && !!onAdd && photos.length < 50 && (
        <Button title="Take property photo" variant="secondary" disabled={disabled || pending} onPress={() => void add(false, true)} />
      )}
      {!!onAdd && photos.length < 50 && (
        <Button title={pending ? 'Uploading…' : 'Upload photos'} variant="secondary" disabled={disabled || pending} onPress={() => void add(false)} />
      )}
      {!!onAdd && !extraction && photos.length < 50 && (
        <Button title={pending ? 'Processing…' : 'Extract photos from video'} variant="secondary" disabled={disabled || pending} onPress={() => void extract()} />
      )}
      {extraction && (
        <View style={{ gap: 8 }}>
          <Txt v="caption">{extraction.result.aiVerified ? 'AI reviewed these photos. Keep the ones you want.' : 'Review and select the photos you want to keep.'}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {extraction.result.frames.map((frame, index) => {
              const keep = extraction.selected.includes(index);
              return (
                <View key={index} style={{ gap: 4 }}>
                  <Image source={{ uri: frame }} accessibilityLabel={`Extracted photo ${index + 1}`} style={{ width: 100, height: 76, borderRadius: 10 }} />
                  <Button size="sm" variant={keep ? 'secondary' : 'ghost'} title={keep ? `Remove photo ${index + 1}` : `Keep photo ${index + 1}`} disabled={disabled || pending} onPress={() => setExtraction((current) => current && { ...current, selected: keep ? current.selected.filter((item) => item !== index) : [...current.selected, index] })} />
                </View>
              );
            })}
          </View>
          <Button title="Add selected photos" disabled={disabled || pending || !extraction.selected.length || extraction.selected.length > 50 - photos.length + attachedFrames.current.size} onPress={() => void finishExtraction(true)} />
          <Button title="Discard" variant="ghost" disabled={disabled || pending} onPress={() => void finishExtraction(false)} />
        </View>
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
