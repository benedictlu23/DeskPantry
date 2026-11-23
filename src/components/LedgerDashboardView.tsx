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
import {
  FulfillmentType,
  LoanRecord,
  MarketplaceListing,
  PaymentMethod,
  PaymentMethodConfig,
  PaymentProof,
  SellerConfig,
  StoreOrder,
  UserAccount,
  UserRole,
} from '../types';
import {
  formatPHP,
  getOrderItemsSubtotal,
  getOrderRemainingDebt,
  isDateWithinPeriod,
  isOrderPendingSellerConfirmation,
} from '../utils/format';
import { compressImageFileToDataUrl, isValidUploadedReceipt } from '../utils/image';
import { ImagePreviewModal, ImagePreviewTarget } from './ImagePreviewModal';
import { PaymentMethodCard } from './PaymentMethodCard';

interface LedgerDashboardViewProps {
  currentUser: UserAccount | null;
  currentRole: UserRole;
  users: UserAccount[];
  orders: StoreOrder[];
  listings: MarketplaceListing[];
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
  onSubmitSellerDebtProof: (payload: {
    sellerId: string;
    sellerName: string;
    amount: number;
    channel: string;
    referenceNo: string;
    imageDataUrl: string;
    orderIds: string[];
  }) => Promise<void>;
  onFetchSellerConfig?: (sellerId: string) => Promise<SellerConfig | null>;
}

interface SellerDebtGroup {
  sellerId: string;
  sellerName: string;
  totalOwed: number;
  grossDebt: number;
  paidSoFar: number;
  orderIds: string[];
  itemCounts: Record<string, number>;
  dueLabel: string;
  listingPaymentHint: string;
}

