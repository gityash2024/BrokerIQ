export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'brokeriq://');
    if (url.hostname === 'expo-sharing' || path.includes('expo-sharing')) return '/handle-share';
    if (url.pathname.startsWith('/user/property/')) return url.pathname.replace('/user/property/', '/property/') + url.search;
    if (url.pathname === '/user' || url.pathname === '/user/search') return '/(user)/' + (url.pathname === '/user' ? 'home' : 'search') + url.search;
  } catch {}
  return path;
}
