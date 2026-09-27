import { SiteHeader } from './header';

export function PageShell({ children, transparentHeader }: { children: React.ReactNode; transparentHeader?: boolean }) {
  return (
    <>
      <SiteHeader transparent={transparentHeader} />
      <main>{children}</main>
    </>
  );
}

export function SectionTitle({ title, subtitle, action, className = '' }: { title?: string | null; subtitle?: string | null; action?: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div>
        {title && <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>}
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
