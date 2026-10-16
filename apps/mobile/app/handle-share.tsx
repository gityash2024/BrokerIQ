import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
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
  const fingerprint = useRef('');
  async function save() {
    if (running.current) return;
    running.current = true;
    setError('');
    try {
      const payloads = Sharing.getSharedPayloads();
      if (!payloads.length) return;
      const identity = JSON.stringify(payloads);
      if (identity !== fingerprint.current) {
        fingerprint.current = identity;
        saved.current.clear();
      }
      for (let i = 0; i < payloads.length; i++) {
        if (saved.current.has(i)) continue;
        const p = payloads[i];
        if (p.shareType === 'text' || p.shareType === 'url') await captureText(p.value, 'WHATSAPP');
        else await captureFile(p.value, p.mimeType ?? 'application/octet-stream');
        saved.current.add(i);
      }
      // A later share can arrive while file copying is in progress. Its payload
      // must remain available until that separate capture has also been saved.
      if (JSON.stringify(Sharing.getSharedPayloads()) !== identity) return;
      Sharing.clearSharedPayloads();
      fingerprint.current = '';
      saved.current.clear();
      setMessage(
        user
          ? 'Shared content saved on this device. Open Saved drafts to check sync and review.'
          : 'Shared content saved on this device. Sign in to sync and review.',
      );
      void syncDrafts().catch(() => undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      running.current = false;
      const pending = Sharing.getSharedPayloads();
      if (pending.length && JSON.stringify(pending) !== fingerprint.current) setTimeout(() => void save(), 0);
    }
  }
  useEffect(() => {
    void save();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void save();
    });
    const incoming = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('expo-sharing')) void save();
    });
    return () => {
      foreground.remove();
      incoming.remove();
    };
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
