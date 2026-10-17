import { moduleForPath } from '@brokeriq/shared';

export const nativeConsumerPath =
  /^\/(home|search|saved|messages|profile|property|locality|broker|post-property|my-listings|my-visits|enquiries|customer-requirements|customer-overview|chat)(\/|$)/;
export const nativeGuestPath = /^\/(home|search|profile|property|locality|broker)(\/|$)/;
export function nativeModuleKey(path: string) {
  if (nativeConsumerPath.test(path))
    return path.startsWith('/my-visits') ? 'slot_booking' : path.startsWith('/customer-requirements') ? 'tenant_requirements' : 'consumer';
  if (path.startsWith('/area-directory')) return 'directory';
  if (/^\/(inventory(?:-edit)?|publish-rental)(\/|$)/.test(path)) return 'inventory';
  if (/^\/(lead|leads|add-lead|pipeline|follow-ups|visits|requirements|requirement-edit)(\/|$)/.test(path)) return 'leads';
  if (/^\/(inbox|capture|import-review|wa)(\/|$)/.test(path)) return 'inbox';
  if (/^\/(automations|connectors)(\/|$)/.test(path)) return 'automation';
  return path === '/dashboard' ? 'today' : (moduleForPath(path, 'web') ?? 'legacy');
}
