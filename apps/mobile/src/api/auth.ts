import { apiClient } from './client';
export const login = (data: any) => apiClient.post('/auth/login', data);