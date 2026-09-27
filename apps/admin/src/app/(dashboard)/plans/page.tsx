'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, Plus, Check, Zap, Sparkles, Shield, RefreshCw,
  Building, Users, Activity, Bot, ArrowRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/Modal';

export default function Plans() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tier: 'STARTER',
    description: '',
    priceMonthly: 1999,
    priceAnnual: 19990,
    trialDays: 14,
  });

  const { data: plans = [], isLoading, isFetching } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.plans.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.plans.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setIsModalOpen(false);
    },
  });

  const tierColors: Record<string, { bg: string; border: string; badge: string; text: string }> = {
    FOUNDER: { bg: 'bg-amber-50/50', border: 'border-amber-300', badge: 'bg-amber-100 text-amber-900 border-amber-300', text: 'text-amber-900' },
    STARTER: { bg: 'bg-white', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-800 border-gray-200', text: 'text-gray-900' },
    PRO: { bg: 'bg-teal-50/30', border: 'border-teal-300', badge: 'bg-teal-100 text-teal-800 border-teal-300', text: 'text-teal-950' },
    BUSINESS: { bg: 'bg-purple-50/30', border: 'border-purple-300', badge: 'bg-purple-100 text-purple-900 border-purple-300', text: 'text-purple-950' },
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">SaaS Subscription Plans</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {plans.length} Commercial Tiers
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure pricing tiers, broker seat capacities, lead quotas, and feature entitlements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['plans'] })}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-colors"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin text-teal-600' : ''} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-teal-700/20"
          >
            <Plus size={16} />
            <span>Create Plan Tier</span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <div className="col-span-4 py-16 text-center text-sm text-gray-400">
            <RefreshCw className="animate-spin inline-block mr-2 text-teal-600" size={18} />
            Loading plans from database...
          </div>
        ) : (
          plans.map((plan: any) => {
            const style = tierColors[plan.tier] || tierColors.STARTER;
            const monthlyPrice = Number(plan.priceMonthly || 0);

            return (
              <div
                key={plan.id}
                className={`p-6 rounded-2xl border ${style.border} ${style.bg} shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${style.badge}`}>
                      {plan.tier}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      {plan._count?.subscriptions || 0} Subscribed
                    </span>
                  </div>

                  <h3 className={`text-xl font-bold mt-4 ${style.text}`}>{plan.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 min-h-[32px] line-clamp-2">
                    {plan.description || 'Enterprise real estate CRM subscription tier.'}
                  </p>

                  <div className="mt-5 pb-5 border-b border-gray-200/80">
                    <div className="flex items-baseline">
                      <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        {monthlyPrice === 0 ? '₹0' : `₹${monthlyPrice.toLocaleString('en-IN')}`}
                      </span>
                      <span className="text-xs text-gray-500 ml-1 font-medium">/ month</span>
                    </div>
                    {monthlyPrice > 0 && (
                      <p className="text-[11px] text-teal-700 mt-1 font-medium">
                        Annual billing: ₹{Number(plan.priceAnnual || monthlyPrice * 10).toLocaleString('en-IN')}/yr
                      </p>
                    )}
                  </div>

                  {/* Feature Limits & Entitlements */}
                  <div className="mt-5 space-y-2.5 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-teal-600 shrink-0" />
                      <span>{plan.trialDays} Days Free Trial</span>
                    </div>
                    {plan.features && plan.features.length > 0 ? (
                      plan.features.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-2">
                          <Check size={14} className="text-teal-600 shrink-0" />
                          <span className="truncate">{f.name || (f.code || '').replace(/_/g, ' ')}</span>
                        </div>
                      ))
                    ) : null}
                    {plan.limits && plan.limits.length > 0 ? (
                      plan.limits.map((l: any) => {
                        const units = l.maxUnits === -1 ? 'Unlimited' : (l.maxUnits ?? l.limitValue ?? 'Unlimited');
                        const rawCode = l.code || l.limitKey || '';
                        const label = rawCode.replace(/^MAX_/, '').replace(/_/g, ' ').toLowerCase();
                        return (
                          <div key={l.id} className="flex items-center gap-2">
                            <Check size={14} className="text-teal-600 shrink-0" />
                            <span className="capitalize">
                              {units} {label || 'Quota'}
                            </span>
                          </div>
                        );
                      })
                    ) : null}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-gray-200/60">
                  <span className="text-[11px] text-gray-400 font-mono block">
                    ID: {plan.id.slice(0, 16)}...
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Plan Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Subscription Plan Tier">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              ...formData,
              priceMonthly: Number(formData.priceMonthly),
              priceAnnual: Number(formData.priceAnnual),
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Plan Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Enterprise Scale"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Plan Tier *</label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="STARTER">STARTER</option>
                <option value="PRO">PRO</option>
                <option value="BUSINESS">BUSINESS</option>
                <option value="FOUNDER">FOUNDER</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Trial Days</label>
              <input
                type="number"
                value={formData.trialDays}
                onChange={(e) => setFormData({ ...formData, trialDays: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Monthly Price (₹) *</label>
              <input
                type="number"
                required
                value={formData.priceMonthly}
                onChange={(e) => setFormData({ ...formData, priceMonthly: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Annual Price (₹) *</label>
              <input
                type="number"
                required
                value={formData.priceAnnual}
                onChange={(e) => setFormData({ ...formData, priceAnnual: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
