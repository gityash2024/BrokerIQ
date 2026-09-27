'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, CreditCard, Settings, Activity,
  Shield, Heart, ToggleRight, Plug, FileText, Users, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { label: 'Command Center', href: '/admin', icon: LayoutDashboard },
  { label: 'Listing Moderation', href: '/admin/moderation', icon: Shield },
  { label: 'Seller KYC', href: '/admin/kyc', icon: Users },
  { label: 'Organizations', href: '/organizations', icon: Building2 },
  { label: 'Plans', href: '/plans', icon: CreditCard },
  { label: 'Subscriptions', href: '/subscriptions', icon: Users },
  { label: 'Feature Flags', href: '/feature-flags', icon: ToggleRight },
  { label: 'Integrations', href: '/integrations', icon: Plug },
  { label: 'Analytics', href: '/analytics', icon: Activity },
  { label: 'Audit Logs', href: '/audit-logs', icon: FileText },
  { label: 'System Health', href: '/system-health', icon: Heart },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-gray-900 text-white flex flex-col transition-all duration-300 relative`}>
      {/* Brand */}
      <div className={`flex items-center gap-3 px-5 h-16 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        {!collapsed && <span className="font-bold text-lg tracking-tight">BrokerIQ</span>}
      </div>

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-gray-900 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-5 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
              <Shield size={14} className="text-primary-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-300">Super Admin</p>
              <p className="text-[10px] text-gray-500">v1.0.0</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
