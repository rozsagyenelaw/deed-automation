// API utilities for the deed automation app

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function uploadPDF(file: File) {
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
}

export async function generateDeed(data: any) {
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
