'use client';
import { Bell, Search, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PersonaSwitcher } from '@/components/PersonaSwitcher';

export function Header() {
  const { user, activePersona, logout } = useAuth();

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 shrink-0 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search listings, leads, units, documents..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-950/60 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Persona Switcher Dropdown */}
        <PersonaSwitcher />

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 hidden sm:block" />

        <button className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800" />

        {/* User Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs">
            {activePersona?.avatar || user?.avatar || 'SA'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-100 line-clamp-1">
              {activePersona?.name || user?.name || 'Aarav Mehta'}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-400 line-clamp-1">
              {activePersona?.title || user?.title || 'Super Admin'}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
          title="Sign Out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
