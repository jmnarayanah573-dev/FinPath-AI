import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { CopilotMessage } from '../types';
import { api } from '../services/api';

interface CopilotViewProps {
  onNavigateTab: (tab: string) => void;
}

export const CopilotView: React.FC<CopilotViewProps> = ({ onNavigateTab }) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content:
        "### Welcome to FinPath AI Financial Copilot 👋\n\n" +
        "I am your dedicated financial education assistant. I explain personal finance, lending, insurance, and budgeting concepts in simple, beginner-friendly terms with concrete examples.\n\n" +
        "**Popular Questions You Can Ask:**\n" +
        "- What is insurance and how does it work?\n" +
        "- What is a loan and what is the difference between principal and interest?\n" +
        "- How is EMI calculated using reducing balance?\n" +
        "- What is the difference between health insurance and life insurance?\n" +
        "- I earn ₹30,000 per month. How can I plan my budget?\n" +
        "- What documents are generally required for a personal loan?\n\n" +
        "*Tap any suggested prompt below or type your own question!*",
      source: 'educational-intent-engine',
      followups: [
        'What is insurance?',
        'What is a loan?',
        'How is EMI calculated?',
        'What is the difference between health insurance and life insurance?',
        'I earn ₹30,000 per month. How can I plan my budget?',
        'What documents are generally required for a personal loan?',
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: CopilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      // Pass clean history turns
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.chatCopilot(query, historyPayload);
      const assistantMsg: CopilotMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        source: res.source,
        followups: res.followups || [],
        action: res.action,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      const errMsg: CopilotMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content:
          "### Service Notification\n\n" +
          "> [!WARNING]\n" +
          "> **Connection Issue**: Unable to reach the backend financial copilot service. " +
          "Please ensure the backend API server is running at `http://127.0.0.1:8000`.",
        source: 'system-error',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Unescape backslash-escaped markdown markers: \*\* -> **, \* -> *, \# -> #, etc.
  const cleanMarkdown = (raw: string): string => {
    if (!raw) return '';
    return raw
      // Handle double escaped backslashes: \\** -> **
      .replace(/\\\\([\*_`#~\[\]\(\)\-\+\.!\$])/g, '$1')
      // Handle single escaped characters: \*\* -> **, \* -> *, \` -> `
      .replace(/\\([\*_`#~\[\]\(\)\-\+\.!\$])/g, '$1');
  };

  // Helper to format inline markdown like **bold**, *italic*, `code`, and $formula$
  const renderInline = (text: string): React.ReactNode => {
    const cleaned = cleanMarkdown(text);
    const parts: React.ReactNode[] = [];
    // Match **bold**, __bold__, `code`, $math$, *italic*, _italic_
    const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\$[^\$]+\$|\*[^*]+\*|_[^_]+_)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(cleaned)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleaned.substring(lastIndex, match.index));
      }
      const token = match[0];
      const keyId = `${match.index}-${token.slice(0, 3)}`;

      if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
        parts.push(
          <strong key={keyId} className="font-bold text-slate-900">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={keyId} className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 font-mono text-xs">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('$') && token.endsWith('$')) {
        parts.push(
          <span key={keyId} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 font-mono text-xs font-semibold">
            {token.slice(1, -1)}
          </span>
        );
      } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
        parts.push(
          <em key={keyId} className="italic text-slate-800">
            {token.slice(1, -1)}
          </em>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < cleaned.length) {
      parts.push(cleaned.substring(lastIndex));
    }

    return parts.length > 0 ? parts : cleaned;
  };

  const renderFormattedMarkdown = (content: string) => {
    const cleaned = cleanMarkdown(content);
    const lines = cleaned.split('\n');

    return (
      <div className="space-y-2.5 text-xs md:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          if (trimmed === '') {
            return <div key={idx} className="h-1" />;
          }

          // Horizontal rule
          if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            return <hr key={idx} className="border-slate-200 my-2" />;
          }

          // Math block: $$ ... $$
          if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
            const mathFormula = trimmed.slice(2, -2).trim();
            return (
              <div
                key={idx}
                className="my-2 p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-center font-mono text-xs md:text-sm font-semibold text-blue-950 shadow-2xs"
              >
                {mathFormula}
              </div>
            );
          }

          // Heading 1
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className="font-bold text-slate-900 text-base md:text-lg mt-3 mb-1.5 pb-1 border-b border-slate-200">
                {renderInline(trimmed.replace(/^#\s+/, ''))}
              </h1>
            );
          }

          // Heading 2
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="font-bold text-slate-900 text-sm md:text-base mt-3 mb-1">
                {renderInline(trimmed.replace(/^##\s+/, ''))}
              </h2>
            );
          }

          // Heading 3
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="font-bold text-slate-900 text-xs md:text-sm mt-2.5 mb-1 text-blue-950">
                {renderInline(trimmed.replace(/^###\s+/, ''))}
              </h3>
            );
          }

          // Heading 4
          if (trimmed.startsWith('#### ')) {
            return (
              <h4 key={idx} className="font-semibold text-slate-800 text-xs md:text-sm mt-2 mb-0.5">
                {renderInline(trimmed.replace(/^####\s+/, ''))}
              </h4>
            );
          }

          // Unordered list item
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
            const listContent = trimmed.replace(/^[-*•]\s+/, '');
            return (
              <div key={idx} className="flex items-start gap-2 ml-2">
                <span className="text-blue-600 font-bold leading-5">•</span>
                <span className="text-slate-700 flex-1">{renderInline(listContent)}</span>
              </div>
            );
          }

          // Ordered list item
          const matchNum = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (matchNum) {
            return (
              <div key={idx} className="flex items-start gap-2 ml-2">
                <span className="font-bold text-slate-900 text-xs leading-5 min-w-[1.2rem]">
                  {matchNum[1]}.
                </span>
                <span className="text-slate-700 flex-1">{renderInline(matchNum[2])}</span>
              </div>
            );
          }

          // GitHub-style alerts: > [!NOTE], > [!WARNING], > [!TIP] or standard Blockquotes
          if (trimmed.startsWith('> ')) {
            const quoteContent = trimmed.replace(/^>\s+/, '');
            const isNote = quoteContent.includes('[!NOTE]') || quoteContent.toLowerCase().includes('notice:');
            const isWarning = quoteContent.includes('[!WARNING]') || quoteContent.toLowerCase().includes('warning:');

            return (
              <div
                key={idx}
                className={`border-l-4 pl-3 py-2 my-2 rounded-r text-xs leading-relaxed ${
                  isWarning
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : isNote
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900'
                    : 'border-slate-400 bg-slate-100 text-slate-700 italic'
                }`}
              >
                {renderInline(quoteContent.replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, '').trim())}
              </div>
            );
          }

          // Standard paragraph
          return (
            <p key={idx} className="text-slate-700 leading-relaxed">
              {renderInline(line)}
            </p>
          );
        })}
      </div>
    );
  };

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'educational-intent-engine':
        return (
          <span className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-semibold border border-blue-200">
            Educational Engine
          </span>
        );
      case 'educational-engine-fallback':
        return (
          <span className="font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-semibold border border-amber-200 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            Offline Fallback
          </span>
        );
      case 'gemini-1.5-flash':
        return (
          <span className="font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold border border-emerald-200">
            Gemini 1.5 Flash
          </span>
        );
      case 'openai-gpt-4o-mini':
        return (
          <span className="font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[10px] font-semibold border border-purple-200">
            OpenAI GPT-4o Mini
          </span>
        );
      case 'system-error':
        return (
          <span className="font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-semibold border border-rose-200">
            System Error
          </span>
        );
      default:
        return source ? (
          <span className="font-mono bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 text-[10px]">
            {source}
          </span>
        ) : null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto p-4 md:p-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">FinPath AI Financial Copilot</h2>
            <p className="text-xs text-slate-500">
              Direct, educational financial explanations for insurance, loans, EMI, and budgeting
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Educational Engine Active</span>
          </span>
        </div>
      </div>

      {/* Quick Prompt Carousel */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
          Try Asking:
        </span>
        {[
          'What is insurance?',
          'What is a loan?',
          'How is EMI calculated?',
          'Health vs Life insurance?',
          'I earn ₹30,000 per month. How can I plan my budget?',
          'What documents are generally required for a personal loan?',
        ].map((promptText, i) => (
          <button
            key={i}
            onClick={() => handleSend(promptText)}
            disabled={loading}
            className="px-3 py-1 rounded-full text-xs bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 shrink-0 font-medium transition-colors shadow-2xs"
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl p-4 md:p-6 overflow-y-auto space-y-6 shadow-xs">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-white shadow-xs'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-3 max-w-2xl">
                <div
                  className={`p-4 rounded-2xl ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 rounded-tl-none shadow-xs'
                  }`}
                >
                  {isUser ? (
                    <p className="text-xs md:text-sm font-medium">{msg.content}</p>
                  ) : (
                    renderFormattedMarkdown(msg.content)
                  )}

                  <div
                    className={`mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] ${
                      isUser ? 'text-blue-100 border-blue-400/30' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {getSourceBadge(msg.source)}
                  </div>
                </div>

                {/* Structured Next Action Button */}
                {msg.action && (
                  <div className="pl-1">
                    <button
                      onClick={() => onNavigateTab(msg.action!.target)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <span>{msg.action.label}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Followup Suggestion Chips */}
                {msg.followups && msg.followups.length > 0 && (
                  <div className="space-y-1.5 pl-1">
                    <p className="text-[11px] font-semibold text-slate-400">Related Follow-ups:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.followups.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(chip)}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 rounded-lg text-slate-700 border border-slate-200 transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 max-w-2xl">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 rounded-tl-none flex items-center gap-2 text-xs text-slate-500">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Analyzing financial query & generating explanation...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div className="mt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-white border border-slate-200/90 rounded-2xl p-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about insurance, loans, EMI formula, budgeting, or required documents..."
            disabled={loading}
            className="flex-1 px-3 py-2 text-xs md:text-sm text-slate-900 bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[11px] text-center text-slate-400 mt-2">
          FinPath Copilot provides educational information and financial principles. It does not issue formal loan approvals or binding underwriting contracts.
        </p>
      </div>
    </div>
  );
};
