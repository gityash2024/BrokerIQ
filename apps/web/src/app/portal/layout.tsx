'use client';

import React from 'react';
import { PortalNav } from '@/components/PortalNav';
import { PortalGuard } from '@/components/PortalGuard';
import { Role } from '@brokeriq/shared';

export default function SeekerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalGuard
      allowedRoles={[Role.SUPER_ADMIN, 'SUPER_ADMIN', Role.SEEKER, 'SEEKER']}
      portalName="Seeker Discovery Portal"
    >
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <PortalNav />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </PortalGuard>
  );
}
