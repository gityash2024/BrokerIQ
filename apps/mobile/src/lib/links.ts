import { Linking } from 'react-native';
import { router } from 'expo-router';

/** Maps web links from the API to app routes where an equivalent screen exists. */
export function openLink(link?: string | null) {
  if (!link) return;
  if (link.startsWith('http')) return Linking.openURL(link);
  const m = (re: RegExp) => link.match(re)?.[1];
  const lead = m(/\/broker\/leads\/([^/?]+)/);
  if (lead) return router.push(`/lead/${lead}`);
  const prop = m(/\/property\/([^/?]+)/);
  if (prop) return router.push(`/property/${prop}`);
  const chat = m(/[?&]c=([^&]+)/);
  if (chat && link.includes('channel=CHAT')) return router.push({ pathname: '/chat/[id]', params: { id: chat } });
  if (chat && link.includes('/broker/inbox')) return router.push({ pathname: '/wa/[id]', params: { id: chat } });
  if (link.startsWith('/account/messages')) return router.push(chat ? { pathname: '/chat/[id]', params: { id: chat } } : '/(user)/messages');
  if (link.startsWith('/broker/follow-ups')) return router.push('/follow-ups');
  if (link.startsWith('/broker/visits')) return router.push('/visits');
  if (link.startsWith('/broker/listings') || link.startsWith('/account/listings')) return router.push('/my-listings');
  if (link.startsWith('/broker/leads')) return router.push('/(broker)/leads');
  if (link.startsWith('/feedback')) return router.push('/feedback');
  if (link.startsWith('/account/enquiries')) return router.push('/enquiries');
}
