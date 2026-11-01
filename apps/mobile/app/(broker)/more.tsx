import { Redirect } from 'expo-router';

/** Preserve old deep links while keeping one permission-aware profile and tools entry. */
export default function More() {
  return <Redirect href="/broker-settings" />;
}
