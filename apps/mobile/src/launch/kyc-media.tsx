import { useEffect, useState } from 'react';
import { View, type StyleProp, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { privateMediaPath } from '@brokeriq/shared';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Row, Txt } from '@/ui';

type Preview = { data: string; contentType: string; pages: number; page: number; scope: string; src: string };
export function KycMedia({ uri, style }: { uri: string; style?: StyleProp<ImageStyle> }) {
  const { user } = useAuth();
  const scope = `${user?.id}:${user?.role}:${user?.organization?.id}`;
  const [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    setPage(1);
  }, [uri, scope]);
  useEffect(() => {
    let active = true;
    setError('');
    setPreview(null);
    const path = privateMediaPath(uri, API_URL);
    if (!path || !/^\/media\/(?:kyc\/|f\/kyc\/)/.test(path)) {
      setError('Private document URL invalid है। दोबारा upload करें।');
      return;
    }
    const query = path.includes('?') ? '&' : '?';
    api<Preview>(`${path}${query}render=page&page=${page}`)
      .then((data) => {
        if (active) setPreview({ ...data, src: uri, scope });
      })
      .catch((e) => active && setError(e.message || 'दस्तावेज़ नहीं खुली।'));
    return () => {
      active = false;
    };
  }, [uri, scope, page, attempt]);
  const current = preview?.scope === scope && preview.src === uri && preview.page === page ? preview : null;
  return (
    <View style={[{ flexShrink: 1, width: '100%' }, style]}>
      {error ? (
        <View>
          <Txt v="caption">{error}</Txt>
          <Button title="Retry" size="sm" variant="secondary" onPress={() => setAttempt(attempt + 1)} />
        </View>
      ) : !current ? (
        <Txt v="caption">दस्तावेज़ खुल रहा है…</Txt>
      ) : (
        <>
          <Image
            source={{ uri: `data:${current.contentType};base64,${current.data}` }}
            cachePolicy="none"
            contentFit="contain"
            style={{ flex: 1, minHeight: 40, width: '100%' }}
          />
          {current.pages > 1 && (
            <Row gap={6} justify="space-between">
              <Button title="पिछला" size="sm" variant="secondary" disabled={page === 1} onPress={() => setPage(page - 1)} />
              <Txt v="caption">
                {page} / {current.pages}
              </Txt>
              <Button title="अगला" size="sm" variant="secondary" disabled={page === current.pages} onPress={() => setPage(page + 1)} />
            </Row>
          )}
        </>
      )}
    </View>
  );
}
