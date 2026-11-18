import { useRef, useState } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BrokerScreen } from '@/launch/screen';
import { Button, ErrorView, Loader, Row, Txt } from '@/ui';

export default function PropertyPhotoGallery() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<string>>(null);
  const gallery = useQuery({
    queryKey: ['public-photo-gallery', token],
    queryFn: () => api<{ caption: string; photos: string[] }>(`/public/photo-galleries/${token}`),
    enabled: /^[a-f0-9]{48}$/.test(token ?? ''),
  });
  const select = (position: number) => {
    setIndex(position);
    list.current?.scrollToIndex({ index: position, animated: true });
  };
  return (
    <BrokerScreen title="Property photos" back>
      {!/^[a-f0-9]{48}$/.test(token ?? '') ? (
        <Txt>Photo gallery not found.</Txt>
      ) : gallery.error ? (
        <ErrorView error={gallery.error} onRetry={() => gallery.refetch()} />
      ) : !gallery.data ? (
        <Loader />
      ) : (
        <FlatList
          data={[gallery.data.caption]}
          keyExtractor={() => 'property-gallery'}
          contentContainerStyle={{ gap: 16, paddingBottom: 30 }}
          ListHeaderComponent={
            <>
              <FlatList
                ref={list}
                horizontal
                pagingEnabled
                data={gallery.data.photos}
                keyExtractor={(url) => url}
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, position) => ({ length: width, offset: width * position, index: position })}
                onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
                renderItem={({ item, index: position }) => (
                  <Image source={item} accessibilityLabel={`Property photo ${position + 1}`} contentFit="contain" style={{ width, height: 360 }} />
                )}
              />
              <Row style={{ justifyContent: 'space-between', paddingHorizontal: 18 }}>
                <Button title="Previous" variant="secondary" disabled={index === 0} onPress={() => select(index - 1)} />
                <Txt>
                  {index + 1} / {gallery.data.photos.length}
                </Txt>
                <Button title="Next" variant="secondary" disabled={index === gallery.data.photos.length - 1} onPress={() => select(index + 1)} />
              </Row>
            </>
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 18 }}>
              <Txt>{item}</Txt>
            </View>
          )}
        />
      )}
    </BrokerScreen>
  );
}
