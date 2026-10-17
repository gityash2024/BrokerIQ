import { QueryClient } from '@tanstack/react-query';

// Account-scoped disk drafts are independent of this disposable network cache.
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
