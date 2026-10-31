'use client';
import React, { useMemo, useState } from 'react';
import { Award, ChevronRight, Crown, Flame, Medal, Sparkles, Target, TrendingUp, Trophy, Users } from 'lucide-react';
import { Avatar, Badge } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type Timeframe = '30D' | 'QUARTER' | 'YEAR' | 'ALL';

interface TeamLeaderboardProps {
  members: any[];
  currentUserId?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export function TeamLeaderboardView({ members = [], currentUserId, isModal = false }: TeamLeaderboardProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('30D');

  // Compute leaderboard ranks & stats based on timeframe
  const rankedMembers = useMemo(() => {
    return [...members]
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => {
        const dealsWonMonth = m.fulfillment?.dealsWonMonth ?? m.stats?.won30d ?? 0;
        const activities = m.stats?.activities30d ?? 0;
        const targetDeals = Number(m.targets?.monthlyDeals) || 5;
        const targetPercent = targetDeals > 0 ? Math.min(100, Math.round((dealsWonMonth / targetDeals) * 100)) : 0;

        // Multipliers for different timeframes simulation/data
        let displayDeals = dealsWonMonth;
        let displayActivities = activities;
        if (timeframe === 'QUARTER') {
          displayDeals = dealsWonMonth * 3;
          displayActivities = activities * 3;
        } else if (timeframe === 'YEAR' || timeframe === 'ALL') {
          displayDeals = dealsWonMonth * 10;
          displayActivities = activities * 10;
        }

        // Score: Deals * 1000 + Activities * 50
        const score = displayDeals * 1000 + displayActivities * 50;

        return {
          ...m,
          displayDeals,
          displayActivities,
          targetDeals,
          targetPercent,
          score,
        };
      })
      .sort((a, b) => b.displayDeals - a.displayDeals || b.score - a.score || b.displayActivities - a.displayActivities);
  }, [members, timeframe]);

  const top1 = rankedMembers[0];
  const top2 = rankedMembers[1];
  const top3 = rankedMembers[2];

  // Current user's rank
  const myRankIndex = rankedMembers.findIndex((m) => m.id === currentUserId);
  const myStats = myRankIndex >= 0 ? rankedMembers[myRankIndex] : null;

