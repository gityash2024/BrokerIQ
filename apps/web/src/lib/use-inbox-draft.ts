'use client';
import { useEffect, useRef, useState } from 'react';
import { captureAccountContext, assertAccountContext, errorMessage } from './api';
import { readInboxDraft, saveInboxDraft, hasLegacyInboxDraft } from './inbox-drafts';
import { toast } from 'sonner';

export function useInboxDraft(target: string) {
  const owner = useRef(captureAccountContext()).current;
  const [text, setText] = useState(''),
    [loadedTarget, setLoadedTarget] = useState<string | null>(null),
    [legacy, setLegacy] = useState(false);
  const currentTarget = `${owner.scope}:${owner.revision}:${target}`;
  const ready = loadedTarget === currentTarget;
  const targetRef = useRef(target);
  targetRef.current = target;
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    setLoadedTarget(null);
    setText('');
    setLegacy(false);
    void (async () => {
      const saved = await readInboxDraft(target, owner);
      const preserved = await hasLegacyInboxDraft(target, owner);
      assertAccountContext(owner);
      if (active) {
        setText(saved);
        setLegacy(preserved);
        setLoadedTarget(currentTarget);
      }
    })().catch((error) => {
      if (active) toast.error(errorMessage(error));
    });
    return () => {
      active = false;
    };
  }, [target, owner, currentTarget]);
  useEffect(() => {
    if (!ready) return;
    writes.current = saveInboxDraft(target, text, owner);
    void writes.current.catch((error) => toast.error(errorMessage(error)));
  }, [text, ready, target, owner]);
  return {
    text: ready ? text : '',
    setText,
    ready,
    legacy: ready && legacy,
    owner,
    flush: async () => {
      if (!ready) throw new Error('Wait for the private draft to load.');
      await writes.current;
      await saveInboxDraft(target, text, owner);
    },
    clear: async () => {
      await saveInboxDraft(target, '', owner);
      assertAccountContext(owner);
      if (targetRef.current === target) setText('');
    },
  };
}
