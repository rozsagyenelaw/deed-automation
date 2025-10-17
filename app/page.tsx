'use client';

import { useState } from 'react';
import type { DeedData } from '@/types';

// Tab component
const tabs = ['Upload Deed', 'Trust Information', 'Generate Documents'];

export default function Home() {
  const [activeTab, setActiveTab] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form data
  const [grantor, setGrantor] = useState('');
  const [trustee, setTrustee] = useState('');
  const [trustName, setTrustName] = useState('');
  const [trustDate, setTrustDate] = useState('');
  const [apn, setApn] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState<'Los Angeles' | 'Ventura' | 'Riverside' | 'San Bernardino' | 'Orange'>('Los Angeles');
  const [legalDescription, setLegalDescription] = useState('');
  const [mailingAddress, setMailingAddress] = useState('');

  const counties = ['Los Angeles', 'Ventura', 'Riverside', 'San Bernardino', 'Orange'];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsProcessing(true);

    try {
      // Call OCR extraction
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/.netlify/functions/extract-deed', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setExtractedData(data);
        
        // Pre-fill form fields if data was extracted
        if (data) {
          setGrantor(data.grantor || '');
          setTrustee(data.trustee || '');
          setTrustName(data.trustName || '');
          setTrustDate(data.trustDate || '');
          setApn(data.apn || '');
          setPropertyAddress(data.propertyAddress || '');
          setCity(data.city || '');
          setCounty(data.county || 'Los Angeles');
          setLegalDescription(data.legalDescription || '');
          setMailingAddress(data.mailingAddress || '');
        }
        
        // Move to next tab
        setActiveTab(1);
      } else {
        alert('Failed to extract data from deed. Please enter information manually.');
        setActiveTab(1);
      }
    } catch (error) {
      console.error('Error extracting deed:', error);
      alert('Error processing deed. Please enter information manually.');
      setActiveTab(1);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateDeed = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/.netlify/functions/generate-deed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantor,
          trustee,
          trustName,
          trustDate,
          apn,
          propertyAddress,
          city,
          county,
          legalDescription,
          mailingAddress,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${grantor.replace(/\s+/g, '_')}_Trust_Transfer_Deed.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        alert('Trust Transfer Deed generated successfully!');
      } else {
        alert('Failed to generate Trust Transfer Deed');
      }
    } catch (error) {
      console.error('Error generating deed:', error);
      alert('Error generating Trust Transfer Deed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeneratePCOR = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/.netlify/functions/fill-pcor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          county,
          apn,
          propertyAddress,
          grantor,
          trustName,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${county.replace(/\s+/g, '_')}_PCOR_${apn}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        alert('PCOR form generated successfully!');
      } else {
        alert('Failed to generate PCOR form');
      }
    } catch (error) {
      console.error('Error generating PCOR:', error);
      alert('Error generating PCOR form');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Trust Transfer Deed Automation
          </h1>
          <p className="text-lg text-gray-600">
            Automated deed processing and document generation
          </p>
        </header>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="flex border-b">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(index)}
                className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                  activeTab === index
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {index + 1}. {tab}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* TAB 1: Upload Deed */}
            {activeTab === 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">Upload Original Deed</h2>
                <p className="text-gray-600">
                  Upload the current deed to extract property information automatically.
                </p>

                <div className="border-3 border-dashed border-gray-300 rounded-lg p-12 text-center">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={isProcessing}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center space-y-4"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                        <p className="text-lg font-medium text-gray-700">
                          Processing deed...
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
                        <p className="text-lg font-medium text-gray-700">
                          Click to upload deed (PDF)
                        </p>
                      </>
                    )}
                  </label>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => setActiveTab(1)}
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    Or skip and enter information manually →
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Trust Information */}
            {activeTab === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">Trust Transfer Information</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grantor (Current Owner) *
                    </label>
                    <input
                      type="text"
                      value={grantor}
                      onChange={(e) => setGrantor(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trustee (New Trustee) *
                    </label>
                    <input
                      type="text"
                      value={trustee}
                      onChange={(e) => setTrustee(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trust Name *
                    </label>
                    <input
                      type="text"
                      value={trustName}
                      onChange={(e) => setTrustName(e.target.value)}
                      placeholder="e.g., The John Doe Living Trust"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trust Date *
                    </label>
                    <input
                      type="date"
                      value={trustDate}
                      onChange={(e) => setTrustDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

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
                      onChange={(e) => setCounty(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {counties.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Address *
                    </label>
                    <input
                      type="text"
                      value={propertyAddress}
                      onChange={(e) => setPropertyAddress(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mailing Address *
                  </label>
                  <input
                    type="text"
                    value={mailingAddress}
                    onChange={(e) => setMailingAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setActiveTab(0)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setActiveTab(2)}
                    className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Generate Documents */}
            {activeTab === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">Generate Documents</h2>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-semibold text-blue-900 mb-2">Ready to Generate:</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                    <li>Trust Transfer Deed for {county} County</li>
                    <li>PCOR Form (select county below)</li>
                  </ul>
                </div>

                <div className="space-y-6">
                  {/* Trust Transfer Deed */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Trust Transfer Deed
                    </h3>
                    <button
                      onClick={handleGenerateDeed}
                      disabled={isProcessing}
                      className="w-full px-8 py-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Generating...' : '📄 Generate Trust Transfer Deed'}
                    </button>
                  </div>

                  {/* PCOR Form */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      PCOR Form (Preliminary Change of Ownership Report)
                    </h3>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select County for PCOR *
                      </label>
                      <select
                        value={county}
                        onChange={(e) => setCounty(e.target.value as any)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
                      >
                        <option value="Los Angeles">Los Angeles County</option>
                        <option value="Ventura">Ventura County</option>
                        <option value="Riverside">Riverside County</option>
                        <option value="San Bernardino">San Bernardino County</option>
                        <option value="Orange">Orange County</option>
                      </select>
                      <p className="mt-2 text-sm text-gray-500">
                        Each county has a different PCOR form format
                      </p>
                    </div>

                    <button
                      onClick={handleGeneratePCOR}
                      disabled={isProcessing}
                      className="w-full px-8 py-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Generating...' : `📋 Generate ${county} County PCOR`}
                    </button>
                  </div>
                </div>

                <div className="flex justify-start pt-4">
                  <button
                    onClick={() => setActiveTab(1)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    ← Back to Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
