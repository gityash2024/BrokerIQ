'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Building2,
  Briefcase,
  Home,
  Compass,
} from 'lucide-react';
import { useAuth, PERSONA_LIST, getPersonaKeyFromRole, PersonaConfig } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const PERSONA_ICONS: Record<string, React.ReactNode> = {
  SUPER_ADMIN: <ShieldAlert size={16} className="text-purple-400" />,
  AGENCY_MANAGER: <Building2 size={16} className="text-amber-400" />,
  BROKER_AGENT: <Briefcase size={16} className="text-teal-400" />,
  PROPERTY_OWNER: <Home size={16} className="text-sky-400" />,
  SEEKER: <Compass size={16} className="text-rose-400" />,
};

const CHIP_THEMES: Record<string, { bg: string; border: string; glow: string; text: string; ring: string }> = {
  purple: {
    bg: 'bg-purple-950/40 hover:bg-purple-950/80',
    border: 'border-purple-800/60 hover:border-purple-600',
    glow: 'hover:shadow-purple-500/20',
    text: 'text-purple-300',
    ring: 'ring-purple-500/50',
  },
  amber: {
    bg: 'bg-amber-950/40 hover:bg-amber-950/80',
    border: 'border-amber-800/60 hover:border-amber-600',
    glow: 'hover:shadow-amber-500/20',
    text: 'text-amber-300',
    ring: 'ring-amber-500/50',
  },
  teal: {
    bg: 'bg-teal-950/40 hover:bg-teal-950/80',
    border: 'border-teal-800/60 hover:border-teal-600',
    glow: 'hover:shadow-teal-500/20',
    text: 'text-teal-300',
    ring: 'ring-teal-500/50',
  },
  sky: {
    bg: 'bg-sky-950/40 hover:bg-sky-950/80',
    border: 'border-sky-800/60 hover:border-sky-600',
    glow: 'hover:shadow-sky-500/20',
    text: 'text-sky-300',
    ring: 'ring-sky-500/50',
  },
  rose: {
    bg: 'bg-rose-950/40 hover:bg-rose-950/80',
    border: 'border-rose-800/60 hover:border-rose-600',
    glow: 'hover:shadow-rose-500/20',
    text: 'text-rose-300',
    ring: 'ring-rose-500/50',
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { quickLogin } = useAuth();

  const [selectedPersonaKey, setSelectedPersonaKey] = useState<string>('SUPER_ADMIN');
  const [email, setEmail] = useState<string>('admin@brokeriq.in');
  const [password, setPassword] = useState<string>('Password@123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [quickLoginRole, setQuickLoginRole] = useState<string | null>(null);

  // 1-Click quick login handler for demo chips
  const handleQuickLoginChip = async (persona: PersonaConfig) => {
    const key = getPersonaKeyFromRole(persona.role);
    setSelectedPersonaKey(key);
    setEmail(persona.email);
    setPassword('Password@123');
    setQuickLoginRole(key);
    setError('');

    try {
      await quickLogin(key);
    } catch (err: any) {
      console.error('Quick login error:', err);
      setError(err?.message || 'Quick login failed');
    } finally {
      setQuickLoginRole(null);
    }
  };

  // Standard form submission handler
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Find if email matches one of the 5 personas
      const matchedPersona = PERSONA_LIST.find(
        (p) => p.email.toLowerCase() === email.trim().toLowerCase()
      );
      const targetKey = matchedPersona ? getPersonaKeyFromRole(matchedPersona.role) : selectedPersonaKey;

      // Attempt live API authentication
      try {
        const data = await api.auth.login({ email: email.trim(), password });
        if (data?.accessToken) {
          localStorage.setItem('token', data.accessToken);
          localStorage.setItem(
            'user',
            JSON.stringify(
              data.user || {
                email,
                role: matchedPersona?.role || 'SUPER_ADMIN',
                name: matchedPersona?.name || 'Administrator',
              }
            )
          );
          localStorage.setItem('activePersona', targetKey);
          router.push(matchedPersona?.portalRoute || '/admin');
          return;
        }
      } catch (apiErr) {
        console.warn('Live API returned error, activating demo auth session fallback:', apiErr);
      }

      // Demo fallback if API is offline or custom credentials used
      await quickLogin(targetKey);
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err.response?.data?.message || err.message || 'Authentication failed. Please verify credentials.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedPersona = PERSONA_LIST.find((p) => getPersonaKeyFromRole(p.role) === selectedPersonaKey) || PERSONA_LIST[0];

  return (
    <div className="min-h-screen flex bg-gray-950 font-sans selection:bg-teal-500 selection:text-white">
      {/* Left Panel - Enterprise Brand Experience */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-950 via-gray-900 to-gray-950 relative overflow-hidden flex-col justify-between p-12 border-r border-gray-800">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <span className="text-white font-extrabold text-2xl tracking-tighter">B</span>
          </div>
          <div>
            <span className="text-white text-xl font-bold tracking-tight">BrokerIQ</span>
            <span className="ml-2 text-[10px] font-semibold tracking-wider text-teal-400 uppercase bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-800">
              Enterprise Marketplace
            </span>
          </div>
        </div>

        {/* Main Content Showcase */}
        <div className="relative z-10 my-auto py-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-900/40 border border-teal-800 text-teal-300 text-xs font-medium mb-6">
            <ShieldCheck size={14} className="text-teal-400" />
            <span>Unified Multi-Role Real Estate Architecture</span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Next-Gen Multi-Role <br />
            <span className="bg-gradient-to-r from-teal-400 via-emerald-300 to-teal-200 bg-clip-text text-transparent">
              Property CRM & Marketplace
            </span>
          </h1>

          <p className="text-gray-400 text-sm leading-relaxed max-w-lg mb-8">
            Tailored workflow hubs for Super Admins, Agency Managers, Field Broker Agents, Commercial Property Owners, and Home Seekers inspired by Housing.com, Linear, and Stripe.
          </p>

          <div className="grid grid-cols-2 gap-3.5 max-w-lg mb-8">
            <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800/80 backdrop-blur">
              <p className="text-xl font-bold text-white tracking-tight">5 Dedicated</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Role Portals & Layouts</p>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800/80 backdrop-blur">
              <p className="text-xl font-bold text-white tracking-tight">54 Catalog Units</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Gurgaon Commercial Register</p>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800/80 backdrop-blur">
              <p className="text-xl font-bold text-white tracking-tight">7.5% – 9.2%</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Prevailing Rental Yield ROI</p>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800/80 backdrop-blur">
              <p className="text-xl font-bold text-white tracking-tight">1-Tap Switch</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Instant Persona Demos</p>
            </div>
          </div>

          {/* Persona Pills Showcase */}
          <div className="flex flex-wrap gap-2">
            {PERSONA_LIST.map((p) => {
              const theme = CHIP_THEMES[p.accentColor];
              return (
                <div
                  key={p.role}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${theme.bg} ${theme.border} ${theme.text}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                  <span>{p.title}</span>
                  <span className="text-[10px] opacity-60 font-mono">({p.portalRoute})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-gray-500 pt-6 border-t border-gray-800/60">
          <span>BrokerIQ Multi-Tenant Platform v2.0</span>
          <span>Row-Level Isolation & Unified Identity</span>
        </div>
      </div>

      {/* Right Panel - Sign In Console with 1-Click Persona Chips */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-gray-950 overflow-y-auto">
        <div className="w-full max-w-lg my-auto">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <span className="text-white font-extrabold text-xl">B</span>
            </div>
            <span className="text-white text-xl font-bold tracking-tight">BrokerIQ</span>
          </div>

          <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white tracking-tight">Platform Sign In</h2>
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider bg-teal-950/80 px-2.5 py-1 rounded-full border border-teal-800">
                  Demo Ready
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Select a persona chip below for 1-click instant login, or enter your credentials.
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1-Click Quick-Login Chips Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} />
                  1-Click Quick Demo Login (Select Persona)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {PERSONA_LIST.map((persona) => {
                  const key = getPersonaKeyFromRole(persona.role);
                  const isSelected = selectedPersonaKey === key;
                  const isLoggingIn = quickLoginRole === key;
                  const theme = CHIP_THEMES[persona.accentColor];

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={loading || quickLoginRole !== null}
                      onClick={() => handleQuickLoginChip(persona)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all group ${
                        theme.bg
                      } ${theme.border} ${theme.glow} ${
                        isSelected ? `ring-2 ${theme.ring} shadow-md` : ''
                      } disabled:opacity-60 active:scale-[0.99]`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${theme.border} bg-gray-900/90 shadow-sm`}
                        >
                          {PERSONA_ICONS[key]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors">
                              {persona.title}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {persona.portalRoute}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 truncate">
                            {persona.name} · <span className="text-gray-400">{persona.email}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {isLoggingIn ? (
                          <Loader2 size={15} className="animate-spin text-teal-400" />
                        ) : (
                          <span className="text-[11px] font-semibold text-gray-400 group-hover:text-teal-400 flex items-center gap-1 transition-colors">
                            <span>Launch</span>
                            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-900 px-3 text-gray-500 font-medium text-[10px] tracking-wider">
                  Or Sign In with Credentials
                </span>
              </div>
            </div>

            {/* Standard Credentials Form */}
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@brokeriq.in"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-950/80 border border-gray-800 rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-11 py-2.5 bg-gray-950/80 border border-gray-800 rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || quickLoginRole !== null}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-teal-900/40 hover:shadow-teal-600/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Authenticating Session...</span>
                    </>
                  ) : (
                    <span>Sign In to {selectedPersona.title} ({selectedPersona.portalRoute})</span>
                  )}
                </button>
              </div>
            </form>

            {/* Seed User Info */}
            <div className="mt-5 pt-4 border-t border-gray-800/80 text-center">
              <p className="text-[11px] text-gray-400">
                Seeded demo password: <code className="text-teal-300 font-mono">Password@123</code> for all 5 personas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
