'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Settings,
  Activity,
  Shield,
  Heart,
  ToggleRight,
  Plug,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  BadgeCheck,
  ShieldAlert,
} from 'lucide-react';

const adminNavItems = [
  { label: 'Command Center', href: '/admin', icon: LayoutDashboard },
  { label: 'Listing Moderation', href: '/admin/moderation', icon: CheckSquare, badge: '14' },
  { label: 'Seller KYC Verification', href: '/admin/kyc', icon: BadgeCheck, badge: '8' },
  { label: 'Tenant Organizations', href: '/admin/tenants', icon: Building2 },
  { label: 'Subscription Plans', href: '/plans', icon: CreditCard },
  { label: 'Active Subscriptions', href: '/subscriptions', icon: Users },
  { label: 'Feature Flags', href: '/feature-flags', icon: ToggleRight },
  { label: 'API Integrations', href: '/integrations', icon: Plug },
  { label: 'Analytics Telemetry', href: '/analytics', icon: Activity },
  { label: 'Audit Ledger', href: '/audit-logs', icon: FileText },
  { label: 'System Health', href: '/system-health', icon: Heart },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${
        collapsed ? 'w-[72px]' : 'w-64'
      } bg-gray-950 text-white flex flex-col transition-all duration-300 relative border-r border-gray-800 shrink-0`}
    >
      {/* Brand & Persona Header */}
      <div className={`flex items-center gap-3 px-5 h-16 border-b border-gray-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/30">
          <ShieldAlert size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="font-extrabold text-base tracking-tight text-white block">BrokerIQ</span>
            <span className="text-[10px] font-semibold text-purple-400 tracking-wider uppercase block">
              Super Admin Center
            </span>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-gray-900 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors z-20 shadow-md"
        title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {adminNavItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group ${
                collapsed ? 'justify-center' : 'justify-between'
              } ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <div className="flex items-center gap-3 min-w-0">
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!collapsed && item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                    isActive ? 'bg-purple-800 text-purple-100' : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-800/80 bg-gray-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30 font-bold text-xs">
              SA
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-200 truncate">Platform Governance</p>
              <p className="text-[10px] text-gray-500">Universal Access Mode</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
