'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '@/lib/api';
import type { DeedData } from '@/types';

interface FileUploadProps {
  onDataExtracted: (data: DeedData) => void;
  onUploadStart: () => void;
  isProcessing: boolean;
}

export default function FileUpload({
  onDataExtracted,
  onUploadStart,
  isProcessing,
}: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setError(null);
      onUploadStart();
      setUploadProgress('Uploading file...');

      try {
        setUploadProgress('Processing with OCR...');
        const result = await api.extractDeed(file);

        if (!result.success) {
          throw new Error(result.error || 'Failed to extract deed data');
        }

        setUploadProgress('Extraction complete!');
        setTimeout(() => {
          onDataExtracted(result as any);
        }, 500);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to process deed document'
        );
        setUploadProgress('');
      }
    },
    [onDataExtracted, onUploadStart]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/tiff': ['.tif', '.tiff'],
    },
    multiple: false,
    disabled: isProcessing,
  });

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Upload Deed Document
        </h2>
        <p className="text-gray-600">
          Upload a deed file (PDF or image) to extract property information
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`
          border-3 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center space-y-4">
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
              <p className="text-lg font-medium text-gray-700">
                {uploadProgress}
              </p>
              <p className="text-sm text-gray-500">
                This may take a moment...
              </p>
            </>
          ) : (
            <>
              <svg
                className="w-16 h-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>

              {isDragActive ? (
                <p className="text-lg font-medium text-blue-600">
                  Drop the deed file here...
                </p>
              ) : (
                <>
                  <p className="text-lg font-medium text-gray-700">
                    Drag & drop a deed file here, or click to browse
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports PDF, PNG, JPG, TIFF formats
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Upload your existing deed document</li>
          <li>OCR automatically extracts key information</li>
          <li>Review and edit the extracted data</li>
          <li>Generate trust transfer deed and PCOR form</li>
          <li>Download completed documents</li>
        </ol>
      </div>
    </div>
  );
}
