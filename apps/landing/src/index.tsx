import { BRAND } from '@brokeriq/shared';
import { LandingMotion } from './landing-motion';

const workflows = [
  ['01', 'Your inventory. In order.', 'Houses, floors, contacts and source records stay connected. Find the right option without losing the details.'],
  ['02', 'Every enquiry has a next step.', 'Bring requirements, follow-ups and site visits into one working day.'],
  ['03', 'Capture now. Review with confidence.', 'Turn shared messages, images and registers into records you can check before using.'],
  ['04', 'A clearer view of your business.', 'Real activity, useful trends and visible connection status across web and Android.'],
];
function ReleaseTimestamp({ updatedAt }: { updatedAt?: string }) {
  if (!updatedAt) return null;
  const formatted = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  }).format(new Date(updatedAt));
  return <time className="biq-release-updated" dateTime={updatedAt}>Updated · {formatted} IST</time>;
}
export function BrokerIQLanding({
  apkUrl,
  contact,
  screenshots = [],
  releaseUpdates,
}: {
  apkUrl?: string;
  contact?: { email?: string; phone?: string; address?: string };
  checksum?: string;
  screenshots?: { src: string; label: string; caption?: string }[];
  releaseUpdates?: { user: string; broker: string; android: string };
}) {
  return (
    <div className="biq-landing" style={{ '--biq-brand': BRAND.primary, '--biq-accent': BRAND.accent } as React.CSSProperties}>
      <style>{styles}</style>
      <LandingMotion />
      <div className="biq-scroll-progress" aria-hidden="true" />
      <header className="biq-nav biq-wrap">
        <a className="biq-logo" href="/" aria-label="BrokerIQ home">
          <img src="/icon.svg" alt="" width="38" height="38" />
          Broker<span>IQ</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="/user">Find a property</a>
          <a href="/login?next=/broker" className="biq-button">
            Broker workspace <span aria-hidden>↗</span>
          </a>
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
          <a href="/user" data-biq-reveal>
            <span className="biq-portal-icon">⌂</span>
            <div>
              <small>FOR YOUR NEXT HOME</small>
              <h2>User Portal</h2>
              <p>Discover, shortlist and enquire.</p>
              <ReleaseTimestamp updatedAt={releaseUpdates?.user} />
            </div>
            <span aria-hidden>↗</span>
          </a>
          <a href="/login?next=/broker" data-biq-reveal data-biq-delay="1">
            <span className="biq-portal-icon">▦</span>
            <div>
              <small>FOR YOUR WORKING DAY</small>
              <h2>Broker Portal</h2>
              <p>Your inventory and conversations.</p>
              <ReleaseTimestamp updatedAt={releaseUpdates?.broker} />
            </div>
            <span aria-hidden>↗</span>
          </a>
          <a href={apkUrl || '#android'} data-biq-reveal data-biq-delay="2">
            <span className="biq-portal-icon">↓</span>
            <div>
              <small>WHEREVER WORK TAKES YOU</small>
              <h2>Android App</h2>
              <p>One app. User and Broker modes.</p>
              <ReleaseTimestamp updatedAt={releaseUpdates?.android} />
            </div>
            <span aria-hidden>↗</span>
          </a>
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
          <div className="biq-screens" data-biq-reveal data-biq-delay="1">
            {screenshots.slice(0, 2).map((s) => (
              <figure key={s.src}>
                <img src={s.src} alt={s.label} loading="lazy" width="390" height="844" />
                {s.caption && <figcaption>{s.caption}</figcaption>}
              </figure>
            ))}
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
              <a className="biq-logo" href="/">
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
              <a href="/login?next=/admin">Admin Login</a>
              {apkUrl && (
                <a href={apkUrl} download>
                  Android App ↗
                </a>
              )}
            </nav>
            <nav aria-label="Footer information" data-biq-reveal data-biq-delay="2">
              <strong>Information</strong>
              <a href="/help">Help & support</a>
              <a href="/contact">Contact</a>
              {contact?.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
              {contact?.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
              <a href="/p/privacy">Privacy policy</a>
              <a href="/p/terms">Terms of use</a>
            </nav>
          </div>
          <div className="biq-wordmark" aria-hidden="true" data-biq-reveal>
            <span className="biq-wordmark-text">
              <span className="biq-wordmark-name">Broker</span><span className="biq-wordmark-iq">IQ</span>
              <span className="biq-wordmark-dot">↗</span>
            </span>
          </div>
          <div className="biq-footer-bottom">
            <span>© {new Date().getFullYear()} BrokerIQ</span>
            <span>Made for Gurugram. Built around you.</span>
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
.biq-nav nav{display:flex;align-items:center;gap:30px;font-size:14px;font-weight:600}
.biq-button,.biq-secondary{display:inline-flex;align-items:center;justify-content:center;gap:24px;min-height:48px;padding:13px 22px;border-radius:14px;font-size:14px;font-weight:650;transition:transform .22s,box-shadow .22s}
.biq-button{background:var(--biq-brand);color:white!important;box-shadow:0 8px 22px #4f46e51a}
.biq-button:hover{transform:translateY(-2px);box-shadow:0 12px 28px #4f46e530}
.biq-secondary{border:1px solid var(--line,#e4e7f0);background:var(--surface,#fff)}
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
.biq-portals{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.biq-portals>a{display:flex;align-items:center;gap:16px;border:1px solid var(--line,#e4e7f0);background:var(--surface,#fff);padding:24px;border-radius:20px;transition:transform .2s,border-color .2s}
.biq-portals>a:hover{transform:translateY(-4px);border-color:var(--biq-brand)}
.biq-portals>a>span:last-child{margin-left:auto;color:var(--biq-brand)}
.biq-portal-icon{display:grid;place-items:center;width:44px;height:44px;flex-shrink:0;border-radius:14px;color:var(--biq-brand);background:#4f46e510;font-size:24px}
.biq-portals small{font-size:8px;letter-spacing:1px;color:var(--muted,#475569)}
.biq-portals h2{font-size:17px;margin:6px 0}
.biq-portals p{font-size:11px;color:var(--muted,#475569);margin:0}
.biq-release-updated{display:block;margin-top:10px;font-size:10px;line-height:1.6;color:var(--muted,#475569)}
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
.biq-screens{display:flex;gap:16px;align-items:center;padding:20px;background:radial-gradient(ellipse,#4f46e514,transparent 70%)}
.biq-screens figure{margin:0;max-width:46%;transform:rotate(-4deg)}
.biq-screens figure+figure{transform:rotate(5deg) translateY(20px)}
.biq-screens img{display:block;width:100%;height:auto;border:6px solid var(--surface,#fff);border-radius:24px;box-shadow:0 24px 48px -24px #312e8170}
.biq-screens figcaption{font-size:10px;text-align:center;color:var(--muted,#475569);margin-top:14px;line-height:1.6}
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
.biq-button>span,.biq-secondary>span,.biq-portals>a>span:last-child{transition:transform .25s}
.biq-button:hover>span,.biq-secondary:hover>span,.biq-portals>a:hover>span:last-child{transform:translate(3px,-2px)}
.biq-hero-art>img{transition:transform .7s cubic-bezier(.2,.7,.2,1),box-shadow .7s}
.biq-hero-art:hover>img{transform:perspective(1000px) rotateY(-2deg) scale(1.015);box-shadow:0 36px 90px -40px #312e8190}
.biq-workflows article{transition:transform .3s,border-color .3s,box-shadow .3s}
.biq-workflows article:hover{transform:translateY(-5px);border-color:#818cf880;box-shadow:0 18px 36px -24px #4f46e540}
.biq-card-line{transition:width .4s}
.biq-workflows article:hover .biq-card-line{width:calc(100% - 48px)}
.biq-screens figure{transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.biq-screens figure:hover{transform:rotate(0deg) translateY(-6px)}
.biq-cta{background-size:180% 180%}
.biq-cta:after{animation:biq-orbit 9s ease-in-out infinite}
.biq-footer{position:relative;border-top:1px solid #818cf81a;background:radial-gradient(ellipse at 50% 100%,#4f46e514,transparent 65%),#0e1222}
.biq-footer nav{gap:4px}
.biq-footer nav a{display:flex;align-items:center;min-height:44px;position:relative;transition:color .2s,translate .2s}
.biq-footer nav a:hover{translate:3px 0;color:#fff}
@keyframes biq-orbit{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-20px,16px) scale(1.06)}}
@media(hover:none){.biq-hero-art:hover>img,.biq-workflows article:hover,.biq-portals>a:hover,.biq-button:hover,.biq-secondary:hover{transform:none}}
@media(max-width:1050px){.biq-wrap{padding-inline:28px}
.biq-hero h1{letter-spacing:-2px}
.biq-hero-art>img{height:440px}
.biq-workflows{grid-template-columns:repeat(2,1fr)}
.biq-portals>a{padding:18px;gap:10px}
.biq-portals small{font-size:7px}
.biq-portal-icon{display:none}
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
.biq-portal-icon{display:grid}
.biq-portals small{font-size:8px}
.biq-section{padding-block:56px}
.biq-section-heading{display:block}
.biq-workflows{gap:12px}
.biq-workflows article{padding:20px 16px}
.biq-workflows h3{font-size:16px}
.biq-number{margin-bottom:18px}
.biq-mobile{grid-template-columns:1fr}
.biq-screens{max-width:400px;margin:auto}
.biq-cta{padding:30px 24px;margin-bottom:48px}
.biq-footer-top{flex-wrap:wrap;gap:28px}
.biq-footer-top>div{width:100%}
.biq-footer nav{min-width:130px}
.biq-wordmark{font-size:16vw;margin-top:32px}
.biq-footer-bottom{flex-wrap:wrap}
.biq-footer{padding-top:40px}
}
@media(prefers-reduced-motion:reduce){.biq-landing *,.biq-landing *:before,.biq-landing *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
.biq-landing [data-biq-ready]{opacity:1!important;translate:none!important}
.biq-scroll-progress{display:none}
}

`;
