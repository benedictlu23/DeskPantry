import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Lock,
  Receipt,
  Search,
  ShoppingBag,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { SAMPLE_RECEIPT_DATA_URL } from '../data/seedData';
import {
  FulfillmentType,
  LoanRecord,
  PaymentMethodConfig,
  PaymentProof,
  StoreOrder,
  UserAccount,
  UserRole,
} from '../types';
import { formatPHP, isDateWithinPeriod } from '../utils/format';
import { compressImageFileToDataUrl } from '../utils/image';
import { PaymentMethodCard } from './PaymentMethodCard';

interface LedgerDashboardViewProps {
  currentUser: UserAccount | null;
  currentRole: UserRole;
  users: UserAccount[];
  orders: StoreOrder[];
  loans: LoanRecord[];
  proofs: PaymentProof[];
  paymentMethods: PaymentMethodConfig[];
  ownerTotalCommission: number;
  dueDays: [number, number];
  nextDueLabel: string;
  onOpenSignIn: () => void;
  onSubmitDebtProof: (payload: {
    amount: number;
    channel: string;
    referenceNo: string;
    imageDataUrl: string;
  }) => void;
}

export const LedgerDashboardView: React.FC<LedgerDashboardViewProps> = ({
  currentUser,
  currentRole,
  users,
  orders,
  loans,
  proofs,
  paymentMethods,
  ownerTotalCommission,
  dueDays,
  nextDueLabel,
  onOpenSignIn,
  onSubmitDebtProof,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'receipts'>('orders');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');

  const digitalMethods = useMemo(
    () => paymentMethods.filter((m) => m.enabled && m.type === 'digital'),
    [paymentMethods]
  );

  const [payChannelId, setPayChannelId] = useState<string>(
    digitalMethods[0]?.id ?? 'pm-gcash'
  );
  const [payRef, setPayRef] = useState('');
  const [payImage, setPayImage] = useState('');
  const [banner, setBanner] = useState('');

  // Recent Orders Filters & Expanded Logs
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const isGuest = currentRole === UserRole.Guest || !currentUser;
  const isAdminOrSuper =
    currentRole === UserRole.Admin || currentRole === UserRole.SuperAdmin;

  const totalStoreDebtCollectibles = users.reduce((sum, u) => sum + u.debtBalance, 0);
  const totalLoanReceivables = loans
    .filter((l) => l.status === 'Active')
    .reduce((sum, l) => sum + l.remainingBalance, 0);
  const totalCollectibles = totalStoreDebtCollectibles + totalLoanReceivables;

  const userOrders = useMemo(
    () => (currentUser ? orders.filter((o) => o.userId === currentUser.id) : []),
    [currentUser, orders]
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return userOrders.filter((ord) => {
      if (statusFilter !== 'all' && ord.status !== statusFilter) return false;
      if (fulfillmentFilter !== 'all' && ord.fulfillment !== fulfillmentFilter) return false;
      if (!isDateWithinPeriod(ord.orderDateIso, periodFilter)) return false;
      if (!q) return true;
      const itemsMatch = ord.items.some((i) => i.name.toLowerCase().includes(q));
      const runnerMatch = (ord.assignedRunner ?? '').toLowerCase().includes(q);
      return (
        ord.id.toLowerCase().includes(q) ||
        ord.paymentMethod.toLowerCase().includes(q) ||
        itemsMatch ||
        runnerMatch
      );
    });
  }, [userOrders, orderSearch, statusFilter, fulfillmentFilter, periodFilter]);

  const userProofs = currentUser ? proofs.filter((p) => p.userId === currentUser.id) : [];
  const userLoans = currentUser ? loans.filter((l) => l.userId === currentUser.id) : [];
  const userActiveLoanBal = userLoans
    .filter((l) => l.status === 'Active')
    .reduce((s, l) => s + l.remainingBalance, 0);

  const totalOwed = (currentUser?.debtBalance ?? 0) + userActiveLoanBal;
  const pendingProofsForUser = userProofs.filter((p) => p.status === 'pending').length;

  const selectedDigitalMethod =
    digitalMethods.find((m) => m.id === payChannelId) ?? digitalMethods[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void compressImageFileToDataUrl(file).then((compressed) => {
      setPayImage(compressed);
    });
  };

  const handleProofSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(payAmount) || 0;
    if (amt <= 0 || !payRef.trim() || !payImage || !selectedDigitalMethod) return;
    onSubmitDebtProof({
      amount: amt,
      channel: selectedDigitalMethod.title,
      referenceNo: payRef.trim(),
      imageDataUrl: payImage,
    });
    setShowPayModal(false);
    setPayAmount('');
    setPayRef('');
    setPayImage('');
    setActiveTab('receipts');
    setBanner(
      `Receipt sent! (${selectedDigitalMethod.title} · ${formatPHP(amt, true)}). Admin will check and update your balance soon.`
    );
    setTimeout(() => setBanner(''), 5000);
  };

  const openPayModalWithAmount = (amount: number) => {
    setPayAmount(String(Math.max(0, amount)));
    setShowPayModal(true);
  };

  if (isGuest) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-8 sm:p-10 text-center">
        <Lock className="w-9 h-9 text-teal-600 dark:text-teal-400 mx-auto" />
        <h2 className="mt-3 text-xl font-bold text-stone-900 dark:text-stone-100">
          Sign in to see your Money &amp; Orders
        </h2>
        <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          See how much you owe, pay using GCash/Maya/MariBank, and check every order you placed.
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

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Friendly Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            My Money &amp; Orders
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Hi <strong className="text-stone-900 dark:text-stone-100">{currentUser.name}</strong>! Here is a simple look at what you bought, what you owe, and your payment receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openPayModalWithAmount(currentUser.debtBalance)}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors shrink-0 cursor-pointer"
        >
          <CreditCard className="w-4 h-4" />
          <span>Pay Balance / Upload Receipt</span>
        </button>
      </div>

      {banner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {/* Simple Summary — Easy for Anyone to Understand */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          currentUser.pautanganEnabled || userActiveLoanBal > 0
            ? 'lg:grid-cols-4'
            : 'lg:grid-cols-3'
        } gap-3.5 sm:gap-4`}
      >
        {/* Card 1: Store Utang */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              1. What I Owe the Store (Utang)
            </div>
            <div
              className={`mt-1.5 text-2xl font-extrabold font-mono tabular-nums ${
                currentUser.debtBalance > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatPHP(currentUser.debtBalance, true)}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {currentUser.debtBalance > 0
                ? `Please pay on or before ${nextDueLabel}.`
                : 'All paid! Nothing owed to the store.'}
            </p>
          </div>
          {currentUser.debtBalance > 0 && (
            <button
              type="button"
              onClick={() => openPayModalWithAmount(currentUser.debtBalance)}
              className="w-full min-h-[36px] rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold cursor-pointer"
            >
              Pay {formatPHP(currentUser.debtBalance)} Now
            </button>
          )}
        </div>

        {/* Card 2: Cash Loan (only shown when Pautangan is enabled for user or user has an active loan) */}
        {(currentUser.pautanganEnabled || userActiveLoanBal > 0) && (
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              2. Cash Loan Left (Pautangan)
            </div>
            <div className="mt-1.5 text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
              {formatPHP(userActiveLoanBal, true)}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {userActiveLoanBal > 0
                ? `From your ${formatPHP(currentUser.pautanganLimit)} loan limit.`
                : `No active cash loan. Limit: ${formatPHP(currentUser.pautanganLimit)}.`}
            </p>
          </div>
        )}

        {/* Card 3: Total Combined */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
          <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            {currentUser.pautanganEnabled || userActiveLoanBal > 0
              ? '3. Total Money to Pay Back'
              : '2. Total Money to Pay Back'}
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
            {formatPHP(totalOwed, true)}
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {currentUser.pautanganEnabled || userActiveLoanBal > 0
              ? 'Store utang + cash loan combined.'
              : 'Current store credit balance.'}
          </p>
        </div>

        {/* Card 4: Activity */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
          <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            {currentUser.pautanganEnabled || userActiveLoanBal > 0
              ? '4. My Orders & Receipts'
              : '3. My Orders & Receipts'}
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {userOrders.length} Orders
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {pendingProofsForUser > 0
              ? `${pendingProofsForUser} receipt waiting for Admin check`
              : `Total spent: ${formatPHP(currentUser.totalSpent)}`}
          </p>
        </div>
      </div>

      {/* Simple 3-Step How To Pay Guide (shown when user has open debt) */}
      {currentUser.debtBalance > 0 && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/25 p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100">
              <Wallet className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>How to Pay Your Store Balance in 3 Easy Steps</span>
            </div>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              Due dates every {dueDays[0]}th &amp; {dueDays[1]}th
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-3">
              <div className="font-bold text-teal-700 dark:text-teal-400">Step 1: Send Money</div>
              <div className="mt-0.5 text-stone-600 dark:text-stone-300">
                Tap &ldquo;Pay Balance&rdquo;, pick GCash / Maya / MariBank, and copy the number or scan QR.
              </div>
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-3">
              <div className="font-bold text-teal-700 dark:text-teal-400">Step 2: Send Screenshot</div>
              <div className="mt-0.5 text-stone-600 dark:text-stone-300">
                Type your receipt Reference Number and upload a screenshot of your payment.
              </div>
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-3">
              <div className="font-bold text-teal-700 dark:text-teal-400">Step 3: Balance Clears</div>
              <div className="mt-0.5 text-stone-600 dark:text-stone-300">
                Admin confirms your receipt and your &ldquo;What I Owe&rdquo; number drops automatically!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Boss / Admin Summary Box (Only visible to Admin & Super Admin) */}
      {isAdminOrSuper && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Admin View: All Coworker Balances to Collect
            </div>
            <div className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
              {formatPHP(totalCollectibles, true)}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              Store: {formatPHP(totalStoreDebtCollectibles)} + Loans: {formatPHP(totalLoanReceivables)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Owner Commission Earned
            </div>
            <div className="mt-1 text-xl font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
              {formatPHP(ownerTotalCommission, true)}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              From coworker For-Sale items
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Receipts Waiting Your Check
            </div>
            <div className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              {proofs.filter((p) => p.status === 'pending').length} Receipts
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              Open Admin Config to confirm
            </div>
          </div>
        </div>
      )}

      {/* Simple 2-Tab Switcher: My Orders vs My Receipts */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-stone-100 dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-300'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>My Orders ({userOrders.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('receipts')}
          className={`flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'receipts'
              ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-300'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>My Payment Receipts ({userProofs.length})</span>
        </button>
      </div>

      {/* Tab 1: My Orders (Easy-to-Read Cards + Simple Filters) */}
      {activeTab === 'orders' && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 space-y-3">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Everything I Ordered ({filteredOrders.length})
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Search for an item or filter by date, delivery, or status.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search food or order ID..."
                  className="w-full min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] pl-8 pr-3 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
                className="min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 text-xs text-stone-800 dark:text-stone-200"
              >
                <option value="all">When: All Dates</option>
                <option value="week">When: This Week</option>
                <option value="month">When: This Month</option>
                <option value="year">When: This Year</option>
              </select>

              <select
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value)}
                className="min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 text-xs text-stone-800 dark:text-stone-200"
              >
                <option value="all">How: Pickup &amp; Delivery</option>
                <option value={FulfillmentType.Pickup}>How: Pickup Only</option>
                <option value={FulfillmentType.Delivery}>How: Delivery Only</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 text-xs text-stone-800 dark:text-stone-200"
              >
                <option value="all">Status: Everything</option>
                <option value="Confirmed">Status: Confirmed</option>
                <option value="Pending Payment Proof">Status: Waiting Receipt Check</option>
                <option value="Completed">Status: Done / Delivered</option>
              </select>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-500 dark:text-stone-400">
              No orders found for these filters.
            </div>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {filteredOrders.map((ord) => {
                const isExpanded = expandedOrderId === ord.id;
                const statusText = ord.deliveryStatus ?? ord.status;
                return (
                  <div key={ord.id} className="p-4 sm:p-5 space-y-3">
                    {/* Top Row: Items & Total Price */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-stone-500 dark:text-stone-400">
                            #{ord.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              statusText === 'Delivered' || statusText === 'Completed'
                                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {statusText}
                          </span>
                        </div>
                        <div className="mt-1 text-base font-bold text-stone-900 dark:text-stone-100">
                          {ord.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                        </div>
                      </div>

                      <div className="sm:text-right shrink-0">
                        <div className="text-lg font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                          {formatPHP(ord.totalAmount, true)}
                        </div>
                        {(ord.deliveryFee ?? 0) > 0 && (
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            (includes {formatPHP(ord.deliveryFee ?? 0)} delivery fee)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Plain Labeled Mini Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-stone-50 dark:bg-[#172523] border border-stone-200 dark:border-stone-800 p-3 text-xs">
                      <div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">Ordered On</div>
                        <div className="font-semibold text-stone-900 dark:text-stone-100">
                          {ord.createdAt}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">Paid With</div>
                        <div className="font-semibold text-stone-900 dark:text-stone-100">
                          {ord.paymentMethod}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">How You Get It</div>
                        <div className="font-semibold text-teal-700 dark:text-teal-400">
                          {ord.fulfillment}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">
                          {ord.assignedRunner ? 'Delivered By' : 'Due Date'}
                        </div>
                        <div className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {ord.assignedRunner || ord.dueDateLabel || 'Today'}
                        </div>
                      </div>
                    </div>

                    {/* Toggle Step-by-Step Logs */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {ord.deliveredAt ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          Delivered at {ord.deliveredAt}
                        </span>
                      ) : ord.dueDateLabel ? (
                        <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                          Pay on or before {ord.dueDateLabel}
                        </span>
                      ) : (
                        <span />
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        <span>
                          {isExpanded ? 'Hide Order Steps' : `See Order Steps (${ord.logs?.length ?? 0})`}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#0F1917] p-3.5 space-y-2">
                        <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
                          Step-by-Step Order Timeline
                        </div>
                        <div className="space-y-1.5">
                          {(ord.logs ?? []).map((log, idx) => (
                            <div
                              key={log.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 dark:text-stone-300"
                            >
                              <span>
                                <strong className="text-teal-700 dark:text-teal-400">
                                  {idx + 1}. {log.actor}:
                                </strong>{' '}
                                {log.event}
                              </span>
                              <span className="font-mono text-[11px] text-stone-400">
                                {log.timestamp}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Payment Receipts */}
      {activeTab === 'receipts' && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Payment Receipts I Sent ({userProofs.length})
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Every screenshot you uploaded to pay your store balance or orders.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openPayModalWithAmount(currentUser.debtBalance)}
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 self-start cursor-pointer"
            >
              + Upload New Receipt
            </button>
          </div>

          {userProofs.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-500 dark:text-stone-400">
              You have not uploaded any payment receipts yet.
            </div>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {userProofs.map((prf) => (
                <div
                  key={prf.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={prf.imageDataUrl}
                      alt={`Receipt ${prf.referenceNo}`}
                      className="w-14 h-14 rounded-xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                        {prf.channel} — {prf.purpose}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 font-mono truncate">
                        Ref: {prf.referenceNo} · {prf.submittedAt}
                      </div>
                      <div
                        className={`text-xs font-bold ${
                          prf.status === 'approved'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : prf.status === 'rejected'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {prf.status === 'approved'
                          ? 'Approved & Counted!'
                          : prf.status === 'rejected'
                            ? 'Not Accepted — Please upload a clearer photo'
                            : 'Waiting for Admin to Check'}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums sm:text-right shrink-0">
                    {formatPHP(prf.amount, true)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit Payment Proof Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <form
            onSubmit={handleProofSubmit}
            className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 sm:p-6 shadow-xl space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Pay Your Balance
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Send money to the wallet below, then upload your receipt screenshot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                1. How much are you paying? (₱)
              </label>
              <input
                type="number"
                min="1"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                2. Pick Wallet to Pay
              </label>
              <div className="grid grid-cols-3 gap-2">
                {digitalMethods.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setPayChannelId(ch.id)}
                    className={`min-h-[40px] rounded-xl border px-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedDigitalMethod?.id === ch.id
                        ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {ch.iconImage && (
                      <img
                        src={ch.iconImage}
                        alt={ch.title}
                        className="w-4 h-4 rounded object-cover shrink-0"
                      />
                    )}
                    <span className="truncate">{ch.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedDigitalMethod && (
              <PaymentMethodCard
                method={selectedDigitalMethod}
                amount={Number(payAmount) || 0}
              />
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                3. Receipt Reference Number
              </label>
              <input
                type="text"
                required
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="e.g. GC-904821735"
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                4. Upload Receipt Screenshot
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Upload Screenshot</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPayImage(SAMPLE_RECEIPT_DATA_URL);
                    if (!payRef && selectedDigitalMethod) {
                      setPayRef(`${selectedDigitalMethod.title.slice(0, 2).toUpperCase()}-9021455`);
                    }
                  }}
                  className="min-h-[40px] rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/40 px-3 py-2 text-xs font-medium text-teal-800 dark:text-teal-300 cursor-pointer"
                >
                  Use Sample Receipt
                </button>
              </div>
              {payImage && (
                <img
                  src={payImage}
                  alt="Proof preview"
                  className="w-20 h-20 rounded-lg object-cover border border-stone-200 dark:border-stone-700"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={!payImage || !payRef.trim() || Number(payAmount) <= 0}
              className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 cursor-pointer"
            >
              Send Receipt to Admin
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
