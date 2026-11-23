import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Eye,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  ChatThread,
  CoworkerProfile,
  StoreItem,
  UserAccount,
  UserRole,
} from '../types';

export type ChatbotPersona = 'concierge' | 'fast' | 'advisor';

interface ChatHubViewProps {
  threads: ChatThread[];
  coworkers: CoworkerProfile[];
  currentUser: UserAccount | null;
  currentRole: UserRole;
  storeItems: StoreItem[];
  dueDays: [number, number];
  pendingProofsCount: number;
  requestedThreadId?: { threadId: string; nonce: number } | null;
  onOpenSignIn: () => void;
  onSendMessage: (threadId: string, text: string) => void;
  onReceiveAiReply: (threadId: string, replyText: string) => void;
  onMarkThreadRead: (threadId: string) => void;
  onStartDirectChat: (recipient: CoworkerProfile) => Promise<string>;
  onDeleteMessage: (threadId: string, messageId: string) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
}

export const ChatHubView: React.FC<ChatHubViewProps> = ({
  threads,
  coworkers,
  currentUser,
  currentRole,
  storeItems,
  dueDays,
  pendingProofsCount,
  requestedThreadId,
  onOpenSignIn,
  onSendMessage,
  onReceiveAiReply,
  onMarkThreadRead,
  onStartDirectChat,
  onDeleteMessage,
  onDeleteThread,
}) => {
  const myAiThreadId = currentUser ? `ai-${currentUser.id}` : 'ai-guest';
  const [mode, setMode] = useState<'inbox' | 'monitor'>('inbox');
  const [monitorFilter, setMonitorFilter] = useState<'all' | 'ai' | 'dm' | 'channel'>('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string>(myAiThreadId);
  const [persona, setPersona] = useState<ChatbotPersona>('concierge');
  const [draft, setDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [chatError, setChatError] = useState('');
  const [monitorQuery, setMonitorQuery] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [startingRecipientId, setStartingRecipientId] = useState<string | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [confirmDeleteThreadId, setConfirmDeleteThreadId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const isGuest = currentRole === UserRole.Guest || !currentUser;
  const isSuperAdmin = currentRole === UserRole.SuperAdmin;

  useEffect(() => {
    if (currentUser) {
      setSelectedThreadId((prev) =>
        prev === 'ai-guest' || prev === 'thread-ai' ? `ai-${currentUser.id}` : prev
      );
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!requestedThreadId?.threadId) return;
    setMode('inbox');
    setSelectedThreadId(requestedThreadId.threadId);
    onMarkThreadRead(requestedThreadId.threadId);
  }, [requestedThreadId?.nonce]);

  const getThreadUnreadForUser = (thread: ChatThread): number => {
    if (!currentUser) return 0;
    if (thread.unreadBy && typeof thread.unreadBy === 'object') {
      return Math.max(0, Number(thread.unreadBy[currentUser.id] ?? 0));
    }
    return Math.max(0, Number(thread.unreadCount ?? 0));
  };

  const resolveThreadDisplay = (thread: ChatThread) => {
    if (thread.type === 'ai') {
      if (mode === 'monitor' && isSuperAdmin) {
        const ownerId =
          thread.participantIds.find((id) => id !== 'ai') ??
          thread.id.replace(/^ai-/, '');
        const owner = coworkers.find((c) => c.id === ownerId);
        const msgLabel = `${thread.messages.length} msg${thread.messages.length === 1 ? '' : 's'}`;
        return {
          title: owner ? `AI Chat · ${owner.name}` : thread.title,
          subtitle: owner
            ? `Private DeskPantry AI · ${owner.department || 'Team'} · ${msgLabel}`
            : `Private DeskPantry AI Session · ${msgLabel}`,
          avatarUrl: owner?.avatarUrl,
          avatarInitials: owner?.avatarInitials,
        };
      }
      return {
        title: 'DeskPantry AI',
        subtitle: 'Private Gemini Assistant · Visible only to you',
        avatarUrl: undefined,
        avatarInitials: undefined,
      };
    }

    if (thread.type === 'dm' && currentUser) {
      const otherIds = thread.participantIds.filter((id) => id !== currentUser.id);
      if (mode === 'monitor' && isSuperAdmin) {
        const names = thread.participantIds
          .map((id) => coworkers.find((c) => c.id === id)?.name)
          .filter(Boolean);
        if (names.length > 0) {
          return {
            title: names.join(' ↔ '),
            subtitle: 'Direct Conversation',
            avatarUrl: undefined,
            avatarInitials: undefined,
          };
        }
      }
      const otherId = otherIds[0];
      const other = otherId ? coworkers.find((c) => c.id === otherId) : undefined;
      if (other) {
        return {
          title: other.name,
          subtitle: other.department || 'Direct Message',
          avatarUrl: other.avatarUrl,
          avatarInitials: other.avatarInitials,
        };
      }
    }
    return {
      title: thread.title,
      subtitle: thread.subtitle,
      avatarUrl: undefined,
      avatarInitials: undefined,
    };
  };

  const availableRecipients = useMemo(() => {
    if (!currentUser) return [];
    const q = recipientQuery.trim().toLowerCase();
    return coworkers
      .filter((c) => c.id !== currentUser.id)
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q)
      );
  }, [coworkers, currentUser, recipientQuery]);

  const visibleThreads = useMemo(() => {
    if (!currentUser) return [];
    if (mode === 'monitor' && isSuperAdmin) {
      const q = monitorQuery.trim().toLowerCase();
      return threads
        .filter((t) => {
          if (t.id === 'thread-ai') return false;
          if (monitorFilter !== 'all' && t.type !== monitorFilter) return false;
          if (!q) return true;
          return (
            t.title.toLowerCase().includes(q) ||
            resolveThreadDisplay(t).title.toLowerCase().includes(q) ||
            t.messages.some(
              (m) =>
                m.text.toLowerCase().includes(q) ||
                m.senderName.toLowerCase().includes(q)
            )
          );
        })
        .sort((a, b) => {
          const msgDiff = b.messages.length - a.messages.length;
          if (msgDiff !== 0) return msgDiff;
          if (a.type === 'ai' && b.type !== 'ai') return -1;
          if (b.type === 'ai' && a.type !== 'ai') return 1;
          return 0;
        });
    }
    return threads
      .filter((t) => {
        if (t.type === 'ai') {
          return t.id === myAiThreadId || t.participantIds.includes(currentUser.id);
        }
        if (t.type === 'channel') return true;
        return t.participantIds.includes(currentUser.id);
      })
      .sort((a, b) => {
        if (a.type === 'ai' && b.type !== 'ai') return -1;
        if (b.type === 'ai' && a.type !== 'ai') return 1;
        return 0;
      });
  }, [threads, currentUser, mode, isSuperAdmin, monitorQuery, monitorFilter, myAiThreadId]);

  const activeThread =
    visibleThreads.find((t) => t.id === selectedThreadId) ?? visibleThreads[0] ?? null;

  const activeThreadDisplay = activeThread ? resolveThreadDisplay(activeThread) : null;

  useEffect(() => {
    if (!activeThread || mode === 'monitor') return;
    if (getThreadUnreadForUser(activeThread) > 0) {
      onMarkThreadRead(activeThread.id);
    }
  }, [activeThread?.id, activeThread?.unreadCount, mode]);

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
          Message coworkers, get pantry restock updates, or chat privately with DeskPantry AI powered by Gemini.
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
            dueDays,
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
    const aiThread =
      visibleThreads.find((t) => t.id === myAiThreadId) ??
      visibleThreads.find((t) => t.type === 'ai');
    if (!aiThread) return;
    setSelectedThreadId(aiThread.id);
    setMode('inbox');
    onSendMessage(aiThread.id, prompt);
    await sendToAiBackend(aiThread, prompt);
  };

  const handleStartConversation = async (recipient: CoworkerProfile) => {
    setStartingRecipientId(recipient.id);
    setChatError('');
    try {
      const threadId = await onStartDirectChat(recipient);
      setMode('inbox');
      setSelectedThreadId(threadId);
      setIsNewChatOpen(false);
      setRecipientQuery('');
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Unable to start direct conversation.'
      );
    } finally {
      setStartingRecipientId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Department Chat &amp; AI Assistant
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Start direct conversations with registered coworkers, coordinate delivery, or chat privately with DeskPantry AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => {
              setChatError('');
              setIsNewChatOpen(true);
            }}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Direct Chat</span>
          </button>

          {isSuperAdmin && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setMode('inbox')}
                className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
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
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
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
      </div>

      {chatError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-red-700 dark:text-red-300">
          <span>{chatError}</span>
          <button
            type="button"
            onClick={() => setChatError('')}
            className="font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden min-h-[560px]">
        {/* Threads Sidebar */}
        <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#0F1917] flex flex-col">
          <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-200">
              {mode === 'monitor' ? 'All Coworker & AI Threads' : 'Conversations'} ({visibleThreads.length})
            </span>
            {mode !== 'monitor' && (
              <button
                type="button"
                onClick={() => {
                  setChatError('');
                  setIsNewChatOpen(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            )}
          </div>

          {mode === 'monitor' && (
            <div className="p-3 border-b border-stone-200 dark:border-stone-800 bg-stone-100/70 dark:bg-[#172523] space-y-2.5">
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Silent Oversight Audit Log (DMs, Channels &amp; AI Chats)
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={monitorQuery}
                  onChange={(e) => setMonitorQuery(e.target.value)}
                  placeholder="Filter coworker, AI chat, or keyword..."
                  className="w-full min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] pl-8 pr-3 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'dm', label: 'Coworker DMs' },
                    { id: 'ai', label: 'AI Chats' },
                    { id: 'channel', label: 'Channels' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMonitorFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      monitorFilter === tab.id
                        ? 'bg-stone-900 dark:bg-teal-700 text-white border-stone-900 dark:border-teal-600'
                        : 'bg-white dark:bg-[#121D1B] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="divide-y divide-stone-200 dark:divide-stone-800 overflow-y-auto">
            {visibleThreads.map((t) => {
              const selected = activeThread?.id === t.id;
              const disp = resolveThreadDisplay(t);
              const unreadForMe = getThreadUnreadForUser(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedThreadId(t.id);
                    setConfirmDeleteThreadId(null);
                    if (mode !== 'monitor') {
                      onMarkThreadRead(t.id);
                    }
                  }}
                  className={`w-full p-4 text-left flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                    selected
                      ? 'bg-white dark:bg-[#172523] border-r-2 border-r-teal-700 dark:border-r-teal-400'
                      : 'hover:bg-white/70 dark:hover:bg-[#172523]/60'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {(t.type === 'dm' || (t.type === 'ai' && mode === 'monitor')) &&
                    disp.avatarUrl ? (
                      <img
                        src={disp.avatarUrl}
                        alt={disp.title}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-xl object-cover shrink-0 border border-stone-200 dark:border-stone-700"
                      />
                    ) : (t.type === 'dm' || (t.type === 'ai' && mode === 'monitor')) &&
                      disp.avatarInitials ? (
                      <div className="w-9 h-9 rounded-xl bg-teal-700/15 dark:bg-teal-500/20 text-teal-800 dark:text-teal-200 text-xs font-bold flex items-center justify-center shrink-0 border border-teal-200/70 dark:border-teal-800">
                        {disp.avatarInitials}
                      </div>
                    ) : (
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
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {disp.title}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                        {disp.subtitle}
                      </div>
                    </div>
                  </div>
                  {unreadForMe > 0 && mode !== 'monitor' && (
                    <span className="px-2 py-0.5 rounded-full bg-teal-700 text-white text-[11px] font-bold tabular-nums shrink-0">
                      {unreadForMe} new
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Conversation Panel */}
        <section className="lg:col-span-8 flex flex-col justify-between bg-white dark:bg-[#121D1B]">
          {!activeThread || !activeThreadDisplay ? (
            <div className="p-10 text-center text-sm text-stone-500 dark:text-stone-400 my-auto">
              Select a conversation or start a new direct chat with a coworker.
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span>{activeThreadDisplay.title}</span>
                    {activeThread.type === 'ai' && mode !== 'monitor' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                        <Lock className="w-3 h-3" />
                        <span>Private</span>
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {activeThreadDisplay.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {mode === 'monitor' ? (
                    <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 inline-flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>Silent Read-Only Oversight</span>
                    </span>
                  ) : activeThread.type === 'ai' ? (
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
                    activeThread.type === 'dm' &&
                    (isSuperAdmin ||
                      activeThread.participantIds.includes(currentUser.id)) && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteThreadId((prev) =>
                            prev === activeThread.id ? null : activeThread.id
                          )
                        }
                        className="min-h-[36px] px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Chat</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {confirmDeleteThreadId === activeThread.id && (
                <div className="px-6 py-3 border-b border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-950/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-red-900 dark:text-red-200">
                    Delete this conversation with <strong>{activeThreadDisplay.title}</strong> and all messages?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteThreadId(null)}
                      className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deletingThreadId === activeThread.id}
                      onClick={() => {
                        setDeletingThreadId(activeThread.id);
                        setChatError('');
                        void onDeleteThread(activeThread.id)
                          .then(() => {
                            setConfirmDeleteThreadId(null);
                            setSelectedThreadId(myAiThreadId);
                          })
                          .catch((err) => {
                            setChatError(
                              err instanceof Error
                                ? err.message
                                : 'Failed to delete conversation.'
                            );
                          })
                          .finally(() => setDeletingThreadId(null));
                      }}
                      className="px-3 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                    >
                      {deletingThreadId === activeThread.id ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}

              {activeThread.type === 'ai' && mode !== 'monitor' && (
                <div className="px-6 py-2.5 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-[#0F1917] flex flex-wrap items-center gap-2">
                  {[
                    'What is my current debt balance?',
                    'Suggest snacks under ₱100',
                    'How do I upload a GCash payment proof?',
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
                {activeThread.messages.length === 0 ? (
                  <div className="text-center py-8 text-xs text-stone-500 dark:text-stone-400">
                    No messages in this conversation yet. Say hello below!
                  </div>
                ) : (
                  activeThread.messages.map((msg) => {
                    const isMine = msg.senderId === currentUser.id && mode !== 'monitor';
                    const canDeleteMsg =
                      mode !== 'monitor' &&
                      (msg.senderId === currentUser.id ||
                        isSuperAdmin ||
                        (activeThread.type === 'dm' &&
                          activeThread.participantIds.includes(currentUser.id)) ||
                        (activeThread.type === 'ai' &&
                          activeThread.participantIds.includes(currentUser.id)));
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col group ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-1">
                          <span>
                            {msg.senderName} · <span className="font-mono">{msg.timestamp}</span>
                          </span>
                          {canDeleteMsg && (
                            <button
                              type="button"
                              disabled={deletingMsgId === msg.id}
                              onClick={() => {
                                setDeletingMsgId(msg.id);
                                setChatError('');
                                void onDeleteMessage(activeThread.id, msg.id)
                                  .catch((err) => {
                                    setChatError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Failed to delete message.'
                                    );
                                  })
                                  .finally(() => setDeletingMsgId(null));
                              }}
                              aria-label="Delete message"
                              title="Delete message"
                              className="p-0.5 rounded text-stone-400 hover:text-red-600 dark:hover:text-red-400 opacity-75 group-hover:opacity-100 disabled:opacity-40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
                  })
                )}

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
                        ? 'Ask DeskPantry AI privately about snacks, stock, or store balances...'
                        : `Message ${activeThreadDisplay.title}...`
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

      {/* New Direct Conversation Recipient Picker Modal */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  New Direct Conversation
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Choose any registered coworker to start or open a private chat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
                placeholder="Search coworker by name or department..."
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] pl-9 pr-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="divide-y divide-stone-200 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-800 max-h-72 overflow-y-auto">
              {availableRecipients.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                  No registered coworkers match your search.
                </div>
              ) : (
                availableRecipients.map((person) => (
                  <div
                    key={person.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-stone-50 dark:hover:bg-[#172523]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {person.avatarUrl ? (
                        <img
                          src={person.avatarUrl}
                          alt={person.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-teal-700/15 dark:bg-teal-500/20 text-teal-800 dark:text-teal-200 text-xs font-bold flex items-center justify-center shrink-0">
                          {person.avatarInitials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {person.name}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {person.department || 'Team Member'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={startingRecipientId === person.id}
                      onClick={() => void handleStartConversation(person)}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {startingRecipientId === person.id ? 'Opening...' : 'Message'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
