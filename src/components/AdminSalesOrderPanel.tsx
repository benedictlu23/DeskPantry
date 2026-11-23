import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Minus,
  PackageCheck,
  Plus,
  ReceiptText,
  ScanBarcode,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import {
  FulfillmentType,
  PaymentMethod,
  PaymentProof,
  StoreConfig,
  StoreItem,
  StoreOrder,
  UserAccount,
} from '../types';
import {
  formatPHP,
  isOrderPendingAdminConfirmation,
  isOrderPendingSellerConfirmation,
} from '../utils/format';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ProductImage } from './ProductImage';

interface AdminSalesOrderPanelProps {
  items: StoreItem[];
  users: UserAccount[];
  orders: StoreOrder[];
  proofs: PaymentProof[];
  storeConfig: StoreConfig;
  onApproveOrder: (orderId: string) => Promise<void>;
  onRejectOrder: (orderId: string) => Promise<void>;
  onCreateManualSale: (payload: {
    customerMode: 'walkin' | 'coworker';
    customerId?: string;
    customerName: string;
    items: Array<{ itemId: string; quantity: number }>;
    fulfillment: FulfillmentType;
    deliveryNote?: string;
    paymentMethod: string;
  }) => Promise<StoreOrder>;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
}

export const AdminSalesOrderPanel: React.FC<AdminSalesOrderPanelProps> = ({
  items,
  users,
  orders,
  proofs,
  storeConfig,
  onApproveOrder,
  onRejectOrder,
  onCreateManualSale,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [orderLines, setOrderLines] = useState<Array<{ itemId: string; quantity: number }>>([]);
  const [customerMode, setCustomerMode] = useState<'walkin' | 'coworker'>('walkin');
  const [walkinName, setWalkinName] = useState('Walk-in Customer');
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id ?? '');
  const [fulfillment, setFulfillment] = useState<FulfillmentType>(FulfillmentType.Pickup);
  const [deliveryNote, setDeliveryNote] = useState('');

  const enabledMethods = useMemo(
    () => storeConfig.paymentMethods.filter((m) => m.enabled),
    [storeConfig.paymentMethods]
  );
  const [selectedPaymentTitle, setSelectedPaymentTitle] = useState<string>(
    enabledMethods.find((m) => m.type === 'cash')?.title ?? PaymentMethod.Cash
  );
  const [cashTenderedInput, setCashTenderedInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [recentFilter, setRecentFilter] = useState<'all' | 'walkin'>('all');
  const [lastCreatedOrder, setLastCreatedOrder] = useState<StoreOrder | null>(null);

  const categories = useMemo(
    () => ['All', ...storeConfig.categories],
    [storeConfig.categories]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const catMatch = selectedCategory === 'All' || item.category === selectedCategory;
      const queryMatch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.barcode ? item.barcode.toLowerCase().includes(q) : false);
      return catMatch && queryMatch;
    });
  }, [items, selectedCategory, searchQuery]);

  const resolvedLines = useMemo(() => {
    return orderLines
      .map((line) => {
        const product = items.find((i) => i.id === line.itemId);
        if (!product) return null;
        return {
          ...line,
          product,
          lineTotal: product.price * line.quantity,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [orderLines, items]);

  const itemsSubtotal = useMemo(
    () => resolvedLines.reduce((sum, l) => sum + l.lineTotal, 0),
    [resolvedLines]
  );

  const deliveryFeeApplied =
    fulfillment === FulfillmentType.Delivery && storeConfig.deliveryEnabled
      ? storeConfig.deliveryFee
      : 0;

  const grandTotal = itemsSubtotal + deliveryFeeApplied;
  const isCashSelected = selectedPaymentTitle.toLowerCase().includes('cash');
  const cashTendered = Number(cashTenderedInput) || 0;
  const cashChange = isCashSelected && cashTendered >= grandTotal ? cashTendered - grandTotal : 0;

  const availablePaymentOptions = useMemo(() => {
    return enabledMethods.filter((m) => {
      if (customerMode === 'walkin' && m.type === 'debt') return false;
      return true;
    });
  }, [enabledMethods, customerMode]);

  const addItemToOrder = (product: StoreItem) => {
    if (product.stock <= 0) {
      onNotifyError(`"${product.name}" is currently out of stock.`);
      return;
    }
    setOrderLines((prev) => {
      const existing = prev.find((l) => l.itemId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          onNotifyError(`Only ${product.stock} units of "${product.name}" available.`);
          return prev;
        }
        return prev.map((l) =>
          l.itemId === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { itemId: product.id, quantity: 1 }];
    });
  };

  const updateLineQty = (itemId: string, delta: number) => {
    const product = items.find((i) => i.id === itemId);
    setOrderLines((prev) =>
      prev
        .map((l) => {
          if (l.itemId !== itemId) return l;
          const maxStock = product?.stock ?? l.quantity;
          const nextQty = Math.min(maxStock, l.quantity + delta);
          return { ...l, quantity: nextQty };
        })
        .filter((l) => l.quantity > 0)
    );
  };

  const handleBarcodeMatch = (rawCode: string) => {
    const code = rawCode.trim().toLowerCase();
    if (!code) return;
    const match = items.find(
      (i) =>
        (i.barcode && i.barcode.trim().toLowerCase() === code) ||
        i.id.toLowerCase() === code
    );
    if (!match) {
      onNotifyError(`No item found with barcode "${rawCode.trim()}".`);
      return;
    }
    addItemToOrder(match);
    setSearchQuery('');
    onNotifySuccess(`Added "${match.name}" to walk-in sales order.`);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resolvedLines.length === 0) {
      onNotifyError('Add at least one item before completing the sales order.');
      return;
    }
    if (fulfillment === FulfillmentType.Delivery && !deliveryNote.trim()) {
      onNotifyError('Enter a floor or desk delivery location.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onCreateManualSale({
        customerMode,
        customerId: customerMode === 'coworker' ? selectedUserId : undefined,
        customerName:
          customerMode === 'walkin'
            ? walkinName.trim() || 'Walk-in Customer'
            : users.find((u) => u.id === selectedUserId)?.name || 'Coworker',
        items: resolvedLines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        fulfillment,
        deliveryNote: fulfillment === FulfillmentType.Delivery ? deliveryNote : undefined,
        paymentMethod: selectedPaymentTitle,
      });
      setLastCreatedOrder(created);
      setOrderLines([]);
      setCashTenderedInput('');
      setDeliveryNote('');
      onNotifySuccess(
        `Sales order ${created.id} recorded (${formatPHP(created.totalAmount, true)}).`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not save sales order. Please try again.';
      onNotifyError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingOrders = useMemo(
    () => orders.filter(isOrderPendingAdminConfirmation),
    [orders]
  );

  const recentOrders = useMemo(() => {
    const base = orders.filter(
      (o) => !isOrderPendingAdminConfirmation(o) && !isOrderPendingSellerConfirmation(o)
    );
    if (recentFilter === 'walkin') {
      return base.filter(
        (o) =>
          o.userId === 'walk-in' ||
          o.assignedRunner === 'Counter B Walk-in' ||
          o.logs?.some((lg) => lg.event.toLowerCase().includes('manual walk-in'))
      );
    }
    return base;
  }, [orders, recentFilter]);

  const handleApprovePending = async (order: StoreOrder) => {
    setBusyOrderId(order.id);
    try {
      await onApproveOrder(order.id);
      onNotifySuccess(
        order.fulfillment === FulfillmentType.Pickup
          ? `Order ${order.id} approved & stock released (Counter B Pickup completed — not queued to Delivery Staff).`
          : `Order ${order.id} approved, stock released, and dispatched to Delivery Staff.`
      );
    } catch (err) {
      onNotifyError(
        err instanceof Error ? err.message : `Could not approve order ${order.id}.`
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleRejectPending = async (order: StoreOrder) => {
    setBusyOrderId(order.id);
    try {
      await onRejectOrder(order.id);
      onNotifySuccess(`Order ${order.id} rejected. No stock was deducted.`);
    } catch (err) {
      onNotifyError(
        err instanceof Error ? err.message : `Could not reject order ${order.id}.`
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Pending Storefront Orders Awaiting Confirmation & Stock Release */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-[#121D1B] overflow-hidden">
        <div className="px-6 py-4 border-b border-amber-200/80 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Clock3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Orders Pending Confirmation &amp; Stock Release ({pendingOrders.length})
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Storefront orders stay held here before stock is deducted. Approving Pickup completes the order without entering Delivery Staff; approving Delivery releases it to runners.
              </p>
            </div>
          </div>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="p-8 text-center">
            <PackageCheck className="w-8 h-8 text-emerald-600/70 dark:text-emerald-400/70 mx-auto" />
            <p className="mt-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
              No pending orders waiting for confirmation
            </p>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              New coworker Pickup and Delivery orders placed from the Storefront will appear here for your approval before stock release.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {pendingOrders.map((ord) => {
              const linkedProof = proofs.find((p) => p.orderId === ord.id);
              const stockIssues =
                ord.source === 'store'
                  ? ord.items
                      .map((line) => {
                        const inv = items.find((i) => i.id === line.itemId);
                        const avail = inv?.stock ?? 0;
                        return avail < line.quantity
                          ? `${line.name} (needs ${line.quantity}, ${avail} left)`
                          : null;
                      })
                      .filter((x): x is string => x !== null)
                  : [];
              const isBusy = busyOrderId === ord.id;
              const isPickup = ord.fulfillment === FulfillmentType.Pickup;

              return (
                <div
                  key={ord.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {ord.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                        {ord.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold inline-flex items-center gap-1 ${
                          isPickup
                            ? 'bg-stone-100 dark:bg-[#172523] text-stone-700 dark:text-stone-200'
                            : 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                        }`}
                      >
                        {isPickup ? (
                          <ShoppingBag className="w-3 h-3" />
                        ) : (
                          <Truck className="w-3 h-3" />
                        )}
                        {isPickup ? 'Pick Up at Counter B' : 'Desk Delivery'}
                      </span>
                      <span className="text-stone-500 dark:text-stone-400">{ord.createdAt}</span>
                    </div>

                    <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                      {ord.userName} —{' '}
                      <span className="font-mono tabular-nums">
                        {formatPHP(ord.totalAmount, true)}
                      </span>{' '}
                      <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                        via {ord.paymentMethod}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {ord.items.map((line) => {
                        const inv = items.find((i) => i.id === line.itemId);
                        const avail = inv?.stock ?? 0;
                        const low = ord.source === 'store' && avail < line.quantity;
                        return (
                          <span
                            key={`${ord.id}-${line.itemId}`}
                            className={`text-xs px-2.5 py-1 rounded-lg border tabular-nums ${
                              low
                                ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold'
                                : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-stone-700 dark:text-stone-200'
                            }`}
                          >
                            {line.quantity}× {line.name}
                            {ord.source === 'store' && inv ? ` (Stock: ${avail})` : ''}
                          </span>
                        );
                      })}
                    </div>

                    {ord.deliveryNote && (
                      <div className="text-xs text-stone-600 dark:text-stone-400">
                        Location Note: <strong className="text-stone-900 dark:text-stone-200">{ord.deliveryNote}</strong>
                      </div>
                    )}

                    {linkedProof && (
                      <div className="inline-flex items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] p-2.5 text-xs">
                        <img
                          src={linkedProof.imageDataUrl}
                          alt={`Proof ${linkedProof.referenceNo}`}
                          className="w-11 h-11 rounded-lg object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                        />
                        <div>
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            {linkedProof.channel} Proof · Ref:{' '}
                            <span className="font-mono">{linkedProof.referenceNo}</span>
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            Proof status: {linkedProof.status} · Approving order also confirms proof
                          </div>
                        </div>
                      </div>
                    )}

                    {stockIssues.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Insufficient stock: {stockIssues.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleRejectPending(ord)}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-45 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || stockIssues.length > 0}
                      onClick={() => void handleApprovePending(ord)}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-45 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {isBusy
                          ? 'Processing...'
                          : isPickup
                            ? 'Approve & Release (Pickup Done)'
                            : 'Approve, Release Stock & Dispatch'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Walk-In Sales Order POS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Item Picker & Barcode Scan-to-Add */}
        <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Walk-In Sales Order POS
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Scan a barcode or tap items to ring up walk-in customers and sync live stock &amp; reports.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ScanBarcode className="w-4 h-4" />
              <span>Scan to Add</span>
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleBarcodeMatch(searchQuery);
            }}
            className="relative"
          >
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                const exact = items.find(
                  (i) => i.barcode && i.barcode.trim().toLowerCase() === val.trim().toLowerCase()
                );
                if (exact) {
                  addItemToOrder(exact);
                  setSearchQuery('');
                  onNotifySuccess(`Scanned & added "${exact.name}".`);
                }
              }}
              placeholder="Scan barcode (auto-adds) or search item name..."
              aria-label="Search or scan item for walk-in sales order"
              className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] pl-10 pr-9 py-2 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-teal-700 focus:bg-white dark:focus:bg-[#121D1B] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear item search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  selectedCategory === cat
                    ? 'bg-stone-900 dark:bg-teal-700 text-white'
                    : 'bg-stone-100 dark:bg-[#172523] text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Item Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-0.5">
            {filteredItems.map((item) => {
              const inOrder = orderLines.find((l) => l.itemId === item.id);
              const outOfStock = item.stock <= 0;
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#172523] p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 shrink-0 bg-white dark:bg-[#121D1B]">
                      <ProductImage src={item.image} alt={item.name} title={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                        <span className="font-mono font-semibold text-stone-800 dark:text-stone-200">
                          {formatPHP(item.price)}
                        </span>{' '}
                        ·{' '}
                        <span
                          className={
                            outOfStock
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : item.stock <= 6
                                ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                : ''
                          }
                        >
                          {outOfStock ? 'Out of stock' : `${item.stock} left`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {inOrder ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateLineQty(item.id, -1)}
                        aria-label={`Decrease ${item.name}`}
                        className="w-8 h-8 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] flex items-center justify-center text-stone-700 dark:text-stone-200 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-mono font-bold tabular-nums">
                        {inOrder.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={inOrder.quantity >= item.stock}
                        onClick={() => updateLineQty(item.id, 1)}
                        aria-label={`Increase ${item.name}`}
                        className="w-8 h-8 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] flex items-center justify-center text-stone-700 dark:text-stone-200 disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => addItemToOrder(item)}
                      className="min-h-[36px] rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40 shrink-0 cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="sm:col-span-2 py-8 text-center text-xs text-stone-500 dark:text-stone-400">
                No store items match your current filter.
              </div>
            )}
          </div>
        </div>

        {/* Right: Walk-In Order Slip */}
        <form
          onSubmit={(e) => void handleSubmitOrder(e)}
          className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Sales Order Slip
              </h3>
            </div>
            {resolvedLines.length > 0 && (
              <button
                type="button"
                onClick={() => setOrderLines([])}
                className="text-xs font-semibold text-stone-500 hover:text-red-600 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Customer Type */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-[#172523]">
              <button
                type="button"
                onClick={() => {
                  setCustomerMode('walkin');
                  if (selectedPaymentTitle === PaymentMethod.Debt) {
                    setSelectedPaymentTitle(PaymentMethod.Cash);
                  }
                }}
                className={`min-h-[36px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerMode === 'walkin'
                    ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                <UserRound className="w-3.5 h-3.5" />
                <span>Walk-In Guest</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('coworker')}
                className={`min-h-[36px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerMode === 'coworker'
                    ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Coworker</span>
              </button>
            </div>

            {customerMode === 'walkin' ? (
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Customer Label / Name
                </label>
                <input
                  type="text"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="Walk-in Customer"
                  className="w-full min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Select Registered Coworker
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs text-stone-900 dark:text-stone-100"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.department}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="divide-y divide-stone-200 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-800 max-h-56 overflow-y-auto">
            {resolvedLines.map((line) => (
              <div
                key={line.itemId}
                className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                    {line.product.name}
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                    {line.quantity} × {formatPHP(line.product.price)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                    {formatPHP(line.lineTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOrderLines((prev) => prev.filter((l) => l.itemId !== line.itemId))
                    }
                    aria-label={`Remove ${line.product.name}`}
                    className="p-1 rounded-md text-stone-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {resolvedLines.length === 0 && (
              <div className="p-5 text-center text-xs text-stone-500 dark:text-stone-400">
                Tap items on the left or scan a barcode to start an order.
              </div>
            )}
          </div>

          {/* Fulfillment & Payment */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                Fulfillment
              </label>
              <select
                value={fulfillment}
                onChange={(e) => setFulfillment(e.target.value as FulfillmentType)}
                className="w-full min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 text-xs font-semibold text-stone-900 dark:text-stone-100"
              >
                <option value={FulfillmentType.Pickup}>Counter Pickup (₱0)</option>
                {storeConfig.deliveryEnabled && (
                  <option value={FulfillmentType.Delivery}>
                    Desk Delivery (+{formatPHP(storeConfig.deliveryFee)})
                  </option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                Payment Method
              </label>
              <select
                value={selectedPaymentTitle}
                onChange={(e) => setSelectedPaymentTitle(e.target.value)}
                className="w-full min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 text-xs font-semibold text-stone-900 dark:text-stone-100"
              >
                {availablePaymentOptions.map((pm) => (
                  <option key={pm.id} value={pm.title}>
                    {pm.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {fulfillment === FulfillmentType.Delivery && (
            <input
              type="text"
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="Desk / Floor location (e.g. 4F Engineering Pod)"
              className="w-full min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs text-stone-900 dark:text-stone-100"
            />
          )}

          {isCashSelected && grandTotal > 0 && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3 flex items-center justify-between gap-3">
              <div className="flex-1">
                <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-0.5">
                  Cash Tendered (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={cashTenderedInput}
                  onChange={(e) => setCashTenderedInput(e.target.value)}
                  placeholder={String(grandTotal)}
                  className="w-full min-h-[34px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs font-mono tabular-nums text-stone-900 dark:text-stone-100"
                />
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-stone-500 dark:text-stone-400">Change Due</div>
                <div className="text-sm font-mono font-bold text-teal-700 dark:text-teal-400 tabular-nums">
                  {formatPHP(cashChange, true)}
                </div>
              </div>
            </div>
          )}

          {/* Totals & Submit */}
          <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                <span>Items Subtotal</span>
                <span className="font-mono tabular-nums">{formatPHP(itemsSubtotal, true)}</span>
              </div>
              {deliveryFeeApplied > 0 && (
                <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                  <span>Delivery Fee (Runner Commission)</span>
                  <span className="font-mono tabular-nums">
                    {formatPHP(deliveryFeeApplied, true)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-base font-bold text-stone-900 dark:text-stone-100 pt-1">
                <span>Total Due</span>
                <span className="font-mono tabular-nums">{formatPHP(grandTotal, true)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={resolvedLines.length === 0 || isSubmitting}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-45 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Recording Order...'
                  : `Complete Sales Order · ${formatPHP(grandTotal, true)}`}
              </span>
            </button>
          </div>

          {lastCreatedOrder && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 p-3 flex items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2 min-w-0">
                <ReceiptText className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span className="truncate">
                  Recorded <strong className="font-mono">{lastCreatedOrder.id}</strong> for{' '}
                  {lastCreatedOrder.userName} ({formatPHP(lastCreatedOrder.totalAmount, true)})
                </span>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Section 3: Recent Approved & Walk-In Sales Orders Table */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Confirmed, Released &amp; Walk-In Sales Orders ({recentOrders.length})
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Automatically synced to Firestore orders, inventory stock, and Excel/PDF sales reports.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#172523] self-start">
            <button
              type="button"
              onClick={() => setRecentFilter('all')}
              className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                recentFilter === 'all'
                  ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              All Sales Orders
            </button>
            <button
              type="button"
              onClick={() => setRecentFilter('walkin')}
              className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                recentFilter === 'walkin'
                  ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              Walk-In Only
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-600 dark:text-stone-300">
                <th className="py-3 px-5">Order ID</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Items</th>
                <th className="py-3 px-5">Payment &amp; Fulfillment</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-sm">
              {recentOrders.slice(0, 20).map((o) => (
                <tr key={o.id}>
                  <td className="py-3 px-5 font-mono text-xs font-semibold text-stone-900 dark:text-stone-100">
                    <div>{o.id}</div>
                    <div className="text-[11px] font-normal text-stone-500 dark:text-stone-400">
                      {o.createdAt}
                    </div>
                  </td>
                  <td className="py-3 px-5 text-xs font-semibold text-stone-900 dark:text-stone-100">
                    {o.userName}
                  </td>
                  <td className="py-3 px-5 text-xs text-stone-600 dark:text-stone-300">
                    {o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </td>
                  <td className="py-3 px-5 text-xs text-stone-600 dark:text-stone-300">
                    {o.paymentMethod} · {o.fulfillment}
                  </td>
                  <td className="py-3 px-5 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold ${
                        o.status === 'Rejected'
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                          : o.status === 'Completed' || o.deliveryStatus === 'Delivered'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                      }`}
                    >
                      {o.fulfillment === FulfillmentType.Delivery && o.deliveryStatus
                        ? o.deliveryStatus
                        : o.status}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
                    {formatPHP(o.totalAmount, true)}
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-xs text-stone-500 dark:text-stone-400"
                  >
                    No confirmed or walk-in sales orders recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        title="Scan Item to Add to Sales Order"
        subtitle="Scan a product barcode to immediately add 1 unit to the walk-in sales order."
        onDetected={(code) => {
          setIsScannerOpen(false);
          handleBarcodeMatch(code);
        }}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
};
