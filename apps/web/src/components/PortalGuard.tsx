'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getPersonaKeyFromRole } from '@/contexts/AuthContext';
import { Role } from '@brokeriq/shared';
import { ShieldCheck } from 'lucide-react';

interface PortalGuardProps {
  children: React.ReactNode;
  allowedRoles: (Role | string)[];
  portalName: string;
}

export function PortalGuard({ children, allowedRoles, portalName }: PortalGuardProps) {
  const router = useRouter();
  const { user, token, activePersona, isLoading } = useAuth();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // Check if token exists
    const hasToken = token || (typeof window !== 'undefined' && localStorage.getItem('token'));
    if (!hasToken) {
      router.push('/login');
      return;
    }

    const currentRole = activePersona?.role || (user?.role as Role) || Role.SUPER_ADMIN;

    // SUPER_ADMIN has universal access to inspect any portal for moderation & telemetry
    const isSuperAdmin =
      currentRole === Role.SUPER_ADMIN ||
      activePersona?.title === 'Super Admin' ||
      getPersonaKeyFromRole(currentRole) === 'SUPER_ADMIN';

    const isExplicitlyAllowed = allowedRoles.some((role) => {
      if (role === currentRole) return true;
      if (role === 'AGENCY_MANAGER' && (currentRole === Role.BROKER_ADMIN || currentRole === 'BROKER_ADMIN')) return true;
      if (role === 'BROKER_AGENT' && (currentRole === Role.BROKER_AGENT || currentRole === Role.BROKER_STAFF || currentRole === 'BROKER_STAFF')) return true;
      if (role === 'PROPERTY_OWNER' && currentRole === Role.PROPERTY_OWNER) return true;
      if (role === 'SEEKER' && currentRole === Role.SEEKER) return true;
      return false;
    });

    if (isSuperAdmin || isExplicitlyAllowed) {
      setAuthorized(true);
    } else {
      // Gracefully redirect to the user's authorized primary portal
      const targetPortal = activePersona?.portalRoute || '/admin';
      router.push(targetPortal);
    }
  }, [isLoading, token, user, activePersona, allowedRoles, router]);

  if (isLoading || !authorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-2xl backdrop-blur-xl">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
            <ShieldCheck size={20} className="absolute inset-0 m-auto text-teal-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-200">Authenticating {portalName}</p>
            <p className="text-xs text-gray-500 mt-0.5">Verifying role permissions & tenant scope...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
