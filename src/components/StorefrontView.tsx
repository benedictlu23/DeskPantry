import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Minus,
  PackageCheck,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { SAMPLE_RECEIPT_DATA_URL } from '../data/seedData';
import {
  CartItem,
  FulfillmentType,
  PaymentMethod,
  StoreConfig,
  StoreItem,
  UserAccount,
  UserRole,
} from '../types';
import { formatPHP } from '../utils/format';
import { PaymentMethodCard } from './PaymentMethodCard';
import { ProductImage } from './ProductImage';

interface StorefrontViewProps {
  items: StoreItem[];
  cart: CartItem[];
  currentUser: UserAccount | null;
  currentRole: UserRole;
  dueDays: [number, number];
  nextDueLabel: string;
  storeConfig: StoreConfig;
  onAddToCart: (itemId: string) => void;
  onUpdateCartQty: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  onOpenSignIn: () => void;
  onOpenQRShare: () => void;
  onPlaceOrder: (payload: {
    fulfillment: FulfillmentType;
    deliveryNote: string;
    paymentMethod: string;
    proofChannel?: string;
    proofRef?: string;
    proofImage?: string;
  }) => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  items,
  cart,
  currentUser,
  currentRole,
  dueDays,
  nextDueLabel,
  storeConfig,
  onAddToCart,
  onUpdateCartQty,
  onClearCart,
  onOpenSignIn,
  onOpenQRShare,
  onPlaceOrder,
  isCartOpen,
  setIsCartOpen,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [fulfillment, setFulfillment] = useState<FulfillmentType>(FulfillmentType.Pickup);
  const [deliveryNote, setDeliveryNote] = useState('');

  const enabledMethods = useMemo(
    () => storeConfig.paymentMethods.filter((m) => m.enabled),
    [storeConfig.paymentMethods]
  );

  const [selectedPaymentId, setSelectedPaymentId] = useState<string>(
    enabledMethods[0]?.id ?? 'pm-cash'
  );
  const [proofRef, setProofRef] = useState('');
  const [proofImage, setProofImage] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState('');
  const [orderBanner, setOrderBanner] = useState('');

  const isGuest = currentRole === UserRole.Guest || !currentUser;
  const categoryList = useMemo(
    () => ['All', ...storeConfig.categories],
    [storeConfig.categories]
  );

