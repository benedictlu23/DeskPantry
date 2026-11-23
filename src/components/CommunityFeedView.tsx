import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Info,
  MessageSquare,
  Plus,
  Send,
  ShoppingCart,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CommissionType,
  FulfillmentType,
  MarketplaceListing,
  PaymentMethod,
  SuggestionItem,
  UserAccount,
  UserRole,
} from '../types';
import { computeCommission, formatPHP } from '../utils/format';
import { compressImageFileToDataUrl } from '../utils/image';
import { ProductImage } from './ProductImage';

interface CommunityFeedViewProps {
  suggestions: SuggestionItem[];
  listings: MarketplaceListing[];
  categories: string[];
  unreadCommunityCount: number;
  lastFeedEvent: string;
  currentUser: UserAccount | null;
  currentRole: UserRole;
  onOpenSignIn: () => void;
  onClearCommunityUnread: () => void;
  onToggleVote: (suggestionId: string, direction?: 'up' | 'down') => void;
  onCreateSuggestion: (title: string, category: string, reason: string) => void;
  onCreateListing: (payload: {
    title: string;
    description: string;
    price: number;
    stock: number;
    commissionType: CommissionType;
    commissionValue: number;
    image?: string;
  }) => void;
  onBuyListing: (
    listingId: string,
    paymentMethod: PaymentMethod.Cash | PaymentMethod.Debt,
    fulfillment: FulfillmentType,
    quantity?: number,
    buyerLocation?: {
      buyerDepartment?: string;
      buyerTableRow?: string;
      buyerTableNumber?: string;
    }
  ) => void;
  onOpenSellerDashboard?: () => void;
  sellerCollectablesTotal?: number;
  totalRegisteredUsers?: number;
  openSellFormSignal?: number;
  onDeleteSuggestion?: (suggestionId: string) => Promise<void>;
  onAddSuggestionComment?: (suggestionId: string, text: string) => void;
  onUpdateSuggestionStatus?: (
    suggestionId: string,
    status: SuggestionItem['status']
  ) => void;
}

