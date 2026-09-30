'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field, Input } from '../ui/field';

/** Permanently deletes the signed-in account (same as the app's Profile → "Account delete करें"). */
export function DeleteAccountCard() {
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    try {
      await api('/me', { method: 'DELETE' });
      await logout();
      toast.success('Account delete हो गया');
      router.replace('/');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card mt-6 max-w-3xl border-rose-200 p-6 dark:border-rose-500/30">
      <p className="font-display font-bold text-rose-600">Account delete करें</p>
      <p className="mt-1 text-sm text-muted">
        आपकी profile, saved properties, requirements, alerts, location/contacts data और documents हट जाएँगे। यह वापस नहीं होगा।
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Account delete करें
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => (setOpen(v), setConfirm(''))}
        title="पक्का delete करना है?"
        description='यह वापस नहीं होगा। पक्का करने के लिए नीचे "DELETE" लिखें।'
        footer={
          <Button variant="danger" loading={busy} disabled={confirm.trim().toUpperCase() !== 'DELETE'} onClick={del}>
            हमेशा के लिए delete करें
          </Button>
        }
      >
        <Field label='"DELETE" लिखें'>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" data-no-i18n />
        </Field>
      </Dialog>
    </div>
  );
}
