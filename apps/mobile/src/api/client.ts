import axios from 'axios';
import { Platform } from 'react-native';

/**
 * Resolves the appropriate backend API base URL depending on runtime environment.
 * On Android emulator, '10.0.2.2' is the host loopback alias for localhost.
 */
export const getBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://localhost:3000/api';
};

export const API_BASE_URL = getBaseUrl();

/**
 * Configured Axios instance with 4000ms timeout for rapid, seamless failover
 * to offline cache during demonstrations or disconnected mobile scenarios.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 4000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export default apiClient;