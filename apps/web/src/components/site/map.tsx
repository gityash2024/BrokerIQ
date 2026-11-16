'use client';
import { LoadingArtwork } from '@/components/ui/request-loader';
import dynamic from 'next/dynamic';
export const Map = dynamic(() => import('./map-view'), { ssr: false, loading: () => <LoadingArtwork className="h-full w-full rounded-none" /> });
export type { MapPoint } from './map-view';
