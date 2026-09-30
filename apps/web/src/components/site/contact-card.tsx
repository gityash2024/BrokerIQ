'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { BadgeCheck, CalendarCheck, CheckCircle2, MessageCircle, MessagesSquare, Phone, Star, Wallet, Zap } from 'lucide-react';
import { responseBadge, whatsappLink } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFlag } from '@/lib/config';
import { SITE_URL, toLocalInput } from '@/lib/utils';
import { Button } from '../ui/button';
import { Field, Input, Textarea } from '../ui/field';
import { Avatar } from '../ui/misc';
import { Dialog } from '../ui/dialog';
import { SafetyNote, SlotBooking, TokenDialog } from './visit-token';

export function ContactCard({ listing }: { listing: any }) {
  const { user } = useAuth();
  const router = useRouter();
  const chatOn = useFlag('chat');
  const slotsOn = useFlag('slot_booking');
  const tokensOn = useFlag('visit_tokens');
  const [contact, setContact] = useState<{ name: string; phone: string; whatsapp?: string; tracked?: boolean } | null>(null);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [booked, setBooked] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [sent, setSent] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', email: user?.email ?? '', message: `Hi, मुझे "${listing.title}" में interest है। कृपया details share करें।` });
  useEffect(() => {
    if (user) setForm((x) => ({ ...x, name: x.name || user.name || '', phone: x.phone || user.phone || '', email: x.email || user.email || '' }));
  }, [user]);
  const [sending, setSending] = useState(false);
  const org = listing.organization;
  const isOwn = listing.canManage;

  const reveal = async () => {
    if (!user) return router.push(`/login?next=/property/${listing.slug}`);
    setRevealing(true);
    try {
      setContact(await api(`/listings/${listing.id}/contact`, { method: 'POST' }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRevealing(false);
    }
  };

  const enquire = async (extra: { wantsVisit?: boolean; visitDate?: string } = {}) => {
    if (!form.name.trim() || !form.phone.trim()) return toast.error('Naam और mobile number डालें');
    setSending(true);
    try {
      await api('/enquiries', { method: 'POST', body: { listingId: listing.id, name: form.name, phone: form.phone, email: form.email || undefined, message: form.message, source: 'WEBSITE', ...extra } });
      setSent(true);
      setVisitOpen(false);
      toast.success(extra.wantsVisit ? 'Site visit request भेज दी गई 🎉' : 'Enquiry भेज दी गई — जल्द ही संपर्क होगा');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const startChat = async () => {
    if (!user) return router.push(`/login?next=/property/${listing.slug}`);
    try {
      const c = await api<any>('/chat/start', { method: 'POST', body: { organizationId: org.id, listingId: listing.id, message: `Hi, "${listing.title}" के बारे में जानना है।` } });
      router.push(`/account/messages?c=${c.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date(Date.now() + 86400_000);
    d.setHours(11, 0, 0, 0);
    return toLocalInput(d);
  });

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-gradient-to-br from-brand-50 to-transparent p-5 dark:from-brand-500/10">
        {org ? <Avatar name={org.name} src={org.logoUrl} size={52} /> : <Avatar name={listing.postedBy?.name} src={listing.postedBy?.avatarUrl} size={52} />}
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{org ? 'Broker' : listing.postedByType === 'BUILDER' ? 'Builder' : 'Owner'}</p>
          <p className="flex items-center gap-1 truncate font-display text-lg font-bold">
            {org ? (
              <a href={`/brokers/${org.slug}`} className="hover:text-brand-600">
                {org.name}
              </a>
            ) : (
              listing.contactName ?? listing.postedBy?.name
            )}
            {org?.verification === 'VERIFIED' && <BadgeCheck className="size-5 shrink-0 text-emerald-500" />}
          </p>
          {org && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <Star className="size-3.5 fill-amber-400 text-amber-400" /> {org.reviewCount ? `${org.rating.toFixed(1)} (${org.reviewCount} reviews)` : 'New on BrokerIQ'}
              {org.experienceYears ? ` · ${org.experienceYears}+ yrs` : ''}
            </p>
          )}
          {org && responseBadge(org.responseMinutes) && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-600"><Zap className="size-3.5" /> {responseBadge(org.responseMinutes)}</p>
          )}
        </div>
      </div>
      <div className="space-y-3 p-5">
        {isOwn ? (
          <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">यह आपकी listing है।</div>
        ) : contact ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <Button href={`tel:${contact.phone}`} className="w-full" size="lg">
              <Phone className="size-5" /> {contact.phone}
            </Button>
            {contact.tracked && <p className="text-center text-[11px] text-subtle">यह broker का BrokerIQ business number है — call सीधे broker से जुड़ेगी</p>}
            <Button href={whatsappLink(contact.whatsapp ?? contact.phone, `Hi, ${SITE_URL}/property/${listing.slug} के बारे में पूछना था।`)} external variant="whatsapp" className="w-full">
              <MessageCircle className="size-5" /> WhatsApp करें
            </Button>
          </motion.div>
        ) : (
          <Button onClick={reveal} loading={revealing} className="w-full" size="lg">
            <Phone className="size-5" /> Contact number देखें
          </Button>
        )}
        {!isOwn && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => (org && slotsOn ? (user ? setSlotsOpen(true) : router.push(`/login?next=/property/${listing.slug}`)) : setVisitOpen(true))}>
              <CalendarCheck className="size-4" /> {booked ? 'Booked ✓' : org && slotsOn ? 'Visit book करें' : 'Visit'}
            </Button>
            {org && chatOn ? (
              <Button variant="secondary" onClick={startChat}>
                <MessagesSquare className="size-4" /> Chat
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => document.getElementById('enquiry')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                <MessagesSquare className="size-4" /> Enquire
              </Button>
            )}
          </div>
        )}
        {!isOwn && <SafetyNote />}
        {!isOwn && org && user && tokensOn && (
          <button type="button" onClick={() => setTokenOpen(true)} className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted hover:text-brand-600">
            <Wallet className="size-3.5" /> Broker को token दिया है? Record रखें
          </button>
        )}
      </div>
      {!isOwn && org && slotsOn && <SlotBooking listingId={listing.id} open={slotsOpen} onClose={() => setSlotsOpen(false)} onBooked={setBooked} />}
      {!isOwn && org && user && tokensOn && <TokenDialog listingId={listing.id} open={tokenOpen} onClose={() => setTokenOpen(false)} />}
      {!isOwn && (
        <div id="enquiry" className="border-t border-line p-5">
          {sent ? (
            <div className="flex flex-col items-center py-4 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
                <CheckCircle2 className="size-12 text-emerald-500" />
              </motion.div>
              <p className="mt-2 font-semibold">Enquiry भेज दी गई!</p>
              <p className="text-sm text-muted">{org ? org.name : 'Owner'} जल्दी आपसे संपर्क करेंगे।</p>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                enquire();
              }}
            >
              <p className="font-display font-bold">Details मँगाएँ</p>
              <Input placeholder="आपका नाम" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder="Mobile number" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              <Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <Button type="submit" variant="accent" className="w-full" loading={sending}>
                Send enquiry
              </Button>
              <p className="text-center text-[11px] text-subtle">Submit करके आप {org ? 'broker' : 'owner'} से call/WhatsApp पर संपर्क की अनुमति देते हैं।</p>
            </form>
          )}
        </div>
      )}
      <Dialog
        open={visitOpen}
        onOpenChange={setVisitOpen}
        title="Site visit schedule करें"
        description="अपनी सुविधा का समय चुनें — confirmation WhatsApp/call पर मिलेगा।"
        footer={
          <Button onClick={() => enquire({ wantsVisit: true, visitDate: new Date(visitDate).toISOString() })} loading={sending}>
            Request visit
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="तारीख और समय">
            <Input type="datetime-local" value={visitDate} min={toLocalInput(new Date())} onChange={(e) => setVisitDate(e.target.value)} />
          </Field>
          <Field label="नाम" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Mobile" required>
            <Input value={form.phone} inputMode="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
