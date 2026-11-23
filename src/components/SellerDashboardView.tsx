import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Coins,
  Download,
  Edit3,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  ReceiptText,
  Search,
  Send,
  Settings,
  ShoppingBag,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  CommissionType,
  MarketplaceListing,
  PaymentMethod,
  PaymentProof,
  SellerConfig,
  StoreOrder,
  UserAccount,
  UserRole,
} from '../types';
import {
  computeCommission,
  formatBuyerWorkstation,
  formatPHP,
  getOrderItemsSubtotal,
  getOrderRemainingDebt,
  isDateWithinPeriod,
  isOrderPendingSellerConfirmation,
} from '../utils/format';
import { ImagePreviewModal, ImagePreviewTarget } from './ImagePreviewModal';
import { ProductImage } from './ProductImage';

interface SellerDashboardViewProps {
  currentUser: UserAccount | null;
  currentRole: UserRole;
  listings: MarketplaceListing[];
  orders: StoreOrder[];
  proofs: PaymentProof[];
  sellerConfig: SellerConfig | null;
  nextDueLabel: string;
  onOpenSignIn: () => void;
  onGoToCommunity: (openSellForm?: boolean) => void;
  onConfirmOrder: (orderId: string) => Promise<void>;
  onRejectOrder: (orderId: string) => Promise<void>;
  onMarkOrderDelivered?: (orderId: string) => Promise<void>;
  onReviewSellerProof: (proofId: string, decision: 'approved' | 'rejected') => Promise<void>;
  onSendDebtReminder: (payload: {
    buyerId: string;
    buyerName: string;
    orderIds: string[];
    amount: number;
    itemSummary: string;
    dueLabel: string;
    customMessage?: string;
  }) => Promise<void>;
  onMarkOrderDebtSettled: (orderId: string, settled: boolean) => Promise<void>;
  onUpdateListingConfig: (
    listingId: string,
    patch: Partial<
      Pick<
        MarketplaceListing,
        | 'title'
        | 'description'
        | 'price'
        | 'stock'
        | 'paused'
        | 'allowCash'
        | 'allowDebt'
        | 'pickupNote'
        | 'paymentDetails'
      >
    >
  ) => Promise<void>;
  onDeleteListing?: (listingId: string) => Promise<void>;
  onSaveSellerConfig: (config: SellerConfig) => Promise<void>;
}

const DEFAULT_REMINDER_TEMPLATE =
  'Hi {buyer}, friendly reminder to settle {amount} for {item} (due {due}). Pay via Cash or {payment}.';

