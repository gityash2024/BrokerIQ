/**
 * Response shapes of the most-used API endpoints, as the web/mobile clients receive them (JSON: dates are ISO strings).
 * Keep in sync with the API's Prisma selects; add a type here before reaching for `any` in a client.
 */

/** GET /public/localities — active localities with live listing counts. */
export interface LocalityListItem {
  id: string;
  name: string;
  slug: string;
  city: string;
  zone: string | null;
  latitude: number;
  longitude: number;
  pincode: string | null;
  description: string | null;
  highlights: string[];
  coverUrl: string | null;
  isPopular: boolean;
  sortOrder: number;
  listingsRent: number;
  listingsSale: number;
  /** Average 2 BHK rent (live listings, else curated), null when unknown */
  avgRent: number | null;
  avgPsf: number | null;
}

/** One in-app notification. */
export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}

/** GET /me/notifications */
export interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

/** GET /whatsapp/templates — the firm's synced Meta templates. */
export interface WaTemplate {
  id: string;
  name: string;
  language: string;
  category: string | null;
  status: string | null;
  body: string | null;
}

export interface ChatOrgSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

/** GET /chat/threads — the user's in-app chats with broker firms. */
export interface ChatThreadSummary {
  id: string;
  contactName: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastPreview: string | null;
  unreadCount: number;
  blockedAt: string | null;
  organization: (ChatOrgSummary & { verification?: string }) | null;
}

export interface ChatMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  body: string | null;
  createdAt: string;
  sender: { id: string; name: string } | null;
}

/** GET /chat/threads/:id */
export interface ChatThreadResponse {
  conversation: ChatThreadSummary & { userId: string | null; blockedReason: string | null };
  items: ChatMessage[];
}
