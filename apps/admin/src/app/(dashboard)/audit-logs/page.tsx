'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, Search, RefreshCw, Shield, Clock,
  Filter, Eye, ChevronRight, Terminal, User
} from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/Modal';

export default function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data: logs = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.audit.getAll(),
  });

  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      const user = log.user?.name || log.user?.email || '';
      const org = log.organization?.name || '';
      const action = log.action || '';
      const entity = log.entityType || '';

      const matchesSearch =
        user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.toLowerCase().includes(searchTerm.toLowerCase()) ||
        action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entity.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction =
        actionFilter === 'ALL' || log.action?.includes(actionFilter);

      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  const actionBadgeColors: Record<string, string> = {
    CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
    DELETE: 'bg-red-50 text-red-700 border-red-200',
    LOGIN: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const getActionColor = (action: string) => {
    for (const key of Object.keys(actionBadgeColors)) {
      if (action.includes(key)) return actionBadgeColors[key];
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Audit Ledger</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {logs.length} Immutable Records
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Cryptographically-sequenced trail of security events, broker updates, and configuration changes.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin text-teal-600' : ''} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by user, action, organization, or entity..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium overflow-x-auto">
          {['ALL', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'].map((act) => (
            <button
              key={act}
              onClick={() => setActionFilter(act)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                actionFilter === act
                  ? 'bg-teal-600 text-white font-semibold shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {act}
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
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity Type</th>
                <th className="px-6 py-4">Tenant Scope</th>
                <th className="px-6 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    <RefreshCw className="animate-spin inline-block mr-2 text-teal-600" size={16} />
                    Loading audit trail from database...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    No audit records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-3.5 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">
                          {log.user?.name ? log.user.name.charAt(0) : 'S'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{log.user?.name || 'System Service'}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{log.user?.email || 'daemon'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase border ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs font-medium text-gray-700">
                      {log.entityType}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-gray-600">
                      {log.organization?.name || 'Platform-wide'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <Modal isOpen={true} onClose={() => setSelectedLog(null)} title="Audit Event Payload">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 block">Record ID</span>
                <span className="font-mono text-gray-900 font-semibold">{selectedLog.id}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Action</span>
                <span className="font-semibold text-teal-700">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Initiated By</span>
                <span className="text-gray-900">{selectedLog.user?.name} ({selectedLog.user?.email})</span>
              </div>
              <div>
                <span className="text-gray-400 block">Recorded At</span>
                <span className="text-gray-900">{new Date(selectedLog.createdAt).toISOString()}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-gray-700 block mb-1.5">Event Metadata</span>
              <pre className="p-3 bg-gray-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-60 border border-gray-800">
                {JSON.stringify(selectedLog.metadata || { entityId: selectedLog.entityId, entityType: selectedLog.entityType }, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
