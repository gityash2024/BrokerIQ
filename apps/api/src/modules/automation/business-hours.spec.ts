import { nextBusinessTime } from './automation.service';

const hours = { enabled: true, start: '09:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] };
const ist = (iso: string) => new Date(`${iso}+05:30`);

describe('nextBusinessTime', () => {
  it('keeps a time inside business hours', () => {
    const d = ist('2026-09-28T11:00:00'); // Monday
    expect(nextBusinessTime(d, hours).getTime()).toBe(d.getTime());
  });
  it('moves late night to next morning 9am IST', () => {
    expect(nextBusinessTime(ist('2026-09-28T22:30:00'), hours).toISOString()).toBe(ist('2026-09-29T09:00:00').toISOString());
  });
  it('moves early morning to 9am same day', () => {
    expect(nextBusinessTime(ist('2026-09-29T06:00:00'), hours).toISOString()).toBe(ist('2026-09-29T09:00:00').toISOString());
  });
  it('skips Sunday', () => {
    expect(nextBusinessTime(ist('2026-09-27T12:00:00'), hours).toISOString()).toBe(ist('2026-09-28T09:00:00').toISOString());
  });
});
