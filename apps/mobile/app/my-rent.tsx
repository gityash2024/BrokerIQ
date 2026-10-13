// BROKER-ONLY LAUNCH: Consumer screen disabled
import { View } from 'react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';

export default function DisabledScreen() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/(broker)/dashboard'), 2000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <View><View /></View>
    </View>
  );
}
