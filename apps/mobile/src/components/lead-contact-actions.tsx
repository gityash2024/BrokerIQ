import { openLeadInbox } from '@/lib/inbox-composer';
import { Chip } from '@/ui';

/** Every channel opens the authorized internal composer and its durable lead trail. */
export function LeadContactActions({ lead }: { lead: { id: string; phone?: string | null; email?: string | null } }) {
  return (
    <>
      {!!lead.phone && <Chip label="WhatsApp" onPress={() => openLeadInbox(lead.id)} />}
      {!!lead.phone && <Chip label="SMS" onPress={() => openLeadInbox(lead.id, undefined, 'SMS')} />}
      {!!lead.email && <Chip label="Email" onPress={() => openLeadInbox(lead.id, undefined, 'EMAIL')} />}
    </>
  );
}
