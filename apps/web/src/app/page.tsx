'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck } from 'lucide-react';

export default function RootRedirectPage() {
  const router = useRouter();
  const { token, activePersona, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const hasToken = token || (typeof window !== 'undefined' && localStorage.getItem('token'));
    if (!hasToken) {
      router.replace('/login');
      return;
    }

    const targetRoute = activePersona?.portalRoute || '/admin';
    router.replace(targetRoute);
  }, [token, activePersona, isLoading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-950 text-white">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-2xl backdrop-blur-xl">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
          <ShieldCheck size={20} className="absolute inset-0 m-auto text-teal-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-200">Routing to Portal</p>
          <p className="text-xs text-gray-500 mt-0.5">Connecting to {activePersona?.title || 'Command Center'}...</p>
        </div>
      </div>
    </div>
  );
}
