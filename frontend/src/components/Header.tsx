import React from 'react';
import {
  ShieldCheck,
  Sparkles,
  Zap,
  Info,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle: string;
  onOpenNewJourney?: () => void;
  onOpenCopilot?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onOpenNewJourney,
  onOpenCopilot,
}) => {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">{title}</h1>
        <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* System & AI Status Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>FinPath Underwriting AI Active</span>
        </div>

        {/* Action Button: AI Copilot Quick Tap */}
        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold border border-blue-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Ask Copilot</span>
          </button>
        )}

        {/* Action Button: Start Journey */}
        {onOpenNewJourney && (
          <button
            onClick={onOpenNewJourney}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>New Journey</span>
          </button>
        )}

        {/* Demo Account Indicator */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 text-slate-600">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-[11px] font-medium text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Demo Mode</span>
          </div>
        </div>
      </div>
    </header>
  );
};
