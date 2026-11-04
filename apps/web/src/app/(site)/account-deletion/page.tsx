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
        <p className="mt-2 text-muted">BrokerIQ में sign in करके आप अपना account बंद कर सकते हैं।</p>

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
            Account बंद होता है और profile की पहचान हटती है। Saved items, notifications, personal location और contacts entries, push tokens और व्यक्तिगत KYC
            record हटते हैं। आपकी निजी owner listings archive होती हैं।
          </p>
          <p className="mt-3 font-display font-bold">क्या रहता है</p>
          <p className="mt-1 text-muted">
            Firm के CRM records, chats, invoices और shift history रह सकते हैं। Uploaded files या backup copies की समीक्षा या deletion के लिए support से संपर्क
            करें।
          </p>
        </div>

        <p className="mt-6 text-sm text-muted">
          Login नहीं हो पा रहा?{' '}
          <a href="/contact" className="font-semibold text-brand-600 hover:underline">
            Contact page
          </a>{' '}
          से अपने registered email के साथ लिखें ताकि हम अनुरोध की पुष्टि कर सकें।{' '}
          <a href="/p/privacy" className="font-semibold text-brand-600 hover:underline">
            Privacy policy
          </a>
          .
        </p>
      </div>
    </PageShell>
  );
}
