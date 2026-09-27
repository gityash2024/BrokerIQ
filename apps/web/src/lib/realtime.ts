'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { authStore } from './api';
import { API_URL } from './utils';

let socket: Socket | null = null;
let token: string | null = null;

function getSocket(): Socket | null {
  const t = authStore.get()?.accessToken ?? null;
  if (!t) return null;
  if (socket && token === t) return socket;
  socket?.disconnect();
  token = t;
  socket = io(API_URL, { auth: { token: t }, transports: ['websocket', 'polling'], reconnectionDelayMax: 10_000 });
  return socket;
}

/** Subscribe to a realtime event from the API gateway (auto re-auth on token refresh). */
export function useRealtime<T = any>(event: string, handler: (data: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    let s = getSocket();
    const fn = (d: T) => ref.current(d);
    s?.on(event, fn);
    const onAuth = () => {
      s?.off(event, fn);
      s = getSocket();
      s?.on(event, fn);
    };
    window.addEventListener('biq-auth', onAuth);
    return () => {
      s?.off(event, fn);
      window.removeEventListener('biq-auth', onAuth);
    };
  }, [event]);
}
