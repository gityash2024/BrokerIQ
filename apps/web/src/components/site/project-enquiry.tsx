'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, FileDown } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '../ui/button';
import { Input, Textarea } from '../ui/field';

export function ProjectEnquiry({ projectId, name, brochureUrl }: { projectId: string; name: string; brochureUrl?: string | null }) {
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', message: `${name} के बारे में price list और site visit की जानकारी चाहिए।` });
  useEffect(() => {
    if (user) setF((x) => ({ ...x, name: x.name || user.name || '', phone: x.phone || user.phone || '' }));
  }, [user]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/enquiries', { method: 'POST', body: { projectId, ...f, source: 'WEBSITE' } });
      setDone(true);
      if (brochureUrl) window.open(brochureUrl, '_blank');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="card p-6">
      {done ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
          <p className="mt-2 font-semibold">धन्यवाद! हम जल्द संपर्क करेंगे।</p>
          {brochureUrl && (
            <Button href={brochureUrl} external variant="secondary" className="mt-4">
              <FileDown className="size-4" /> Brochure
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="font-display text-lg font-bold">Price list & brochure पाएँ</p>
          <Input required placeholder="आपका नाम" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input required inputMode="tel" placeholder="Mobile number" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <Textarea rows={3} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          <Button type="submit" variant="accent" className="w-full" loading={loading}>
            {brochureUrl ? 'Download brochure' : 'Request callback'}
          </Button>
        </form>
      )}
    </div>
  );
}
