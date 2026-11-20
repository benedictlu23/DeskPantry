import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Eye,
  Lock,
  MessageSquare,
  Search,
  Send,
  Users,
} from 'lucide-react';
import {
  ChatThread,
  PautanganSettings,
  StoreItem,
  UserAccount,
  UserRole,
} from '../types';

export type ChatbotPersona = 'concierge' | 'fast' | 'advisor';

interface ChatHubViewProps {
  threads: ChatThread[];
  currentUser: UserAccount | null;
  currentRole: UserRole;
  storeItems: StoreItem[];
  pautanganSettings: PautanganSettings;
  pendingProofsCount: number;
  onOpenSignIn: () => void;
  onSendMessage: (threadId: string, text: string) => void;
  onReceiveAiReply: (threadId: string, replyText: string) => void;
  onMarkThreadRead: (threadId: string) => void;
}

export const ChatHubView: React.FC<ChatHubViewProps> = ({
  threads,
  currentUser,
  currentRole,
  storeItems,
  pautanganSettings,
  pendingProofsCount,
  onOpenSignIn,
  onSendMessage,
  onReceiveAiReply,
  onMarkThreadRead,
}) => {
  const [mode, setMode] = useState<'inbox' | 'monitor'>('inbox');
  const [selectedThreadId, setSelectedThreadId] = useState<string>('thread-ai');
  const [persona, setPersona] = useState<ChatbotPersona>('concierge');
  const [draft, setDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [monitorQuery, setMonitorQuery] = useState('');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const isGuest = currentRole === UserRole.Guest || !currentUser;
  const isSuperAdmin = currentRole === UserRole.SuperAdmin;

  const visibleThreads = useMemo(() => {
    if (!currentUser) return [];
    if (mode === 'monitor' && isSuperAdmin) {
      const q = monitorQuery.trim().toLowerCase();
      return threads.filter(
        (t) =>
          t.type !== 'ai' &&
          (!q ||
            t.title.toLowerCase().includes(q) ||
            t.messages.some(
              (m) =>
                m.text.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q)
            ))
      );
    }
    return threads.filter(
      (t) =>
        t.type === 'ai' ||
        t.type === 'channel' ||
        t.participantIds.includes(currentUser.id)
    );
  }, [threads, currentUser, mode, isSuperAdmin, monitorQuery]);

  const activeThread =
    visibleThreads.find((t) => t.id === selectedThreadId) ?? visibleThreads[0] ?? null;

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages.length, aiLoading]);

  if (isGuest) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center">
        <Lock className="w-8 h-8 text-stone-400 mx-auto" />
        <h2 className="mt-3 text-xl font-bold text-stone-900 dark:text-stone-100">
          Sign in to access Coworker &amp; AI Chat
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          Message coworkers, get pantry restock updates, or chat with DeskPantry AI powered by Gemini.
        </p>
        <button
          type="button"
          onClick={onOpenSignIn}
          className="mt-5 min-h-[44px] rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
        >
          Sign In with Gmail / Email
        </button>
      </div>
    );
  }

  const sendToAiBackend = async (thread: ChatThread, promptText: string) => {
    setAiLoading(true);
    setAiError('');
    try {
      const history = thread.messages.map((m) => ({
        role: m.senderRole === 'ai' ? ('model' as const) : ('user' as const),
        text: m.text,
      }));
      const catalogSummary = storeItems
        .slice(0, 6)
        .map((i) => `${i.name} (₱${i.price}, ${i.stock} left)`)
        .join('; ');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          persona,
          history,
          context: {
            userName: currentUser.name,
            userRole: currentRole,
            debtBalance: currentUser.debtBalance,
            pautanganRate: pautanganSettings.monthlyInterestRate,
            dueDays: pautanganSettings.dueDays,
            catalogSummary,
            pendingProofsCount,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data?.error || 'Failed to reach DeskPantry AI.');
        return;
      }
      if (typeof data?.reply === 'string') {
        onReceiveAiReply(thread.id, data.reply);
      }
    } catch {
      setAiError('Network error while contacting DeskPantry AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !draft.trim() || mode === 'monitor') return;
    const text = draft.trim();
    setDraft('');
    onSendMessage(activeThread.id, text);
    if (activeThread.type === 'ai') {
      await sendToAiBackend(activeThread, text);
    }
  };

  const handleQuickPrompt = async (prompt: string) => {
    const aiThread = threads.find((t) => t.type === 'ai');
    if (!aiThread) return;
    setSelectedThreadId(aiThread.id);
    setMode('inbox');
    onSendMessage(aiThread.id, prompt);
    await sendToAiBackend(aiThread, prompt);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Department Chat &amp; AI Assistant
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Coordinate pickup or delivery with coworkers, or ask DeskPantry AI with role-based personas.
          </p>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 self-start">
            <button
              type="button"
              onClick={() => setMode('inbox')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                mode === 'inbox'
                  ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              My Chats
            </button>
            <button
              type="button"
              onClick={() => setMode('monitor')}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                mode === 'monitor'
                  ? 'bg-stone-900 dark:bg-teal-700 text-white'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Super Admin Chat Monitor</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden min-h-[560px]">
        {/* Threads Sidebar */}
        <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#0F1917] flex flex-col">
          {mode === 'monitor' && (
            <div className="p-3 border-b border-stone-200 dark:border-stone-800 bg-stone-100/70 dark:bg-[#172523]">
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100 mb-2">
                Employee Chat Audit Log
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={monitorQuery}
                  onChange={(e) => setMonitorQuery(e.target.value)}
                  placeholder="Filter coworker or keyword..."
                  className="w-full min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] pl-8 pr-3 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="divide-y divide-stone-200 dark:divide-stone-800 overflow-y-auto">
            {visibleThreads.map((t) => {
              const selected = activeThread?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedThreadId(t.id);
                    onMarkThreadRead(t.id);
                  }}
                  className={`w-full p-4 text-left flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                    selected
                      ? 'bg-white dark:bg-[#172523] border-r-2 border-r-teal-700 dark:border-r-teal-400'
                      : 'hover:bg-white/70 dark:hover:bg-[#172523]/60'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        t.type === 'ai'
                          ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400'
                          : t.type === 'channel'
                            ? 'bg-stone-100 dark:bg-[#121D1B] border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200'
                            : 'bg-white dark:bg-[#121D1B] border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200'
                      }`}
                    >
                      {t.type === 'ai' ? (
                        <Bot className="w-4 h-4" />
                      ) : t.type === 'channel' ? (
                        <Users className="w-4 h-4" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {t.title}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                        {t.subtitle}
                      </div>
                    </div>
                  </div>
                  {t.unreadCount > 0 && mode !== 'monitor' && (
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400 tabular-nums shrink-0">
                      {t.unreadCount} new
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Conversation Panel */}
        <section className="lg:col-span-8 flex flex-col justify-between bg-white dark:bg-[#121D1B]">
          {!activeThread ? (
            <div className="p-10 text-center text-sm text-stone-500 dark:text-stone-400 my-auto">
              Select a conversation to view messages.
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {activeThread.title}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {activeThread.subtitle}
                  </p>
                </div>

                {activeThread.type === 'ai' ? (
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-100 dark:bg-[#172523] border border-stone-200 dark:border-stone-800">
                    {[
                      { id: 'concierge', label: 'Concierge' },
                      { id: 'fast', label: 'Fast Lookup' },
                      { id: 'advisor', label: 'Ledger Advisor' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPersona(p.id as ChatbotPersona)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                          persona === p.id
                            ? 'bg-white dark:bg-teal-700 text-teal-800 dark:text-white shadow-xs'
                            : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  mode === 'monitor' && (
                    <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      Read-Only Super Admin Oversight
                    </span>
                  )
                )}
              </div>

              {activeThread.type === 'ai' && (
                <div className="px-6 py-2.5 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-[#0F1917] flex flex-wrap items-center gap-2">
                  {[
                    'What is my current debt balance?',
                    'Suggest snacks under ₱100',
                    'How much interest on a ₱2,000 Pautangan loan?',
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={aiLoading}
                      onClick={() => handleQuickPrompt(q)}
                      className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-200 hover:border-teal-300 dark:hover:border-teal-600 hover:text-teal-800 dark:hover:text-teal-300 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[380px]">
                {activeThread.messages.map((msg) => {
                  const isMine = msg.senderId === currentUser.id && mode !== 'monitor';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">
                        {msg.senderName} · <span className="font-mono">{msg.timestamp}</span>
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          isMine
                            ? 'bg-teal-700 text-white'
                            : msg.senderRole === 'ai'
                              ? 'bg-stone-100 dark:bg-[#172523] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-800'
                              : 'bg-stone-50 dark:bg-[#172523] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-800'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {aiLoading && activeThread.type === 'ai' && (
                  <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                    DeskPantry AI is thinking...
                  </div>
                )}

                {aiError && activeThread.type === 'ai' && (
                  <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <span>{aiError}</span>
                  </div>
                )}
                <div ref={scrollEndRef} />
              </div>

              {mode !== 'monitor' && (
                <form
                  onSubmit={handleSend}
                  className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#0F1917] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      activeThread.type === 'ai'
                        ? 'Ask DeskPantry AI about snacks, balances, or Pautangan...'
                        : `Message ${activeThread.title}...`
                    }
                    className="flex-1 min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-4 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || (activeThread.type === 'ai' && aiLoading)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
