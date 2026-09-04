import { apiClient } from './client';
import { SettingsResponse, SettingsUpdatePayload } from './types';

export const settingsApi = {
  async getSettings(): Promise<SettingsResponse> {
    const response = await apiClient.get<SettingsResponse>('/settings');
    return response.data;
  },

  async updateSettings(payload: SettingsUpdatePayload): Promise<SettingsResponse> {
    const response = await apiClient.put<SettingsResponse>('/settings', payload);
    return response.data;
  },
};
