import { apiClient } from './client';
import { AgentOutput, AgentOutputPreview } from './types';

export interface GetOutputsParams {
  skip?: number;
  limit?: number;
  agent_id?: string;
  output_type?: string;
  search?: string;
}

export const outputsApi = {
  getOutputs: async (params?: GetOutputsParams): Promise<AgentOutput[]> => {
    const response = await apiClient.get<AgentOutput[]>('/outputs/', {
      params,
    });
    return response.data;
  },

  getOutput: async (id: string): Promise<AgentOutput> => {
    const response = await apiClient.get<AgentOutput>(`/outputs/${id}`);
    return response.data;
  },

  downloadOutput: async (id: string, defaultFilename?: string, outputType?: string): Promise<void> => {
    const response = await apiClient.get(`/outputs/${id}/download`, {
      responseType: 'blob',
    });

    // Extract exact filename from Content-Disposition header sent by backend
    let filename = '';
    const disposition = response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'];
    if (disposition) {
      const matchUtf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (matchUtf8 && matchUtf8[1]) {
        filename = decodeURIComponent(matchUtf8[1]);
      } else {
        const matchRegular = disposition.match(/filename=["']?([^;"'\n]+)["']?/i);
        if (matchRegular && matchRegular[1]) {
          filename = matchRegular[1].trim();
        }
      }
    }

    // Fall back to defaultFilename if header missing
    if (!filename && defaultFilename) {
      filename = defaultFilename.trim();
    }
    if (!filename) {
      filename = 'output';
    }

    // Ensure the filename carries the agent's created file extension if missing
    if (!filename.includes('.')) {
      if (outputType) {
        const cleanType = outputType.toLowerCase().replace(/^\./, '');
        if (cleanType === 'markdown') {
          filename = `${filename}.md`;
        } else if (cleanType && cleanType !== 'file' && cleanType !== 'other') {
          filename = `${filename}.${cleanType}`;
        }
      }
    }

    const rawHeader = response.headers?.['content-type'];
    const contentType = typeof rawHeader === 'string' ? rawHeader : (filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    const blob = new Blob([response.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  previewOutput: async (id: string): Promise<AgentOutputPreview> => {
    const response = await apiClient.get<AgentOutputPreview>(`/outputs/${id}/preview`);
    return response.data;
  },

  deleteOutput: async (id: string): Promise<void> => {
    await apiClient.delete(`/outputs/${id}`);
  },
};
