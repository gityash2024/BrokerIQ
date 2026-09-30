import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface DomainEvents {
  'lead.created': { leadId: string; orgId: string; isNew: boolean };
  'lead.stage_changed': { leadId: string; orgId: string; from: string; to: string; userId?: string };
  'visit.scheduled': { visitId: string; orgId: string; leadId: string };
  'message.inbound': { conversationId: string; orgId: string | null; leadId?: string | null };
  'listing.published': { listingId: string };
  'deal.closed': { dealId: string; orgId: string; userId?: string };
  /** Something on the lead changed that can affect its score (note/call logged, requirement edited). */
  'lead.updated': { leadId: string; orgId: string };
}

/** Tiny in-process domain event bus (decouples modules, avoids circular DI). */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly bus = new EventEmitter().setMaxListeners(50);

  on<K extends keyof DomainEvents>(event: K, handler: (payload: DomainEvents[K]) => unknown) {
    this.bus.on(event, (p) => {
      Promise.resolve()
        .then(() => handler(p))
        .catch((e) => this.logger.error(`handler for ${event} failed: ${(e as Error).message}`));
    });
  }

  emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]) {
    this.bus.emit(event, payload);
  }
}
