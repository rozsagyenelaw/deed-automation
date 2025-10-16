// API utilities for the deed automation app

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface APIResponse {
  success: boolean;
  pdf?: Blob;
  filename?: string;
  error?: string;
  [key: string]: any;
}

// API object with methods
export const api = {
  async extractDeed(file: File): Promise<APIResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_BASE_URL}/.netlify/functions/extract-deed`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: 'Failed to extract deed data'
        };
      }
      
      const data = await response.json();
      
      return {
        success: true,
        ...data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract deed data'
      };
    }
  },

  async generateDeed(data: any): Promise<APIResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/.netlify/functions/generate-deed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: 'Failed to generate deed'
        };
      }
      
      const blob = await response.blob();
      const filename = `${data.grantor.replace(/\s+/g, '_')}_Trust_Transfer_Deed.pdf`;
      
      return {
        success: true,
        pdf: blob,
        filename
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate deed'
      };
    }
  },

  async fillPCOR(data: any): Promise<APIResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/.netlify/functions/fill-pcor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: 'Failed to generate PCOR form'
        };
      }
      
      const blob = await response.blob();
      const filename = `${data.county.replace(/\s+/g, '_')}_PCOR_${data.apn}.pdf`;
      
      return {
        success: true,
        pdf: blob,
        filename
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate PCOR form'
      };
    }
  }
};

// Helper function to download PDF
export function downloadPDF(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
