/** One activity per user-visible operation, including its retries and response body. */
export function createRequestActivity() {
  let pending = 0;
  let visible = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const update = (delta: number) => {
    pending += delta;
    clearTimeout(hideTimer);
    if (pending) visible = true;
    else {
      hideTimer = setTimeout(() => {
        visible = false;
        emit();
      }, 220);
    }
    emit();
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => pending,
    getVisibility: () => visible,
    async track<T>(run: () => Promise<T>): Promise<T> {
      update(1);
      try {
        return await run();
      } finally {
        update(-1);
      }
    },
  };
}
