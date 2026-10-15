import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { captureFile, captureText, syncDrafts } from '@/launch/drafts';
import { BrokerScreen } from '@/launch/screen';
import { Button, Txt } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
export default function HandleShare() {
  const { user } = useAuth();
  const [message, setMessage] = useState('Saving shared content…');
  const [error, setError] = useState('');
  const running = useRef(false);
  const saved = useRef(new Set<number>());
  async function save() {
    if (running.current) return;
    running.current = true;
    setError('');
    try {
      const payloads = Sharing.getSharedPayloads();
      for (let i = 0; i < payloads.length; i++) {
        if (saved.current.has(i)) continue;
        const p = payloads[i];
        if (p.shareType === 'text' || p.shareType === 'url') await captureText(p.value, 'WHATSAPP');
        else await captureFile(p.value, p.mimeType ?? 'application/octet-stream');
        saved.current.add(i);
      }
      Sharing.clearSharedPayloads();
      setMessage('Shared content saved on this device. Sign in to sync and review.');
      void syncDrafts().catch(() => undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      running.current = false;
    }
  }
  useEffect(() => {
    void save();
  }, []);
  return (
    <BrokerScreen title="Shared content" back>
      <View style={{ padding: 20, gap: 16 }}>
        <Txt>{message}</Txt>
        {error && (
          <>
            <Txt color="danger">{error}</Txt>
            <Button title="Retry saving" onPress={save} />
          </>
        )}
        <Button title={user ? 'Saved drafts' : 'Sign in'} disabled={!!error} onPress={() => router.replace(user ? '/drafts' : '/login')} />
      </View>
    </BrokerScreen>
  );
}
