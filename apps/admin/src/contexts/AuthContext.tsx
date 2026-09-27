'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Role } from '@brokeriq/shared';
import { api } from '@/lib/api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role | string;
  organizationId?: string;
  organizationName?: string;
  avatar?: string;
  title?: string;
  phone?: string;
}

export interface PersonaConfig {
  role: Role | string;
  title: string;
  name: string;
  email: string;
  portalRoute: string;
  organizationName: string;
  avatar: string;
  accentColor: 'purple' | 'amber' | 'teal' | 'sky' | 'rose';
  description: string;
  badgeClass: string;
  glowClass: string;
}

export const PERSONA_DEFINITIONS: Record<string, PersonaConfig> = {
  SUPER_ADMIN: {
    role: Role.SUPER_ADMIN,
    title: 'Super Admin',
    name: 'Aarav Mehta',
    email: 'admin@brokeriq.in',
    portalRoute: '/admin',
    organizationName: 'BrokerIQ Platform HQ',
    avatar: 'AM',
    accentColor: 'purple',
    description: 'Platform control, listing moderation, KYC approvals & telemetry',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    glowClass: 'shadow-purple-500/20 border-purple-500/50',
  },
  AGENCY_MANAGER: {
    role: Role.BROKER_ADMIN,
    title: 'Agency Manager',
    name: 'Rajesh Sharma',
    email: 'rajesh.sharma@founder-realty.in',
    portalRoute: '/agency',
    organizationName: 'Founder Realty India',
    avatar: 'RS',
    accentColor: 'amber',
    description: 'Agency seats (8/10), lead allocation engine & agency CRM pipeline',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    glowClass: 'shadow-amber-500/20 border-amber-500/50',
  },
  BROKER_AGENT: {
    role: Role.BROKER_AGENT,
    title: 'Broker Agent',
    name: 'Amit Verma',
    email: 'amit.verma@founder-realty.in',
    portalRoute: '/agent',
    organizationName: 'Founder Realty India',
    avatar: 'AV',
    accentColor: 'teal',
    description: 'Field CRM, my leads, listing book scanner & client follow-ups',
    badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    glowClass: 'shadow-teal-500/20 border-teal-500/50',
  },
  PROPERTY_OWNER: {
    role: Role.PROPERTY_OWNER,
    title: 'Property Owner',
    name: 'Deepak Singhania',
    email: 'deepak.owner@brokeriq.in',
    portalRoute: '/owner',
    organizationName: 'Direct Landlord / Owner',
    avatar: 'DS',
    accentColor: 'sky',
    description: '3-step property wizard, direct buyer inquiries & trust badges',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    glowClass: 'shadow-sky-500/20 border-sky-500/50',
  },
  SEEKER: {
    role: Role.SEEKER,
    title: 'Seeker / Buyer',
    name: 'Vikram Malhotra',
    email: 'vikram.seeker@brokeriq.in',
    portalRoute: '/portal',
    organizationName: 'Verified Property Seeker',
    avatar: 'VM',
    accentColor: 'rose',
    description: 'Marketplace discovery search, saved units, EMI & yield calculator',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    glowClass: 'shadow-rose-500/20 border-rose-500/50',
  },
};

export const PERSONA_LIST: PersonaConfig[] = Object.values(PERSONA_DEFINITIONS);

export function getPersonaByRole(roleOrKey: string): PersonaConfig {
  if (PERSONA_DEFINITIONS[roleOrKey]) {
    return PERSONA_DEFINITIONS[roleOrKey];
  }
  if (roleOrKey === Role.SUPER_ADMIN) return PERSONA_DEFINITIONS.SUPER_ADMIN;
  if (roleOrKey === Role.BROKER_ADMIN) return PERSONA_DEFINITIONS.AGENCY_MANAGER;
  if (roleOrKey === Role.BROKER_STAFF || roleOrKey === Role.BROKER_AGENT) return PERSONA_DEFINITIONS.BROKER_AGENT;
  if (roleOrKey === Role.PROPERTY_OWNER) return PERSONA_DEFINITIONS.PROPERTY_OWNER;
  if (roleOrKey === Role.SEEKER) return PERSONA_DEFINITIONS.SEEKER;
  return PERSONA_DEFINITIONS.SUPER_ADMIN;
}

