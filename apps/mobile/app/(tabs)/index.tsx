import React from 'react';
import { useAuth } from '../../src/stores/authStore';
import { SeekerExploreView } from '../../src/components/seeker/SeekerExploreView';
import { OwnerListingsView } from '../../src/components/owner/OwnerListingsView';
import { BrokerDashboardView } from '../../src/components/broker/BrokerDashboardView';

export default function DynamicHomeScreen() {
  const { activePersona } = useAuth();

  if (activePersona.mode === 'SEEKER') {
    return <SeekerExploreView />;
  }

  if (activePersona.mode === 'OWNER') {
    return <OwnerListingsView />;
  }

  return <BrokerDashboardView />;
}