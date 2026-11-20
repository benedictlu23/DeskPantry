import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  GCASH_ICON_DATA_URL,
  MARIBANK_ICON_DATA_URL,
  MAYA_ICON_DATA_URL,
} from '../data/seedData';
import { EWalletPost, UserAccount, UserRole } from '../types';
import { formatPHP } from '../utils/format';

interface EWalletExchangeViewProps {
  posts: EWalletPost[];
  currentUser: UserAccount | null;
  currentRole: UserRole;
  onOpenSignIn: () => void;
  onCreatePost: (payload: {
    type: 'sell' | 'buy';
    walletProvider: string;
    totalAmount: number;
    accountNumber: string;
    accountName: string;
    notes?: string;
  }) => void;
  onClaimShare: (postId: string, amount: number, note?: string) => void;
  onAddComment: (postId: string, text: string) => void;
}

const WALLET_OPTIONS = [
  { id: 'GCash', label: 'GCash', icon: GCASH_ICON_DATA_URL },
  { id: 'Maya', label: 'Maya', icon: MAYA_ICON_DATA_URL },
  { id: 'MariBank', label: 'MariBank', icon: MARIBANK_ICON_DATA_URL },
  { id: 'Other', label: 'Other Wallet', icon: '' },
] as const;

function getWalletIcon(provider: string): string | null {
  const normalized = provider.trim().toLowerCase();
  if (normalized.includes('gcash')) return GCASH_ICON_DATA_URL;
  if (normalized.includes('maya')) return MAYA_ICON_DATA_URL;
  if (normalized.includes('mari')) return MARIBANK_ICON_DATA_URL;
  return null;
}

