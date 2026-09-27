import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL, useSession } from './api';

let socket: Socket | null = null;
let tokenUsed: string | null = null;

function getSocket(token: string | null) {
  if (!token) {
    socket?.disconnect();
    socket = null;
    tokenUsed = null;
    return null;
  }
  if (socket && tokenUsed === token) return socket;
  socket?.disconnect();
  tokenUsed = token;
  socket = io(SOCKET_URL, { path: '/socket.io', transports: ['websocket'], auth: { token } });
  return socket;
}

export function useRealtime<T = any>(event: string, handler: (d: T) => void) {
  const token = useSession((s) => s.session?.accessToken ?? null);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket(token);
    if (!s) return;
    const fn = (d: T) => ref.current(d);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event, token]);
}
