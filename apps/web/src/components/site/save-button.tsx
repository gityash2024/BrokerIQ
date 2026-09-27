'use client';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function useSavedIds() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['saved-ids'], queryFn: () => api<string[]>('/listings/saved/ids'), enabled: !!user, staleTime: 60_000 });
}

export function SaveButton({ listingId, className, withLabel }: { listingId: string; className?: string; withLabel?: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useSavedIds();
  const saved = !!data?.includes(listingId);
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    qc.setQueryData<string[]>(['saved-ids'], (old = []) => (saved ? old.filter((x) => x !== listingId) : [...old, listingId]));
    try {
      await api(`/listings/${listingId}/save`, { method: saved ? 'DELETE' : 'POST' });
      if (!saved) toast.success('Shortlist में जोड़ दिया ❤️');
      qc.invalidateQueries({ queryKey: ['saved'] });
    } catch {
      qc.invalidateQueries({ queryKey: ['saved-ids'] });
    }
  };
  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      onClick={toggle}
      aria-label={saved ? 'Remove from shortlist' : 'Shortlist'}
      className={cn('inline-flex items-center gap-1.5 rounded-full bg-white/90 p-2 text-slate-700 shadow-md backdrop-blur transition hover:scale-105 dark:bg-slate-900/80 dark:text-slate-200', className)}
    >
      <Heart className={cn('size-[18px] transition', saved && 'fill-rose-500 text-rose-500')} />
      {withLabel && <span className="pr-1 text-sm font-semibold">{saved ? 'Saved' : 'Save'}</span>}
    </motion.button>
  );
}
