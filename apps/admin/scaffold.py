import os
import json

base_dir = "/Users/yashjangid/Desktop/BrokerIQ/apps/admin"

files = {
    "next.config.ts": """import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  /* config options here */
};
export default nextConfig;
""",
    "postcss.config.mjs": """export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
""",
    "tailwind.config.ts": """import type { Config } from 'tailwindcss';
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D9488',
          dark: '#0F766E',
        }
      }
    },
  },
  plugins: [],
};
export default config;
""",
    "tsconfig.json": """{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
""",
    "src/app/globals.css": """@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #0D9488;
  --primary-dark: #0F766E;
}
""",
    "src/app/layout.tsx": """import './globals.css';
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
""",
    "src/components/Sidebar.tsx": """import Link from 'next/link';
import { LayoutDashboard, Building2, Package, CreditCard, Users, Flag, Plug, Settings, BarChart2, ShieldAlert, Activity } from 'lucide-react';
export function Sidebar() {
  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen p-4 flex flex-col">
      <div className="text-xl font-bold mb-8 text-[#0D9488]">BrokerIQ Admin</div>
      <nav className="flex-1 space-y-2">
        <Link href="/" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><LayoutDashboard size={18}/> Dashboard</Link>
        <Link href="/organizations" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><Building2 size={18}/> Organizations</Link>
        <Link href="/plans" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><Package size={18}/> Plans</Link>
        <Link href="/subscriptions" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><CreditCard size={18}/> Subscriptions</Link>
        <Link href="/feature-flags" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><Flag size={18}/> Feature Flags</Link>
        <Link href="/integrations" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><Plug size={18}/> Integrations</Link>
        <Link href="/settings" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><Settings size={18}/> Settings</Link>
        <Link href="/analytics" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><BarChart2 size={18}/> Analytics</Link>
        <Link href="/audit-logs" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><ShieldAlert size={18}/> Audit Logs</Link>
        <Link href="/system-health" className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded"><Activity size={18}/> System Health</Link>
      </nav>
    </div>
  );
}
""",
    "src/components/Header.tsx": """export function Header() {
  return <div className="h-16 border-b flex items-center justify-between px-6 bg-white"><h1 className="text-xl font-semibold">Admin Panel</h1></div>;
}
""",
    "src/components/MetricCard.tsx": """export function MetricCard({ title, value }: { title: string, value: string }) {
  return <div className="p-6 bg-white border rounded shadow-sm"><h3 className="text-gray-500 text-sm">{title}</h3><p className="text-2xl font-semibold mt-2">{value}</p></div>;
}
""",
    "src/components/DataTable.tsx": """export function DataTable({ columns, data }: any) {
  return <table className="w-full text-left border-collapse"><thead><tr>{columns.map((c: any) => <th key={c} className="p-2 border-b">{c}</th>)}</tr></thead><tbody>{data.map((row: any, i: number) => <tr key={i}>{Object.values(row).map((v: any, j: number) => <td key={j} className="p-2 border-b">{v}</td>)}</tr>)}</tbody></table>;
}
""",
    "src/components/StatusBadge.tsx": """export function StatusBadge({ status }: { status: string }) {
  return <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">{status}</span>;
}
""",
    "src/components/Modal.tsx": """export function Modal({ children, isOpen, onClose }: any) {
  if (!isOpen) return null;
  return <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"><div className="bg-white p-6 rounded">{children}<button onClick={onClose} className="mt-4 text-sm text-gray-500">Close</button></div></div>;
}
""",
    "src/components/Button.tsx": """export function Button({ children, ...props }: any) {
  return <button className="px-4 py-2 bg-[#0D9488] text-white rounded hover:bg-[#0F766E]" {...props}>{children}</button>;
}
""",
    "src/components/Input.tsx": """export function Input(props: any) {
  return <input className="w-full p-2 border rounded" {...props} />;
}
""",
    "src/components/Select.tsx": """export function Select({ options, ...props }: any) {
  return <select className="w-full p-2 border rounded" {...props}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}
""",
    "src/components/Card.tsx": """export function Card({ children }: any) {
  return <div className="bg-white p-6 rounded shadow-sm border">{children}</div>;
}
""",
    "src/components/EmptyState.tsx": """export function EmptyState({ message }: any) {
  return <div className="text-center py-12 text-gray-500">{message}</div>;
}
""",
    "src/components/LoadingSkeleton.tsx": """export function LoadingSkeleton() {
  return <div className="animate-pulse bg-gray-200 h-8 rounded w-full"></div>;
}
""",
    "src/app/login/page.tsx": """'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-8 bg-white rounded shadow-sm w-96 border">
        <h1 className="text-2xl font-bold text-[#0D9488] mb-6 text-center">BrokerIQ</h1>
        <div className="space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e: any) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" />
          <Button className="w-full bg-[#0D9488] text-white p-2 rounded" onClick={() => {
            localStorage.setItem('token', 'dummy-token');
            router.push('/');
          }}>Login</Button>
        </div>
      </div>
    </div>
  );
}
""",
    "src/app/(dashboard)/layout.tsx": """'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) {
      router.push('/login');
    }
  }, [router]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
""",
    "src/app/(dashboard)/page.tsx": """import { MetricCard } from '@/components/MetricCard';

export default function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard title="Total Organizations" value="124" />
        <MetricCard title="Active Brokers" value="892" />
        <MetricCard title="MRR (₹)" value="₹1.2M" />
        <MetricCard title="Failed Jobs" value="3" />
      </div>
    </div>
  );
}
""",
    "src/app/(dashboard)/organizations/page.tsx": """import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function Organizations() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Organizations</h2>
      <div className="bg-white rounded border overflow-hidden">
        <DataTable 
          columns={['Name', 'Status', 'Plan']} 
          data={[{ Name: 'Acme Brokers', Status: <StatusBadge status="ACTIVE" />, Plan: 'PRO' }]} 
        />
      </div>
    </div>
  );
}
""",
    "src/app/(dashboard)/organizations/[id]/page.tsx": """export default function OrganizationDetail({ params }: any) {
  return <div>Org ID: {params.id}</div>;
}
""",
    "src/app/(dashboard)/plans/page.tsx": """export default function Plans() {
  return <div>Plans</div>;
}
""",
    "src/app/(dashboard)/subscriptions/page.tsx": """export default function Subscriptions() {
  return <div>Subscriptions</div>;
}
""",
    "src/app/(dashboard)/feature-flags/page.tsx": """export default function FeatureFlags() {
  return <div>Feature Flags</div>;
}
""",
    "src/app/(dashboard)/integrations/page.tsx": """export default function Integrations() {
  return <div>Integrations</div>;
}
""",
    "src/app/(dashboard)/settings/page.tsx": """export default function Settings() {
  return <div>Settings</div>;
}
""",
    "src/app/(dashboard)/analytics/page.tsx": """export default function Analytics() {
  return <div>Analytics</div>;
}
""",
    "src/app/(dashboard)/audit-logs/page.tsx": """export default function AuditLogs() {
  return <div>Audit Logs</div>;
}
""",
    "src/app/(dashboard)/system-health/page.tsx": """export default function SystemHealth() {
  return <div>System Health</div>;
}
""",
    "src/lib/api.ts": """import axios from 'axios';
export const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000' });
""",
    "src/lib/auth.ts": """export const isAuthenticated = () => typeof window !== 'undefined' && !!localStorage.getItem('token');
""",
    "src/mocks/index.ts": """export const mocks = {};
""",
}

for path, content in files.items():
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w") as f:
        f.write(content)

print("Scaffolded all files.")
