import * as Notifications from 'expo-notifications';
import { api, authStore, registerSessionReset } from '../api';
import { scheduleReminder, reconcileLocalReminders, resolveLocalReminder, type ReminderTask } from '../local-reminders';

jest.mock('../api', () => ({ api: jest.fn(), authStore: { get: jest.fn() }, registerSessionReset: jest.fn() }));
jest.mock('../i18n', () => ({ tr: (s: string) => s }));
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const resetSession = (registerSessionReset as jest.Mock).mock.calls[0][0] as () => Promise<void>;
const owner = { user: { id: 'agent-a', role: 'BROKER_AGENT', organization: { id: 'firm-a' } } };
let scheduled: any[], shown: any[];
const task = (): ReminderTask => ({ id: 'task-a', kind: 'FOLLOW_UP', leadId: 'lead-a', at: new Date(Date.now() + 3_600_000).toISOString() });
const lead = (t: ReminderTask, status = 'PENDING') => ({ followUps: [{ id: t.id, dueAt: t.at, status, assignedToId: owner.user.id }] });
beforeEach(() => {
  jest.clearAllMocks();
  (api as jest.Mock).mockReset();
  scheduled = [];
  shown = [];
  (authStore.get as jest.Mock).mockReturnValue(owner);
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockImplementation(async () => [...scheduled]);
  (Notifications.getPresentedNotificationsAsync as jest.Mock).mockImplementation(async () => [...shown]);
  (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockImplementation(async (id) => {
    scheduled = scheduled.filter((n) => n.identifier !== id);
  });
  (Notifications.dismissNotificationAsync as jest.Mock).mockImplementation(async (id) => {
    shown = shown.filter((n) => n.request.identifier !== id);
  });
  (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(async (input) => {
    scheduled.push(input);
    return input.identifier;
  });
});

it('serializes duplicate schedules with a stable task ID and generic offline content', async () => {
  const t = task();
  await Promise.all([scheduleReminder(t), scheduleReminder(t), scheduleReminder(t)]);
  expect(scheduled).toHaveLength(1);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(scheduled[0].content).toMatchObject({
    title: 'BrokerIQ reminder',
    body: 'Open BrokerIQ to review the current task.',
    data: { taskId: t.id, taskKind: t.kind, leadId: t.leadId, recipientUserId: owner.user.id },
  });
});

it('cancels completed work and validates exact task identity on notification tap', async () => {
  const t = task();
  await scheduleReminder(t);
  const data = scheduled[0].content.data;
  (api as jest.Mock).mockResolvedValue(lead(t));
  expect(await resolveLocalReminder(data)).toEqual(t);
  (api as jest.Mock).mockResolvedValue(lead(t, 'DONE'));
  expect(await resolveLocalReminder(data)).toBeNull();
  await reconcileLocalReminders();
  expect(scheduled).toHaveLength(0);
});

it('replaces a rescheduled alert and rejects its old notification time', async () => {
  const t = task();
  await scheduleReminder(t);
  const data = scheduled[0].content.data;
  const later = { ...t, at: new Date(Date.parse(t.at) + 600_000).toISOString() };
  (api as jest.Mock).mockResolvedValue(lead(later));
  await reconcileLocalReminders();
  expect(scheduled).toHaveLength(1);
  expect(scheduled[0].content.data.at).toBe(later.at);
  expect(await resolveLocalReminder(data)).toBeNull();
});

it('preserves generic offline alerts on network loss and cancels revoked access', async () => {
  await scheduleReminder(task());
  (api as jest.Mock).mockRejectedValue(new Error('Offline'));
  await reconcileLocalReminders();
  expect(scheduled).toHaveLength(1);
  (api as jest.Mock).mockRejectedValue({ status: 403 });
  await reconcileLocalReminders();
  expect(scheduled).toHaveLength(0);
});

it('removes legacy unbound alerts and their presented private content without a network request', async () => {
  scheduled = [
    { identifier: 'legacy', content: { title: 'Old private client name', data: { localReminder: true, recipientUserId: owner.user.id, leadId: 'lead-a' } } },
  ];
  shown = [{ request: scheduled[0] }];
  await reconcileLocalReminders();
  expect(scheduled).toHaveLength(0);
  expect(shown).toHaveLength(0);
  expect(api).not.toHaveBeenCalled();
});

it('clears reminders on same-account role/firm changes and rejects late OS scheduling', async () => {
  const t = task();
  let finish!: (id: string) => void, entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementationOnce((input) => {
    entered();
    return new Promise<string>((resolve) => {
      finish = (id) => {
        scheduled.push(input);
        resolve(id);
      };
    });
  });
  const pending = scheduleReminder(t);
  await started;
  (authStore.get as jest.Mock).mockReturnValue({ user: { ...owner.user, role: 'USER' } });
  await resetSession();
  finish('biq.reminder:agent-a:FOLLOW_UP:task-a');
  expect(await pending).toBeNull();
  expect(scheduled).toHaveLength(0);
});

it('does not open another account reminder or a cancelled visit', async () => {
  const t: ReminderTask = { ...task(), kind: 'VISIT' };
  await scheduleReminder(t);
  const data = scheduled[0].content.data;
  (api as jest.Mock).mockResolvedValue({ visits: [{ id: t.id, scheduledAt: t.at, status: 'CANCELLED', assignedToId: owner.user.id }] });
  expect(await resolveLocalReminder(data)).toBeNull();
  (api as jest.Mock).mockClear();
  expect(await resolveLocalReminder({ ...data, recipientUserId: 'other', recipientScope: 'other' })).toBeNull();
  expect(api).not.toHaveBeenCalled();
});

it('dismisses a presented alert once its task is completed', async () => {
  const t = task();
  await scheduleReminder(t);
  shown = [{ request: scheduled[0] }];
  scheduled = [];
  (api as jest.Mock).mockResolvedValue(lead(t, 'DONE'));
  await reconcileLocalReminders();
  expect(shown).toHaveLength(0);
});

it('does not let an old-scope network request block or cancel the new role reminders', async () => {
  const t = task();
  await scheduleReminder(t);
  let rejectOld!: (error: unknown) => void, entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  (api as jest.Mock).mockImplementationOnce(() => {
    entered();
    return new Promise((_resolve, reject) => {
      rejectOld = reject;
    });
  });
  const old = reconcileLocalReminders();
  await started;
  (authStore.get as jest.Mock).mockReturnValue({ user: { ...owner.user, role: 'BROKER_ADMIN' } });
  await resetSession();
  await scheduleReminder(t);
  (api as jest.Mock).mockResolvedValueOnce(lead(t));
  await reconcileLocalReminders();
  expect(scheduled).toHaveLength(1);
  rejectOld({ status: 403 });
  await old;
  expect(scheduled).toHaveLength(1);
});
