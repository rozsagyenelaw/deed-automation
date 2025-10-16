'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import DeedForm from '@/components/DeedForm';
import DocumentPreview from '@/components/DocumentPreview';
import type { DeedData } from '@/types';

export default function Home() {
  const [extractedData, setExtractedData] = useState<DeedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDataExtracted = (data: DeedData) => {
    setExtractedData(data);
    setIsProcessing(false);
  };

  const handleUploadStart = () => {
    setIsProcessing(true);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Trust Transfer Deed Automation
          </h1>
          <p className="text-lg text-gray-600">
            Automated deed processing with OCR extraction and document generation
          </p>
        </header>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          {!extractedData ? (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <FileUpload
                onDataExtracted={handleDataExtracted}
                onUploadStart={handleUploadStart}
                isProcessing={isProcessing}
              />
            </div>
          ) : (
            <div className="space-y-6">
              <DeedForm
                initialData={extractedData}
                onReset={() => setExtractedData(null)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-600 text-sm">
          <p>
            &copy; {new Date().getFullYear()} Trust Transfer Deed Automation.
            Professional legal document automation.
          </p>
        </footer>
      </div>
    </main>
  );
}
