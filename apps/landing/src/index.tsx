const workflows = [
  ['01', 'Your property book, organised', 'Keep houses, floors and units separate. Search Gurgaon sectors, rent or sale, budget, room kind and availability.'],
  [
    '02',
    'A clear next step for every lead',
    'Save each client requirement separately. Match explicit budget, locality and property details; plan follow-ups and visits.',
  ],
  [
    '03',
    'From WhatsApp to a reviewed record',
    'Share, paste or upload a message, poster or chat export. Review the source and extracted details before adding them to your ledger.',
  ],
  ['04', 'Connections with visible results', 'Set up Housing lead sync and WhatsApp conversations. Enable automation deliberately and see execution history.'],
];
export function BrokerIQLanding({
  apkUrl,
  checksum,
  screenshots = [],
}: {
  apkUrl?: string;
  checksum?: string;
  screenshots?: { src: string; label: string }[];
}) {
  return (
    <div className="biq-landing">
      <style>{`
.biq-landing{--ink:#132e2b;--paper:#f6f5f0;--green:#215d4c;--lime:#e3eeab;background:var(--paper);color:var(--ink);font-family:Inter,Arial,sans-serif;line-height:1.55}.biq-landing *{box-sizing:border-box}.biq-landing a{color:inherit;text-decoration:none}.biq-wrap{max-width:1180px;margin:auto;padding:0 28px}.biq-nav{display:flex;align-items:center;justify-content:space-between;padding-top:25px;padding-bottom:25px;border-bottom:1px solid #132e2b22;gap:20px}.biq-logo{font-weight:800;letter-spacing:-1px;font-size:27px}.biq-logo span{display:inline-flex;align-items:center;justify-content:center;background:var(--green);color:white;width:38px;height:38px;border-radius:10px;font-size:17px;letter-spacing:0;margin-right:10px}.biq-links{display:flex;gap:24px;align-items:center;font-size:14px}.biq-button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 23px;border-radius:9px;background:var(--green);color:#fff!important;font-weight:700;font-size:14px}.biq-hero{display:grid;grid-template-columns:1.08fr 1fr;gap:68px;padding:90px 0 74px;align-items:center}.biq-eyebrow{font-size:12px;letter-spacing:2px;font-weight:700;text-transform:uppercase}.biq-hero h1{font-size:clamp(42px,5.5vw,72px);line-height:1.06;letter-spacing:-3px;margin:20px 0 25px}.biq-hero p{max-width:500px;font-size:17px;color:#526560}.biq-actions{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:28px}.biq-link{border:1px solid #132e2b30;border-radius:9px;padding:12px 20px;min-height:48px;font-weight:600;font-size:14px}.biq-note{font-size:12px!important;margin-top:18px!important}.biq-art{padding:34px;background:#dce5d8;border-radius:28px;transform:rotate(2deg)}.biq-book{background:var(--green);color:#fff;border-radius:16px;padding:30px;box-shadow:0 25px 50px #132e2b22}.biq-book h2{font-size:27px;margin:18px 0;letter-spacing:-.8px}.biq-path{margin-top:26px;border-left:1px solid #ffffff55;padding-left:24px;display:grid;gap:22px}.biq-path strong{display:block;font-size:15px}.biq-path small{color:#e5eddf;font-size:12px}.biq-pill{display:inline-block;background:var(--lime);color:var(--ink);font-size:11px;font-weight:700;border-radius:30px;padding:7px 12px}.biq-section{padding:66px 0;border-top:1px solid #132e2b22}.biq-section h2{font-size:clamp(30px,4vw,46px);line-height:1.18;letter-spacing:-1.4px;max-width:620px;margin:15px 0 28px}.biq-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}.biq-feature{border:1px solid #132e2b25;border-radius:16px;padding:29px;background:#fff9}.biq-number{color:#668f63;font-size:13px;font-weight:700}.biq-feature h3{font-size:21px;margin:15px 0 10px;letter-spacing:-.5px}.biq-feature p{font-size:14px;color:#526560;max-width:440px;margin:0}.biq-focus{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:start}.biq-tabs{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.biq-tabs span{padding:10px 15px;border-radius:8px;background:#e8ebe1;border:1px solid #132e2b18;font-size:13px}.biq-upcoming{font-size:13px;color:#526560}.biq-upcoming span{margin-right:10px}.biq-cta{background:var(--green);color:#fff;padding:45px;border-radius:20px;display:flex;align-items:center;justify-content:space-between;gap:25px;margin:24px 0 55px}.biq-cta h2{font-size:34px;line-height:1.2;margin:0 0 10px;letter-spacing:-1px}.biq-cta .biq-button{background:var(--lime);color:var(--ink)!important}.biq-footer{border-top:1px solid #132e2b22;padding:26px 0;display:flex;justify-content:space-between;gap:18px;font-size:12px;color:#526560}.biq-screens{display:flex;gap:20px;overflow:auto}.biq-screens figure{margin:0;flex:1;min-width:220px}.biq-screens img{width:100%;border:1px solid #132e2b20;border-radius:16px}.biq-screens figcaption{font-size:13px;margin-top:10px}@media(max-width:760px){.biq-wrap{padding:0 20px}.biq-links a:not(.biq-button){display:none}.biq-hero{grid-template-columns:1fr;gap:40px;padding:50px 0}.biq-hero h1{letter-spacing:-2px}.biq-art{padding:22px;transform:none}.biq-grid,.biq-focus{grid-template-columns:1fr}.biq-section{padding:45px 0}.biq-cta{padding:26px;align-items:start;flex-direction:column}.biq-footer{flex-direction:column}}@media(prefers-reduced-motion:reduce){.biq-art{transform:none}}
`}</style>
      <div className="biq-wrap">
        <header className="biq-nav">
          <a className="biq-logo" href="/" aria-label="BrokerIQ home">
            <span>BI</span>BrokerIQ
          </a>
          <nav className="biq-links" aria-label="Product">
            <a href="#workflows">How it works</a>
            <a href="#platform">Platform</a>
            <a className="biq-button" href="/login">
              Open your workspace ↗
            </a>
          </nav>
        </header>
        <main>
          <section className="biq-hero">
            <div>
              <div className="biq-eyebrow">Built for Gurgaon brokers</div>
              <h1>
                Less chasing.
                <br />
                More closing.
              </h1>
              <p>
                Your inventory, client requirements and daily follow-ups in one focused workspace. BrokerIQ brings your property book and conversations into a
                broker-first workflow.
              </p>
              <div className="biq-actions">
                <a className="biq-button" href="/login">
                  Open BrokerIQ ↗
                </a>
                {apkUrl ? (
                  <a className="biq-link" href={apkUrl} download>
                    Download Android ↓
                  </a>
                ) : (
                  <a className="biq-link" href="#platform">
                    Explore the app ↓
                  </a>
                )}
              </div>
              <p className="biq-note">Web + Android · हिंदी & English · Firm-managed accounts</p>
            </div>
            <div className="biq-art" aria-label="BrokerIQ workflow">
              <div className="biq-book">
                <span className="biq-pill">Your broker workspace</span>
                <h2>
                  One place.
                  <br />A clearer working day.
                </h2>
                <div className="biq-path">
                  <div>
                    <strong>Capture a property or requirement</strong>
                    <small>Register, WhatsApp, poster or direct entry</small>
                  </div>
                  <div>
                    <strong>Review the details</strong>
                    <small>Keep the source. Confirm what is missing.</small>
                  </div>
                  <div>
                    <strong>Find the right options</strong>
                    <small>Locality, budget, unit and availability</small>
                  </div>
                  <div>
                    <strong>Follow up and arrange a visit</strong>
                    <small>A clear next step for every client</small>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section id="workflows" className="biq-section">
            <div className="biq-eyebrow">A practical broker operating system</div>
            <h2>
              From scattered information
              <br />
              to work you can act on.
            </h2>
            <div className="biq-grid">
              {workflows.map(([n, title, body]) => (
                <article className="biq-feature" key={n}>
                  <span className="biq-number">{n} / WORKFLOW</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>
          <section id="platform" className="biq-section biq-focus">
            <div>
              <div className="biq-eyebrow">Focused from the first tap</div>
              <h2>
                Five sections.
                <br />
                One working day.
              </h2>
              <p>
                Compact mobile cards, detailed property screens and a searchable web ledger. Save mobile drafts locally and see whether each operation is
                pending, synced or needs attention.
              </p>
              <div className="biq-tabs">
                {['Today', 'Inventory', 'Leads & Requirements', 'Inbox', 'Automation & Housing'].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
            <div>
              <h3>Built around your firm</h3>
              <p>
                Broker accounts access their own firm's records. Super Admin manages firms, module availability, integration credentials and system operations.
              </p>
              <p className="biq-upcoming">
                Housing and WhatsApp require your provider credentials and configuration. Group messages enter through Share, paste or chat export.
              </p>
              <h3>Coming later</h3>
              <p className="biq-upcoming">Deals & invoicing · Team & agents · Analytics · Co-broking network. These workflows stay disabled until released.</p>
              {apkUrl && (
                <>
                  <p>Android release</p>
                  <a className="biq-button" href={apkUrl} download>
                    Download signed APK ↓
                  </a>
                  {checksum && (
                    <p className="biq-upcoming" style={{ overflowWrap: 'anywhere' }}>
                      SHA256: {checksum}
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
          {screenshots.length > 0 && (
            <section className="biq-section">
              <div className="biq-eyebrow">Inside BrokerIQ</div>
              <h2>A look at the workspace.</h2>
              <div className="biq-screens">
                {screenshots.map((s) => (
                  <figure key={s.src}>
                    <img src={s.src} alt={s.label} loading="lazy" />
                    <figcaption>{s.label}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
          <section className="biq-cta">
            <div>
              <h2>
                Your property book.
                <br />
                Your next step.
              </h2>
              <p>Sign in with the account created for your firm.</p>
            </div>
            <a className="biq-button" href="/login">
              Go to your panel ↗
            </a>
          </section>
        </main>
        <footer className="biq-footer">
          <span>© {new Date().getFullYear()} BrokerIQ · Made for brokers.</span>
          <span>Gurgaon, India · Web & Android</span>
        </footer>
      </div>
    </div>
  );
}
