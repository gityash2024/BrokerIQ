export * from './enums';
export * from './labels';
export * from './utils';
export * from './errors';
export * from './types';
export * from './api-types';
export * from './app-config';
export * from './schemas';
export * from './integrations/registry';
export * from './privacy';
export * from './i18n/languages';
export * from './i18n/translate';
export * from './matching';
export * from './commute';
export * from './seo-slugs';
export * from './query-parser';
export * from './features';
export * from './modules';
export * from './delegated-access';
export * from './inventory';
export * from './capture';
export * from './import-upload';

export * from './property-fields';

export * from './directory-map';
export * from './design';
export * from './publishing';
export * from './dashboard';

export * from './inventory-presentation';
export * from './directory-profile';
export * from './team';
export * from './time-logging';
export * from './visits';
export * from './map-directions';
export * from './sector-map-catalogue';
export * from './inventory-folders';
export * from './pdf-inventory';
export * from './organic';
export * from './workspace-navigation';
export * from './notification-links';
export * from './private-media';
export * from './release';
export * from './inbox-drafts';
export * from './inbox-query';
export * from './follow-ups';
export * from './admin-business';
export * from './request-activity';

export * from './lead-presentation';

export * from './message-links';
export * from './connect-survey';

/** A Connect suggestion becomes an editable draft in the existing CRM forms. */
export type ConnectActionDraft = { kind: 'FOLLOW_UP' | 'SITE_VISIT'; note: string; evidence: string; at?: string };

export function futureConnectDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return date.valueOf() > Date.now() ? date : null;
}

export * from './whatsapp-broadcast';
