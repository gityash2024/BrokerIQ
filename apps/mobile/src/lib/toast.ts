import { create } from './store';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
  action?: { label: string; onPress: () => void };
}
export const useToasts = create<{ items: ToastItem[] }>(() => ({ items: [] }));
let n = 0;
function push(type: ToastItem['type'], text: string, action?: ToastItem['action']) {
  const id = ++n;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, type, text, action }] }));
  setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), type === 'error' ? 5000 : 3000);
}
export const toast = {
  success: (t: string) => push('success', t),
  error: (t: string, action?: ToastItem['action']) => push('error', t, action),
  info: (t: string) => push('info', t),
};
