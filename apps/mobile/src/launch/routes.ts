import { moduleForPath } from '@brokeriq/shared';

/** Only the explicitly supported platform location monitor is native-admin capable. */
export function nativePlatformMonitorAllowed(path: string, role: string) {
  return role === 'SUPER_ADMIN' && path === '/time-logging';
}
export function nativeHomeForRole(role?: string) {
  if (!role || role === 'USER') return '/(user)/home' as const;
  if (role === 'SUPER_ADMIN') return '/time-logging' as const;
  return ['BROKER_ADMIN', 'BROKER_AGENT'].includes(role) ? '/(broker)/dashboard' as const : '/login' as const;
}

export const nativeConsumerPath =
  /^\/(home|search|saved|messages|profile|property|locality|broker|post-property|my-listings|my-visits|enquiries|customer-requirements|customer-overview|chat)(\/|$)/;
export const nativeGuestPath = /^\/(home|search|profile|property|locality|broker)(\/|$)/;
export function nativeModuleKey(path: string) {
  if (path === '/team' || path.startsWith('/team-member/') || path === '/leaderboard') return 'team';
  if (path === '/performance') return 'today';
  if (path === '/time-logging') return 'time_logging';
  if (path === '/agent-kyc' || path === '/kyc') return 'kyc';
  if (nativeConsumerPath.test(path))
    return path.startsWith('/my-visits') ? 'slot_booking' : path.startsWith('/customer-requirements') ? 'tenant_requirements' : 'consumer';
  if (path.startsWith('/area-directory')) return 'directory';
  if (/^\/(inventory(?:-edit)?|publish-rental|publication-reviews|scanner|listing-scanner)(\/|$)/.test(path)) return 'inventory';
  if (/^\/(lead|leads|add-lead|pipeline|follow-ups|visits|requirements|requirement-edit)(\/|$)/.test(path)) return 'leads';
  if (/^\/(inbox|capture|import-review|wa)(\/|$)/.test(path)) return 'inbox';
  if (/^\/(automations|connectors)(\/|$)/.test(path)) return 'automation';
  return path === '/dashboard' ? 'today' : (moduleForPath(path, 'web') ?? 'legacy');
}
