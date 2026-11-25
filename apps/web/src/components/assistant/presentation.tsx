'use client';
import Link from 'next/link';
import { Check, ClipboardCheck, FileSearch, Mic, PenLine, RefreshCw, Sparkles } from 'lucide-react';
import { assistantBlocks, assistantInlineDestination, assistantPhaseText, type AssistantBlock, type AssistantPhase } from '@brokeriq/shared';
import { InlineLoader } from '@/components/ui/request-loader';

const icons = {
  understanding: Sparkles,
  retrieving: FileSearch,
  composing: PenLine,
  retrying: RefreshCw,
  confirming: ClipboardCheck,
  applying: Check,
  transcribing: Mic,
};

export function AssistantActivity({ phases, lang }: { phases: AssistantPhase[]; lang: string }) {
  return (
    <div
      className="w-full rounded-xl border border-brand-200/70 bg-brand-50/60 px-3 py-2.5 dark:border-brand-500/25 dark:bg-brand-500/10"
      role="status"
      aria-live="polite"
    >
      <ol className="space-y-1.5">
        {phases.map((phase, index) => {
          const Icon = icons[phase];
          const current = index === phases.length - 1;
          return (
            <li key={index} className={`flex items-center gap-2 text-xs ${current ? 'font-semibold text-fg' : 'text-muted'}`}>
              <Icon aria-hidden className="size-4 shrink-0 text-brand-600 dark:text-brand-300" />
              <span>{assistantPhaseText[phase][lang === 'hi' ? 'hi' : 'en']}</span>
              {current && <InlineLoader className="ml-auto size-4" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AssistantText({ content, cardUrls, staff, onNavigate }: { content: string; cardUrls: unknown[]; staff: boolean; onNavigate: () => void }) {
  const line = (parts: AssistantBlock['lines'][number]) =>
    parts.map(({ kind, text, url }, index) => {
      if (kind === 'bold') return <strong key={index}>{text}</strong>;
      if (kind === 'emphasis') return <em key={index}>{text}</em>;
      if (kind === 'code')
        return (
          <code key={index} className="rounded bg-surface px-1 font-mono text-xs">
            {text}
          </code>
        );
      const href = kind === 'link' && assistantInlineDestination(url, cardUrls, staff);
      if (href)
        return (
          <Link key={index} href={href} className="font-semibold text-brand-700 underline dark:text-brand-300" onClick={onNavigate}>
            {text}
          </Link>
        );
      return <span key={index}>{text}</span>;
    });
  return (
    <div className="min-w-0 space-y-2 break-words leading-relaxed">
      {assistantBlocks(content).map((block, index) => {
        if (block.kind === 'list') {
          const Element = block.start === null ? 'ul' : 'ol';
          return (
            <Element key={index} start={block.start ?? undefined} className={`space-y-1 pl-5 ${block.start === null ? 'list-disc' : 'list-decimal'}`}>
              {block.lines.map((parts, i) => (
                <li key={i}>{line(parts)}</li>
              ))}
            </Element>
          );
        }
        const Element = block.kind === 'heading' ? 'h3' : block.kind === 'quote' ? 'blockquote' : block.kind === 'code' ? 'pre' : 'p';
        const style =
          block.kind === 'heading'
            ? 'font-semibold'
            : block.kind === 'quote'
              ? 'border-l-2 border-brand-400 pl-2 text-muted'
              : block.kind === 'code'
                ? 'rounded bg-surface p-2 font-mono text-xs'
                : '';
        return (
          <Element key={index} className={`whitespace-pre-wrap ${style}`}>
            {block.lines.map((parts, i) => (
              <span key={i}>
                {i > 0 ? '\n' : ''}
                {line(parts)}
              </span>
            ))}
          </Element>
        );
      })}
    </div>
  );
}
