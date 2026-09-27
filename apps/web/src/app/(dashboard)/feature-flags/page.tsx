'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/Card';
import { Switch } from '@/components/Switch';
import { MetricCard } from '@/components/MetricCard';
import { Flag, Search, CheckCircle2, ShieldAlert, Sliders } from 'lucide-react';

interface FeatureFlagItem {
  id: string;
  organizationId: string | null;
  key: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function FeatureFlags() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: flags = [], isLoading } = useQuery<FeatureFlagItem[]>({
    queryKey: ['feature-flags'],
    queryFn: () => api.featureFlags.getAll(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.featureFlags.update(id, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });

  const filteredFlags = flags.filter(
    (f) =>
      f.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeCount = flags.filter((f) => f.isEnabled).length;
  const inactiveCount = flags.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Feature Flags & Remote Config</h2>
          <p className="text-sm text-gray-500 mt-1">
            Real-time toggles and progressive rollout switches across BrokerIQ instances.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Feature Flags"
          value={flags.length}
          icon={Flag}
          subtitle="Managed in system core"
        />
        <MetricCard
          title="Active Flags"
          value={activeCount}
          icon={CheckCircle2}
          trend={{ value: `${Math.round((activeCount / (flags.length || 1)) * 100)}% active`, isPositive: true }}
          subtitle="Enabled globally"
        />
        <MetricCard
          title="Inactive Flags"
          value={inactiveCount}
          icon={ShieldAlert}
          subtitle="Disabled or guarded"
        />
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Filter feature flags by key or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488]"
          />
        </div>
      </Card>

      {/* Flags List Card */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading live feature flags...</div>
        ) : filteredFlags.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No feature flags found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="py-3.5 px-6">Feature Flag</th>
                  <th className="py-3.5 px-6">Scope</th>
                  <th className="py-3.5 px-6">Rollout</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFlags.map((flag) => (
                  <tr key={flag.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center font-bold">
                          <Sliders size={16} />
                        </div>
                        <div>
                          <div className="font-mono text-sm font-semibold text-gray-900">{flag.key}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{flag.description || 'No description provided'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {flag.organizationId ? 'Tenant Scoped' : 'Global Platform'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${flag.isEnabled ? 'bg-[#0D9488]' : 'bg-gray-300'}`}
                            style={{ width: `${flag.isEnabled ? flag.rolloutPercentage : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">
                          {flag.isEnabled ? `${flag.rolloutPercentage}%` : '0%'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          flag.isEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {flag.isEnabled ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center justify-end">
                        <Switch
                          checked={flag.isEnabled}
                          onChange={() => toggleMutation.mutate({ id: flag.id, isEnabled: !flag.isEnabled })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
