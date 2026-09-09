import { apiClient } from './client';
import { DocumentResponse } from './types';

export const documentsApi = {
  getDocuments: async (skip = 0, limit = 100): Promise<DocumentResponse[]> => {
    const response = await apiClient.get<DocumentResponse[]>('/documents/', {
      params: { skip, limit },
    });
    return response.data;
  },

  uploadDocument: async (
    file: File,
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void
  ): Promise<DocumentResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<DocumentResponse>('/documents/', formData, {
      onUploadProgress,
    });
    return response.data;
  },

  getDocument: async (id: string): Promise<DocumentResponse> => {
    const response = await apiClient.get<DocumentResponse>(`/documents/${id}`);
    return response.data;
  },

  downloadDocument: async (id: string, filename: string): Promise<void> => {
    const response = await apiClient.get(`/documents/${id}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  deleteDocument: async (id: string): Promise<void> => {
    await apiClient.delete(`/documents/${id}`);
  },
};
