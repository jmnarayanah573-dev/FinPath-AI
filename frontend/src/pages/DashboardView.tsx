import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  FileCheck,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  PieChart as PieIcon,
  ChevronRight,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { Journey, DocumentItem, AffordabilityResult } from '../types';
import { api } from '../services/api';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenSanction: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenSanction,
}) => {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [affordability, setAffordability] = useState<AffordabilityResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jRes, dRes, aRes] = await Promise.allSettled([
          api.listJourneys(),
          api.listDocuments(),
          api.getLatestAffordability(),
        ]);

        if (jRes.status === 'fulfilled') setJourneys(jRes.value.journeys);
        if (dRes.status === 'fulfilled') setDocuments(dRes.value.documents);
        if (aRes.status === 'fulfilled' && aRes.value.record) {
          // fetch fresh calculated breakdown
          const calcRes = await api.calculateAffordability({
            monthly_income: aRes.value.record.monthly_income,
            monthly_expenses: aRes.value.record.monthly_expenses,
            existing_emi: aRes.value.record.existing_emi,
            requested_amount: aRes.value.record.requested_amount,
            interest_rate: aRes.value.record.interest_rate,
            tenure_months: aRes.value.record.tenure_months,
          });
          setAffordability(calcRes);
        } else {
          // Default initial calculation
          const defaultCalc = await api.calculateAffordability({
            monthly_income: 145000,
            monthly_expenses: 48000,
            existing_emi: 18500,
            requested_amount: 5500000,
            interest_rate: 8.5,
            tenure_months: 240,
          });
          setAffordability(defaultCalc);
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleToggleChecklist = async (journeyId: string, checkId: string, currentDone: boolean) => {
    try {
      await api.toggleChecklist(journeyId, checkId, !currentDone);
      // update state locally
      setJourneys((prev) =>
        prev.map((j) => {
          if (j.id === journeyId) {
            const updatedChecklist = j.data.checklist?.map((c) =>
              c.id === checkId ? { ...c, done: !currentDone } : c
            );
            return {
              ...j,
              data: { ...j.data, checklist: updatedChecklist },
            };
          }
          return j;
        })
      );
    } catch (e) {
      console.error(e);
    }
  };

  const activeJourney = journeys.length > 0 ? journeys[0] : null;
  const primaryChecklist = activeJourney?.data.checklist || [];

  // Data for Income vs Expense Pie
  const breakdownData = affordability
    ? [
        { name: 'Living Expenses', value: affordability.breakdown.living_expenses, color: '#f59e0b' },
        { name: 'Existing Obligations', value: affordability.breakdown.existing_obligations, color: '#64748b' },
        { name: 'Estimated New EMI', value: affordability.breakdown.new_loan_emi, color: '#2563eb' },
        { name: 'Discretionary Surplus', value: affordability.breakdown.unallocated_surplus, color: '#10b981' },
      ]
    : [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Goal Progress Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/30 text-blue-200 border border-blue-400/20">
                Active Financial Milestone
              </span>
              <span className="text-xs text-slate-400">Step 3 of 5</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              {activeJourney ? activeJourney.title : 'Dream Home Acquisition Loan'}
            </h2>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              Target Principal: ₹{activeJourney ? activeJourney.target_amount.toLocaleString('en-IN') : '55,00,000'}.
              Income documents verified with zero payment bounces. Ready for simulated underwriting review.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('journeys')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all"
            >
              <span>Continue Journey</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenSanction}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-slate-100 rounded-xl text-xs font-bold border border-white/20 flex items-center gap-2 transition-all"
            >
              <span>In-Principle Sanction Letter</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mini Step Trackers */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-6 pt-5 border-t border-white/10">
          {[
            { label: '1. Goal Setting', status: 'completed' },
            { label: '2. Affordability', status: 'completed' },
            { label: '3. Document Ingestion', status: 'current' },
            { label: '4. AI Underwriting', status: 'pending' },
            { label: '5. Sanction Letter', status: 'pending' },
          ].map((st, i) => (
            <div
              key={i}
              className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                st.status === 'completed'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                  : st.status === 'current'
                  ? 'bg-blue-900/60 text-blue-200 border border-blue-400/40 font-bold'
                  : 'bg-white/5 text-slate-400 border border-white/5'
              }`}
            >
              {st.status === 'completed' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : st.status === 'current' ? (
                <Clock className="w-3.5 h-3.5 text-blue-300 animate-pulse shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-slate-500 shrink-0" />
              )}
              <span className="truncate">{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4 Financial Health Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="fintech-card p-5 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Estimated Monthly EMI
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">
              ₹{affordability ? affordability.calculation.monthly_emi.toLocaleString('en-IN') : '47,703'}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Tenure: {affordability?.calculation.tenure_years || 20} Years</span>
              <span>•</span>
              <span>Rate: {affordability?.calculation.annual_interest_rate || 8.5}%</span>
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="fintech-card p-5 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Debt-to-Income (FOIR)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {affordability?.affordability_metrics.dti_ratio || 45.65}%
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {affordability?.affordability_metrics.risk_category || 'Moderate'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Prudent banking cap: <span className="font-semibold text-slate-700">50.0%</span>
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="fintech-card p-5 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Monthly Discretionary Surplus
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-emerald-700">
              ₹{affordability ? affordability.affordability_metrics.remaining_discretionary_income.toLocaleString('en-IN') : '30,797'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              After living expenses & all loan EMIs
            </p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="fintech-card p-5 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Max Eligible Loan Estimate
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-indigo-900">
              ₹{affordability ? affordability.affordability_metrics.max_recommended_loan.toLocaleString('en-IN') : '58,50,000'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Algorithmic pre-approval threshold
            </p>
          </div>
        </div>
      </div>

      {/* Middle Row: Visual Chart Breakdown & Pending Document Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Monthly Cashflow Distribution Chart (7 cols) */}
        <div className="lg:col-span-7 fintech-card p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Monthly Income Allocation Breakdown</h3>
              <p className="text-xs text-slate-500">Gross Monthly Inflow: ₹{affordability?.breakdown.income.toLocaleString('en-IN') || '1,45,000'}</p>
            </div>
            <button
              onClick={() => onNavigate('affordability')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Fine-tune Inputs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-7 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {breakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => `₹${Number(val || 0).toLocaleString('en-IN')}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="md:col-span-5 space-y-2.5 text-xs">
              {breakdownData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="text-slate-700 font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">₹{item.value.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transparent Assumptions Note */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
              Calculations assume standard monthly reducing balance.
            </span>
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
              Not a formal loan commitment
            </span>
          </div>
        </div>

        {/* Right: Document Verification Checklist (5 cols) */}
        <div className="lg:col-span-5 fintech-card p-6 bg-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Underwriting Checklist</h3>
                <p className="text-xs text-slate-500">Document readiness for Home Loan</p>
              </div>
              <button
                onClick={() => onNavigate('documents')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>Document Center</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 mt-4">
              {primaryChecklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() =>
                    activeJourney &&
                    handleToggleChecklist(activeJourney.id, item.id, item.done)
                  }
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    item.done
                      ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                      : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => {}}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className={`text-xs font-medium ${item.done ? 'line-through text-slate-500' : 'text-slate-800 font-semibold'}`}>
                      {item.label}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.done
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.done ? 'Verified' : 'Pending Upload'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigate('documents')}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Upload Remaining Property Agreement Draft</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: AI Personalized Guidance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="fintech-card p-5 bg-gradient-to-br from-blue-50/70 to-white border-blue-200/80">
          <div className="flex items-center gap-2 text-blue-700 font-bold text-sm mb-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h4>AI Affordability Recommendation</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your current FOIR is 45.6%. By extending tenure from 15 to 20 years, your estimated EMI reduces by ₹7,800/mo, leaving ₹30,797 liquid cash surplus.
          </p>
          <button
            onClick={() => onNavigate('affordability')}
            className="mt-3 text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1"
          >
            <span>Simulate Tenure Impact</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="fintech-card p-5 bg-gradient-to-br from-emerald-50/70 to-white border-emerald-200/80">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h4>Document OCR Verification</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Salary slip and 6-month bank statement matched with 98% confidence score. Net pay of ₹1,45,000 reconciled with statutory PF and tax credits.
          </p>
          <button
            onClick={() => onNavigate('documents')}
            className="mt-3 text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>View Extraction Log</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="fintech-card p-5 bg-gradient-to-br from-amber-50/70 to-white border-amber-200/80">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h4>Insurance Coverage Check</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your Care Supreme health policy has zero room rent capping. Note that pre-existing ailments have a 36-month waiting period from inception.
          </p>
          <button
            onClick={() => onNavigate('insurance')}
            className="mt-3 text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
          >
            <span>Inspect Policy Terms</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