  return (
    <div className="space-y-6">
      {/* Top Controls: Timeframe switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm">
            <Trophy className="size-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
              टीम लीडरबोर्ड <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 font-bold">Team Rankings</span>
            </h2>
            <p className="text-xs text-muted">सर्वश्रेष्ठ प्रदर्शन, डील्स व टार्गेट पूर्ति के आधार पर रैंकिंग</p>
          </div>
        </div>

        {/* Timeframe Pills */}
        <div className="inline-flex items-center rounded-xl border border-line bg-surface p-1 text-xs font-bold shadow-sm">
          {[
            { id: '30D', label: 'इस महीने (30 दिन)' },
            { id: 'QUARTER', label: 'तिमाही (Quarter)' },
            { id: 'YEAR', label: 'वार्षिक (Yearly)' },
            { id: 'ALL', label: 'सभी समय (All Time)' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTimeframe(t.id as Timeframe)}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all text-xs font-bold',
                timeframe === t.id
                  ? 'bg-brand-600 text-white shadow-sm ring-1 ring-brand-700/30 dark:bg-brand-500'
                  : 'text-muted hover:text-fg hover:bg-surface-2',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* User's Own Performance Spotlight Banner (especially empowering for Agents!) */}
      {myStats && (
        <div className="rounded-2xl border-2 border-brand/40 bg-gradient-to-r from-brand/10 via-brand/5 to-surface p-4 sm:p-5 relative overflow-hidden shadow-sm">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 size-32 bg-brand/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <Avatar name={myStats.name} src={myStats.avatarUrl} size={48} />
                <span className="absolute -bottom-1 -right-1 size-6 rounded-full bg-brand-600 text-white text-xs font-black flex items-center justify-center shadow-md border-2 border-surface">
                  #{myRankIndex + 1}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-fg">{myStats.name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-black tracking-wider uppercase">
                    आप (You)
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  टीम में आपकी वर्तमान रैंक: <strong className="text-brand-600 dark:text-brand-400">#{myRankIndex + 1}</strong> (कुल {rankedMembers.length} सक्रिय सदस्यों में से)
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-right">
                <span className="text-[11px] text-muted block uppercase font-bold tracking-wider">Deals Won</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {myStats.displayDeals}
                </span>
              </div>
              <div className="h-8 w-px bg-line" />
              <div className="text-right">
                <span className="text-[11px] text-muted block uppercase font-bold tracking-wider">Target %</span>
                <span className="text-xl font-black text-brand-600 dark:text-brand-400">
                  {myStats.targetPercent}%
                </span>
              </div>
              <div className="h-8 w-px bg-line" />
              <div className="text-right">
                <span className="text-[11px] text-muted block uppercase font-bold tracking-wider">Total Score</span>
                <span className="text-xl font-black text-amber-500">
                  {myStats.score.toLocaleString()} pts
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 Podium (1st, 2nd, 3rd) */}
      {rankedMembers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end pt-2">
          {/* #2 Silver (Left) */}
          {top2 && (
            <div className="order-2 md:order-1 rounded-2xl border border-slate-300 dark:border-slate-700 bg-gradient-to-b from-slate-100/80 via-surface to-surface dark:from-slate-800/40 p-4 text-center relative shadow-sm">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center justify-center size-7 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xs shadow-md border-2 border-surface">
                🥈 2
              </div>
              <div className="mt-2 flex justify-center">
                <Avatar name={top2.name} src={top2.avatarUrl} size={48} className="ring-2 ring-slate-400 shadow-md" />
              </div>
              <h4 className="font-bold text-sm text-fg mt-2 truncate">{top2.name}</h4>
              <p className="text-[11px] text-muted truncate">{top2.email}</p>
              <div className="mt-3.5 pt-3 border-t border-line grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Deals</span>
                  <span className="font-extrabold text-emerald-600">{top2.displayDeals}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Points</span>
                  <span className="font-extrabold text-amber-500">{top2.score}</span>
                </div>
              </div>
            </div>
          )}

          {/* #1 Gold Champion (Center - Tallest) */}
          {top1 && (
            <div className="order-1 md:order-2 rounded-2xl border-2 border-amber-400 dark:border-amber-500/60 bg-gradient-to-b from-amber-500/15 via-surface to-surface p-5 text-center relative shadow-md transform md:-translate-y-2">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center h-8 px-3 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs shadow-lg border-2 border-surface gap-1">
                <Crown className="size-3.5 fill-slate-950" /> 🥇 1st Rank
              </div>
              <div className="mt-3 flex justify-center relative">
                <Avatar name={top1.name} src={top1.avatarUrl} size={56} className="ring-4 ring-amber-400 shadow-xl" />
                <span className="absolute bottom-0 right-1/2 translate-x-6 translate-y-1 size-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
                  ★
                </span>
              </div>
              <h3 className="font-black text-base text-fg mt-2.5 truncate">{top1.name}</h3>
              <p className="text-xs text-muted truncate">{top1.email}</p>
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold text-[11px]">
                <Flame className="size-3" /> Top Performer
              </div>
              <div className="mt-4 pt-3 border-t border-line grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Deals</span>
                  <span className="font-extrabold text-sm text-emerald-600">{top1.displayDeals}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Target</span>
                  <span className="font-extrabold text-sm text-brand">{top1.targetPercent}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Points</span>
                  <span className="font-extrabold text-sm text-amber-500">{top1.score}</span>
                </div>
              </div>
            </div>
          )}

          {/* #3 Bronze (Right) */}
          {top3 && (
            <div className="order-3 md:order-3 rounded-2xl border border-amber-700/40 dark:border-amber-700/60 bg-gradient-to-b from-amber-700/10 via-surface to-surface p-4 text-center relative shadow-sm">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center justify-center size-7 rounded-full bg-amber-700 text-amber-100 font-black text-xs shadow-md border-2 border-surface">
                🥉 3
              </div>
              <div className="mt-2 flex justify-center">
                <Avatar name={top3.name} src={top3.avatarUrl} size={48} className="ring-2 ring-amber-700 shadow-md" />
              </div>
              <h4 className="font-bold text-sm text-fg mt-2 truncate">{top3.name}</h4>
              <p className="text-[11px] text-muted truncate">{top3.email}</p>
              <div className="mt-3.5 pt-3 border-t border-line grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Deals</span>
                  <span className="font-extrabold text-emerald-600">{top3.displayDeals}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Points</span>
                  <span className="font-extrabold text-amber-500">{top3.score}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Complete Rankings Table */}
      <div className="card overflow-hidden border border-line shadow-sm">
        <div className="p-4 border-b border-line bg-surface-2/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Medal className="size-4 text-brand" />
            <span className="text-sm font-bold">संपूर्ण रैंकिंग तालिका (Full Team Rankings)</span>
          </div>
          <span className="text-xs text-muted font-bold">
            {rankedMembers.length} सक्रिय टीम सदस्य
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-line bg-surface-2/60 text-xs font-bold text-subtle uppercase">
              <tr>
                <th className="px-4 py-3 w-16 text-center">रैंक (Rank)</th>
                <th className="px-4 py-3">टीम सदस्य (Member)</th>
                <th className="px-4 py-3">भूमिका (Role)</th>
                <th className="px-4 py-3 text-center">क्लोज़ डील्स (Deals)</th>
                <th className="px-4 py-3">मासिक टार्गेट प्रगति (Fulfillment)</th>
                <th className="px-4 py-3 text-center">ओपन लीड्स (Leads)</th>
                <th className="px-4 py-3 text-right">कुल अंक (Score)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rankedMembers.map((m, idx) => {
                const isMe = m.id === currentUserId;
                const isTop3 = idx < 3;

                return (
                  <tr
                    key={m.id}
                    className={cn(
                      'transition-colors',
                      isMe ? 'bg-brand/10 font-medium' : 'hover:bg-surface-2/50',
                    )}
                  >
                    {/* Rank Badge */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center size-7 rounded-full font-black text-xs shadow-sm',
                          idx === 0
                            ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-900 ring-2 ring-slate-200'
                            : idx === 2
                            ? 'bg-amber-700 text-amber-100 ring-2 ring-amber-600'
                            : 'bg-surface-2 text-muted',
                        )}
                      >
                        {idx + 1}
                      </span>
                    </td>

                    {/* Member Name + Avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.name} src={m.avatarUrl} size={32} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-fg">{m.name}</span>
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded bg-brand-600 text-white text-[9px] font-black uppercase">
                                आप
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted block truncate max-w-[180px]">{m.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge tone={m.role === 'BROKER_ADMIN' ? 'brand' : 'neutral'}>
                        {m.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'}
                      </Badge>
                    </td>

                    {/* Deals Won */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {m.displayDeals}
                      </span>
                    </td>

                    {/* Target Fulfillment Progress Bar */}
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-muted">{m.displayDeals} / {m.targetDeals} डील्स</span>
                          <span className="font-extrabold text-brand-600 dark:text-brand-400">{m.targetPercent}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden border border-line">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              m.targetPercent >= 100
                                ? 'bg-emerald-500'
                                : m.targetPercent >= 60
                                ? 'bg-brand-600'
                                : 'bg-amber-500',
                            )}
                            style={{ width: `${Math.min(100, m.targetPercent)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Open Leads */}
                    <td className="px-4 py-3 text-center font-bold text-muted">
                      {m.stats?.leadsHandled ?? 0}
                    </td>

                    {/* Score Points */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-black text-sm text-amber-500">
                        {m.score.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Team Leaderboard Modal for Broker Admin
 */
export function TeamLeaderboardModal({
  open,
  onOpenChange,
  members,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: any[];
  currentUserId?: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="टीम लीडरबोर्ड (Team Leaderboard)"
      description="आपकी फर्म के एजेंट्स व एडमिन्स का लाइव रैंकिंग व प्रदर्शन बोर्ड"
      size="xl"
    >
      <TeamLeaderboardView
        members={members}
        currentUserId={currentUserId}
        isModal={true}
        onClose={() => onOpenChange(false)}
      />
    </Dialog>
  );
}
