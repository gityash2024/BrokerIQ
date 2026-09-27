import { useQuery } from '@tanstack/react-query';
export const useProperties = () => useQuery({ queryKey: ['properties'], queryFn: () => Promise.resolve([]) });