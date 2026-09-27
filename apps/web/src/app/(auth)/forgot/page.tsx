'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { AuthShell } from '@/components/site/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!sent) {
        const r = await api<any>('/auth/otp/request', { method: 'POST', auth: false, body: { email, purpose: 'RESET_PASSWORD' } });
        if (r.devCode) setCode(r.devCode);
        setSent(true);
        toast.success('अगर यह email registered है तो code भेज दिया गया है');
      } else {
        await api('/auth/password/reset', { method: 'POST', auth: false, body: { email, code, password } });
        toast.success('Password बदल गया — अब login करें');
        router.push('/login');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title="Password reset" subtitle="Email पर 6-digit code आएगा">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" required value={email} disabled={sent} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {sent && (
          <>
            <Field label="Code">
              <Input inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-mono tracking-[0.4em]" />
            </Field>
            <Field label="नया password">
              <Input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </>
        )}
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {sent ? 'Password बदलें' : 'Code भेजें'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-brand-600">← Login पर वापस</Link>
      </p>
    </AuthShell>
  );
}
