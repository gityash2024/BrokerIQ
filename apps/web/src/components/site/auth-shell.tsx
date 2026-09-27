import Link from 'next/link';
import { BadgeCheck, Bell, MapPinned, Zap } from 'lucide-react';
import { Logo } from '../ui/misc';

export function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="mesh-hero relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col">
        <Link href="/">
          <Logo light />
        </Link>
        <div className="my-auto max-w-md">
          <h2 className="font-display text-4xl leading-tight font-extrabold">
            Gurgaon की हर property, <span className="text-gradient">एक ही जगह</span>
          </h2>
          <ul className="mt-8 space-y-5">
            {[
              [BadgeCheck, 'Verified listings', 'हर listing moderation से होकर आती है'],
              [MapPinned, 'Sector-level जानकारी', 'Price trends, connectivity, projects'],
              [Bell, 'Instant alerts', 'नई property आते ही notification'],
              [Zap, 'Brokers के लिए CRM', 'सारी portal leads + WhatsApp automation'],
            ].map(([Icon, t, d]: any) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 backdrop-blur">
                  <Icon className="size-5 text-saffron-400" />
                </span>
                <span>
                  <span className="block font-semibold">{t}</span>
                  <span className="text-sm text-white/65">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">© {new Date().getFullYear()} BrokerIQ</p>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