export const SellerDashboardView: React.FC<SellerDashboardViewProps> = ({
  currentUser,
  currentRole,
  listings,
  orders,
  proofs,
  sellerConfig,
  nextDueLabel,
  onOpenSignIn,
  onGoToCommunity,
  onConfirmOrder,
  onRejectOrder,
  onMarkOrderDelivered,
  onReviewSellerProof,
  onSendDebtReminder,
  onMarkOrderDebtSettled,
  onUpdateListingConfig,
  onDeleteListing,
  onSaveSellerConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'debtors' | 'listings' | 'config'>('debtors');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [listingFilter, setListingFilter] = useState<string>('all');
  const [debtFilter, setDebtFilter] = useState<
    'unpaid_debt' | 'settled_debt' | 'all_debt' | 'all_orders'
  >('unpaid_debt');

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [notifyingKey, setNotifyingKey] = useState<string | null>(null);
  const [notifiedKeys, setNotifiedKeys] = useState<Record<string, boolean>>({});
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [markingDeliveredOrderId, setMarkingDeliveredOrderId] = useState<string | null>(null);
  const [reviewingProofId, setReviewingProofId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<ImagePreviewTarget | null>(null);

  // Per-listing quick edit modal state
  const [editingListing, setEditingListing] = useState<MarketplaceListing | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editAllowCash, setEditAllowCash] = useState(true);
  const [editAllowDebt, setEditAllowDebt] = useState(true);
  const [editPaused, setEditPaused] = useState(false);
  const [editPickupNote, setEditPickupNote] = useState('');
  const [editPaymentDetails, setEditPaymentDetails] = useState('');
  const [savingListingEdit, setSavingListingEdit] = useState(false);

  // Seller Configuration Form state
  const [gcashNumber, setGcashNumber] = useState(sellerConfig?.gcashNumber ?? '');
  const [mayaNumber, setMayaNumber] = useState(sellerConfig?.mayaNumber ?? '');
  const [paymentNotes, setPaymentNotes] = useState(sellerConfig?.paymentNotes ?? '');
  const [defaultPickupNote, setDefaultPickupNote] = useState(
    sellerConfig?.defaultPickupNote ?? ''
  );
  const [defaultReminderTemplate, setDefaultReminderTemplate] = useState(
    sellerConfig?.defaultReminderTemplate ?? DEFAULT_REMINDER_TEMPLATE
  );
  const [defaultAllowCash, setDefaultAllowCash] = useState(
    sellerConfig?.defaultAllowCash ?? true
  );
  const [defaultAllowDebt, setDefaultAllowDebt] = useState(
    sellerConfig?.defaultAllowDebt ?? true
  );
  const [notifyOnNewSale, setNotifyOnNewSale] = useState(
    sellerConfig?.notifyOnNewSale ?? true
  );
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    setGcashNumber(sellerConfig?.gcashNumber ?? '');
    setMayaNumber(sellerConfig?.mayaNumber ?? '');
    setPaymentNotes(sellerConfig?.paymentNotes ?? '');
    setDefaultPickupNote(sellerConfig?.defaultPickupNote ?? '');
    setDefaultReminderTemplate(
      sellerConfig?.defaultReminderTemplate || DEFAULT_REMINDER_TEMPLATE
    );
    setDefaultAllowCash(sellerConfig?.defaultAllowCash ?? true);
    setDefaultAllowDebt(sellerConfig?.defaultAllowDebt ?? true);
    setNotifyOnNewSale(sellerConfig?.notifyOnNewSale ?? true);
  }, [sellerConfig]);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const isGuest = currentRole === UserRole.Guest || !currentUser;

  const myListings = useMemo(() => {
    if (!currentUser) return [];
    return listings.filter((l) => l.sellerId === currentUser.id);
  }, [listings, currentUser]);

  const myListingIds = useMemo(
    () => new Set(myListings.map((l) => l.id)),
    [myListings]
  );

  const pendingConfirmationOrders = useMemo(() => {
    if (!currentUser) return [];
    return orders
      .filter((o) => {
        if (o.source !== 'marketplace') return false;
        if (!isOrderPendingSellerConfirmation(o)) return false;
        if (o.sellerId && o.sellerId === currentUser.id) return true;
        return o.items.some((item) => myListingIds.has(item.itemId));
      })
      .sort((a, b) => (b.orderDateIso || '').localeCompare(a.orderDateIso || ''));
  }, [orders, currentUser, myListingIds]);

  const mySellerOrders = useMemo(() => {
    if (!currentUser) return [];
    return orders
      .filter((o) => {
        if (o.source !== 'marketplace') return false;
        if (isOrderPendingSellerConfirmation(o)) return false;
        if (o.status === 'Rejected' || o.deliveryStatus === 'Cancelled') return false;
        if (o.status !== 'Confirmed' && o.status !== 'Completed') return false;
        if (o.sellerId && o.sellerId === currentUser.id) return true;
        return o.items.some((item) => myListingIds.has(item.itemId));
      })
      .sort((a, b) => (b.orderDateIso || '').localeCompare(a.orderDateIso || ''));
  }, [orders, currentUser, myListingIds]);

  const sellerProofs = useMemo(() => {
    if (!currentUser) return [];
    return proofs
      .filter((p) => p.purpose === 'Community Seller Settlement' && p.sellerId === currentUser.id)
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return (b.submittedAt || '').localeCompare(a.submittedAt || '');
      });
  }, [proofs, currentUser]);

  const pendingSellerProofs = useMemo(
    () => sellerProofs.filter((p) => p.status === 'pending'),
    [sellerProofs]
  );

  const pendingSellerProofTotal = useMemo(
    () => pendingSellerProofs.reduce((sum, p) => sum + p.amount, 0),
    [pendingSellerProofs]
  );

  const getOrderItemAmount = (order: StoreOrder): number =>
    getOrderItemsSubtotal(order);

  const getOrderSellerNet = (order: StoreOrder): number => {
    const grossItems = getOrderItemAmount(order);
    return Math.max(0, grossItems - (order.commissionEarned ?? 0));
  };

  const isDebtOrder = (order: StoreOrder): boolean =>
    order.paymentMethod === PaymentMethod.Debt;

  const isUnpaidDebtOrder = (order: StoreOrder): boolean =>
    isDebtOrder(order) && !order.debtSettled && getOrderRemainingDebt(order) > 0.009;

  // Overall Seller Metrics
  const stats = useMemo(() => {
    let grossSales = 0;
    let totalCommission = 0;
    let netEarnings = 0;
    let totalCollectables = 0;
    let settledDebtTotal = 0;
    let cashCollectedTotal = 0;

    for (const o of mySellerOrders) {
      const itemSubtotal = getOrderItemAmount(o);
      const comm = o.commissionEarned ?? 0;
      const net = Math.max(0, itemSubtotal - comm);
      grossSales += itemSubtotal;
      totalCommission += comm;
      netEarnings += net;

      if (isDebtOrder(o)) {
        const remaining = getOrderRemainingDebt(o);
        const paid = Math.max(0, itemSubtotal - remaining);
        totalCollectables += remaining;
        settledDebtTotal += paid;
      } else {
        cashCollectedTotal += itemSubtotal;
      }
    }

    const unpaidDebtOrders = mySellerOrders.filter(isUnpaidDebtOrder);
    const uniqueDebtorsCount = new Set(unpaidDebtOrders.map((o) => o.userId)).size;
    const totalRemainingStock = myListings.reduce((sum, l) => sum + Math.max(0, l.stock), 0);
    const approvedCount = myListings.filter((l) => l.approvalStatus === 'approved').length;
    const pendingCount = myListings.filter((l) => l.approvalStatus === 'pending').length;

    return {
      grossSales,
      totalCommission,
      netEarnings,
      totalCollectables,
      settledDebtTotal,
      cashCollectedTotal,
      unpaidDebtCount: unpaidDebtOrders.length,
      uniqueDebtorsCount,
      totalRemainingStock,
      approvedCount,
      pendingCount,
    };
  }, [mySellerOrders, myListings]);

  // Grouped Debtors ("Who Has Debt")
  const debtorGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        buyerId: string;
        buyerName: string;
        totalOwed: number;
        grossDebt: number;
        paidSoFar: number;
        orderCount: number;
        orderIds: string[];
        itemCounts: Record<string, number>;
        latestDate: string;
        dueLabel: string;
      }
    >();

    for (const o of mySellerOrders) {
      if (!isUnpaidDebtOrder(o)) continue;
      if (!isDateWithinPeriod(o.orderDateIso, periodFilter)) continue;
      if (
        listingFilter !== 'all' &&
        !o.items.some((li) => li.itemId === listingFilter)
      ) {
        continue;
      }
      const grossAmt = getOrderItemAmount(o);
      const remainingAmt = getOrderRemainingDebt(o);
      const paidAmt = Math.max(0, grossAmt - remainingAmt);
      const existing = map.get(o.userId);
      if (existing) {
        existing.totalOwed += remainingAmt;
        existing.grossDebt += grossAmt;
        existing.paidSoFar += paidAmt;
        existing.orderCount += 1;
        existing.orderIds.push(o.id);
        for (const li of o.items) {
          const cleanName = li.name.replace(' (Coworker Sale)', '').trim();
          existing.itemCounts[cleanName] = (existing.itemCounts[cleanName] ?? 0) + li.quantity;
        }
        if ((o.orderDateIso || '') > existing.latestDate) {
          existing.latestDate = o.orderDateIso || existing.latestDate;
        }
      } else {
        const itemCounts: Record<string, number> = {};
        for (const li of o.items) {
          const cleanName = li.name.replace(' (Coworker Sale)', '').trim();
          itemCounts[cleanName] = (itemCounts[cleanName] ?? 0) + li.quantity;
        }
        map.set(o.userId, {
          buyerId: o.userId,
          buyerName: o.userName,
          totalOwed: remainingAmt,
          grossDebt: grossAmt,
          paidSoFar: paidAmt,
          orderCount: 1,
          orderIds: [o.id],
          itemCounts,
          latestDate: o.orderDateIso || o.createdAt,
          dueLabel: o.dueDateLabel || nextDueLabel,
        });
      }
    }

    const q = searchQuery.trim().toLowerCase();
    return Array.from(map.values())
      .filter((g) => {
        if (!q) return true;
        return (
          g.buyerName.toLowerCase().includes(q) ||
          Object.keys(g.itemCounts).some((item) => item.toLowerCase().includes(q)) ||
          g.orderIds.some((id) => id.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.totalOwed - a.totalOwed);
  }, [mySellerOrders, periodFilter, listingFilter, searchQuery, nextDueLabel]);

  // Filtered Detailed Orders Table
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mySellerOrders.filter((o) => {
      if (!isDateWithinPeriod(o.orderDateIso, periodFilter)) return false;
      if (
        listingFilter !== 'all' &&
        !o.items.some((li) => li.itemId === listingFilter)
      ) {
        return false;
      }
      if (debtFilter === 'unpaid_debt' && !isUnpaidDebtOrder(o)) return false;
      if (debtFilter === 'settled_debt' && !(isDebtOrder(o) && !isUnpaidDebtOrder(o))) {
        return false;
      }
      if (debtFilter === 'all_debt' && !isDebtOrder(o)) return false;

      if (!q) return true;
      return (
        o.userName.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [mySellerOrders, periodFilter, listingFilter, debtFilter, searchQuery]);

  // Per-listing sales & collectables summary
  const listingReports = useMemo(() => {
    return myListings.map((listing) => {
      const relatedOrders = mySellerOrders.filter((o) =>
        o.items.some((li) => li.itemId === listing.id)
      );
      let gross = 0;
      let commission = 0;
      let unpaidDebt = 0;
      let unpaidCount = 0;
      let settledOrCash = 0;

      for (const o of relatedOrders) {
        const amt = getOrderItemAmount(o);
        gross += amt;
        commission += o.commissionEarned ?? 0;
        if (isUnpaidDebtOrder(o)) {
          const rem = getOrderRemainingDebt(o);
          unpaidDebt += rem;
          unpaidCount += 1;
          settledOrCash += Math.max(0, amt - rem);
        } else {
          settledOrCash += amt;
        }
      }

      const { ownerShare, sellerNet } = computeCommission(
        listing.price,
        listing.commissionType,
        listing.commissionValue
      );

      return {
        listing,
        orderCount: relatedOrders.length,
        gross,
        commission,
        sellerNetTotal: Math.max(0, gross - commission),
        unpaidDebt,
        unpaidCount,
        settledOrCash,
        unitOwnerShare: ownerShare,
        unitSellerNet: sellerNet,
      };
    });
  }, [myListings, mySellerOrders]);

  const paymentChannelSummary = useMemo(() => {
    const parts: string[] = [];
    if (gcashNumber.trim()) parts.push(`GCash ${gcashNumber.trim()}`);
    if (mayaNumber.trim()) parts.push(`Maya ${mayaNumber.trim()}`);
    if (parts.length === 0) return 'Cash / Store Settlement';
    return parts.join(' · ');
  }, [gcashNumber, mayaNumber]);

  const buildReminderMessage = (params: {
    buyerName: string;
    amount: number;
    itemSummary: string;
    dueLabel: string;
  }) => {
    const tpl = (defaultReminderTemplate || DEFAULT_REMINDER_TEMPLATE).trim();
    return tpl
      .replace(/\{buyer\}/gi, params.buyerName)
      .replace(/\{amount\}/gi, formatPHP(params.amount, true))
      .replace(/\{item\}/gi, params.itemSummary)
      .replace(/\{due\}/gi, params.dueLabel)
      .replace(/\{payment\}/gi, paymentChannelSummary);
  };

  const handleNotifyDebtor = async (payload: {
    key: string;
    buyerId: string;
    buyerName: string;
    orderIds: string[];
    amount: number;
    itemSummary: string;
    dueLabel: string;
  }) => {
    setNotifyingKey(payload.key);
    try {
      const msg = buildReminderMessage({
        buyerName: payload.buyerName,
        amount: payload.amount,
        itemSummary: payload.itemSummary,
        dueLabel: payload.dueLabel,
      });
      await onSendDebtReminder({
        buyerId: payload.buyerId,
        buyerName: payload.buyerName,
        orderIds: payload.orderIds,
        amount: payload.amount,
        itemSummary: payload.itemSummary,
        dueLabel: payload.dueLabel,
        customMessage: msg,
      });
      setNotifiedKeys((prev) => ({ ...prev, [payload.key]: true }));
      showNotice(
        'success',
        `Payment reminder notification sent to ${payload.buyerName} (${formatPHP(payload.amount, true)}).`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Could not send debt reminder notification.'
      );
    } finally {
      setNotifyingKey(null);
    }
  };

  const handleNotifyAllDebtors = async () => {
    if (debtorGroups.length === 0) return;
    setNotifyingKey('__ALL__');
    try {
      for (const group of debtorGroups) {
        const uniqueItems = Object.entries(group.itemCounts)
          .slice(0, 3)
          .map(([name, qty]) => `${qty}× ${name}`)
          .join(', ');
        const msg = buildReminderMessage({
          buyerName: group.buyerName,
          amount: group.totalOwed,
          itemSummary: uniqueItems || 'Community Order',
          dueLabel: group.dueLabel,
        });
        await onSendDebtReminder({
          buyerId: group.buyerId,
          buyerName: group.buyerName,
          orderIds: group.orderIds,
          amount: group.totalOwed,
          itemSummary: uniqueItems || 'Community Order',
          dueLabel: group.dueLabel,
          customMessage: msg,
        });
      }
      const nextMap: Record<string, boolean> = {};
      for (const g of debtorGroups) nextMap[`buyer-${g.buyerId}`] = true;
      setNotifiedKeys((prev) => ({ ...prev, ...nextMap }));
      showNotice(
        'success',
        `Sent payment reminder notifications to ${debtorGroups.length} debtor${
          debtorGroups.length === 1 ? '' : 's'
        }!`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Failed to notify all debtors.'
      );
    } finally {
      setNotifyingKey(null);
    }
  };

  const handleToggleSettled = async (order: StoreOrder) => {
    const nextSettled = !order.debtSettled;
    setSettlingOrderId(order.id);
    try {
      await onMarkOrderDebtSettled(order.id, nextSettled);
      showNotice(
        'success',
        nextSettled
          ? `Order ${order.id} from ${order.userName} marked as Paid / Settled.`
          : `Order ${order.id} reopened as Unpaid Debt.`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Failed to update settlement status.'
      );
    } finally {
      setSettlingOrderId(null);
    }
  };

  const handleConfirmPendingOrder = async (order: StoreOrder) => {
    setConfirmingOrderId(order.id);
    try {
      await onConfirmOrder(order.id);
      showNotice(
        'success',
        order.fulfillment === 'Pickup'
          ? `Order ${order.id} confirmed & stock released (Pickup completed).`
          : `Order ${order.id} confirmed & stock released — ready for you to deliver to buyer's desk.`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : `Could not confirm order ${order.id}.`
      );
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleMarkDelivered = async (order: StoreOrder) => {
    if (!onMarkOrderDelivered) return;
    setMarkingDeliveredOrderId(order.id);
    try {
      await onMarkOrderDelivered(order.id);
      showNotice(
        'success',
        `Order ${order.id} for ${order.userName} marked Delivered by Seller.`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : `Could not mark order ${order.id} delivered.`
      );
    } finally {
      setMarkingDeliveredOrderId(null);
    }
  };

  const handleRejectPendingOrder = async (order: StoreOrder) => {
    setConfirmingOrderId(order.id);
    try {
      await onRejectOrder(order.id);
      showNotice(
        'success',
        `Order ${order.id} from ${order.userName} was declined. No stock or buyer debt was applied.`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : `Could not decline order ${order.id}.`
      );
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleReviewProofAction = async (
    proof: PaymentProof,
    decision: 'approved' | 'rejected'
  ) => {
    setReviewingProofId(proof.id);
    try {
      await onReviewSellerProof(proof.id, decision);
      showNotice(
        'success',
        decision === 'approved'
          ? `Approved ${proof.channel} receipt (${formatPHP(proof.amount, true)}) from ${proof.userName} & settled community debt.`
          : `Rejected payment receipt ${proof.id} from ${proof.userName}.`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Failed to process payment proof.'
      );
    } finally {
      setReviewingProofId(null);
    }
  };

  const openListingEditor = (listing: MarketplaceListing) => {
    setEditingListing(listing);
    setEditTitle(listing.title);
    setEditDesc(listing.description);
    setEditPrice(String(listing.price));
    setEditStock(String(listing.stock));
    setEditAllowCash(listing.allowCash ?? defaultAllowCash);
    setEditAllowDebt(listing.allowDebt ?? defaultAllowDebt);
    setEditPaused(Boolean(listing.paused));
    setEditPickupNote(listing.pickupNote ?? defaultPickupNote);
    setEditPaymentDetails(listing.paymentDetails ?? paymentChannelSummary);
  };

  const handleSaveListingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListing) return;
    const price = Math.max(1, Number(editPrice) || editingListing.price);
    const stock = Math.max(0, Math.round(Number(editStock) || 0));
    if (!editAllowCash && !editAllowDebt) {
      showNotice('error', 'Enable at least Cash or Store Credit (Debt) for buyers.');
      return;
    }

    setSavingListingEdit(true);
    try {
      await onUpdateListingConfig(editingListing.id, {
        title: editTitle.trim() || editingListing.title,
        description: editDesc.trim(),
        price,
        stock,
        paused: editPaused,
        allowCash: editAllowCash,
        allowDebt: editAllowDebt,
        pickupNote: editPickupNote.trim(),
        paymentDetails: editPaymentDetails.trim(),
      });
      setEditingListing(null);
      showNotice('success', `Updated configuration for "${editTitle.trim()}".`);
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Could not update listing configuration.'
      );
    } finally {
      setSavingListingEdit(false);
    }
  };

  const handleSaveConfigForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!defaultAllowCash && !defaultAllowDebt) {
      showNotice('error', 'Keep at least one default payment option enabled.');
      return;
    }

    setSavingConfig(true);
    try {
      await onSaveSellerConfig({
        userId: currentUser.id,
        gcashNumber: gcashNumber.trim(),
        mayaNumber: mayaNumber.trim(),
        paymentNotes: paymentNotes.trim(),
        defaultPickupNote: defaultPickupNote.trim(),
        defaultReminderTemplate:
          defaultReminderTemplate.trim() || DEFAULT_REMINDER_TEMPLATE,
        defaultAllowCash,
        defaultAllowDebt,
        notifyOnNewSale,
      });
      showNotice('success', 'Seller payout, reminder, and listing settings saved.');
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Failed to save seller configuration.'
      );
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Order ID',
      'Date',
      'Buyer Name',
      'Buyer Department',
      'Table Row',
      'Table Number',
      'Items',
      'Payment Method',
      'Fulfillment',
      'Gross Amount (PHP)',
      'Store Share (PHP)',
      'Seller Net (PHP)',
      'Due Date',
      'Status',
    ];
    const rows = filteredOrders.map((o) => {
      const gross = getOrderItemAmount(o);
      const comm = o.commissionEarned ?? 0;
      const net = Math.max(0, gross - comm);
      const itemStr = o.items
        .map((i) => `${i.quantity}x ${i.name.replace(' (Coworker Sale)', '')}`)
        .join(' | ');
      const statusLabel = isDebtOrder(o)
        ? o.debtSettled
          ? 'Settled Debt'
          : 'Unpaid Debt'
        : 'Paid (Cash)';
      return [
        o.id,
        o.createdAt,
        o.userName,
        o.buyerDepartment || '',
        o.buyerTableRow || '',
        o.buyerTableNumber || '',
        itemStr,
        o.paymentMethod,
        o.fulfillment,
        gross.toFixed(2),
        comm.toFixed(2),
        net.toFixed(2),
        o.dueDateLabel || '-',
        statusLabel,
      ];
    });
    const csvContent = [headers, ...rows]
      .map((cols) =>
        cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `community-seller-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isGuest) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-8 sm:p-10 text-center space-y-3">
        <ShoppingBag className="w-10 h-10 text-teal-600 dark:text-teal-400 mx-auto" />
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Sign in to View Your Community Seller Dashboard
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          Track coworkers who ordered your Community for-sale items on Debt, view total collectables, send payment reminders, and manage your listing settings.
        </p>
        <button
          type="button"
          onClick={onOpenSignIn}
          className="mt-2 min-h-[44px] rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Community Seller Dashboard
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Open to all coworkers for transparent tracking of your posted items, confirmed sales, buyer debt collectables, payment reminders, and seller delivery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onGoToCommunity(true)}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-4 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#172523] cursor-pointer"
          >
            <Plus className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span>Post Item on Community</span>
          </button>

          <button
            type="button"
            disabled={debtorGroups.length === 0 || notifyingKey === '__ALL__'}
            onClick={() => void handleNotifyAllDebtors()}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span>
              {notifyingKey === '__ALL__'
                ? 'Sending Reminders...'
                : `Notify All Debtors (${debtorGroups.length})`}
            </span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
              : 'border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Buyer Community Debt Payment Proofs Queue (shown above KPIs when pending) */}
      {pendingSellerProofs.length > 0 && (
        <div className="rounded-2xl border-2 border-teal-400 dark:border-teal-600 bg-white dark:bg-[#121D1B] overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-teal-100 dark:border-teal-900/60 bg-teal-50/80 dark:bg-teal-950/40 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                <ReceiptText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Buyer Debt Payment Proofs Awaiting Your Approval ({pendingSellerProofs.length})
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Verify payment receipts ({formatPHP(pendingSellerProofTotal, true)}) to reduce your Total Collectables and clear the buyer&apos;s ledger.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {pendingSellerProofs.map((prf) => {
              const isBusy = reviewingProofId === prf.id;
              return (
                <div
                  key={prf.id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {prf.imageDataUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            src: prf.imageDataUrl,
                            title: `${prf.userName} · ${prf.channel} Payment Receipt`,
                            subtitle: `Ref: ${prf.referenceNo} · ${formatPHP(prf.amount, true)}`,
                          })
                        }
                        className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 hover:opacity-90 transition-opacity shrink-0 bg-stone-50 cursor-pointer"
                        title="Click to preview receipt image"
                        aria-label={`Preview receipt from ${prf.userName}`}
                      >
                        <img
                          src={prf.imageDataUrl}
                          alt={`Receipt from ${prf.userName}`}
                          className="w-16 h-20 object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-16 h-20 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] shrink-0 flex items-center justify-center text-[10px] font-semibold text-stone-400 text-center px-1">
                        Cleared
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <span className="font-mono font-semibold text-stone-800 dark:text-stone-200">
                          {prf.id}
                        </span>
                        <span>· {prf.channel}</span>
                        <span>· {prf.submittedAt}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                          Pending Verification
                        </span>
                      </div>

                      <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {prf.userName} —{' '}
                        <span className="font-mono tabular-nums text-teal-700 dark:text-teal-400">
                          {formatPHP(prf.amount, true)}
                        </span>
                      </div>

                      <div className="text-xs text-stone-600 dark:text-stone-400">
                        Ref: <span className="font-mono font-semibold">{prf.referenceNo}</span>
                        {prf.orderIds && prf.orderIds.length > 0 && (
                          <span className="ml-2 font-mono text-[11px] text-stone-500">
                            Orders: {prf.orderIds.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleReviewProofAction(prf, 'rejected')}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleReviewProofAction(prf, 'approved')}
                      className="min-h-[38px] px-4 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Settling...' : 'Approve & Settle Debt'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-[#121D1B] p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300">
            <span>Total Collectables (Debt)</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {formatPHP(stats.totalCollectables, true)}
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {stats.uniqueDebtorsCount} debtor{stats.uniqueDebtorsCount === 1 ? '' : 's'} ·{' '}
            {stats.unpaidDebtCount} unpaid debt order{stats.unpaidDebtCount === 1 ? '' : 's'}
          </p>
          {pendingSellerProofTotal > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
              {formatPHP(pendingSellerProofTotal, true)} awaiting your approval above
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
            <span>Gross Sales &amp; Your Net</span>
            <Coins className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-stone-100">
            {formatPHP(stats.grossSales, true)}
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            You keep <strong className="text-teal-700 dark:text-teal-400">{formatPHP(stats.netEarnings, true)}</strong> · Store share {formatPHP(stats.totalCommission, true)}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
            <span>Collected (Cash + Settled)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatPHP(stats.cashCollectedTotal + stats.settledDebtTotal, true)}
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Cash {formatPHP(stats.cashCollectedTotal)} · Settled debt {formatPHP(stats.settledDebtTotal)}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
            <span>My Posted Listings</span>
            <Package className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-stone-100">
            {myListings.length} Items
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {stats.approvedCount} live · {stats.pendingCount} pending · {stats.totalRemainingStock} stock left
          </p>
        </div>
      </div>

      {/* Pending Order Confirmations Queue */}
      {pendingConfirmationOrders.length > 0 && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800/70 bg-white dark:bg-[#121D1B] overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-200/80 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                <Clock3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Pending Buyer Orders Awaiting Your Confirmation ({pendingConfirmationOrders.length})
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Stock is held and orders are excluded from your buyer&apos;s Debt Ledger until you confirm.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {pendingConfirmationOrders.map((ord) => {
              const itemAmt = getOrderItemAmount(ord);
              const isBusy = confirmingOrderId === ord.id;
              const isDebt = isDebtOrder(ord);
              const isPickup = ord.fulfillment === 'Pickup';
              const itemsText = ord.items
                .map((li) => `${li.quantity}× ${li.name.replace(' (Coworker Sale)', '')}`)
                .join(', ');
              const insufficientItem = ord.items.find((li) => {
                const inv = listings.find((l) => l.id === li.itemId);
                return inv ? inv.stock < li.quantity : false;
              });

              return (
                <div
                  key={ord.id}
                  className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {ord.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                        Pending Seller Confirmation
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          isDebt
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {isDebt ? 'Store Credit (Debt)' : 'Cash'}
                      </span>
                      <span className="text-stone-500 dark:text-stone-400">
                        {ord.fulfillment === 'Delivery' ? 'Seller Delivery' : ord.fulfillment}
                        {formatBuyerWorkstation(ord) ? ` · ${formatBuyerWorkstation(ord)}` : ''}
                        {!isPickup &&
                        ord.deliveryNote &&
                        ord.deliveryNote !== formatBuyerWorkstation(ord)
                          ? ` · ${ord.deliveryNote}`
                          : ''}{' '}
                        · {ord.createdAt}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {ord.userName} ordered {itemsText} —{' '}
                      <span className="font-mono tabular-nums text-teal-700 dark:text-teal-400">
                        {formatPHP(itemAmt, true)}
                      </span>
                    </div>

                    {insufficientItem && (
                      <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                        Insufficient stock remaining for {insufficientItem.name}. Restock listing before confirming or decline order.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleRejectPendingOrder(ord)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || Boolean(insufficientItem)}
                      onClick={() => void handleConfirmPendingOrder(ord)}
                      className="min-h-[38px] px-4 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {isBusy
                          ? 'Confirming...'
                          : isPickup
                            ? 'Confirm & Release Stock'
                            : 'Confirm & Prepare Seller Delivery'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Processed Buyer Debt Payment History (when no pending proofs, or processed history) */}
      {sellerProofs.some((p) => p.status !== 'pending') && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-[#172523] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Reviewed Buyer Debt Receipts ({sellerProofs.filter((p) => p.status !== 'pending').length})
              </h2>
            </div>
          </div>

          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {sellerProofs
              .filter((p) => p.status !== 'pending')
              .slice(0, 6)
              .map((prf) => (
                <div
                  key={prf.id}
                  className="p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {prf.imageDataUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            src: prf.imageDataUrl,
                            title: `${prf.userName} · ${prf.channel} Payment Receipt`,
                            subtitle: `Ref: ${prf.referenceNo} · ${formatPHP(prf.amount, true)}`,
                          })
                        }
                        className="rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
                        title="Click to preview receipt image"
                        aria-label={`Preview receipt from ${prf.userName}`}
                      >
                        <img
                          src={prf.imageDataUrl}
                          alt={`Receipt from ${prf.userName}`}
                          className="w-10 h-10 object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] shrink-0 flex items-center justify-center text-[9px] font-semibold text-stone-400">
                        N/A
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-stone-900 dark:text-stone-100 truncate">
                        {prf.userName} · {formatPHP(prf.amount, true)} ({prf.channel})
                      </div>
                      <div className="text-stone-500 dark:text-stone-400 font-mono truncate">
                        {prf.id} · Ref: {prf.referenceNo} · {prf.reviewedAt || prf.submittedAt}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      prf.status === 'approved'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {prf.status === 'approved' ? 'Approved & Settled' : 'Rejected'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Dashboard Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setActiveTab('debtors')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'debtors'
                ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Debtors &amp; Collectables ({stats.unpaidDebtCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('listings')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'listings'
                ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>My Posted Items ({myListings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'config'
                ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configuration Options</span>
          </button>
        </div>

        {activeTab === 'debtors' && mySellerOrders.length > 0 && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#172523] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>Export Report CSV</span>
          </button>
        )}
      </div>

      {/* TAB 1: DEBTORS & COLLECTABLES REPORT */}
      {activeTab === 'debtors' && (
        <div className="space-y-6">
          {myListings.length === 0 &&
          mySellerOrders.length === 0 &&
          pendingConfirmationOrders.length === 0 &&
          sellerProofs.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-8 text-center space-y-3">
              <ShoppingBag className="w-9 h-9 text-teal-600 dark:text-teal-400 mx-auto" />
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                No Community Items Posted Yet
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                Once you post an item for sale on the Community Marketplace and coworkers order using Cash or Store Credit (Debt), your sales reports, debtors list, collectables, and Notify buttons will appear here automatically.
              </p>
              <button
                type="button"
                onClick={() => onGoToCommunity(true)}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Post Your First Community Item</span>
              </button>
            </div>
          ) : (
            <>
              {/* Filter Bar */}
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search buyer, item, order ID..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <select
                  value={listingFilter}
                  onChange={(e) => setListingFilter(e.target.value)}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-xs font-medium text-stone-800 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                >
                  <option value="all">All My Posted Items ({myListings.length})</option>
                  {myListings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>

                <select
                  value={periodFilter}
                  onChange={(e) =>
                    setPeriodFilter(e.target.value as 'all' | 'week' | 'month' | 'year')
                  }
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-xs font-medium text-stone-800 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>

                <select
                  value={debtFilter}
                  onChange={(e) =>
                    setDebtFilter(
                      e.target.value as
                        | 'unpaid_debt'
                        | 'settled_debt'
                        | 'all_debt'
                        | 'all_orders'
                    )
                  }
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-xs font-medium text-stone-800 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                >
                  <option value="unpaid_debt">Who Has Unpaid Debt ({stats.unpaidDebtCount})</option>
                  <option value="settled_debt">Settled Debt Orders</option>
                  <option value="all_debt">All Debt Orders</option>
                  <option value="all_orders">All Orders (Cash + Debt)</option>
                </select>
              </div>

              {/* Who Has Debt — Grouped by Buyer */}
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 bg-stone-50/70 dark:bg-[#172523]">
                  <div>
                    <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      Who Has Debt (Grouped by Buyer)
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Send a direct payment reminder notification to anyone with an open collectable balance.
                    </p>
                  </div>
                  <span className="text-xs font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
                    Open Collectables: {formatPHP(stats.totalCollectables, true)}
                  </span>
                </div>

                {debtorGroups.length === 0 ? (
                  <div className="p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                    No unpaid coworker debt orders match the current filter.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-200 dark:divide-stone-800">
                    {debtorGroups.map((group) => {
                      const buyerKey = `buyer-${group.buyerId}`;
                      const isSending = notifyingKey === buyerKey;
                      const wasSent = Boolean(notifiedKeys[buyerKey]);
                      const uniqueItems = Object.entries(group.itemCounts)
                        .map(([name, qty]) => `${qty}× ${name}`)
                        .join(', ');
                      const buyerPendingAmt = pendingSellerProofs
                        .filter((p) => p.userId === group.buyerId)
                        .reduce((s, p) => s + p.amount, 0);

                      return (
                        <div
                          key={group.buyerId}
                          className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                {group.buyerName}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                                {group.orderCount} unpaid debt order
                                {group.orderCount === 1 ? '' : 's'}
                              </span>
                              <span className="text-xs text-stone-500 dark:text-stone-400">
                                Due {group.dueLabel}
                              </span>
                              {group.paidSoFar > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                                  Paid {formatPHP(group.paidSoFar)} / {formatPHP(group.grossDebt)}
                                </span>
                              )}
                              {buyerPendingAmt > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-[11px] font-semibold">
                                  Receipt pending check: {formatPHP(buyerPendingAmt, true)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-600 dark:text-stone-400">
                              Items: {uniqueItems}
                            </p>
                            <p className="text-[11px] text-stone-400 font-mono">
                              Orders: {group.orderIds.join(', ')}
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-left sm:text-right">
                              <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                Collectable
                              </div>
                              <div className="text-base font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                                {formatPHP(group.totalOwed, true)}
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() =>
                                void handleNotifyDebtor({
                                  key: buyerKey,
                                  buyerId: group.buyerId,
                                  buyerName: group.buyerName,
                                  orderIds: group.orderIds,
                                  amount: group.totalOwed,
                                  itemSummary: uniqueItems,
                                  dueLabel: group.dueLabel,
                                })
                              }
                              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                wasSent
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-teal-700 hover:bg-teal-800 text-white'
                              }`}
                            >
                              {wasSent ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {isSending ? 'Notifying...' : wasSent ? 'Reminded' : 'Notify to Pay'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Detailed Orders & Debt Ledger Table */}
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 bg-stone-50/70 dark:bg-[#172523]">
                  <div>
                    <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      Order-by-Order Debt &amp; Sales Report ({filteredOrders.length})
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Notify individual debt orders or mark them settled once you receive payment.
                    </p>
                  </div>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                    No matching community orders found for your current filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 bg-stone-50/50 dark:bg-[#172523]/60">
                          <th className="py-3 px-4 font-semibold">Order / Date</th>
                          <th className="py-3 px-4 font-semibold">Buyer</th>
                          <th className="py-3 px-4 font-semibold">Item Ordered</th>
                          <th className="py-3 px-4 font-semibold">Method</th>
                          <th className="py-3 px-4 font-semibold text-right">Amount</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                        {filteredOrders.map((order) => {
                          const itemAmt = getOrderItemAmount(order);
                          const remainingDebt = getOrderRemainingDebt(order);
                          const paidAmt = Math.max(0, itemAmt - remainingDebt);
                          const sellerNet = getOrderSellerNet(order);
                          const debt = isDebtOrder(order);
                          const unpaid = isUnpaidDebtOrder(order);
                          const rowKey = `ord-${order.id}`;
                          const itemText = order.items
                            .map((i) => `${i.quantity}× ${i.name.replace(' (Coworker Sale)', '')}`)
                            .join(', ');

                          return (
                            <tr
                              key={order.id}
                              className="hover:bg-stone-50/60 dark:hover:bg-[#172523]/50 transition-colors"
                            >
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="font-mono font-bold text-stone-900 dark:text-stone-100">
                                  {order.id}
                                </div>
                                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                  {order.createdAt}
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-stone-900 dark:text-stone-100">
                                  {order.userName}
                                </div>
                                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                  {order.fulfillment === 'Delivery'
                                    ? `Seller Delivery${
                                        order.deliveryStatus === 'Delivered'
                                          ? ' (Delivered)'
                                          : ' (Pending Delivery)'
                                      }`
                                    : order.fulfillment}
                                </div>
                                {formatBuyerWorkstation(order) && (
                                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                    {formatBuyerWorkstation(order)}
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4 max-w-[240px]">
                                <div className="text-stone-800 dark:text-stone-200 truncate">
                                  {itemText}
                                </div>
                                {order.dueDateLabel && (
                                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                    Cutoff: {order.dueDateLabel}
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    debt
                                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  }`}
                                >
                                  {debt ? 'Debt' : 'Cash'}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono tabular-nums">
                                <div className="font-bold text-stone-900 dark:text-stone-100">
                                  {unpaid && paidAmt > 0
                                    ? formatPHP(remainingDebt, true)
                                    : formatPHP(itemAmt, true)}
                                </div>
                                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                  {unpaid && paidAmt > 0
                                    ? `Paid ${formatPHP(paidAmt)} / ${formatPHP(itemAmt)}`
                                    : `Net ${formatPHP(sellerNet, true)}`}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {unpaid ? (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                      paidAmt > 0
                                        ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300'
                                        : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                    }`}
                                  >
                                    {paidAmt > 0 ? 'Partial Paid' : 'Unpaid Debt'}
                                  </span>
                                ) : debt ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                                      Settled
                                    </span>
                                    {order.settledAt && (
                                      <div className="text-[10px] text-stone-400 mt-0.5">
                                        {order.settledAt}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[11px] font-semibold">
                                    Paid Cash
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {onMarkOrderDelivered &&
                                    order.fulfillment === 'Delivery' &&
                                    order.status === 'Confirmed' &&
                                    order.deliveryStatus !== 'Delivered' && (
                                      <button
                                        type="button"
                                        disabled={markingDeliveredOrderId === order.id}
                                        onClick={() => void handleMarkDelivered(order)}
                                        className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>
                                          {markingDeliveredOrderId === order.id
                                            ? 'Updating...'
                                            : 'Mark Delivered'}
                                        </span>
                                      </button>
                                    )}

                                  {unpaid && (
                                    <button
                                      type="button"
                                      disabled={notifyingKey === rowKey}
                                      onClick={() =>
                                        void handleNotifyDebtor({
                                          key: rowKey,
                                          buyerId: order.userId,
                                          buyerName: order.userName,
                                          orderIds: [order.id],
                                          amount: remainingDebt,
                                          itemSummary: itemText,
                                          dueLabel: order.dueDateLabel || nextDueLabel,
                                        })
                                      }
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                      title="Send payment reminder notification"
                                    >
                                      <Bell className="w-3 h-3" />
                                      <span>
                                        {notifyingKey === rowKey
                                          ? 'Sending...'
                                          : notifiedKeys[rowKey]
                                            ? 'Reminded'
                                            : 'Notify'}
                                      </span>
                                    </button>
                                  )}

                                  {debt && (
                                    <button
                                      type="button"
                                      disabled={settlingOrderId === order.id}
                                      onClick={() => void handleToggleSettled(order)}
                                      className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                                        order.debtSettled
                                          ? 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                                          : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70'
                                      }`}
                                    >
                                      {settlingOrderId === order.id
                                        ? 'Updating...'
                                        : order.debtSettled
                                          ? 'Reopen'
                                          : 'Mark Paid'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: MY POSTED ITEMS & PER-ITEM CONFIGURATION */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {listingReports.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-8 text-center space-y-3">
              <Package className="w-9 h-9 text-teal-600 dark:text-teal-400 mx-auto" />
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                You haven&apos;t posted any Community sale items yet
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                Post snacks, homemade meals, or items in Community Marketplace to manage prices, stock, payment methods, and sales reports here.
              </p>
              <button
                type="button"
                onClick={() => onGoToCommunity(true)}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Post Item for Sale</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {listingReports.map((rep) => {
                const { listing } = rep;
                const allowCash = listing.allowCash ?? defaultAllowCash;
                const allowDebt = listing.allowDebt ?? defaultAllowDebt;
                return (
                  <div
                    key={listing.id}
                    className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 space-y-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shrink-0">
                        <ProductImage
                          src={listing.image}
                          alt={listing.title}
                          title={listing.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              listing.approvalStatus === 'approved'
                                ? listing.paused
                                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : listing.approvalStatus === 'pending'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                            }`}
                          >
                            {listing.approvalStatus === 'approved'
                              ? listing.paused
                                ? 'Paused by Seller'
                                : 'Live on Feed'
                              : listing.approvalStatus === 'pending'
                                ? 'Pending Admin Approval'
                                : 'Rejected'}
                          </span>
                          <span className="font-mono text-sm font-extrabold text-stone-900 dark:text-stone-100">
                            {formatPHP(listing.price, true)}
                          </span>
                        </div>

                        <h3 className="mt-1 text-base font-bold text-stone-900 dark:text-stone-100 truncate">
                          {listing.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 line-clamp-2">
                          {listing.description}
                        </p>
                      </div>
                    </div>

                    {/* Per-listing financial & stock report */}
                    <div className="grid grid-cols-4 gap-2 rounded-xl bg-stone-50 dark:bg-[#172523] border border-stone-200 dark:border-stone-800 p-3 text-center">
                      <div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400">Stock</div>
                        <div className="text-xs font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                          {listing.stock} left
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400">Sold</div>
                        <div className="text-xs font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                          {listing.soldCount} units
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400">Your Net</div>
                        <div className="text-xs font-bold font-mono tabular-nums text-teal-700 dark:text-teal-400">
                          {formatPHP(rep.sellerNetTotal)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400">
                          Unpaid Debt
                        </div>
                        <div className="text-xs font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                          {formatPHP(rep.unpaidDebt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <div>
                        Accepted:{' '}
                        <strong className="text-stone-700 dark:text-stone-200">
                          {[allowCash ? 'Cash' : null, allowDebt ? 'Store Debt' : null]
                            .filter(Boolean)
                            .join(' & ') || 'None'}
                        </strong>
                        {' · '}
                        Store share:{' '}
                        {listing.commissionType === CommissionType.Percentage
                          ? `${listing.commissionValue}% (${formatPHP(rep.unitOwnerShare)})`
                          : `${formatPHP(listing.commissionValue)} fixed`}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openListingEditor(listing)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Configure Item</span>
                        </button>

                        {listing.approvalStatus === 'approved' && (
                          <button
                            type="button"
                            onClick={() =>
                              void onUpdateListingConfig(listing.id, {
                                paused: !listing.paused,
                              }).then(() =>
                                showNotice(
                                  'success',
                                  !listing.paused
                                    ? `"${listing.title}" paused on Community feed.`
                                    : `"${listing.title}" resumed on Community feed.`
                                )
                              )
                            }
                            className="min-h-[36px] px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#172523] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {listing.paused ? (
                              <>
                                <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Resume</span>
                              </>
                            ) : (
                              <>
                                <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Pause</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {onDeleteListing && listing.soldCount === 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            void onDeleteListing(listing.id).then(() =>
                              showNotice('success', `Deleted "${listing.title}".`)
                            )
                          }
                          className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SELLER CONFIGURATION OPTIONS */}
      {activeTab === 'config' && (
        <form
          onSubmit={handleSaveConfigForm}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-6"
        >
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Seller Payout, Reminder &amp; Listing Preferences
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Configure your payment receiving details, debt reminder notification message template, and default buyer payment rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                GCash Account / Mobile Number
              </label>
              <input
                type="text"
                maxLength={60}
                value={gcashNumber}
                onChange={(e) => setGcashNumber(e.target.value)}
                placeholder="e.g. 0917-555-0194"
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Maya Account / Mobile Number
              </label>
              <input
                type="text"
                maxLength={60}
                value={mayaNumber}
                onChange={(e) => setMayaNumber(e.target.value)}
                placeholder="e.g. 0918-882-3310"
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Default Pickup Schedule / Location Note
              </label>
              <input
                type="text"
                maxLength={200}
                value={defaultPickupNote}
                onChange={(e) => setDefaultPickupNote(e.target.value)}
                placeholder="e.g. 4F Pantry Counter B · 12:00 PM - 2:00 PM"
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Payment Instructions / Account Name
              </label>
              <input
                type="text"
                maxLength={300}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="e.g. Account Name: Juan D. · Send receipt on Chat"
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              Debt Payment Reminder Notification Template
            </label>
            <textarea
              rows={3}
              maxLength={300}
              value={defaultReminderTemplate}
              onChange={(e) => setDefaultReminderTemplate(e.target.value)}
              className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
              <span>Placeholders:</span>
              {['{buyer}', '{amount}', '{item}', '{due}', '{payment}'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setDefaultReminderTemplate((prev) =>
                      `${prev}${prev.endsWith(' ') ? '' : ' '}${tag}`.slice(0, 300)
                    )
                  }
                  className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-mono text-stone-700 dark:text-stone-200 hover:bg-teal-50 dark:hover:bg-teal-950/60 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 p-3 text-xs text-teal-900 dark:text-teal-200">
              <span className="font-semibold">Preview: </span>
              {buildReminderMessage({
                buyerName: 'Clarisse',
                amount: 240,
                itemSummary: '2x Suman sa Lihiya',
                dueLabel: nextDueLabel,
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-100 dark:border-stone-800">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Accept Cash by Default
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  Allow cash orders on listings
                </div>
              </div>
              <input
                type="checkbox"
                checked={defaultAllowCash}
                onChange={(e) => setDefaultAllowCash(e.target.checked)}
                className="w-4 h-4 accent-teal-700"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Accept Debt by Default
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  Allow Store Credit (Debt)
                </div>
              </div>
              <input
                type="checkbox"
                checked={defaultAllowDebt}
                onChange={(e) => setDefaultAllowDebt(e.target.checked)}
                className="w-4 h-4 accent-teal-700"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Notify Me on New Order
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  Alert when a coworker buys
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyOnNewSale}
                onChange={(e) => setNotifyOnNewSale(e.target.checked)}
                className="w-4 h-4 accent-teal-700"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingConfig}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-xs font-bold text-white cursor-pointer"
            >
              {savingConfig ? 'Saving Configuration...' : 'Save Configuration Options'}
            </button>
          </div>
        </form>
      )}

      {/* Per-Listing Configuration Modal */}
      {editingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveListingEdit}
            className="w-full max-w-lg rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Configure Community Item
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Update price, available stock, accepted payment options, or pickup instructions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Item Title
              </label>
              <input
                type="text"
                required
                maxLength={140}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Price (₱)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Available Stock
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                maxLength={600}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Pickup Schedule / Note
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={editPickupNote}
                  onChange={(e) => setEditPickupNote(e.target.value)}
                  placeholder="e.g. Pantry Counter B at 12 PM"
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Payment Instructions
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={editPaymentDetails}
                  onChange={(e) => setEditPaymentDetails(e.target.value)}
                  placeholder="e.g. GCash 0917-xxx-xxxx"
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <label className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 p-2.5 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAllowCash}
                  onChange={(e) => setEditAllowCash(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>Allow Cash</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 p-2.5 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAllowDebt}
                  onChange={(e) => setEditAllowDebt(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>Allow Debt</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 p-2.5 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editPaused}
                  onChange={(e) => setEditPaused(e.target.checked)}
                  className="accent-amber-600"
                />
                <span>Pause Item</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingListingEdit}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-xs font-semibold text-white cursor-pointer"
              >
                {savingListingEdit ? 'Saving...' : 'Save Item Settings'}
              </button>
            </div>
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
