'use client';
import dynamic from 'next/dynamic';
export const Map = dynamic(() => import('./map-view'), { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-none" /> });
export type { MapPoint } from './map-view';
