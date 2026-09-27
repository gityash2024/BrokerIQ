'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Search,
  Bookmark,
  MessageSquare,
  Calculator,
  MapPin,
  LogOut,
  Bell,
} from 'lucide-react';
import { PersonaSwitcher } from '@/components/PersonaSwitcher';
import { useAuth } from '@/contexts/AuthContext';

const portalNavLinks = [
  { label: 'Marketplace', href: '/portal', icon: Compass },
  { label: 'Search & Filters', href: '/portal/search', icon: Search },
  { label: 'Saved Units', href: '/portal/saved', icon: Bookmark },
  { label: 'Inquiries Log', href: '/portal/inquiries', icon: MessageSquare },
  { label: 'EMI & ROI Calc', href: '/portal/calculator', icon: Calculator },
];

export function PortalNav() {
  const pathname = usePathname();
  const { user, activePersona, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Market Locator */}
          <div className="flex items-center gap-6">
            <Link href="/portal" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
                <Compass size={18} className="text-white" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block">BrokerIQ</span>
                <span className="text-[10px] font-semibold text-rose-400 tracking-wider uppercase block">
                  Discovery Marketplace
                </span>
              </div>
            </Link>

            {/* Micro-market Location Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-900 border border-gray-800 text-xs text-gray-300">
              <MapPin size={13} className="text-rose-400" />
              <span className="font-medium">Gurgaon Commercial Corridor</span>
              <span className="text-[10px] text-gray-500 font-mono">Sectors 86-90</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {portalNavLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-900/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-900'
                  }`}
                >
                  <item.icon size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions & Persona Switcher */}
          <div className="flex items-center gap-3">
            {/* Persona Switcher */}
            <PersonaSwitcher />

            <div className="w-px h-6 bg-gray-800 hidden sm:block" />

            <button className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-900 rounded-xl transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            </button>

            {/* User Pill */}
            <div className="hidden sm:flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center font-bold text-xs">
                {activePersona?.avatar || 'VM'}
              </div>
              <div className="text-left hidden xl:block">
                <p className="text-xs font-bold text-white">{activePersona?.name || 'Vikram Malhotra'}</p>
                <p className="text-[10px] text-gray-400">{activePersona?.title || 'Seeker / Investor'}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-gray-900 overflow-x-auto gap-2">
          {portalNavLinks.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap ${
                  isActive ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <item.icon size={13} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
