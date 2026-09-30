'use client';
import { useEffect, useRef } from 'react';
import { useConfig } from '@/lib/config';

declare global {
  interface Window {
    google?: any;
  }
}

/** Google Identity Services button. Hidden when Google Sign-In isn't configured in Super Admin. */
export function GoogleButton({
  onCredential,
  text = 'continue_with',
}: {
  onCredential: (idToken: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}) {
  const { integrations, app } = useConfig();
  const g = integrations.google_oauth as any;
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const enabled = g?.configured && g.webClientId && app.auth.allowGoogle;

  useEffect(() => {
    if (!enabled) return;
    const render = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: g.webClientId, callback: (r: any) => cb.current(r.credential) });
      window.google.accounts.id.renderButton(ref.current, {
        theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
        size: 'large',
        shape: 'pill',
        text,
        width: ref.current.offsetWidth || 320,
      });
    };
    if (window.google) return render();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [enabled, g?.webClientId, text]);

  if (!enabled) return null;
  return (
    <>
      <div ref={ref} className="flex h-11 w-full justify-center" />
      <div className="my-5 flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" /> या <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
