'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { LANGUAGE_CODES, languageOf, localizeDates, makeTranslator, type Dictionary, type LanguageCode, type Translator } from '@brokeriq/shared';

/**
 * UI language. `null` = the original interface (Hindi/English mix, unchanged). A chosen
 * language is applied by translating rendered text in place (see DomTranslator), so pages
 * need no code changes. User-generated content never matches a dictionary entry and the
 * Super Admin panel is left as is.
 */
export { LANG_KEY } from './i18n-boot';
import { LANG_KEY } from './i18n-boot';
type Ctx = { lang: LanguageCode | null; setLang: (l: LanguageCode | null) => void; t: Translator };
const identity = Object.assign((s: string) => s, { has: () => false }) as Translator;
const I18nCtx = createContext<Ctx>({ lang: null, setLang: () => undefined, t: identity });
export const useI18n = () => useContext(I18nCtx);

const loaders: Record<LanguageCode, () => Promise<{ default: Dictionary }>> = {
  en: () => import('@brokeriq/shared/dist/i18n/locales/en.json'),
  hi: () => import('@brokeriq/shared/dist/i18n/locales/hi.json'),
  bn: () => import('@brokeriq/shared/dist/i18n/locales/bn.json'),
  mr: () => import('@brokeriq/shared/dist/i18n/locales/mr.json'),
  te: () => import('@brokeriq/shared/dist/i18n/locales/te.json'),
  ta: () => import('@brokeriq/shared/dist/i18n/locales/ta.json'),
  gu: () => import('@brokeriq/shared/dist/i18n/locales/gu.json'),
  kn: () => import('@brokeriq/shared/dist/i18n/locales/kn.json'),
  ml: () => import('@brokeriq/shared/dist/i18n/locales/ml.json'),
  or: () => import('@brokeriq/shared/dist/i18n/locales/or.json'),
  pa: () => import('@brokeriq/shared/dist/i18n/locales/pa.json'),
  as: () => import('@brokeriq/shared/dist/i18n/locales/as.json'),
  ur: () => import('@brokeriq/shared/dist/i18n/locales/ur.json'),
};

const readLang = (): LanguageCode | null => {
  try {
    const v = localStorage.getItem(LANG_KEY) as LanguageCode | null;
    return v && LANGUAGE_CODES.includes(v) ? v : null;
  } catch {
    return null;
  }
};
const PROMPTED_KEY = 'biq.lang.prompted';
const markPrompted = () => {
  try {
    localStorage.setItem(PROMPTED_KEY, '1');
  } catch {
    /* private mode */
  }
};
/**
 * The browser's language (e.g. "ta-IN" → "ta"), suggested once. Skipped for English/Hindi browsers —
 * the default interface is already Hindi + English — and never shown inside the Super Admin panel.
 */
const browserLanguageToSuggest = (): LanguageCode | null => {
  try {
    if (localStorage.getItem(LANG_KEY) || localStorage.getItem(PROMPTED_KEY) || window.location.pathname.startsWith('/admin')) return null;
    for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
      const code = tag.toLowerCase().split('-')[0] as LanguageCode;
      if (code === 'en' || code === 'hi') return null;
      if (LANGUAGE_CODES.includes(code)) return code;
    }
  } catch {
    /* storage blocked */
  }
  return null;
};
const release = () => document.documentElement.classList.remove('i18n-pending');
let activeLang: LanguageCode | null = null;
if (typeof window !== 'undefined') localizeDates(() => activeLang);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode | null>(null);
  const [t, setT] = useState<Translator>(() => identity);
  useEffect(() => {
    const l = readLang();
    if (!l) release();
    setLangState(l);
  }, []);
  useEffect(() => {
    const code = lang ? null : browserLanguageToSuggest();
    if (!code) return;
    const timer = setTimeout(() => {
      const l = languageOf(code);
      markPrompted();
      toast(`BrokerIQ ${l.native} में देखें? · Use BrokerIQ in ${l.name}?`, {
        duration: 15_000,
        action: { label: `${l.native} ✓`, onClick: () => setLangRef.current(code) },
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [lang]);
  useEffect(() => {
    let alive = true;
    activeLang = lang;
    document.documentElement.lang = lang ?? 'en';
    if (!lang) {
      setT(() => identity);
      return;
    }
    loaders[lang]()
      .then((m) => alive && setT(() => makeTranslator(m.default)))
      .catch(() => release());
    return () => {
      alive = false;
    };
  }, [lang]);
  const setLang = useCallback((l: LanguageCode | null) => {
    try {
      if (l) localStorage.setItem(LANG_KEY, l);
      else localStorage.removeItem(LANG_KEY);
    } catch {
      /* private mode */
    }
    setLangState(l);
    window.dispatchEvent(new Event('biq-lang'));
  }, []);
  const setLangRef = useRef(setLang);
  setLangRef.current = setLang;
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return (
    <I18nCtx.Provider value={value}>
      {children}
      <DomTranslator />
    </I18nCtx.Provider>
  );
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP = 'script,style,code,pre,textarea,noscript,[data-no-i18n],[contenteditable="true"]';

/** Translates visible text + a few attributes in place and keeps doing so as React re-renders. */
function DomTranslator() {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const tracked = useRef(new Map<Text, { src: string; out: string }>());
  const trackedAttr = useRef(new Map<Element, Record<string, { src: string; out: string }>>());

  useEffect(() => {
    const texts = tracked.current;
    const attrs = trackedAttr.current;
    const active = !!lang && t.has !== identity.has && !pathname.startsWith('/admin');
    const revert = () => {
      for (const [node, v] of texts) if (node.isConnected && node.nodeValue === v.out) node.nodeValue = v.src;
      for (const [el, m] of attrs) for (const [a, v] of Object.entries(m)) if (el.getAttribute(a) === v.out) el.setAttribute(a, v.src);
      texts.clear();
      attrs.clear();
    };
    if (!active) {
      revert();
      if (!lang || pathname.startsWith('/admin')) release();
      return;
    }
    const doText = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP)) return;
      const cur = node.nodeValue ?? '';
      const prev = texts.get(node);
      const src = prev && cur === prev.out ? prev.src : cur;
      if (!/[A-Za-zऀ-ॿ]/.test(src)) return;
      const out = t(src);
      texts.set(node, { src, out });
      if (out !== cur) node.nodeValue = out;
    };
    const doEl = (el: Element) => {
      if (el.closest(SKIP)) return;
      for (const a of ATTRS) {
        const cur = el.getAttribute(a);
        if (!cur) continue;
        const m = attrs.get(el) ?? {};
        const prev = m[a];
        const src = prev && cur === prev.out ? prev.src : cur;
        const out = t(src);
        m[a] = { src, out };
        attrs.set(el, m);
        if (out !== cur) el.setAttribute(a, out);
      }
    };
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      if (el.closest(SKIP)) return;
      doEl(el);
      el.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(',')).forEach(doEl);
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) doText(n as Text);
    };
    walk(document.body);
    release();
    let queued: Node[] = [];
    let raf = 0;
    const flush = () => {
      raf = 0;
      const batch = queued;
      queued = [];
      for (const n of batch) if (n.isConnected) walk(n);
      for (const n of texts.keys()) if (!n.isConnected) texts.delete(n);
    };
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') queued.push(m.target);
        else if (m.type === 'attributes') queued.push(m.target);
        else m.addedNodes.forEach((n) => queued.push(n));
      }
      if (!raf) raf = requestAnimationFrame(flush);
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    return () => {
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [t, lang, pathname]);
  return null;
}
