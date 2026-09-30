'use client';
import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-error';

/** Last-resort fallback when the root layout itself crashes (renders its own document, no app styles). */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest });
  }, [error]);
  return (
    <html lang="hi">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', background: '#F6F7FB', color: '#0F172A' }}>
        <title>BrokerIQ — कुछ गड़बड़ हो गई</title>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ maxWidth: 420 }}>
            <p style={{ fontSize: 40, margin: 0 }}>⚠️</p>
            <h1 style={{ fontSize: 24, margin: '12px 0 8px' }}>कुछ गड़बड़ हो गई</h1>
            <p style={{ color: '#475569', lineHeight: 1.5, margin: 0 }}>BrokerIQ अभी ठीक से नहीं खुल पाया। हमारी team को अपने-आप खबर मिल गई है।</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
              <button
                onClick={() => retry()}
                style={{ background: '#4F46E5', color: '#fff', border: 0, borderRadius: 12, padding: '12px 20px', fontWeight: 700, cursor: 'pointer' }}
              >
                दोबारा कोशिश करें
              </button>
              <a
                href="/"
                style={{ border: '1px solid #CBD5E1', borderRadius: 12, padding: '12px 20px', fontWeight: 700, color: '#0F172A', textDecoration: 'none' }}
              >
                Home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
