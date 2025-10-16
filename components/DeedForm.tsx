'use client';

import { useState, FormEvent } from 'react';
import { api, downloadPDF } from '@/lib/api';
import { COUNTIES } from '@/types';
import type { DeedData, County, TrustTransferData, PCORData } from '@/types';

interface DeedFormProps {
  initialData: DeedData;
  onReset: () => void;
}

export default function DeedForm({ initialData, onReset }: DeedFormProps) {
  // Form state
  const [apn, setApn] = useState(initialData.apn || '');
  const [address, setAddress] = useState(initialData.address || '');
  const [legalDescription, setLegalDescription] = useState(
    initialData.legalDescription || ''
  );
  const [grantor, setGrantor] = useState(initialData.grantee || ''); // Grantee becomes grantor
  const [trustName, setTrustName] = useState('');
  const [trustDate, setTrustDate] = useState('');
  const [county, setCounty] = useState<County>('Los Angeles');

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!apn || !address || !legalDescription || !grantor || !trustName || !trustDate) {
      setError('Please fill in all required fields');
      return;
    }

    setIsGenerating(true);

    try {
      // Generate Trust Transfer Deed
      const deedData: TrustTransferData = {
        grantor,
        trustName,
        trustDate,
        apn,
        address,
        legalDescription,
        county,
      };

      const deedResult = await api.generateDeed(deedData);

      if (!deedResult.success) {
        throw new Error(deedResult.error || 'Failed to generate deed');
      }

      // Generate PCOR form
      const pcorData: PCORData = {
        county,
        apn,
        address,
        grantor,
        trustName,
      };

      const pcorResult = await api.fillPCOR(pcorData);

      if (!pcorResult.success) {
        throw new Error(pcorResult.error || 'Failed to generate PCOR form');
      }

      // Download both documents
      if (deedResult.pdf && deedResult.filename) {
        downloadPDF(deedResult.pdf, deedResult.filename);
      }
      
      if (pcorResult.pdf && pcorResult.filename) {
        const pcorPdf = pcorResult.pdf;
        const pcorFilename = pcorResult.filename;
        setTimeout(() => {
          downloadPDF(pcorPdf, pcorFilename);
        }, 500);
      }

      setSuccess('Documents generated and downloaded successfully!');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate documents'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">
          Trust Transfer Information
        </h2>
        <button
          onClick={onReset}
          className="text-sm text-gray-600 hover:text-gray-800 underline"
        >
          Upload Different Deed
        </button>
      </div>

      {/* Extraction Info */}
      {initialData.deedType && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            <span className="font-semibold">Extracted from:</span>{' '}
            {initialData.deedType}
            {initialData.pageCount && ` (${initialData.pageCount} pages)`}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Property Information Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">
            Property Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                APN (Assessor's Parcel Number) *
              </label>
              <input
                type="text"
                value={apn}
                onChange={(e) => setApn(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                County *
              </label>
              <select
                value={county}
                onChange={(e) => setCounty(e.target.value as County)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                {COUNTIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Legal Description *
            </label>
            <textarea
              value={legalDescription}
              onChange={(e) => setLegalDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Full legal description as it appears on the original deed
            </p>
          </div>
        </div>

        {/* Transfer Information Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">
            Transfer Information
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Owner (Grantor) *
            </label>
            <input
              type="text"
              value={grantor}
              onChange={(e) => setGrantor(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Current owner who will transfer the property to the trust
            </p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trust Name *
            </label>
            <input
              type="text"
              value={trustName}
              onChange={(e) => setTrustName(e.target.value)}
              placeholder="e.g., The John Doe Revocable Living Trust"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trust Date *
            </label>
            <input
              type="text"
              value={trustDate}
              onChange={(e) => setTrustDate(e.target.value)}
              placeholder="e.g., January 15, 2024"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Date the trust was established
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-600">
            This will generate both the Trust Transfer Deed and PCOR form
          </p>
          <button
            type="submit"
            disabled={isGenerating}
            className={`
              px-8 py-3 rounded-lg font-semibold text-white
              transition-all duration-200
              ${
                isGenerating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              }
            `}
          >
            {isGenerating ? (
              <span className="flex items-center space-x-2">
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Generating...</span>
              </span>
            ) : (
              'Generate Documents'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
