import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SanctionLetterModal } from './components/SanctionLetterModal';
import { DashboardView } from './pages/DashboardView';
import { AffordabilityView } from './pages/AffordabilityView';
import { CopilotView } from './pages/CopilotView';
import { DocumentsView } from './pages/DocumentsView';
import { InsuranceView } from './pages/InsuranceView';
import { JourneysView } from './pages/JourneysView';
import { SanctionLetter } from './types';

const defaultSanctionLetter: SanctionLetter = {
  sanction_reference: 'FPA-SANC-202610-884920',
  applicant_name: 'Arjun Mehta',
  applicant_email: 'demo@finpath.ai',
  issue_date: 'October 25, 2026',
  valid_until: 'October 25, 2027',
  approved_facility: 'In-Principle Credit Approval (Home Loan Facility)',
  sanctioned_amount: 5225000,
  indicative_rate: 8.4,
  max_tenure_years: 20,
  estimated_monthly_emi: 45342.55,
  underwriting_score: 862,
  risk_grade: 'Tier-1 Prime (Low Default Risk)',
  verified_conditions: [
    'Income verified via 6-month continuous banking credits and Form 16 reconciliation.',
    'Debt-To-Income (FOIR) obligations verified strictly within 45% threshold.',
    'Clean credit track record with zero active delinquency or repayment defaults.',
  ],
  conditions_precedent: [
    'Original property title deeds and non-encumbrance certificate review by panel advocate.',
    'Independent site inspection and valuation report by certified bank empaneled valuer.',
    'Execution of digital loan agreement and NACH e-mandate registration.',
  ],
  regulatory_disclaimer:
    'This in-principle approval is an automated algorithmic preliminary evaluation based on borrower-submitted records. Final disbursement is subject to legal vetting and physical title search.',
};

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [sanctionModalOpen, setSanctionModalOpen] = useState<boolean>(false);
  const [activeSanction, setActiveSanction] = useState<SanctionLetter>(defaultSanctionLetter);

  const getHeaderInfo = () => {
    switch (currentTab) {
      case 'dashboard':
        return {
          title: 'Executive Financial Dashboard',
          subtitle: 'Holistic overview of customer journeys, debt metrics, and document readiness',
        };
      case 'affordability':
        return {
          title: 'Loan Affordability & FOIR Analyzer',
          subtitle: 'Reducing balance calculations, monthly surplus metrics, and debt tolerance analysis',
        };
      case 'copilot':
        return {
          title: 'AI Financial Copilot',
          subtitle: 'Conversational explanations of loan procedures, insurance terms, and KYC guidelines',
        };
      case 'documents':
        return {
          title: 'Document Intelligence & OCR Audit',
          subtitle: 'Private PDF entity extraction, missing information detection, and confidence scoring',
        };
      case 'insurance':
        return {
          title: 'Insurance Policy Simplifier',
          subtitle: 'Coverage breakdown, critical exclusions, waiting periods, and ground truth audit',
        };
      case 'journeys':
        return {
          title: 'Financial Journey Tracker',
          subtitle: 'Milestone tracking, interactive document checklist, and AI sanction letters',
        };
      default:
        return {
          title: 'FinPath AI',
          subtitle: 'Intelligent Financial Journey Assistant',
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Left Sidebar */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          onOpenCopilot={() => setCurrentTab('copilot')}
          onOpenNewJourney={() => setCurrentTab('journeys')}
        />

        <main className="flex-1 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={setCurrentTab}
              onOpenSanction={() => {
                setActiveSanction(defaultSanctionLetter);
                setSanctionModalOpen(true);
              }}
            />
          )}

          {currentTab === 'affordability' && <AffordabilityView />}

          {currentTab === 'copilot' && <CopilotView onNavigateTab={setCurrentTab} />}

          {currentTab === 'documents' && <DocumentsView />}

          {currentTab === 'insurance' && <InsuranceView />}

          {currentTab === 'journeys' && (
            <JourneysView
              onOpenSanctionModal={(sanction) => {
                setActiveSanction(sanction);
                setSanctionModalOpen(true);
              }}
              onNavigateTab={setCurrentTab}
            />
          )}
        </main>
      </div>

      {/* Sanction Letter Modal */}
      <SanctionLetterModal
        isOpen={sanctionModalOpen}
        onClose={() => setSanctionModalOpen(false)}
        sanction={activeSanction}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
