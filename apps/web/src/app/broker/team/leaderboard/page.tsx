'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trophy, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { TeamLeaderboardView } from '@/components/broker/team/team-leaderboard';

export default function TeamLeaderboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['broker-team'], queryFn: () => api<any>('/broker/team') });

  const members: any[] = q.data?.members ?? (Array.isArray(q.data) ? q.data : []);

  return (
    <>
      {/* Breadcrumbs & Back Navigation */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted">
          <Link href="/broker" className="hover:text-fg transition-colors">
            ब्रोकर वर्कस्पेस
          </Link>
          <span>/</span>
          <Link href="/broker/team" className="hover:text-fg transition-colors">
            टीम व एजेंट्स
          </Link>
          <span>/</span>
          <span className="font-bold text-fg flex items-center gap-1.5">
            <Trophy className="size-3.5 text-amber-500" /> टीम लीडरबोर्ड
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => router.push('/broker/team')}
          className="text-xs"
        >
          <ArrowLeft className="size-3.5 mr-1.5" /> टीम सूची पर लौटें
        </Button>
      </div>

      <PageHeader
        title="Team Leaderboard"
        subtitle="सर्वश्रेष्ठ प्रदर्शन, डील्स व टार्गेट पूर्ति के आधार पर रैंकिंग"
      />

      {q.isLoading ? (
        <Skeleton className="h-96 rounded-2xl mt-4" />
      ) : q.isError ? (
        <div className="mt-4">
          <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : members.length === 0 ? (
        <div className="mt-4">
          <Empty
            icon={<Users className="size-8" />}
            title="कोई सदस्य नहीं मिला"
            text="लीडरबोर्ड देखने के लिए टीम में सदस्यों को जोड़ें।"
          />
        </div>
      ) : (
        <div className="mt-4">
          <TeamLeaderboardView members={members} currentUserId={user?.id} />
        </div>
      )}
    </>
  );
}