export function getPersonaKeyFromRole(roleOrKey: string): string {
  if (roleOrKey === 'SUPER_ADMIN' || roleOrKey === Role.SUPER_ADMIN) return 'SUPER_ADMIN';
  if (roleOrKey === 'AGENCY_MANAGER' || roleOrKey === Role.BROKER_ADMIN) return 'AGENCY_MANAGER';
  if (roleOrKey === 'BROKER_AGENT' || roleOrKey === Role.BROKER_AGENT || roleOrKey === Role.BROKER_STAFF) return 'BROKER_AGENT';
  if (roleOrKey === 'PROPERTY_OWNER' || roleOrKey === Role.PROPERTY_OWNER) return 'PROPERTY_OWNER';
  if (roleOrKey === 'SEEKER' || roleOrKey === Role.SEEKER) return 'SEEKER';
  return 'SUPER_ADMIN';
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  activePersona: PersonaConfig;
  isLoading: boolean;
  switchPersona: (targetPersonaKey: string) => Promise<void>;
  quickLogin: (personaKey: string) => Promise<void>;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaConfig>(PERSONA_DEFINITIONS.SUPER_ADMIN);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage or URL route on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      const storedPersonaKey = localStorage.getItem('activePersona');

      if (storedToken) {
        setToken(storedToken);
      }

      let detectedPersonaKey = storedPersonaKey || 'SUPER_ADMIN';

      // Infer persona from pathname if visiting directly
      if (pathname.startsWith('/admin')) {
        detectedPersonaKey = 'SUPER_ADMIN';
      } else if (pathname.startsWith('/agency')) {
        detectedPersonaKey = 'AGENCY_MANAGER';
      } else if (pathname.startsWith('/agent')) {
        detectedPersonaKey = 'BROKER_AGENT';
      } else if (pathname.startsWith('/owner')) {
        detectedPersonaKey = 'PROPERTY_OWNER';
      } else if (pathname.startsWith('/portal')) {
        detectedPersonaKey = 'SEEKER';
      }

      const persona = getPersonaByRole(detectedPersonaKey);
      setActivePersona(persona);

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          setUser({
            id: `usr-${persona.role.toLowerCase()}`,
            name: persona.name,
            email: persona.email,
            role: persona.role,
            organizationName: persona.organizationName,
            title: persona.title,
            avatar: persona.avatar,
          });
        }
      } else if (storedToken) {
        setUser({
          id: `usr-${persona.role.toLowerCase()}`,
          name: persona.name,
          email: persona.email,
          role: persona.role,
          organizationName: persona.organizationName,
          title: persona.title,
          avatar: persona.avatar,
        });
      }
    } catch (e) {
      console.error('Error hydrating AuthContext:', e);
    } finally {
      setIsLoading(false);
    }
  }, [pathname]);

  const switchPersona = async (targetPersonaKey: string) => {
    const persona = getPersonaByRole(targetPersonaKey);
    setActivePersona(persona);

    const updatedUser: UserProfile = {
      id: `usr-${persona.role.toLowerCase()}`,
      name: persona.name,
      email: persona.email,
      role: persona.role,
      organizationName: persona.organizationName,
      title: persona.title,
      avatar: persona.avatar,
    };

    setUser(updatedUser);

    // Persist demo token if none exists so the portal routes are accessible
    const existingToken = localStorage.getItem('token') || `demo-token-${persona.role.toLowerCase()}-${Date.now()}`;
    localStorage.setItem('token', existingToken);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    localStorage.setItem('activePersona', targetPersonaKey);
    setToken(existingToken);

    // Call API switch-role endpoint if available (non-blocking)
    try {
      await api.auth.login({ email: persona.email, password: 'Password@123' }).catch(() => null);
    } catch {
      // Non-blocking fallback for offline/demo
    }

    // Navigate to target portal route
    router.push(persona.portalRoute);
  };

  const quickLogin = async (personaKey: string) => {
    const persona = getPersonaByRole(personaKey);
    setActivePersona(persona);

    const demoUser: UserProfile = {
      id: `usr-${persona.role.toLowerCase()}`,
      name: persona.name,
      email: persona.email,
      role: persona.role,
      organizationName: persona.organizationName,
      title: persona.title,
      avatar: persona.avatar,
    };

    let authToken = `demo-jwt-${persona.role.toLowerCase()}-${Date.now()}`;

    // Attempt live API login; if succeeds, use real JWT token
    try {
      const data = await api.auth.login({
        email: persona.email,
        password: 'Password@123',
      });
      if (data?.accessToken) {
        authToken = data.accessToken;
        if (data.user) {
          demoUser.id = data.user.id;
          demoUser.name = data.user.name || persona.name;
          demoUser.organizationId = data.user.organizationId;
        }
      }
    } catch {
      // Graceful fallback for offline demo testing
    }

    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(demoUser));
    localStorage.setItem('activePersona', personaKey);
    setToken(authToken);
    setUser(demoUser);

    router.push(persona.portalRoute);
  };

  const logout = () => {
    try {
      api.auth.logout().catch(() => null);
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('activePersona');
      setToken(null);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activePersona,
        isLoading,
        switchPersona,
        quickLogin,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
