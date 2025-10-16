// API utilities for the deed automation app

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// API object with methods
export const api = {
  async uploadPDF(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/api/ocr`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Failed to process PDF');
    }
    
    return response.json();
  },

  async generateDeed(data: any) {
    const response = await fetch(`${API_BASE_URL}/api/generate-deed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate deed');
    }
    
    return response.blob();
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
