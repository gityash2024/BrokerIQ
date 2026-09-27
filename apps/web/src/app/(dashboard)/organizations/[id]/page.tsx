'use client';
import { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, Users, CreditCard, Shield, Activity,
  Phone, Mail, Calendar, CheckCircle2, AlertTriangle, Trash2,
  RefreshCw, Check, Sparkles, Home, MapPin, ExternalLink
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';

export default function OrganizationDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'subscription' | 'usage'>('overview');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: org, isLoading, error } = useQuery({
    queryKey: ['organization', resolvedParams.id],
    queryFn: () => api.organizations.getById(resolvedParams.id),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: string) => api.organizations.update(resolvedParams.id, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', resolvedParams.id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.organizations.delete(resolvedParams.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      router.push('/organizations');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <RefreshCw className="animate-spin text-teal-600" size={18} />
          <span>Loading organization details...</span>
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 text-center max-w-lg mx-auto mt-12">
        <AlertTriangle className="text-red-500 mx-auto mb-3" size={32} />
        <h3 className="text-base font-bold text-gray-900">Organization Not Found</h3>
        <p className="text-xs text-gray-500 mt-1">The tenant may have been removed or the ID is invalid.</p>
        <Link href="/organizations" className="inline-block mt-4 text-xs font-semibold text-teal-600 hover:underline">
          Return to Organizations
        </Link>
      </div>
    );
  }

  const activeSub = org.subscriptions?.[0];
  const members = org.members || [];
  const counts = org._count || {};

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/organizations" className="hover:text-gray-900 flex items-center gap-1 font-medium">
          <ArrowLeft size={14} />
          <span>Organizations</span>
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-semibold">{org.name}</span>
      </div>

      {/* Hero Organization Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
            {org.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{org.name}</h1>
              <StatusBadge status={org.status} />
              {org.isFounder && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                  FOUNDER TENANT
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 font-mono">
              Tenant ID: <span className="text-gray-700 font-semibold">{org.id}</span> • Slug: /{org.slug}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {org.status === 'ACTIVE' ? (
            <button
              onClick={() => updateStatusMutation.mutate('SUSPENDED')}
              disabled={updateStatusMutation.isPending}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-xl transition-all"
            >
              Suspend Tenant
            </button>
          ) : (
            <button
              onClick={() => updateStatusMutation.mutate('ACTIVE')}
              disabled={updateStatusMutation.isPending}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl transition-all"
            >
              Activate Tenant
            </button>
          )}

          <button
            onClick={() => setIsDeleteOpen(true)}
            className="p-2 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-xl transition-all"
            title="Delete Tenant"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6 text-sm font-medium">
          {[
            { id: 'overview', label: 'Overview & Config' },
            { id: 'members', label: `Team Members (${members.length})` },
            { id: 'subscription', label: 'Subscription & Billing' },
            { id: 'usage', label: 'Usage & Inventory' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-teal-600 text-teal-700 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider text-gray-400">
              Organization Metadata
            </h3>
            <div className="space-y-3 text-sm divide-y divide-gray-100">
              <div className="flex justify-between pt-2">
                <span className="text-gray-500">Legal Name</span>
                <span className="font-medium text-gray-900">{org.name}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-gray-500">Tenant Slug</span>
                <span className="font-mono text-gray-900">/{org.slug}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-gray-500">Max Broker Seats</span>
                <span className="font-semibold text-teal-700">{org.maxBrokers} seats</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-gray-500">Created On</span>
                <span className="text-gray-700">
                  {new Date(org.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-gray-500">Last Updated</span>
                <span className="text-gray-700">
                  {new Date(org.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider text-gray-400">
              Security & Compliance
            </h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100 flex items-start gap-3">
                <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-teal-900">Row-Level Tenant Isolation Active</p>
                  <p className="text-[11px] text-teal-700 mt-0.5">
                    All DB queries are constrained by organizationId {org.id}.
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                <Shield size={16} className="text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-900">Audit Logging Enabled</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Administrative actions on this tenant are recorded in the immutable audit ledger.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Members */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Registered Brokers & Staff</h3>
              <p className="text-xs text-gray-500 mt-0.5">Brokers licensed under this organization seat quota</p>
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Phone</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs text-gray-400">
                    No members enrolled under this organization.
                  </td>
                </tr>
              ) : (
                members.map((member: any) => (
                  <tr key={member.id} className="hover:bg-gray-50/60">
                    <td className="px-6 py-3.5 font-semibold text-gray-900 text-xs">
                      {member.user?.name || 'Broker User'}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-gray-600 font-mono">
                      {member.user?.email}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-gray-600 font-mono">
                      {member.user?.phone || 'N/A'}
                    </td>
                    <td className="px-6 py-3.5 text-xs">
                      <span className="px-2 py-0.5 rounded font-semibold bg-gray-100 text-gray-800">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-gray-500">
                      {new Date(member.joinedAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Subscription */}
      {activeTab === 'subscription' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Subscription Plan</h3>
              <p className="text-xs text-gray-500 mt-0.5">Commercial subscription plan terms and billing period</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
              {activeSub?.plan?.name || (org.isFounder ? 'FOUNDER TIER' : 'FREE TRIAL')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs text-gray-500 font-medium">Monthly Rate</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {activeSub?.plan?.priceMonthly ? `₹${Number(activeSub.plan.priceMonthly).toLocaleString('en-IN')}` : '₹0 (Free)'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs text-gray-500 font-medium">Billing Period</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{activeSub?.billingPeriod || 'MONTHLY'}</p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs text-gray-500 font-medium">Subscription Status</span>
              <div className="mt-1">
                <StatusBadge status={activeSub?.status || 'ACTIVE'} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Usage */}
      {activeTab === 'usage' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
            <span className="text-xs font-medium text-gray-500">Housing Leads</span>
            <p className="text-3xl font-extrabold text-teal-600 mt-2">{counts.leads || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Directly ingested</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
            <span className="text-xs font-medium text-gray-500">Properties Inventory</span>
            <p className="text-3xl font-extrabold text-blue-600 mt-2">{counts.properties || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Active listings</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
            <span className="text-xs font-medium text-gray-500">Customer Contacts</span>
            <p className="text-3xl font-extrabold text-purple-600 mt-2">{counts.customers || 0}</p>
            <p className="text-xs text-gray-400 mt-1">In CRM address book</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
            <span className="text-xs font-medium text-gray-500">Site Visits</span>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">{counts.siteVisits || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Logged visits</p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Delete Organization">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to permanently delete <strong>{org.name}</strong>? All leads, properties, and broker accounts under this tenant will be purged.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Deletion'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
