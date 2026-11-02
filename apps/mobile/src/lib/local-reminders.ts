import * as Notifications from 'expo-notifications';
import { api, authStore, registerSessionReset } from './api';
import { tr } from './i18n';

export interface ReminderTask {
  id: string;
  kind: 'FOLLOW_UP' | 'VISIT';
  leadId: string;
  at: string;
}
interface ReminderData {
  localReminder: true;
  recipientUserId: string;
  recipientScope: string;
  taskId: string;
  taskKind: ReminderTask['kind'];
  leadId: string;
  at: string;
  minutesBefore: number;
}
interface LeadTasks {
  followUps?: { id: string; status: string; dueAt: string; assignedToId?: string | null }[];
  visits?: { id: string; status: string; scheduledAt: string; assignedToId?: string | null }[];
}
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const scope = () => {
  const u = authStore.get()?.user;
  return u ? `${u.id}:${u.role}:${u.organization?.id ?? u.organizationId ?? ''}` : '';
};
const identifier = (owner: string, kind: ReminderTask['kind'], id: string) => `biq.reminder:${owner}:${kind}:${id}`;
let generation = 0;
const pending = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
  const job = (pending.get(key) ?? Promise.resolve()).catch(() => undefined).then(work);
  pending.set(key, job);
  const clean = () => {
    if (pending.get(key) === job) pending.delete(key);
  };
  void job.then(clean, clean);
  return job;
}
function dataFor(raw: Record<string, unknown> | undefined): ReminderData | null {
  if (
    !raw ||
    raw.localReminder !== true ||
    !validId(raw.recipientUserId) ||
    !validId(raw.taskId) ||
    !validId(raw.leadId) ||
    !['FOLLOW_UP', 'VISIT'].includes(String(raw.taskKind)) ||
    typeof raw.recipientScope !== 'string' ||
    typeof raw.at !== 'string' ||
    !Number.isFinite(Date.parse(raw.at)) ||
    typeof raw.minutesBefore !== 'number' ||
    !Number.isInteger(raw.minutesBefore) ||
    raw.minutesBefore < 0 ||
    raw.minutesBefore > 1440
  )
    return null;
  return raw as unknown as ReminderData;
}
function currentTask(data: ReminderData, lead: LeadTasks): ReminderTask | null {
  const user = authStore.get()?.user;
  if (!user || data.recipientUserId !== user.id || data.recipientScope !== scope()) return null;
  const row = (data.taskKind === 'FOLLOW_UP' ? lead.followUps : lead.visits)?.find((t) => t.id === data.taskId);
  if (!row || (user.role === 'BROKER_AGENT' && row.assignedToId !== user.id)) return null;
  if (data.taskKind === 'FOLLOW_UP' ? row.status !== 'PENDING' : !['SCHEDULED', 'CONFIRMED'].includes(row.status)) return null;
  const at = 'dueAt' in row ? row.dueAt : 'scheduledAt' in row ? row.scheduledAt : null;
  return typeof at === 'string' && Number.isFinite(Date.parse(at)) ? { id: data.taskId, kind: data.taskKind, leadId: data.leadId, at } : null;
}

registerSessionReset(async () => {
  generation++;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.content.data?.localReminder === true).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const shown = await Notifications.getPresentedNotificationsAsync();
  // Presented notifications belong to this app. Clear the old account/role's
  // OS previews; permitted history remains in the server notification inbox.
  await Promise.all(shown.map((n) => Notifications.dismissNotificationAsync(n.request.identifier)));
});

