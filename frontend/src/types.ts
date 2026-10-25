export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface Step {
  step: number;
  title: string;
  description?: string;
  status?: 'completed' | 'in_progress' | 'pending';
  completed_at?: string | null;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  category?: string;
  doc_id?: string | null;
}

export interface SanctionLetter {
  sanction_reference: string;
  applicant_name: string;
  applicant_email: string;
  issue_date: string;
  valid_until: string;
  approved_facility: string;
  sanctioned_amount: number;
  indicative_rate: number;
  max_tenure_years: number;
  estimated_monthly_emi: number;
  underwriting_score: number;
  risk_grade: string;
  verified_conditions: string[];
  conditions_precedent: string[];
  regulatory_disclaimer: string;
}

export interface Journey {
  id: string;
  user_id: string;
  title: string;
  journey_type: string;
  current_step: number;
  total_steps: number;
  status: string;
  target_amount: number;
  progress_percent?: number;
  data: {
    property_city?: string;
    property_type?: string;
    estimated_cost?: number;
    downpayment?: number;
    tenure_years?: number;
    interest_rate?: number;
    steps?: Step[];
    checklist?: ChecklistItem[];
    sanction_letter?: SanctionLetter;
    step_responses?: Record<string, any>;
  };
  created_at: string;
  updated_at: string;
}

export interface AffordabilityResult {
  record_id: string;
  calculation: {
    requested_principal: number;
    monthly_emi: number;
    total_interest: number;
    total_repayment: number;
    tenure_months: number;
    tenure_years: number;
    annual_interest_rate: number;
  };
  affordability_metrics: {
    dti_ratio: number;
    current_dti: number;
    total_monthly_debt: number;
    remaining_discretionary_income: number;
    max_recommended_loan: number;
    risk_category: string;
    risk_color: string;
    status_message: string;
  };
  breakdown: {
    income: number;
    living_expenses: number;
    existing_obligations: number;
    new_loan_emi: number;
    unallocated_surplus: number;
  };
  amortization_timeline: Array<{
    year: string;
    month: number;
    remaining_balance: number;
    principal_paid: number;
    interest_paid: number;
    annual_emi_total: number;
  }>;
  recommendations: string[];
  assumptions: string[];
  disclaimer: string;
}

export interface DocumentItem {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  doc_type?: string;
  extracted_fields: Record<string, any>;
  missing_fields: string[];
  summary: string;
  confidence_score: number;
  status: string;
  created_at: string;
}

export interface InsuranceAnalysis {
  policy_name: string;
  policy_type: string;
  sum_insured: number;
  insurer: string;
  key_coverages: string[];
  exclusions: string[];
  waiting_periods: Array<{
    duration: string;
    applies_to: string;
    verified?: boolean;
    clause_ref?: string;
  }>;
  copay_clause: string;
  room_rent_clause: string;
  source_truth_score: number;
  unverified_clauses: string[];
  summary: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: string;
  followups?: string[];
  action?: {
    label: string;
    target: string;
  } | null;
  timestamp: string;
}
