'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useState, useSyncExternalStore, type SetStateAction } from 'react';
import { captureAccountContext } from './api';

const HISTORY_KEY = 'brokeriqNavigation';
const MAX_REMEMBERED_ENTRIES = 40;
type Entry = { id: number; scope: string; path: string; previousPath?: string };
type View = { values: Map<string, unknown>; scroll?: [number, number]; containers?: Map<string, [number, number]> };

let serial = 0;
let scope = '';
let installed = false;
let publishQueued = false;
const views = new Map<number, View>();
const listeners = new Set<() => void>();

function currentEntry(): Entry | undefined {
  if (!installed) return undefined;
  const entry = window.history.state?.[HISTORY_KEY] as Entry | undefined;
  return entry?.scope === scope ? entry : undefined;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish() {
  if (publishQueued) return;
  publishQueued = true;
  queueMicrotask(() => {
    publishQueued = false;
    listeners.forEach((listener) => listener());
  });
}

function viewFor(id: number): View {
  const view = views.get(id) ?? { values: new Map<string, unknown>() };
  views.delete(id);
  views.set(id, view);
  if (views.size > MAX_REMEMBERED_ENTRIES) views.delete(views.keys().next().value!);
  return view;
}

export function installNavigationHistory() {
  const history = window.history;
  const pushState = history.pushState;
  const replaceState = history.replaceState;
  const pathFor = (url?: string | URL | null) => url ? new URL(url, window.location.href).pathname : window.location.pathname;
  const newEntry = (path: string, previousPath?: string): Entry => ({ id: ++serial, scope, path, previousPath });
  const withEntry = (state: unknown, entry: Entry) => ({ ...(state as object), [HISTORY_KEY]: entry });
  const accountKey = () => {
    const context = captureAccountContext();
    return JSON.stringify([context.scope, context.revision]);
  };
  let account = accountKey();
  let scrollFrame = 0;
  let restoring = false;

  const cancelRestore = () => {
    window.cancelAnimationFrame(scrollFrame);
    restoring = false;
  };
  const rememberScroll = (event?: Event) => {
    const entry = currentEntry();
    if (!entry || restoring) return;
    const target = event?.target;
    if (target instanceof HTMLElement) {
      const key = target.dataset.routeScroll;
      if (key) {
        const view = viewFor(entry.id);
        (view.containers ??= new Map()).set(key, [target.scrollLeft, target.scrollTop]);
      }
    } else viewFor(entry.id).scroll = [window.scrollX, window.scrollY];
  };
  const restoreScroll = () => {
    cancelRestore();
    const entry = currentEntry();
    const view = entry && views.get(entry.id);
    if (entry && view && (view.scroll || view.containers?.size)) {
      const position = view.scroll;
      restoring = true;
      const deadline = performance.now() + 800;
      const restore = () => {
        if (currentEntry()?.id !== entry.id) return cancelRestore();
        let waiting = false;
        if (position) {
          window.scrollTo({ left: position[0], top: position[1], behavior: 'instant' });
          waiting = Math.abs(window.scrollY - position[1]) > 1;
        }
        if (view.containers?.size) {
          const containers = document.querySelectorAll<HTMLElement>('[data-route-scroll]');
          containers.forEach((container) => {
            const saved = view.containers?.get(container.dataset.routeScroll ?? '');
            if (!saved) return;
            container.scrollTo({ left: saved[0], top: saved[1], behavior: 'instant' });
            waiting ||= Math.abs(container.scrollTop - saved[1]) > 1;
          });
        }
        if (waiting && performance.now() < deadline) {
          scrollFrame = window.requestAnimationFrame(restore);
        } else cancelRestore();
      };
      scrollFrame = window.requestAnimationFrame(() => { scrollFrame = window.requestAnimationFrame(restore); });
    }
    publish();
  };
  const reset = () => {
    cancelRestore();
    views.clear();
    scope = crypto.randomUUID?.() ?? Date.now() + '-' + Math.random();
    replaceState.call(history, withEntry(history.state, newEntry(pathFor())), '');
    publish();
  };
  const accountChanged = () => {
    const next = accountKey();
    if (next === account) return;
    account = next;
    reset();
  };

  // Compose with Next's History API integration so router.push, links and
  // same-document query changes all share browser back/forward entries.
  history.pushState = (state, title, url) => {
    rememberScroll();
    cancelRestore();
    pushState.call(history, withEntry(state, newEntry(pathFor(url), currentEntry()?.path)), title, url);
    publish();
  };
  history.replaceState = (state, title, url) => {
    const path = pathFor(url);
    const current = currentEntry();
    if (current && current.path !== path) cancelRestore();
    const entry = current?.path === path ? current : newEntry(path, current?.previousPath);
    replaceState.call(history, withEntry(state, entry), title, url);
    publish();
  };
  installed = true;
  reset();
  window.addEventListener('popstate', restoreScroll);
  window.addEventListener('scroll', rememberScroll, { capture: true, passive: true });
  window.addEventListener('wheel', cancelRestore, { passive: true });
  window.addEventListener('touchstart', cancelRestore, { passive: true });
  window.addEventListener('biq-auth', accountChanged);
  window.addEventListener('storage', accountChanged);
  return () => {
    window.removeEventListener('popstate', restoreScroll);
    window.removeEventListener('scroll', rememberScroll, true);
    window.removeEventListener('wheel', cancelRestore);
    window.removeEventListener('touchstart', cancelRestore);
    window.removeEventListener('biq-auth', accountChanged);
    window.removeEventListener('storage', accountChanged);
    cancelRestore();
    history.pushState = pushState;
    history.replaceState = replaceState;
    installed = false;
    views.clear();
  };
}

/** View state is kept in this tab for the specific visit and account. */
export function useRouteState<T>(key: string, initial: T | (() => T)) {
  const pathname = usePathname();
  const [fallback, setFallback] = useState(initial);
  const id = useSyncExternalStore(subscribe, () => {
    const entry = currentEntry();
    return entry?.path === pathname ? entry.id : undefined;
  }, () => undefined);
  const read = () => {
    const values = id === undefined ? undefined : views.get(id)?.values;
    return values?.has(key) ? values.get(key) as T : fallback;
  };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const setValue = useCallback((next: SetStateAction<T>) => {
    if (id === undefined) return setFallback(next);
    if (currentEntry()?.id !== id) return;
    const values = viewFor(id).values;
    const previous = values.has(key) ? values.get(key) as T : fallback;
    const result = typeof next === 'function' ? (next as (value: T) => T)(previous) : next;
    if (Object.is(previous, result)) return;
    values.set(key, result);
    publish();
  }, [id, key, fallback]);
  return [value, setValue] as const;
}

/** Drill into another view within the current page, keeping the parent view in history. */
export function pushRouteView(values: Record<string, unknown>) {
  const current = currentEntry();
  if (!current) return false;
  const previous = views.get(current.id);
  window.history.pushState(window.history.state, '');
  const next = currentEntry();
  if (!next || next.id === current.id) return false;
  const view = viewFor(next.id);
  view.values = new Map(previous?.values);
  for (const [key, value] of Object.entries(values)) view.values.set(key, value);
  publish();
  return true;
}

export function hasPreviousPage({ samePath = false } = {}) {
  const entry = currentEntry();
  return !!entry?.previousPath && (!samePath || entry.previousPath === entry.path);
}

export function shouldReturnTo(href: string) {
  return currentEntry()?.previousPath === new URL(href, window.location.href).pathname;
}

export function useGoBack(fallback: string, { samePath = false } = {}) {
  const router = useRouter();
  return useCallback(() => {
    if (hasPreviousPage({ samePath })) router.back();
    else router.replace(fallback);
  }, [router, fallback, samePath]);
}
