import { AffordabilityResult, Journey, DocumentItem, InsuranceAnalysis, User } from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

function getHeaders(isFormData = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem('finpath_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Health
  checkHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Backend health check failed');
    return res.json();
  },

  // Auth
  demoLogin: async (): Promise<{ access_token: string; user: User }> => {
    const res = await fetch(`${API_BASE}/auth/demo-login`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Demo login failed');
    return res.json();
  },

  login: async (email: string, password: string): Promise<{ access_token: string; user: User }> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  register: async (email: string, password: string, full_name: string): Promise<{ access_token: string; user: User }> => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password, full_name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  getMe: async (): Promise<{ user: User }> => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  // Affordability
  calculateAffordability: async (data: {
    monthly_income: number;
    monthly_expenses: number;
    existing_emi: number;
    requested_amount: number;
    interest_rate: number;
    tenure_months: number;
  }): Promise<AffordabilityResult> => {
    const res = await fetch(`${API_BASE}/affordability/calculate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Affordability calculation failed');
    return res.json();
  },

  getLatestAffordability: async () => {
    const res = await fetch(`${API_BASE}/affordability/latest`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch latest affordability record');
    return res.json();
  },

  // Copilot
  chatCopilot: async (message: string, history: any[] = []) => {
    const res = await fetch(`${API_BASE}/copilot/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message, history }),
    });
    if (!res.ok) throw new Error('Copilot query failed');
    return res.json();
  },

  getSuggestedPrompts: async () => {
    const res = await fetch(`${API_BASE}/copilot/prompts`);
    if (!res.ok) throw new Error('Failed to fetch prompts');
    return res.json();
  },

  // Documents
  uploadDocument: async (file: File, journey_id?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (journey_id) formData.append('journey_id', journey_id);

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    if (!res.ok) throw new Error('Document upload failed');
    return res.json();
  },

  loadSampleDocument: async (sampleName: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/documents/load-sample?sample_name=${sampleName}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load sample document');
    return res.json();
  },

  listDocuments: async (): Promise<{ documents: DocumentItem[] }> => {
    const res = await fetch(`${API_BASE}/documents/list`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to list documents');
    return res.json();
  },

  // Insurance
  getSamplePolicies: async (): Promise<{ policies: Record<string, InsuranceAnalysis> }> => {
    const res = await fetch(`${API_BASE}/insurance/samples`);
    if (!res.ok) throw new Error('Failed to fetch sample policies');
    return res.json();
  },

  simplifyPolicy: async (file?: File, sampleKey?: string): Promise<{ analysis_id: string; analysis: InsuranceAnalysis }> => {
    let body: any;
    let isFormData = false;

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      body = formData;
      isFormData = true;
    } else {
      const formData = new FormData();
      if (sampleKey) formData.append('sample_key', sampleKey);
      body = formData;
      isFormData = true;
    }

    const res = await fetch(`${API_BASE}/insurance/simplify`, {
      method: 'POST',
      headers: getHeaders(isFormData),
      body,
    });
    if (!res.ok) throw new Error('Policy simplification failed');
    return res.json();
  },

  getLatestInsuranceAnalysis: async (): Promise<{ analysis: InsuranceAnalysis }> => {
    const res = await fetch(`${API_BASE}/insurance/latest`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch latest insurance analysis');
    return res.json();
  },

  // Journeys
  listJourneys: async (): Promise<{ journeys: Journey[] }> => {
    const res = await fetch(`${API_BASE}/journeys`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch journeys');
    return res.json();
  },

  createJourney: async (title: string, journey_type: string, target_amount: number): Promise<any> => {
    const res = await fetch(`${API_BASE}/journeys`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title, journey_type, target_amount }),
    });
    if (!res.ok) throw new Error('Failed to create journey');
    return res.json();
  },

  advanceJourneyStep: async (journey_id: string, target_step: number, step_data?: any) => {
    const res = await fetch(`${API_BASE}/journeys/${journey_id}/step`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ target_step, step_data }),
    });
    if (!res.ok) throw new Error('Failed to advance step');
    return res.json();
  },

  toggleChecklist: async (journey_id: string, checklist_id: string, done: boolean) => {
    const res = await fetch(`${API_BASE}/journeys/${journey_id}/checklist-toggle`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ checklist_id, done }),
    });
    if (!res.ok) throw new Error('Failed to toggle checklist');
    return res.json();
  },

  evaluateSanction: async (journey_id: string) => {
    const res = await fetch(`${API_BASE}/journeys/${journey_id}/evaluate-sanction`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to evaluate sanction');
    return res.json();
  },
};
