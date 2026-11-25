import { randomUUID } from 'node:crypto';
import { BROADCAST_API, broadcastGroupInput, brokerRequirementSchema, leadUpdateSchema, ownerReportInputSchema } from '@brokeriq/shared';
import { z } from 'zod';
import type { Tool } from './tools';

const recordId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const leadFields = leadUpdateSchema
  .pick({ name: true, phone: true, alternatePhone: true, email: true, notes: true, temperature: true, tags: true })
  .refine((fields) => Object.keys(fields).length > 0, 'Choose at least one field to edit');
const text = (description: string) => ({ type: 'string', description });
const choose = (values: string[], description: string) => ({ ...text(description), enum: values });
const spec = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const record = spec({ id: text('Exact record ID') }, ['id']);
const recordPath = (root: string, args: { id: unknown }) => root + '/' + recordId.parse(args.id);
const brokerRoles: Tool['roles'] = ['BROKER_ADMIN', 'BROKER_AGENT'];
const brokerAdmin: Tool['roles'] = ['BROKER_ADMIN'];
const personalRoles: Tool['roles'] = ['USER', 'PROPERTY_OWNER', 'BROKER_ADMIN', 'BROKER_AGENT', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT'];

export const workspaceTools: Tool[] = [
  {
    name: 'my_workspace',
    description: 'Check the name, role and current firm for the signed-in account.',
    roles: personalRoles,
    grants: [],
    parameters: spec({}),
    run: async (_args, { me }) => {
      const result = await me();
      const user = result.user ?? result;
      return { name: user.name, role: user.role, firm: user.organization?.name ?? null };
    },
  },
  {
    name: 'my_rental_requirements',
    description: 'Read the renter’s own saved housing requirements and alert status.',
    roles: ['USER'],
    parameters: spec({}),
    run: async (_args, { call }) => {
      const result = await call({ method: 'GET', path: '/requirements/mine' });
      return result
        .slice(0, 10)
        .map(({ id, status, bedrooms, minBudget, maxBudget, moveInBy }: any) => ({ id, status, bedrooms, minBudget, maxBudget, moveInBy }));
    },
  },
  {
    name: 'edit_my_requirement_status',
    description: 'Pause, resume or close a tenant requirement belonging to the signed-in renter.',
    roles: ['USER'],
    write: true,
    parameters: spec({ id: text('Exact requirement ID'), status: choose(['ACTIVE', 'PAUSED', 'CLOSED'], 'Requested status') }, ['id', 'status']),
    summary: (args) => `Set your requirement ${recordId.parse(args.id)} to ${args.status}`,
    run: (args, { call }) =>
      call({ method: 'PATCH', path: recordPath('/requirements', args), body: { status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']).parse(args.status) } }),
  },
  {
    name: 'report_owner_availability',
    description: 'Record the owner’s availability report through the existing firm review flow. Use an exact availability date for UPCOMING.',
    roles: ['PROPERTY_OWNER'],
    write: true,
    parameters: spec(
      {
        id: text('Linked property ID'),
        status: choose(['AVAILABLE', 'UPCOMING', 'RENTED', 'UNAVAILABLE'], 'Reported availability'),
        availableFrom: text('YYYY-MM-DD when applicable'),
        note: text('Optional owner note'),
      },
      ['id', 'status'],
    ),
    summary: (args) => `Report property ${recordId.parse(args.id)} as ${args.status}${args.availableFrom ? ' from ' + args.availableFrom : ''}`,
    run: (args, { call }) =>
      call({
        method: 'POST',
        path: recordPath('/owner/properties', args) + '/update',
        body: ownerReportInputSchema.parse({ clientMutationId: randomUUID(), status: args.status, availableFrom: args.availableFrom, note: args.note }),
      }),
  },
  {
    name: 'edit_lead_contact',
    description: 'Change the exact contact or qualification fields the user provides for a lead within their CRM access.',
    roles: brokerRoles,
    grants: ['leads:view', 'leads:edit'],
    write: true,
    parameters: spec(
      {
        id: text('Exact Lead ID'),
        name: text('Name'),
        phone: text('Phone'),
        alternatePhone: text('Alternate number'),
        email: text('Email'),
        notes: text('Replacement notes'),
        temperature: choose(['HOT', 'WARM', 'COLD'], 'Temperature'),
        tags: { type: 'array', items: text('Tag') },
      },
      ['id'],
    ),
    summary: ({ id, ...fields }) => `Edit lead ${recordId.parse(id)} • ${JSON.stringify(leadFields.parse(fields))}`,
    run: ({ id, ...fields }, { call }) => call({ method: 'PATCH', path: recordPath('/leads', { id }), body: leadFields.parse(fields) }),
  },
  {
    name: 'archive_inventory',
    description:
      'Archive a property using the normal inventory lifecycle after confirming the exact ID. Linked records follow existing approval and dependency rules.',
    roles: brokerAdmin,
    grants: ['inventory:view', 'inventory:delete'],
    write: true,
    parameters: record,
    summary: (args) => `Archive inventory record ${recordId.parse(args.id)}`,
    run: (args, { call }) => call({ method: 'DELETE', path: recordPath('/inventory', args) }),
  },
  {
    name: 'create_broker_requirement',
    description: 'Create a private firm demand requirement from supplied details. Keep unknown values blank and use rupees for all budgets.',
    roles: brokerRoles,
    grants: ['leads:view', 'leads:create'],
    write: true,
    parameters: spec(
      {
        title: text('Requirement title'),
        purpose: choose(['SALE', 'RENT'], 'Purchase or rent'),
        leadId: text('Optional existing lead ID'),
        localityNames: { type: 'array', items: text('Exact locality') },
        bedrooms: { type: 'array', items: { type: 'integer' } },
        minBudget: { type: 'number' },
        maxBudget: { type: 'number' },
        notes: text('Authorized user notes'),
      },
      ['title', 'purpose'],
    ),
    summary: (args) => `Create a private requirement • ${JSON.stringify(requirementInput(args))}`,
    run: (args, { call }) => call({ method: 'POST', path: '/broker-requirements', body: requirementInput(args) }),
  },
  {
    name: 'complete_follow_up',
    description: 'Complete an assigned follow-up after confirming its current update timestamp and the user’s explicit outcome.',
    roles: brokerRoles,
    grants: ['leads:view', 'leads:edit'],
    write: true,
    parameters: spec(
      { id: text('Follow-up ID'), expectedUpdatedAt: text('Current update timestamp returned by the agenda'), outcomeNote: text('Optional outcome') },
      ['id', 'expectedUpdatedAt'],
    ),
    summary: (args) => `Complete follow-up ${recordId.parse(args.id)}${args.outcomeNote ? ' • ' + args.outcomeNote : ''}`,
    run: (args, { call }) =>
      call({
        method: 'PATCH',
        path: recordPath('/follow-ups', args),
        body: {
          status: 'DONE',
          expectedUpdatedAt: z.iso.datetime({ offset: true }).parse(args.expectedUpdatedAt),
          outcomeNote: args.outcomeNote,
        },
      }),
  },
  {
    name: 'cancel_site_visit',
    description: 'Cancel one specified site visit through the regular visit workflow.',
    roles: brokerRoles,
    grants: ['leads:view', 'leads:delete'],
    write: true,
    parameters: record,
    summary: (args) => `Cancel visit ${recordId.parse(args.id)}`,
    run: (args, { call }) => call({ method: 'DELETE', path: recordPath('/visits', args) }),
  },
  {
    name: 'list_invoices',
    description: 'View scoped invoice numbers, statuses, amounts and dates available in the broker workspace.',
    roles: brokerRoles,
    grants: ['deals:view'],
    parameters: spec({}),
    run: async (_args, { call }) => {
      const result = await call({ method: 'GET', path: '/broker/invoices?paginated=true&pageSize=10' });
      return result.items.map(({ id, number, status, total, dueDate, createdAt }: any) => ({ id, number, status, total, dueDate, createdAt }));
    },
  },
  {
    name: 'cancel_invoice',
    description: 'Cancel the specified invoice only when its ordinary lifecycle permits cancellation.',
    roles: brokerRoles,
    grants: ['deals:view', 'deals:delete'],
    write: true,
    parameters: record,
    summary: (args) => `Cancel invoice ${recordId.parse(args.id)}`,
    run: (args, { call }) => call({ method: 'PATCH', path: recordPath('/broker/invoices', args), body: { status: 'CANCELLED' } }),
  },
  {
    name: 'list_automations',
    description: 'View firm automation names, enabled state and triggers.',
    roles: brokerAdmin,
    grants: ['automation:view'],
    parameters: spec({}),
    run: async (_args, { call }) => {
      const result = await call({ method: 'GET', path: '/automations' });
      return result.slice(0, 10).map(({ id, name, enabled, trigger }: any) => ({ id, name, enabled, trigger }));
    },
  },
  {
    name: 'review_connect_capture',
    description: 'Mark a specific authorized Connect event as reviewed or dismissed. Use the exact event ID.',
    roles: brokerRoles,
    grants: ['automation:view', 'automation:edit'],
    write: true,
    parameters: spec({ id: text('Connect event ID'), decision: choose(['REVIEWED', 'DISMISSED'], 'Review decision') }, ['id', 'decision']),
    summary: (args) => `Mark Connect activity ${recordId.parse(args.id)} as ${args.decision}`,
    run: (args, { call }) =>
      call({
        method: 'PATCH',
        path: recordPath('/connect/events', args) + '/review',
        body: { decision: z.enum(['REVIEWED', 'DISMISSED']).parse(args.decision) },
      }),
  },
  {
    name: 'list_connect_activity',
    description: 'View recent Connect captures, event IDs and processing status scoped to the caller.',
    roles: brokerRoles,
    grants: ['automation:view'],
    parameters: spec({}),
    run: async (_args, { call }) => {
      const result = await call({ method: 'GET', path: '/connect/events' });
      return result.items.slice(0, 10).map(({ id, kind, status, capturedAt, leadId }: any) => ({ id, kind, status, capturedAt, leadId }));
    },
  },
  {
    name: 'edit_broadcast_group',
    description: 'Update an existing contact group with its full intended membership. Contact IDs must belong to the current firm.',
    roles: brokerAdmin,
    grants: ['inbox:view', 'inbox:edit'],
    write: true,
    parameters: spec({ id: text('Existing group ID'), name: text('Group name'), contactIds: { type: 'array', items: text('Exact contact ID') } }, [
      'id',
      'name',
      'contactIds',
    ]),
    summary: (args) => `Update group ${recordId.parse(args.id)} • ${JSON.stringify(broadcastGroupInput.parse(args))}`,
    run: (args, { call }) => call({ method: 'PATCH', path: recordPath(BROADCAST_API + '/groups', args), body: broadcastGroupInput.parse(args) }),
  },
];

function requirementInput(args: Record<string, unknown>) {
  const { title, purpose, leadId, localityNames, bedrooms, minBudget, maxBudget, notes } = args;
  return brokerRequirementSchema.parse({
    title: z.string().trim().min(1).parse(title),
    purpose: z.enum(['SALE', 'RENT']).parse(purpose),
    leadId,
    localityNames,
    bedrooms,
    minBudget,
    maxBudget,
    notes,
    intent: 'DEMAND',
  });
}
