'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatINR, formatPriceShort } from '@brokeriq/shared';

export function PriceTrendChart({ data }: { data: { month: string; avgPsf: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: new Date(d.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={rows} margin={{ left: 0, right: 8, top: 10 }}>
        <defs>
          <linearGradient id="psf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4f46e5" stopOpacity={0.35} />
            <stop offset="1" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip formatter={(v: any) => [`${formatINR(v)}/sq.ft`, 'Avg price']} contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }} />
        <Area type="monotone" dataKey="avgPsf" stroke="#4f46e5" strokeWidth={2.5} fill="url(#psf)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RentBarChart({ data }: { data: { bedrooms: number; avgRent: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data.map((d) => ({ ...d, label: `${d.bedrooms} BHK` }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatPriceShort(v)} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={56} />
        <Tooltip formatter={(v: any) => [`${formatINR(v)}/month`, 'Avg rent']} contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }} />
        <Bar dataKey="avgRent" fill="#f59e0b" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
