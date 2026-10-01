'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/field';

/** Two-step "OTP मँगवाएँ → OTP डालकर confirm करें" used by public confirmation pages. */
export function OtpConfirm({
  label,
  done,
  doneText,
  requestPath,
  confirmPath,
  body,
  onDone,
}: {
  label: string;
  done: boolean;
  doneText: string;
  requestPath: string;
  confirmPath: string;
  body?: Record<string, unknown>;
  onDone: () => void;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  if (done)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 className="size-5" /> {doneText}
      </p>
    );
  const request = async () => {
    setBusy(true);
    try {
      const r = await api<{ sentTo: string }>(requestPath, { method: 'POST', body: body ?? {}, auth: false });
      setSentTo(r.sentTo);
      toast.success(`OTP भेजा: ${r.sentTo}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      await api(confirmPath, { method: 'POST', body: { ...(body ?? {}), otp }, auth: false });
      toast.success('Confirm हो गया ✓');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-2xl border border-line p-4">
      <p className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-5 text-brand-600" /> {label}
      </p>
      {!sentTo ? (
        <Button onClick={request} loading={busy}>
          OTP मँगवाएँ
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-40 tracking-[0.3em]"
            inputMode="numeric"
            maxLength={6}
            placeholder="6 अंक"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
          />
          <Button onClick={confirm} loading={busy} disabled={otp.length !== 6}>
            Confirm करें
          </Button>
          <Button variant="ghost" onClick={request} disabled={busy}>
            दोबारा भेजें
          </Button>
          <p className="w-full text-xs text-muted">OTP {sentTo} पर भेजा गया है (10 मिनट तक valid)।</p>
        </div>
      )}
    </div>
  );
}
