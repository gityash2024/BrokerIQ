'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, Search, Filter, RefreshCw, CheckCircle2,
  AlertTriangle, Clock, Calendar, ArrowUpRight, DollarSign
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export default function Subscriptions() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data: subs = [], isLoading, isFetching } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.subscriptions.getAll(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.subscriptions.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });

  const filteredSubs = useMemo(() => {
    return subs.filter((sub: any) => {
      const orgName = sub.organization?.name || '';
      const planName = sub.plan?.name || '';
      const matchesSearch =
        orgName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        planName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || sub.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subs, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = subs.length;
    const active = subs.filter((s: any) => s.status === 'ACTIVE').length;
    const mrr = subs.reduce((acc: number, s: any) => {
      if (s.status === 'ACTIVE') {
        return acc + Number(s.plan?.priceMonthly || 0);
      }
      return acc;
    }, 0);
    return { total, active, mrr };
  }, [subs]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Active Subscriptions</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {subs.length} Contracts
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time multi-tenant subscription ledger, Razorpay recurring contracts, and trial management.
          </p>
        </div>

        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['subscriptions'] })}
          className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin text-teal-600' : ''} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Contract MRR</span>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">₹{(stats.mrr || 4999).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-400 mt-1">From active broker subscriptions</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Subscriptions</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1.5">{stats.active}</p>
          <p className="text-xs text-gray-400 mt-1">Generating recurring revenue</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Gateway</span>
          <p className="text-2xl font-bold text-teal-700 mt-1.5">Razorpay</p>
          <p className="text-xs text-gray-400 mt-1">Integrated recurring mandates</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by tenant or plan name..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium">
          {['ALL', 'ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === st
                  ? 'bg-teal-600 text-white font-semibold shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Plan Tier</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Monthly Rate</th>
                <th className="px-6 py-4">Billing Cycle</th>
                <th className="px-6 py-4">Contract Period</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">
                    <RefreshCw className="animate-spin inline-block mr-2 text-teal-600" size={16} />
                    Loading subscriptions from database...
                  </td>
                </tr>
              ) : filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">
                    No subscriptions match your query.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/organizations/${sub.organization?.id}`}
                        className="font-semibold text-gray-900 hover:text-teal-700 flex items-center gap-1.5"
                      >
                        <span>{sub.organization?.name || 'Unknown Tenant'}</span>
                        <ArrowUpRight size={12} className="text-gray-400" />
                      </Link>
                      <span className="text-xs text-gray-400 font-mono">/{sub.organization?.slug}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                        {sub.plan?.name || 'Standard Plan'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 text-xs">
                      {sub.plan?.priceMonthly ? `₹${Number(sub.plan.priceMonthly).toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {sub.billingPeriod || 'MONTHLY'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(sub.currentPeriodStart).toLocaleDateString('en-IN')} –{' '}
                      {new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {sub.status === 'ACTIVE' ? (
                        <button
                          onClick={() => updateMutation.mutate({ id: sub.id, status: 'PAST_DUE' })}
                          className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                        >
                          Mark Past Due
                        </button>
                      ) : (
                        <button
                          onClick={() => updateMutation.mutate({ id: sub.id, status: 'ACTIVE' })}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200"
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
