'use client';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Check, Languages } from 'lucide-react';
import { LANGUAGES } from '@brokeriq/shared';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Globe menu: English + 12 Indian languages; "Default" keeps the original Hindi/English mix. */
export function LanguagePicker({ className, light }: { className?: string; light?: boolean }) {
  const { lang, setLang } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang);
  return (
    <DM.Root>
      <DM.Trigger
        data-no-i18n
        aria-label="Language"
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold transition',
          light ? 'text-white/85 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-surface-2 hover:text-fg',
          className,
        )}
      >
        <Languages className="size-4" />
        <span className="hidden sm:inline">{current?.native ?? 'भाषा'}</span>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          data-no-i18n
          align="end"
          sideOffset={8}
          className="z-50 max-h-[70vh] w-56 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
        >
          <DM.Item
            onSelect={() => setLang(null)}
            className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2"
          >
            <span>Default (हिंग्लिश)</span>
            {!lang && <Check className="size-4 text-brand-600" />}
          </DM.Item>
          <DM.Separator className="my-1 h-px bg-line" />
          {LANGUAGES.map((l) => (
            <DM.Item
              key={l.code}
              onSelect={() => setLang(l.code)}
              className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2"
            >
              <span>
                {l.native} <span className="text-xs text-subtle">{l.code === 'en' ? '' : l.name}</span>
              </span>
              {lang === l.code && <Check className="size-4 text-brand-600" />}
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
