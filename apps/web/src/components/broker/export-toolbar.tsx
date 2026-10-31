'use client';

import React, { useState } from 'react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Table } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn, qs } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ExportFormat = 'xlsx' | 'pdf' | 'csv';

export interface ExportToolbarProps {
  /** API endpoint path, e.g. '/admin/kyc/export' or '/broker/team/export' */
  endpoint: string;
  /** Active filter query parameters */
  filters?: Record<string, unknown>;
  /** Explicitly selected record IDs */
  selectedIds?: string[];
  /** Total count of records matching current view */
  totalCount?: number;
  /** Filtered count of records */
  filteredCount?: number;
  /** Base filename for the download without extension */
  baseFilename?: string;
  /** Alternatively filenamePrefix */
  filenamePrefix?: string;
  /** UI presentation variant: 'dropdown' | 'buttons' */
  variant?: 'dropdown' | 'buttons';
  /** Button sizing */
  size?: 'xs' | 'sm' | 'md';
  /** Disabled state */
  disabled?: boolean;
  className?: string;
}

export function ExportToolbar({
  endpoint,
  filters = {},
  selectedIds,
  totalCount,
  filteredCount,
  baseFilename = 'export',
  filenamePrefix,
  variant = 'dropdown',
  size = 'sm',
  disabled = false,
  className,
}: ExportToolbarProps) {
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);

  // Selection state handling:
  // - selectedIds === undefined: No selection active -> use active filters
  // - selectedIds is an array: Selection mode active (may be empty if selected rows have 0 exportable items)
  const isSelectionActive = selectedIds !== undefined;
  const hasSentinel = Boolean(selectedIds?.some((id) => id === '__NONE__' || id === '__NO_MATCH__'));
  const effectiveSelectedIds = selectedIds?.filter((id) => id !== '__NONE__' && id !== '__NO_MATCH__') ?? [];
  const selectedCount = effectiveSelectedIds.length;
  const hasSelection = isSelectionActive && selectedCount > 0 && !hasSentinel;
  const isSelectionEmpty = isSelectionActive && (selectedCount === 0 || hasSentinel);
  const effectiveBaseFilename = filenamePrefix || baseFilename;

  const downloadExport = async (format: ExportFormat) => {
    if (disabled || busyFormat || isSelectionEmpty) return;
    setBusyFormat(format);
    const toastId = toast.loading(`${format.toUpperCase()} export generate ho raha hai...`);

    try {
      const params: Record<string, unknown> = { format };

      if (isSelectionActive) {
        if (isSelectionEmpty) {
          toast.info('चयनित रिकॉर्ड्स में कोई एक्सपोर्ट योग्य डेटा उपलब्ध नहीं है (No exportable records in selection)', { id: toastId });
          setBusyFormat(null);
          return;
        }
        params.ids = effectiveSelectedIds.join(',');
      } else if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
            params[k] = v;
          }
        }
      }

      const queryString = qs(params);
      const targetUrl = `${endpoint}${queryString}`;
      const res = await api<Response>(targetUrl, { raw: true });

      if (!res.ok) {
        let errorMsg = `Export failed (${res.status})`;
        try {
          const errBody = await res.json();
          if (errBody?.message) errorMsg = errBody.message;
        } catch {}
        throw new Error(errorMsg);
      }

      const blob = await res.blob();
      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
      const dateSlug = new Date().toISOString().slice(0, 10);
      const filename = `${effectiveBaseFilename}-${dateSlug}.${ext}`;

      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);

      toast.success(`${format.toUpperCase()} report successfully download ho gayi!`, { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || 'Export generate karne me error aayi', { id: toastId });
    } finally {
      setBusyFormat(null);
    }
  };

  if (variant === 'buttons') {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Button
          size={size}
          variant="secondary"
          disabled={disabled || busyFormat !== null || isSelectionEmpty}
          onClick={() => downloadExport('xlsx')}
          className="h-9 text-xs"
          title={isSelectionEmpty ? 'चयनित रिकॉर्ड्स में कोई एक्सपोर्ट योग्य डेटा नहीं है' : undefined}
        >
          {busyFormat === 'xlsx' ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <FileSpreadsheet className="size-3.5 text-emerald-600 mr-1" />}
          Excel
        </Button>
        <Button
          size={size}
          variant="secondary"
          disabled={disabled || busyFormat !== null || isSelectionEmpty}
          onClick={() => downloadExport('pdf')}
          className="h-9 text-xs"
          title={isSelectionEmpty ? 'चयनित रिकॉर्ड्स में कोई एक्सपोर्ट योग्य डेटा नहीं है' : undefined}
        >
          {busyFormat === 'pdf' ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <FileText className="size-3.5 text-rose-600 mr-1" />}
          PDF
        </Button>
        <Button
          size={size}
          variant="secondary"
          disabled={disabled || busyFormat !== null || isSelectionEmpty}
          onClick={() => downloadExport('csv')}
          className="h-9 text-xs"
          title={isSelectionEmpty ? 'चयनित रिकॉर्ड्स में कोई एक्सपोर्ट योग्य डेटा नहीं है' : undefined}
        >
          {busyFormat === 'csv' ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Table className="size-3.5 text-sky-600 mr-1" />}
          CSV
        </Button>
      </div>
    );
  }

  const displayCount = isSelectionActive
    ? selectedCount
    : filteredCount != null
      ? filteredCount
      : totalCount;

  const isButtonDisabled = disabled || busyFormat !== null || isSelectionEmpty;

  return (
    <DM.Root>
      <DM.Trigger asChild>
        <Button
          size={size}
          variant="secondary"
          disabled={isButtonDisabled}
          title={isSelectionEmpty ? 'चयनित रिकॉर्ड्स में कोई एक्सपोर्ट योग्य डेटा नहीं है' : undefined}
          className={cn('h-9 text-xs gap-1.5', className)}
        >
          {busyFormat ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5 text-muted" />
          )}
          <span>
            {isSelectionActive
              ? `Export Selected (${selectedCount})`
              : displayCount != null
                ? `Export (${displayCount})`
                : 'Export Data'}
          </span>
          <ChevronDown className="size-3 text-muted" />
        </Button>
      </DM.Trigger>

      <DM.Portal>
        <DM.Content
          align="end"
          className="z-50 min-w-56 rounded-xl border border-line bg-surface p-1 shadow-xl animate-in fade-in-80"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[11px] font-bold text-muted border-b border-line mb-1">
            {isSelectionActive ? `${selectedCount} records selected` : 'Filtered dataset'}
          </div>

          <DM.Item
            onSelect={() => downloadExport('xlsx')}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs outline-none hover:bg-surface-2 transition-colors"
          >
            <FileSpreadsheet className="size-4 text-emerald-600" />
            <div className="flex flex-col">
              <span className="font-semibold text-fg">Excel Spreadsheet (.xlsx)</span>
              <span className="text-[10px] text-muted">Formatted columns & totals</span>
            </div>
          </DM.Item>

          <DM.Item
            onSelect={() => downloadExport('pdf')}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs outline-none hover:bg-surface-2 transition-colors"
          >
            <FileText className="size-4 text-rose-600" />
            <div className="flex flex-col">
              <span className="font-semibold text-fg">PDF Document (.pdf)</span>
              <span className="text-[10px] text-muted">A4 tabular landscape report</span>
            </div>
          </DM.Item>

          <DM.Item
            onSelect={() => downloadExport('csv')}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs outline-none hover:bg-surface-2 transition-colors"
          >
            <Table className="size-4 text-sky-600" />
            <div className="flex flex-col">
              <span className="font-semibold text-fg">CSV File (.csv)</span>
              <span className="text-[10px] text-muted">UTF-8 with BOM for Excel</span>
            </div>
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
