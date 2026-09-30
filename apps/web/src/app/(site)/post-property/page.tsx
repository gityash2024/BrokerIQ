'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, Eye, Plus } from 'lucide-react';
import { PageShell } from '@/components/site/page-shell';
import { RequireAuth } from '@/components/site/require-auth';
import { ListingForm } from '@/components/site/listing-form';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export default function PostPropertyPage() {
  const { isBroker } = useAuth();
  const router = useRouter();
  const [done, setDone] = useState<any>(null);
  useEffect(() => {
    if (isBroker) router.replace('/broker/listings/new');
  }, [isBroker, router]);
  return (
    <PageShell>
      <RequireAuth>
        <div className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100/70 to-transparent dark:from-brand-500/10" />
          <div className="container-x relative py-10">
            {done ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card mx-auto max-w-xl p-10 text-center">
                <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                  {done.status === 'ACTIVE' ? (
                    <CheckCircle2 className="mx-auto size-16 text-emerald-500" />
                  ) : (
                    <Clock className="mx-auto size-16 text-brand-600" />
                  )}
                </motion.div>
                <h1 className="mt-4 font-display text-2xl font-extrabold">
                  {done.status === 'ACTIVE' ? 'आपकी property live है! 🎉' : done.status === 'DRAFT' ? 'Draft save हो गया' : 'Review के लिए भेज दी गई'}
                </h1>
                <p className="mt-2 text-muted">
                  {done.status === 'PENDING_REVIEW'
                    ? 'हमारी team जल्द ही check करेगी। Approve होते ही आपको notification मिलेगा।'
                    : 'Enquiries आपके dashboard और email पर आएँगी।'}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button href={`/property/${done.slug}`} variant="secondary">
                    <Eye className="size-4" /> Preview
                  </Button>
                  <Button href="/account/listings">My listings</Button>
                  <Button variant="ghost" onClick={() => setDone(null)}>
                    <Plus className="size-4" /> एक और post करें
                  </Button>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="mb-8 text-center">
                  <span className="inline-flex rounded-full bg-saffron-100 px-3 py-1 text-xs font-bold text-saffron-600 dark:bg-saffron-500/15">
                    100% FREE · NO BROKERAGE
                  </span>
                  <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">अपनी property post करें</h1>
                  <p className="mt-2 text-muted">5 आसान steps — हज़ारों verified buyers और tenants तक पहुँचें</p>
                </div>
                <ListingForm afterSave={setDone} />
              </>
            )}
          </div>
        </div>
      </RequireAuth>
    </PageShell>
  );
}
