export const isAuthenticated = () => typeof window !== 'undefined' && !!localStorage.getItem('token');