export const EWalletExchangeView: React.FC<EWalletExchangeViewProps> = ({
  posts,
  currentUser,
  currentRole,
  onOpenSignIn,
  onCreatePost,
  onClaimShare,
  onAddComment,
}) => {
  const isGuest = currentRole === UserRole.Guest || !currentUser;

  // Filter & Search
  const [typeFilter, setTypeFilter] = useState<'all' | 'sell' | 'buy' | 'completed'>('all');
  const [walletFilter, setWalletFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Order Detail Modal (List View -> View Order)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [postType, setPostType] = useState<'sell' | 'buy'>('sell');
  const [walletChoice, setWalletChoice] = useState<string>('GCash');
  const [customWallet, setCustomWallet] = useState('');
  const [amountInput, setAmountInput] = useState('5000');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState(currentUser?.name ?? '');
  const [notes, setNotes] = useState('');

  // Detail card interactive states
  const [claimAmount, setClaimAmount] = useState('');
  const [claimNote, setClaimNote] = useState('');
  const [commentText, setCommentText] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [banner, setBanner] = useState('');

  const showToast = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(''), 4500);
  };

  const handleCopy = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setCopiedKey(null);
    }
  };

  const openSellPool = useMemo(
    () =>
      posts
        .filter((p) => p.type === 'sell' && p.remainingAmount > 0)
        .reduce((s, p) => s + p.remainingAmount, 0),
    [posts]
  );

  const openBuyPool = useMemo(
    () =>
      posts
        .filter((p) => p.type === 'buy' && p.remainingAmount > 0)
        .reduce((s, p) => s + p.remainingAmount, 0),
    [posts]
  );

  const activePostsCount = posts.filter((p) => p.status !== 'Completed').length;
  const completedCount = posts.filter((p) => p.status === 'Completed').length;

  const availableWallets = useMemo(() => {
    const unique = Array.from(new Set(posts.map((p) => p.walletProvider)));
    return ['All', ...unique];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      if (typeFilter === 'sell' && (p.type !== 'sell' || p.status === 'Completed')) return false;
      if (typeFilter === 'buy' && (p.type !== 'buy' || p.status === 'Completed')) return false;
      if (typeFilter === 'completed' && p.status !== 'Completed') return false;
      if (walletFilter !== 'All' && p.walletProvider !== walletFilter) return false;
      if (!q) return true;
      return (
        p.walletProvider.toLowerCase().includes(q) ||
        p.accountName.toLowerCase().includes(q) ||
        p.accountNumber.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        (p.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [posts, typeFilter, walletFilter, searchQuery]);

  const selectedPost = useMemo(
    () => (selectedPostId ? posts.find((p) => p.id === selectedPostId) ?? null : null),
    [posts, selectedPostId]
  );

  const handleOpenComposer = () => {
    if (isGuest) {
      onOpenSignIn();
      return;
    }
    if (!accountName && currentUser?.name) {
      setAccountName(currentUser.name);
    }
    setIsComposerOpen((prev) => !prev);
  };

  const handleOpenOrder = (post: EWalletPost) => {
    setSelectedPostId(post.id);
    setClaimAmount('');
    setClaimNote('');
    setCommentText('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      onOpenSignIn();
      return;
    }
    const provider =
      walletChoice === 'Other' ? customWallet.trim() || 'E-Wallet' : walletChoice;
    const total = Math.max(50, Math.round(Number(amountInput) || 0));
    if (!accountNumber.trim() || !accountName.trim() || total <= 0) return;

    onCreatePost({
      type: postType,
      walletProvider: provider,
      totalAmount: total,
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim(),
      notes: notes.trim() || undefined,
    });

    setAccountNumber('');
    setNotes('');
    setIsComposerOpen(false);
    showToast(
      `Posted! Your ${postType === 'sell' ? 'Sell' : 'Buy'} ${provider} (${formatPHP(total)}) order is now on the public list.`
    );
  };

  const handleClaimSubmit = (post: EWalletPost) => {
    if (isGuest) {
      onOpenSignIn();
      return;
    }
    const raw = Number(claimAmount);
    const share = Math.min(post.remainingAmount, Math.max(1, Math.round(raw || 0)));
    if (!share || share <= 0) return;

    onClaimShare(post.id, share, claimNote.trim() || undefined);
    setClaimAmount('');
    setClaimNote('');

    const nextRem = post.remainingAmount - share;
    showToast(
      nextRem <= 0
        ? `Done! Took the last ${formatPHP(share)} — ${post.walletProvider} order is now Completed!`
        : `You took ${formatPHP(share)} on ${post.accountName}'s ${post.walletProvider} order (${formatPHP(
            nextRem
          )} left).`
    );
  };

  const handleCommentSubmit = (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (isGuest) {
      onOpenSignIn();
      return;
    }
    const text = commentText.trim();
    if (!text) return;
    onAddComment(postId, text);
    setCommentText('');
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400 mb-1">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Open to Public · Trade Cash &amp; E-Wallet with Coworkers</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Buy / Sell E-Wallet
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
            Browse the list below and tap <strong className="text-stone-900 dark:text-stone-100">View Order</strong> to see full account details, buy a partial or full share, and write comments. No QR upload needed.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenComposer}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors shrink-0 cursor-pointer"
        >
          {isComposerOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isComposerOpen ? 'Close Post Form' : 'Post Buy / Sell E-Wallet'}</span>
        </button>
      </div>

      {banner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {/* Public Guest Banner */}
      {isGuest && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/50 dark:bg-teal-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-stone-700 dark:text-stone-300">
            <strong className="text-stone-900 dark:text-stone-100">Public Board:</strong>{' '}
            Anyone can check live offers and comments. Sign in when you want to post, take a share, or comment.
          </div>
          <button
            type="button"
            onClick={onOpenSignIn}
            className="min-h-[38px] rounded-xl bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 shrink-0 cursor-pointer"
          >
            Sign In to Trade
          </button>
        </div>
      )}

      {/* Simple Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
          <div className="text-xs text-stone-500 dark:text-stone-400">E-Wallet Available</div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
            {formatPHP(openSellPool)}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            Ready to buy with cash
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
          <div className="text-xs text-stone-500 dark:text-stone-400">Buy Requests</div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-sky-700 dark:text-sky-400 font-mono tabular-nums">
            {formatPHP(openBuyPool)}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            Coworkers paying cash
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
          <div className="text-xs text-stone-500 dark:text-stone-400">Open Orders</div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {activePostsCount}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            Waiting to be filled
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
          <div className="text-xs text-stone-500 dark:text-stone-400">Completed</div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            {completedCount}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            100% finished
          </div>
        </div>
      </div>

      {/* Collapsible Create Post Form */}
      {isComposerOpen && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-white dark:bg-[#121D1B] p-5 sm:p-6 space-y-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Post a New Buy or Sell Order
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                No QR upload needed — just fill in your wallet, amount, account number, and name.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsComposerOpen(false)}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
              1. Pick One: Sell or Buy?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPostType('sell')}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  postType === 'sell'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60'
                    : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523]'
                }`}
              >
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Sell E-Wallet (Get Cash)
                </div>
                <div className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                  I have e-wallet balance (e.g. ₱5,000 GCash) and want cash.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPostType('buy')}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  postType === 'buy'
                    ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/50'
                    : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523]'
                }`}
              >
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Buy E-Wallet (Have Cash)
                </div>
                <div className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                  I have cash on hand and want someone to load my e-wallet.
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                2. Pick E-Wallet
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WALLET_OPTIONS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setWalletChoice(w.id)}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      walletChoice === w.id
                        ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {w.icon ? (
                      <img src={w.icon} alt={w.label} className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <Wallet className="w-3.5 h-3.5" />
                    )}
                    <span>{w.label}</span>
                  </button>
                ))}
              </div>
              {walletChoice === 'Other' && (
                <input
                  type="text"
                  required
                  value={customWallet}
                  onChange={(e) => setCustomWallet(e.target.value)}
                  placeholder="Wallet name (e.g. GoTyme, SeaBank)"
                  className="mt-2 w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                3. Amount (₱) — Coworkers can take partial amounts
              </label>
              <input
                type="number"
                min="50"
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="5000"
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[500, 1000, 2000, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountInput(String(preset))}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-[11px] font-mono font-semibold text-stone-700 dark:text-stone-300 hover:border-teal-600 cursor-pointer"
                  >
                    {formatPHP(preset)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Account Number
              </label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 09134567890"
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Account Name
              </label>
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Meetup Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Meet at 4F Design Pod or Pantry Counter B"
              className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-stone-500 dark:text-stone-400">
              No QR uploaded. Anyone can view your post, buy a partial share, and leave a comment.
            </span>
            <button
              type="submit"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Post to Board</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: `All (${posts.length})` },
            { id: 'sell', label: 'Selling E-Wallet' },
            { id: 'buy', label: 'Buying E-Wallet' },
            { id: 'completed', label: `Completed (${completedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id as typeof typeFilter)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-[#0F2E2A] dark:bg-teal-700 text-white'
                  : 'bg-stone-100 dark:bg-[#172523] text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            className="min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs font-semibold text-stone-700 dark:text-stone-200"
          >
            {availableWallets.map((w) => (
              <option key={w} value={w}>
                {w === 'All' ? 'All Wallets' : w}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or wallet..."
              className="w-full min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] pl-8 pr-3 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* CLEAN LIST VIEW FIRST */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center space-y-2">
          <Wallet className="w-9 h-9 text-stone-300 dark:text-stone-700 mx-auto" />
          <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            No orders match your filter.
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Try choosing &ldquo;All&rdquo; or post a new Buy/Sell E-Wallet order above.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] divide-y divide-stone-200 dark:divide-stone-800 overflow-hidden">
          {filteredPosts.map((post) => {
            const walletIcon = getWalletIcon(post.walletProvider);
            const filledAmount = post.totalAmount - post.remainingAmount;
            const progressPct =
              post.totalAmount > 0
                ? Math.min(100, Math.round((filledAmount / post.totalAmount) * 100))
                : 100;
            const isCompleted = post.remainingAmount <= 0 || post.status === 'Completed';

            return (
              <div
                key={post.id}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-stone-50/70 dark:hover:bg-[#172523]/70 transition-colors"
              >
                {/* Left: Wallet Icon + Who + Clear Tag */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {walletIcon ? (
                    <img
                      src={walletIcon}
                      alt={post.walletProvider}
                      className="w-11 h-11 rounded-xl object-cover border border-stone-200 dark:border-stone-700 shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide ${
                          post.type === 'sell'
                            ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300'
                            : 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300'
                        }`}
                      >
                        {post.type === 'sell' ? `Selling ${post.walletProvider}` : `Buying ${post.walletProvider}`}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isCompleted
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                            : post.status === 'Partially Filled'
                              ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {isCompleted ? 'Completed' : post.status}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                      {post.accountName}{' '}
                      <span className="font-normal text-xs text-stone-500 dark:text-stone-400">
                        · {post.authorDepartment} · {post.createdAt}
                      </span>
                    </div>

                    {/* Progress Line + Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                        <span>{post.comments.length} comments</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                        <span>{post.fills.length} joined</span>
                      </span>
                      <span className="font-mono">{progressPct}% filled</span>
                    </div>
                  </div>
                </div>

                {/* Right: Clear Amount Left + View Order Button */}
                <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 dark:border-stone-800 shrink-0">
                  <div className="md:text-right">
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">
                      {isCompleted ? 'Total Completed' : 'Amount Left'}
                    </div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                      {formatPHP(isCompleted ? post.totalAmount : post.remainingAmount)}
                      {!isCompleted && (
                        <span className="text-xs font-normal text-stone-500 dark:text-stone-400 ml-1">
                          / {formatPHP(post.totalAmount)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 w-28 h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isCompleted
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : 'bg-teal-600 dark:bg-teal-400'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenOrder(post)}
                    className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 transition-colors shrink-0 cursor-pointer"
                  >
                    <span>View Order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL ORDER DETAIL MODAL (Opens when clicking "View Order") */}
      {selectedPost && (() => {
        const walletIcon = getWalletIcon(selectedPost.walletProvider);
        const filledAmount = selectedPost.totalAmount - selectedPost.remainingAmount;
        const progressPct =
          selectedPost.totalAmount > 0
            ? Math.min(100, Math.round((filledAmount / selectedPost.totalAmount) * 100))
            : 100;
        const isCompleted =
          selectedPost.remainingAmount <= 0 || selectedPost.status === 'Completed';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/65 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-xl rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
              {/* Top Bar */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedPostId(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-200 hover:text-teal-700 dark:hover:text-teal-400 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to List</span>
                </button>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isCompleted
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                      : selectedPost.status === 'Partially Filled'
                        ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                        : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {isCompleted ? 'Completed' : selectedPost.status}
                </span>
              </div>

              {/* Scrollable Card Body */}
              <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
                {/* 1. Order Identity */}
                <div className="flex items-center gap-3.5">
                  {walletIcon ? (
                    <img
                      src={walletIcon}
                      alt={selectedPost.walletProvider}
                      className="w-12 h-12 rounded-xl object-cover border border-stone-200 dark:border-stone-700 bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                      <Wallet className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                          selectedPost.type === 'sell'
                            ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300'
                            : 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300'
                        }`}
                      >
                        {selectedPost.type === 'sell' ? 'Selling E-Wallet' : 'Buying E-Wallet'}
                      </span>
                      <span className="text-base font-extrabold text-stone-900 dark:text-stone-100">
                        {selectedPost.walletProvider}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Posted by <strong className="text-stone-800 dark:text-stone-200">{selectedPost.authorName}</strong> ·{' '}
                      {selectedPost.authorDepartment} · {selectedPost.createdAt}
                    </div>
                  </div>
                </div>

                {/* 2. Amount Left & Progress */}
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        {isCompleted
                          ? 'Full Amount Completed'
                          : selectedPost.type === 'sell'
                            ? 'E-Wallet Balance Left to Buy'
                            : 'Amount Still Needed'}
                      </div>
                      <div className="text-2xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                        {formatPHP(selectedPost.remainingAmount)}
                        <span className="text-xs font-normal text-stone-500 dark:text-stone-400 ml-1.5">
                          out of {formatPHP(selectedPost.totalAmount)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400">
                      {progressPct}% done
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isCompleted
                          ? 'bg-emerald-600 dark:bg-emerald-500'
                          : 'bg-teal-600 dark:bg-teal-400'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* 3. Account Number & Name (Copyable, No QR) */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Account Details (No QR Needed)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#0F1917] px-3 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 uppercase font-medium">
                          Account Number
                        </div>
                        <div className="text-sm font-mono font-bold text-stone-900 dark:text-stone-100 truncate">
                          {selectedPost.accountNumber}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedPost.accountNumber, `${selectedPost.id}-num`)}
                        className="min-h-[32px] px-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-700 dark:text-stone-200 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedKey === `${selectedPost.id}-num` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#0F1917] px-3 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 uppercase font-medium">
                          Account Name
                        </div>
                        <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                          {selectedPost.accountName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedPost.accountName, `${selectedPost.id}-name`)}
                        className="min-h-[32px] px-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-700 dark:text-stone-200 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedKey === `${selectedPost.id}-name` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {selectedPost.notes && (
                    <p className="text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-[#172523] rounded-xl p-3 border border-stone-200 dark:border-stone-800">
                      {selectedPost.notes}
                    </p>
                  )}
                </div>

                {/* 4. Buy / Fill Partial or Full Share */}
                {!isCompleted && (
                  <div className="rounded-xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/25 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-stone-900 dark:text-stone-100">
                        {selectedPost.type === 'sell'
                          ? 'Buy a Partial or Full Share'
                          : 'Send a Partial or Full Share'}
                      </span>
                      <span className="text-stone-500 dark:text-stone-400">
                        Max: {formatPHP(selectedPost.remainingAmount)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[500, 1000, 2000]
                        .filter((amt) => amt < selectedPost.remainingAmount)
                        .map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setClaimAmount(String(amt))}
                            className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] text-xs font-mono font-semibold text-stone-700 dark:text-stone-200 hover:border-teal-600 cursor-pointer"
                          >
                            {formatPHP(amt)}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => setClaimAmount(String(selectedPost.remainingAmount))}
                        className="px-3 py-1.5 rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/70 text-xs font-mono font-bold text-teal-800 dark:text-teal-300 cursor-pointer"
                      >
                        Take All ({formatPHP(selectedPost.remainingAmount)})
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        max={selectedPost.remainingAmount}
                        value={claimAmount}
                        onChange={(e) => setClaimAmount(e.target.value)}
                        placeholder={`Amount (₱1 – ${selectedPost.remainingAmount})`}
                        className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 text-xs font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={claimNote}
                        onChange={(e) => setClaimNote(e.target.value)}
                        placeholder="Note (e.g. cash at 4F desk)"
                        className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleClaimSubmit(selectedPost)}
                      disabled={
                        !isGuest &&
                        (!claimAmount ||
                          Number(claimAmount) <= 0 ||
                          Number(claimAmount) > selectedPost.remainingAmount)
                      }
                      className="w-full min-h-[42px] rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 cursor-pointer"
                    >
                      {isGuest
                        ? 'Sign In to Join This Order'
                        : selectedPost.type === 'sell'
                          ? `Buy ${claimAmount ? formatPHP(Number(claimAmount)) : ''} Share`
                          : `Fill ${claimAmount ? formatPHP(Number(claimAmount)) : ''} Share`}
                    </button>
                  </div>
                )}

                {/* 5. Who Already Joined */}
                {selectedPost.fills.length > 0 && (
                  <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#0F1917] p-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
                      <Users className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      <span>Coworkers Who Joined ({selectedPost.fills.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedPost.fills.map((f) => (
                        <div
                          key={f.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 dark:text-stone-300"
                        >
                          <span>
                            <strong className="text-stone-900 dark:text-stone-100">{f.userName}</strong>{' '}
                            · {f.createdAt}
                            {f.note ? ` · ${f.note}` : ''}
                          </span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {formatPHP(f.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Comments Under Order */}
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#0F1917] p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
                    <MessageSquare className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                    <span>Comments ({selectedPost.comments.length})</span>
                  </div>

                  {selectedPost.comments.length > 0 ? (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {selectedPost.comments.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] px-3 py-2 space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-bold text-stone-900 dark:text-stone-100">
                              {c.userName}{' '}
                              <span className="font-normal text-stone-500 dark:text-stone-400">
                                ({c.userDepartment})
                              </span>
                            </span>
                            <span className="text-stone-400 shrink-0">{c.createdAt}</span>
                          </div>
                          <p className="text-xs text-stone-700 dark:text-stone-300">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      No comments yet. Ask where to hand over cash or ask about partial amounts below!
                    </p>
                  )}

                  <form
                    onSubmit={(e) => handleCommentSubmit(e, selectedPost.id)}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={
                        isGuest
                          ? 'Sign in to write a comment...'
                          : 'Write a comment under this order...'
                      }
                      className="flex-1 min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-[40px] px-4 rounded-xl bg-stone-900 dark:bg-teal-700 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-teal-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isGuest ? 'Sign In' : 'Send'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
