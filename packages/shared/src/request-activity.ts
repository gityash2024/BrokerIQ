/** One activity per user-visible operation, including its retries and response body. */
export function createRequestActivity() {
  let pending = 0;
  const listeners = new Set<() => void>();
  const update = (delta: number) => {
    pending += delta;
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => pending,
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
