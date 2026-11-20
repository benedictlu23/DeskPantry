import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, MessageSquare, Send, X } from 'lucide-react';
import { PautanganSettings, StoreItem, UserAccount, UserRole } from '../types';
import { ChatbotPersona } from './ChatHubView';

interface FloatingMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface GeminiChatbotDrawerProps {
  currentUser: UserAccount | null;
  currentRole: UserRole;
  storeItems: StoreItem[];
  pautanganSettings: PautanganSettings;
  pendingProofsCount: number;
}

export const GeminiChatbotDrawer: React.FC<GeminiChatbotDrawerProps> = ({
  currentUser,
  currentRole,
  storeItems,
  pautanganSettings,
  pendingProofsCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [persona, setPersona] = useState<ChatbotPersona>('concierge');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<FloatingMessage[]>([
    {
      id: 'init-1',
      role: 'model',
      text: 'Hi! I am DeskPantry Assistant. Choose a persona above and ask about items, ₱ prices, 15th/30th cutoffs, or Pautangan loans.',
      timestamp: 'Now',
    },
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: FloatingMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const catalogSummary = storeItems
        .slice(0, 6)
        .map((i) => `${i.name} (₱${i.price}, ${i.stock} left)`)
        .join('; ');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          persona,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          context: {
            userName: currentUser?.name ?? 'Visitor',
            userRole: currentRole,
            debtBalance: currentUser?.debtBalance ?? 0,
            pautanganRate: pautanganSettings.monthlyInterestRate,
            dueDays: pautanganSettings.dueDays,
            catalogSummary,
            pendingProofsCount,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not reach DeskPantry AI.');
        return;
      }
      if (typeof data?.reply === 'string') {
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: 'model',
            text: data.reply,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
      }
    } catch {
      setError('Network error while contacting DeskPantry AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-[74px] right-3.5 sm:bottom-6 sm:right-5 z-40 w-12 h-12 sm:w-auto sm:h-auto sm:min-h-[48px] inline-flex items-center justify-center sm:gap-2.5 rounded-full bg-[#0F2E2A] dark:bg-teal-700 sm:px-4 sm:py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-teal-900 dark:hover:bg-teal-800 transition-colors cursor-pointer"
          aria-label="Open DeskPantry AI Chatbot"
        >
          <MessageSquare className="w-5 h-5 sm:w-4 sm:h-4 text-teal-300 dark:text-teal-200" />
          <span className="hidden sm:inline">Ask DeskPantry AI</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-[74px] sm:bottom-6 right-3 left-3 sm:left-auto sm:right-5 sm:w-[390px] z-50 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100vh-8.5rem)] sm:max-h-[540px]">
          <div className="web-nav-gradient px-4 py-3 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <Bot className="w-4 h-4 text-teal-200" />
              </div>
              <div>
                <div className="text-sm font-bold leading-tight">DeskPantry Assistant</div>
                <div className="text-[11px] text-teal-100/80">Multi-turn Gemini Helper</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-teal-100 hover:bg-white/10 cursor-pointer"
              aria-label="Close AI assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 py-2 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#0F1917] flex items-center gap-1">
            {[
              { id: 'concierge', label: 'Concierge' },
              { id: 'fast', label: 'Fast Lookup' },
              { id: 'advisor', label: 'Ledger Advisor' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersona(p.id as ChatbotPersona)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  persona === p.id
                    ? 'bg-white dark:bg-teal-700 text-teal-800 dark:text-white border border-stone-200 dark:border-teal-600 shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-stone-400 mb-0.5 font-mono">
                  {m.role === 'user' ? 'You' : 'DeskPantry AI'} · {m.timestamp}
                </span>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-teal-700 text-white'
                      : 'bg-stone-100 dark:bg-[#172523] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-800'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-xs text-stone-500 dark:text-stone-400">Typing response...</div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-2.5 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={handleSend}
            className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#0F1917] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about snacks, debt, or loans..."
              className="flex-1 min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-teal-700 text-white hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
