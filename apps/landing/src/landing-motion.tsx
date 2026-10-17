'use client';

import { useEffect, useRef } from 'react';

/** Progressive enhancement: the server-rendered landing stays readable without JS. */
export function LandingMotion() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = marker.current?.closest<HTMLElement>('.biq-landing');
    if (!root || !('IntersectionObserver' in window)) return;

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-biq-reveal]'));
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    let entranceFrame = 0;

    function updateProgress() {
      frame = 0;
      if (!root) return;
      const bounds = root.getBoundingClientRect();
      const distance = Math.max(1, bounds.height - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -bounds.top / distance));
      root.style.setProperty('--biq-progress', String(progress));
    }

    function scheduleProgress() {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    }

    function configureMotion() {
      observer?.disconnect();
      window.cancelAnimationFrame(entranceFrame);
      for (const target of targets) {
        target.removeAttribute('data-biq-ready');
        target.removeAttribute('data-biq-visible');
      }
      if (preference.matches) return;

      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-biq-visible', '');
            observer?.unobserve(entry.target);
          }
        }
      }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });

      for (const target of targets) target.setAttribute('data-biq-ready', '');
      // Separate the initial and revealed styles so above-the-fold content animates too.
      entranceFrame = window.requestAnimationFrame(() => {
        for (const target of targets) observer?.observe(target);
      });
    }

    function revealFocusedContent(event: FocusEvent) {
      if (!(event.target instanceof Element)) return;
      let target = event.target.closest<HTMLElement>('[data-biq-reveal]');
      while (target && root?.contains(target)) {
        target.setAttribute('data-biq-visible', '');
        observer?.unobserve(target);
        target = target.parentElement?.closest<HTMLElement>('[data-biq-reveal]') ?? null;
      }
    }

    function navigateSection(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      const href = link?.getAttribute('href');
      const section = href ? Array.from(root!.querySelectorAll<HTMLElement>('[id]')).find((node) => `#${node.id}` === href) : null;
      if (!section) return;
      event.preventDefault();
      section.scrollIntoView({ behavior: preference.matches ? 'instant' : 'smooth', block: 'start' });
      window.history.pushState(null, '', href);
      section.focus({ preventScroll: true });
    }

    configureMotion();
    updateProgress();
    preference.addEventListener('change', configureMotion);
    window.addEventListener('scroll', scheduleProgress, { passive: true });
    window.addEventListener('resize', scheduleProgress);
    root.addEventListener('focusin', revealFocusedContent);
    root.addEventListener('click', navigateSection);
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(entranceFrame);
      preference.removeEventListener('change', configureMotion);
      window.removeEventListener('scroll', scheduleProgress);
      window.removeEventListener('resize', scheduleProgress);
      root.removeEventListener('focusin', revealFocusedContent);
      root.removeEventListener('click', navigateSection);
      for (const target of targets) {
        target.removeAttribute('data-biq-ready');
        target.removeAttribute('data-biq-visible');
      }
      root.style.removeProperty('--biq-progress');
    };
  }, []);

  return <span ref={marker} hidden aria-hidden="true" />;
}
