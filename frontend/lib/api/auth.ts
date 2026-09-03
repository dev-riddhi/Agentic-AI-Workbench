import { apiClient } from './client';
import { TokenResponse, User } from './types';

export const authApi = {
  login: async (email: string, password: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/users/login', { email, password });
    return response.data;
  },

  register: async (name: string, email: string, password: string): Promise<User> => {
    const response = await apiClient.post<User>('/users/', { name, email, password });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/users/me');
    return response.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    try {
      await apiClient.post('/users/logout', { refresh_token: refreshToken });
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },
};