export const CommunityFeedView: React.FC<CommunityFeedViewProps> = ({
  suggestions,
  listings,
  categories,
  unreadCommunityCount,
  lastFeedEvent,
  currentUser,
  currentRole,
  onOpenSignIn,
  onClearCommunityUnread,
  onToggleVote,
  onCreateSuggestion,
  onCreateListing,
  onBuyListing,
  onOpenSellerDashboard,
  sellerCollectablesTotal = 0,
  totalRegisteredUsers = 0,
  openSellFormSignal = 0,
  onDeleteSuggestion,
  onAddSuggestionComment,
  onUpdateSuggestionStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'marketplace' | 'suggestions'>('marketplace');
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [showSellForm, setShowSellForm] = useState(false);
  const [buyModalListing, setBuyModalListing] = useState<MarketplaceListing | null>(null);
  const [buyPayment, setBuyPayment] = useState<PaymentMethod.Cash | PaymentMethod.Debt>(
    PaymentMethod.Cash
  );
  const [buyFulfillment, setBuyFulfillment] = useState<FulfillmentType>(FulfillmentType.Pickup);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [buyerDepartment, setBuyerDepartment] = useState('');
  const [buyerTableRow, setBuyerTableRow] = useState('');
  const [buyerTableNumber, setBuyerTableNumber] = useState('');
  const [buyError, setBuyError] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState('');
  const [sugError, setSugError] = useState('');
  const [confirmDeleteSugId, setConfirmDeleteSugId] = useState<string | null>(null);
  const [deletingSugId, setDeletingSugId] = useState<string | null>(null);
  const [expandedCommentsSugIds, setExpandedCommentsSugIds] = useState<Record<string, boolean>>({});
  const [sugCommentDrafts, setSugCommentDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const cleanDept =
      currentUser?.department &&
      currentUser.department !== 'Department Staff' &&
      currentUser.department !== 'Unassigned'
        ? currentUser.department
        : '';
    setBuyerDepartment(cleanDept);
    setBuyerTableRow(currentUser?.tableRow || '');
    setBuyerTableNumber(currentUser?.tableNumber || '');
  }, [
    currentUser?.id,
    currentUser?.department,
    currentUser?.tableRow,
    currentUser?.tableNumber,
    buyModalListing?.id,
  ]);

  useEffect(() => {
    if (openSellFormSignal > 0) {
      setActiveTab('marketplace');
      setShowSellForm(true);
    }
  }, [openSellFormSignal]);

  // Suggestion form state
  const [sugTitle, setSugTitle] = useState('');
  const [sugCategory, setSugCategory] = useState(categories[0] ?? 'Coffee & Drinks');
  const [sugReason, setSugReason] = useState('');

  // Listing form state
  const [sellTitle, setSellTitle] = useState('');
  const [sellDesc, setSellDesc] = useState('');
  const [sellPrice, setSellPrice] = useState('150');
  const [sellStock, setSellStock] = useState('5');
  const [sellCommType, setSellCommType] = useState<CommissionType>(CommissionType.Percentage);
  const [sellCommValue, setSellCommValue] = useState('10');
  const [sellImage, setSellImage] = useState('');

  const isGuest = currentRole === UserRole.Guest || !currentUser;
  const isAdminOrSuper =
    currentRole === UserRole.Admin || currentRole === UserRole.SuperAdmin;
  const approvedListings = listings.filter(
    (l) =>
      l.approvalStatus === 'approved' &&
      (!l.paused || (currentUser && l.sellerId === currentUser.id))
  );
  const myListingsCount = currentUser
    ? listings.filter((l) => l.sellerId === currentUser.id).length
    : 0;
  const myPendingListings = currentUser
    ? listings.filter((l) => l.sellerId === currentUser.id && l.approvalStatus === 'pending')
    : [];

  const previewCommission = computeCommission(
    Number(sellPrice) || 0,
    sellCommType,
    Number(sellCommValue) || 0
  );

  const handleSuggestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      onOpenSignIn();
      return;
    }
    if (!sugTitle.trim()) return;
    onCreateSuggestion(
      sugTitle.trim(),
      sugCategory || categories[0] || 'Coffee & Drinks',
      sugReason.trim() || 'Requested by coworker.'
    );
    setSugTitle('');
    setSugReason('');
    setShowSuggestForm(false);
    setFeedbackBanner('Suggestion posted to the public vote board.');
    setTimeout(() => setFeedbackBanner(''), 4000);
  };

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      onOpenSignIn();
      return;
    }
    const parsedPrice = Number(sellPrice);
    const parsedStock = Number(sellStock);
    const parsedComm = Number(sellCommValue);
    if (!sellTitle.trim() || parsedPrice <= 0 || parsedStock <= 0) return;

    onCreateListing({
      title: sellTitle.trim(),
      description: sellDesc.trim() || 'Homemade coworker item available at the office.',
      price: parsedPrice,
      stock: parsedStock,
      commissionType: sellCommType,
      commissionValue: Math.max(0, parsedComm),
      image: sellImage || undefined,
    });

    setSellTitle('');
    setSellDesc('');
    setSellImage('');
    setShowSellForm(false);
    setFeedbackBanner(
      'Listing submitted! It will appear on the Public For-Sale Feed once approved by an Admin.'
    );
    setTimeout(() => setFeedbackBanner(''), 5500);
  };

  const openBuyModal = (listing: MarketplaceListing) => {
    const canCash = listing.allowCash ?? true;
    const canDebt = listing.allowDebt ?? true;
    setBuyPayment(canCash ? PaymentMethod.Cash : canDebt ? PaymentMethod.Debt : PaymentMethod.Cash);
    setBuyFulfillment(FulfillmentType.Pickup);
    setBuyQuantity(1);
    setBuyError('');
    setBuyModalListing(listing);
  };

  const handleConfirmPurchase = () => {
    if (!buyModalListing) return;
    if (isGuest) {
      setBuyModalListing(null);
      onOpenSignIn();
      return;
    }
    const canCash = buyModalListing.allowCash ?? true;
    const canDebt = buyModalListing.allowDebt ?? true;
    if (buyPayment === PaymentMethod.Cash && !canCash) return;
    if (buyPayment === PaymentMethod.Debt && !canDebt) return;

    const cleanDept = buyerDepartment.trim();
    const cleanRow = buyerTableRow.trim();
    const cleanTable = buyerTableNumber.trim();
    if (!cleanDept || !cleanRow || !cleanTable) {
      setBuyError('Please enter your Department Name, Table Row, and Table Number.');
      return;
    }

    const safeQty = Math.max(1, Math.min(buyModalListing.stock, Math.round(buyQuantity || 1)));
    onBuyListing(buyModalListing.id, buyPayment, buyFulfillment, safeQty, {
      buyerDepartment: cleanDept,
      buyerTableRow: cleanRow,
      buyerTableNumber: cleanTable,
    });
    setFeedbackBanner(
      `Order submitted for ${safeQty}× "${buyModalListing.title}" via ${
        buyPayment === PaymentMethod.Debt ? 'Debt' : 'Cash'
      } (${buyFulfillment}). Waiting for ${buyModalListing.sellerName} to confirm before stock updates or your ledger debt is recorded.`
    );
    setBuyModalListing(null);
    setTimeout(() => setFeedbackBanner(''), 6000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Community Hub &amp; Marketplace
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Buy coworker-made food &amp; items (like <em>manok</em> and <em>suman</em>), post your own with store commission, or upvote pantry requests.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('marketplace')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'marketplace'
                ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Public For-Sale Feed ({approvedListings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('suggestions')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'suggestions'
                ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Suggestions Feed ({suggestions.length})
          </button>
        </div>
      </div>

      {/* Real-Time Community Feed Notification Indicator */}
      <div className="rounded-xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/60 dark:bg-teal-950/35 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200">
          <Bell className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
          <span className="font-semibold">
            {unreadCommunityCount > 0
              ? `Live Community Updates (${unreadCommunityCount} new):`
              : 'Community Feed Live:'}
          </span>
          <span className="text-teal-800 dark:text-teal-300">{lastFeedEvent}</span>
        </div>
        {unreadCommunityCount > 0 && (
          <button
            type="button"
            onClick={onClearCommunityUnread}
            className="text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
          >
            Mark feed caught up
          </button>
        )}
      </div>

      {feedbackBanner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {activeTab === 'marketplace' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Coworker For-Sale Board
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Every seller sets a percentage or fixed commission per sale for the store owner. Posts appear after Admin approval.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isGuest && onOpenSellerDashboard && (
                <button
                  type="button"
                  onClick={onOpenSellerDashboard}
                  className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 px-4 py-2 text-xs font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-950/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>
                    Seller Dashboard
                    {myListingsCount > 0 ? ` (${myListingsCount})` : ''}
                    {sellerCollectablesTotal > 0
                      ? ` · ${formatPHP(sellerCollectablesTotal)}`
                      : ''}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => (isGuest ? onOpenSignIn() : setShowSellForm((prev) => !prev))}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{showSellForm ? 'Close Form' : 'Post Item for Sale'}</span>
              </button>
            </div>
          </div>

          {showSellForm && (
            <form
              onSubmit={handleSellSubmit}
              className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-white dark:bg-[#121D1B] p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Submit Coworker Listing (Requires Admin Approval)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Item Title
                  </label>
                  <input
                    type="text"
                    required
                    value={sellTitle}
                    onChange={(e) => setSellTitle(e.target.value)}
                    placeholder="e.g. Homemade Suman sa Lihiya or Roasted Manok"
                    className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Selling Price (₱)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Available Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={sellStock}
                      onChange={(e) => setSellStock(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Description &amp; Pickup Schedule
                </label>
                <input
                  type="text"
                  value={sellDesc}
                  onChange={(e) => setSellDesc(e.target.value)}
                  placeholder="Fresh batch arriving 12:30 PM at 4F pantry."
                  className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>{sellImage ? 'Change Item Image' : 'Upload Item Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      void compressImageFileToDataUrl(f).then((compressed) => {
                        setSellImage(compressed);
                      });
                    }}
                    className="hidden"
                  />
                </label>
                {sellImage && (
                  <img
                    src={sellImage}
                    alt="Listing preview"
                    className="w-12 h-12 rounded-lg object-cover border border-stone-200 dark:border-stone-700"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-stone-100 dark:border-stone-800">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Owner Commission Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSellCommType(CommissionType.Percentage)}
                      className={`min-h-[40px] rounded-lg border text-xs font-semibold cursor-pointer ${
                        sellCommType === CommissionType.Percentage
                          ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellCommType(CommissionType.Fixed)}
                      className={`min-h-[40px] rounded-lg border text-xs font-semibold cursor-pointer ${
                        sellCommType === CommissionType.Fixed
                          ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      Fixed Rate (₱)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Commission Rate ({sellCommType === CommissionType.Percentage ? '%' : '₱'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={sellCommType === CommissionType.Percentage ? 100 : undefined}
                    value={sellCommValue}
                    onChange={(e) => setSellCommValue(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <div className="rounded-xl bg-stone-50 dark:bg-[#172523] border border-stone-200 dark:border-stone-800 p-3 flex flex-col justify-center">
                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    Per-Sale Breakdown
                  </div>
                  <div className="mt-1 text-xs font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                    Store Owner: {formatPHP(previewCommission.ownerShare)} · You Keep:{' '}
                    {formatPHP(previewCommission.sellerNet)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSellForm(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#172523] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                >
                  Submit for Admin Approval
                </button>
              </div>
            </form>
          )}

          {myPendingListings.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/35 p-4 space-y-2">
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Your Listings Pending Admin Approval ({myPendingListings.length})
              </div>
              {myPendingListings.map((p) => (
                <div
                  key={p.id}
                  className="text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between"
                >
                  <span>
                    {p.title} · {formatPHP(p.price)} ({p.stock} qty)
                  </span>
                  <span className="font-semibold">Awaiting Approval</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {approvedListings.map((listing) => {
              const { ownerShare } = computeCommission(
                listing.price,
                listing.commissionType,
                listing.commissionValue
              );
              return (
                <article
                  key={listing.id}
                  className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/3] bg-stone-100 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
                      <ProductImage
                        src={listing.image}
                        alt={listing.title}
                        title={listing.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <span>
                          {listing.sellerName} · {listing.sellerDepartment}
                        </span>
                        {listing.paused && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
                            Paused
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 text-base font-bold text-stone-900 dark:text-stone-100">
                        {listing.title}
                      </h3>
                      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 line-clamp-2">
                        {listing.description}
                      </p>
                      {listing.pickupNote && (
                        <p className="mt-1.5 text-xs text-teal-700 dark:text-teal-400 font-medium">
                          Pickup: {listing.pickupNote}
                        </p>
                      )}
                      <div className="mt-3 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                        {listing.stock > 0 ? `${listing.stock} left` : 'Sold out'} ·{' '}
                        {listing.soldCount} sold · Store share:{' '}
                        {listing.commissionType === CommissionType.Percentage
                          ? `${listing.commissionValue}% (${formatPHP(ownerShare)})`
                          : `${formatPHP(listing.commissionValue)} fixed`}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-3">
                    <span className="text-lg font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                      {formatPHP(listing.price)}
                    </span>
                    <button
                      type="button"
                      disabled={listing.stock <= 0 || Boolean(listing.paused)}
                      onClick={() =>
                        isGuest ? onOpenSignIn() : openBuyModal(listing)
                      }
                      className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 transition-colors cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>
                        {listing.paused
                          ? 'Paused'
                          : listing.stock <= 0
                            ? 'Sold Out'
                            : isGuest
                              ? 'Sign in to Buy'
                              : `Buy (${[
                                  (listing.allowCash ?? true) ? 'Cash' : null,
                                  (listing.allowDebt ?? true) ? 'Debt' : null,
                                ]
                                  .filter(Boolean)
                                  .join(' / ') || 'Order'})`}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Store Item Suggestions &amp; Public Voting
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Request snacks, coffee, or desk supplies and upvote coworker suggestions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (isGuest ? onOpenSignIn() : setShowSuggestForm((prev) => !prev))}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{showSuggestForm ? 'Close' : 'Request New Item'}</span>
            </button>
          </div>

          {showSuggestForm && (
            <form
              onSubmit={handleSuggestSubmit}
              className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-white dark:bg-[#121D1B] p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Suggest a Pantry Item
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    value={sugTitle}
                    onChange={(e) => setSugTitle(e.target.value)}
                    placeholder="e.g. Chilled Almond Milk or Cup Noodles"
                    className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Category
                  </label>
                  <select
                    value={sugCategory}
                    onChange={(e) => setSugCategory(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Why should we stock this?
                </label>
                <input
                  type="text"
                  value={sugReason}
                  onChange={(e) => setSugReason(e.target.value)}
                  placeholder="Short note for teammates and pantry admin"
                  className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSuggestForm(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                >
                  Post Suggestion
                </button>
              </div>
            </form>
          )}

          {sugError && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
              <span>{sugError}</span>
              <button
                type="button"
                onClick={() => setSugError('')}
                className="text-red-700 dark:text-red-300 font-semibold hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="divide-y divide-stone-200 dark:divide-stone-800 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            {suggestions.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-500 dark:text-stone-400">
                No pantry suggestions yet. Be the first to request an item!
              </div>
            ) : (
              [...suggestions]
                .sort((a, b) => {
                  const aNet = a.voterIds.length - (a.downvoterIds?.length ?? 0);
                  const bNet = b.voterIds.length - (b.downvoterIds?.length ?? 0);
                  if (bNet !== aNet) return bNet - aNet;
                  return b.voterIds.length - a.voterIds.length;
                })
                .map((sug) => {
                  const hasUpvoted = currentUser ? sug.voterIds.includes(currentUser.id) : false;
                  const downvoterIds = sug.downvoterIds ?? [];
                  const downvoterNames = sug.downvoterNames ?? [];
                  const hasDownvoted = currentUser ? downvoterIds.includes(currentUser.id) : false;
                  const totalUsersCount = Math.max(
                    totalRegisteredUsers,
                    sug.voterIds.length + downvoterIds.length
                  );
                  const canRemove = Boolean(
                    !isGuest &&
                      currentUser &&
                      (sug.requestedById === currentUser.id || isAdminOrSuper)
                  );
                  const comments = sug.comments ?? [];
                  const commentsExpanded = Boolean(expandedCommentsSugIds[sug.id]);
                  const draft = sugCommentDrafts[sug.id] ?? '';

                  return (
                    <div key={sug.id} className="p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                            <span>
                              {sug.category} · Requested by {sug.requestedByName} · {sug.createdAt}
                            </span>
                            {sug.status === 'Added to Pantry' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>
                                  Added to Pantry
                                  {sug.addedToStoreAt ? ` · ${sug.addedToStoreAt}` : ''}
                                </span>
                              </span>
                            ) : sug.status === 'Reviewing' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>Reviewing</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-stone-100 dark:bg-[#172523] border border-stone-200 dark:border-stone-700 px-2 py-0.5 text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                                Open for Votes
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                            {sug.title}
                          </h3>
                          <p className="text-sm text-stone-600 dark:text-stone-400">{sug.reason}</p>
                          <div className="pt-2 mt-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs border-t border-stone-100 dark:border-stone-800/80">
                            <div>
                              <span className="font-semibold text-stone-700 dark:text-stone-300 tabular-nums">
                                Registered Users: {totalUsersCount}
                              </span>
                              <p className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                                Total Voted: {sug.voterIds.length + downvoterIds.length} / {totalUsersCount}
                              </p>
                            </div>
                            <div>
                              <span className="font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                                Upvoted ({sug.voterIds.length}):
                              </span>
                              <p className="text-stone-600 dark:text-stone-400 break-words">
                                {sug.voterNames.length > 0 ? sug.voterNames.join(', ') : 'None yet'}
                              </p>
                            </div>
                            <div>
                              <span className="font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                                Downvoted ({downvoterIds.length}):
                              </span>
                              <p className="text-stone-600 dark:text-stone-400 break-words">
                                {downvoterNames.length > 0 ? downvoterNames.join(', ') : 'None yet'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isAdminOrSuper && onUpdateSuggestionStatus && (
                            <select
                              aria-label={`Status for ${sug.title}`}
                              value={sug.status}
                              onChange={(e) =>
                                onUpdateSuggestionStatus(
                                  sug.id,
                                  e.target.value as SuggestionItem['status']
                                )
                              }
                              className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 focus:border-teal-700 focus:outline-none cursor-pointer"
                            >
                              <option value="Open for Votes">Open for Votes</option>
                              <option value="Reviewing">Reviewing</option>
                              <option value="Added to Pantry">Added to Pantry</option>
                            </select>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCommentsSugIds((prev) => ({
                                ...prev,
                                [sug.id]: !prev[sug.id],
                              }))
                            }
                            className="min-h-[40px] px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#1F312E] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="tabular-nums">Comments ({comments.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => (isGuest ? onOpenSignIn() : onToggleVote(sug.id, 'up'))}
                            className={`min-h-[40px] px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                              hasUpvoted
                                ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                                : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#1F312E]'
                            }`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span className="tabular-nums">
                              {hasUpvoted ? 'Upvoted' : 'Upvote'} ({sug.voterIds.length})
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => (isGuest ? onOpenSignIn() : onToggleVote(sug.id, 'down'))}
                            className={`min-h-[40px] px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                              hasDownvoted
                                ? 'border-rose-700 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200'
                                : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#1F312E]'
                            }`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            <span className="tabular-nums">
                              {hasDownvoted ? 'Downvoted' : 'Downvote'} ({downvoterIds.length})
                            </span>
                          </button>

                          {canRemove && onDeleteSuggestion && (
                            <button
                              type="button"
                              onClick={() => {
                                setSugError('');
                                setConfirmDeleteSugId((prev) => (prev === sug.id ? null : sug.id));
                              }}
                              aria-label={`Remove suggestion ${sug.title}`}
                              title="Remove post"
                              className="min-h-[40px] px-2.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {confirmDeleteSugId === sug.id && onDeleteSuggestion && (
                        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-red-900 dark:text-red-200">
                            Remove this suggestion post from the feed?
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSugId(null)}
                              className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={deletingSugId === sug.id}
                              onClick={() => {
                                setDeletingSugId(sug.id);
                                setSugError('');
                                void onDeleteSuggestion(sug.id)
                                  .then(() => {
                                    setConfirmDeleteSugId(null);
                                  })
                                  .catch((err) => {
                                    setSugError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Failed to remove suggestion post.'
                                    );
                                  })
                                  .finally(() => setDeletingSugId(null));
                              }}
                              className="px-3 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                            >
                              {deletingSugId === sug.id ? 'Removing...' : 'Confirm Remove'}
                            </button>
                          </div>
                        </div>
                      )}

                      {commentsExpanded && (
                        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#0F1917] p-3.5 space-y-3">
                          {comments.length === 0 ? (
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                              No comments yet. Share feedback or flavor preferences below.
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                              {comments.map((c) => (
                                <div
                                  key={c.id}
                                  className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] px-3 py-2 text-xs space-y-0.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-stone-900 dark:text-stone-100">
                                      {c.userName}
                                      {c.userDepartment ? ` · ${c.userDepartment}` : ''}
                                    </span>
                                    <span className="text-[11px] text-stone-400">{c.createdAt}</span>
                                  </div>
                                  <p className="text-stone-700 dark:text-stone-300">{c.text}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {onAddSuggestionComment && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (isGuest) {
                                  onOpenSignIn();
                                  return;
                                }
                                const clean = draft.trim();
                                if (!clean) return;
                                onAddSuggestionComment(sug.id, clean);
                                setSugCommentDrafts((prev) => ({ ...prev, [sug.id]: '' }));
                              }}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="text"
                                value={draft}
                                onChange={(e) =>
                                  setSugCommentDrafts((prev) => ({
                                    ...prev,
                                    [sug.id]: e.target.value,
                                  }))
                                }
                                placeholder={
                                  isGuest
                                    ? 'Sign in to add a comment...'
                                    : 'Add a comment on this suggestion...'
                                }
                                className="flex-1 min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                              />
                              <button
                                type="submit"
                                disabled={!isGuest && !draft.trim()}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{isGuest ? 'Sign in' : 'Post'}</span>
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Marketplace Buy Modal */}
      {buyModalListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {buyModalListing.title}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Sold by {buyModalListing.sellerName} · {formatPHP(buyModalListing.price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBuyModalListing(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(buyModalListing.pickupNote || buyModalListing.paymentDetails) && (
              <div className="rounded-xl bg-stone-50 dark:bg-[#172523] border border-stone-200 dark:border-stone-800 p-3 space-y-1 text-xs text-stone-600 dark:text-stone-300">
                {buyModalListing.pickupNote && (
                  <div>
                    <strong className="text-stone-800 dark:text-stone-100">Pickup: </strong>
                    {buyModalListing.pickupNote}
                  </div>
                )}
                {buyModalListing.paymentDetails && (
                  <div>
                    <strong className="text-stone-800 dark:text-stone-100">Seller Payment Info: </strong>
                    {buyModalListing.paymentDetails}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                Quantity ({buyModalListing.stock} available)
              </label>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-1.5">
                <button
                  type="button"
                  disabled={buyQuantity <= 1}
                  onClick={() => setBuyQuantity((q) => Math.max(1, q - 1))}
                  className="min-h-[34px] min-w-[34px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] text-sm font-bold text-stone-700 dark:text-stone-200 disabled:opacity-40 cursor-pointer"
                >
                  −
                </button>
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="number"
                    min={1}
                    max={buyModalListing.stock}
                    aria-label="Purchase quantity"
                    value={buyQuantity}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (Number.isNaN(raw)) return;
                      setBuyQuantity(
                        Math.max(1, Math.min(buyModalListing.stock, Math.round(raw)))
                      );
                    }}
                    className="w-16 min-h-[34px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2 text-center font-mono text-sm font-bold tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                  <span className="font-mono text-xs sm:text-sm font-bold tabular-nums text-stone-700 dark:text-stone-200 whitespace-nowrap">
                    {formatPHP(buyModalListing.price)} × {buyQuantity} ={' '}
                    {formatPHP(buyModalListing.price * buyQuantity)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={buyQuantity >= buyModalListing.stock}
                  onClick={() => setBuyQuantity((q) => Math.min(buyModalListing.stock, q + 1))}
                  className="min-h-[34px] min-w-[34px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] text-sm font-bold text-stone-700 dark:text-stone-200 disabled:opacity-40 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                Pickup or Seller Desk Delivery
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[FulfillmentType.Pickup, FulfillmentType.Delivery].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setBuyFulfillment(f)}
                    className={`min-h-[40px] rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                      buyFulfillment === f
                        ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {f === FulfillmentType.Delivery ? 'Delivery (By Seller)' : 'Pick Up'}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                Community sellers deliver their own items independently (not via Store runners).
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-200">
                  Purchaser Department &amp; Desk
                </span>
                <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                  Auto-filled
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  maxLength={120}
                  value={buyerDepartment}
                  onChange={(e) => setBuyerDepartment(e.target.value)}
                  placeholder="Department Name"
                  aria-label="Purchaser Department Name"
                  className="col-span-3 min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
                <input
                  type="text"
                  maxLength={40}
                  value={buyerTableRow}
                  onChange={(e) => setBuyerTableRow(e.target.value)}
                  placeholder="Table Row"
                  aria-label="Table Row"
                  className="col-span-1 min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
                <input
                  type="text"
                  maxLength={40}
                  value={buyerTableNumber}
                  onChange={(e) => setBuyerTableNumber(e.target.value)}
                  placeholder="Table Number"
                  aria-label="Table Number"
                  className="col-span-2 min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([PaymentMethod.Cash, PaymentMethod.Debt] as const).map((pm) => {
                  const enabled =
                    pm === PaymentMethod.Cash
                      ? buyModalListing.allowCash ?? true
                      : buyModalListing.allowDebt ?? true;
                  return (
                    <button
                      key={pm}
                      type="button"
                      disabled={!enabled}
                      onClick={() => setBuyPayment(pm)}
                      className={`min-h-[40px] rounded-xl border text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        buyPayment === pm
                          ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {pm === PaymentMethod.Debt ? 'Store Credit (Debt)' : 'Cash'}
                      {!enabled ? ' (Off)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {buyError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {buyError}
              </p>
            )}

            <div className="rounded-xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/70 dark:bg-teal-950/35 px-3 py-2.5 flex items-start gap-2 text-xs text-teal-900 dark:text-teal-200">
              <Info className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
              <span>
                <strong>Seller Confirmation Required:</strong> Placing an order keeps it pending until{' '}
                {buyModalListing.sellerName} confirms—stock only deducts and Buyer Ledger debt only appears after seller approval.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBuyModalListing(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchase}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                Confirm Purchase · {formatPHP(buyModalListing.price * buyQuantity)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
