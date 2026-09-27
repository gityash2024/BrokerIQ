'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Search,
  PlusCircle,
  MoreVertical,
  Shield,
  Activity,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

interface TenantOrg {
  id: string;
  name: string;
  slug: string;
  plan: 'FOUNDER' | 'STARTER' | 'PRO' | 'BUSINESS';
  status: 'ACTIVE' | 'SUSPENDED';
  brokersCount: number;
  brokerQuota: number;
  leadsCount: number;
  propertiesCount: number;
  mrr: number;
  joinedDate: string;
}

const INITIAL_TENANTS: TenantOrg[] = [
  {
    id: 'org-founder-realty',
    name: 'Founder Realty India',
    slug: 'founder-realty',
    plan: 'PRO',
    status: 'ACTIVE',
    brokersCount: 8,
    brokerQuota: 10,
    leadsCount: 284,
    propertiesCount: 54,
    mrr: 4999,
    joinedDate: 'Sep 2026',
  },
  {
    id: 'org-gurgaon-commercial',
    name: 'Gurgaon Commercial Capital',
    slug: 'gurgaon-commercial',
    plan: 'BUSINESS',
    status: 'ACTIVE',
    brokersCount: 18,
    brokerQuota: 25,
    leadsCount: 612,
    propertiesCount: 92,
    mrr: 9999,
    joinedDate: 'Aug 2026',
  },
  {
    id: 'org-mumbai-luxury',
    name: 'Mumbai Luxury Corridors',
    slug: 'mumbai-luxury',
    plan: 'PRO',
    status: 'ACTIVE',
    brokersCount: 6,
    brokerQuota: 10,
    leadsCount: 180,
    propertiesCount: 38,
    mrr: 4999,
    joinedDate: 'Jul 2026',
  },
  {
    id: 'org-direct-landlords',
    name: 'Delhi NCR Landlords Alliance',
    slug: 'ncr-landlords',
    plan: 'STARTER',
    status: 'ACTIVE',
    brokersCount: 2,
    brokerQuota: 3,
    leadsCount: 45,
    propertiesCount: 19,
    mrr: 1999,
    joinedDate: 'Sep 2026',
  },
];

export default function TenantGovernancePage() {
  const [tenants, setTenants] = useState<TenantOrg[]>(INITIAL_TENANTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleStatus = (id: string, name: string) => {
    setTenants((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
          showToast(`Tenant "${name}" status changed to ${nextStatus}.`);
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-purple-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Tenant Organizations Governance</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Multi-tenant agency isolation, seat quota enforcement, and SaaS subscription tier management.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/organizations"
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-purple-900/30"
          >
            <PlusCircle size={14} />
            <span>Create Tenant Org</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-800 shadow-lg flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenant name or slug..."
            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
          />
        </div>

        <span className="text-xs text-gray-400 font-medium">
          Showing {filteredTenants.length} Tenant Organizations
        </span>
      </div>

      {/* Tenants Table */}
      <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/60">
              <th className="py-3.5 px-4">Organization Name</th>
              <th className="py-3.5 px-4">Plan Tier</th>
              <th className="py-3.5 px-4">Broker Seats Quota</th>
              <th className="py-3.5 px-4">Catalog Properties</th>
              <th className="py-3.5 px-4">Monthly MRR</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredTenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-800/40 transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-xs">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{t.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">/{t.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className="text-xs font-bold text-purple-300 bg-purple-950/60 border border-purple-800 px-2 py-0.5 rounded-md">
                    {t.plan}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-300">
                      <span>{t.brokersCount} of {t.brokerQuota} Seats</span>
                      <span className="font-bold text-purple-400">
                        {Math.round((t.brokersCount / t.brokerQuota) * 100)}%
                      </span>
                    </div>
                    <div className="w-28 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-purple-500 h-1.5 rounded-full"
                        style={{ width: `${(t.brokersCount / t.brokerQuota) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-gray-200 font-medium">
                  {t.propertiesCount} Units · {t.leadsCount} Leads
                </td>
                <td className="py-4 px-4 font-bold text-white">
                  ₹{t.mrr.toLocaleString('en-IN')}/mo
                </td>
                <td className="py-4 px-4">
                  <StatusBadge status={t.status} />
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => toggleStatus(t.id, t.name)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                        t.status === 'ACTIVE'
                          ? 'border-red-800/60 text-red-400 hover:bg-red-950/40'
                          : 'border-emerald-800/60 text-emerald-400 hover:bg-emerald-950/40'
                      }`}
                    >
                      {t.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                    </button>
                    <Link
                      href={`/organizations/${t.id}`}
                      className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-lg border border-purple-500/40 text-[11px] font-bold transition-all"
                    >
                      Details →
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
