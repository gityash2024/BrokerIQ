import { BRAND, BROKERIQ_COMPANY } from '@brokeriq/shared';
import { LandingMotion } from './landing-motion';

const workflows = [
  ['01', 'Your inventory. In order.', 'Houses, floors, contacts and source records stay connected. Find the right option without losing the details.'],
  ['02', 'Every enquiry has a next step.', 'Bring requirements, follow-ups and site visits into one working day.'],
  ['03', 'Capture now. Review with confidence.', 'Turn shared messages, images and registers into records you can check before using.'],
  ['04', 'A clearer view of your business.', 'Real activity, useful trends and visible connection status across web and Android.'],
];
const portalCards = [
  {
    key: 'user',
    title: 'User Portal',
    description: 'Discover, shortlist and enquire about properties.',
    action: 'Open User Portal',
    href: '/user',
    icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  },
  {
    key: 'broker',
    title: 'Broker Portal',
    description: 'Track your inventory, leads and conversations in one place.',
    action: 'Open Broker Portal',
    href: '/admin',
    icon: 'M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12a23 23 0 0 0 18 0M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z',
  },
  {
    key: 'owner',
    title: 'Owner Portal',
    description: 'Manage your properties and availability with ease.',
    action: 'Open Owner Portal',
    href: '/owner',
    icon: 'm2 11 10-8 10 8M5 9v11h5v-6h4v6h5V9',
  },
  {
    key: 'android',
    title: 'Android App',
    description: 'One app for users, brokers and owners.',
    action: 'Download App',
    href: '#android',
    icon: 'M6 11h12V8a6 6 0 0 0-12 0v3Zm0 0v8h12v-8M8 19v3m8-3v3M3 11v6m18-6v6M7 2l1 2m9-2-1 2M9 7h.01M15 7h.01',
  },
] as const;

