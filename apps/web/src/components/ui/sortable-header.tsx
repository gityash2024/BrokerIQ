'use client';
import React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortableThProps<T extends string> {
  column: T;
  sortColumn: T | null;
  sortDirection: SortDirection;
  onSort: (column: T) => void;
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  title?: string;
}

/**
 * Enterprise 3-State Sortable Table Header:
 * Click 1: Ascending (▲)
 * Click 2: Descending (▼)
 * Click 3: Default (Unsorted)
 */
export function SortableTh<T extends string>({
  column,
  sortColumn,
  sortDirection,
  onSort,
  children,
  align = 'left',
  className,
  title,
}: SortableThProps<T>) {
  const isActive = sortColumn === column && sortDirection !== null;

  return (
    <th
      scope="col"
      aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(column)}
      title={title || 'क्लिक करके सॉर्ट करें (Click to sort)'}
      className={cn(
        'px-4 py-3 cursor-pointer select-none group transition-all duration-150',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
        isActive ? 'text-brand font-black bg-brand/5' : 'hover:bg-surface-2/80 hover:text-fg',
        className,
      )}
    >
      <div
        className={cn(
          'inline-flex items-center gap-1.5 transition-colors',
          align === 'center' ? 'justify-center mx-auto' : align === 'right' ? 'justify-end ml-auto' : 'justify-start',
        )}
      >
        <span>{children}</span>
        <span
          className={cn(
            'inline-flex items-center justify-center size-4 rounded transition-all',
            isActive ? 'text-brand bg-brand/10' : 'text-muted/40 group-hover:text-muted group-hover:scale-110',
          )}
        >
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="size-3.5 stroke-[2.5]" />
            ) : (
              <ArrowDown className="size-3.5 stroke-[2.5]" />
            )
          ) : (
            <ChevronsUpDown className="size-3.5" />
          )}
        </span>
      </div>
    </th>
  );
}

/**
 * Hook to manage 3-state sorting:
 * null (unsorted) -> 'asc' -> 'desc' -> null
 */
export function useSortableTable<T extends string>(defaultCol: T | null = null, defaultDir: SortDirection = null) {
  const [sortColumn, setSortColumn] = React.useState<T | null>(defaultCol);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(defaultDir);

  const handleSort = React.useCallback(
    (col: T) => {
      if (sortColumn !== col) {
        setSortColumn(col);
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    },
    [sortColumn, sortDirection],
  );

  return { sortColumn, sortDirection, handleSort, setSortColumn, setSortDirection };
}
