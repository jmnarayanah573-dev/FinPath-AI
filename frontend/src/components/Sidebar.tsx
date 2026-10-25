import React from 'react';
import {
  LayoutDashboard,
  Calculator,
  Bot,
  FileCheck2,
  ShieldAlert,
  Milestone,
  HelpCircle,
  LogOut,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pendingDocCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, pendingDocCount = 2 }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Financial Dashboard', icon: LayoutDashboard },
    { id: 'affordability', label: 'Loan Affordability', icon: Calculator, badge: 'Calculator' },
    { id: 'copilot', label: 'AI Financial Copilot', icon: Bot, highlight: true },
    { id: 'documents', label: 'Document Intelligence', icon: FileCheck2, count: pendingDocCount },
    { id: 'insurance', label: 'Insurance Simplifier', icon: ShieldAlert },
    { id: 'journeys', label: 'Journey Tracker', icon: Milestone, badge: 'Guided' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col h-screen sticky top-0 shrink-0 z-30 select-none">
      {/* Brand Logo Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <TrendingUp className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 tracking-tight text-lg">FinPath</span>
              <span className="text-xs px-1.5 py-0.5 rounded font-extrabold bg-blue-100 text-blue-700 tracking-wider">AI</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Intelligent Journey Assistant</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Navigation Modules
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-600 stroke-[2.2]' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.highlight && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
              )}

              {item.count !== undefined && item.count > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700">
                  {item.count}
                </span>
              )}

              {item.badge && !item.count && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Quick Advice Card */}
        <div className="pt-6 px-1">
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <HelpCircle className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-200">FinPath Copilot</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
              Ask questions about loan eligibility, FOIR formulas, or insurance exclusions in natural language.
            </p>
            <button
              onClick={() => setCurrentTab('copilot')}
              className="w-full text-xs font-semibold py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-1 transition-colors"
            >
              <span>Ask AI Copilot</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/50">
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0 border border-blue-200">
              {user?.full_name ? user.full_name.charAt(0) : 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.full_name || 'Demo Borrower'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email || 'demo@finpath.ai'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out or reset session"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
