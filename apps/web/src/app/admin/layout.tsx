'use client';

import React from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Header } from '@/components/Header';
import { PortalGuard } from '@/components/PortalGuard';
import { Role } from '@brokeriq/shared';

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalGuard allowedRoles={[Role.SUPER_ADMIN, 'SUPER_ADMIN']} portalName="Super Admin Command Center">
      <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100">
        <AdminSidebar />
        <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-gray-950">
          <Header />
          <main className="flex-1 p-6 md:p-8 bg-gray-950">{children}</main>
        </div>
      </div>
    </PortalGuard>
  );
}
