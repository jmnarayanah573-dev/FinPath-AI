import React, { useState, useEffect } from 'react';
import {
  Milestone,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Building,
  PlusCircle,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Journey, SanctionLetter } from '../types';
import { api } from '../services/api';

interface JourneysViewProps {
  onOpenSanctionModal: (sanction: SanctionLetter) => void;
  onNavigateTab: (tab: string) => void;
}

export const JourneysView: React.FC<JourneysViewProps> = ({
  onOpenSanctionModal,
  onNavigateTab,
}) => {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConfirmingSanction, setIsConfirmingSanction] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);

  // New Journey Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('Personal Emergency Reserve Loan');
  const [newType, setNewType] = useState<string>('personal_loan');
  const [newAmount, setNewAmount] = useState<number>(800000);

  const fetchJourneys = async () => {
    setLoading(true);
    try {
      const res = await api.listJourneys();
      setJourneys(res.journeys);
      if (res.journeys.length > 0) {
        setSelectedJourney(res.journeys[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJourneys();
  }, []);

  const handleToggleChecklist = async (checkId: string, currentDone: boolean) => {
    if (!selectedJourney) return;
    try {
      await api.toggleChecklist(selectedJourney.id, checkId, !currentDone);
      // update local
      setSelectedJourney((prev) => {
        if (!prev) return null;
        const updatedChecklist = prev.data.checklist?.map((c) =>
          c.id === checkId ? { ...c, done: !currentDone } : c
        );
        return {
          ...prev,
          data: { ...prev.data, checklist: updatedChecklist },
        };
      });
      fetchJourneys();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerUnderwriting = async () => {
    if (!selectedJourney) return;
    setEvaluating(true);
    try {
      const res = await api.evaluateSanction(selectedJourney.id);
      setIsConfirmingSanction(false);
      await fetchJourneys();
      if (res.sanction_letter) {
        onOpenSanctionModal(res.sanction_letter);
      }
    } catch (err) {
      console.error(err);
      alert('Underwriting evaluation failed. Please verify journey checklist.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleCreateJourney = async () => {
    try {
      await api.createJourney(newTitle, newType, newAmount);
      setShowCreateModal(false);
      await fetchJourneys();
    } catch (err) {
      console.error(err);
    }
  };

  const currentStep = selectedJourney?.current_step || 1;
  const totalSteps = selectedJourney?.total_steps || 5;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Title & Start New Journey */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Guided Financial Journey Tracker</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Step-by-step goal selection, document checklist, progress milestones, and simulated underwriting.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Start New Journey</span>
        </button>
      </div>

      {/* Journeys Switcher Bar */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {journeys.map((j) => {
          const isSelected = selectedJourney?.id === j.id;
          return (
            <button
              key={j.id}
              onClick={() => setSelectedJourney(j)}
              className={`p-3.5 rounded-xl border text-left shrink-0 min-w-[260px] transition-all ${
                isSelected
                  ? 'border-blue-500 bg-white shadow-md ring-2 ring-blue-100'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {j.journey_type.replace('_', ' ')}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    j.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {j.status === 'completed' ? 'Sanctioned' : `Step ${j.current_step}/${j.total_steps}`}
                </span>
              </div>
              <p className="font-bold text-slate-900 text-sm mt-1 truncate">{j.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Target: ₹{j.target_amount.toLocaleString('en-IN')}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Guided Workflow Stepper & Interactive Checklist */}
      {selectedJourney && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Stepper Progress Column (7 cols) */}
          <div className="lg:col-span-7 fintech-card p-6 bg-white space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedJourney.title}</h3>
                <p className="text-xs text-slate-500">
                  Progress: {Math.round((currentStep / totalSteps) * 100)}% Complete
                </p>
              </div>

              {selectedJourney.data.sanction_letter && (
                <button
                  onClick={() => onOpenSanctionModal(selectedJourney.data.sanction_letter!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold border border-emerald-300 transition-colors"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>View Sanction Letter</span>
                </button>
              )}
            </div>

            {/* Stepper Vertical Flow */}
            <div className="space-y-4">
              {selectedJourney.data.steps?.map((stepItem) => {
                const isPast = stepItem.step < currentStep || selectedJourney.status === 'completed';
                const isCurrent = stepItem.step === currentStep && selectedJourney.status !== 'completed';
                const isFuture = stepItem.step > currentStep && selectedJourney.status !== 'completed';

                return (
                  <div
                    key={stepItem.step}
                    className={`p-4 rounded-xl border transition-all flex items-start gap-4 ${
                      isPast
                        ? 'bg-emerald-50/40 border-emerald-200 text-slate-800'
                        : isCurrent
                        ? 'bg-blue-50/60 border-blue-400 text-slate-900 shadow-xs ring-1 ring-blue-200'
                        : 'bg-slate-50/50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isPast
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-blue-600 text-white animate-pulse'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : stepItem.step}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-bold ${isFuture ? 'text-slate-500' : 'text-slate-900'}`}>
                          {stepItem.title}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPast
                              ? 'bg-emerald-100 text-emerald-800'
                              : isCurrent
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isPast ? 'Completed' : isCurrent ? 'Active Milestone' : 'Upcoming'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {stepItem.description}
                      </p>

                      {/* Quick contextual actions for current step */}
                      {isCurrent && (
                        <div className="mt-3 flex items-center gap-2">
                          {stepItem.step === 2 && (
                            <button
                              onClick={() => onNavigateTab('affordability')}
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                            >
                              Run FOIR Affordability Calculator
                            </button>
                          )}
                          {stepItem.step === 3 && (
                            <button
                              onClick={() => onNavigateTab('documents')}
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                            >
                              Open Document Intelligence
                            </button>
                          )}
                          {stepItem.step === 4 && (
                            <button
                              onClick={() => setIsConfirmingSanction(true)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Execute AI Underwriting Check</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Document Checklist & Sanction Trigger Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="fintech-card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  <span>Required Verification Documents</span>
                </h4>
                <span className="text-xs text-slate-500">
                  {selectedJourney.data.checklist?.filter((c) => c.done).length} /{' '}
                  {selectedJourney.data.checklist?.length || 0}
                </span>
              </div>

              <div className="space-y-2.5">
                {selectedJourney.data.checklist?.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleChecklist(item.id, item.done)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      item.done
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className={`font-medium ${item.done ? 'line-through text-slate-500' : 'text-slate-900 font-semibold'}`}>
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
                      {item.done ? 'Verified' : 'Upload'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Automated Underwriting Box */}
            <div className="fintech-card p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-3">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h4>Automated Credit Decision Engine</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                FinPath uses deterministic risk assessment algorithms to cross-verify net income, banking volatility, and debt-to-income limits.
              </p>

              {selectedJourney.data.sanction_letter ? (
                <div className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-xl space-y-2">
                  <p className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>In-Principle Sanction Approved</span>
                  </p>
                  <p className="text-xs text-slate-200">
                    Approved Limit: <span className="font-extrabold text-white">₹{selectedJourney.data.sanction_letter.sanctioned_amount.toLocaleString('en-IN')}</span> at {selectedJourney.data.sanction_letter.indicative_rate}% p.a.
                  </p>
                  <button
                    onClick={() => onOpenSanctionModal(selectedJourney.data.sanction_letter!)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Open Sanction Preview Certificate
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsConfirmingSanction(true)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Run Underwriting & Generate Sanction Letter</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal for Underwriting Assessment */}
      {isConfirmingSanction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base">Confirm Automated Underwriting Assessment</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                This structured action evaluates your submitted income records, banking transactions, and requested facility of ₹{selectedJourney?.target_amount.toLocaleString('en-IN')}.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Transparent Action: </span>
                This generates a formal in-principle sanction assessment letter. It does not hit real credit bureaus or trigger hard credit inquiries.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsConfirmingSanction(false)}
                disabled={evaluating}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerUnderwriting}
                disabled={evaluating}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-2"
              >
                {evaluating ? 'Evaluating...' : 'Confirm & Generate Sanction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Journey Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Initiate New Guided Financial Journey</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Journey Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Journey Category</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="home_loan">Home Loan Journey</option>
                  <option value="personal_loan">Express Personal Loan Journey</option>
                  <option value="health_insurance">Family Health Insurance Advisory</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Amount (₹)</label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateJourney}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
              >
                Create Guided Journey
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
