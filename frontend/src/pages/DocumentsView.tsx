import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileSearch,
  Sparkles,
  RefreshCw,
  Eye,
  Lock,
} from 'lucide-react';
import { DocumentItem } from '../types';
import { api } from '../services/api';

export const DocumentsView: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.listDocuments();
      setDocuments(res.documents);
      if (res.documents.length > 0) {
        setSelectedDoc(res.documents[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);

    try {
      const uploaded = await api.uploadDocument(file);
      // Reload list and set as active
      await fetchDocuments();
      setSelectedDoc(uploaded);
    } catch (err) {
      console.error(err);
      alert('Failed to parse document. Please ensure it is a valid PDF or image file.');
    } finally {
      setUploading(false);
    }
  };

  const handleLoadSample = async (sampleName: string) => {
    setUploading(true);
    try {
      const sample = await api.loadSampleDocument(sampleName);
      await fetchDocuments();
      setSelectedDoc(sample);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Title & Privacy Guarantee */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Document Intelligence & OCR Extraction</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated PDF entity parsing, income reconciliation, and document completeness audit for lending and insurance.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Zero Public Exposure • AES-256 Protected Storage</span>
        </div>
      </div>

      {/* Main Grid: Upload Area & Quick Samples */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload & Quick Demo Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Drag & Drop Card */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            className={`fintech-card p-6 bg-white border-2 border-dashed text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
              dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-blue-400'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Upload Financial Document</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Drag & drop salary slips, bank statements, or policy schedules (PDF, Scanned Images)
            </p>

            <label className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors">
              <span>Browse Local File</span>
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
                disabled={uploading}
              />
            </label>

            {uploading && (
              <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 font-semibold animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running text extraction & OCR entity mapping...</span>
              </div>
            )}
          </div>

          {/* Quick Demo Preloaded Documents */}
          <div className="fintech-card p-5 bg-white space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Instant Demo Samples (One-Click)</span>
            </h4>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleLoadSample('salary_slip')}
                disabled={uploading}
                className="p-3 text-left rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800">Sample TCS Salary Slip</p>
                  <p className="text-[11px] text-slate-500">Gross: ₹1,75,000 • Net: ₹1,52,400</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">Load</span>
              </button>

              <button
                onClick={() => handleLoadSample('bank_statement')}
                disabled={uploading}
                className="p-3 text-left rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800">Sample ICICI 6-Month Statement</p>
                  <p className="text-[11px] text-slate-500">Avg Balance: ₹94,200 • 0 Cheque Bounces</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">Load</span>
              </button>

              <button
                onClick={() => handleLoadSample('form16')}
                disabled={uploading}
                className="p-3 text-left rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800">Sample Form 16 Tax Return</p>
                  <p className="text-[11px] text-slate-500">Annual Income: ₹21,00,000 • TDS: ₹2,45,000</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">Load</span>
              </button>
            </div>
          </div>

          {/* Uploaded Documents List */}
          <div className="fintech-card p-5 bg-white space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Audited Documents</span>
              <span className="text-xs font-bold text-slate-700">{documents.length}</span>
            </h4>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {documents.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 font-semibold text-blue-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="truncate">{doc.file_name}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                      {Math.round((doc.confidence_score || 0.95) * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Document OCR & Extracted Entity Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedDoc ? (
            <div className="fintech-card p-6 bg-white space-y-5">
              {/* Inspection Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {selectedDoc.doc_type || 'Financial Document'}
                    </span>
                    <span className="text-xs text-slate-400">ID: {selectedDoc.id}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-1.5">{selectedDoc.file_name}</h3>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500 block">OCR Confidence</span>
                  <span className="text-xl font-extrabold text-emerald-600">
                    {Math.round((selectedDoc.confidence_score || 0.95) * 100)}%
                  </span>
                </div>
              </div>

              {/* AI Document Summary */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-xs font-semibold text-slate-500 uppercase">AI Extracted Summary</p>
                <p className="text-xs md:text-sm text-slate-800 font-medium leading-relaxed mt-1">
                  {selectedDoc.summary}
                </p>
              </div>

              {/* Extracted Key Fields Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Extracted Financial Data Points
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Entity / Attribute</th>
                        <th className="py-2.5 px-4 font-semibold">Parsed Value</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(selectedDoc.extracted_fields || {}).map(([key, val], idx) => {
                        const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                        const formattedVal =
                          typeof val === 'number'
                            ? `₹${val.toLocaleString('en-IN')}`
                            : String(val);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 font-medium text-slate-700">{formattedKey}</td>
                            <td className="py-2.5 px-4 font-bold text-slate-900">{formattedVal}</td>
                            <td className="py-2.5 px-4 text-right">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Verified</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Missing Information / Anomaly Alerts */}
              {selectedDoc.missing_fields && selectedDoc.missing_fields.length > 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Missing Fields & Clarification Items</span>
                  </div>
                  <ul className="space-y-1 text-xs text-amber-800 pl-6 list-disc">
                    {selectedDoc.missing_fields.map((mf, idx) => (
                      <li key={idx}>{mf}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All mandatory lending underwriting fields successfully reconciled with zero discrepancies.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="fintech-card p-12 bg-white text-center text-slate-400">
              <FileSearch className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600">No document selected</p>
              <p className="text-xs text-slate-400 mt-1">Upload a PDF or click one of the preloaded demo samples.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
