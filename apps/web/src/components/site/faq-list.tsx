'use client';
import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FaqList({ faqs }: { faqs: { id: string; question: string; answer: string; category?: string }[] }) {
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);
  return (
    <div className="space-y-3">
      {faqs.map((f) => (
        <div key={f.id} className="card overflow-hidden">
          <button className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold" onClick={() => setOpen(open === f.id ? null : f.id)}>
            {f.question}
            <ChevronDown className={cn('size-5 shrink-0 transition', open === f.id && 'rotate-180')} />
          </button>
          <motion.div initial={false} animate={{ height: open === f.id ? 'auto' : 0 }} className="overflow-hidden">
            <p className="px-5 pb-5 text-sm leading-6 whitespace-pre-line text-muted">{f.answer}</p>
          </motion.div>
        </div>
      ))}
    </div>
  );
}