function ReleaseTimestamp({ updatedAt }: { updatedAt?: string }) {
  if (!updatedAt) return null;
  const formatted = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(updatedAt));
  return (
    <time className="biq-release-updated" dateTime={updatedAt}>
      {formatted} IST
    </time>
  );
}
export function BrokerIQLanding({
  apkUrl,
  checksum,
  contact,
  galleries = [],
  releaseUpdates,
  preferences,
}: {
  preferences?: React.ReactNode;
  apkUrl?: string;
  contact?: { email?: string; phone?: string; address?: string };
  checksum?: string;
  galleries?: { title: string; screenshots: { src: string; label: string; caption: string }[]; mobile?: boolean }[];
  releaseUpdates?: { user: string; broker: string; android: string };
}) {
  return (
    <div className="biq-landing" style={{ '--biq-brand': BRAND.primary, '--biq-accent': BRAND.accent } as React.CSSProperties}>
      <style>{styles}</style>
      <LandingMotion />
      <div className="biq-scroll-progress" aria-hidden="true" />
      <header className="biq-nav biq-wrap">
        <a className="biq-logo" data-no-i18n href="/" aria-label="BrokerIQ home">
          <img src="/icon.svg" alt="" width="38" height="38" />
          Broker<span>IQ</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="#screenshots">Screenshots</a>
          <a href="/guides">User guides</a>
          <a href="/user">Find a property</a>
          <a href="/login?next=/broker" className="biq-button" aria-label="Broker workspace">
            <span className="biq-nav-cta-label">Broker workspace</span> <span aria-hidden>↗</span>
          </a>
          {preferences && (
            <div className="biq-preferences" role="group" aria-label="Display preferences">
              {preferences}
            </div>
          )}
        </nav>
      </header>
      <main>
        <section className="biq-hero biq-wrap">
          <div className="biq-hero-copy" data-biq-reveal>
            <p className="biq-eyebrow">
              <span /> PROPERTY. PEOPLE. POSSIBILITY.
            </p>
            <h1>
              A better place
              <br />
              for your <em>next move.</em>
            </h1>
            <p className="biq-intro">
              Find your next rental. Build your next connection. Keep your brokerage moving—with one connected experience for Gurugram.
            </p>
            <div className="biq-actions">
              <a className="biq-button" href="/user">
                Explore properties <span aria-hidden>↗</span>
              </a>
              <a className="biq-secondary" href="/login?next=/broker">
                For brokers <span aria-hidden>→</span>
              </a>
            </div>
            <p className="biq-small">Built for Gurugram · Web & Android · हिंदी & English</p>
          </div>
          <figure className="biq-hero-art" data-biq-reveal data-biq-delay="1">
            <img
              src="/product/brokeriq-city.webp"
              alt="Conceptual architectural illustration with ivory homes and an indigo tower"
              width="1440"
              height="960"
              fetchPriority="high"
            />
            <figcaption>Spaces to discover. Connections to build.</figcaption>
            <span className="biq-art-label">A connected property experience</span>
          </figure>
        </section>
        <section className="biq-portals biq-wrap" aria-label="Choose your experience">
          {portalCards.map(({ key, title, description, action, href, icon }, index) => (
            <a
              key={key}
              className={`biq-portal-card biq-portal-card--${key}`}
              href={key === 'android' ? apkUrl || href : href}
              target={key === 'broker' ? '_blank' : undefined}
              rel={key === 'broker' ? 'noopener noreferrer' : undefined}
              data-biq-reveal
              data-biq-delay={index}
            >
              <div className="biq-portal-visual" aria-hidden="true">
                <span className="biq-portal-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={icon} />
                  </svg>
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/product/portal-${key}.webp`} alt="" decoding="async" />
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
              <ReleaseTimestamp updatedAt={releaseUpdates?.[key === 'owner' ? 'broker' : key]} />
              <span className="biq-portal-action">
                {action} <span aria-hidden="true">{key === 'android' ? '↓' : '↗'}</span>
              </span>
            </a>
          ))}
        </section>
        <section id="platform" className="biq-section biq-wrap" tabIndex={-1}>
          <div className="biq-section-heading" data-biq-reveal>
            <div>
              <p className="biq-eyebrow">A LITTLE MORE CLARITY. EVERY DAY.</p>
              <h2>
                Property work,
                <br />
                <em>beautifully connected.</em>
              </h2>
            </div>
            <p>From the first search to the next site visit, keep the important things close and the next step clear.</p>
          </div>
          <div className="biq-workflows">
            {workflows.map(([n, title, text], index) => (
              <article key={n} data-biq-reveal data-biq-delay={index}>
                <span className="biq-number">{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="biq-card-line" />
              </article>
            ))}
          </div>
        </section>
        <section id="android" className="biq-section biq-wrap biq-mobile" tabIndex={-1}>
          <div data-biq-reveal>
            <p className="biq-eyebrow">YOUR DAY DOESN’T STAY AT A DESK.</p>
            <h2>
              Take the workspace.
              <br />
              <em>Leave the friction.</em>
            </h2>
            <p>Search localities, review property information and keep your next action in view. Broker drafts stay available when your connection doesn’t.</p>
            <div className="biq-actions">
              {apkUrl && (
                <a href={apkUrl} className="biq-button" download>
                  Download Android <span aria-hidden>↓</span>
                </a>
              )}
              <a href="/user" className="biq-secondary">
                Open User Portal →
              </a>
            </div>
          </div>
          <div className="biq-android-details">
            <h3>Install or update</h3>
            <p>Download the signed Android app, then open it and sign in with your existing account. Keep the installed app in place when upgrading.</p>
            <p>
              <a href="/guides">Read the broker setup guide →</a>
            </p>
            {checksum && (
              <details>
                <summary>Verify the APK checksum</summary>
                <code>{checksum}</code>
              </details>
            )}
          </div>
        </section>
        <section id="screenshots" className="biq-section biq-wrap" aria-labelledby="screenshots-title">
          <div className="biq-section-heading">
            <div>
              <p className="biq-eyebrow">PRODUCT TOUR</p>
              <h2 id="screenshots-title">
                See BrokerIQ <em>at work.</em>
              </h2>
            </div>
            <p>Explore the customer portal, broker workspace, Android app and Super Admin tools. Each screenshot shows its captured edition.</p>
          </div>
          {galleries.map(({ title, screenshots, mobile }) => (
            <section className="biq-gallery" key={title} aria-label={title}>
              <h3>{title}</h3>
              <div className={mobile ? 'biq-gallery-grid biq-gallery-phone' : 'biq-gallery-grid'}>
                {screenshots.map((shot) => (
                  <figure key={shot.src}>
                    <a href={shot.src} aria-label={`Open screenshot: ${shot.label}`}>
                      <img src={shot.src} alt={shot.label} loading="lazy" width={mobile ? 390 : 1400} height={mobile ? 844 : 860} />
                    </a>
                    <figcaption>
                      <strong>{shot.label}</strong>
                      <span>{shot.caption}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </section>
        <section id="support" className="biq-section biq-wrap" aria-labelledby="support-title">
          <div className="biq-section-heading">
            <div>
              <p className="biq-eyebrow">GUIDES & SUPPORT</p>
              <h2 id="support-title">
                Find your <em>next step.</em>
              </h2>
            </div>
            <p>
              Download Hindi or English guides for Broker Admins, Agents and Super Admins. For account, privacy or service questions, contact BrokerIQ support.
            </p>
          </div>
          <div className="biq-support-grid">
            <article>
              <h3>Learn the workspace</h3>
              <p>Sign-in, leads, inventory, Inbox and administration.</p>
              <a href="/guides">Open user guides →</a>
            </article>
            <article>
              <h3>Get help</h3>
              <p>Help with your account, listing or firm setup.</p>
              <a href="/help">Help centre →</a> <a href="/contact">Contact →</a>
            </article>
            <article>
              <h3>Your data and account</h3>
              <p>Read the policies and learn how to request account deletion.</p>
              <a href="/p/terms">Terms</a> · <a href="/p/privacy">Privacy</a> · <a href="/account-deletion">Account deletion</a>
            </article>
          </div>
        </section>
        <section className="biq-wrap">
          <div className="biq-cta" data-biq-reveal>
            <p className="biq-eyebrow">YOUR NEXT MOVE STARTS HERE.</p>
            <h2>
              A place to find.
              <br />A business to grow.
            </h2>
            <div className="biq-actions">
              <a href="/user" className="biq-button">
                Find a rental ↗
              </a>
              <a href="/login?next=/broker" className="biq-secondary">
                Open your workspace →
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="biq-footer">
        <div className="biq-wrap">
          <div className="biq-footer-top">
            <div data-biq-reveal>
              <a className="biq-logo" data-no-i18n href="/">
                <img src="/icon.svg" alt="" width="38" height="38" />
                Broker<span>IQ</span>
              </a>
              <p>
                Your property journey.
                <br />
                Your next possibility.
              </p>
            </div>
            <nav aria-label="Footer portals" data-biq-reveal data-biq-delay="1">
              <strong>Explore</strong>
              <a href="/user">User Portal</a>
              <a href="/login?next=/broker">Broker Portal</a>
              <a href="/owner">Owner Portal</a>
              <a href="/login?next=/admin">Admin Login</a>
              {apkUrl && (
                <a href={apkUrl} download>
                  Android App ↗
                </a>
              )}
            </nav>
            <nav aria-label="Footer information" data-biq-reveal data-biq-delay="2">
              <strong>Information</strong>
              <a href="/guides">User guides</a>
              <a href="/help">Help & support</a>
              <a href="/contact">Contact</a>
              {contact?.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
              {contact?.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
              <a href="/p/privacy">Privacy policy</a>
              <a href="/p/terms">Terms of use</a>
              <a href="/account-deletion">Account deletion</a>
            </nav>
          </div>
          <div className="biq-wordmark" aria-hidden="true" data-biq-reveal>
            <span className="biq-wordmark-text">
              <span className="biq-wordmark-name">Broker</span>
              <span className="biq-wordmark-iq">IQ</span>
              <span className="biq-wordmark-dot">↗</span>
            </span>
          </div>
          <div className="biq-footer-bottom">
            <span>© {new Date().getFullYear()} BrokerIQ</span>
            <span>
              {BROKERIQ_COMPANY.name} · CIN {BROKERIQ_COMPANY.cin}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
const styles = `

.biq-landing{background:var(--bg,#f7f8fc);color:var(--fg,#0f172a);font-family:var(--font-inter),Arial,sans-serif;line-height:1.6;overflow:clip}
.biq-landing *{box-sizing:border-box}
.biq-landing a{text-decoration:none;color:inherit}
.biq-landing a:focus-visible{outline:3px solid var(--biq-accent);outline-offset:5px}
.biq-wrap{width:min(1320px,100%);padding-inline:40px;margin-inline:auto}
.biq-nav{height:96px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.biq-logo{display:inline-flex;gap:10px;align-items:center;font-family:var(--font-jakarta),sans-serif;font-size:25px;font-weight:800;letter-spacing:-1px;white-space:nowrap}
.biq-logo>span{color:var(--biq-accent);margin-left:-10px}
.biq-preferences{display:flex;align-items:center;gap:4px;flex-shrink:0}
.biq-preferences button{flex-shrink:0}
.biq-nav nav{display:flex;align-items:center;gap:30px;font-size:14px;font-weight:600}
.biq-button,.biq-secondary{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:12px 20px;border-radius:14px;font-size:14px;font-weight:650;transition:transform .22s,box-shadow .22s}
.biq-button{background:var(--action-gradient,linear-gradient(145deg,#6728ed,#3e10ba));color:white!important;box-shadow:var(--action-primary-shadow,0 3px 7px #4818c638)}
.biq-button:hover{transform:translateY(-2px);box-shadow:0 12px 28px #4f46e530}
.biq-secondary{border:1px solid var(--action-line,#dfe0ee);background:var(--surface,#fff);box-shadow:var(--action-shadow,0 2px 4px #0f172a0f)}
.biq-hero{position:relative;display:grid;grid-template-columns:1.03fr 1.1fr;gap:34px;align-items:center;padding-block:64px 80px}
.biq-hero-copy{position:relative;z-index:1}
.biq-eyebrow{font-size:10px;letter-spacing:2px;font-weight:750;display:flex;align-items:center;gap:9px}
.biq-eyebrow>span{width:7px;height:7px;border-radius:50%;background:var(--biq-accent)}
.biq-landing h1,.biq-landing h2,.biq-landing h3{font-family:var(--font-jakarta),sans-serif;line-height:1.12}
.biq-hero h1{font-size:clamp(42px,5vw,68px);letter-spacing:-3px;margin:24px 0}
.biq-landing em{font-style:normal;color:var(--biq-brand)}
.biq-intro{max-width:470px;color:var(--muted,#475569);font-size:16px;line-height:1.8}
.biq-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
.biq-small{font-size:11px;color:var(--muted,#475569);margin-top:22px}
.biq-hero-art{position:relative;margin:0;border-radius:32px;isolation:isolate;perspective:1000px}
.biq-hero-art>img{display:block;width:100%;height:520px;object-fit:cover;object-position:65% center;border-radius:32px;box-shadow:0 30px 80px -40px #312e8180}
.biq-hero-art figcaption{position:absolute;bottom:22px;left:20px;right:20px;border:1px solid #fff6;background:#ffffffd9;backdrop-filter:blur(18px);color:#312e81;padding:16px 20px;border-radius:16px;font-size:12px;font-weight:600}
.biq-art-label{position:absolute;right:-8px;top:32px;border:1px solid var(--line,#e4e7f0);border-radius:12px;padding:10px 16px;background:var(--surface,#fff);font-size:10px;box-shadow:0 8px 25px #312e8110;animation:biq-float 6s ease-in-out infinite}
.biq-portals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.biq-portal-card{
  position:relative;display:flex;flex-direction:column;align-items:stretch;
  isolation:isolate;overflow:hidden;padding:18px 24px 24px;border-radius:28px;
  border:1px solid var(--portal-border);background:linear-gradient(150deg,var(--portal-wash),transparent 56%),radial-gradient(ellipse 120% 90% at 100% 0%,var(--portal-glow),transparent 70%),var(--surface,#fff);
  box-shadow:inset 0 0 0 1px #ffffff9e,0 16px 30px -18px var(--portal-shadow),0 3px 4px -2px var(--portal-border);
  transition:transform .25s,border-color .25s,box-shadow .25s
}
.biq-portal-card:before{content:'';position:absolute;z-index:-1;top:-90px;left:-45px;width:90%;height:144px;transform:rotate(-18deg);border-radius:0 0 80% 58%;background:#fff8;pointer-events:none}
.biq-portal-card--user{--portal-wash:#f0e9ff;--portal-glow:#cbb7fa;--portal-border:#d9c9fc;--portal-shadow:#6b4bbb6b;--portal-ink:#3611bf;--portal-badge:#f2eaff;--portal-action:#e9dffc}
.biq-portal-card--broker{--portal-wash:#fff0e4;--portal-glow:#e0c8fb;--portal-border:#e9d2f1;--portal-shadow:#9862b861;--portal-ink:#a63200;--portal-badge:#fff2e5;--portal-action:#ffecd9}
.biq-portal-card--owner{--portal-wash:#e3faf0;--portal-glow:#b9ebd5;--portal-border:#c4e9d9;--portal-shadow:#32785d61;--portal-ink:#076124;--portal-badge:#ecfbf3;--portal-action:#d9f5e6}
.biq-portal-card--android{--portal-wash:#eaf0ff;--portal-glow:#c7cefb;--portal-border:#cbd3fb;--portal-shadow:#575fba70;--portal-ink:#3125b5;--portal-badge:#f3f4ff;--portal-action:#e2e2fc}
.biq-portal-card:hover{transform:translateY(-3px);box-shadow:inset 0 0 0 1px #ffffffbb,0 20px 34px -17px var(--portal-shadow)}
.biq-portal-visual{position:relative;height:113px;display:flex;align-items:center;min-width:0}
.biq-portal-visual img{position:absolute;right:-5px;top:-9px;width:72%;height:125px;object-fit:contain;object-position:right bottom;pointer-events:none}
.biq-portal-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;border:1px solid var(--portal-border);background:var(--portal-badge);color:var(--portal-ink);box-shadow:inset 0 0 0 1px #fff9,0 6px 8px -6px var(--portal-shadow)}
.biq-portal-icon svg{width:25px;height:25px}
.biq-portal-card h2{font-size:clamp(19px,1.65vw,24px);letter-spacing:-.8px;font-weight:800;margin:3px 0 9px}
.biq-portal-card p{color:var(--muted,#475569);font-size:14px;line-height:1.4;margin:0 0 8px;flex:1}
.biq-release-updated{display:block;font-size:11px;line-height:1.5;color:var(--muted,#475569)}
.biq-portal-action{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--portal-action);color:var(--portal-ink);margin-top:14px;padding:8px 10px;min-height:40px;border-radius:13px;font-size:14px;font-weight:700;text-align:center}
.biq-portal-action>span{transition:translate .2s}
.biq-portal-card:hover .biq-portal-action>span,.biq-portal-card:focus-visible .biq-portal-action>span{translate:2px -2px}
.biq-portal-card--android:is(:hover,:focus-visible) .biq-portal-action>span{translate:0 2px}
.dark .biq-portal-card{background:linear-gradient(145deg,color-mix(in srgb,var(--portal-glow) 19%,var(--surface)),var(--surface) 66%);border-color:color-mix(in srgb,var(--portal-border) 30%,var(--surface));box-shadow:0 12px 24px -12px #0009}
.dark .biq-portal-card:before{background:#fff1}
.biq-section{padding-block:96px}
.biq-section-heading{display:flex;justify-content:space-between;align-items:end;gap:40px;margin-bottom:36px}
.biq-section h2{font-size:clamp(30px,3.5vw,46px);letter-spacing:-1.8px;margin:16px 0}
.biq-section-heading>p{font-size:14px;max-width:360px;color:var(--muted,#475569)}
.biq-workflows{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.biq-workflows article{position:relative;padding:28px 24px 32px;border:1px solid var(--line,#e4e7f0);border-radius:22px;background:var(--surface,#fff);overflow:hidden}
.biq-number{display:block;font-family:var(--font-jakarta);font-size:36px;letter-spacing:-2px;color:var(--biq-brand);opacity:.5;margin-bottom:30px}
.biq-workflows h3{font-size:19px;letter-spacing:-.5px;line-height:1.4}
.biq-workflows p{font-size:12px;color:var(--muted,#475569);line-height:1.8}
.biq-card-line{position:absolute;left:24px;bottom:0;width:48px;height:3px;background:var(--biq-accent)}
.biq-mobile{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;border-top:1px solid var(--line,#e4e7f0)}
.biq-mobile>div>p:not(.biq-eyebrow){font-size:14px;max-width:420px;color:var(--muted,#475569)}
.biq-android-details,.biq-support-grid article{padding:24px;border:1px solid var(--line,#e4e7f0);border-radius:20px;background:var(--surface,#fff)}
.biq-android-details h3,.biq-support-grid h3{font-size:19px;font-weight:800}
.biq-android-details p,.biq-support-grid p{margin:8px 0 12px;color:var(--muted,#475569);line-height:1.6}
.biq-android-details code{display:block;overflow-wrap:anywhere;font-size:11px;margin-top:8px}
.biq-android-details a,.biq-support-grid a{font-weight:700;text-decoration:underline;text-underline-offset:3px}
.biq-gallery{margin-top:32px}
.biq-gallery h3{font-size:22px;font-weight:800;margin:0 0 14px}
.biq-gallery-grid,.biq-support-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px}
.biq-gallery-phone{grid-template-columns:repeat(auto-fit,minmax(min(100%,185px),1fr))}
.biq-gallery figure{margin:0;min-width:0;overflow:hidden;border:1px solid var(--line,#e4e7f0);border-radius:18px;background:var(--surface,#fff)}
.biq-gallery figure a{display:block;background:var(--surface-2,#f3f4fa)}
.biq-gallery img{display:block;width:100%;height:auto;aspect-ratio:1400 / 860;object-fit:contain}
.biq-gallery-phone img{aspect-ratio:390 / 844;max-height:440px}
.biq-gallery figcaption{display:grid;gap:4px;padding:14px;font-size:13px}
.biq-gallery figcaption span{color:var(--muted,#475569);font-size:11px}
.biq-cta{border-radius:28px;padding:56px;background:linear-gradient(125deg,#1e1b4b,#4338ca);color:white;position:relative;overflow:hidden;margin-bottom:80px}
.biq-cta:after{content:'';position:absolute;right:-70px;top:-80px;width:380px;height:380px;border:70px solid #ffffff08;border-radius:50%;pointer-events:none}
.biq-cta h2{font-size:clamp(32px,4vw,52px);letter-spacing:-1.8px;margin:20px 0}
.biq-cta .biq-button{background:var(--biq-accent);color:#0f172a!important}
.biq-cta .biq-secondary{color:white;background:#ffffff10;border-color:#ffffff30}
.biq-footer{background:#0e1222;color:#eef2ff;padding-top:64px}
.biq-footer-top{display:flex;justify-content:space-between;gap:40px}
.biq-footer-top p{font-size:13px;line-height:1.8;color:#a3adc4}
.biq-footer nav{display:flex;flex-direction:column;gap:12px;min-width:160px;font-size:12px}
.biq-footer nav strong{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#818cf8;margin-bottom:8px}
.biq-footer nav a{min-height:24px;color:#cbd5e1}
.biq-footer nav a:hover{color:white}
/* The arrow is absolute so only the brand text determines horizontal centering. */
.biq-wordmark{display:flex;justify-content:center;position:relative;font-family:var(--font-jakarta),sans-serif;font-weight:800;font-size:clamp(64px,15.5vw,208px);line-height:1.25;letter-spacing:-.065em;margin:56px 0 20px;padding:16px 28px 30px;white-space:nowrap}

.biq-wordmark-text{display:inline-flex;position:relative;width:max-content;isolation:isolate;padding-right:.065em}

.biq-wordmark-name,.biq-wordmark-iq{padding-right:.12em;margin-right:-.12em;background:linear-gradient(110deg,#818cf8 8%,#c7d2fe 30%,#fff 45%,#a5b4fc 60%,#818cf8 80%);background-size:300% 100%;background-clip:text;-webkit-background-clip:text;color:transparent;animation:biq-shine 6s linear infinite}

.biq-wordmark-iq{background-image:linear-gradient(110deg,#f59e0b 8%,#fbbf24 30%,#ffedb1 45%,#f59e0b 60%,#f59e0b 80%)}

.biq-wordmark-text:after{content:'';position:absolute;bottom:-10px;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#818cf880,#f59e0b80,transparent);transform:scaleX(.15);transition:transform 1.4s cubic-bezier(.2,.7,.2,1) .2s}

.biq-wordmark:not([data-biq-ready]) .biq-wordmark-text:after,.biq-wordmark[data-biq-visible] .biq-wordmark-text:after{transform:scaleX(1)}

.biq-wordmark-dot{position:absolute;right:-1em;top:.5em;font-size:.14em;line-height:1;color:#a5b4fc;letter-spacing:0;animation:biq-arrow 3s ease-in-out infinite}

.biq-footer-bottom{display:flex;justify-content:space-between;gap:20px;padding:22px 0;border-top:1px solid #ffffff15;font-size:10px;color:#a3adc4}
@keyframes biq-float{50%{transform:translateY(-8px)}
}
@keyframes biq-shine{from{background-position:150% 0}
to{background-position:-150% 0}
}

@keyframes biq-arrow{0%,100%{transform:translate(0,0);opacity:.6}
50%{transform:translate(5px,-5px);opacity:1}
}
/* Motion is opt-in after hydration; content is visible in the server HTML. */
.biq-landing [data-biq-reveal]{--biq-delay:0ms}
.biq-landing [data-biq-delay="1"]{--biq-delay:90ms}
.biq-landing [data-biq-delay="2"]{--biq-delay:180ms}
.biq-landing [data-biq-delay="3"]{--biq-delay:270ms}
.biq-landing [data-biq-ready]{transition:opacity .8s cubic-bezier(.2,.7,.2,1) var(--biq-delay),translate .8s cubic-bezier(.2,.7,.2,1) var(--biq-delay),transform .3s,border-color .3s,box-shadow .3s}
.biq-landing [data-biq-ready]:not([data-biq-visible]){opacity:0;translate:0 30px;will-change:opacity,translate}
.biq-landing [data-biq-visible]{opacity:1;translate:0 0}
.biq-scroll-progress{position:fixed;inset:0 0 auto;height:3px;background:linear-gradient(90deg,var(--biq-brand),#818cf8 65%,var(--biq-accent));transform:scaleX(var(--biq-progress,0));transform-origin:left;z-index:100;pointer-events:none}
.biq-section{scroll-margin-top:32px}
.biq-nav nav>a:not(.biq-button){position:relative;padding-block:12px}
.biq-nav nav>a:not(.biq-button):after{content:'';position:absolute;bottom:6px;left:0;right:0;height:2px;background:var(--biq-accent);transform:scaleX(0);transform-origin:left;transition:transform .25s}
.biq-nav nav>a:hover:after,.biq-nav nav>a:focus-visible:after{transform:scaleX(1)}
.biq-button:active,.biq-secondary:active{transform:translateY(0) scale(.98)}
.biq-secondary:hover{border-color:var(--biq-brand);transform:translateY(-2px);box-shadow:0 8px 22px #4f46e510}
.biq-button>span,.biq-secondary>span{transition:transform .25s}
.biq-button:hover>span,.biq-secondary:hover>span{transform:translate(3px,-2px)}
.biq-hero-art>img{transition:transform .7s cubic-bezier(.2,.7,.2,1),box-shadow .7s}
.biq-hero-art:hover>img{transform:perspective(1000px) rotateY(-2deg) scale(1.015);box-shadow:0 36px 90px -40px #312e8190}
.biq-workflows article{transition:transform .3s,border-color .3s,box-shadow .3s}
.biq-workflows article:hover{transform:translateY(-5px);border-color:#818cf880;box-shadow:0 18px 36px -24px #4f46e540}
.biq-card-line{transition:width .4s}
.biq-workflows article:hover .biq-card-line{width:calc(100% - 48px)}
.biq-cta{background-size:180% 180%}
.biq-cta:after{animation:biq-orbit 9s ease-in-out infinite}
.biq-footer{position:relative;border-top:1px solid #818cf81a;background:radial-gradient(ellipse at 50% 100%,#4f46e514,transparent 65%),#0e1222}
.biq-footer nav{gap:4px}
.biq-footer nav a{display:flex;align-items:center;min-height:44px;position:relative;transition:color .2s,translate .2s}
.biq-footer nav a:hover{translate:3px 0;color:#fff}
@keyframes biq-orbit{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-20px,16px) scale(1.06)}}
@media(hover:none){.biq-hero-art:hover>img,.biq-workflows article:hover,.biq-portal-card:hover,.biq-button:hover,.biq-secondary:hover{transform:none}}
@media(max-width:1050px){.biq-nav nav>a:not(.biq-button){display:none}
.biq-nav nav{gap:12px}
.biq-wrap{padding-inline:28px}
.biq-hero h1{letter-spacing:-2px}
.biq-hero-art>img{height:440px}
.biq-workflows{grid-template-columns:repeat(2,1fr)}
.biq-portals{grid-template-columns:repeat(2,minmax(0,1fr))}
.biq-mobile{gap:32px}
}
@media(max-width:700px){.biq-wrap{padding-inline:20px}
.biq-nav{height:80px}
.biq-nav nav{gap:12px}
.biq-nav nav>a:not(.biq-button){display:none}
.biq-nav .biq-button{font-size:11px;padding:10px 12px;gap:8px}
.biq-logo{font-size:21px}
.biq-logo img{width:32px;height:32px}
.biq-hero{grid-template-columns:1fr;gap:32px;padding-block:30px 40px}
.biq-hero h1{font-size:46px}
.biq-hero-art>img{height:330px}
.biq-art-label{right:10px;font-size:9px}
.biq-intro{font-size:14px}
.biq-portals{grid-template-columns:1fr}
.biq-portal-card{padding:16px 20px 20px}
.biq-portal-visual{height:104px}
.biq-portal-visual img{height:116px}
.biq-section{padding-block:56px}
.biq-section-heading{display:block}
.biq-workflows{gap:12px}
.biq-workflows article{padding:20px 16px}
.biq-workflows h3{font-size:16px}
.biq-number{margin-bottom:18px}
.biq-mobile{grid-template-columns:1fr}
.biq-cta{padding:30px 24px;margin-bottom:48px}
.biq-footer-top{flex-wrap:wrap;gap:28px}
.biq-footer-top>div{width:100%}
.biq-footer nav{min-width:130px}
.biq-wordmark{font-size:16vw;margin-top:32px}
.biq-footer-bottom{flex-wrap:wrap}
.biq-footer{padding-top:40px}
}
@media(max-width:480px){.biq-nav{gap:8px}.biq-nav nav{gap:8px}.biq-nav-cta-label{display:none}.biq-nav .biq-button{padding:10px}.biq-preferences>button{width:36px;height:36px}}
@media(prefers-reduced-motion:reduce){.biq-landing *,.biq-landing *:before,.biq-landing *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
.biq-landing [data-biq-ready]{opacity:1!important;translate:none!important}
.biq-scroll-progress{display:none}
}

`;