  const activePaymentMethod =
    enabledMethods.find((m) => m.id === selectedPaymentId) ?? enabledMethods[0];

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchCategory && matchQuery;
    });
  }, [items, selectedCategory, searchQuery]);

  const cartDetails = useMemo(() => {
    return cart
      .map((c) => {
        const product = items.find((i) => i.id === c.itemId);
        if (!product) return null;
        return { ...c, product, subtotal: product.price * c.quantity };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [cart, items]);

  const itemsSubtotal = useMemo(
    () => cartDetails.reduce((sum, entry) => sum + entry.subtotal, 0),
    [cartDetails]
  );
  const deliveryFeeApplied =
    fulfillment === FulfillmentType.Delivery && storeConfig.deliveryEnabled
      ? storeConfig.deliveryFee
      : 0;
  const cartTotal = itemsSubtotal + deliveryFeeApplied;

  const isDigitalWallet = activePaymentMethod?.type === 'digital';
  const isDebtPayment =
    activePaymentMethod?.type === 'debt' ||
    activePaymentMethod?.title === PaymentMethod.Debt;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofImage(reader.result);
        setCheckoutError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      setIsCartOpen(false);
      onOpenSignIn();
      return;
    }
    if (cartDetails.length === 0 || !activePaymentMethod) return;

    if (fulfillment === FulfillmentType.Delivery && !deliveryNote.trim()) {
      setCheckoutError('Add your desk location or floor for office delivery.');
      return;
    }

    if (isDigitalWallet && !proofImage) {
      setCheckoutError(
        `Upload your ${activePaymentMethod.title} payment screenshot for Admin confirmation.`
      );
      return;
    }

    if (isDigitalWallet && !proofRef.trim()) {
      setCheckoutError(`Enter the ${activePaymentMethod.title} reference number.`);
      return;
    }

    onPlaceOrder({
      fulfillment,
      deliveryNote: deliveryNote.trim(),
      paymentMethod: activePaymentMethod.title,
      proofChannel: isDigitalWallet ? activePaymentMethod.title : undefined,
      proofRef: proofRef.trim(),
      proofImage,
    });

    setProofRef('');
    setProofImage('');
    setDeliveryNote('');
    setCheckoutError('');
    setIsCartOpen(false);
    setOrderBanner(
      isDigitalWallet
        ? `Order placed with ${activePaymentMethod.title}. Your proof of payment is queued for Admin confirmation.`
        : `Order confirmed via ${activePaymentMethod.title} (${fulfillment}).`
    );
    setTimeout(() => setOrderBanner(''), 5500);
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
              Order Snacks &amp; Drinks
            </h1>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              Tap <strong className="text-stone-900 dark:text-stone-100">+ Add</strong> on what you want, then open your Cart to pick up or deliver to your desk.
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
          {/* Card 1: Available SKUs */}
          <div className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/70 dark:bg-teal-950/35 p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                Available Items (SKUs)
              </div>
              <div className="mt-0.5 text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 tabular-nums">
                {items.filter((i) => i.stock > 0).length} Ready
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-400">
                In stock on the shelf today
              </div>
            </div>
          </div>

          {/* Card 2: Next Debt Cut-off */}
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

          {/* Card 3: My Debt Balance */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 flex items-center gap-3.5 ${
              !isGuest && currentUser.debtBalance > 0
                ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/35'
                : 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 ${
                !isGuest && currentUser.debtBalance > 0 ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div
                className={`text-xs font-semibold ${
                  !isGuest && currentUser.debtBalance > 0
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {isGuest ? 'Your Debt Balance' : 'My Debt Balance'}
              </div>
              <div className="mt-0.5 text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                {isGuest ? 'Sign In' : formatPHP(currentUser.debtBalance, true)}
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-400">
                {isGuest
                  ? 'Sign in to order or pay later'
                  : currentUser.debtBalance > 0
                    ? `Due by ${nextDueLabel}`
                    : 'All paid up!'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Controls & Simple Grid */}
      <section className="space-y-5">
        {!isGuest && cart.length > 0 && (
          <div className="rounded-2xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/45 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm font-medium text-teal-950 dark:text-teal-100">
              You have <strong>{cart.reduce((s, c) => s + c.quantity, 0)} item(s)</strong> in your cart (
              <span className="font-mono font-bold tabular-nums">{formatPHP(itemsSubtotal, true)}</span>). Ready to finish your order?
            </div>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 text-xs sm:text-sm font-bold text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Go to Checkout →
            </button>
          </div>
        )}

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
              placeholder="Search snacks, drinks, noodles..."
              className="w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] pl-9 pr-3 py-2 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-teal-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Product Grid */}
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center">
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              No items found.
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Try tapping "All" or clearing your search box.
            </p>
            <button
              type="button"
              onClick={() => {
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

                    <div className="p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <span>{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            outOfStock
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : item.stock <= 5
                                ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                : 'text-emerald-700 dark:text-emerald-400 font-medium'
                          }
                        >
                          {outOfStock ? 'Sold out' : `${item.stock} available`}
                        </span>
                      </div>

                      <h3 className="mt-1.5 text-base font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 line-clamp-2">
                        {item.description}
                      </p>
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

      {/* Checkout Drawer / Bottom Sheet */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-[#121D1B] h-full flex flex-col border-l border-stone-200 dark:border-stone-800 shadow-2xl">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Your Pantry Cart
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {cartDetails.length} line item(s) · Cutoff {dueDays[0]}th &amp; {dueDays[1]}th
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

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cartDetails.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingBag className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto" />
                  <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Your cart is empty
                  </p>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    Add snacks, drinks, or meals from the DeskPantry shelf.
                  </p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
                    {cartDetails.map(({ product, quantity, subtotal }) => (
                      <div
                        key={product.id}
                        className="p-3.5 bg-white dark:bg-[#172523] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                            {formatPHP(product.price)} each
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1 border border-stone-200 dark:border-stone-700 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => onUpdateCartQty(product.id, -1)}
                              className="w-8 h-8 flex items-center justify-center rounded-md text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold tabular-nums">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              disabled={quantity >= product.stock}
                              onClick={() => onUpdateCartQty(product.id, 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-md text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="w-16 text-right text-sm font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                            {formatPHP(subtotal)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                        1. How will you get your order?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[FulfillmentType.Pickup, FulfillmentType.Delivery].map((type) => {
                          const disabled =
                            type === FulfillmentType.Delivery && !storeConfig.deliveryEnabled;
                          return (
                            <button
                              key={type}
                              type="button"
                              disabled={disabled}
                              onClick={() => setFulfillment(type)}
                              className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                                fulfillment === type
                                  ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                                  : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#1F312E]'
                              }`}
                            >
                              {type === FulfillmentType.Pickup
                                ? 'Pick Up at Counter B'
                                : storeConfig.deliveryEnabled
                                  ? storeConfig.deliveryFee > 0
                                    ? `Deliver to Desk (+${formatPHP(storeConfig.deliveryFee)})`
                                    : 'Deliver to Desk (Free)'
                                  : 'Delivery Disabled'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {fulfillment === FulfillmentType.Delivery && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                          Where is your desk?
                        </label>
                        <input
                          type="text"
                          value={deliveryNote}
                          onChange={(e) => setDeliveryNote(e.target.value)}
                          placeholder="e.g. 4th Floor · Desk 08"
                          className="w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                        />
                        {storeConfig.deliveryFee > 0 && (
                          <p className="text-[11px] text-teal-700 dark:text-teal-400">
                            {formatPHP(storeConfig.deliveryFee)} delivery fee goes 100% to our delivery runner.
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                        2. How will you pay?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {enabledMethods.map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              setSelectedPaymentId(method.id);
                              setCheckoutError('');
                            }}
                            className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold text-left flex items-center gap-2 transition-colors cursor-pointer ${
                              activePaymentMethod?.id === method.id
                                ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                                : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#1F312E]'
                            }`}
                          >
                            {method.iconImage && (
                              <img
                                src={method.iconImage}
                                alt={method.title}
                                className="w-5 h-5 rounded-md object-cover shrink-0"
                              />
                            )}
                            <span className="truncate">{method.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {isDebtPayment && (
                      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5 text-xs text-stone-600 dark:text-stone-300">
                        This order will be added to your Store Credit balance, due on{' '}
                        <strong className="text-stone-900 dark:text-stone-100">{nextDueLabel}</strong>.
                      </div>
                    )}

                    {isDigitalWallet && activePaymentMethod && (
                      <div className="space-y-3">
                        <PaymentMethodCard method={activePaymentMethod} amount={cartTotal} />

                        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-4 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                              {activePaymentMethod.title} Reference No.
                            </label>
                            <input
                              type="text"
                              value={proofRef}
                              onChange={(e) => setProofRef(e.target.value)}
                              placeholder="e.g. GC-904821735"
                              className="w-full min-h-[40px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] px-3 py-2 text-xs font-mono text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <label className="min-h-[40px] inline-flex items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer">
                              <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                              <span>Upload Receipt Image</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setProofImage(SAMPLE_RECEIPT_DATA_URL);
                                if (!proofRef) {
                                  setProofRef(
                                    `${activePaymentMethod.title.slice(0, 2).toUpperCase()}-8849102`
                                  );
                                }
                                setCheckoutError('');
                              }}
                              className="min-h-[40px] rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-[#111B19] px-3 py-2 text-xs font-medium text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer"
                            >
                              Attach Sample Receipt
                            </button>
                          </div>

                          {proofImage && (
                            <div className="flex items-center gap-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] p-2">
                              <img
                                src={proofImage}
                                alt="Uploaded payment proof preview"
                                className="w-14 h-14 object-cover rounded-md border border-stone-200 dark:border-stone-700"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                                  Proof attached
                                </div>
                                <div className="text-xs text-stone-500 dark:text-stone-400">
                                  Pending manual Admin confirmation
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setProofImage('')}
                                className="p-2 text-stone-400 hover:text-red-600 cursor-pointer"
                                aria-label="Remove proof image"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {checkoutError && (
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">
                        {checkoutError}
                      </p>
                    )}
                  </form>
                </>
              )}
            </div>

            {cartDetails.length > 0 && (
              <div className="p-6 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#0F1917] space-y-3">
                {deliveryFeeApplied > 0 && (
                  <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                    <span>Items + Delivery Runner Fee</span>
                    <span className="font-mono tabular-nums">
                      {formatPHP(itemsSubtotal)} + {formatPHP(deliveryFeeApplied)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600 dark:text-stone-300">Total Amount</span>
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
                      : isDigitalWallet && activePaymentMethod
                        ? `Submit ${activePaymentMethod.title} Order & Proof`
                        : `Confirm ${activePaymentMethod?.title ?? 'Order'}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
