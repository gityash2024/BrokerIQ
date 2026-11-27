'use client';

import { INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES, INVENTORY_FILTER_LABELS, inventoryDateFilter, inventoryFilterDay } from '@brokeriq/shared';
import { AdvancedFilters } from './advanced-filters';

export function InventoryFilterFields({
  filters,
  setFilters,
  sectors,
  canViewArchived,
}: {
  filters: Record<string, string>;
  setFilters: (filters: Record<string, string>) => void;
  sectors: string[];
  canViewArchived: boolean;
}) {
  const fields: Record<string, string[]> = {
    ...(canViewArchived ? { archived: ['exclude', 'only', 'include'] } : {}),
    status: ['DRAFT', 'ACTIVE', 'INACTIVE', 'RENTED'],
    sector: sectors,
    purpose: ['RENT', 'SALE'],
    propertyType: PROPERTY_TYPES,
    category: ['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND'],
    bhk: ['1', '2', '3', '4', '5', '6'],
    roomKinds: ['BHK', 'RK', 'STUDIO'],
    furnishing: ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'],
    availability: ['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE'],
    sourceType: ['MANUAL', 'PDF_REGISTER', 'WHATSAPP', 'CHAT_EXPORT', 'IMAGE', 'TEXT', 'PORTAL'],
    areaUnit: ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'],
  };
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(fields).map(([name, choices]) => (
          <label key={name} className="text-xs font-semibold">
            {INVENTORY_FILTER_LABELS[name] ?? name}
            <select
              value={filters[name] ?? ''}
              onChange={(e) => setFilters({ ...filters, [name]: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5"
            >
              <option value="">All</option>
              {choices.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        ))}
        {['minBudget', 'maxBudget', 'minArea', 'maxArea'].map((name) => (
          <label key={name} className="text-xs font-semibold">
            {INVENTORY_FILTER_LABELS[name] ?? name}
            <input
              type="number"
              min={0}
              value={filters[name] ?? ''}
              onChange={(e) => setFilters({ ...filters, [name]: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(['dateFrom', 'dateTo'] as const).map((name) => (
          <label key={name} className="text-xs font-semibold">
            {name === 'dateFrom' ? 'From date · IST' : 'Through date · IST'}
            <input
              type="date"
              value={inventoryFilterDay(filters[name])}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  [name]: inventoryDateFilter(e.target.value, name === 'dateTo') ?? '',
                })
              }
              className="mt-1 block w-full rounded-lg border border-line bg-surface p-2"
            />
          </label>
        ))}
      </div>
      <AdvancedFilters filters={filters} onChange={setFilters} />
    </>
  );
}
