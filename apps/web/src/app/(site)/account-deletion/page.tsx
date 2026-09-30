import type { Metadata } from 'next';
import { PageShell } from '@/components/site/page-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Account delete करें — BrokerIQ',
  description: 'BrokerIQ account और उससे जुड़ा data delete करने का तरीका (app और website)।',
};

/** Public page for app stores: how to delete a BrokerIQ account and what gets removed. */
export default function AccountDeletionPage() {
  return (
    <PageShell>
      <div className="container-x max-w-3xl py-14">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Account delete करें</h1>
        <p className="mt-2 text-muted">BrokerIQ (Android app और website) का account आप खुद कभी भी delete कर सकते हैं।</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <p className="font-display font-bold">📱 App से</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Login करें</li>
              <li>Profile → Edit profile खोलें</li>
              <li>नीचे “Account delete करें” दबाएँ और पक्का करें</li>
            </ol>
          </div>
          <div className="card p-5">
            <p className="font-display font-bold">💻 Website से</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Login करें</li>
              <li>Account → Profile & KYC खोलें</li>
              <li>“Account delete करें” दबाएँ, “DELETE” लिखकर पक्का करें</li>
            </ol>
            <Button href="/account/profile" size="sm" className="mt-4">
              Profile खोलें
            </Button>
          </div>
        </div>

        <div className="card mt-6 p-5 text-sm">
          <p className="font-display font-bold">क्या हटता है</p>
          <p className="mt-1 text-muted">
            Profile (नाम, email, phone, photo), saved properties और searches, alerts, requirements, flatmate profile, location और contacts data, push tokens और KYC documents — तुरंत। आपकी खुद की (owner) listings archive हो जाती हैं।
          </p>
          <p className="mt-3 font-display font-bold">क्या रहता है</p>
          <p className="mt-1 text-muted">
            Brokers के साथ हुई enquiries/deals और invoices के records बिना आपकी पहचान के (anonymised) रहते हैं, ताकि brokers का हिसाब सही रहे और क़ानूनी ज़रूरतें पूरी हों।
          </p>
        </div>

        <p className="mt-6 text-sm text-muted">
          Login नहीं हो पा रहा? <a href="/contact" className="font-semibold text-brand-600 hover:underline">Contact page</a> से अपने registered email/phone के साथ लिखें — हम 30 दिनों में account delete कर देंगे। पूरी जानकारी:{' '}
          <a href="/p/privacy" className="font-semibold text-brand-600 hover:underline">Privacy policy</a>.
        </p>
      </div>
    </PageShell>
  );
}
