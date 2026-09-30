/**
 * Rule-based lead scoring (no AI, no cost). Every point has a human-readable reason so the
 * broker can see *why* a lead is hot. Weights live here in one place so they are easy to tune.
 */
export interface LeadSignals {
  stage: string;
  source: string;
  lastActivityAt: Date | null;
  createdAt: Date;
  repeatCount: number;
  /** Requirement fields that are filled in (budget, locality, BHK, property type) */
  requirementFields: number;
  /** LIVE listings of the firm that match the requirement */
  matchingListings: number;
  inboundMessages: number;
  connectedCalls: number;
  visitsScheduled: number;
  visitsCompleted: number;
  /** Times the lead opened a property link the broker shared */
  shareOpens: number;
  optedOut: boolean;
}

export interface LeadScore {
  score: number;
  reasons: string[];
  temperature: 'HOT' | 'WARM' | 'COLD';
}

const HIGH_INTENT_SOURCES = new Set(['WEBSITE', 'MICROSITE', 'REFERRAL', 'WALK_IN', 'CALL', 'WHATSAPP']);
const PORTAL_SOURCES = new Set(['HOUSING', 'ACRES99', 'MAGICBRICKS', 'NOBROKER', 'FACEBOOK', 'INSTAGRAM']);
const STAGE_POINTS: Record<string, [number, string]> = {
  CONTACTED: [5, 'बात हो चुकी है'],
  INTERESTED: [12, 'Interested'],
  SITE_VISIT: [18, 'Site visit stage'],
  NEGOTIATION: [25, 'Negotiation चल रही है'],
};

export const temperatureFor = (score: number): LeadScore['temperature'] => (score >= 65 ? 'HOT' : score >= 35 ? 'WARM' : 'COLD');

export function scoreLead(s: LeadSignals, now = new Date()): LeadScore {
  if (s.stage === 'WON') return { score: 100, reasons: ['Deal won'], temperature: 'HOT' };
  if (s.stage === 'LOST') return { score: 0, reasons: ['Lost'], temperature: 'COLD' };

  let score = 10;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    score += points;
    if (points) reasons.push(reason);
  };

  const stage = STAGE_POINTS[s.stage];
  if (stage) add(stage[0], stage[1]);

  if (HIGH_INTENT_SOURCES.has(s.source)) add(8, 'सीधी enquiry (high intent source)');
  else if (PORTAL_SOURCES.has(s.source)) add(3, 'Portal/ads lead');

  if (s.requirementFields >= 3) add(10, 'Requirement पूरी है');
  else if (s.requirementFields > 0) add(4, 'Requirement आंशिक');

  if (s.matchingListings >= 3) add(10, `${s.matchingListings} matching properties`);
  else if (s.matchingListings > 0) add(6, `${s.matchingListings} matching property`);

  const last = s.lastActivityAt ?? s.createdAt;
  const days = (now.getTime() - last.getTime()) / 86_400_000;
  if (days <= 1) add(15, 'आज active');
  else if (days <= 3) add(10, 'पिछले 3 दिन में active');
  else if (days <= 7) add(5, 'इस हफ़्ते active');
  else if (days > 30) add(-15, '30+ दिन से कोई बात नहीं');
  else if (days > 14) add(-8, '2 हफ़्ते से कोई बात नहीं');

  if (s.inboundMessages > 0) add(Math.min(12, 4 + s.inboundMessages * 2), 'WhatsApp पर जवाब दिया');
  if (s.connectedCalls > 0) add(Math.min(10, 5 * s.connectedCalls), 'Call connect हुई');
  if (s.visitsCompleted > 0) add(15, 'Site visit कर चुका');
  else if (s.visitsScheduled > 0) add(10, 'Site visit scheduled');
  if (s.shareOpens > 0) add(Math.min(8, 3 + s.shareOpens), 'Shared property देखी');
  if (s.repeatCount > 0) add(Math.min(10, 5 * s.repeatCount), 'दोबारा enquiry की');
  if (s.optedOut) add(-10, 'Messages बंद (STOP)');

  const final = Math.max(0, Math.min(100, Math.round(score)));
  return { score: final, reasons, temperature: temperatureFor(final) };
}
