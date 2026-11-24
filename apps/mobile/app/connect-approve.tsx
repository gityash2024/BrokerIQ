import { useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Linking } from 'react-native';
import { assertAccountContext, captureAccountContext, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { Button, Card, Header, Input, Screen, Txt } from '@/ui';

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export default function ConnectApproval() {
  const { request } = useLocalSearchParams<{ request?: string }>();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const approving = useRef(false);
  const valid = typeof request === 'string' && uuid.test(request);
  const eligible = !!user?.organizationId && ['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role);

  const approve = async () => {
    if (!valid || !eligible || code.length !== 6 || approving.current) return;
    const context = captureAccountContext();
    approving.current = true;
    setBusy(true);
    try {
      await post('/auth/connect-link/approve', { id: request, code });
      assertAccountContext(context);
      setCode('');
      setApproved(true);
    } catch (error) {
      showError(error);
    } finally {
      approving.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Link BrokerIQ Connect" />
      <Card style={{ gap: 12 }}>
        {valid && eligible ? (
          approved ? (
            <>
              <Txt>Device link approved. Return to BrokerIQ Connect to finish signing in.</Txt>
              <Button
                title="Return to Connect"
                onPress={() => Linking.openURL('brokeriq-connect://resume').catch(showError)}
              />
            </>
          ) : (
            <>
              <Txt>Enter the six-digit code shown on the BrokerIQ Connect screen on this phone.</Txt>
              <Txt color="muted">The device will have a separate session for {user?.email}.</Txt>
              <Input
                label="Connect code"
                keyboardType="number-pad"
                autoComplete="off"
                maxLength={6}
                editable={!busy}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
              />
              <Button title="Approve this device" loading={busy} disabled={busy || code.length !== 6} onPress={approve} />
            </>
          )
        ) : (
          <Txt>{valid ? 'Sign in to BrokerIQ as a Broker Admin or Agent, then start a new link from Connect.' : 'Open Connect and start a new device link.'}</Txt>
        )}
        <Button title="Close" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Card>
    </Screen>
  );
}
