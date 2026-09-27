import { useSyncExternalStore } from 'react';

/** Tiny zustand-like store (no extra dependency). */
export function create<T extends object>(init: (set: (p: Partial<T> | ((s: T) => Partial<T>)) => void, get: () => T) => T) {
  let state: T;
  const subs = new Set<() => void>();
  const get = () => state;
  const set = (p: Partial<T> | ((s: T) => Partial<T>)) => {
    state = { ...state, ...(typeof p === 'function' ? p(state) : p) };
    subs.forEach((f) => f());
  };
  state = init(set, get);
  function useStore<U>(sel: (s: T) => U): U {
    return useSyncExternalStore(
      (cb) => (subs.add(cb), () => subs.delete(cb)),
      () => sel(state),
      () => sel(state),
    );
  }
  useStore.getState = get;
  useStore.setState = set;
  return useStore;
}
