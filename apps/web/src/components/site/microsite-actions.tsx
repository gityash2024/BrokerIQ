'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MessageCircle, Phone, Send, Star } from 'lucide-react';
import { whatsappLink } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field, Input, Textarea } from '../ui/field';

export function MicrositeActions({ org }: { org: { id: string; name: string; phone?: string | null; whatsapp?: string | null } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState<'contact' | 'review' | null>(null);
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', message: '' });
  useEffect(() => {
    if (user) setF((x) => ({ ...x, name: x.name || user.name || '', phone: x.phone || user.phone || '' }));
  }, [user]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const wa = org.whatsapp ?? org.phone;
  const send = async () => {
    setLoading(true);
    try {
      await api('/enquiries', { method: 'POST', body: { organizationId: org.id, ...f, source: 'MICROSITE' } });
      toast.success(`${org.name} को आपकी enquiry भेज दी गई`);
      setOpen(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const review = async () => {
    if (!user) return router.push(`/login?next=${location.pathname}`);
    setLoading(true);
    try {
      await api(`/brokers/${org.id}/reviews`, { method: 'POST', body: { rating, comment } });
      toast.success('Review के लिए धन्यवाद!');
      setOpen(null);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {wa && (
        <Button href={whatsappLink(wa, `Hi ${org.name}, BrokerIQ पर आपका profile देखा — property के बारे में बात करनी है।`)} external variant="whatsapp">
          <MessageCircle className="size-4" /> WhatsApp
        </Button>
      )}
      <Button onClick={() => setOpen('contact')}>
        <Send className="size-4" /> Contact
      </Button>
      <Button variant="secondary" onClick={() => setOpen('review')}>
        <Star className="size-4" /> Review
      </Button>
      <Dialog open={open === 'contact'} onOpenChange={(v) => setOpen(v ? 'contact' : null)} title={`${org.name} से संपर्क करें`} footer={<Button onClick={send} loading={loading}><Phone className="size-4" /> Request callback</Button>}>
        <div className="space-y-3">
          <Field label="नाम" required>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Mobile" required>
            <Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Requirement">
            <Textarea placeholder="Budget, BHK, preferred sector…" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          </Field>
        </div>
      </Dialog>
      <Dialog open={open === 'review'} onOpenChange={(v) => setOpen(v ? 'review' : null)} title={`${org.name} को rate करें`} footer={<Button onClick={review} loading={loading}>Submit review</Button>}>
        <div className="flex justify-center gap-1 py-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onClick={() => setRating(i)} aria-label={`${i} star`}>
              <Star className={cn('size-9 transition hover:scale-110', i <= rating ? 'fill-amber-400 text-amber-400' : 'text-line')} />
            </button>
          ))}
        </div>
        <Textarea className="mt-3" placeholder="आपका अनुभव कैसा रहा?" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
    </div>
  );
}
