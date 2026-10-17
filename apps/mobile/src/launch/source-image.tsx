import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Sheet, Txt } from '@/ui';
export function SourceImage({ uri, token }: { uri: string; token?: string }) {
  const [ratio, setRatio] = useState(5),
    [open, setOpen] = useState(false);
  const source = { uri, headers: { Authorization: `Bearer ${token ?? ''}` } };
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Enlarge source image" onPress={() => setOpen(true)}>
        <Image
          source={source}
          contentFit="contain"
          onLoad={(e) => {
            if (e.source.width && e.source.height) setRatio(e.source.width / e.source.height);
          }}
          style={{ width: '100%', aspectRatio: ratio, borderRadius: 12 }}
        />
        <Txt v="caption" color="brand" style={{ marginTop: 8 }}>
          Tap to enlarge source ↗
        </Txt>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title="Original source">
        <ScrollView horizontal maximumZoomScale={5} minimumZoomScale={1}>
          <Image source={source} contentFit="contain" style={{ width: 1000, height: Math.max(120, 1000 / ratio) }} />
        </ScrollView>
      </Sheet>
    </>
  );
}
