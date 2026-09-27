'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Users,
  GitBranch,
  Kanban,
  Building,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  LayoutDashboard,
} from 'lucide-react';

const agencyNavItems = [
  { label: 'Agency Dashboard', href: '/agency', icon: LayoutDashboard },
  { label: 'Team Agents & Seats', href: '/agency/team', icon: Users, badge: '8/10' },
  { label: 'Lead Allocation Rules', href: '/agency/allocation', icon: GitBranch, badge: 'Active' },
  { label: 'Unified CRM Pipeline', href: '/agency/pipeline', icon: Kanban, badge: '₹14.2Cr' },
  { label: 'Shared Inventory', href: '/agency/inventory', icon: Building, badge: '54 Units' },
  { label: 'Plan & Billing', href: '/agency/billing', icon: CreditCard, badge: 'Pro' },
];

export function AgencySidebar() {
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
        <div className="w-8 h-8 bg-amber-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-600/30">
          <Building2 size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="font-extrabold text-base tracking-tight text-white block truncate">Founder Realty</span>
            <span className="text-[10px] font-semibold text-amber-400 tracking-wider uppercase block">
              Agency Manager
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
        {agencyNavItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/agency' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group ${
                collapsed ? 'justify-center' : 'justify-between'
              } ${
                isActive
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40 font-semibold'
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
                    isActive ? 'bg-amber-800 text-amber-100' : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Quota Progress Meter Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-800/80 bg-gray-950/60">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-gray-400 font-medium">Broker Seat Quota</span>
            <span className="text-amber-400 font-bold">8 of 10</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '80%' }} />
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
            <TrendingUp size={11} className="text-emerald-400" />
            <span>2 seats remaining on Pro Plan</span>
          </p>
        </div>
      )}
    </aside>
  );
}
