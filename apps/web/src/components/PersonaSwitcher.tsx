'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth, PERSONA_LIST, getPersonaKeyFromRole, PersonaConfig } from '@/contexts/AuthContext';
import {
  ShieldAlert,
  Building2,
  Briefcase,
  Home,
  Compass,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  SUPER_ADMIN: <ShieldAlert size={15} className="text-purple-400" />,
  AGENCY_MANAGER: <Building2 size={15} className="text-amber-400" />,
  BROKER_AGENT: <Briefcase size={15} className="text-teal-400" />,
  PROPERTY_OWNER: <Home size={15} className="text-sky-400" />,
  SEEKER: <Compass size={15} className="text-rose-400" />,
};

const ACCENT_STYLES: Record<string, { bg: string; border: string; text: string; glow: string; ring: string }> = {
  purple: {
    bg: 'bg-purple-950/60',
    border: 'border-purple-800/80',
    text: 'text-purple-300',
    glow: 'shadow-purple-500/20',
    ring: 'ring-purple-500/40',
  },
  amber: {
    bg: 'bg-amber-950/60',
    border: 'border-amber-800/80',
    text: 'text-amber-300',
    glow: 'shadow-amber-500/20',
    ring: 'ring-amber-500/40',
  },
  teal: {
    bg: 'bg-teal-950/60',
    border: 'border-teal-800/80',
    text: 'text-teal-300',
    glow: 'shadow-teal-500/20',
    ring: 'ring-teal-500/40',
  },
  sky: {
    bg: 'bg-sky-950/60',
    border: 'border-sky-800/80',
    text: 'text-sky-300',
    glow: 'shadow-sky-500/20',
    ring: 'ring-sky-500/40',
  },
  rose: {
    bg: 'bg-rose-950/60',
    border: 'border-rose-800/80',
    text: 'text-rose-300',
    glow: 'shadow-rose-500/20',
    ring: 'ring-rose-500/40',
  },
};

export function PersonaSwitcher() {
  const { activePersona, switchPersona } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeKey = getPersonaKeyFromRole(activePersona?.role || 'SUPER_ADMIN');
  const activeStyle = ACCENT_STYLES[activePersona?.accentColor || 'purple'];

  const handleSelectPersona = async (persona: PersonaConfig) => {
    const key = getPersonaKeyFromRole(persona.role);
    if (key === activeKey) {
      setIsOpen(false);
      return;
    }

    try {
      setIsSwitching(true);
      await switchPersona(key);
      setIsOpen(false);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-sm ${activeStyle.bg} ${activeStyle.border} ${activeStyle.text} hover:brightness-110 active:scale-98`}
        title="Switch Marketplace Persona"
      >
        <div className="flex items-center gap-1.5">
          <span className="flex items-center justify-center">
            {ROLE_ICONS[activeKey] || <ShieldAlert size={14} />}
          </span>
          <span className="font-semibold tracking-wide">{activePersona?.title || 'Super Admin'}</span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[11px] opacity-80 border-l border-white/20 pl-2">
          <span className="truncate max-w-[110px]">{activePersona?.name}</span>
        </div>

        <ChevronDown
          size={13}
          className={`transition-transform duration-200 opacity-70 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-88 rounded-2xl bg-gray-900/95 border border-gray-800 shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-teal-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Persona Switcher
              </span>
            </div>
            <span className="text-[10px] font-semibold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-800">
              Demo Active
            </span>
          </div>

          <div className="px-3 py-1.5 text-[11px] text-gray-400">
            Switch role to test dedicated portals with zero logout friction:
          </div>

          {/* List of 5 Personas */}
          <div className="space-y-1 mt-1">
            {PERSONA_LIST.map((persona) => {
              const personaKey = getPersonaKeyFromRole(persona.role);
              const isSelected = personaKey === activeKey;
              const pStyle = ACCENT_STYLES[persona.accentColor];

              return (
                <button
                  key={personaKey}
                  type="button"
                  disabled={isSwitching}
                  onClick={() => handleSelectPersona(persona)}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all group ${
                    isSelected
                      ? `${pStyle.bg} ${pStyle.border} border shadow-md ${pStyle.glow}`
                      : 'hover:bg-gray-800/60 border border-transparent'
                  }`}
                >
                  {/* Avatar Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${pStyle.border} ${pStyle.bg}`}
                  >
                    {ROLE_ICONS[personaKey]}
                  </div>

                  {/* Persona Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-100 group-hover:text-white">
                          {persona.title}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {persona.portalRoute}
                        </span>
                      </div>
                      {isSelected ? (
                        <div className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center">
                          <Check size={11} className="stroke-[3]" />
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 group-hover:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Switch →
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-300 font-medium truncate mt-0.5">
                      {persona.name} · <span className="text-gray-400">{persona.organizationName}</span>
                    </p>
                    <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                      {persona.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-gray-800/80 px-2 flex items-center justify-between text-[11px] text-gray-400">
            <span>Unified identity token preserved</span>
            <span className="text-teal-400 font-mono">Housing.com Mode</span>
          </div>
        </div>
      )}
    </div>
  );
}
