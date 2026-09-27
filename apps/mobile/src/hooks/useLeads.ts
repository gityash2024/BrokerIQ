import { useQuery } from '@tanstack/react-query';
export const useLeads = () => useQuery({ queryKey: ['leads'], queryFn: () => Promise.resolve([]) });