export const LedgerDashboardView: React.FC<LedgerDashboardViewProps> = ({
  currentUser,
  currentRole,
  users,
  orders,
  listings,
  loans,
  proofs,
  paymentMethods,
  ownerTotalCommission,
  dueDays,
  nextDueLabel,
  onOpenSignIn,
  onSubmitDebtProof,
  onSubmitSellerDebtProof,
  onFetchSellerConfig,
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
  const [payError, setPayError] = useState('');
  const [banner, setBanner] = useState('');
  const [previewImage, setPreviewImage] = useState<ImagePreviewTarget | null>(null);

  // Community Seller Pay Modal state
  const [payingSellerGroup, setPayingSellerGroup] = useState<SellerDebtGroup | null>(null);
  const [sellerPayConfig, setSellerPayConfig] = useState<SellerConfig | null>(null);
  const [loadingSellerCfg, setLoadingSellerCfg] = useState(false);
  const [sellerPayAmount, setSellerPayAmount] = useState('');
  const [sellerPayChannel, setSellerPayChannel] = useState('GCash');
  const [sellerPayRef, setSellerPayRef] = useState('');
  const [sellerPayImage, setSellerPayImage] = useState('');
  const [submittingSellerProof, setSubmittingSellerProof] = useState(false);
  const [sellerPayError, setSellerPayError] = useState('');

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

  const pendingSellerConfirmCount = useMemo(
    () => userOrders.filter(isOrderPendingSellerConfirmation).length,
    [userOrders]
  );

  // Community Debt grouped per Seller (ONLY confirmed/completed orders, never unconfirmed ones)
  const sellerDebtGroups = useMemo(() => {
    const map = new Map<string, SellerDebtGroup>();
    for (const o of userOrders) {
      if (o.source !== 'marketplace') continue;
      if (o.paymentMethod !== PaymentMethod.Debt) continue;
      if (o.status !== 'Confirmed' && o.status !== 'Completed') continue;
      if (o.debtSettled) continue;

      const remainingAmt = getOrderRemainingDebt(o);
      if (remainingAmt <= 0.009) continue;

      const grossAmt = getOrderItemsSubtotal(o);
      const paidAmt = Math.max(0, grossAmt - remainingAmt);

      const firstListing = o.items
        .map((li) => listings.find((l) => l.id === li.itemId))
        .find((l) => Boolean(l));
      const sellerId = o.sellerId || firstListing?.sellerId || '';
      if (!sellerId) continue;
      const sellerName = o.sellerName || firstListing?.sellerName || 'Community Seller';
      const listingHint =
        listings.find((l) => l.sellerId === sellerId && l.paymentDetails?.trim())
          ?.paymentDetails ?? '';

      const existing = map.get(sellerId);
      if (existing) {
        existing.totalOwed += remainingAmt;
        existing.grossDebt += grossAmt;
        existing.paidSoFar += paidAmt;
        existing.orderIds.push(o.id);
        for (const li of o.items) {
          const cleanName = li.name.replace(' (Coworker Sale)', '').trim();
          existing.itemCounts[cleanName] = (existing.itemCounts[cleanName] ?? 0) + li.quantity;
        }
      } else {
        const itemCounts: Record<string, number> = {};
        for (const li of o.items) {
          const cleanName = li.name.replace(' (Coworker Sale)', '').trim();
          itemCounts[cleanName] = (itemCounts[cleanName] ?? 0) + li.quantity;
        }
        map.set(sellerId, {
          sellerId,
          sellerName,
          totalOwed: remainingAmt,
          grossDebt: grossAmt,
          paidSoFar: paidAmt,
          orderIds: [o.id],
          itemCounts,
          dueLabel: o.dueDateLabel || nextDueLabel,
          listingPaymentHint: listingHint,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalOwed - a.totalOwed);
  }, [userOrders, listings, nextDueLabel]);

  const totalCommunitySellerDebt = useMemo(
    () => sellerDebtGroups.reduce((sum, g) => sum + g.totalOwed, 0),
    [sellerDebtGroups]
  );

  const userProofs = currentUser ? proofs.filter((p) => p.userId === currentUser.id) : [];
  const pendingSellerProofTotal = useMemo(
    () =>
      userProofs
        .filter(
          (p) => p.purpose === 'Community Seller Settlement' && p.status === 'pending'
        )
        .reduce((sum, p) => sum + p.amount, 0),
    [userProofs]
  );
  const userLoans = currentUser ? loans.filter((l) => l.userId === currentUser.id) : [];
  const userActiveLoanBal = userLoans
    .filter((l) => l.status === 'Active')
    .reduce((s, l) => s + l.remainingBalance, 0);

  const totalOwed =
    (currentUser?.debtBalance ?? 0) + totalCommunitySellerDebt + userActiveLoanBal;
  const pendingProofsForUser = userProofs.filter((p) => p.status === 'pending').length;

  const selectedDigitalMethod =
    digitalMethods.find((m) => m.id === payChannelId) ?? digitalMethods[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setPayError('Please upload a valid receipt photo or screenshot (PNG, JPG, or WebP).');
      return;
    }
    void compressImageFileToDataUrl(file)
      .then((compressed) => {
        if (!isValidUploadedReceipt(compressed)) {
          setPayError('Please upload a valid payment receipt image.');
          return;
        }
        setPayImage(compressed);
        setPayError('');
      })
      .catch(() => {
        setPayError('Could not process selected receipt image.');
      });
  };

  const handleSellerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setSellerPayError('Please upload a valid receipt photo or screenshot (PNG, JPG, or WebP).');
      return;
    }
    void compressImageFileToDataUrl(file)
      .then((compressed) => {
        if (!isValidUploadedReceipt(compressed)) {
          setSellerPayError('Please upload a valid payment receipt image.');
          return;
        }
        setSellerPayImage(compressed);
        setSellerPayError('');
      })
      .catch(() => {
        setSellerPayError('Could not process selected receipt image.');
      });
  };

  const handleProofSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(payAmount) || 0;
    if (amt <= 0 || !payRef.trim() || !selectedDigitalMethod) {
      setPayError('Enter a valid amount and reference number.');
      return;
    }
    if (!isValidUploadedReceipt(payImage)) {
      setPayError('Please upload a valid payment receipt image.');
      return;
    }
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
    setPayError('');
    setActiveTab('receipts');
    setBanner(
      `Store payment receipt sent! (${selectedDigitalMethod.title} · ${formatPHP(amt, true)}). Store Admin will verify and update your store debt balance.`
    );
    setTimeout(() => setBanner(''), 5500);
  };

  const openPayModalWithAmount = (amount: number) => {
    setPayAmount(String(Math.max(0, amount)));
    setPayError('');
    setShowPayModal(true);
  };

  const openPaySellerModal = (group: SellerDebtGroup) => {
    setPayingSellerGroup(group);
    setSellerPayAmount(String(Math.max(0, group.totalOwed)));
    setSellerPayChannel('GCash');
    setSellerPayRef('');
    setSellerPayImage('');
    setSellerPayError('');
    setSellerPayConfig(null);
    if (onFetchSellerConfig) {
      setLoadingSellerCfg(true);
      void onFetchSellerConfig(group.sellerId)
        .then((cfg) => setSellerPayConfig(cfg))
        .finally(() => setLoadingSellerCfg(false));
    }
  };

  const handleSellerProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSellerGroup) return;
    const amt = Number(sellerPayAmount) || 0;
    if (amt <= 0 || !sellerPayRef.trim() || !isValidUploadedReceipt(sellerPayImage)) {
      setSellerPayError('Enter payment amount, reference number, and upload a valid receipt image.');
      return;
    }

    setSubmittingSellerProof(true);
    setSellerPayError('');
    try {
      await onSubmitSellerDebtProof({
        sellerId: payingSellerGroup.sellerId,
        sellerName: payingSellerGroup.sellerName,
        amount: amt,
        channel: sellerPayChannel,
        referenceNo: sellerPayRef.trim(),
        imageDataUrl: sellerPayImage,
        orderIds: payingSellerGroup.orderIds,
      });
      const paidName = payingSellerGroup.sellerName;
      setPayingSellerGroup(null);
      setSellerPayAmount('');
      setSellerPayRef('');
      setSellerPayImage('');
      setActiveTab('receipts');
      setBanner(
        `Receipt sent to ${paidName} (${sellerPayChannel} · ${formatPHP(amt, true)}). They can verify and settle your balance on their Seller Dashboard.`
      );
      setTimeout(() => setBanner(''), 6000);
    } catch (err) {
      setSellerPayError(
        err instanceof Error ? err.message : 'Could not submit seller payment proof.'
      );
    } finally {
      setSubmittingSellerProof(false);
    }
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
          onClick={() =>
            currentUser.debtBalance === 0 && sellerDebtGroups.length > 0
              ? openPaySellerModal(sellerDebtGroups[0])
              : openPayModalWithAmount(currentUser.debtBalance)
          }
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors shrink-0 cursor-pointer"
        >
          <CreditCard className="w-4 h-4" />
          <span>
            {currentUser.debtBalance === 0 && sellerDebtGroups.length > 0
              ? 'Pay Community Seller'
              : 'Pay Store Debt'}
          </span>
        </button>
      </div>

      {banner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {pendingSellerConfirmCount > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/35 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
          You have <strong>{pendingSellerConfirmCount}</strong> community order
          {pendingSellerConfirmCount === 1 ? '' : 's'} waiting for Seller Confirmation. Unconfirmed orders do not add to your debt ledger until the seller confirms them.
        </div>
      )}

      {/* Separated Summary Strip: Store Debt vs Community Seller Debt vs Loan */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          currentUser.pautanganEnabled || userActiveLoanBal > 0
            ? 'lg:grid-cols-5'
            : 'lg:grid-cols-4'
        } gap-3.5 sm:gap-4`}
      >
        {/* Card 1: Store Debt */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              1. Storefront Debt (Store)
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
                ? `Official pantry orders due ${nextDueLabel}.`
                : 'All paid! Nothing owed to the store.'}
            </p>
          </div>
          {currentUser.debtBalance > 0 && (
            <button
              type="button"
              onClick={() => openPayModalWithAmount(currentUser.debtBalance)}
              className="w-full min-h-[36px] rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold cursor-pointer"
            >
              Pay Store ({formatPHP(currentUser.debtBalance)})
            </button>
          )}
        </div>

        {/* Card 2: Community Seller Debt */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              2. Community Debt (Sellers)
            </div>
            <div
              className={`mt-1.5 text-2xl font-extrabold font-mono tabular-nums ${
                totalCommunitySellerDebt > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatPHP(totalCommunitySellerDebt, true)}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {sellerDebtGroups.length > 0
                ? `Across ${sellerDebtGroups.length} seller${sellerDebtGroups.length === 1 ? '' : 's'} — pay each seller below.`
                : 'All community sellers settled!'}
            </p>
            {pendingSellerProofTotal > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                {formatPHP(pendingSellerProofTotal, true)} awaiting seller approval
              </p>
            )}
          </div>
        </div>

        {/* Card 3: Cash Loan (only shown when Pautangan is enabled for user or user has an active loan) */}
        {(currentUser.pautanganEnabled || userActiveLoanBal > 0) && (
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              3. Cash Loan Left (Pautangan)
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

        {/* Card 4: Total Combined */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
          <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            Total Combined Owed
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
            {formatPHP(totalOwed, true)}
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Store + community sellers{userActiveLoanBal > 0 ? ' + loan' : ''}
          </p>
        </div>

        {/* Card 5: Activity */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
          <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            My Orders &amp; Receipts
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {userOrders.length} Orders
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {pendingProofsForUser > 0
              ? `${pendingProofsForUser} receipt awaiting verification`
              : `Store spent: ${formatPHP(currentUser.totalSpent)}`}
          </p>
        </div>
      </div>

      {/* Community Debt Breakdown by Seller */}
      {sellerDebtGroups.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-[#121D1B] overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-amber-50/60 dark:bg-amber-950/25 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Community Debt by Seller (Pay Separately)
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Community marketplace debts are separated from Store Debt. Pay each seller directly below so they can verify and settle your order.
              </p>
            </div>
            <span className="text-xs font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
              Total Sellers Owed: {formatPHP(totalCommunitySellerDebt, true)}
            </span>
          </div>

          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {sellerDebtGroups.map((group) => {
              const pendingToSeller = userProofs.filter(
                (p) =>
                  p.purpose === 'Community Seller Settlement' &&
                  p.sellerId === group.sellerId &&
                  p.status === 'pending'
              );
              const pendingToSellerAmt = pendingToSeller.reduce((s, p) => s + p.amount, 0);
              const itemsText = Object.entries(group.itemCounts)
                .map(([name, qty]) => `${qty}× ${name}`)
                .join(', ');

              return (
                <div
                  key={group.sellerId}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        Seller: {group.sellerName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                        {group.orderIds.length} unpaid order{group.orderIds.length === 1 ? '' : 's'}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        Due {group.dueLabel}
                      </span>
                      {group.paidSoFar > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                          Paid {formatPHP(group.paidSoFar)} / {formatPHP(group.grossDebt)}
                        </span>
                      )}
                      {pendingToSeller.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-[11px] font-semibold">
                          Awaiting seller approval: {formatPHP(pendingToSellerAmt, true)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">
                      Items: {itemsText}
                    </p>
                    <p className="text-[11px] text-stone-400 font-mono">
                      Orders: {group.orderIds.join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        Owed to {group.sellerName}
                      </div>
                      <div className="text-base font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        {formatPHP(group.totalOwed, true)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openPaySellerModal(group)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay {group.sellerName.split(' ')[0]}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Simple 3-Step How To Pay Store Debt Guide */}
      {currentUser.debtBalance > 0 && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/25 p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100">
              <Wallet className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>How to Pay Your Storefront Debt in 3 Easy Steps</span>
            </div>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              Due dates every {dueDays[0]}th &amp; {dueDays[1]}th
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-3">
              <div className="font-bold text-teal-700 dark:text-teal-400">Step 1: Send Money</div>
              <div className="mt-0.5 text-stone-600 dark:text-stone-300">
                Tap &ldquo;Pay Store Debt&rdquo;, pick GCash / Maya / MariBank, and copy the Store number or scan QR.
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
                Store Admin confirms your receipt and your Storefront Debt drops automatically!
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
              Admin View: All Coworker Store Balances
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
              Base ₱582 + marketplace shares (from coworker For-Sale items)
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Store Receipts Waiting Check
            </div>
            <div className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              {
                proofs.filter(
                  (p) => p.status === 'pending' && p.purpose !== 'Community Seller Settlement'
                ).length
              }{' '}
              Receipts
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
                <option value="Pending Seller Confirmation">Status: Waiting Seller Confirmation</option>
                <option value="Pending Admin Review">Status: Waiting Admin Confirmation</option>
                <option value="Pending Payment Proof">Status: Waiting Receipt Check</option>
                <option value="Confirmed">Status: Confirmed</option>
                <option value="Completed">Status: Done / Delivered</option>
                <option value="Rejected">Status: Rejected</option>
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
                const statusText =
                  ord.status === 'Pending Seller Confirmation'
                    ? 'Waiting Seller Confirmation'
                    : ord.deliveryStatus ?? ord.status;
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
                                : ord.status === 'Rejected'
                                  ? 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300'
                                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {statusText}
                          </span>
                          {ord.source === 'marketplace' && (
                            <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-[11px] font-semibold">
                              Community · Seller: {ord.sellerName ?? 'Coworker'}
                            </span>
                          )}
                          {ord.source === 'marketplace' &&
                            ord.paymentMethod === PaymentMethod.Debt &&
                            (ord.status === 'Confirmed' || ord.status === 'Completed') && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  ord.debtSettled
                                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                    : (ord.debtPaidAmount ?? 0) > 0
                                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300'
                                      : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                }`}
                              >
                                {ord.debtSettled
                                  ? 'Debt Settled'
                                  : (ord.debtPaidAmount ?? 0) > 0
                                    ? `Partial Paid (${formatPHP(ord.debtPaidAmount ?? 0)} / ${formatPHP(
                                        getOrderItemsSubtotal(ord)
                                      )})`
                                    : 'Unpaid Debt'}
                              </span>
                            )}
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
              onClick={() =>
                currentUser.debtBalance === 0 && sellerDebtGroups.length > 0
                  ? openPaySellerModal(sellerDebtGroups[0])
                  : openPayModalWithAmount(currentUser.debtBalance)
              }
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 self-start cursor-pointer"
            >
              {currentUser.debtBalance === 0 && sellerDebtGroups.length > 0
                ? '+ Pay Community Seller'
                : '+ Upload Store Receipt'}
            </button>
          </div>

          {userProofs.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-500 dark:text-stone-400">
              You have not uploaded any payment receipts yet.
            </div>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {userProofs.map((prf) => {
                const isSellerProof = prf.purpose === 'Community Seller Settlement';
                return (
                  <div
                    key={prf.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {prf.imageDataUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              src: prf.imageDataUrl,
                              title: `${prf.channel} Receipt — ${prf.purpose}`,
                              subtitle: `Ref: ${prf.referenceNo} · ${prf.submittedAt}`,
                            })
                          }
                          className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
                          title="Click to preview receipt image"
                          aria-label={`Preview receipt ${prf.referenceNo}`}
                        >
                          <img
                            src={prf.imageDataUrl}
                            alt={`Receipt ${prf.referenceNo}`}
                            className="w-14 h-14 object-cover"
                          />
                        </button>
                      ) : (
                        <div className="w-14 h-14 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] shrink-0 flex items-center justify-center text-[10px] font-semibold text-stone-400 text-center px-1">
                          Cleared
                        </div>
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                          {prf.channel} — {prf.purpose}
                          {isSellerProof && prf.sellerName ? ` (${prf.sellerName})` : ''}
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
                            ? 'Approved & Settled!'
                            : prf.status === 'rejected'
                              ? 'Not Accepted — Please upload a clearer photo'
                              : isSellerProof
                                ? `Waiting for ${prf.sellerName || 'Seller'} to Verify`
                                : 'Waiting for Store Admin to Check'}
                        </div>
                      </div>
                    </div>
                    <div className="text-lg font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums sm:text-right shrink-0">
                      {formatPHP(prf.amount, true)}
                    </div>
                  </div>
                );
              })}
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
                <label className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1E2E2B] cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Upload Receipt Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              {payImage && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewImage({
                        src: payImage,
                        title: `${selectedDigitalMethod?.title ?? 'Store'} Payment Receipt`,
                        subtitle: payRef.trim() ? `Ref: ${payRef.trim()}` : 'Uploaded receipt preview',
                      })
                    }
                    className="rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 hover:opacity-90 transition-opacity cursor-pointer"
                    title="Click to preview receipt image"
                    aria-label="Preview uploaded payment receipt"
                  >
                    <img
                      src={payImage}
                      alt="Proof preview"
                      className="w-20 h-20 object-cover"
                    />
                  </button>
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    Click thumbnail to preview
                  </span>
                </div>
              )}
            </div>

            {payError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {payError}
              </p>
            )}

            <button
              type="submit"
              disabled={!payImage || !payRef.trim() || Number(payAmount) <= 0}
              className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 cursor-pointer"
            >
              Send Store Debt Receipt to Admin
            </button>
          </form>
        </div>
      )}

      {/* Pay Community Seller Modal */}
      {payingSellerGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <form
            onSubmit={(e) => void handleSellerProofSubmit(e)}
            className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 sm:p-6 shadow-xl space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Pay {payingSellerGroup.sellerName}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Community Seller Debt Settlement · Separate from Store Debt
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingSellerGroup(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5 space-y-1.5 text-xs">
              <div className="font-bold text-stone-800 dark:text-stone-100">
                Seller Payout Details
              </div>
              {loadingSellerCfg ? (
                <div className="text-stone-500 dark:text-stone-400">
                  Loading seller payment numbers...
                </div>
              ) : (
                <>
                  {sellerPayConfig?.gcashNumber && (
                    <div className="text-stone-700 dark:text-stone-200">
                      <strong>GCash:</strong>{' '}
                      <span className="font-mono">{sellerPayConfig.gcashNumber}</span>
                    </div>
                  )}
                  {sellerPayConfig?.mayaNumber && (
                    <div className="text-stone-700 dark:text-stone-200">
                      <strong>Maya:</strong>{' '}
                      <span className="font-mono">{sellerPayConfig.mayaNumber}</span>
                    </div>
                  )}
                  {sellerPayConfig?.paymentNotes && (
                    <div className="text-stone-600 dark:text-stone-300">
                      <strong>Notes:</strong> {sellerPayConfig.paymentNotes}
                    </div>
                  )}
                  {!sellerPayConfig?.gcashNumber &&
                    !sellerPayConfig?.mayaNumber &&
                    !sellerPayConfig?.paymentNotes && (
                      <div className="text-stone-600 dark:text-stone-300">
                        {payingSellerGroup.listingPaymentHint ||
                          `Send directly to ${payingSellerGroup.sellerName} (Cash / GCash / Maya) and upload your receipt below.`}
                      </div>
                    )}
                </>
              )}
              <div className="pt-1 text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                Orders covered: {payingSellerGroup.orderIds.join(', ')}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                1. Amount Paid to {payingSellerGroup.sellerName.split(' ')[0]} (₱)
              </label>
              <input
                type="number"
                min="1"
                required
                value={sellerPayAmount}
                onChange={(e) => setSellerPayAmount(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                2. Payment Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['GCash', 'Maya', 'Cash'].map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setSellerPayChannel(ch)}
                    className={`min-h-[40px] rounded-xl border px-2 text-xs font-semibold cursor-pointer ${
                      sellerPayChannel === ch
                        ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                3. Receipt Reference / Cash Note
              </label>
              <input
                type="text"
                required
                value={sellerPayRef}
                onChange={(e) => setSellerPayRef(e.target.value)}
                placeholder="e.g. GC-904821735 or Paid Cash at Pantry"
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                4. Upload Payment Screenshot / Proof
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1E2E2B] cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Upload Receipt Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/*"
                    onChange={handleSellerFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              {sellerPayImage && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewImage({
                        src: sellerPayImage,
                        title: `Payment Receipt for ${payingSellerGroup.sellerName}`,
                        subtitle: sellerPayRef.trim()
                          ? `${sellerPayChannel} · Ref: ${sellerPayRef.trim()}`
                          : sellerPayChannel,
                      })
                    }
                    className="rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 hover:opacity-90 transition-opacity cursor-pointer"
                    title="Click to preview receipt image"
                    aria-label="Preview uploaded seller payment receipt"
                  >
                    <img
                      src={sellerPayImage}
                      alt="Seller payment proof preview"
                      className="w-20 h-20 object-cover"
                    />
                  </button>
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    Click thumbnail to preview
                  </span>
                </div>
              )}
            </div>

            {sellerPayError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {sellerPayError}
              </p>
            )}

            <button
              type="submit"
              disabled={
                submittingSellerProof ||
                !sellerPayImage ||
                !sellerPayRef.trim() ||
                Number(sellerPayAmount) <= 0
              }
              className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 cursor-pointer"
            >
              {submittingSellerProof
                ? 'Sending to Seller...'
                : `Send Receipt to ${payingSellerGroup.sellerName.split(' ')[0]}`}
            </button>
          </form>
        </div>
      )}

      <ImagePreviewModal
        preview={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};
