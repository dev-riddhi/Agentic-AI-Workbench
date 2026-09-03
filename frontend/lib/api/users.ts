import { apiClient } from './client';
import { User } from './types';

export const usersApi = {
  getUsers: async (skip = 0, limit = 100): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/users/', {
      params: { skip, limit },
    });
    return response.data;
  },

  getUser: async (id: string): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  },

  createUser: async (name: string, email: string, password?: string): Promise<User> => {
    const response = await apiClient.post<User>('/users/', { name, email, password });
    return response.data;
  },

  updateUser: async (id: string, payload: Partial<{ name: string; email: string; password?: string }>): Promise<User> => {
    const response = await apiClient.patch<User>(`/users/${id}`, payload);
    return response.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },
};
