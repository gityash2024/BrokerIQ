import { scoreLead, temperatureFor, type LeadSignals } from './lead-score';

const now = new Date('2026-09-30T10:00:00Z');
const base: LeadSignals = {
  stage: 'NEW',
  source: 'HOUSING',
  lastActivityAt: null,
  createdAt: new Date('2026-09-30T08:00:00Z'),
  repeatCount: 0,
  requirementFields: 0,
  matchingListings: 0,
  inboundMessages: 0,
  connectedCalls: 0,
  visitsScheduled: 0,
  visitsCompleted: 0,
  shareOpens: 0,
  optedOut: false,
};

describe('lead scoring', () => {
  it('fresh portal lead with nothing else is cold-ish, with reasons', () => {
    const r = scoreLead(base, now);
    expect(r.score).toBeLessThan(35);
    expect(r.temperature).toBe('COLD');
    expect(r.reasons).toContain('आज active');
  });

  it('engaged lead with visit and full requirement is hot', () => {
    const r = scoreLead(
      { ...base, stage: 'SITE_VISIT', requirementFields: 4, matchingListings: 5, inboundMessages: 3, connectedCalls: 1, visitsScheduled: 1 },
      now,
    );
    expect(r.temperature).toBe('HOT');
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.reasons).toEqual(expect.arrayContaining(['Site visit scheduled', 'Requirement पूरी है', '5 matching properties']));
  });

  it('stale lead loses points; STOP lowers score', () => {
    const stale = scoreLead({ ...base, stage: 'INTERESTED', lastActivityAt: new Date('2026-08-01T00:00:00Z') }, now);
    const fresh = scoreLead({ ...base, stage: 'INTERESTED', lastActivityAt: now }, now);
    expect(stale.score).toBeLessThan(fresh.score);
    expect(scoreLead({ ...base, optedOut: true }, now).score).toBeLessThan(scoreLead(base, now).score);
  });

  it('won/lost are fixed and score is clamped', () => {
    expect(scoreLead({ ...base, stage: 'WON' }, now)).toMatchObject({ score: 100, temperature: 'HOT' });
    expect(scoreLead({ ...base, stage: 'LOST' }, now)).toMatchObject({ score: 0, temperature: 'COLD' });
    expect(temperatureFor(65)).toBe('HOT');
    expect(temperatureFor(35)).toBe('WARM');
    expect(temperatureFor(34)).toBe('COLD');
  });
});
