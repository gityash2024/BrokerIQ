import os
import json

base_dir = "/Users/yashjangid/Desktop/BrokerIQ/apps/admin"

files = {
    "src/app/globals.css": """@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #0D9488;
  --primary-dark: #0F766E;
  --primary-light: #14B8A6;
}
""",
    "src/app/layout.tsx": """'use client';
import './globals.css';
import { Inter } from 'next/font/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
""",
    "src/components/Sidebar.tsx": """'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Package, CreditCard, Users, Flag, Plug, Settings, BarChart2, ShieldAlert, Activity } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Organizations', href: '/organizations', icon: Building2 },
  { name: 'Plans', href: '/plans', icon: Package },
  { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Feature Flags', href: '/feature-flags', icon: Flag },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Audit Logs', href: '/audit-logs', icon: ShieldAlert },
  { name: 'System Health', href: '/system-health', icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  
  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen p-4 flex flex-col">
      <div className="text-2xl font-bold mb-8 text-[#0D9488] flex items-center gap-2">
        <div className="w-8 h-8 bg-[#0D9488] rounded-md flex items-center justify-center text-white font-bold text-lg">B</div>
        BrokerIQ
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`flex items-center gap-3 p-3 rounded transition-colors ${isActive ? 'bg-[#0D9488] text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              <Icon size={20}/> 
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
""",
    "src/components/Header.tsx": """import { Bell, User } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 border-b flex items-center justify-between px-6 bg-white shrink-0">
      <h1 className="text-xl font-semibold text-gray-800">Admin Panel</h1>
      <div className="flex items-center gap-4">
        <button className="text-gray-500 hover:text-gray-700 relative">
          <Bell size={20} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900 border p-1 pr-3 rounded-full bg-gray-50">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <User size={16} />
          </div>
          <span className="text-sm font-medium">Admin User</span>
        </div>
      </div>
    </header>
  );
}
""",
    "src/components/MetricCard.tsx": """import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; isUp: boolean };
}

export function MetricCard({ title, value, icon: Icon, trend }: MetricCardProps) {
  return (
    <div className="p-6 bg-white border rounded shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
          <p className="text-2xl font-bold mt-2 text-gray-800">{value}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-full text-[#0D9488]">
          <Icon size={24} />
        </div>
      </div>
      {trend && (
        <div className={`text-sm mt-4 font-medium ${trend.isUp ? 'text-green-600' : 'text-red-600'}`}>
          {trend.isUp ? '↑' : '↓'} {trend.value}
        </div>
      )}
    </div>
  );
}
""",
    "src/components/DataTable.tsx": """'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from './Input';

export function DataTable({ columns, data }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredData = data.filter((row: any) => 
    Object.values(row).some((val: any) => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="w-full bg-white rounded border flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="w-64">
          <Input 
            placeholder="Search..." 
            value={searchTerm} 
            onChange={(e: any) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((c: any, i: number) => (
                <th key={i} className="p-4 border-b text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center gap-2">
                    {c.header}
                    <div className="flex flex-col text-gray-300">
                      <ChevronUp size={12} className="-mb-1" />
                      <ChevronDown size={12} />
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? filteredData.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50 border-b last:border-b-0">
                {columns.map((c: any, j: number) => (
                  <td key={j} className="p-4 text-sm text-gray-700">
                    {c.cell ? c.cell(row) : row[c.accessorKey]}
                  </td>
                ))}
              </tr>
            )) : (
              <tr><td colSpan={columns.length} className="p-8 text-center text-gray-500">No results found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t flex justify-between items-center text-sm text-gray-500">
        <div>Showing 1 to {filteredData.length} of {filteredData.length} entries</div>
        <div className="flex items-center gap-2">
          <button className="p-1 border rounded hover:bg-gray-50"><ChevronLeft size={16}/></button>
          <button className="p-1 border rounded hover:bg-gray-50 bg-gray-100 text-gray-800 px-3">1</button>
          <button className="p-1 border rounded hover:bg-gray-50"><ChevronRight size={16}/></button>
        </div>
      </div>
    </div>
  );
}
""",
    "src/components/StatusBadge.tsx": """export function StatusBadge({ status }: { status: string }) {
  let colorClass = 'bg-gray-100 text-gray-800';
  const s = status.toUpperCase();
  
  if (['ACTIVE', 'SUCCESS', 'CONFIRMED', 'COMPLETED', 'WON', 'DELIVERED', 'READ'].includes(s)) {
    colorClass = 'bg-green-100 text-green-800 border-green-200';
  } else if (['TRIAL', 'TRIALING', 'NEW', 'QUEUED'].includes(s)) {
    colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
  } else if (['SUSPENDED', 'PENDING', 'FOLLOW_UP', 'NEGOTIATION', 'PAUSED'].includes(s)) {
    colorClass = 'bg-amber-100 text-amber-800 border-amber-200';
  } else if (['CANCELLED', 'FAILED', 'LOST', 'VOID', 'EXPIRED'].includes(s)) {
    colorClass = 'bg-red-100 text-red-800 border-red-200';
  }
  
  return (
    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${colorClass}`}>
      {status}
    </span>
  );
}
""",
    "src/components/Modal.tsx": """import { X } from 'lucide-react';

export function Modal({ children, isOpen, onClose, title }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-200"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
""",
    "src/components/Button.tsx": """export function Button({ children, variant = 'primary', className = '', ...props }: any) {
  const baseClass = "inline-flex items-center justify-center px-4 py-2 font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  let variantClass = "";
  if (variant === 'primary') variantClass = "bg-[#0D9488] text-white hover:bg-[#0F766E] focus:ring-[#0D9488]";
  if (variant === 'secondary') variantClass = "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500";
  if (variant === 'outline') variantClass = "border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500";
  if (variant === 'danger') variantClass = "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600";
  if (variant === 'ghost') variantClass = "text-gray-700 hover:bg-gray-100 focus:ring-gray-500";
  
  return (
    <button className={`${baseClass} ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
""",
    "src/components/Input.tsx": """export function Input({ label, error, helperText, className = '', ...props }: any) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input 
        className={`w-full p-2.5 border rounded outline-none transition-colors focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'} ${className}`} 
        {...props} 
      />
      {error && <span className="text-sm text-red-600">{error}</span>}
      {helperText && !error && <span className="text-sm text-gray-500">{helperText}</span>}
    </div>
  );
}
""",
    "src/components/Select.tsx": """export function Select({ label, options, className = '', ...props }: any) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select 
        className={`w-full p-2.5 border border-gray-300 rounded outline-none transition-colors focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] bg-white ${className}`} 
        {...props}
      >
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
""",
    "src/components/Card.tsx": """export function Card({ title, description, children, className = '', action }: any) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {(title || description || action) && (
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
""",
    "src/components/EmptyState.tsx": """import { Inbox } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({ message, description, icon: Icon = Inbox, action, onAction }: any) {
  return (
    <div className="text-center py-16 px-6 bg-white border border-gray-200 border-dashed rounded-lg flex flex-col items-center justify-center">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
      {description && <p className="text-gray-500 mb-6 max-w-sm">{description}</p>}
      {action && <Button onClick={onAction}>{action}</Button>}
    </div>
  );
}
""",
    "src/components/LoadingSkeleton.tsx": """export function LoadingSkeleton({ className = '' }: any) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className || 'h-8 w-full'}`}></div>;
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
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@brokeriq.com' && password === 'admin') {
      localStorage.setItem('token', 'dummy-jwt-token');
      router.push('/');
    } else {
      setError('Invalid credentials. Use admin@brokeriq.com / admin');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-sm w-[400px] border border-gray-200">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-[#0D9488] rounded-lg flex items-center justify-center text-white font-bold text-2xl mb-4">B</div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in to BrokerIQ</h1>
          <p className="text-gray-500 mt-2">Admin Control Panel</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <Input 
            label="Email Address" 
            type="email" 
            placeholder="admin@brokeriq.com" 
            value={email} 
            onChange={(e: any) => setEmail(e.target.value)} 
            required
          />
          <Input 
            label="Password" 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={(e: any) => setPassword(e.target.value)} 
            required
          />
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded border border-red-100">{error}</div>}
          <Button type="submit" className="w-full mt-2">Sign In</Button>
        </form>
      </div>
    </div>
  );
}
""",
    "src/app/(dashboard)/page.tsx": """import { Building2, Users, CreditCard, DollarSign, Activity, AlertCircle, Bot, MessageSquare } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';
import { Card } from '@/components/Card';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { mocks } from '@/mocks';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Organizations" value="124" icon={Building2} trend={{ value: '+12%', isUp: true }} />
        <MetricCard title="Active Brokers" value="892" icon={Users} trend={{ value: '+5%', isUp: true }} />
        <MetricCard title="MRR" value="₹1.2M" icon={DollarSign} trend={{ value: '+18%', isUp: true }} />
        <MetricCard title="Failed Jobs" value="3" icon={AlertCircle} trend={{ value: '-2', isUp: true }} />
        <MetricCard title="Trial Accounts" value="45" icon={CreditCard} trend={{ value: '+10%', isUp: true }} />
        <MetricCard title="Total Leads Processed" value="12,450" icon={Activity} trend={{ value: '+22%', isUp: true }} />
        <MetricCard title="WhatsApp Messages" value="145k" icon={MessageSquare} trend={{ value: '+15%', isUp: true }} />
        <MetricCard title="AI Requests" value="8,920" icon={Bot} trend={{ value: '+45%', isUp: true }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent Registrations">
          <DataTable 
            columns={[
              { header: 'Organization', accessorKey: 'name' },
              { header: 'Plan', accessorKey: 'plan' },
              { header: 'Status', cell: (row: any) => <StatusBadge status={row.status} /> }
            ]}
            data={mocks.organizations.slice(0, 5)}
          />
        </Card>
        
        <Card title="System Alerts">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border border-red-100 bg-red-50 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
                <div>
                  <h4 className="font-medium text-red-800">Housing.com Sync Delayed</h4>
                  <p className="text-sm text-red-600 mt-1">Sync queue is backed up by 5 minutes. Investigating API rate limits.</p>
                  <span className="text-xs text-red-500 mt-2 block">10 minutes ago</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
""",
    "src/app/(dashboard)/organizations/page.tsx": """'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { mocks } from '@/mocks';

export default function Organizations() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const columns = [
    { header: 'Name', cell: (row: any) => (
        <div>
          <div className="font-medium text-gray-900">{row.name}</div>
          <div className="text-xs text-gray-500">{row.businessName}</div>
        </div>
      )
    },
    { header: 'Status', cell: (row: any) => <StatusBadge status={row.status} /> },
    { header: 'Plan', cell: (row: any) => <span className="font-medium text-gray-700">{row.plan}</span> },
    { header: 'Created', accessorKey: 'createdAt' },
    { header: 'Actions', cell: (row: any) => (
        <div className="flex gap-2">
          <Link href={`/organizations/${row.id}`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Eye size={16}/></Link>
          <button className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"><Edit size={16}/></button>
          <button className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Organizations</h2>
        <Button onClick={() => setIsModalOpen(true)}>Create Organization</Button>
      </div>
      
      <DataTable columns={columns} data={mocks.organizations} />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Organization">
        <form className="space-y-4">
          <Input label="Organization Name" placeholder="e.g. Acme Realty" />
          <Input label="Business Name" placeholder="Legal Entity Name" />
          <Input label="Admin Email" type="email" />
          <Select label="Plan" options={[
            { label: 'Starter', value: 'STARTER' },
            { label: 'Pro', value: 'PRO' },
            { label: 'Business', value: 'BUSINESS' }
          ]} />
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => setIsModalOpen(false)}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
""",
    "src/app/(dashboard)/organizations/[id]/page.tsx": """'use client';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { mocks } from '@/mocks';

export default function OrganizationDetail({ params }: any) {
  const org = mocks.organizations.find(o => o.id === params.id) || mocks.organizations[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{org.name}</h2>
          <p className="text-gray-500 mt-1">{org.businessName}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={org.status} />
          <Button variant="outline">Suspend</Button>
          <Button variant="danger">Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Subscription Details">
          <div className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Plan</span>
              <span className="font-medium">{org.plan}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Created At</span>
              <span className="font-medium">{org.createdAt}</span>
            </div>
          </div>
        </Card>
        <Card title="Usage Statistics">
           <div className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Users</span>
              <span className="font-medium">12 / 20</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Leads Processed (this month)</span>
              <span className="font-medium">1,245 / 5,000</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
""",
    "src/app/(dashboard)/plans/page.tsx": """'use client';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { mocks } from '@/mocks';

export default function Plans() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const columns = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Code', cell: (row: any) => <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{row.code}</span> },
    { header: 'Monthly Price', cell: (row: any) => `₹${row.monthlyPrice}` },
    { header: 'Yearly Price', cell: (row: any) => `₹${row.yearlyPrice}` },
    { header: 'Trial Days', accessorKey: 'trialDays' },
    { header: 'Status', cell: (row: any) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Plans</h2>
        <Button onClick={() => setIsModalOpen(true)}>Create Plan</Button>
      </div>
      
      <DataTable columns={columns} data={mocks.plans} />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create/Edit Plan">
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Plan Name" placeholder="e.g. Pro Plan" />
            <Input label="Code" placeholder="e.g. PRO" />
            <Input label="Monthly Price (₹)" type="number" />
            <Input label="Yearly Price (₹)" type="number" />
            <Input label="Trial Days" type="number" defaultValue="14" />
          </div>
          
          <div className="pt-4 mt-4 border-t">
            <h4 className="font-medium text-gray-800 mb-4">Feature Limits</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Max Users" type="number" />
              <Input label="Max Leads / Month" type="number" />
              <Input label="Max Properties" type="number" />
              <Input label="Max AI Requests" type="number" />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => setIsModalOpen(false)}>Save Plan</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
""",
    "src/app/(dashboard)/subscriptions/page.tsx": """'use client';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { mocks } from '@/mocks';

export default function Subscriptions() {
  const columns = [
    { header: 'Organization', accessorKey: 'organization' },
    { header: 'Plan', accessorKey: 'plan' },
    { header: 'Status', cell: (row: any) => <StatusBadge status={row.status} /> },
    { header: 'Period Start', accessorKey: 'periodStart' },
    { header: 'Period End', accessorKey: 'periodEnd' },
    { header: 'Provider', accessorKey: 'provider' },
    { header: 'Actions', cell: () => (
        <div className="flex gap-2">
          <Button variant="outline" className="px-2 py-1 text-xs">Extend</Button>
          <Button variant="danger" className="px-2 py-1 text-xs">Cancel</Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Subscriptions</h2>
      <DataTable columns={columns} data={mocks.subscriptions} />
    </div>
  );
}
""",
    "src/app/(dashboard)/feature-flags/page.tsx": """import { Card } from '@/components/Card';
import { Switch } from '@/components/Switch';

export default function FeatureFlags() {
  const features = ['AI_SUMMARY', 'WHATSAPP_AUTOMATION', 'HOUSING_SYNC', 'ADVANCED_ANALYTICS'];
  const columns = ['Global', 'Starter Plan', 'Pro Plan', 'Business Plan'];
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Feature Flags</h2>
      
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 font-medium text-gray-500">Feature</th>
              {columns.map(c => <th key={c} className="p-4 font-medium text-gray-500 text-center">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {features.map((f, i) => (
              <tr key={f} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-4 font-medium text-gray-700">{f}</td>
                {columns.map(c => (
                  <td key={c} className="p-4 text-center">
                    <input type="checkbox" className="w-4 h-4 text-[#0D9488] rounded border-gray-300 focus:ring-[#0D9488]" defaultChecked={i % 2 === 0} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
""",
    "src/components/Switch.tsx": """export function Switch({ checked, onChange }: any) {
  return (
    <button 
      type="button" 
      onClick={onChange} 
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:ring-offset-2 ${checked ? 'bg-[#0D9488]' : 'bg-gray-200'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}
""",
    "src/app/(dashboard)/integrations/page.tsx": """'use client';
import { useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { Settings2, Key, Database } from 'lucide-react';

const integrationsList = [
  { id: 'housing', name: 'Housing.com', type: 'Lead Source', status: 'CONFIGURED', icon: Settings2 },
  { id: 'whatsapp', name: 'WhatsApp API', type: 'Messaging', status: 'NOT_CONFIGURED', icon: Settings2 },
  { id: 'razorpay', name: 'Razorpay', type: 'Payments', status: 'CONFIGURED', icon: Key },
  { id: 'groq', name: 'Groq AI', type: 'AI Provider', status: 'CONFIGURED', icon: Database },
];

export default function Integrations() {
  const [selected, setSelected] = useState<any>(null);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Integrations (Credential Center)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrationsList.map(int => {
          const Icon = int.icon;
          return (
            <Card key={int.id} className="flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gray-50 rounded-lg text-gray-600 border"><Icon size={24}/></div>
                <StatusBadge status={int.status} />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">{int.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{int.type}</p>
              
              <div className="mt-auto pt-6 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelected(int)}>Configure</Button>
                {int.status === 'CONFIGURED' && <Button variant="secondary" className="px-3">Test</Button>}
              </div>
            </Card>
          )
        })}
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Configure ${selected?.name}`}>
        <form className="space-y-4">
          <Input label="API Key" type="password" placeholder="••••••••••••••••" />
          {selected?.id === 'whatsapp' && <Input label="Phone Number ID" />}
          {selected?.id === 'razorpay' && <Input label="API Secret" type="password" placeholder="••••••••••••••••" />}
          
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
            <Button type="button" onClick={() => setSelected(null)}>Save Credentials</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
""",
    "src/app/(dashboard)/settings/page.tsx": """'use client';
import { useState } from 'react';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Button } from '@/components/Button';
import { Switch } from '@/components/Switch';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'ai', label: 'AI Configuration' },
    { id: 'payments', label: 'Payments' }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>
      
      <div className="flex border-b">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === tab.id ? 'border-[#0D9488] text-[#0D9488]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        {activeTab === 'general' && (
          <form className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-2 gap-6">
              <Input label="App Name" defaultValue="BrokerIQ SaaS" />
              <Input label="Support Email" defaultValue="support@brokeriq.com" />
              <Input label="Support Phone" defaultValue="+91 9876543210" />
              <Select label="Default Currency" options={[{ label: 'INR (₹)', value: 'INR' }, { label: 'USD ($)', value: 'USD' }]} />
            </div>
            <Button>Save Changes</Button>
          </form>
        )}
        
        {activeTab === 'ai' && (
          <form className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div>
                <h4 className="font-medium text-gray-800">Enable AI Features Global</h4>
                <p className="text-sm text-gray-500">Master switch for all AI integrations</p>
              </div>
              <Switch checked={true} onChange={() => {}} />
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <Select label="Primary Provider" options={[
                { label: 'Groq (Llama 3)', value: 'GROQ' },
                { label: 'OpenAI', value: 'OPENAI' },
              ]} />
              <Select label="Fallback Provider" options={[
                { label: 'OpenAI', value: 'OPENAI' },
                { label: 'Anthropic', value: 'ANTHROPIC' },
              ]} />
              <Input label="Global Daily Limit (Requests)" type="number" defaultValue="100000" />
            </div>
            <Button>Save AI Settings</Button>
          </form>
        )}
        
        {activeTab === 'payments' && (
           <form className="space-y-6 max-w-2xl">
            <Select label="Active Payment Gateway" options={[
              { label: 'Razorpay', value: 'RAZORPAY' },
              { label: 'Stripe', value: 'STRIPE' },
            ]} />
            <Button>Save Payment Settings</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
""",
    "src/app/(dashboard)/analytics/page.tsx": """import { Card } from '@/components/Card';

export default function Analytics() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Revenue Trend (MRR)">
          <div className="h-64 bg-gray-50 border border-dashed border-gray-200 rounded flex items-center justify-center text-gray-400">
            [ Chart Placeholder - Revenue over last 12 months ]
          </div>
        </Card>
        
        <Card title="Subscription Distribution">
          <div className="h-64 bg-gray-50 border border-dashed border-gray-200 rounded flex items-center justify-center text-gray-400">
            [ Chart Placeholder - Pie chart of active plans ]
          </div>
        </Card>
        
        <Card title="Lead Volumes">
          <div className="h-64 bg-gray-50 border border-dashed border-gray-200 rounded flex items-center justify-center text-gray-400">
            [ Chart Placeholder - Leads processed per day ]
          </div>
        </Card>
        
        <Card title="AI Usage">
          <div className="h-64 bg-gray-50 border border-dashed border-gray-200 rounded flex items-center justify-center text-gray-400">
            [ Chart Placeholder - Token consumption by organization ]
          </div>
        </Card>
      </div>
    </div>
  );
}
""",
    "src/app/(dashboard)/audit-logs/page.tsx": """'use client';
import { DataTable } from '@/components/DataTable';
import { mocks } from '@/mocks';

export default function AuditLogs() {
  const columns = [
    { header: 'Timestamp', accessorKey: 'timestamp' },
    { header: 'User', accessorKey: 'user' },
    { header: 'Action', cell: (row: any) => <span className="font-mono text-sm">{row.action}</span> },
    { header: 'Resource', accessorKey: 'resource' },
    { header: 'Details', accessorKey: 'details' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Audit Logs</h2>
      <DataTable columns={columns} data={mocks.auditLogs} />
    </div>
  );
}
""",
    "src/app/(dashboard)/system-health/page.tsx": """import { Card } from '@/components/Card';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

const healthServices = [
  { name: 'Database (PostgreSQL)', status: 'operational', lastChecked: 'Just now' },
  { name: 'Redis Cache', status: 'operational', lastChecked: 'Just now' },
  { name: 'Background Queue (BullMQ)', status: 'degraded', lastChecked: '2 mins ago' },
  { name: 'Housing.com API', status: 'operational', lastChecked: '5 mins ago' },
  { name: 'WhatsApp Cloud API', status: 'operational', lastChecked: '1 min ago' },
  { name: 'Razorpay API', status: 'operational', lastChecked: 'Just now' },
  { name: 'Groq AI Service', status: 'down', lastChecked: '1 min ago' },
];

export default function SystemHealth() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">System Health</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {healthServices.map((service, i) => (
          <Card key={i} className="flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              {service.status === 'operational' && <CheckCircle2 className="text-green-500" />}
              {service.status === 'degraded' && <AlertCircle className="text-amber-500" />}
              {service.status === 'down' && <XCircle className="text-red-500" />}
              <h3 className="font-semibold text-gray-800">{service.name}</h3>
            </div>
            <div className="mt-2 text-sm text-gray-500 flex justify-between">
              <span>Status: <span className="capitalize font-medium text-gray-700">{service.status}</span></span>
              <span>Checked: {service.lastChecked}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
""",
    "src/mocks/index.ts": """export const mocks = {
  organizations: [
    { id: 'org_1', name: 'Acme Realty', businessName: 'Acme Properties Pvt Ltd', status: 'ACTIVE', plan: 'PRO', createdAt: '2023-10-01' },
    { id: 'org_2', name: 'Apex Brokers', businessName: 'Apex Real Estate', status: 'SUSPENDED', plan: 'STARTER', createdAt: '2023-11-15' },
    { id: 'org_3', name: 'Prime Estates', businessName: 'Prime Housing LLC', status: 'ACTIVE', plan: 'BUSINESS', createdAt: '2024-01-20' },
    { id: 'org_4', name: 'Metro Homes', businessName: 'Metro Realtors', status: 'TRIAL', plan: 'PRO', createdAt: '2024-03-05' },
  ],
  plans: [
    { name: 'Starter', code: 'STARTER', monthlyPrice: 2999, yearlyPrice: 29990, trialDays: 14, status: 'ACTIVE' },
    { name: 'Pro', code: 'PRO', monthlyPrice: 5999, yearlyPrice: 59990, trialDays: 14, status: 'ACTIVE' },
    { name: 'Business', code: 'BUSINESS', monthlyPrice: 12999, yearlyPrice: 129990, trialDays: 14, status: 'ACTIVE' },
  ],
  subscriptions: [
    { organization: 'Acme Realty', plan: 'PRO', status: 'ACTIVE', periodStart: '2024-03-01', periodEnd: '2024-04-01', provider: 'RAZORPAY' },
    { organization: 'Apex Brokers', plan: 'STARTER', status: 'PAST_DUE', periodStart: '2024-02-15', periodEnd: '2024-03-15', provider: 'STRIPE' },
  ],
  auditLogs: [
    { timestamp: '2024-03-15 10:23:45', user: 'admin@brokeriq.com', action: 'LOGIN', resource: 'System', details: 'Successful login from IP' },
    { timestamp: '2024-03-15 11:05:12', user: 'admin@brokeriq.com', action: 'PLAN_CHANGE', resource: 'org_1', details: 'Upgraded to PRO plan' },
    { timestamp: '2024-03-15 14:30:00', user: 'system', action: 'SUBSCRIPTION_EVENT', resource: 'org_2', details: 'Payment failed, marked past_due' },
  ]
};
""",
}

def main():
    for path, content in files.items():
        full_path = os.path.join(base_dir, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w") as f:
            f.write(content)

    print("Successfully re-scaffolded all files to meet requirements.")

if __name__ == "__main__":
    main()
