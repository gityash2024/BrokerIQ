import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { WATERMARK_POSITIONS, type PhotoBranding } from '@brokeriq/shared';
import { api, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFlag } from '@/lib/config';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Button, Card, Chip, ErrorView, Header, Input, Loader, Row, Screen, Txt } from '@/ui';

const POSITION: Record<(typeof WATERMARK_POSITIONS)[number], string> = { br: 'नीचे दाएँ', bl: 'नीचे बाएँ', tr: 'ऊपर दाएँ', tl: 'ऊपर बाएँ', center: 'बीच में' };
const OPACITY = [0.3, 0.45, 0.6, 0.75];

/** Watermark + auto-enhance for listing photos, and Facebook/Instagram auto-post. */
export default function PhotoBrandingScreen() {
  const { c } = useTheme();
  const { isBrokerAdmin } = useAuth();
  const branding = useFlag('photo_branding');
  const social = useFlag('social_autopost');
  const q = useQuery({ queryKey: ['broker-branding'], queryFn: () => api<any>('/broker/branding') });
  const [b, setB] = useState<PhotoBranding | null>(null);
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (q.data) {
      setB(q.data.photoBranding);
      setAuto(q.data.socialAutoPost);
    }
  }, [q.data]);
  const save = useApiMutation(() => put('/broker/branding', { photoBranding: b, socialAutoPost: auto }), {
    success: 'Save हो गया — नई photos पर लागू होगा',
    invalidate: [['broker-branding']],
  });
  const toggleRow = (title: string, text: string, value: boolean, onChange: (v: boolean) => void) => (
    <Row style={{ alignItems: 'flex-start' }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="bodyStrong">{title}</Txt>
        <Txt v="caption" color="muted">
          {text}
        </Txt>
      </View>
      <Switch value={value} disabled={!isBrokerAdmin} onValueChange={onChange} trackColor={{ true: c.brand }} />
    </Row>
  );
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Photos & social" subtitle="Watermark, auto-enhance, Facebook/Instagram" />
      {q.isError ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : !b ? (
        <Loader />
      ) : (
        <View style={{ gap: 12 }}>
          {branding && (
            <Card style={{ padding: 16, gap: 14 }}>
              {toggleRow('Photos पर watermark', 'हर नई listing photo पर आपकी firm का नाम', b.watermark, (v) => setB({ ...b, watermark: v }))}
              {b.watermark && (
                <>
                  <Input label="Watermark text" placeholder={q.data.firm} value={b.text ?? ''} maxLength={60} onChangeText={(v) => setB({ ...b, text: v })} />
                  <Txt v="caption" color="muted">
                    जगह
                  </Txt>
                  <Row wrap>
                    {WATERMARK_POSITIONS.map((p) => (
                      <Chip key={p} label={POSITION[p]} active={b.position === p} onPress={() => setB({ ...b, position: p })} />
                    ))}
                  </Row>
                  <Txt v="caption" color="muted">
                    गहराई
                  </Txt>
                  <Row wrap>
                    {OPACITY.map((o) => (
                      <Chip key={o} label={`${Math.round(o * 100)}%`} active={Math.abs(b.opacity - o) < 0.01} onPress={() => setB({ ...b, opacity: o })} />
                    ))}
                  </Row>
                </>
              )}
              {toggleRow('Auto-enhance', 'फीकी photos की brightness, रंग और sharpness अपने-आप ठीक', b.enhance, (v) => setB({ ...b, enhance: v }))}
            </Card>
          )}
          {social && (
            <Card style={{ padding: 16, gap: 10 }}>
              {toggleRow('Facebook + Instagram auto-post', 'नई listing live होते ही आपके अपने Page / Instagram पर', auto, setAuto)}
              <Txt v="caption" color="brand" onPress={() => router.push('/connectors')}>
                पहले Connectors में &quot;Facebook Page + Instagram&quot; जोड़ें →
              </Txt>
            </Card>
          )}
          {isBrokerAdmin && <Button title="Save" full loading={save.isPending} onPress={() => save.mutate(undefined)} />}
        </View>
      )}
    </Screen>
  );
}