/** Generic offline content does not disclose a client whose assignment changed while offline. */
export async function scheduleReminder(task: ReminderTask, minutesBefore = 15) {
  const user = authStore.get()?.user;
  if (
    !user ||
    !['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) ||
    !['FOLLOW_UP', 'VISIT'].includes(task.kind) ||
    !validId(task.id) ||
    !validId(task.leadId) ||
    !Number.isFinite(Date.parse(task.at)) ||
    !Number.isInteger(minutesBefore) ||
    minutesBefore < 0 ||
    minutesBefore > 1440
  )
    return null;
  const owner = user.id,
    ownerScope = scope(),
    revision = generation;
  const key = identifier(owner, task.kind, task.id);
  return serialized(key, async () => {
    if (revision !== generation || scope() !== ownerScope) return null;
    const existing = (await Notifications.getAllScheduledNotificationsAsync()).find((n) => n.identifier === key);
    if (revision !== generation || scope() !== ownerScope) return null;
    const when = new Date(Date.parse(task.at) - minutesBefore * 60_000);
    if (when.getTime() <= Date.now()) {
      await Notifications.cancelScheduledNotificationAsync(key);
      return null;
    }
    if (
      existing &&
      existing.content.data?.at === task.at &&
      existing.content.data?.recipientScope === ownerScope &&
      existing.content.data?.minutesBefore === minutesBefore
    )
      return key;
    await Notifications.cancelScheduledNotificationAsync(key);
    if (when.getTime() <= Date.now() || revision !== generation || scope() !== ownerScope) return null;
    const id = await Notifications.scheduleNotificationAsync({
      identifier: key,
      content: {
        title: tr('BrokerIQ reminder'),
        body: tr('Open BrokerIQ to review the current task.'),
        data: {
          localReminder: true,
          recipientUserId: owner,
          recipientScope: ownerScope,
          taskId: task.id,
          taskKind: task.kind,
          leadId: task.leadId,
          at: task.at,
          minutesBefore,
        },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
    if (revision !== generation || scope() !== ownerScope) {
      await Notifications.cancelScheduledNotificationAsync(id);
      return null;
    }
    return id;
  });
}

/** Notification taps verify the exact task, not only the containing Lead. */
export async function resolveLocalReminder(raw: Record<string, unknown>) {
  const data = dataFor(raw),
    ownerScope = scope(),
    revision = generation;
  if (!data || data.recipientScope !== ownerScope) return null;
  const lead = await api<LeadTasks>(`/leads/${encodeURIComponent(data.leadId)}`, { ownerId: data.recipientUserId });
  if (scope() !== ownerScope || revision !== generation) return null;
  const task = currentTask(data, lead);
  return task && Date.parse(task.at) === Date.parse(data.at) ? task : null;
}

let reconciling: { ownerScope: string; revision: number; promise: Promise<void> } | null = null;
export function reconcileLocalReminders(): Promise<void> {
  const ownerScope = scope(),
    revision = generation;
  if (reconciling?.ownerScope === ownerScope && reconciling.revision === revision) return reconciling.promise;
  const run = async () => {
    if (!ownerScope) return;
    const leads = new Map<string, Promise<LeadTasks>>();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.content.data?.localReminder !== true) continue;
      if (revision !== generation || scope() !== ownerScope) return;
      const data = dataFor(item.content.data);
      if (!data || data.recipientScope !== ownerScope) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
        continue;
      }
      try {
        if (!leads.has(data.leadId)) leads.set(data.leadId, api<LeadTasks>(`/leads/${encodeURIComponent(data.leadId)}`, { ownerId: data.recipientUserId }));
        const lead = await leads.get(data.leadId)!;
        if (revision !== generation || scope() !== ownerScope) return;
        const task = currentTask(data, lead);
        if (!task) await Notifications.cancelScheduledNotificationAsync(item.identifier);
        else if (Date.parse(task.at) !== Date.parse(data.at)) await scheduleReminder(task, data.minutesBefore);
      } catch (error) {
        if (revision !== generation || scope() !== ownerScope) return;
        // Network loss preserves a generic offline alert; permission loss removes it.
        if ([401, 403, 404].includes((error as { status?: number }).status ?? 0)) await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
    for (const item of await Notifications.getPresentedNotificationsAsync()) {
      const raw = item.request.content.data;
      if (raw?.localReminder !== true) continue;
      if (revision !== generation || scope() !== ownerScope) return;
      const data = dataFor(raw);
      if (!data || data.recipientScope !== ownerScope) {
        await Notifications.dismissNotificationAsync(item.request.identifier);
        continue;
      }
      try {
        if (!leads.has(data.leadId)) leads.set(data.leadId, api<LeadTasks>(`/leads/${encodeURIComponent(data.leadId)}`, { ownerId: data.recipientUserId }));
        const lead = await leads.get(data.leadId)!;
        if (revision !== generation || scope() !== ownerScope) return;
        const task = currentTask(data, lead);
        if (!task || Date.parse(task.at) !== Date.parse(data.at)) await Notifications.dismissNotificationAsync(item.request.identifier);
      } catch (error) {
        if (revision !== generation || scope() !== ownerScope) return;
        if ([401, 403, 404].includes((error as { status?: number }).status ?? 0)) await Notifications.dismissNotificationAsync(item.request.identifier);
      }
    }
  };
  const promise = run().finally(() => {
    if (reconciling?.promise === promise) reconciling = null;
  });
  reconciling = { ownerScope, revision, promise };
  return promise;
}
