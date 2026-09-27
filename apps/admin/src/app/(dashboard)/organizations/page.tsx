'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Building2, Plus, Search, Filter, Eye, Edit3, Trash2, ArrowUpRight,
  Users, Activity, CheckCircle2, AlertCircle, RefreshCw, X, Shield, Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';

export default function Organizations() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state for creating tenant
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    maxBrokers: 10,
    status: 'ACTIVE',
  });
  const [formError, setFormError] = useState('');

  // Fetch live organizations from API
  const { data: orgs = [], isLoading, isFetching } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.organizations.getAll(),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.organizations.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      setIsCreateOpen(false);
      setFormData({ name: '', slug: '', maxBrokers: 10, status: 'ACTIVE' });
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to create organization');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.organizations.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      setDeleteConfirmId(null);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name.trim()) {
      setFormError('Organization name is required');
      return;
    }
    const slug = formData.slug.trim() || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    createMutation.mutate({
      name: formData.name.trim(),
      slug,
      maxBrokers: Number(formData.maxBrokers) || 5,
      status: formData.status,
    });
  };

  // Filtered organizations
  const filteredOrgs = useMemo(() => {
    return orgs.filter((org: any) => {
      const matchesSearch =
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.plan && org.plan.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || org.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orgs, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = orgs.length;
    const active = orgs.filter((o: any) => o.status === 'ACTIVE').length;
    const totalBrokers = orgs.reduce((acc: number, o: any) => acc + (o.brokersCount || 0), 0);
    const totalLeads = orgs.reduce((acc: number, o: any) => acc + (o.leadsCount || 0), 0);
    return { total, active, totalBrokers, totalLeads };
  }, [orgs]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tenant Organizations</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {orgs.length} Tenants
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage multi-tenant property broker firms, broker capacities, subscriptions, and quotas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['organizations'] })}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-colors"
            title="Refresh tenants"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin text-teal-600' : ''} />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-teal-700/20 active:scale-95"
          >
            <Plus size={16} />
            <span>New Organization</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Total Registered Tenants</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Active Status</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Total Enrolled Brokers</p>
          <p className="text-2xl font-bold text-teal-700 mt-1">{stats.totalBrokers}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Aggregated Pipeline Leads</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{stats.totalLeads}</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by organization name, slug, or plan..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
          {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED'].map((st) => (
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

      {/* Live Data Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4">Organization Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Active Plan</th>
                <th className="px-6 py-4">Brokers Limit</th>
                <th className="px-6 py-4">Leads / Inventory</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">
                    <RefreshCw className="animate-spin inline-block mr-2 text-teal-600" size={16} />
                    Loading tenants from database...
                  </td>
                </tr>
              ) : filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">
                    No organizations match your query.
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org: any) => (
                  <tr key={org.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white font-bold flex items-center justify-center shadow-sm">
                          {org.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{org.name}</span>
                            {org.isFounder && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                FOUNDER
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 font-mono">/{org.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={org.status} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800">
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-700">
                      <span className="font-semibold text-gray-900">{org.brokersCount}</span> / {org.maxBrokers} seats
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      <span className="font-medium text-teal-700">{org.leadsCount} leads</span> • {org.propertiesCount || 0} properties
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/organizations/${org.id}`}
                          className="p-2 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </Link>
                        <button
                          onClick={() => setDeleteConfirmId(org.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Organization"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Organization Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Tenant Organization">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Organization Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value;
                setFormData({
                  ...formData,
                  name,
                  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                });
              }}
              placeholder="e.g. Apex Property Consultants"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Tenant Slug
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g. apex-property-consultants"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Max Brokers Seats
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={formData.maxBrokers}
                onChange={(e) => setFormData({ ...formData, maxBrokers: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Initial Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="TRIAL">TRIAL</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-teal-700/20 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Provisioning Tenant...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <Modal isOpen={true} onClose={() => setDeleteConfirmId(null)} title="Confirm Tenant Deletion">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this tenant organization? All associated data will be removed.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Organization'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
