import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { homeFor, useAuth } from '@/lib/auth';

export default function Index() {
  const { user } = useAuth();
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync('biq.onboarded')
      .then((v) => setSeen(v === '1'))
      .catch(() => setSeen(true));
  }, []);
  if (seen === null) return null;
  if (!seen && !user) return <Redirect href="/onboarding" />;
  return <Redirect href={homeFor(user)} />;
}
