'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { whatsappLink } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { PageShell } from '@/components/site/page-shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';

export default function ContactPage() {
  const { app } = useConfig();
  const [f, setF] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/public/contact', { method: 'POST', body: f });
      setDone(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  return (
    <PageShell>
      <div className="container-x grid gap-10 py-14 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">हमसे बात करें</h1>
          <p className="mt-2 text-muted">Listing, account, partnership या कोई भी सवाल — हम मदद के लिए यहाँ हैं।</p>
          <div className="mt-8 space-y-4">
            {app.supportPhone && (
              <a href={`tel:${app.supportPhone}`} className="card flex items-center gap-4 p-4 hover:border-brand-300">
                <Phone className="size-5 text-brand-600" /> {app.supportPhone}
              </a>
            )}
            {app.supportWhatsApp && (
              <a
                href={whatsappLink(app.supportWhatsApp, 'Hi BrokerIQ')}
                target="_blank"
                className="card flex items-center gap-4 p-4 hover:border-brand-300"
                rel="noreferrer"
              >
                <MessageCircle className="size-5 text-emerald-600" /> WhatsApp support
              </a>
            )}
            {app.supportEmail && (
              <a href={`mailto:${app.supportEmail}`} className="card flex items-center gap-4 p-4 hover:border-brand-300">
                <Mail className="size-5 text-brand-600" /> {app.supportEmail}
              </a>
            )}
            {app.officeAddress && (
              <div className="card flex items-center gap-4 p-4">
                <MapPin className="size-5 text-brand-600" /> {app.officeAddress}
              </div>
            )}
          </div>
        </div>
        <div className="card p-8">
          {done ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
              <p className="mt-3 font-display text-xl font-bold">Message मिल गया!</p>
              <p className="text-muted">हमारी team 24 घंटे में जवाब देगी।</p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <Field label="नाम" required>
                <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              </Field>
              <Field label="Email" className="sm:col-span-2">
                <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              </Field>
              <Field label="Subject" className="sm:col-span-2">
                <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
              </Field>
              <Field label="Message" required className="sm:col-span-2">
                <Textarea required rows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
              </Field>
              <Button type="submit" className="sm:col-span-2" loading={loading}>
                Send message
              </Button>
            </form>
          )}
        </div>
      </div>
    </PageShell>
  );
}
