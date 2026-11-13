import type { Metadata } from 'next';
import { BookOpen, Download } from 'lucide-react';
import { PageShell } from '@/components/site/page-shell';

export const metadata: Metadata = {
  title: 'BrokerIQ user guides',
  description: 'Download the BrokerIQ workspace and Super Admin guides in English or Hindi.',
  alternates: { canonical: '/guides' },
};

const guides = [
  {
    role: 'broker',
    title: 'Broker Admin and Agent',
    text: 'Sign-in, leads, inventory, Inbox, shifts and follow-ups on web and Android.',
  },
  {
    role: 'super-admin',
    title: 'Super Admin',
    text: 'Firm-level records, verification, integrations, roles and operational review.',
  },
];

export default function GuidesPage() {
  return (
    <PageShell>
      <section className="container-x space-y-8 py-14">
        <header className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Help & documentation</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">BrokerIQ user guides</h1>
          <p className="text-muted">
            Updated workflow supplements cover ten-minute shift locations, source review, property-photo sharing and display preferences. The illustrated core retains its labelled Build 57 web and QA-emulator
            captures.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {guides.map(({ role, title, text }) => (
            <article key={role} className="card space-y-4 p-6">
              <BookOpen className="size-6 text-brand-600" aria-hidden="true" />
              <h2 className="font-display text-xl font-bold">{title}</h2>
              <p className="text-sm text-muted">{text}</p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    ['en', 'English'],
                    ['hi', 'हिंदी'],
                  ] as const
                ).map(([language, label]) => (
                  <a
                    key={language}
                    lang={language}
                    href={`/guides/BrokerIQ-${role}-${language}.pdf`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:border-brand-500"
                    download
                  >
                    <Download className="size-4" aria-hidden="true" /> {label} PDF
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
        <nav className="flex flex-wrap gap-5 text-sm font-semibold text-brand-700 dark:text-brand-300" aria-label="Guide support">
          <a href="/#screenshots">Product screenshots</a>
          <a href="/help">Help centre</a>
          <a href="/contact">Contact support</a>
          <a href="/p/privacy">Privacy policy</a>
          <a href="/p/terms">Terms of use</a>
        </nav>
      </section>
    </PageShell>
  );
}
