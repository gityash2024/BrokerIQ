'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, MoveVertical } from 'lucide-react';

export function ListJump({ totalPages = 1, page = 1, onPage }: { totalPages?: number; page?: number; onPage?: (page: number) => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const measure = () => setVisible(window.scrollY >= window.innerHeight * 1.75);
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);
  if (!visible) return null;

  function jump(to: 'top' | 'middle' | 'bottom') {
    const targetPage = to === 'top' ? 1 : to === 'middle' ? Math.ceil(totalPages / 2) : totalPages;
    if (onPage && targetPage !== page) {
      onPage(targetPage);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const end = document.documentElement.scrollHeight - window.innerHeight;
    const top = to === 'top' ? 0 : to === 'middle' ? end / 2 : end;
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  return <div aria-label="Jump in results" className="fixed bottom-20 right-4 z-20 grid gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-lg lg:bottom-6">
    {([{ key: 'top', label: 'Start of results', Icon: ArrowUpToLine },
      { key: 'middle', label: 'Middle of results', Icon: MoveVertical },
      { key: 'bottom', label: 'End of results', Icon: ArrowDownToLine }] as const).map(({ key, label, Icon }) =>
      <button key={key} type="button" title={label} aria-label={label} onClick={() => jump(key)}
        className="grid size-10 place-items-center rounded-xl text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">
        <Icon className="size-4" aria-hidden />
      </button>)}
  </div>;
}

const listingRoutes = new Set([
  '/broker/leads', '/broker/pipeline', '/broker/follow-ups', '/broker/visits', '/broker/inbox', '/broker/team',
  '/broker/listings', '/broker/deals', '/broker/invoices', '/broker/owners', '/broker/automations',
  '/user/search', '/user/account/saved', '/user/account/messages', '/owner',
  '/admin/team', '/admin/business', '/admin/organic/supply', '/admin/organic/demand', '/admin/organic/delivery', '/admin/organic/sources',
  '/blog', '/brokers', '/projects', '/localities',
]);

export function WorkspaceListJump() {
  const pathname = usePathname();
  return listingRoutes.has(pathname) ? <ListJump key={pathname} /> : null;
}
