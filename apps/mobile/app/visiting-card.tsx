import { useState } from 'react';
import { Image, Linking, Share, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink, Share2 } from 'lucide-react-native';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Avatar, Button, Card, ErrorView, Header, Loader, Screen, Segmented, Txt } from '@/ui';

/** "मेरा visiting card": QR to show face-to-face, link to send on WhatsApp, contact file. */
export default function VisitingCard() {
  const { c } = useTheme();
  const { user } = useAuth();
  const [who, setWho] = useState<'me' | 'firm'>('me');
  const slug = user?.organization?.slug;
  const qs = who === 'me' && user ? `?a=${encodeURIComponent(user.id)}` : '';
  const q = useQuery({ queryKey: ['my-card', slug, who], queryFn: () => api<any>(`/public/card/${slug}${qs}`, { auth: false }), enabled: !!slug });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Visiting card" subtitle="QR दिखाएँ या link भेजें — छपे card की ज़रूरत नहीं" />
      <Segmented
        value={who}
        onChange={setWho}
        options={[
          { value: 'me', label: 'मेरा card' },
          { value: 'firm', label: 'Firm का card' },
        ]}
      />
      {q.isError ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Loader />
      ) : (
        <>
          <Card style={{ padding: 20, alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Avatar name={q.data.agent?.name ?? q.data.org.name} uri={q.data.agent?.avatarUrl ?? q.data.org.logoUrl} size={72} />
            <Txt v="h3">{q.data.agent?.name ?? q.data.org.name}</Txt>
            {q.data.agent && <Txt v="small" color="muted">{`${q.data.agent.title} · ${q.data.org.name}`}</Txt>}
            <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 16, marginTop: 8 }}>
              <Image source={{ uri: `${API_URL}/public/card/${slug}/qr${qs}` }} style={{ width: 220, height: 220 }} />
            </View>
            <Txt v="caption" color="muted" style={{ textAlign: 'center' }}>
              Client अपने phone camera से scan करे — call, WhatsApp, listings और contact save सब एक page पर।
            </Txt>
          </Card>
          <View style={{ gap: 10, marginTop: 12 }}>
            <Button
              title="WhatsApp / share"
              variant="whatsapp"
              full
              icon={<Share2 size={17} color="#fff" />}
              onPress={() => Share.share({ message: `मेरा digital visiting card: ${q.data.url}` })}
            />
            <Button title="Card खोलें" variant="secondary" full icon={<ExternalLink size={17} color={c.fg} />} onPress={() => Linking.openURL(q.data.url)} />
            <Button
              title="Contact file (.vcf)"
              variant="ghost"
              full
              icon={<Download size={17} color={c.brand} />}
              onPress={() => Linking.openURL(`${API_URL}/public/card/${slug}/vcf${qs}`)}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
