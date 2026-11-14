import { moduleForPath, type DelegatedAction } from '@brokeriq/shared';

/** Firm membership and authorization management always belong to the Broker Admin. */
export function delegatedEndpoint(path: string, method: string, body?: { action?: string }): { module: string; actions: DelegatedAction[] } | null {
  if (/^\/(admin|webhooks|invites|broker-invites)(\/|$)/.test(path)) return null;
  if (/^\/broker\/(onboarding|webhook-key)(\/|$)/.test(path)) return null;
  if (/^\/broker\/team\/(invite|invites)(\/|$)/.test(path)) return null;
  if (/^\/broker\/team\/(members\/)?[^/]+$/.test(path) && !['GET', 'HEAD'].includes(method) &&
      path !== '/broker/team/targets' && path !== '/broker/team/agent-location' && path !== '/broker/team/agent-kyc') return null;

  const module = /^\/broker\/team\/agents\/:[^/]+\/kyc$/.test(path) ? 'kyc'
    : path === '/broker/team/agent-location' ? 'time_logging'
    : /^\/broker\/(profile|business-hours)(\/|$)/.test(path) ? 'team' : moduleForPath(path, 'api');
  // These surfaces can act across several business modules or return firm-wide
  // aggregates and credentials. They require their own scoped implementation.
  if (!module || ['legacy', 'assistant', 'today', 'consumer'].includes(module)) return null;
  if (/^\/(?:broker\/(?:connectors|integrations|portal-pack|whatsapp)|messaging\/gmail|whatsapp\/connect)(?:\/|$)/.test(path)) return null;
  if (/^\/broker\/profile(?:\/|$)/.test(path)) return null;
  if (path === '/broker/team' && method !== 'GET') return null;
  if (path === '/leads/assignees' && method === 'GET') return { module: 'leads', actions: ['assign'] };
  if (module === 'leads' && method === 'POST' && /\/(activities|ai)$/.test(path)) return { module, actions: ['edit'] };
  if (path === '/broker-requirements/:id/convert' && method === 'POST') return { module, actions: ['edit'] };
  if (path === '/whatsapp/status' && method === 'GET') return { module: 'inbox', actions: ['view'] };

  let actions: DelegatedAction[];
  if (/(^|\/)(export|download|reports?)(\/|$)/.test(path)) actions = ['export'];
  else if (method === 'GET' || method === 'HEAD') actions = ['view'];
  else if (/\/(resolve-lead|sync|read)$/.test(path) && module === 'inbox') actions = ['edit'];
  else if (/(^|\/)(review|approve|verify)(\/|$)/.test(path) || (module === 'kyc' && method === 'PATCH')) actions = ['approve'];
  else if (/(^|\/)(assign|assignees)(\/|$)/.test(path)) actions = ['assign'];
  else if (/(^|\/)(publish|withdraw)(\/|$)/.test(path)) actions = ['publish'];
  else if (/(^|\/)(send|share|reply)(\/|$)/.test(path)) actions = ['send'];
  // Bulk requests support several different mutations in one endpoint.
  else if (path === '/inventory/bulk') actions = ['create', 'assign'];
  else if (path === '/leads/bulk') {
    if (!body?.action || !['assign', 'stage', 'tag', 'delete'].includes(body.action)) return null;
    actions = [body.action === 'assign' ? 'assign' : body.action === 'delete' ? 'delete' : 'edit'];
  }
  else if (method === 'DELETE' || /\/(archive|remove)$/.test(path)) actions = ['delete'];
  else if (path === '/inventory/bulk/update') actions = ['edit', 'publish'];
  else if (method === 'PATCH' || method === 'PUT' || /\/(restore|update)$/.test(path)) actions = ['edit'];
  else if (method === 'POST') actions = ['create'];
  else return null;
  return { module, actions };
}
