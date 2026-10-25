import React, { useState, useEffect } from 'react';
import {
  Calculator,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Info,
  DollarSign,
  Calendar,
  Percent,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AffordabilityResult } from '../types';
import { api } from '../services/api';

export const AffordabilityView: React.FC = () => {
  const [income, setIncome] = useState<number>(145000);
  const [expenses, setExpenses] = useState<number>(48000);
  const [existingEmi, setExistingEmi] = useState<number>(18500);
  const [loanAmount, setLoanAmount] = useState<number>(5500000);
  const [interestRate, setInterestRate] = useState<number>(8.5);
  const [tenureYears, setTenureYears] = useState<number>(20);

  const [result, setResult] = useState<AffordabilityResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const calculate = async () => {
    setLoading(true);
    try {
      const data = await api.calculateAffordability({
        monthly_income: income,
        monthly_expenses: expenses,
        existing_emi: existingEmi,
        requested_amount: loanAmount,
        interest_rate: interestRate,
        tenure_months: tenureYears * 12,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculate();
  }, [income, expenses, existingEmi, loanAmount, interestRate, tenureYears]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Title & Introduction */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Loan Affordability & Debt Obligation Analyzer</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluate monthly EMI commitments, debt-to-income (FOIR) tolerance, and safe borrowing capacity before applying.
          </p>
        </div>

        {/* Disclaimer Tag */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Informational Estimate • Not Loan Approval</span>
        </div>
      </div>

      {/* Main Grid: Inputs vs Realtime Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Input Controls (5 cols) */}
        <div className="lg:col-span-5 fintech-card p-6 bg-white space-y-5">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            <span>Financial Inputs & Loan Parameters</span>
          </h3>

          {/* Monthly Income */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-700">Monthly Net Income</label>
              <span className="font-bold text-blue-600">₹{income.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={25000}
              max={500000}
              step={5000}
              value={income}
              onChange={(e) => setIncome(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              value={income}
              onChange={(e) => setIncome(Math.max(1000, Number(e.target.value)))}
              className="w-full px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Monthly Living Expenses */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-700">Monthly Household Expenses</label>
              <span className="font-bold text-slate-800">₹{expenses.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={10000}
              max={300000}
              step={2000}
              value={expenses}
              onChange={(e) => setExpenses(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              value={expenses}
              onChange={(e) => setExpenses(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Existing Loan Obligations */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-700">Existing Loan / Credit Card EMIs</label>
              <span className="font-bold text-amber-600">₹{existingEmi.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={0}
              max={150000}
              step={1000}
              value={existingEmi}
              onChange={(e) => setExistingEmi(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              value={existingEmi}
              onChange={(e) => setExistingEmi(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="border-t border-slate-100 pt-3"></div>

          {/* Requested Loan Amount */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-700">Requested Loan Principal</label>
              <span className="font-bold text-blue-700">₹{loanAmount.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={500000}
              max={20000000}
              step={100000}
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(Math.max(100000, Number(e.target.value)))}
              className="w-full px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Interest Rate & Tenure Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Interest Rate (% p.a.)</label>
              <input
                type="number"
                step="0.1"
                min="5"
                max="25"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Tenure (Years)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={tenureYears}
                onChange={(e) => setTenureYears(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Key Outputs & DTI Gauge (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main EMI Highlight Card */}
          <div className="fintech-card p-6 bg-gradient-to-br from-blue-900 to-slate-900 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-200 font-semibold uppercase tracking-wider">
                  Estimated Monthly Loan EMI
                </p>
                <div className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">
                  ₹{result ? result.calculation.monthly_emi.toLocaleString('en-IN') : '47,703'}
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    result?.affordability_metrics.risk_color === 'emerald'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : result?.affordability_metrics.risk_color === 'amber'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                  }`}
                >
                  {result?.affordability_metrics.risk_category || 'Moderate Risk'}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  FOIR: <span className="font-bold text-white">{result?.affordability_metrics.dti_ratio}%</span>
                </p>
              </div>
            </div>

            {/* Repayment Breakdown Row */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Principal Amount</p>
                <p className="font-bold text-white text-sm mt-0.5">
                  ₹{loanAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Total Interest</p>
                <p className="font-bold text-blue-300 text-sm mt-0.5">
                  ₹{result ? Math.round(result.calculation.total_interest).toLocaleString('en-IN') : '0'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Total Repayment</p>
                <p className="font-bold text-emerald-300 text-sm mt-0.5">
                  ₹{result ? Math.round(result.calculation.total_repayment).toLocaleString('en-IN') : '0'}
                </p>
              </div>
            </div>
          </div>

          {/* DTI / Cashflow Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="fintech-card p-5 bg-white">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Remaining Monthly Surplus
              </span>
              <div className="text-2xl font-extrabold text-emerald-700 mt-2">
                ₹{result ? result.affordability_metrics.remaining_discretionary_income.toLocaleString('en-IN') : '30,797'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Discretionary balance after living costs & all EMIs
              </p>
            </div>

            <div className="fintech-card p-5 bg-white">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Max Recommended Loan Principal
              </span>
              <div className="text-2xl font-extrabold text-blue-700 mt-2">
                ₹{result ? result.affordability_metrics.max_recommended_loan.toLocaleString('en-IN') : '58,50,000'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Calculated at standard 50% FOIR cap threshold
              </p>
            </div>
          </div>

          {/* Amortization Curve Chart */}
          <div className="fintech-card p-6 bg-white">
            <h4 className="font-bold text-slate-900 text-sm mb-1">Amortization Trajectory Over Tenure</h4>
            <p className="text-xs text-slate-500 mb-4">Remaining Principal vs Cumulative Interest</p>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={result?.amortization_timeline || []}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(val: any) => `₹${(val / 100000).toFixed(0)}L`} />
                  <Tooltip
                    formatter={(val: any) => `₹${Number(val || 0).toLocaleString('en-IN')}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="remaining_balance"
                    name="Remaining Principal"
                    stroke="#2563eb"
                    fillOpacity={1}
                    fill="url(#balanceGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="interest_paid"
                    name="Cumulative Interest Paid"
                    stroke="#f59e0b"
                    fillOpacity={1}
                    fill="url(#interestGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable Recommendations & Assumptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="fintech-card p-6 bg-white">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>AI Affordability Guidance</span>
          </h4>
          <ul className="space-y-2.5 text-xs text-slate-600">
            {result?.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                <span className="text-blue-600 font-bold">•</span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="fintech-card p-6 bg-white">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-slate-600" />
            <span>Transparent Calculation Assumptions</span>
          </h4>
          <ul className="space-y-2.5 text-xs text-slate-600">
            {result?.assumptions.map((ass, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-slate-400 font-bold">•</span>
                <span className="leading-relaxed">{ass}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Prominent Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs leading-relaxed flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-900">Statutory Notice: </span>
          {result?.disclaimer ||
            'These calculations and metrics are algorithmic estimations for financial planning and budgeting purposes only. They do NOT constitute a loan sanction, pre-approval, credit guarantee, or contractual commitment by any lending institution.'}
        </div>
      </div>
    </div>
  );
};
