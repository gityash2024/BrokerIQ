'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { api } from './api';

export function usePropertyGallery(inventoryId?: string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['property-gallery', user?.id, inventoryId],
    queryFn: () => api<{ url: string; caption: string }>(`/inventory/${inventoryId}/photo-gallery`, { method: 'POST' }),
    enabled: !!user && !!inventoryId && enabled,
  });
}
