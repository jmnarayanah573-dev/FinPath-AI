import React from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  FileCheck,
  Shield,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { SanctionLetter } from '../types';

interface SanctionLetterModalProps {
  sanction: SanctionLetter | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SanctionLetterModal: React.FC<SanctionLetterModalProps> = ({
  sanction,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !sanction) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="font-bold tracking-tight text-sm">FinPath AI – Credit Assessment System</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Letter</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sanction Certificate */}
        <div className="p-8 space-y-6 text-slate-800 text-sm">
          {/* Header of Sanction Certificate */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2 text-blue-700 font-extrabold text-xl tracking-tight">
                <Building2 className="w-6 h-6 text-blue-600" />
                <span>FinPath Credit Consortium</span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Automated Retail Lending Underwriting Division
              </p>
              <p className="text-xs text-slate-400 mt-1">Ref: <span className="font-mono font-semibold text-slate-700">{sanction.sanction_reference}</span></p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                IN-PRINCIPLE SANCTIONED
              </span>
              <p className="text-xs text-slate-500 mt-2">Date: <span className="font-semibold text-slate-700">{sanction.issue_date}</span></p>
              <p className="text-xs text-slate-500">Valid Until: <span className="font-semibold text-slate-700">{sanction.valid_until}</span></p>
            </div>
          </div>

          {/* Applicant & Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Primary Applicant</p>
                <p className="font-bold text-slate-900 text-base">{sanction.applicant_name}</p>
                <p className="text-xs text-slate-500">{sanction.applicant_email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Underwriting Assessment</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-extrabold text-slate-900">{sanction.underwriting_score} / 900</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {sanction.risk_grade}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Approved Terms Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60">
              <p className="text-xs text-blue-700 font-medium">In-Principle Sanction</p>
              <p className="text-xl font-extrabold text-blue-900 mt-1">
                ₹{sanction.sanctioned_amount.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-blue-600 mt-0.5">Subject to property valuation</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 font-medium">Indicative Interest Rate</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {sanction.indicative_rate}% <span className="text-xs font-normal text-slate-500">p.a.</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Floating (Repo-linked benchmark)</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 font-medium">Estimated Monthly EMI</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                ₹{sanction.estimated_monthly_emi.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Tenure: {sanction.max_tenure_years} Years</p>
            </div>
          </div>

          {/* Verified Criteria & Precedents */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Milestones</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {sanction.verified_conditions.map((cond, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{cond}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Conditions Precedent</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {sanction.conditions_precedent.map((cond, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>{cond}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Regulatory Disclaimer */}
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Regulatory & Fair Practice Notice: </span>
              {sanction.regulatory_disclaimer}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
