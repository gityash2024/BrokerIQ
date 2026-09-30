'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { Bug, Lightbulb, MessageSquareHeart, Sparkles, Star, ThumbsDown, Wrench, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Field, Input, Textarea } from '../ui/field';
import { PhotoUploader, type Photo } from '../site/photo-uploader';

const TYPES = [
  { v: 'FEATURE', l: 'नया feature', icon: Lightbulb, c: 'text-amber-500' },
  { v: 'BUG', l: 'Bug / problem', icon: Bug, c: 'text-rose-500' },
  { v: 'IMPROVEMENT', l: 'Improvement', icon: Wrench, c: 'text-sky-500' },
  { v: 'COMPLAINT', l: 'Complaint', icon: ThumbsDown, c: 'text-orange-500' },
  { v: 'GENERAL', l: 'General', icon: Sparkles, c: 'text-brand-500' },
] as const;

export function FeedbackForm({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [type, setType] = useState<string>('FEATURE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [shots, setShots] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/feedback', {
        method: 'POST',
        body: {
          type,
          title,
          description,
          rating,
          screenshots: shots.map((s) => s.url),
          platform: 'WEB',
          pageUrl: pathname,
          contactEmail: user ? undefined : email,
        },
      });
      toast.success('धन्यवाद! आपका feedback team तक पहुँच गया 🙏');
      setTitle('');
      setDescription('');
      setShots([]);
      onDone?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-5')}>
        {TYPES.map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setType(t.v)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-[11px] font-semibold transition',
              type === t.v ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'border-line hover:border-brand-300',
            )}
          >
            <t.icon className={cn('size-5', t.c)} />
            {t.l}
          </button>
        ))}
      </div>
      <Field label="Title" required>
        <Input
          required
          minLength={4}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === 'BUG' ? 'क्या गड़बड़ हुई?' : type === 'FEATURE' ? 'कौन-सा feature चाहिए?' : 'Short title'}
        />
      </Field>
      <Field label="Details" required>
        <Textarea
          required
          minLength={10}
          rows={compact ? 3 : 5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="जितना detail में लिखेंगे, उतनी जल्दी हम सुधार पाएँगे।"
        />
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold">BrokerIQ को कितने stars देंगे?</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} stars`}>
              <Star className={cn('size-7 transition hover:scale-110', rating && i <= rating ? 'fill-amber-400 text-amber-400' : 'text-line')} />
            </button>
          ))}
        </div>
      </div>
      {user && !compact && <PhotoUploader value={shots} onChange={setShots} max={5} kind="cms" />}
      {!user && (
        <Field label="आपका email (reply के लिए)" required>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      )}
      <Button type="submit" className="w-full" loading={loading}>
        Submit feedback
      </Button>
    </form>
  );
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith('/admin') || ['/login', '/signup', '/forgot'].includes(pathname) || pathname.startsWith('/property/')) return null;
  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 hidden items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl transition hover:scale-105 md:inline-flex dark:bg-white dark:text-slate-900"
      >
        <MessageSquareHeart className="size-5" /> Feedback
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="fixed right-4 bottom-4 z-50 max-h-[85dvh] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">आपकी राय ज़रूरी है 💬</h3>
                  <p className="text-sm text-muted">
                    Bug, नया feature या सुझाव —{' '}
                    <a href="/feedback" className="text-brand-600">
                      public roadmap
                    </a>{' '}
                    देखें
                  </p>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2" aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>
              <FeedbackForm compact onDone={() => setOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
