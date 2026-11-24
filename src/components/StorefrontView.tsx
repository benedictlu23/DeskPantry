import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Minus,
  PackageCheck,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import {
  CartItem,
  FulfillmentType,
  PaymentMethod,
  PaymentMethodConfig,
  PlatformConfig,
  StoreApplication,
  StoreConfig,
  StoreCustomerCredit,
  StoreItem,
  StoreOrder,
  StoreProfile,
  UserAccount,
  UserRole,
} from '../types';
import {
  computeBuyerStoreDebts,
  DEFAULT_STORE_ID,
  DEFAULT_STORE_NAME,
  DEFAULT_STORE_OWNER_ID,
  formatPHP,
  getNextDueDateLabel,
} from '../utils/format';
import { compressImageFileToDataUrl, isValidUploadedReceipt } from '../utils/image';
import { ImagePreviewModal, ImagePreviewTarget } from './ImagePreviewModal';
import { PaymentMethodCard } from './PaymentMethodCard';
import { ProductImage } from './ProductImage';

interface PerStoreCheckoutState {
  fulfillment: FulfillmentType;
  deliveryNote: string;
  paymentMethodId: string;
  proofRef: string;
  proofImage: string;
}

interface StorefrontViewProps {
  items: StoreItem[];
  isLoading?: boolean;
  cart: CartItem[];
  currentUser: UserAccount | null;
  currentRole: UserRole;
  dueDays: [number, number];
  nextDueLabel: string;
  storeConfig: StoreConfig;
  stores?: StoreProfile[];
  storeApplications?: StoreApplication[];
  platformConfig?: PlatformConfig;
  storeCustomerCredits?: StoreCustomerCredit[];
  orders?: StoreOrder[];
  onSubmitStoreApplication?: (payload: {
    storeName: string;
    description: string;
    paymentChannels: string;
  }) => Promise<void> | void;
  onAddToCart: (itemId: string) => void;
  onUpdateCartQty: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  onOpenSignIn: () => void;
  onOpenQRShare: () => void;
  onOpenSalesOrder?: () => void;
  pendingOrdersCount?: number;
  onPlaceOrder: (payload: {
    fulfillment: FulfillmentType;
    deliveryNote: string;
    paymentMethod: string;
    proofChannel?: string;
    proofRef?: string;
    proofImage?: string;
    buyerDepartment?: string;
    buyerTableRow?: string;
    buyerTableNumber?: string;
  }) => void;
  onPlaceSplitOrder?: (payload: {
    groups: Array<{
      storeId: string;
      storeName: string;
      fulfillment: FulfillmentType;
      deliveryNote: string;
      paymentMethod: string;
      proofChannel?: string;
      proofRef?: string;
      proofImage?: string;
      items: Array<{ itemId: string; quantity: number }>;
    }>;
    buyerDepartment: string;
    buyerTableRow: string;
    buyerTableNumber: string;
  }) => Promise<void> | void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  items,
  isLoading = false,
  cart,
  currentUser,
  currentRole,
  dueDays,
  nextDueLabel,
  storeConfig,
  stores = [],
  storeApplications = [],
  platformConfig,
  storeCustomerCredits = [],
  orders = [],
  onSubmitStoreApplication,
  onAddToCart,
  onUpdateCartQty,
  onClearCart,
  onOpenSignIn,
  onOpenQRShare,
  onOpenSalesOrder,
  pendingOrdersCount = 0,
  onPlaceOrder,
  onPlaceSplitOrder,
  isCartOpen,
  setIsCartOpen,
}) => {
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [buyerDepartment, setBuyerDepartment] = useState('');
  const [buyerTableRow, setBuyerTableRow] = useState('');
  const [buyerTableNumber, setBuyerTableNumber] = useState('');
  const [perStoreCheckout, setPerStoreCheckout] = useState<
    Record<string, PerStoreCheckoutState>
  >({});
  const [checkoutError, setCheckoutError] = useState('');
  const [orderBanner, setOrderBanner] = useState('');
  const [previewImage, setPreviewImage] = useState<ImagePreviewTarget | null>(null);

  // Store Application Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyStoreName, setApplyStoreName] = useState('');
  const [applyDesc, setApplyDesc] = useState('');
  const [applyChannels, setApplyChannels] = useState('Cash, GCash, Maya, Store Credit');
  const [applyError, setApplyError] = useState('');
  const [submittingApplication, setSubmittingApplication] = useState(false);

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
    isCartOpen,
  ]);

  const effectiveStores = useMemo<StoreProfile[]>(() => {
    if (stores.length > 0) return stores;
    return [
      {
        id: DEFAULT_STORE_ID,
        name: DEFAULT_STORE_NAME,
        description: storeConfig.storeAnnouncement,
        ownerId: DEFAULT_STORE_OWNER_ID,
        ownerName: 'Store Admin',
        status: 'active',
        subscriptionStatus: 'active',
        monthlyFee: platformConfig?.baseStoreMonthlyFee ?? 499,
        cashAssistanceActive: false,
        assignedDeliveryStaffIds: [],
        storeAnnouncement: storeConfig.storeAnnouncement,
        deliveryEnabled: storeConfig.deliveryEnabled,
        deliveryFee: storeConfig.deliveryFee,
        walletAccountName: storeConfig.walletAccountName,
        walletAccountNumber: storeConfig.walletAccountNumber,
        dueDays,
        categories: storeConfig.categories,
        paymentMethods: storeConfig.paymentMethods,
        createdAt: 'Flagship',
      },
    ];
  }, [stores, storeConfig, platformConfig?.baseStoreMonthlyFee, dueDays]);

  const storeById = useMemo(
    () => new Map(effectiveStores.map((s) => [s.id, s])),
    [effectiveStores]
  );

  const isGuest = currentRole === UserRole.Guest || !currentUser;

  const userTotalStoreDebt = useMemo(() => {
    if (!currentUser) return 0;
    return computeBuyerStoreDebts({
      userId: currentUser.id,
      fallbackDebtBalance: currentUser.debtBalance,
      storeDebtBalances: currentUser.storeDebtBalances,
      customerCredits: storeCustomerCredits,
      orders,
      stores: effectiveStores,
    }).totalDebt;
  }, [currentUser, storeCustomerCredits, orders, effectiveStores]);

  const categoryList = useMemo(() => {
    const cats = new Set<string>(storeConfig.categories);
    for (const s of effectiveStores) {
      for (const c of s.categories ?? []) cats.add(c);
    }
    for (const i of items) {
      if (i.category) cats.add(i.category);
    }
    return ['All', ...Array.from(cats)];
  }, [storeConfig.categories, effectiveStores, items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const itemStoreId = item.storeId || DEFAULT_STORE_ID;
      const matchStore =
        selectedStoreFilter === 'All' || itemStoreId === selectedStoreFilter;
      const matchCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const storeName = (
        item.storeName ||
        storeById.get(itemStoreId)?.name ||
        DEFAULT_STORE_NAME
      ).toLowerCase();
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        storeName.includes(q) ||
        (item.barcode ? item.barcode.toLowerCase().includes(q) : false);
      return matchStore && matchCategory && matchQuery;
    });
  }, [items, selectedStoreFilter, selectedCategory, searchQuery, storeById]);

  const cartDetails = useMemo(() => {
    return cart
      .map((c) => {
        const product = items.find((i) => i.id === c.itemId);
        if (!product) return null;
        return { ...c, product, subtotal: product.price * c.quantity };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [cart, items]);

  const storeGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        store?: StoreProfile;
        items: typeof cartDetails;
        itemsSubtotal: number;
      }
    >();
    for (const entry of cartDetails) {
      const sid = entry.product.storeId || DEFAULT_STORE_ID;
      const store = storeById.get(sid);
      const sname = entry.product.storeName || store?.name || DEFAULT_STORE_NAME;
      const existing = map.get(sid);
      if (existing) {
        existing.items.push(entry);
        existing.itemsSubtotal += entry.subtotal;
      } else {
        map.set(sid, {
          storeId: sid,
          storeName: sname,
          store,
          items: [entry],
          itemsSubtotal: entry.subtotal,
        });
      }
    }
    return Array.from(map.values());
  }, [cartDetails, storeById]);

  const getStoreMethods = (store?: StoreProfile): PaymentMethodConfig[] => {
    const list =
      store && store.paymentMethods.length > 0
        ? store.paymentMethods
        : storeConfig.paymentMethods;
    return list.filter((m) => m.enabled);
  };

  const getStoreCheckoutState = (
    storeId: string,
    store?: StoreProfile
  ): PerStoreCheckoutState => {
    const existing = perStoreCheckout[storeId];
    const methods = getStoreMethods(store);
    const defaultPmId = methods[0]?.id ?? 'pm-cash';
    const deliveryAllowed = store ? store.deliveryEnabled : storeConfig.deliveryEnabled;
    if (!existing) {
      return {
        fulfillment: FulfillmentType.Pickup,
        deliveryNote: '',
        paymentMethodId: defaultPmId,
        proofRef: '',
        proofImage: '',
      };
    }
    return {
      ...existing,
      fulfillment:
        !deliveryAllowed && existing.fulfillment === FulfillmentType.Delivery
          ? FulfillmentType.Pickup
          : existing.fulfillment,
      paymentMethodId: methods.some((m) => m.id === existing.paymentMethodId)
        ? existing.paymentMethodId
        : defaultPmId,
    };
  };

  const updateStoreCheckout = (
    storeId: string,
    store: StoreProfile | undefined,
    patch: Partial<PerStoreCheckoutState>
  ) => {
    setPerStoreCheckout((prev) => {
      const current = prev[storeId] ?? getStoreCheckoutState(storeId, store);
      return {
        ...prev,
        [storeId]: { ...current, ...patch },
      };
    });
  };

  const itemsSubtotal = useMemo(
    () => cartDetails.reduce((sum, entry) => sum + entry.subtotal, 0),
    [cartDetails]
  );

  const totalDeliveryFeeApplied = useMemo(() => {
    return storeGroups.reduce((sum, g) => {
      const state = getStoreCheckoutState(g.storeId, g.store);
      const deliveryEnabled = g.store ? g.store.deliveryEnabled : storeConfig.deliveryEnabled;
      const fee = g.store ? g.store.deliveryFee : storeConfig.deliveryFee;
      if (state.fulfillment === FulfillmentType.Delivery && deliveryEnabled) {
        return sum + fee;
      }
      return sum;
    }, 0);
  }, [storeGroups, perStoreCheckout, storeConfig.deliveryEnabled, storeConfig.deliveryFee]);

  const cartTotal = itemsSubtotal + totalDeliveryFeeApplied;

  const myStoreApplications = useMemo(
    () =>
      currentUser
        ? storeApplications.filter((a) => a.applicantId === currentUser.id)
        : [],
    [storeApplications, currentUser]
  );

  const handleGroupFileChange = (
    storeId: string,
    store: StoreProfile | undefined,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setCheckoutError('Please upload a valid receipt photo or screenshot (PNG, JPG, or WebP).');
      return;
    }
    void compressImageFileToDataUrl(file)
      .then((compressed) => {
        if (!isValidUploadedReceipt(compressed)) {
          setCheckoutError('Please upload a valid payment receipt image.');
          return;
        }
        updateStoreCheckout(storeId, store, { proofImage: compressed });
        setCheckoutError('');
      })
      .catch(() => {
        setCheckoutError('Could not process selected image file.');
      });
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      setIsCartOpen(false);
      onOpenSignIn();
      return;
    }
    if (storeGroups.length === 0) return;

    const cleanDept = buyerDepartment.trim();
    const cleanRow = buyerTableRow.trim();
    const cleanTable = buyerTableNumber.trim();
    const composedDeskLocation = [
      cleanDept,
      cleanRow ? `Row ${cleanRow}` : '',
      cleanTable ? `Table ${cleanTable}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    if (!cleanDept || !cleanRow || !cleanTable) {
      setCheckoutError(
        'Enter your Department Name, Table Row, and Table Number so each store knows where to serve your order.'
      );
      return;
    }

    const builtGroups: Array<{
      storeId: string;
      storeName: string;
      fulfillment: FulfillmentType;
      deliveryNote: string;
      paymentMethod: string;
      proofChannel?: string;
      proofRef?: string;
      proofImage?: string;
      items: Array<{ itemId: string; quantity: number }>;
    }> = [];

    for (const group of storeGroups) {
      if (group.store?.subscriptionStatus === 'suspended') {
        setCheckoutError(
          `${group.storeName} is currently suspended. Remove its items before checking out.`
        );
        return;
      }

      const state = getStoreCheckoutState(group.storeId, group.store);
      const methods = getStoreMethods(group.store);
      const activePm =
        methods.find((m) => m.id === state.paymentMethodId) ?? methods[0];
      if (!activePm) {
        setCheckoutError(`No active payment method found for ${group.storeName}.`);
        return;
      }

      const isDigitalWallet = activePm.type === 'digital';
      if (
        state.fulfillment === FulfillmentType.Delivery &&
        !state.deliveryNote.trim() &&
        !composedDeskLocation
      ) {
        setCheckoutError(`Add your desk location for ${group.storeName} delivery.`);
        return;
      }

      if (isDigitalWallet && !isValidUploadedReceipt(state.proofImage)) {
        setCheckoutError(
          `Upload a valid ${activePm.title} payment receipt image for ${group.storeName}.`
        );
        return;
      }

      if (isDigitalWallet && !state.proofRef.trim()) {
        setCheckoutError(
          `Enter the ${activePm.title} reference number for ${group.storeName}.`
        );
        return;
      }

      builtGroups.push({
        storeId: group.storeId,
        storeName: group.storeName,
        fulfillment: state.fulfillment,
        deliveryNote: state.deliveryNote.trim() || composedDeskLocation,
        paymentMethod: activePm.title,
        proofChannel: isDigitalWallet ? activePm.title : undefined,
        proofRef: state.proofRef.trim(),
        proofImage: state.proofImage,
        items: group.items.map((entry) => ({
          itemId: entry.itemId,
          quantity: entry.quantity,
        })),
      });
    }

    if (onPlaceSplitOrder) {
      await onPlaceSplitOrder({
        groups: builtGroups,
        buyerDepartment: cleanDept,
        buyerTableRow: cleanRow,
        buyerTableNumber: cleanTable,
      });
    } else if (builtGroups.length === 1) {
      const single = builtGroups[0];
      onPlaceOrder({
        fulfillment: single.fulfillment,
        deliveryNote: single.deliveryNote,
        paymentMethod: single.paymentMethod,
        proofChannel: single.proofChannel,
        proofRef: single.proofRef,
        proofImage: single.proofImage,
        buyerDepartment: cleanDept,
        buyerTableRow: cleanRow,
        buyerTableNumber: cleanTable,
      });
    }

    setPerStoreCheckout({});
    setCheckoutError('');
    setIsCartOpen(false);
    setOrderBanner(
      builtGroups.length > 1
        ? `Split checkout placed! Created ${builtGroups.length} separate store orders (${builtGroups
            .map((g) => g.storeName)
            .join(', ')}) for independent confirmation.`
        : `Order placed with ${builtGroups[0].storeName} (${builtGroups[0].paymentMethod} · ${
            builtGroups[0].fulfillment === FulfillmentType.Pickup ? 'Pick Up' : 'Delivery'
          }).`
    );
    setTimeout(() => setOrderBanner(''), 6500);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitStoreApplication) return;
    if (!applyStoreName.trim() || !applyDesc.trim()) {
      setApplyError('Provide a store name and description.');
      return;
    }
    setSubmittingApplication(true);
    setApplyError('');
    try {
      await onSubmitStoreApplication({
        storeName: applyStoreName.trim(),
        description: applyDesc.trim(),
        paymentChannels: applyChannels.trim() || 'Cash, GCash, Maya',
      });
      setApplyStoreName('');
      setApplyDesc('');
      setIsApplyModalOpen(false);
      setOrderBanner(
        'Store application submitted! Super Admin will review and provision your store workspace.'
      );
      setTimeout(() => setOrderBanner(''), 6000);
    } catch (err) {
      setApplyError(
        err instanceof Error ? err.message : 'Could not submit store application.'
      );
    } finally {
      setSubmittingApplication(false);
    }
  };

  return (
    <div className="space-y-8">
      {orderBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{orderBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setOrderBanner('')}
            className="text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Highlighted Info Cards: Available SKUs, Next Debt Cut-off, and Debt Balance */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100">
              DeskPantry Marketplace Stores
            </h1>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              Compare prices &amp; stock across coworker stores. Multi-store carts split cleanly per store at checkout.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isGuest ? (
              <button
                type="button"
                onClick={onOpenSignIn}
                className="min-h-[44px] inline-flex items-center justify-center rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800 transition-colors cursor-pointer"
              >
                Sign In to Order
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800 transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  Open Cart ({cart.reduce((s, c) => s + c.quantity, 0)})
                </span>
              </button>
            )}

            {!isGuest && onSubmitStoreApplication && (
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(true)}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-950/50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer"
              >
                <Store className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>Open a Store</span>
              </button>
            )}

            {onOpenSalesOrder && (
              <button
                type="button"
                onClick={onOpenSalesOrder}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#172523] transition-colors cursor-pointer"
              >
                <ClipboardList className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>Sales Order</span>
                {pendingOrdersCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-extrabold inline-flex items-center justify-center tabular-nums">
                    {pendingOrdersCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenQRShare}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#172523] transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>Share QR</span>
            </button>
          </div>
        </div>

        {/* Highlighted 3-Card Top Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/70 dark:bg-teal-950/35 p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                Available Items ({effectiveStores.length}{' '}
                {effectiveStores.length === 1 ? 'Store' : 'Stores'})
              </div>
              <div className="mt-0.5 text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 tabular-nums">
                {isLoading ? 'Loading...' : `${items.filter((i) => i.stock > 0).length} Ready`}
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-400">
                {isLoading ? 'Syncing live multi-store shelf' : 'Pick any store listing'}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 dark:border-sky-800/70 bg-sky-50/70 dark:bg-sky-950/30 p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-sky-800 dark:text-sky-300">
                Next Debt Cut-off
              </div>
              <div className="mt-0.5 text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 tabular-nums">
                {nextDueLabel}
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-400">
                Paydays every {dueDays[0]}th &amp; {dueDays[1]}th
              </div>
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 sm:p-5 flex items-center gap-3.5 ${
              !isGuest && userTotalStoreDebt > 0
                ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/35'
                : 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 ${
                !isGuest && userTotalStoreDebt > 0 ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div
                className={`text-xs font-semibold ${
                  !isGuest && userTotalStoreDebt > 0
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {isGuest ? 'Your Debt Balance' : 'My Total Store Debt'}
              </div>
              <div className="mt-0.5 text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                {isGuest ? 'Sign In' : formatPHP(userTotalStoreDebt, true)}
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-400">
                {isGuest
                  ? 'Sign in to order or pay later'
                  : userTotalStoreDebt > 0
                    ? `Due by ${nextDueLabel}`
                    : 'All stores paid up!'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Controls & Store Filter Strip */}
      <section className="space-y-4">
        {!isGuest && cart.length > 0 && (
          <div className="rounded-2xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/45 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm font-medium text-teal-950 dark:text-teal-100">
              You have <strong>{cart.reduce((s, c) => s + c.quantity, 0)} item(s)</strong> across{' '}
              <strong>
                {storeGroups.length} {storeGroups.length === 1 ? 'store' : 'stores'}
              </strong>{' '}
              (<span className="font-mono font-bold tabular-nums">{formatPHP(itemsSubtotal, true)}</span>).
            </div>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 text-xs sm:text-sm font-bold text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Go to Split Checkout →
            </button>
          </div>
        )}

        {/* Store Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedStoreFilter('All')}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              selectedStoreFilter === 'All'
                ? 'bg-teal-700 text-white'
                : 'bg-white dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#172523]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>All Stores ({items.length})</span>
          </button>
          {effectiveStores.map((st) => {
            const count = items.filter(
              (i) => (i.storeId || DEFAULT_STORE_ID) === st.id
            ).length;
            const suspended = st.subscriptionStatus === 'suspended';
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStoreFilter(st.id)}
                className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedStoreFilter === st.id
                    ? 'bg-teal-700 text-white'
                    : 'bg-white dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#172523]'
                }`}
              >
                <span>{st.name}</span>
                <span className="opacity-75">({count})</span>
                {suspended && (
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                    Suspended
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {categoryList.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-stone-900 dark:bg-teal-600 text-white'
                      : 'bg-white dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-50 dark:hover:bg-[#172523]'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search snacks (e.g. Nova), store name..."
              className="w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] pl-9 pr-3 py-2 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-teal-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`skel-${idx}`}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] w-full bg-stone-200/80 dark:bg-stone-800/80" />
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="h-3 w-28 rounded bg-stone-200 dark:bg-stone-800" />
                  <div className="h-5 w-3/4 rounded bg-stone-200 dark:bg-stone-800" />
                  <div className="h-4 w-full rounded bg-stone-100 dark:bg-stone-800/70" />
                  <div className="pt-2 flex items-center justify-between">
                    <div className="h-6 w-16 rounded bg-stone-200 dark:bg-stone-800" />
                    <div className="h-10 w-24 rounded-xl bg-stone-200 dark:bg-stone-800" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center">
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              No items found.
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Try tapping "All Stores", "All", or clearing your search box.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedStoreFilter('All');
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="mt-4 min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#172523] cursor-pointer"
            >
              Show All Items
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const inCartQty = cart.find((c) => c.itemId === item.id)?.quantity ?? 0;
              const outOfStock = item.stock <= 0;
              const itemStoreId = item.storeId || DEFAULT_STORE_ID;
              const matchedStore = storeById.get(itemStoreId);
              const storeNameLabel =
                item.storeName || matchedStore?.name || DEFAULT_STORE_NAME;
              const isSuspended = matchedStore?.subscriptionStatus === 'suspended';
              const storeMethods = getStoreMethods(matchedStore);
              const supportsDigital = storeMethods.some((m) => m.type === 'digital');
              const supportsCredit = storeMethods.some(
                (m) => m.type === 'debt' || m.title === PaymentMethod.Debt
              );
              const supportsDelivery = matchedStore
                ? matchedStore.deliveryEnabled
                : storeConfig.deliveryEnabled;

              return (
                <article
                  key={item.id}
                  className="group rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div>
                    <div className="aspect-[4/3] w-full bg-stone-100 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 overflow-hidden">
                      <ProductImage
                        src={item.image}
                        alt={item.name}
                        title={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>

                    <div className="p-4 sm:p-5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-[11px] font-bold text-teal-800 dark:text-teal-300">
                          <Store className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[160px]">{storeNameLabel}</span>
                        </span>
                        <span
                          className={`text-xs ${
                            outOfStock
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : item.stock <= 5
                                ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                : 'text-emerald-700 dark:text-emerald-400 font-medium'
                          }`}
                        >
                          {outOfStock ? 'Sold out' : `${item.stock} available`}
                        </span>
                      </div>

                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        {item.category}
                      </div>

                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        {item.name}
                      </h3>
                      <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-2">
                        {item.description}
                      </p>

                      <div className="text-[11px] text-stone-500 dark:text-stone-400 pt-0.5">
                        {supportsCredit ? 'Cash · Credit' : 'Cash'}
                        {supportsDigital ? ' · E-Wallet' : ''} ·{' '}
                        {supportsDelivery ? 'Pick Up / Delivery' : 'Pick Up Only'}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 flex items-center justify-between gap-3">
                    <span className="text-xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                      {formatPHP(item.price)}
                    </span>

                    {isGuest ? (
                      <button
                        type="button"
                        onClick={onOpenSignIn}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-xs font-bold text-stone-700 dark:text-stone-200 hover:bg-teal-50 dark:hover:bg-teal-950/60 hover:text-teal-800 dark:hover:text-teal-300 hover:border-teal-200 dark:hover:border-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Sign in to buy
                      </button>
                    ) : isSuspended ? (
                      <span className="min-h-[40px] px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-bold inline-flex items-center">
                        Store Suspended
                      </span>
                    ) : inCartQty > 0 ? (
                      <div className="flex items-center gap-1.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 p-1">
                        <button
                          type="button"
                          onClick={() => onUpdateCartQty(item.id, -1)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white dark:bg-[#121D1B] text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                          aria-label={`Remove one ${item.name}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="min-w-[28px] text-center text-xs font-extrabold text-teal-900 dark:text-teal-200 tabular-nums">
                          {inCartQty}
                        </span>
                        <button
                          type="button"
                          disabled={inCartQty >= item.stock}
                          onClick={() => onUpdateCartQty(item.id, 1)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white dark:bg-[#121D1B] text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
                          aria-label={`Add one more ${item.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => onAddToCart(item.id)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-xs sm:text-sm font-bold text-white hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{outOfStock ? 'Sold Out' : 'Add'}</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Split Multi-Store Checkout Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-[#121D1B] h-full flex flex-col border-l border-stone-200 dark:border-stone-800 shadow-2xl">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {storeGroups.length > 1 ? 'Split Multi-Store Checkout' : 'Your Pantry Cart'}
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {cartDetails.length} item line(s) across {storeGroups.length}{' '}
                  {storeGroups.length === 1 ? 'store' : 'stores'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                aria-label="Close cart"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {cartDetails.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingBag className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto" />
                  <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Your cart is empty
                  </p>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    Add items from any DeskPantry store to begin checkout.
                  </p>
                </div>
              ) : (
                <form id="checkout-form" onSubmit={(e) => void handleCheckoutSubmit(e)} className="space-y-5">
                  {storeGroups.length > 1 && (
                    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/35 px-4 py-3 text-xs text-teal-900 dark:text-teal-200">
                      Your cart spans <strong>{storeGroups.length} stores</strong>. Submitting splits this cleanly into <strong>{storeGroups.length} separate orders</strong> so each store owner confirms &amp; tracks payments independently.
                    </div>
                  )}

                  {/* Shared Purchaser Workstation Details */}
                  <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-700 dark:text-stone-200">
                        Purchaser Department &amp; Desk Info
                      </span>
                      <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                        Auto-filled from profile
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        maxLength={120}
                        value={buyerDepartment}
                        onChange={(e) => setBuyerDepartment(e.target.value)}
                        placeholder="Department Name"
                        aria-label="Purchaser Department Name"
                        className="sm:col-span-3 min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                      />
                      <input
                        type="text"
                        maxLength={40}
                        value={buyerTableRow}
                        onChange={(e) => setBuyerTableRow(e.target.value)}
                        placeholder="Table Row (e.g. B)"
                        aria-label="Table Row"
                        className="sm:col-span-1 min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                      />
                      <input
                        type="text"
                        maxLength={40}
                        value={buyerTableNumber}
                        onChange={(e) => setBuyerTableNumber(e.target.value)}
                        placeholder="Table No. (e.g. T-14)"
                        aria-label="Table Number"
                        className="sm:col-span-2 min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Store Group Cards */}
                  {storeGroups.map((group, groupIdx) => {
                    const state = getStoreCheckoutState(group.storeId, group.store);
                    const methods = getStoreMethods(group.store);
                    const activePm =
                      methods.find((m) => m.id === state.paymentMethodId) ?? methods[0];
                    const deliveryEnabled = group.store
                      ? group.store.deliveryEnabled
                      : storeConfig.deliveryEnabled;
                    const deliveryFee = group.store
                      ? group.store.deliveryFee
                      : storeConfig.deliveryFee;
                    const appliedDeliveryFee =
                      state.fulfillment === FulfillmentType.Delivery && deliveryEnabled
                        ? deliveryFee
                        : 0;
                    const groupTotal = group.itemsSubtotal + appliedDeliveryFee;
                    const groupDueLabel = group.store?.dueDays
                      ? getNextDueDateLabel(group.store.dueDays)
                      : nextDueLabel;
                    const isDigitalWallet = activePm?.type === 'digital';
                    const isDebtPayment =
                      activePm?.type === 'debt' || activePm?.title === PaymentMethod.Debt;

                    return (
                      <div
                        key={group.storeId}
                        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#172523] p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-200 dark:border-stone-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-md bg-teal-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {groupIdx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                                {group.storeName}
                              </div>
                              <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                {group.items.length} SKU(s) · Cutoff {groupDueLabel}
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono font-bold text-sm text-teal-700 dark:text-teal-400 tabular-nums shrink-0">
                            {formatPHP(groupTotal, true)}
                          </div>
                        </div>

                        {/* Items in this Store */}
                        <div className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
                          {group.items.map(({ product, quantity, subtotal }) => (
                            <div
                              key={product.id}
                              className="p-3 bg-stone-50/70 dark:bg-[#121D1B] flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                                  {product.name}
                                </div>
                                <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                                  {formatPHP(product.price)} each
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="flex items-center gap-1 border border-stone-200 dark:border-stone-700 rounded-lg p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => onUpdateCartQty(product.id, -1)}
                                    className="w-7 h-7 flex items-center justify-center rounded-md text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-5 text-center text-xs font-bold tabular-nums">
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={quantity >= product.stock}
                                    onClick={() => onUpdateCartQty(product.id, 1)}
                                    className="w-7 h-7 flex items-center justify-center rounded-md text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="w-14 text-right text-xs font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                                  {formatPHP(subtotal)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Fulfillment for this Store */}
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                            Fulfillment for {group.storeName}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[FulfillmentType.Pickup, FulfillmentType.Delivery].map((type) => {
                              const disabled =
                                type === FulfillmentType.Delivery && !deliveryEnabled;
                              return (
                                <button
                                  key={type}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() =>
                                    updateStoreCheckout(group.storeId, group.store, {
                                      fulfillment: type,
                                    })
                                  }
                                  className={`min-h-[40px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                                    state.fulfillment === type
                                      ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] text-stone-600 dark:text-stone-300'
                                  }`}
                                >
                                  {type === FulfillmentType.Pickup
                                    ? 'Pick Up'
                                    : deliveryEnabled
                                      ? deliveryFee > 0
                                        ? `Deliver (+${formatPHP(deliveryFee)})`
                                        : 'Deliver (Free)'
                                      : 'Pick Up Only'}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {state.fulfillment === FulfillmentType.Delivery && (
                          <input
                            type="text"
                            value={state.deliveryNote}
                            onChange={(e) =>
                              updateStoreCheckout(group.storeId, group.store, {
                                deliveryNote: e.target.value,
                              })
                            }
                            placeholder="Optional delivery landmark (e.g. Near pantry door)"
                            className="w-full min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                          />
                        )}

                        {/* Payment Method for this Store */}
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                            Payment Method ({group.storeName})
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {methods.map((method) => (
                              <button
                                key={method.id}
                                type="button"
                                onClick={() => {
                                  updateStoreCheckout(group.storeId, group.store, {
                                    paymentMethodId: method.id,
                                  });
                                  setCheckoutError('');
                                }}
                                className={`min-h-[40px] rounded-xl border px-3 py-1.5 text-xs font-semibold text-left flex items-center gap-2 transition-colors cursor-pointer ${
                                  activePm?.id === method.id
                                    ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] text-stone-600 dark:text-stone-300'
                                }`}
                              >
                                {method.iconImage && (
                                  <img
                                    src={method.iconImage}
                                    alt={method.title}
                                    className="w-4 h-4 rounded object-cover shrink-0"
                                  />
                                )}
                                <span className="truncate">{method.title}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {isDebtPayment && (
                          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#121D1B] p-3 text-xs text-stone-600 dark:text-stone-300">
                            Added to your <strong>{group.storeName}</strong> store credit ledger, due{' '}
                            <strong className="text-stone-900 dark:text-stone-100">
                              {groupDueLabel}
                            </strong>
                            .
                          </div>
                        )}

                        {isDigitalWallet && activePm && (
                          <div className="space-y-3">
                            <PaymentMethodCard method={activePm} amount={groupTotal} />
                            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#121D1B] p-3.5 space-y-2.5">
                              <input
                                type="text"
                                value={state.proofRef}
                                onChange={(e) =>
                                  updateStoreCheckout(group.storeId, group.store, {
                                    proofRef: e.target.value,
                                  })
                                }
                                placeholder={`${activePm.title} Reference No.`}
                                className="w-full min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-1.5 text-xs font-mono text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                              />
                              <label className="min-h-[38px] inline-flex items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer">
                                <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                                <span>Upload {activePm.title} Receipt</span>
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/*"
                                  onChange={(e) =>
                                    handleGroupFileChange(group.storeId, group.store, e)
                                  }
                                  className="hidden"
                                />
                              </label>
                              {state.proofImage && (
                                <div className="flex items-center gap-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] p-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewImage({
                                        src: state.proofImage,
                                        title: `${group.storeName} · ${activePm.title} Receipt`,
                                        subtitle: state.proofRef.trim()
                                          ? `Ref: ${state.proofRef.trim()}`
                                          : 'Uploaded receipt preview',
                                      })
                                    }
                                    className="rounded-md overflow-hidden border border-stone-200 dark:border-stone-700 cursor-pointer shrink-0"
                                    title="Click to preview receipt image"
                                  >
                                    <img
                                      src={state.proofImage}
                                      alt="Uploaded payment proof preview"
                                      className="w-12 h-12 object-cover"
                                    />
                                  </button>
                                  <div className="flex-1 min-w-0 text-xs text-stone-500 dark:text-stone-400">
                                    Receipt attached · Click to preview
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateStoreCheckout(group.storeId, group.store, {
                                        proofImage: '',
                                      })
                                    }
                                    className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                                    aria-label="Remove proof image"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {checkoutError && (
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      {checkoutError}
                    </p>
                  )}
                </form>
              )}
            </div>

            {cartDetails.length > 0 && (
              <div className="p-6 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#0F1917] space-y-3">
                {totalDeliveryFeeApplied > 0 && (
                  <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                    <span>Items + Store Delivery Runner Fees</span>
                    <span className="font-mono tabular-nums">
                      {formatPHP(itemsSubtotal)} + {formatPHP(totalDeliveryFeeApplied)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600 dark:text-stone-300">
                    Total Across {storeGroups.length}{' '}
                    {storeGroups.length === 1 ? 'Store' : 'Stores'}
                  </span>
                  <span className="text-xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                    {formatPHP(cartTotal, true)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-4 py-2.5 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    form="checkout-form"
                    className="flex-1 min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer"
                  >
                    {isGuest
                      ? 'Sign In to Checkout'
                      : storeGroups.length > 1
                        ? `Confirm & Split Into ${storeGroups.length} Store Orders`
                        : 'Place Store Order'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Open a Store Application Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl space-y-4 my-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Apply to Open Your Own Store
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Base Store Monthly Subscription Fee:{' '}
                  <strong className="text-teal-700 dark:text-teal-400 font-mono">
                    {formatPHP(platformConfig?.baseStoreMonthlyFee ?? 499)}/month
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {myStoreApplications.length > 0 && (
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3 space-y-1.5">
                <div className="text-xs font-bold text-stone-700 dark:text-stone-200">
                  Your Store Applications
                </div>
                {myStoreApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold text-stone-800 dark:text-stone-100 truncate">
                      {app.storeName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                        app.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : app.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => void handleApplySubmit(e)} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Store Name
                </label>
                <input
                  type="text"
                  required
                  value={applyStoreName}
                  onChange={(e) => setApplyStoreName(e.target.value)}
                  placeholder="e.g. Ops Floor Mini-Mart"
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  What will your store sell?
                </label>
                <textarea
                  rows={2}
                  required
                  value={applyDesc}
                  onChange={(e) => setApplyDesc(e.target.value)}
                  placeholder="e.g. Snacks, brewed coffee, instant meals, and cold drinks"
                  className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] p-3 text-sm text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Preferred Payment Channels
                </label>
                <input
                  type="text"
                  value={applyChannels}
                  onChange={(e) => setApplyChannels(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm text-stone-900 dark:text-stone-100"
                />
              </div>
              {applyError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {applyError}
                </p>
              )}
              <button
                type="submit"
                disabled={submittingApplication}
                className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
              >
                {submittingApplication ? 'Submitting...' : 'Submit Store Application'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ImagePreviewModal
        preview={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};
