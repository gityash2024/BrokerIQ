'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Building,
  PlusCircle,
  MessageSquare,
  ShieldCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react';

const ownerNavItems = [
  { label: 'Owner Dashboard', href: '/owner', icon: LayoutDashboard },
  { label: 'My Listed Properties', href: '/owner/properties', icon: Building, badge: '3' },
  { label: 'Post New Property', href: '/owner/post-property', icon: PlusCircle, badge: 'Wizard' },
  { label: 'Inbound Enquiries', href: '/owner/enquiries', icon: MessageSquare, badge: '28' },
  { label: 'Trust Badges & KYC', href: '/owner/verification', icon: ShieldCheck, badge: 'Verified' },
  { label: 'Visibility Boost Credits', href: '/owner/credits', icon: Zap, badge: '250' },
];

export function OwnerSidebar() {
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
        <div className="w-8 h-8 bg-sky-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-sky-600/30">
          <Home size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="font-extrabold text-base tracking-tight text-white block">Owner Portal</span>
            <span className="text-[10px] font-semibold text-sky-400 tracking-wider uppercase block">
              Landlord & Seller
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
        {ownerNavItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/owner' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group ${
                collapsed ? 'justify-center' : 'justify-between'
              } ${
                isActive
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40 font-semibold'
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
                    isActive ? 'bg-sky-800 text-sky-100' : 'bg-gray-800 text-sky-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Trust & Boost Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-800/80 bg-gray-950/60">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-gray-400 font-medium">Trust Status</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck size={12} /> Verified
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
            <span>Boost Credits: 250</span>
            <span className="text-sky-400 font-medium">3 Promoted</span>
          </div>
        </div>
      )}
    </aside>
  );
}
