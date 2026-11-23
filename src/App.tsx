import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  ChevronDown,
  ClipboardList,
  Eye,
  Grid,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { AdminConsoleView } from './components/AdminConsoleView';
import { ChatHubView } from './components/ChatHubView';
import { CommunityFeedView } from './components/CommunityFeedView';
import { DeliveryStaffView } from './components/DeliveryStaffView';
import { EWalletExchangeView } from './components/EWalletExchangeView';
import { GeminiChatbotDrawer } from './components/GeminiChatbotDrawer';
import { LedgerDashboardView } from './components/LedgerDashboardView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OtherAppsView } from './components/OtherAppsView';
import { PautanganView } from './components/PautanganView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { QRShareModal } from './components/QRShareModal';
import { SellerDashboardView } from './components/SellerDashboardView';
import { SignInModal } from './components/SignInModal';
import { StorefrontView } from './components/StorefrontView';
import {
  INITIAL_PAUTANGAN_SETTINGS,
  INITIAL_STORE_CONFIG,
  OWNER_BASE_COMMISSION_EARNED,
} from './data/seedData';
import { auth } from './firebase';
import {
  addChatMessageToThread,
  approveSellerProofAndSettleOrders,
  createNotificationDoc,
  getSellerConfigById,
  markMarketplaceOrderDebtSettled,
  markNotificationReadDoc,
  markThreadUnreadCount,
  recordStockAdjustment,
  removeMarketplaceListing,
  removeStoreItem,
  saveEWalletPost,
  saveLoanRecord,
  saveMarketplaceListing,
  saveOrder,
  savePautanganSettings,
  savePaymentProof,
  saveSellerConfig,
  saveStoreConfig,
  saveStoreItem,
  saveSuggestion,
  saveUserAccount,
  seedInitialFirestoreDataIfEmpty,
  subscribeAuthenticatedData,
  subscribePublicStoreData,
  syncAllFirestoreDataNow,
  syncOwnerCommissionToStoreConfig,
  toggleInternalAppInstalled,
  updateEWalletPostPartial,
  updateMarketplaceListingStock,
  updateMarketplaceOrderConfirmation,
  updateOrderDeliveryFields,
  updateSellerListingConfig,
  updateStoreItemStock,
  updateSuggestionVotes,
  updateUserCheckoutTotals,
  upsertUserOnAuth,
} from './services/firestoreSync';
import {
  ActiveSection,
  CartItem,
  ChatThread,
  CommissionType,
  EWalletPost,
  FulfillmentType,
  InternalApp,
  LoanRecord,
  MarketplaceListing,
  NotificationItem,
  PautanganSettings,
  PaymentMethod,
  PaymentProof,
  SellerConfig,
  StockAdjustmentLog,
  StoreConfig,
  StoreItem,
  StoreOrder,
  SuggestionItem,
  UserAccount,
  UserRole,
} from './types';
import {
  buildLoanInstallments,
  computeCommission,
  formatPHP,
  getNextDueDateLabel,
  getOrderItemsSubtotal,
  getOrderRemainingDebt,
  isApprovedDeliveryOrder,
  isOrderPendingAdminConfirmation,
  isOrderPendingSellerConfirmation,
} from './utils/format';

const DARK_MODE_STORAGE_KEY = 'deskpantry_dark_mode';

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(DARK_MODE_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(getInitialDarkMode);
  const [authUser, setAuthUser] = useState<UserAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [isStoreLoading, setIsStoreLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [ewalletPosts, setEWalletPosts] = useState<EWalletPost[]>([]);
  const [pautanganSettings, setPautanganSettings] = useState<PautanganSettings>(
    INITIAL_PAUTANGAN_SETTINGS
  );
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(INITIAL_STORE_CONFIG);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentLog[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [localReadNotifIds, setLocalReadNotifIds] = useState<Record<string, boolean>>({});
  const [otherApps, setOtherApps] = useState<InternalApp[]>([]);
  const [sellerConfig, setSellerConfig] = useState<SellerConfig | null>(null);
  const [openCommunitySellSignal, setOpenCommunitySellSignal] = useState(0);
  const [unreadCommunityCount, setUnreadCommunityCount] = useState(0);
  const [lastFeedEvent, setLastFeedEvent] = useState(
    'Live coworker suggestions & approved for-sale drops sync automatically once signed in.'
  );

  const [activeSection, setActiveSection] = useState<ActiveSection>('store');
  const [requestedAdminSubTab, setRequestedAdminSubTab] = useState<{
    tab:
      | 'items'
      | 'restock'
      | 'stockAdjustments'
      | 'salesOrder'
      | 'config'
      | 'pautangan'
      | 'superadmin'
      | 'proofs'
      | 'marketplace'
      | 'reports';
    nonce: number;
  } | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const dueDaysRef = useRef<[number, number]>(pautanganSettings.dueDays);
  useEffect(() => {
    dueDaysRef.current = pautanganSettings.dueDays;
  }, [pautanganSettings.dueDays]);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkMode));
    } catch {
      // Ignore storage quota errors
    }
  }, [darkMode]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [authUser?.avatarUrl]);

  // Restore per-user read state for broadcast/role notifications
  useEffect(() => {
    if (!authUser?.id) {
      setLocalReadNotifIds({});
      return;
    }
    try {
      const saved = window.localStorage.getItem(`deskpantry_read_notifs_${authUser.id}`);
      setLocalReadNotifIds(saved ? (JSON.parse(saved) as Record<string, boolean>) : {});
    } catch {
      setLocalReadNotifIds({});
    }
  }, [authUser?.id]);

  // Public storefront catalog & store config live subscription (visible to Guests & signed-in users)
  useEffect(() => {
    const unsubPublic = subscribePublicStoreData({
      onItems: (nextItems) => {
        setItems(nextItems);
        setIsStoreLoading(false);
      },
      onStoreConfig: (nextCfg) => {
        const { dueDays: syncedDueDays, ...rest } = nextCfg;
        setStoreConfig(rest);
        if (Array.isArray(syncedDueDays) && syncedDueDays.length === 2) {
          dueDaysRef.current = [Number(syncedDueDays[0]), Number(syncedDueDays[1])];
          setPautanganSettings((prev) => ({
            ...prev,
            dueDays: [Number(syncedDueDays[0]), Number(syncedDueDays[1])],
          }));
        }
      },
    });
    return () => unsubPublic();
  }, []);

  // Firebase Auth listener: automatically persists Gmail avatar & profile on sign-in
  useEffect(() => {
    let active = true;
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        if (!active) return;
        setAuthUser(null);
        setAuthReady(true);
        setPreviewRole(null);
        setUsers([]);
        setCart([]);
        setOrders([]);
        setProofs([]);
        setSuggestions([]);
        setListings([]);
        setEWalletPosts([]);
        setLoans([]);
        setStockAdjustments([]);
        setThreads([]);
        setNotifications([]);
        setSellerConfig(null);
        setLocalReadNotifIds({});
        return;
      }

      void (async () => {
        try {
          const account = await upsertUserOnAuth(firebaseUser);
          if (!active) return;
          setAuthUser(account);
          setUsers((prev) => (prev.length === 0 ? [account] : prev));
          setAuthReady(true);

          if (account.role === UserRole.Admin || account.role === UserRole.SuperAdmin) {
            void seedInitialFirestoreDataIfEmpty(account.email);
          }
        } catch (err) {
          console.error('Failed to sync signed-in user profile:', err);
          if (active) setAuthReady(true);
        }
      })();
    });

    return () => {
      active = false;
      unsubAuth();
    };
  }, []);

  // Authenticated Firestore real-time subscriptions keyed by verified UID, role & Pautangan permission
  useEffect(() => {
    if (!authUser) return;

    const unsubData = subscribeAuthenticatedData(
      {
        uid: authUser.id,
        role: authUser.role,
        pautanganEnabled: authUser.pautanganEnabled,
      },
      {
        onCurrentUser: (updated) => {
          setAuthUser(updated);
          setUsers((prev) => {
            const exists = prev.some((u) => u.id === updated.id);
            if (!exists) return [updated, ...prev];
            return prev.map((u) => (u.id === updated.id ? updated : u));
          });
        },
        onUsers: (allUsers) => {
          setUsers(allUsers);
        },
        onCoworkerProfiles: () => {
          // Available for coworker directory enrichment if needed
        },
        onOrders: (nextOrders) => {
          setOrders(nextOrders);
        },
        onProofs: (nextProofs) => {
          setProofs(nextProofs);
        },
        onSuggestions: (nextSuggestions) => {
          setSuggestions(nextSuggestions);
        },
        onListings: (nextListings) => {
          setListings(nextListings);
        },
        onEWalletPosts: (nextPosts) => {
          setEWalletPosts(nextPosts);
        },
        onPautanganSettings: (nextSettings) => {
          dueDaysRef.current = nextSettings.dueDays;
          setPautanganSettings(nextSettings);
        },
        onLoans: (nextLoans) => {
          setLoans(nextLoans);
        },
        onNotifications: (nextNotifs) => {
          setNotifications(nextNotifs);
        },
        onInternalApps: (nextApps) => {
          setOtherApps(nextApps);
        },
        onChatThreads: (nextThreads) => {
          setThreads(nextThreads);
        },
        onStockAdjustments: (nextLogs) => {
          setStockAdjustments(nextLogs);
        },
        onSellerConfig: (nextSellerCfg) => {
          setSellerConfig(nextSellerCfg);
        },
      }
    );

    return () => unsubData();
  }, [authUser?.id, authUser?.role, authUser?.pautanganEnabled]);

  const actualRole = authUser ? authUser.role : UserRole.Guest;
  const isActualSuperAdmin = actualRole === UserRole.SuperAdmin;
  const isActualAdmin =
    actualRole === UserRole.Admin || actualRole === UserRole.SuperAdmin;

  const currentRole: UserRole =
    isActualSuperAdmin && previewRole !== null ? previewRole : actualRole;

  const currentUser: UserAccount | null =
    currentRole === UserRole.Guest ? null : authUser;

  const isPreviewingOtherRole =
    isActualSuperAdmin && previewRole !== null && previewRole !== UserRole.SuperAdmin;

  const isAdminOrSuper =
    currentRole === UserRole.Admin || currentRole === UserRole.SuperAdmin;
  const canViewDeliveryNav =
    currentRole === UserRole.DeliveryStaff || isAdminOrSuper;
  const canViewPautanganNav = Boolean(
    currentUser &&
      currentUser.pautanganEnabled &&
      (pautanganSettings.globalEnabled || currentRole === UserRole.SuperAdmin)
  );

  // Guard restricted views and close notification drawer when signed out / guest
  useEffect(() => {
    if (!currentUser || currentRole === UserRole.Guest) {
      setIsNotifOpen(false);
      setIsProfileMenuOpen(false);
    }
    if (activeSection === 'admin' && !isAdminOrSuper) {
      setActiveSection('store');
    }
    if (activeSection === 'delivery' && !canViewDeliveryNav) {
      setActiveSection('store');
    }
    if (activeSection === 'pautangan' && !canViewPautanganNav) {
      setActiveSection('store');
    }
  }, [currentUser, currentRole, activeSection, isAdminOrSuper, canViewDeliveryNav, canViewPautanganNav]);

  const nextDueLabel = useMemo(
    () => getNextDueDateLabel(pautanganSettings.dueDays),
    [pautanganSettings.dueDays]
  );

  const ownerCommissionEarned = useMemo(
    () =>
      OWNER_BASE_COMMISSION_EARNED +
      orders.reduce((sum, o) => sum + (o.commissionEarned ?? 0), 0),
    [orders]
  );

  const effectiveNotifications = useMemo(() => {
    if (!currentUser || currentRole === UserRole.Guest) {
      return [];
    }

    const resolveEffectiveTarget = (n: NotificationItem): string => {
      const rawTarget = n.targetUserId ?? 'all';
      if (rawTarget !== 'all') return rawTarget;
      const t = n.title.toLowerCase();
      if (
        t.includes('marketplace listing pending') ||
        t.includes('for-sale submission') ||
        t.includes('for-sale listing pending')
      ) {
        return 'super_admin';
      }
      if (t.includes('payment proof') || t.includes('due-date reminder sent')) {
        return 'admins';
      }
      if (t.includes('delivery queue') || t.includes('new delivery order')) {
        return 'delivery';
      }
      return 'all';
    };

    const orderProofRefs = new Set(
      proofs
        .filter((p) => p.purpose === 'Order Payment')
        .map((p) => p.referenceNo.toLowerCase())
    );

    const isAllowedCustomerNotification = (n: NotificationItem): boolean => {
      const titleLower = n.title.toLowerCase();
      const bodyLower = n.body.toLowerCase();

      // 1. Payments reminder
      if (n.type === 'reminder') return true;

      // 2. Comments on their Buy/Sell E-Wallet post
      if (n.type === 'ewallet') {
        return titleLower.includes('comment') || bodyLower.includes('commented');
      }

      // 3. Payment on their debt (exclude order confirmations, declines, and order payment proofs)
      if (n.type === 'payment') {
        if (
          titleLower.includes('order confirmed') ||
          titleLower.includes('order declined') ||
          titleLower.includes('awaiting confirmation') ||
          bodyLower.includes('order payment')
        ) {
          return false;
        }
        for (const ref of orderProofRefs) {
          if (ref && (titleLower.includes(ref) || bodyLower.includes(ref))) {
            return false;
          }
        }
        return true;
      }

      return false;
    };

    return notifications
      .filter((n) => {
        const target = resolveEffectiveTarget(n);
        if (target === 'delivery') return canViewDeliveryNav;
        if (target === 'admins') return isAdminOrSuper;
        if (target === 'super_admin') return currentRole === UserRole.SuperAdmin;
        if (target === currentUser.id || target === 'all') {
          return isAllowedCustomerNotification(n);
        }
        return false;
      })
      .map((n) => (localReadNotifIds[n.id] ? { ...n, read: true } : n));
  }, [
    notifications,
    proofs,
    localReadNotifIds,
    currentUser,
    currentRole,
    canViewDeliveryNav,
    isAdminOrSuper,
  ]);

  const unreadNotifCount = effectiveNotifications.filter((n) => !n.read).length;
  const unreadChatCount = currentUser
    ? threads.reduce((sum, t) => sum + t.unreadCount, 0)
    : 0;
  const storeProofs = useMemo(
    () => proofs.filter((p) => p.purpose !== 'Community Seller Settlement'),
    [proofs]
  );
  const pendingProofsCount = storeProofs.filter((p) => p.status === 'pending').length;
  const pendingOrdersCount = orders.filter(isOrderPendingAdminConfirmation).length;
  const pendingDeliveriesCount = orders.filter(
    (o) =>
      isApprovedDeliveryOrder(o) &&
      (o.deliveryStatus ?? 'Pending Dispatch') !== 'Delivered'
  ).length;
  const openEWalletCount = currentUser
    ? ewalletPosts.filter((p) => p.status !== 'Completed').length
    : 0;

  const sellerDebtSummary = useMemo(() => {
    if (!currentUser) {
      return {
        unpaidCount: 0,
        collectablesTotal: 0,
        pendingOrdersCount: 0,
        pendingProofsCount: 0,
      };
    }
    const myListingIds = new Set(
      listings.filter((l) => l.sellerId === currentUser.id).map((l) => l.id)
    );
    let unpaidCount = 0;
    let collectablesTotal = 0;
    let pendingSellerOrders = 0;
    for (const o of orders) {
      if (o.source !== 'marketplace') continue;
      if (o.status === 'Rejected' || o.deliveryStatus === 'Cancelled') continue;
      const isMine =
        o.sellerId === currentUser.id || o.items.some((li) => myListingIds.has(li.itemId));
      if (!isMine) continue;
      if (isOrderPendingSellerConfirmation(o)) {
        pendingSellerOrders += 1;
        continue;
      }
      if (o.status !== 'Confirmed' && o.status !== 'Completed') continue;
      if (o.paymentMethod === PaymentMethod.Debt && !o.debtSettled) {
        const rem = getOrderRemainingDebt(o);
        if (rem > 0.009) {
          unpaidCount += 1;
          collectablesTotal += rem;
        }
      }
    }
    const pendingSellerProofs = proofs.filter(
      (p) =>
        p.purpose === 'Community Seller Settlement' &&
        p.status === 'pending' &&
        p.sellerId === currentUser.id
    ).length;
    return {
      unpaidCount,
      collectablesTotal,
      pendingOrdersCount: pendingSellerOrders,
      pendingProofsCount: pendingSellerProofs,
    };
  }, [currentUser, listings, orders, proofs]);

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleSignOut = async () => {
    setIsProfileMenuOpen(false);
    setIsNotifOpen(false);
    setIsMobileDrawerOpen(false);
    setIsCartOpen(false);
    setPreviewRole(null);
    setCart([]);
    setActiveSection('store');
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleAddToCart = (itemId: string) => {
    if (currentRole === UserRole.Guest || !currentUser) {
      setIsSignInOpen(true);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === itemId);
      if (existing) {
        return prev.map((c) =>
          c.itemId === itemId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { itemId, quantity: 1 }];
    });
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.itemId === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const handlePlaceOrder = (payload: {
    fulfillment: FulfillmentType;
    deliveryNote: string;
    paymentMethod: string;
    proofChannel?: string;
    proofRef?: string;
    proofImage?: string;
  }) => {
    if (!currentUser) return;

    const orderItems = cart
      .map((c) => {
        const item = items.find((i) => i.id === c.itemId);
        if (!item) return null;
        return {
          itemId: item.id,
          name: item.name,
          quantity: c.quantity,
          unitPrice: item.price,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (orderItems.length === 0) return;
    const subtotal = orderItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const deliveryFee =
      payload.fulfillment === FulfillmentType.Delivery && storeConfig.deliveryEnabled
        ? storeConfig.deliveryFee
        : 0;
    const totalAmount = subtotal + deliveryFee;

    const isDigital = Boolean(payload.proofChannel && payload.proofImage);
    const isDebt = payload.paymentMethod === PaymentMethod.Debt;
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 5)
      .toUpperCase()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${nowTime}`;

    const isPickup = payload.fulfillment === FulfillmentType.Pickup;
    const defaultRunner = users.find((u) => u.role === UserRole.DeliveryStaff);
    const runnerName = isPickup
      ? 'Counter B Pickup'
      : defaultRunner?.name ?? 'Kuya Jun Reyes';

    const newOrder: StoreOrder = {
      id: orderId,
      userId: currentUser.id,
      userName: currentUser.name,
      items: orderItems,
      totalAmount,
      deliveryFee,
      deliveryCommission: deliveryFee,
      fulfillment: payload.fulfillment,
      deliveryNote: payload.deliveryNote || undefined,
      paymentMethod: payload.paymentMethod,
      status: 'Pending Admin Review',
      deliveryStatus: 'Pending Admin Approval',
      assignedRunnerId: isPickup ? undefined : defaultRunner?.id,
      assignedRunner: runnerName,
      cashCollected: false,
      createdAt: nowLabel,
      orderDateIso: todayIso,
      dueDateLabel: isDebt ? nextDueLabel : undefined,
      source: 'store',
      logs: [
        {
          id: `lg-${Date.now()}-1`,
          timestamp: nowLabel,
          event: `Order placed via ${payload.paymentMethod} (${payload.fulfillment}) — Waiting on Sales Order for Admin confirmation & stock release`,
          actor: currentUser.name,
        },
        ...(deliveryFee > 0
          ? [
              {
                id: `lg-${Date.now()}-2`,
                timestamp: nowLabel,
                event: `Assigned runner ${runnerName} (${formatPHP(deliveryFee)} fee — dispatched only after Admin approval)`,
                actor: 'System',
              },
            ]
          : []),
      ],
    };

    // Stock, customer debt/spend, and delivery staff dispatch wait for explicit Admin approval on Sales Order.
    setCart([]);
    setOrders((prev) => [newOrder, ...prev]);
    void saveOrder(newOrder);

    if (isDigital && payload.proofChannel && payload.proofImage) {
      const newProof: PaymentProof = {
        id: `PRF-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 5)
          .toUpperCase()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        amount: totalAmount,
        channel: payload.proofChannel,
        referenceNo: payload.proofRef || 'REF-PENDING',
        purpose: 'Order Payment',
        imageDataUrl: payload.proofImage,
        submittedAt: nowLabel,
        status: 'pending',
        orderId,
      };
      setProofs((prev) => [newProof, ...prev]);
      void savePaymentProof(newProof);

      void createNotificationDoc({
        id: `notif-pay-${Date.now()}`,
        title: `New Store Order Awaiting Confirmation · ${orderId}`,
        body: `${currentUser.name} submitted ${formatPHP(totalAmount, true)} (${payload.proofChannel}) for ${payload.fulfillment}. Approve on Sales Order to release stock.`,
        timestamp: 'Just now',
        type: 'payment',
        read: false,
        targetUserId: 'admins',
      });
    } else {
      void createNotificationDoc({
        id: `notif-ord-${Date.now()}`,
        title: `New Store Order Awaiting Confirmation · ${orderId}`,
        body: `${currentUser.name} placed a ${payload.fulfillment} order via ${payload.paymentMethod} (${formatPHP(totalAmount, true)}). Approve on Sales Order to release stock.`,
        timestamp: 'Just now',
        type: 'payment',
        read: false,
        targetUserId: 'admins',
      });
    }
  };

  const approveOrderInternal = async (
    orderId: string,
    options?: { skipProofId?: string }
  ): Promise<void> => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }
    if (!isOrderPendingAdminConfirmation(targetOrder)) {
      throw new Error(`Order ${orderId} has already been processed.`);
    }

    const wasPendingAdminReview = targetOrder.status === 'Pending Admin Review';
    const isPickup = targetOrder.fulfillment === FulfillmentType.Pickup;
    const isCash = targetOrder.paymentMethod === PaymentMethod.Cash;
    const isDebt = targetOrder.paymentMethod === PaymentMethod.Debt;
    const actorName = authUser?.name ?? currentUser?.name ?? 'Admin';
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${nowTime}`;

    if (targetOrder.source !== 'marketplace') {
      for (const line of targetOrder.items) {
        const product = items.find((i) => i.id === line.itemId);
        if (product && product.stock < line.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name} (${product.stock} left, need ${line.quantity}).`
          );
        }
      }
    }

    const defaultRunner = users.find((u) => u.role === UserRole.DeliveryStaff);
    const runnerName = isPickup
      ? 'Counter B Pickup'
      : targetOrder.assignedRunner && targetOrder.assignedRunner !== 'Counter B Pickup'
        ? targetOrder.assignedRunner
        : defaultRunner?.name ?? 'Kuya Jun Reyes';

    const updatedOrder: StoreOrder = {
      ...targetOrder,
      status: isPickup ? 'Completed' : 'Confirmed',
      deliveryStatus: isPickup ? 'Delivered' : 'Pending Dispatch',
      assignedRunnerId: isPickup ? undefined : targetOrder.assignedRunnerId ?? defaultRunner?.id,
      assignedRunner: runnerName,
      deliveredAt: isPickup ? nowLabel : targetOrder.deliveredAt,
      cashCollected: isPickup && isCash ? true : targetOrder.cashCollected,
      logs: [
        ...(targetOrder.logs ?? []),
        {
          id: `lg-app-${Date.now()}`,
          timestamp: nowLabel,
          event: isPickup
            ? `Approved & stock released by ${actorName} (${targetOrder.fulfillment}) — Completed at Counter B`
            : `Approved & stock released by ${actorName} — Dispatched to ${runnerName}`,
          actor: actorName,
        },
      ],
    };

    const previousOrders = orders;
    const previousItems = items;
    const previousUsers = users;
    const previousProofs = proofs;

    const stockUpdates: Array<{ itemId: string; nextStock: number; nextSold: number }> = [];
    if (targetOrder.source !== 'marketplace') {
      for (const line of targetOrder.items) {
        const product = items.find((i) => i.id === line.itemId);
        if (product) {
          stockUpdates.push({
            itemId: product.id,
            nextStock: Math.max(0, product.stock - line.quantity),
            nextSold: product.soldCount + line.quantity,
          });
        }
      }
    }

    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    if (stockUpdates.length > 0) {
      setItems((prev) =>
        prev.map((item) => {
          const upd = stockUpdates.find((u) => u.itemId === item.id);
          return upd ? { ...item, stock: upd.nextStock, soldCount: upd.nextSold } : item;
        })
      );
    }

    const targetCustomer =
      targetOrder.userId && targetOrder.userId !== 'walk-in'
        ? users.find((u) => u.id === targetOrder.userId) ??
          (authUser?.id === targetOrder.userId ? authUser : undefined)
        : undefined;
    const shouldUpdateCustomerTotals = wasPendingAdminReview && Boolean(targetCustomer);
    const nextDebt =
      shouldUpdateCustomerTotals && targetCustomer
        ? isDebt
          ? targetCustomer.debtBalance + targetOrder.totalAmount
          : targetCustomer.debtBalance
        : 0;
    const nextSpent =
      shouldUpdateCustomerTotals && targetCustomer
        ? targetCustomer.totalSpent + targetOrder.totalAmount
        : 0;

    if (shouldUpdateCustomerTotals && targetCustomer) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetCustomer.id
            ? { ...u, debtBalance: nextDebt, totalSpent: nextSpent }
            : u
        )
      );
      if (authUser?.id === targetCustomer.id) {
        setAuthUser((prev) =>
          prev ? { ...prev, debtBalance: nextDebt, totalSpent: nextSpent } : prev
        );
      }
    }

    const linkedPendingProofs = proofs.filter(
      (p) =>
        p.orderId === targetOrder.id &&
        p.status === 'pending' &&
        p.id !== options?.skipProofId
    );
    if (linkedPendingProofs.length > 0) {
      setProofs((prev) =>
        prev.map((p) =>
          linkedPendingProofs.some((lp) => lp.id === p.id)
            ? { ...p, status: 'approved', reviewedBy: actorName, reviewedAt: 'Just now' }
            : p
        )
      );
    }

    try {
      await saveOrder(updatedOrder);
      if (stockUpdates.length > 0) {
        await Promise.all(
          stockUpdates.map((u) => updateStoreItemStock(u.itemId, u.nextStock, u.nextSold))
        );
      }
      if (shouldUpdateCustomerTotals && targetCustomer) {
        await updateUserCheckoutTotals(targetCustomer.id, nextDebt, nextSpent);
      }
      if (linkedPendingProofs.length > 0) {
        await Promise.all(
          linkedPendingProofs.map((p) =>
            savePaymentProof({
              ...p,
              status: 'approved',
              reviewedBy: actorName,
              reviewedAt: 'Just now',
            })
          )
        );
      }
    } catch (err) {
      setOrders(previousOrders);
      setItems(previousItems);
      setUsers(previousUsers);
      setProofs(previousProofs);
      throw err;
    }

    if (!isPickup) {
      void createNotificationDoc({
        id: `notif-del-${Date.now()}`,
        title: `Approved Delivery Order · ${updatedOrder.id}`,
        body: `${updatedOrder.userName}'s order is approved for desk delivery (${updatedOrder.deliveryNote || 'Office Floor'}).`,
        timestamp: 'Just now',
        type: 'delivery',
        read: false,
        targetUserId: 'delivery',
      });
    }
  };

  const handleApprovePendingOrder = async (orderId: string): Promise<void> => {
    await approveOrderInternal(orderId);
  };

  const handleRejectPendingOrder = async (orderId: string): Promise<void> => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }
    if (!isOrderPendingAdminConfirmation(targetOrder)) {
      throw new Error(`Order ${orderId} has already been processed.`);
    }

    const actorName = authUser?.name ?? currentUser?.name ?? 'Admin';
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${nowTime}`;

    const rejectedOrder: StoreOrder = {
      ...targetOrder,
      status: 'Rejected',
      deliveryStatus: 'Cancelled',
      logs: [
        ...(targetOrder.logs ?? []),
        {
          id: `lg-rej-${Date.now()}`,
          timestamp: nowLabel,
          event: 'Order rejected on Sales Order (no stock or debt released)',
          actor: actorName,
        },
      ],
    };

    const linkedPendingProofs = proofs.filter(
      (p) => p.orderId === targetOrder.id && p.status === 'pending'
    );

    const previousOrders = orders;
    const previousProofs = proofs;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? rejectedOrder : o)));
    if (linkedPendingProofs.length > 0) {
      setProofs((prev) =>
        prev.map((p) =>
          linkedPendingProofs.some((lp) => lp.id === p.id)
            ? { ...p, status: 'rejected', reviewedBy: actorName, reviewedAt: 'Just now' }
            : p
        )
      );
    }

    try {
      await saveOrder(rejectedOrder);
      if (linkedPendingProofs.length > 0) {
        await Promise.all(
          linkedPendingProofs.map((p) =>
            savePaymentProof({
              ...p,
              status: 'rejected',
              reviewedBy: actorName,
              reviewedAt: 'Just now',
            })
          )
        );
      }
    } catch (err) {
      setOrders(previousOrders);
      setProofs(previousProofs);
      throw err;
    }
  };

  const handleSyncAllData = async (): Promise<{
    syncedAt: string;
    orderCount: number;
    itemCount: number;
    ownerCommission: number;
  }> => {
    if (!authUser) {
      throw new Error('Sign in with an Admin account to sync Firestore data.');
    }
    const res = await syncAllFirestoreDataNow({
      uid: authUser.id,
      role: authUser.role,
      pautanganEnabled: authUser.pautanganEnabled,
    });

    setItems(res.items);
    setIsStoreLoading(false);
    if (res.storeConfig) {
      const { dueDays: syncedDueDays, ...rest } = res.storeConfig;
      setStoreConfig(rest);
      if (Array.isArray(syncedDueDays) && syncedDueDays.length === 2) {
        dueDaysRef.current = [Number(syncedDueDays[0]), Number(syncedDueDays[1])];
      }
    }
    if (res.pautanganSettings) {
      dueDaysRef.current = res.pautanganSettings.dueDays;
      setPautanganSettings(res.pautanganSettings);
    }
    if (res.currentUser) setAuthUser(res.currentUser);
    if (res.users.length > 0) setUsers(res.users);
    setOrders(res.orders);
    setProofs(res.proofs);
    setSuggestions(res.suggestions);
    setListings(res.listings);
    setEWalletPosts(res.ewalletPosts);
    setLoans(res.loans);
    setStockAdjustments(res.stockAdjustments);
    setOtherApps(res.internalApps);
    setSellerConfig(res.sellerConfig);

    const freshOwnerCommission =
      OWNER_BASE_COMMISSION_EARNED +
      res.orders.reduce((sum, o) => sum + (o.commissionEarned ?? 0), 0);

    if (isActualAdmin) {
      await syncOwnerCommissionToStoreConfig(freshOwnerCommission);
    }

    return {
      syncedAt: res.syncedAt,
      orderCount: res.orders.length,
      itemCount: res.items.length,
      ownerCommission: freshOwnerCommission,
    };
  };

  const handleUpdateDeliveryStatus = (
    orderId: string,
    deliveryStatus: 'Pending Dispatch' | 'Out for Delivery' | 'Delivered',
    cashCollected?: boolean
  ) => {
    const actorName = currentUser?.name ?? 'Delivery Staff';
    const stamp = `${new Date().toISOString().slice(0, 10)} ${new Date().toLocaleTimeString(
      [],
      { hour: '2-digit', minute: '2-digit' }
    )}`;
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    const nextLogs = [
      ...(target.logs ?? []),
      {
        id: `lg-${Date.now()}`,
        timestamp: stamp,
        event:
          deliveryStatus === 'Delivered'
            ? `Delivered to customer${cashCollected ? ' & Cash collected' : ''}`
            : `Updated status to ${deliveryStatus}`,
        actor: actorName,
      },
    ];

    const patch: Partial<StoreOrder> = {
      deliveryStatus,
      cashCollected: cashCollected ?? target.cashCollected,
      assignedRunner: target.assignedRunner || actorName,
      deliveredAt: deliveryStatus === 'Delivered' ? stamp : target.deliveredAt,
      logs: nextLogs,
    };

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              ...patch,
              status: deliveryStatus === 'Delivered' ? 'Completed' : o.status,
            }
          : o
      )
    );

    if (isActualAdmin && deliveryStatus === 'Delivered') {
      void saveOrder({ ...target, ...patch, status: 'Completed' });
    } else {
      void updateOrderDeliveryFields(orderId, patch);
    }
  };

  const handleToggleVote = (suggestionId: string) => {
    if (!currentUser) return;
    const target = suggestions.find((s) => s.id === suggestionId);
    if (!target) return;
    const already = target.voterIds.includes(currentUser.id);
    const nextVoterIds = already
      ? target.voterIds.filter((id) => id !== currentUser.id)
      : [...target.voterIds, currentUser.id];
    const nextVoterNames = already
      ? target.voterNames.filter((n) => n !== currentUser.name)
      : [...target.voterNames, currentUser.name];

    setUnreadCommunityCount((c) => c + 1);
    setLastFeedEvent(`${currentUser.name} voted on "${target.title}".`);
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === suggestionId
          ? { ...s, voterIds: nextVoterIds, voterNames: nextVoterNames }
          : s
      )
    );
    void updateSuggestionVotes(suggestionId, nextVoterIds, nextVoterNames);
  };

  const handleCreateSuggestion = (
    title: string,
    category: string,
    reason: string
  ) => {
    if (!currentUser) return;
    const newSug: SuggestionItem = {
      id: `sug-${Date.now()}`,
      title,
      category,
      reason,
      requestedById: currentUser.id,
      requestedByName: currentUser.name,
      createdAt: 'Just now',
      voterIds: [currentUser.id],
      voterNames: [currentUser.name],
      status: 'Open for Votes',
    };
    setSuggestions((prev) => [newSug, ...prev]);
    setUnreadCommunityCount((c) => c + 1);
    setLastFeedEvent(`${currentUser.name} requested "${title}" on Suggestions Feed.`);
    void saveSuggestion(newSug);
  };

  const handleCreateListing = (payload: {
    title: string;
    description: string;
    price: number;
    stock: number;
    commissionType: CommissionType;
    commissionValue: number;
    image?: string;
  }) => {
    if (!currentUser) return;
    const defaultPaymentParts: string[] = [];
    if (sellerConfig?.gcashNumber?.trim()) {
      defaultPaymentParts.push(`GCash ${sellerConfig.gcashNumber.trim()}`);
    }
    if (sellerConfig?.mayaNumber?.trim()) {
      defaultPaymentParts.push(`Maya ${sellerConfig.mayaNumber.trim()}`);
    }
    if (sellerConfig?.paymentNotes?.trim()) {
      defaultPaymentParts.push(sellerConfig.paymentNotes.trim());
    }

    const newListing: MarketplaceListing = {
      id: `mkt-${Date.now()}`,
      sellerId: currentUser.id,
      sellerName: currentUser.name,
      sellerDepartment: currentUser.department,
      title: payload.title,
      description: payload.description,
      price: payload.price,
      stock: payload.stock,
      soldCount: 0,
      commissionType: payload.commissionType,
      commissionValue: payload.commissionValue,
      approvalStatus: 'pending',
      createdAt: 'Pending Review · Just now',
      image: payload.image,
      paused: false,
      allowCash: sellerConfig?.defaultAllowCash ?? true,
      allowDebt: sellerConfig?.defaultAllowDebt ?? true,
      pickupNote: sellerConfig?.defaultPickupNote?.trim() || undefined,
      paymentDetails:
        defaultPaymentParts.length > 0 ? defaultPaymentParts.join(' · ').slice(0, 200) : undefined,
    };
    setListings((prev) => [newListing, ...prev]);
    setUnreadCommunityCount((c) => c + 1);
    setLastFeedEvent(`${currentUser.name} submitted "${payload.title}" for sale.`);
    void saveMarketplaceListing(newListing);
    void createNotificationDoc({
      id: `notif-mkt-${Date.now()}`,
      title: 'For-Sale Listing Pending Super Admin Approval',
      body: `${currentUser.name} submitted "${payload.title}" (${formatPHP(payload.price)}) for review.`,
      timestamp: 'Just now',
      type: 'marketplace',
      read: false,
      targetUserId: 'super_admin',
    });
  };

  const handleBuyListing = (
    listingId: string,
    paymentMethod: PaymentMethod.Cash | PaymentMethod.Debt,
    fulfillment: FulfillmentType,
    quantity = 1
  ) => {
    if (!currentUser) return;
    const target = listings.find((l) => l.id === listingId);
    if (!target || target.stock <= 0 || target.paused) return;

    const qty = Math.max(1, Math.min(target.stock, Math.round(quantity || 1)));

    const { ownerShare } = computeCommission(
      target.price,
      target.commissionType,
      target.commissionValue
    );

    const deliveryFee =
      fulfillment === FulfillmentType.Delivery && storeConfig.deliveryEnabled
        ? storeConfig.deliveryFee
        : 0;
    const totalAmount = target.price * qty + deliveryFee;
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    // Seller must confirm first before releasing stock, adding to buyer Community Debt ledger,
    // or dispatching to Delivery Staff. Also never touches Store debtBalance.
    const newOrder: StoreOrder = {
      id: `MKT-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      items: [
        {
          itemId: target.id,
          name: `${target.title} (Coworker Sale)`,
          quantity: qty,
          unitPrice: target.price,
        },
      ],
      totalAmount,
      deliveryFee,
      deliveryCommission: deliveryFee,
      fulfillment,
      paymentMethod,
      status: 'Pending Seller Confirmation',
      deliveryStatus: 'Pending Seller Approval',
      assignedRunner:
        fulfillment === FulfillmentType.Delivery ? 'Pending Seller Approval' : 'Seller Pickup',
      cashCollected: false,
      createdAt: nowLabel,
      orderDateIso: todayIso,
      dueDateLabel:
        paymentMethod === PaymentMethod.Debt ? nextDueLabel : undefined,
      source: 'marketplace',
      commissionEarned: ownerShare * qty,
      sellerId: target.sellerId,
      sellerName: target.sellerName,
      debtSettled: paymentMethod === PaymentMethod.Debt ? false : true,
      debtPaidAmount: 0,
      logs: [
        {
          id: `lg-mkt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          timestamp: nowLabel,
          event: `Order placed (${qty}×) via ${paymentMethod} (${fulfillment}) — Waiting for ${target.sellerName} to confirm & release stock`,
          actor: currentUser.name,
        },
      ],
    };

    setOrders((prev) => [newOrder, ...prev]);
    void saveOrder(newOrder);
  };

  const handleSellerConfirmOrder = async (orderId: string): Promise<void> => {
    if (!currentUser) return;
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }
    if (!isOrderPendingSellerConfirmation(targetOrder)) {
      throw new Error(`Order ${orderId} has already been processed.`);
    }
    if (targetOrder.sellerId && targetOrder.sellerId !== currentUser.id) {
      throw new Error('Only the seller who posted this item can confirm the order.');
    }

    const stockPatches: Array<{ listingId: string; nextStock: number; nextSold: number }> = [];
    for (const line of targetOrder.items) {
      const listing = listings.find((l) => l.id === line.itemId);
      if (listing) {
        if (listing.stock < line.quantity) {
          throw new Error(
            `Not enough stock for "${listing.title}" (${listing.stock} left, need ${line.quantity}).`
          );
        }
        stockPatches.push({
          listingId: listing.id,
          nextStock: Math.max(0, listing.stock - line.quantity),
          nextSold: listing.soldCount + line.quantity,
        });
      }
    }

    const isPickup = targetOrder.fulfillment === FulfillmentType.Pickup;
    const isCash = targetOrder.paymentMethod === PaymentMethod.Cash;
    const defaultRunner = users.find((u) => u.role === UserRole.DeliveryStaff);
    const runnerName = isPickup
      ? 'Seller Pickup'
      : defaultRunner?.name ?? 'Delivery Runner';
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowLabel = `${todayIso} ${nowTime}`;

    const nextLogs = [
      ...(targetOrder.logs ?? []),
      {
        id: `lg-sel-conf-${Date.now()}`,
        timestamp: nowLabel,
        event: isPickup
          ? `Order confirmed & stock released by ${currentUser.name} (Pickup)`
          : `Order confirmed & stock released by ${currentUser.name} — Queued for Delivery Staff`,
        actor: currentUser.name,
      },
    ];

    const updatedOrder: StoreOrder = {
      ...targetOrder,
      status: isPickup ? 'Completed' : 'Confirmed',
      deliveryStatus: isPickup ? 'Delivered' : 'Pending Dispatch',
      assignedRunnerId: isPickup ? undefined : defaultRunner?.id,
      assignedRunner: runnerName,
      deliveredAt: isPickup ? nowLabel : targetOrder.deliveredAt,
      cashCollected: isPickup && isCash ? true : targetOrder.cashCollected,
      logs: nextLogs,
    };

    const prevOrders = orders;
    const prevListings = listings;

    setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
    if (stockPatches.length > 0) {
      setListings((prev) =>
        prev.map((l) => {
          const patch = stockPatches.find((p) => p.listingId === l.id);
          return patch ? { ...l, stock: patch.nextStock, soldCount: patch.nextSold } : l;
        })
      );
    }

    try {
      await Promise.all(
        stockPatches.map((p) =>
          updateMarketplaceListingStock(p.listingId, p.nextStock, p.nextSold)
        )
      );
      await updateMarketplaceOrderConfirmation(orderId, {
        status: updatedOrder.status,
        deliveryStatus: updatedOrder.deliveryStatus,
        assignedRunnerId: updatedOrder.assignedRunnerId,
        assignedRunner: updatedOrder.assignedRunner,
        deliveredAt: updatedOrder.deliveredAt,
        cashCollected: updatedOrder.cashCollected,
        logs: nextLogs,
      });
    } catch (err) {
      setOrders(prevOrders);
      setListings(prevListings);
      throw err;
    }
  };

  const handleSellerRejectOrder = async (orderId: string): Promise<void> => {
    if (!currentUser) return;
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }
    if (!isOrderPendingSellerConfirmation(targetOrder)) {
      throw new Error(`Order ${orderId} has already been processed.`);
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowLabel = `${todayIso} ${nowTime}`;
    const nextLogs = [
      ...(targetOrder.logs ?? []),
      {
        id: `lg-sel-rej-${Date.now()}`,
        timestamp: nowLabel,
        event: `Order declined by seller ${currentUser.name} (no stock or ledger balance applied)`,
        actor: currentUser.name,
      },
    ];

    const prevOrders = orders;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'Rejected', deliveryStatus: 'Cancelled', logs: nextLogs }
          : o
      )
    );

    try {
      await updateMarketplaceOrderConfirmation(orderId, {
        status: 'Rejected',
        deliveryStatus: 'Cancelled',
        logs: nextLogs,
      });
    } catch (err) {
      setOrders(prevOrders);
      throw err;
    }
  };

  const handleSendSellerDebtReminder = async (payload: {
    buyerId: string;
    buyerName: string;
    orderIds: string[];
    amount: number;
    itemSummary: string;
    dueLabel: string;
    customMessage?: string;
  }): Promise<void> => {
    if (!currentUser) return;
    const sellerDisplay = currentUser.name;
    const title = `Payment Reminder from ${sellerDisplay} · ${formatPHP(payload.amount, true)}`.slice(
      0,
      140
    );
    const body = (
      payload.customMessage?.trim() ||
      `Hi ${payload.buyerName}, friendly reminder to settle ${formatPHP(
        payload.amount,
        true
      )} for ${payload.itemSummary} (${payload.orderIds.join(', ')}) due ${payload.dueLabel}.`
    ).slice(0, 500);

    await createNotificationDoc({
      id: `notif-seller-rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      timestamp: 'Just now',
      type: 'reminder',
      read: false,
      targetUserId: payload.buyerId,
    });
  };

  const handleMarkSellerOrderDebtSettled = async (
    orderId: string,
    settled: boolean
  ): Promise<void> => {
    const target = orders.find((o) => o.id === orderId);
    if (!target || !currentUser) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${nowTime}`;
    const settledAt = settled ? nowLabel : '';
    const debtPaidAmount = settled ? getOrderItemsSubtotal(target) : 0;
    const nextLogs = [
      ...(target.logs ?? []),
      {
        id: `lg-settle-${Date.now()}`,
        timestamp: nowLabel,
        event: settled
          ? `Seller marked debt order as Paid / Settled`
          : `Seller reopened debt order as Unpaid`,
        actor: currentUser.name,
      },
    ];

    const prevOrders = orders;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              debtSettled: settled,
              debtPaidAmount,
              settledAt: settled ? nowLabel : undefined,
              logs: nextLogs,
            }
          : o
      )
    );
    try {
      await markMarketplaceOrderDebtSettled(
        orderId,
        settled,
        settledAt,
        nextLogs,
        debtPaidAmount
      );
    } catch (err) {
      setOrders(prevOrders);
      throw err;
    }
  };

  const handleUpdateSellerListingConfig = async (
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
  ): Promise<void> => {
    const prevListings = listings;
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, ...patch } : l))
    );
    try {
      await updateSellerListingConfig(listingId, patch);
    } catch (err) {
      setListings(prevListings);
      throw err;
    }
  };

  const handleSaveSellerConfig = async (nextConfig: SellerConfig): Promise<void> => {
    const prevConfig = sellerConfig;
    setSellerConfig(nextConfig);
    try {
      await saveSellerConfig(nextConfig);
    } catch (err) {
      setSellerConfig(prevConfig);
      throw err;
    }
  };

  const handleRequestLoan = (principal: number, months: number) => {
    if (!currentUser) return;
    const rate = pautanganSettings.monthlyInterestRate;
    const totalPayable = principal + Math.round(principal * (rate / 100) * months);
    const loanId = `LN-${Date.now().toString().slice(-6)}`;
    const todayIso = new Date().toISOString().slice(0, 10);
    const installments = buildLoanInstallments(
      loanId,
      totalPayable,
      months,
      todayIso,
      pautanganSettings.dueDays[1] ?? 30
    );

    const newLoan: LoanRecord = {
      id: loanId,
      userId: currentUser.id,
      userName: currentUser.name,
      principal,
      interestRate: rate,
      months,
      totalPayable,
      remainingBalance: totalPayable,
      status: 'Active',
      createdAt: todayIso,
      nextDueDate: installments[0]?.dueDate ?? nextDueLabel,
      repayments: [],
      installments,
    };

    setLoans((prev) => [newLoan, ...prev]);
    void saveLoanRecord(newLoan);
  };

  const handleRepayLoan = (payload: {
    loanId: string;
    amount: number;
    method: string;
    referenceNo?: string;
    proofImage?: string;
  }) => {
    if (!currentUser) return;
    const targetLoan = loans.find((l) => l.id === payload.loanId);
    if (!targetLoan) return;

    if (payload.method !== 'Cash' && payload.proofImage) {
      const newProof: PaymentProof = {
        id: `PRF-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 5)
          .toUpperCase()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        amount: payload.amount,
        channel: payload.method,
        referenceNo: payload.referenceNo || 'REF-LOAN',
        purpose: 'Pautangan Repayment',
        imageDataUrl: payload.proofImage,
        submittedAt: 'Just now',
        status: 'pending',
        loanId: payload.loanId,
      };

      let marked = false;
      const updatedLoan: LoanRecord = {
        ...targetLoan,
        installments: (targetLoan.installments ?? []).map((inst) => {
          if (!marked && inst.status === 'Upcoming') {
            marked = true;
            return {
              ...inst,
              status: 'Pending Verification' as const,
              method: payload.method,
            };
          }
          return inst;
        }),
      };

      setProofs((prev) => [newProof, ...prev]);
      setLoans((prev) => prev.map((l) => (l.id === payload.loanId ? updatedLoan : l)));
      void savePaymentProof(newProof);
      void saveLoanRecord(updatedLoan);
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const nextRemaining = Math.max(0, targetLoan.remainingBalance - payload.amount);
    let covered = payload.amount;
    const nextInstallments = (targetLoan.installments ?? []).map((inst) => {
      if (inst.status !== 'Paid' && covered >= inst.amount * 0.5) {
        covered -= inst.amount;
        return {
          ...inst,
          status: 'Paid' as const,
          paidAt: todayIso,
          method: payload.method,
        };
      }
      return inst;
    });

    const updatedLoan: LoanRecord = {
      ...targetLoan,
      remainingBalance: nextRemaining,
      status: nextRemaining === 0 ? 'Settled' : 'Active',
      installments: nextInstallments,
      repayments: [
        ...targetLoan.repayments,
        {
          id: `rep-${Date.now()}`,
          date: todayIso,
          amount: payload.amount,
          method: payload.method,
          note: `${targetLoan.months}-month term installment`,
        },
      ],
    };

    setLoans((prev) => prev.map((l) => (l.id === payload.loanId ? updatedLoan : l)));
    void saveLoanRecord(updatedLoan);
  };

  const handleSubmitDebtProof = (payload: {
    amount: number;
    channel: string;
    referenceNo: string;
    imageDataUrl: string;
  }) => {
    if (!currentUser) return;
    const newProof: PaymentProof = {
      id: `PRF-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      amount: payload.amount,
      channel: payload.channel,
      referenceNo: payload.referenceNo,
      purpose: 'Store Debt Settlement',
      imageDataUrl: payload.imageDataUrl,
      submittedAt: 'Just now',
      status: 'pending',
    };
    setProofs((prev) => [newProof, ...prev]);
    void savePaymentProof(newProof);
    void createNotificationDoc({
      id: `notif-prf-${Date.now()}`,
      title: `New ${payload.channel} Payment Proof`,
      body: `${currentUser.name} submitted ${formatPHP(payload.amount, true)} (${payload.referenceNo}).`,
      timestamp: 'Just now',
      type: 'payment',
      read: false,
      targetUserId: 'admins',
    });
  };

  const handleSubmitSellerDebtProof = async (payload: {
    sellerId: string;
    sellerName: string;
    amount: number;
    channel: string;
    referenceNo: string;
    imageDataUrl: string;
    orderIds: string[];
  }): Promise<void> => {
    if (!currentUser) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const newProof: PaymentProof = {
      id: `PRFS-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      amount: payload.amount,
      channel: payload.channel,
      referenceNo: payload.referenceNo,
      purpose: 'Community Seller Settlement',
      imageDataUrl: payload.imageDataUrl,
      submittedAt: `${todayIso} ${nowTime}`,
      status: 'pending',
      sellerId: payload.sellerId,
      sellerName: payload.sellerName,
      orderIds: payload.orderIds.slice(0, 50),
    };

    const prevProofs = proofs;
    setProofs((prev) => [newProof, ...prev]);
    try {
      await savePaymentProof(newProof);
      await createNotificationDoc({
        id: `notif-sel-prf-${Date.now()}`,
        title: `Community Debt Payment Submitted (${formatPHP(payload.amount, true)})`.slice(
          0,
          140
        ),
        body: `${currentUser.name} uploaded a ${payload.channel} receipt (Ref ${payload.referenceNo}) for your community item debt. Verify it on Seller Dashboard.`.slice(
          0,
          500
        ),
        timestamp: 'Just now',
        type: 'payment',
        read: false,
        targetUserId: payload.sellerId,
      });
    } catch (err) {
      setProofs(prevProofs);
      throw err;
    }
  };

  const handleReviewSellerProof = async (
    proofId: string,
    decision: 'approved' | 'rejected'
  ): Promise<void> => {
    if (!currentUser) return;
    const target = proofs.find((p) => p.id === proofId);
    if (
      !target ||
      target.status !== 'pending' ||
      target.purpose !== 'Community Seller Settlement' ||
      target.sellerId !== currentUser.id
    ) {
      return;
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${nowTime}`;
    const updatedProof: PaymentProof = {
      ...target,
      status: decision,
      reviewedBy: currentUser.name,
      reviewedAt: nowLabel,
    };

    const prevProofs = proofs;
    const prevOrders = orders;
    setProofs((prev) => prev.map((p) => (p.id === proofId ? updatedProof : p)));

    try {
      if (decision === 'rejected') {
        await savePaymentProof(updatedProof);
        await createNotificationDoc({
          id: `notif-sel-rej-${Date.now()}`,
          title: `Community Debt Payment Rejected (${target.referenceNo})`.slice(0, 140),
          body: `${currentUser.name} requested a clearer proof re-upload for your ${formatPHP(
            target.amount,
            true
          )} ${target.channel} payment.`.slice(0, 500),
          timestamp: 'Just now',
          type: 'payment',
          read: false,
          targetUserId: target.userId,
        });
        return;
      }

      const myListingIds = new Set(
        listings.filter((l) => l.sellerId === currentUser.id).map((l) => l.id)
      );

      const candidateOrders = orders
        .filter(
          (o) =>
            o.source === 'marketplace' &&
            o.userId === target.userId &&
            o.paymentMethod === PaymentMethod.Debt &&
            (o.status === 'Confirmed' || o.status === 'Completed') &&
            !o.debtSettled &&
            (target.orderIds?.includes(o.id) ||
              o.sellerId === currentUser.id ||
              o.items.some((li) => myListingIds.has(li.itemId)))
        )
        .sort((a, b) => {
          const aIn = target.orderIds?.includes(a.id) ? 0 : 1;
          const bIn = target.orderIds?.includes(b.id) ? 0 : 1;
          if (aIn !== bIn) return aIn - bIn;
          return (a.orderDateIso || '').localeCompare(b.orderDateIso || '');
        });

      let remaining = target.amount;
      const updatedMap = new Map<string, StoreOrder>();
      const orderPatches: Array<{
        orderId: string;
        debtSettled: boolean;
        debtPaidAmount: number;
        settledAt?: string;
        logs: StoreOrder['logs'] extends Array<infer T> ? T[] : never;
      }> = [];

      for (const ord of candidateOrders) {
        if (remaining <= 0.009) break;
        const itemSubtotal = getOrderItemsSubtotal(ord);
        const prevPaid = Math.max(0, Number(ord.debtPaidAmount ?? 0));
        const orderRemaining = Math.max(0, itemSubtotal - prevPaid);
        if (orderRemaining <= 0.009) continue;

        const isFullSettlement = remaining + 0.01 >= orderRemaining;
        const applied = isFullSettlement ? orderRemaining : remaining;
        const nextPaidAmount = isFullSettlement
          ? itemSubtotal
          : Number((prevPaid + applied).toFixed(2));
        remaining = Math.max(0, remaining - applied);

        const nextLogs = [
          ...(ord.logs ?? []),
          {
            id: `lg-prf-settle-${Date.now()}-${ord.id}`,
            timestamp: nowLabel,
            event: isFullSettlement
              ? `Seller approved ${target.channel} proof (${target.referenceNo}) & settled community debt`
              : `Seller approved partial ${target.channel} payment (${formatPHP(
                  applied,
                  true
                )}, Ref ${target.referenceNo})`,
            actor: currentUser.name,
          },
        ];

        const nextOrder: StoreOrder = {
          ...ord,
          debtSettled: isFullSettlement,
          debtPaidAmount: nextPaidAmount,
          settledAt: isFullSettlement ? nowLabel : ord.settledAt,
          logs: nextLogs,
        };

        updatedMap.set(ord.id, nextOrder);
        orderPatches.push({
          orderId: ord.id,
          debtSettled: isFullSettlement,
          debtPaidAmount: nextPaidAmount,
          settledAt: isFullSettlement ? nowLabel : undefined,
          logs: nextLogs,
        });
      }

      if (updatedMap.size > 0) {
        setOrders((prev) => prev.map((o) => updatedMap.get(o.id) ?? o));
      }

      await approveSellerProofAndSettleOrders(updatedProof, orderPatches);

      await createNotificationDoc({
        id: `notif-sel-app-${Date.now()}`,
        title: `Community Debt Payment Approved (${target.referenceNo})`.slice(0, 140),
        body: `${currentUser.name} verified your ${formatPHP(target.amount, true)} ${target.channel} payment on your community debt.`.slice(
          0,
          500
        ),
        timestamp: 'Just now',
        type: 'payment',
        read: false,
        targetUserId: target.userId,
      });
    } catch (err) {
      setProofs(prevProofs);
      setOrders(prevOrders);
      throw err;
    }
  };

  const handleReviewProof = (proofId: string, decision: 'approved' | 'rejected') => {
    const target = proofs.find((p) => p.id === proofId);
    if (!target || target.status !== 'pending') return;
    if (target.purpose === 'Community Seller Settlement') return;

    const updatedProof: PaymentProof = {
      ...target,
      status: decision,
      reviewedBy: currentUser?.name ?? 'Admin',
      reviewedAt: 'Just now',
    };

    setProofs((prev) => prev.map((p) => (p.id === proofId ? updatedProof : p)));
    void savePaymentProof(updatedProof);

    const isDebtPaymentProof =
      target.purpose === 'Store Debt Settlement' ||
      target.purpose === 'Pautangan Repayment' ||
      Boolean(target.loanId);

    if (decision === 'rejected') {
      if (isDebtPaymentProof) {
        void createNotificationDoc({
          id: `notif-rej-${Date.now()}`,
          title: `${target.loanId ? 'Loan' : 'Debt'} Payment Proof Rejected (${target.referenceNo})`.slice(0, 140),
          body: `Admin requested re-upload for ${target.userName}'s ${target.channel} debt payment (${formatPHP(target.amount, true)}).`.slice(0, 500),
          timestamp: 'Just now',
          type: 'payment',
          read: false,
          targetUserId: target.userId,
        });
      }
      return;
    }

    if (target.purpose === 'Store Debt Settlement') {
      const targetUser = users.find((u) => u.id === target.userId);
      if (targetUser) {
        const updatedUser: UserAccount = {
          ...targetUser,
          debtBalance: Math.max(0, targetUser.debtBalance - target.amount),
        };
        setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
        if (authUser?.id === updatedUser.id) setAuthUser(updatedUser);
        void saveUserAccount(updatedUser);
      }
    }

    if (target.orderId) {
      const targetOrder = orders.find((o) => o.id === target.orderId);
      if (targetOrder) {
        if (isOrderPendingAdminConfirmation(targetOrder)) {
          void approveOrderInternal(targetOrder.id, { skipProofId: proofId }).catch((err) => {
            console.error('Failed to approve & release stock for order proof:', err);
          });
        } else {
          const updatedOrder: StoreOrder = { ...targetOrder, status: 'Confirmed' };
          setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
          void saveOrder(updatedOrder);
        }
      }
    }

    if (target.loanId) {
      const targetLoan = loans.find((l) => l.id === target.loanId);
      if (targetLoan) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const rem = Math.max(0, targetLoan.remainingBalance - target.amount);
        let covered = target.amount;
        const nextInst = (targetLoan.installments ?? []).map((inst) => {
          if (inst.status !== 'Paid' && covered >= inst.amount * 0.5) {
            covered -= inst.amount;
            return {
              ...inst,
              status: 'Paid' as const,
              paidAt: todayIso,
              method: target.channel,
            };
          }
          return inst;
        });
        const updatedLoan: LoanRecord = {
          ...targetLoan,
          remainingBalance: rem,
          status: rem === 0 ? 'Settled' : 'Active',
          installments: nextInst,
          repayments: [
            ...targetLoan.repayments,
            {
              id: `rep-${Date.now()}`,
              date: todayIso,
              amount: target.amount,
              method: target.channel,
              note: `Confirmed ref ${target.referenceNo}`,
            },
          ],
        };
        setLoans((prev) => prev.map((l) => (l.id === updatedLoan.id ? updatedLoan : l)));
        void saveLoanRecord(updatedLoan);
      }
    }

    if (isDebtPaymentProof) {
      void createNotificationDoc({
        id: `notif-app-${Date.now()}`,
        title: `${target.loanId ? 'Loan' : 'Debt'} Payment Approved (${target.referenceNo})`.slice(0, 140),
        body: `${formatPHP(target.amount, true)} ${target.channel} payment on your debt was verified by ${currentUser?.name ?? 'Admin'}.`.slice(0, 500),
        timestamp: 'Just now',
        type: 'payment',
        read: false,
        targetUserId: target.userId,
      });
    }
  };

  const handleReviewListing = (
    listingId: string,
    decision: 'approved' | 'rejected'
  ) => {
    const target = listings.find((l) => l.id === listingId);
    if (!target) return;
    const updated: MarketplaceListing = { ...target, approvalStatus: decision };
    if (decision === 'approved') {
      setUnreadCommunityCount((c) => c + 1);
      setLastFeedEvent(
        `"${target.title}" is now approved and live in Public For-Sale Feed!`
      );
    }
    setListings((prev) => prev.map((l) => (l.id === listingId ? updated : l)));
    void saveMarketplaceListing(updated);
  };

  const handleDeleteListing = async (listingId: string): Promise<void> => {
    const previous = listings;
    setListings((prev) => prev.filter((l) => l.id !== listingId));
    try {
      await removeMarketplaceListing(listingId);
    } catch (err) {
      setListings(previous);
      throw err;
    }
  };

  const handleCreateManualSale = async (payload: {
    customerMode: 'walkin' | 'coworker';
    customerId?: string;
    customerName: string;
    items: Array<{ itemId: string; quantity: number }>;
    fulfillment: FulfillmentType;
    deliveryNote?: string;
    paymentMethod: string;
  }): Promise<StoreOrder> => {
    const lineItems = payload.items
      .map((entry) => {
        const product = items.find((i) => i.id === entry.itemId);
        if (!product || entry.quantity <= 0) return null;
        return {
          product,
          quantity: entry.quantity,
          itemId: product.id,
          name: product.name,
          unitPrice: product.price,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (lineItems.length === 0) {
      throw new Error('Select at least one item for the sales order.');
    }

    for (const line of lineItems) {
      if (line.quantity > line.product.stock) {
        throw new Error(
          `Insufficient stock for ${line.product.name} (${line.product.stock} left).`
        );
      }
    }

    const subtotal = lineItems.reduce(
      (sum, entry) => sum + entry.quantity * entry.unitPrice,
      0
    );
    const deliveryFee =
      payload.fulfillment === FulfillmentType.Delivery && storeConfig.deliveryEnabled
        ? storeConfig.deliveryFee
        : 0;
    const totalAmount = subtotal + deliveryFee;

    const targetCoworker =
      payload.customerMode === 'coworker' && payload.customerId
        ? users.find((u) => u.id === payload.customerId)
        : undefined;

    const customerId = targetCoworker ? targetCoworker.id : 'walk-in';
    const customerName =
      (targetCoworker ? targetCoworker.name : payload.customerName.trim()) ||
      'Walk-in Customer';
    const isDebt = payload.paymentMethod === PaymentMethod.Debt && Boolean(targetCoworker);
    const isCash = payload.paymentMethod === PaymentMethod.Cash;
    const isPickup = payload.fulfillment === FulfillmentType.Pickup;
    const defaultRunner = users.find((u) => u.role === UserRole.DeliveryStaff);
    const runnerName = isPickup
      ? 'Counter B Walk-in'
      : defaultRunner?.name ?? 'Kuya Jun Reyes';

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 5)
      .toUpperCase()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${nowTime}`;
    const actorName = currentUser?.name ?? 'Admin';

    const newOrder: StoreOrder = {
      id: orderId,
      userId: customerId,
      userName: customerName,
      items: lineItems.map(({ itemId, name, quantity, unitPrice }) => ({
        itemId,
        name,
        quantity,
        unitPrice,
      })),
      totalAmount,
      deliveryFee,
      deliveryCommission: deliveryFee,
      fulfillment: payload.fulfillment,
      deliveryNote: payload.deliveryNote?.trim() || undefined,
      paymentMethod: payload.paymentMethod,
      status: isPickup ? 'Completed' : 'Confirmed',
      deliveryStatus: isPickup ? 'Delivered' : 'Pending Dispatch',
      assignedRunnerId: isPickup ? undefined : defaultRunner?.id,
      assignedRunner: runnerName,
      cashCollected: isCash,
      createdAt: nowLabel,
      orderDateIso: todayIso,
      deliveredAt: isPickup ? nowLabel : undefined,
      dueDateLabel: isDebt ? nextDueLabel : undefined,
      source: 'store',
      logs: [
        {
          id: `lg-${Date.now()}-1`,
          timestamp: nowLabel,
          event: `Manual walk-in sales order recorded via ${payload.paymentMethod} (${payload.fulfillment})`,
          actor: actorName,
        },
      ],
    };

    const previousOrders = orders;
    const previousItems = items;
    const previousUsers = users;

    setOrders((prev) => [newOrder, ...prev]);
    setItems((prev) =>
      prev.map((item) => {
        const sold = lineItems.find((l) => l.itemId === item.id);
        if (!sold) return item;
        return {
          ...item,
          stock: Math.max(0, item.stock - sold.quantity),
          soldCount: item.soldCount + sold.quantity,
        };
      })
    );

    const nextDebt = targetCoworker
      ? isDebt
        ? targetCoworker.debtBalance + totalAmount
        : targetCoworker.debtBalance
      : 0;
    const nextSpent = targetCoworker ? targetCoworker.totalSpent + totalAmount : 0;

    if (targetCoworker) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetCoworker.id
            ? { ...u, debtBalance: nextDebt, totalSpent: nextSpent }
            : u
        )
      );
      if (authUser?.id === targetCoworker.id) {
        setAuthUser((prev) =>
          prev ? { ...prev, debtBalance: nextDebt, totalSpent: nextSpent } : prev
        );
      }
    }

    try {
      await saveOrder(newOrder);
      await Promise.all(
        lineItems.map((sold) =>
          updateStoreItemStock(
            sold.product.id,
            Math.max(0, sold.product.stock - sold.quantity),
            sold.product.soldCount + sold.quantity
          )
        )
      );
      if (targetCoworker) {
        await updateUserCheckoutTotals(targetCoworker.id, nextDebt, nextSpent);
      }
      return newOrder;
    } catch (err) {
      setOrders(previousOrders);
      setItems(previousItems);
      setUsers(previousUsers);
      throw err;
    }
  };

  const handleAdjustStock = async (payload: {
    itemId: string;
    adjustmentType: 'add' | 'deduct' | 'recount';
    quantityOrCount: number;
    reason: string;
    note?: string;
  }): Promise<StockAdjustmentLog> => {
    const actorId = authUser?.id ?? currentUser?.id;
    if (!actorId) {
      throw new Error('Sign in with an Admin account to record stock adjustments.');
    }
    const target = items.find((i) => i.id === payload.itemId);
    if (!target) {
      throw new Error('Selected item was not found.');
    }

    const previousStock = target.stock;
    const qty = Math.max(0, Math.round(payload.quantityOrCount));
    let newStock = previousStock;
    let delta = 0;

    if (payload.adjustmentType === 'add') {
      if (qty <= 0) throw new Error('Adjustment quantity must be greater than 0.');
      delta = qty;
      newStock = previousStock + qty;
    } else if (payload.adjustmentType === 'deduct') {
      if (qty <= 0) throw new Error('Deduction quantity must be greater than 0.');
      if (qty > previousStock) {
        throw new Error(`Cannot deduct ${qty} units — only ${previousStock} in stock.`);
      }
      delta = -qty;
      newStock = previousStock - qty;
    } else {
      newStock = qty;
      delta = qty - previousStock;
      if (delta === 0) {
        throw new Error('Physical count matches current stock.');
      }
    }

    const nowMs = Date.now();
    const todayIso = new Date(nowMs).toISOString().slice(0, 10);
    const nowTime = new Date(nowMs).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const logEntry: StockAdjustmentLog = {
      id: `adj-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: target.id,
      itemName: target.name.slice(0, 140),
      itemCategory: target.category.slice(0, 80),
      barcode: target.barcode?.slice(0, 64) || undefined,
      adjustmentType: payload.adjustmentType,
      reason: payload.reason.trim().slice(0, 120) || 'Manual Stock Adjustment',
      note: payload.note?.trim().slice(0, 400) || undefined,
      previousStock,
      delta,
      newStock,
      unitCostAtTime: target.costPrice,
      adjustedById: actorId,
      adjustedByName: (authUser?.name ?? currentUser?.name ?? 'Admin').slice(0, 120),
      createdAt: `${todayIso} ${nowTime}`,
      createdAtMs: nowMs,
    };

    const updatedItem: StoreItem = {
      ...target,
      stock: newStock,
    };

    const previousItems = items;
    const previousLogs = stockAdjustments;
    setItems((prev) => prev.map((i) => (i.id === target.id ? updatedItem : i)));
    setStockAdjustments((prev) => [logEntry, ...prev]);

    try {
      await recordStockAdjustment(updatedItem, logEntry);
      return logEntry;
    } catch (err) {
      setItems(previousItems);
      setStockAdjustments(previousLogs);
      throw err;
    }
  };

  const handleSendReminders = () => {
    const debtors = users.filter((u) => u.debtBalance > 0);
    const nowMs = Date.now();
    debtors.forEach((debtor, idx) => {
      void createNotificationDoc({
        id: `notif-rem-${nowMs}-${idx}`,
        title: `Store Credit Cutoff Reminder (${nextDueLabel})`,
        body: `You have an open balance of ${formatPHP(debtor.debtBalance, true)} due by ${nextDueLabel}.`,
        timestamp: 'Just now',
        type: 'reminder',
        read: false,
        targetUserId: debtor.id,
      });
    });
  };

  const handleSendMessage = (threadId: string, text: string) => {
    if (!currentUser) return;
    const msg = {
      id: `m-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t
      )
    );
    void addChatMessageToThread(threadId, msg);
  };

  const handleReceiveAiReply = (threadId: string, replyText: string) => {
    const aiMsg = {
      id: `m-ai-${Date.now()}`,
      senderId: 'ai',
      senderName: 'DeskPantry AI',
      senderRole: 'ai' as const,
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, aiMsg] } : t
      )
    );
    void addChatMessageToThread(threadId, aiMsg);
  };

  const handleMarkThreadRead = (threadId: string) => {
    const target = threads.find((t) => t.id === threadId);
    if (!target || target.unreadCount === 0) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t))
    );
    void markThreadUnreadCount(threadId, 0);
  };

  const handleCreateEWalletPost = (payload: {
    type: 'sell' | 'buy';
    walletProvider: string;
    totalAmount: number;
    accountNumber: string;
    accountName: string;
    notes?: string;
  }) => {
    if (!currentUser) return;
    const nowLabel = `Today · ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const newPost: EWalletPost = {
      id: `ew-${Date.now()}`,
      type: payload.type,
      walletProvider: payload.walletProvider,
      totalAmount: payload.totalAmount,
      remainingAmount: payload.totalAmount,
      accountNumber: payload.accountNumber,
      accountName: payload.accountName,
      notes: payload.notes,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorDepartment: currentUser.department,
      createdAt: nowLabel,
      status: 'Open',
      fills: [],
      comments: [],
    };
    setEWalletPosts((prev) => [newPost, ...prev]);
    void saveEWalletPost(newPost);
  };

  const handleClaimEWalletShare = (postId: string, amount: number, note?: string) => {
    if (!currentUser) return;
    const target = ewalletPosts.find((p) => p.id === postId);
    if (!target || target.remainingAmount <= 0) return;
    const nowLabel = `Today · ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const take = Math.min(target.remainingAmount, Math.max(1, amount));
    const nextRemaining = Math.max(0, target.remainingAmount - take);
    const nextStatus: EWalletPost['status'] =
      nextRemaining === 0 ? 'Completed' : 'Partially Filled';
    const nextFills = [
      ...target.fills,
      {
        id: `ewf-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userDepartment: currentUser.department,
        amount: take,
        createdAt: nowLabel,
        note,
      },
    ];

    setEWalletPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, remainingAmount: nextRemaining, status: nextStatus, fills: nextFills }
          : p
      )
    );
    void updateEWalletPostPartial(postId, {
      remainingAmount: nextRemaining,
      status: nextStatus,
      fills: nextFills,
      comments: target.comments,
    });
  };

  const handleAddEWalletComment = (postId: string, text: string) => {
    if (!currentUser) return;
    const target = ewalletPosts.find((p) => p.id === postId);
    if (!target) return;
    const nowLabel = `Today · ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const nextComments = [
      ...target.comments,
      {
        id: `ewc-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userDepartment: currentUser.department,
        text,
        createdAt: nowLabel,
      },
    ];
    setEWalletPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: nextComments } : p))
    );
    void updateEWalletPostPartial(postId, {
      remainingAmount: target.remainingAmount,
      status: target.status,
      fills: target.fills,
      comments: nextComments,
    });

    if (target.authorId && target.authorId !== currentUser.id) {
      void createNotificationDoc({
        id: `notif-ewc-${Date.now()}`,
        title: `New Comment on Your ${target.walletProvider} Post`.slice(0, 140),
        body: `${currentUser.name} commented on your ${
          target.type === 'sell' ? 'Sell' : 'Buy'
        } ${target.walletProvider} post: "${text.trim().slice(0, 160)}"`.slice(0, 500),
        timestamp: 'Just now',
        type: 'ewallet',
        read: false,
        targetUserId: target.authorId,
      });
    }
  };

  const canPersistReadInFirestore = (notif: NotificationItem): boolean => {
    if (!authUser?.id) return false;
    if (notif.targetUserId === authUser.id) return true;
    if (
      notif.targetUserId === 'delivery' &&
      (actualRole === UserRole.DeliveryStaff || isActualAdmin)
    ) {
      return true;
    }
    if (notif.targetUserId === 'admins' && isActualAdmin) return true;
    if (notif.targetUserId === 'super_admin' && isActualSuperAdmin) return true;
    return false;
  };

  const persistLocalReadMap = (nextMap: Record<string, boolean>) => {
    if (!authUser?.id) return;
    try {
      window.localStorage.setItem(
        `deskpantry_read_notifs_${authUser.id}`,
        JSON.stringify(nextMap)
      );
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleMarkNotificationRead = (notif: NotificationItem) => {
    setLocalReadNotifIds((prev) => {
      const next = { ...prev, [notif.id]: true };
      persistLocalReadMap(next);
      return next;
    });
    if (canPersistReadInFirestore(notif)) {
      void markNotificationReadDoc(notif.id);
    }
  };

  const handleMarkAllNotificationsRead = () => {
    const nextIds: Record<string, boolean> = {};
    for (const n of effectiveNotifications) {
      nextIds[n.id] = true;
      if (!n.read && canPersistReadInFirestore(n)) {
        void markNotificationReadDoc(n.id);
      }
    }
    setLocalReadNotifIds((prev) => {
      const merged = { ...prev, ...nextIds };
      persistLocalReadMap(merged);
      return merged;
    });
  };

  const navigateTo = (section: ActiveSection) => {
    setActiveSection(section);
    setIsMobileDrawerOpen(false);
    setIsNotifOpen(false);
    setIsProfileMenuOpen(false);
  };

  const openSalesOrderTab = () => {
    if (!isAdminOrSuper) return;
    setRequestedAdminSubTab({ tab: 'salesOrder', nonce: Date.now() });
    navigateTo('admin');
  };

  const getRoleDisplayLabel = (role: UserRole) => {
    if (role === UserRole.SuperAdmin) return 'Super Admin';
    if (role === UserRole.Admin) return 'Admin';
    if (role === UserRole.DeliveryStaff) return 'Delivery Staff';
    if (role === UserRole.Member) return 'Coworker';
    return 'Guest';
  };

  const sidebarItems: {
    id: ActiveSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'store', label: 'Storefront', icon: Store },
    {
      id: 'ewallet',
      label: 'Buy/Sell E-Wallet',
      icon: ArrowLeftRight,
      badge: openEWalletCount,
    },
    {
      id: 'community',
      label: 'Community',
      icon: Users,
      badge: unreadCommunityCount,
    },
    ...(currentUser && currentRole !== UserRole.Guest
      ? [
          {
            id: 'seller' as ActiveSection,
            label: 'Seller Dashboard',
            icon: BarChart3,
            badge:
              sellerDebtSummary.pendingOrdersCount +
              sellerDebtSummary.pendingProofsCount +
              sellerDebtSummary.unpaidCount,
          },
        ]
      : []),
    ...(canViewPautanganNav
      ? [{ id: 'pautangan' as ActiveSection, label: 'Pautangan', icon: HandCoins }]
      : []),
    { id: 'ledger', label: 'My Ledger', icon: LayoutDashboard },
    ...(canViewDeliveryNav
      ? [
          {
            id: 'delivery' as ActiveSection,
            label: 'Delivery Staff',
            icon: Truck,
            badge: pendingDeliveriesCount,
          },
        ]
      : []),
    { id: 'chat', label: 'Chat & AI', icon: MessageSquare, badge: unreadChatCount },
    // Config tab is NOT visible to public / non-admin roles
    ...(isAdminOrSuper
      ? [
          {
            id: 'admin' as ActiveSection,
            label: 'Admin Config',
            icon: ShieldCheck,
            badge: pendingProofsCount + pendingOrdersCount,
          },
        ]
      : []),
    { id: 'apps', label: 'Other Apps', icon: Grid },
  ];

  const renderAvatar = (
    user: UserAccount | null,
    sizeClass: string,
    textClass: string,
    guestLabel = 'GV'
  ) => {
    if (user?.avatarUrl && !avatarFailed) {
      return (
        <img
          src={user.avatarUrl}
          alt={user.name}
          referrerPolicy="no-referrer"
          onError={() => setAvatarFailed(true)}
          className={`${sizeClass} rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0`}
        />
      );
    }
    return (
      <div
        className={`${sizeClass} rounded-full bg-teal-700/15 dark:bg-teal-500/20 text-teal-800 dark:text-teal-200 ${textClass} font-bold flex items-center justify-center shrink-0`}
      >
        {user ? user.avatarInitials : guestLabel}
      </div>
    );
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col justify-between h-full gap-6">
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="px-3 text-xs font-semibold text-stone-400 dark:text-stone-500">
            Navigation
          </div>
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F2E2A] dark:bg-teal-700 text-white'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#172523] hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-teal-300 dark:text-teal-200' : 'text-stone-500 dark:text-stone-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account Summary Box */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {renderAvatar(currentUser, 'w-9 h-9', 'text-xs')}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                  {currentUser ? currentUser.name : 'Guest Visitor'}
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  {currentUser
                    ? currentUser.department
                    : authReady
                      ? 'Sign in with Gmail to order'
                      : 'Checking session...'}
                </div>
              </div>
            </div>
            {currentUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline shrink-0 cursor-pointer"
              >
                Log out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setIsSignInOpen(true);
                }}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
          {currentUser && (
            <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs">
              <span className="text-stone-500 dark:text-stone-400">Store Debt</span>
              <span className="font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                {formatPHP(currentUser.debtBalance, true)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Role Access & Utilities */}
      <div className="space-y-4 pt-4 border-t border-stone-200 dark:border-stone-800">
        {isActualSuperAdmin ? (
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                Role View Preview
              </span>
              {isPreviewingOtherRole && (
                <button
                  type="button"
                  onClick={() => setPreviewRole(null)}
                  className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { role: UserRole.Guest, label: 'Guest' },
                { role: UserRole.Member, label: 'Coworker' },
                { role: UserRole.DeliveryStaff, label: 'Delivery' },
                { role: UserRole.Admin, label: 'Admin' },
                { role: UserRole.SuperAdmin, label: 'Super Admin' },
              ].map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => {
                    setPreviewRole(r.role === UserRole.SuperAdmin ? null : r.role);
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    currentRole === r.role
                      ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200'
                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#1F312E]'
                  } ${r.role === UserRole.SuperAdmin ? 'col-span-2' : ''}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        ) : authUser ? (
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] px-3 py-2.5 flex items-center justify-between text-xs">
            <span className="text-stone-500 dark:text-stone-400">Assigned Role</span>
            <span className="font-semibold text-teal-700 dark:text-teal-400">
              {getRoleDisplayLabel(actualRole)}
            </span>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3 space-y-2">
            <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
              Coworker Access
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              Sign in with your Gmail account to place pantry orders, sync your avatar, and view your ledger.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsMobileDrawerOpen(false);
                setIsSignInOpen(true);
              }}
              className="w-full min-h-[38px] rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer"
            >
              Sign in with Gmail
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => {
              setIsQROpen(true);
              setIsMobileDrawerOpen(false);
            }}
            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#1F312E] flex items-center gap-2 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>Share QR Code</span>
          </button>

          <PWAInstallButton compact />
        </div>
      </div>
    </div>
  );

  const topNavLinks = [
    { id: 'store', label: 'Store', badge: 0 },
    ...(isAdminOrSuper
      ? [{ id: 'salesOrderShortcut', label: 'Sales Order', badge: pendingOrdersCount }]
      : []),
    { id: 'ewallet', label: 'Buy/Sell E-Wallet', badge: openEWalletCount },
    { id: 'community', label: 'Community', badge: unreadCommunityCount },
    ...(currentUser && currentRole !== UserRole.Guest
      ? [{ id: 'seller', label: 'Seller Hub', badge: sellerDebtSummary.unpaidCount }]
      : []),
    ...(canViewPautanganNav ? [{ id: 'pautangan', label: 'Pautangan', badge: 0 }] : []),
    ...(canViewDeliveryNav
      ? [{ id: 'delivery', label: 'Delivery', badge: pendingDeliveriesCount }]
      : []),
    // Config tab strictly hidden from public, Coworker, and Delivery Staff
    ...(isAdminOrSuper
      ? [
          {
            id: 'admin',
            label: 'Admin Config',
            badge: pendingProofsCount + pendingOrdersCount,
          },
        ]
      : []),
    { id: 'chat', label: 'Chat', badge: 0 },
  ];

  const activeMobileLabel =
    sidebarItems.find((item) => item.id === activeSection)?.label ?? 'Store';

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F5] dark:bg-[#0B1211] text-stone-900 dark:text-stone-100 pb-20 lg:pb-8 overflow-x-clip">
      {/* Primary Deep-Pine Web Navigation Bar */}
      <header className="sticky top-0 z-30 web-nav-gradient text-white border-b border-teal-950/40 shadow-xs">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          {/* Zone 1: Mobile Menu Trigger + Brand Wordmark + Mobile Active View Context */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 -ml-1 flex items-center justify-center rounded-xl text-teal-100 hover:bg-white/10 active:bg-white/15 transition-colors shrink-0 cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => navigateTo('store')}
              className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
            >
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-white font-display whitespace-nowrap shrink-0">
                DeskPantry
              </span>
              <span className="lg:hidden text-teal-300/60 text-xs shrink-0" aria-hidden="true">
                /
              </span>
              <span className="lg:hidden text-xs font-medium text-teal-100/85 truncate">
                {activeMobileLabel}
              </span>
            </button>
          </div>

          {/* Zone 2: Concise single-line desktop web navigation links */}
          <nav className="hidden lg:flex items-center gap-3.5 xl:gap-5 text-[13px] xl:text-sm font-medium text-teal-100/80 min-w-0">
            {topNavLinks.map((link) => {
              const active =
                link.id === 'salesOrderShortcut'
                  ? activeSection === 'admin' && requestedAdminSubTab?.tab === 'salesOrder'
                  : activeSection === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => {
                    if (link.id === 'salesOrderShortcut') {
                      openSalesOrderTab();
                    } else {
                      navigateTo(link.id as ActiveSection);
                    }
                  }}
                  className={`py-1.5 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'text-white font-semibold border-b-2 border-teal-300'
                      : 'hover:text-white'
                  }`}
                >
                  {link.id === 'salesOrderShortcut' && (
                    <ClipboardList className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                  )}
                  <span>
                    {link.id === 'ewallet' ? (
                      <>
                        <span className="hidden xl:inline">Buy/Sell </span>E-Wallet
                      </>
                    ) : (
                      link.label
                    )}
                  </span>
                  {link.badge > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-teal-400 text-[#0F2E2A] text-[10px] font-extrabold inline-flex items-center justify-center tabular-nums">
                      {link.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Theme Toggle + Message Indicator + Notification Bell + Cart & Avatar */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 relative">
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-teal-100 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              title={darkMode ? 'Light Theme' : 'Dark Theme'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              )}
            </button>

            {currentRole !== UserRole.Guest && currentUser && (
              <>
                <button
                  type="button"
                  onClick={() => navigateTo('chat')}
                  className="hidden sm:flex relative w-9 h-9 sm:w-10 sm:h-10 items-center justify-center rounded-xl text-teal-100 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  aria-label={`Messages (${unreadChatCount} unread)`}
                  title="Open Messages & Chat"
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  {unreadChatCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-teal-400 text-[#0F2E2A] text-[9px] font-extrabold flex items-center justify-center tabular-nums ring-2 ring-[#0F2E2A]">
                      {unreadChatCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsNotifOpen((prev) => !prev);
                  }}
                  className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-teal-100 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  aria-label={`Notifications (${unreadNotifCount} unread)`}
                  title="Notifications"
                >
                  <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-stone-950 text-[9px] font-extrabold flex items-center justify-center tabular-nums ring-2 ring-[#0F2E2A]">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>
              </>
            )}

            <span className="h-5 w-px bg-white/15 mx-0.5 sm:mx-1 shrink-0" aria-hidden="true" />

            {currentRole === UserRole.Guest || !currentUser ? (
              <button
                type="button"
                onClick={() => setIsSignInOpen(true)}
                className="h-9 sm:h-10 rounded-xl bg-white px-3 sm:px-4 text-xs font-bold text-[#0F2E2A] hover:bg-teal-50 shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0 relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsNotifOpen(false);
                    setActiveSection('store');
                    setIsCartOpen(true);
                  }}
                  aria-label={`Open cart with ${cartCount} items`}
                  className="h-9 sm:h-10 inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 sm:px-3.5 text-xs font-bold text-[#0F2E2A] hover:bg-teal-50 shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span className="sm:hidden tabular-nums">{cartCount}</span>
                  <span className="hidden sm:inline tabular-nums">Cart ({cartCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsNotifOpen(false);
                    setIsProfileMenuOpen((prev) => !prev);
                  }}
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="menu"
                  title={`${currentUser.name} (${currentUser.email}) — Account Menu`}
                  aria-label={`Account menu for ${currentUser.name}`}
                  className="h-9 sm:h-10 inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 p-1 sm:pr-2 text-xs font-semibold text-white transition-colors shrink-0 cursor-pointer"
                >
                  {currentUser.avatarUrl && !avatarFailed ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-white/40 shrink-0"
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-teal-400 text-[#0F2E2A] text-[11px] font-extrabold flex items-center justify-center shrink-0">
                      {currentUser.avatarInitials}
                    </span>
                  )}
                  <span className="hidden xl:inline max-w-[96px] truncate">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <ChevronDown
                    className={`hidden sm:block w-3.5 h-3.5 text-teal-200 transition-transform ${
                      isProfileMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Signed-In User Profile Dropdown Menu */}
                {isProfileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsProfileMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <div
                      role="menu"
                      aria-label="User account menu"
                      className="fixed sm:absolute right-3 sm:right-0 top-[60px] sm:top-12 z-50 w-64 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] text-stone-900 dark:text-stone-100 shadow-2xl overflow-hidden"
                    >
                      <div className="p-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] flex items-center gap-3">
                        {renderAvatar(currentUser, 'w-10 h-10', 'text-sm')}
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                            {currentUser.name}
                          </div>
                          <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                            {currentUser.email}
                          </div>
                          <div className="mt-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                            {getRoleDisplayLabel(currentUser.role)} · {currentUser.department}
                          </div>
                        </div>
                      </div>

                      <div className="p-1.5 space-y-0.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => navigateTo('ledger')}
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#172523] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5">
                            <LayoutDashboard className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                            <span>My Ledger &amp; Orders</span>
                          </span>
                          <span className="font-mono text-[11px] font-bold text-stone-500 dark:text-stone-400 tabular-nums">
                            {formatPHP(currentUser.debtBalance, true)}
                          </span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => navigateTo('seller')}
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#172523] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5">
                            <BarChart3 className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                            <span>Seller Dashboard</span>
                          </span>
                          <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                            {formatPHP(sellerDebtSummary.collectablesTotal, true)}
                          </span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            setIsSignInOpen(true);
                          }}
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#172523] flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                          <span>Switch Google Account</span>
                        </button>

                        <div className="my-1 border-t border-stone-200 dark:border-stone-800" />

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleSignOut()}
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notification Bell Dropdown Popover (Signed-in Users Only) */}
            {isNotifOpen && currentUser && currentRole !== UserRole.Guest && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsNotifOpen(false)}
                  aria-hidden="true"
                />
                <div className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto top-[60px] sm:top-12 z-50 sm:w-96 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] text-stone-900 dark:text-stone-100 shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-[#172523]">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      Notifications ({unreadNotifCount} unread)
                    </span>
                    <div className="flex items-center gap-3">
                      {unreadNotifCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsNotifOpen(false)}
                        className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-stone-200 dark:divide-stone-800 max-h-80 overflow-y-auto">
                    {effectiveNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                        No notifications yet.
                      </div>
                    ) : (
                      effectiveNotifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            handleMarkNotificationRead(n);
                            if (n.type === 'delivery') {
                              navigateTo(canViewDeliveryNav ? 'delivery' : 'ledger');
                            } else if (n.type === 'payment') {
                              if (n.targetUserId === 'admins' && isAdminOrSuper) {
                                if (n.title.toLowerCase().includes('awaiting confirmation')) {
                                  setRequestedAdminSubTab({ tab: 'salesOrder', nonce: Date.now() });
                                } else {
                                  setRequestedAdminSubTab({ tab: 'proofs', nonce: Date.now() });
                                }
                                navigateTo('admin');
                              } else {
                                navigateTo('ledger');
                              }
                            } else if (n.type === 'marketplace') {
                              navigateTo(
                                n.targetUserId === 'super_admin' &&
                                  currentRole === UserRole.SuperAdmin
                                  ? 'admin'
                                  : 'community'
                              );
                            } else if (n.type === 'reminder') {
                              navigateTo('ledger');
                            } else if (n.type === 'ewallet') {
                              navigateTo('ewallet');
                            } else if (n.type === 'community') {
                              navigateTo('community');
                            } else if (n.type === 'chat') {
                              navigateTo('chat');
                            }
                          }}
                          className={`w-full text-left p-3.5 space-y-1 transition-colors hover:bg-stone-50 dark:hover:bg-[#172523] cursor-pointer ${
                            !n.read
                              ? 'bg-teal-50/40 dark:bg-teal-950/35'
                              : 'bg-white dark:bg-[#121D1B]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-stone-900 dark:text-stone-100">
                              {!n.read ? 'New · ' : ''}
                              {n.title}
                            </span>
                            <span className="text-stone-400 shrink-0">{n.timestamp}</span>
                          </div>
                          <p className="text-xs text-stone-600 dark:text-stone-400">{n.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main 2-Column Web Application Workspace */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex gap-8 items-start">
        {/* Desktop Web Left Navigation Rail */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-24 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
          {renderSidebarContent()}
        </aside>

        {/* Primary View Canvas */}
        <main className="flex-1 min-w-0 space-y-5">
          {isPreviewingOtherRole && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 font-medium">
                <Eye className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>
                  Previewing Role View: <strong>{getRoleDisplayLabel(currentRole)}</strong> (Super Admin session remains active).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRole(null)}
                className="rounded-lg bg-amber-900 dark:bg-amber-400 text-white dark:text-stone-950 px-3 py-1 font-semibold hover:opacity-90 cursor-pointer"
              >
                Exit Preview
              </button>
            </div>
          )}

          {activeSection === 'store' && (
            <StorefrontView
              items={items}
              isLoading={isStoreLoading}
              cart={cart}
              currentUser={currentUser}
              currentRole={currentRole}
              dueDays={pautanganSettings.dueDays}
              nextDueLabel={nextDueLabel}
              storeConfig={storeConfig}
              onAddToCart={handleAddToCart}
              onUpdateCartQty={handleUpdateCartQty}
              onClearCart={() => setCart([])}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onOpenQRShare={() => setIsQROpen(true)}
              onOpenSalesOrder={isAdminOrSuper ? openSalesOrderTab : undefined}
              pendingOrdersCount={pendingOrdersCount}
              onPlaceOrder={handlePlaceOrder}
              isCartOpen={isCartOpen}
              setIsCartOpen={setIsCartOpen}
            />
          )}

          {activeSection === 'ewallet' && (
            <EWalletExchangeView
              posts={ewalletPosts}
              currentUser={currentUser}
              currentRole={currentRole}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onCreatePost={handleCreateEWalletPost}
              onClaimShare={handleClaimEWalletShare}
              onAddComment={handleAddEWalletComment}
            />
          )}

          {activeSection === 'community' && (
            <CommunityFeedView
              suggestions={suggestions}
              listings={listings}
              categories={storeConfig.categories}
              unreadCommunityCount={unreadCommunityCount}
              lastFeedEvent={lastFeedEvent}
              currentUser={currentUser}
              currentRole={currentRole}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onClearCommunityUnread={() => setUnreadCommunityCount(0)}
              onToggleVote={handleToggleVote}
              onCreateSuggestion={handleCreateSuggestion}
              onCreateListing={handleCreateListing}
              onBuyListing={handleBuyListing}
              onOpenSellerDashboard={() => navigateTo('seller')}
              sellerCollectablesTotal={sellerDebtSummary.collectablesTotal}
              openSellFormSignal={openCommunitySellSignal}
            />
          )}

          {activeSection === 'seller' && (
            <SellerDashboardView
              currentUser={currentUser}
              currentRole={currentRole}
              listings={listings}
              orders={orders}
              proofs={proofs}
              sellerConfig={sellerConfig}
              nextDueLabel={nextDueLabel}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onGoToCommunity={(openSellForm) => {
                if (openSellForm) {
                  setOpenCommunitySellSignal((n) => n + 1);
                }
                navigateTo('community');
              }}
              onConfirmOrder={handleSellerConfirmOrder}
              onRejectOrder={handleSellerRejectOrder}
              onReviewSellerProof={handleReviewSellerProof}
              onSendDebtReminder={handleSendSellerDebtReminder}
              onMarkOrderDebtSettled={handleMarkSellerOrderDebtSettled}
              onUpdateListingConfig={handleUpdateSellerListingConfig}
              onDeleteListing={async (listingId) => {
                setListings((prev) => prev.filter((l) => l.id !== listingId));
                await removeMarketplaceListing(listingId);
              }}
              onSaveSellerConfig={handleSaveSellerConfig}
            />
          )}

          {activeSection === 'pautangan' && canViewPautanganNav && (
            <PautanganView
              settings={pautanganSettings}
              loans={loans}
              paymentMethods={storeConfig.paymentMethods}
              currentUser={currentUser}
              currentRole={currentRole}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onOpenLedger={() => navigateTo('ledger')}
              onRequestLoan={handleRequestLoan}
              onRepayLoan={handleRepayLoan}
            />
          )}

          {activeSection === 'ledger' && (
            <LedgerDashboardView
              currentUser={currentUser}
              currentRole={currentRole}
              users={users}
              orders={orders}
              listings={listings}
              loans={loans}
              proofs={proofs}
              paymentMethods={storeConfig.paymentMethods}
              ownerTotalCommission={ownerCommissionEarned}
              dueDays={pautanganSettings.dueDays}
              nextDueLabel={nextDueLabel}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onSubmitDebtProof={handleSubmitDebtProof}
              onSubmitSellerDebtProof={handleSubmitSellerDebtProof}
              onFetchSellerConfig={getSellerConfigById}
            />
          )}

          {activeSection === 'delivery' && canViewDeliveryNav && (
            <DeliveryStaffView
              orders={orders}
              currentUser={currentUser}
              currentRole={currentRole}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
              onExitPreview={isPreviewingOtherRole ? () => setPreviewRole(null) : undefined}
            />
          )}

          {activeSection === 'admin' && isAdminOrSuper && (
            <AdminConsoleView
              currentRole={currentRole}
              currentUser={currentUser}
              users={users}
              items={items}
              orders={orders}
              proofs={storeProofs}
              listings={listings}
              loans={loans}
              pautanganSettings={pautanganSettings}
              storeConfig={storeConfig}
              ownerTotalCommission={ownerCommissionEarned}
              onReviewProof={handleReviewProof}
              onReviewListing={handleReviewListing}
              onDeleteListing={handleDeleteListing}
              onUpdateDueDays={(d1, d2) => {
                const nextDays: [number, number] = [d1, d2];
                dueDaysRef.current = nextDays;
                const nextSettings = { ...pautanganSettings, dueDays: nextDays };
                setPautanganSettings(nextSettings);
                void savePautanganSettings(nextSettings);
              }}
              onSendReminders={handleSendReminders}
              onUpdatePautanganGlobal={(enabled, rate) => {
                const nextSettings = {
                  ...pautanganSettings,
                  globalEnabled: enabled,
                  monthlyInterestRate: rate,
                };
                setPautanganSettings(nextSettings);
                void savePautanganSettings(nextSettings);
              }}
              onUpdatePautanganTerms={(terms) => {
                const nextSettings = {
                  ...pautanganSettings,
                  availableTerms: terms,
                };
                setPautanganSettings(nextSettings);
                void savePautanganSettings(nextSettings);
              }}
              onToggleUserPautangan={(userId, enabled, limit) => {
                const target = users.find((u) => u.id === userId);
                if (!target) return;
                const updated: UserAccount = {
                  ...target,
                  pautanganEnabled: enabled,
                  pautanganLimit: limit,
                };
                setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
                if (authUser?.id === userId) setAuthUser(updated);
                void saveUserAccount(updated);
              }}
              onUpdateUserRole={(userId, role) => {
                const target = users.find((u) => u.id === userId);
                if (!target) return;
                const updated: UserAccount = { ...target, role };
                setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
                if (authUser?.id === userId) setAuthUser(updated);
                void saveUserAccount(updated);
              }}
              onAddDeliveryStaff={(name, email, department) => {
                const initials = name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const staff: UserAccount = {
                  id: `u-staff-${Date.now()}`,
                  name,
                  email: email.trim().toLowerCase(),
                  department,
                  role: UserRole.DeliveryStaff,
                  debtBalance: 0,
                  pautanganEnabled: true,
                  pautanganLimit: 3000,
                  avatarInitials: initials || 'DS',
                  totalSpent: 0,
                };
                setUsers((prev) => [...prev, staff]);
                void saveUserAccount(staff);
              }}
              onUpdateStoreConfig={(next) => {
                setStoreConfig(next);
                void saveStoreConfig(next, dueDaysRef.current);
              }}
              onAddCategory={(cat) => {
                if (storeConfig.categories.includes(cat)) return;
                const next = {
                  ...storeConfig,
                  categories: [...storeConfig.categories, cat],
                };
                setStoreConfig(next);
                void saveStoreConfig(next, dueDaysRef.current);
              }}
              onEditCategory={(oldName, newName) => {
                const nextConfig = {
                  ...storeConfig,
                  categories: storeConfig.categories.map((c) =>
                    c === oldName ? newName : c
                  ),
                };
                setStoreConfig(nextConfig);
                void saveStoreConfig(nextConfig, dueDaysRef.current);

                setItems((prev) =>
                  prev.map((i) => {
                    if (i.category !== oldName) return i;
                    const updated = { ...i, category: newName };
                    void saveStoreItem(updated);
                    return updated;
                  })
                );
                setSuggestions((prev) =>
                  prev.map((s) => {
                    if (s.category !== oldName) return s;
                    const updated = { ...s, category: newName };
                    void saveSuggestion(updated);
                    return updated;
                  })
                );
              }}
              onRemoveCategory={async (cat) => {
                const previousConfig = storeConfig;
                const nextConfig = {
                  ...storeConfig,
                  categories: storeConfig.categories.filter((c) => c !== cat),
                };
                setStoreConfig(nextConfig);
                try {
                  await saveStoreConfig(nextConfig, dueDaysRef.current);
                } catch (err) {
                  setStoreConfig(previousConfig);
                  throw err;
                }
              }}
              onRestockItem={async (itemId, amount, options) => {
                const target = items.find((i) => i.id === itemId);
                if (!target) return;
                const previousItems = items;
                const todayIso = new Date().toISOString().slice(0, 10);
                const nextCost =
                  options?.unitCost !== undefined && options.unitCost >= 0
                    ? options.unitCost
                    : target.costPrice;
                const nextSell =
                  options?.sellingPrice !== undefined && options.sellingPrice >= 1
                    ? options.sellingPrice
                    : target.price;
                const costOrPriceChanged =
                  nextCost !== target.costPrice ||
                  nextSell !== target.price ||
                  Boolean(options?.note?.trim());
                const nextBarcode =
                  options?.barcode !== undefined
                    ? options.barcode.trim().slice(0, 64) || undefined
                    : target.barcode;

                const updated: StoreItem = {
                  ...target,
                  stock: Math.max(0, target.stock + amount),
                  costPrice: nextCost,
                  price: nextSell,
                  barcode: nextBarcode,
                  costHistory: costOrPriceChanged
                    ? [
                        ...(target.costHistory ?? []),
                        {
                          id: `ch-${Date.now()}`,
                          date: todayIso,
                          costPrice: nextCost,
                          sellingPrice: nextSell,
                          note:
                            options?.note?.trim() ||
                            `Restocked +${amount} units${
                              nextCost !== target.costPrice ? ' (updated unit cost)' : ''
                            }`,
                          updatedBy: currentUser?.name ?? 'Admin',
                        },
                      ]
                    : target.costHistory,
                };
                const previousLogs = stockAdjustments;
                const actorId = authUser?.id ?? currentUser?.id;
                const nowMs = Date.now();
                const nowTime = new Date(nowMs).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const restockLog: StockAdjustmentLog | null = actorId
                  ? {
                      id: `adj-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
                      itemId: target.id,
                      itemName: target.name.slice(0, 140),
                      itemCategory: target.category.slice(0, 80),
                      barcode: updated.barcode?.slice(0, 64) || undefined,
                      adjustmentType: 'restock',
                      reason: 'Supplier Restock',
                      note: options?.note?.trim().slice(0, 400) || undefined,
                      previousStock: target.stock,
                      delta: updated.stock - target.stock,
                      newStock: updated.stock,
                      unitCostAtTime: nextCost,
                      adjustedById: actorId,
                      adjustedByName: (authUser?.name ?? currentUser?.name ?? 'Admin').slice(0, 120),
                      createdAt: `${todayIso} ${nowTime}`,
                      createdAtMs: nowMs,
                    }
                  : null;

                setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
                if (restockLog) {
                  setStockAdjustments((prev) => [restockLog, ...prev]);
                }
                try {
                  if (restockLog) {
                    await recordStockAdjustment(updated, restockLog);
                  } else {
                    await saveStoreItem(updated);
                  }
                } catch (err) {
                  setItems(previousItems);
                  setStockAdjustments(previousLogs);
                  throw err;
                }
              }}
              onUpdateItemBarcode={async (itemId, barcode) => {
                const target = items.find((i) => i.id === itemId);
                if (!target) return;
                const previousItems = items;
                const cleanBarcode = barcode.trim().slice(0, 64);
                const updated: StoreItem = {
                  ...target,
                  barcode: cleanBarcode || undefined,
                };
                setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
                try {
                  await saveStoreItem(updated);
                } catch (err) {
                  setItems(previousItems);
                  throw err;
                }
              }}
              onUpdateItemPricing={(itemId, sellingPrice, costPrice, note) => {
                const target = items.find((i) => i.id === itemId);
                if (!target) return;
                const updated: StoreItem = {
                  ...target,
                  price: sellingPrice,
                  costPrice,
                  costHistory: [
                    ...(target.costHistory ?? []),
                    {
                      id: `ch-${Date.now()}`,
                      date: new Date().toISOString().slice(0, 10),
                      costPrice,
                      sellingPrice,
                      note: note || 'Price / cost update',
                      updatedBy: currentUser?.name ?? 'Admin',
                    },
                  ],
                };
                setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
                void saveStoreItem(updated);
              }}
              onDeleteItem={async (itemId) => {
                const previousItems = items;
                const previousCart = cart;
                setItems((prev) => prev.filter((i) => i.id !== itemId));
                setCart((prev) => prev.filter((c) => c.itemId !== itemId));
                try {
                  await removeStoreItem(itemId);
                } catch (err) {
                  setItems(previousItems);
                  setCart(previousCart);
                  throw err;
                }
              }}
              onAddItem={async (item) => {
                const todayIso = new Date().toISOString().slice(0, 10);
                const cleanBarcode = item.barcode?.trim().slice(0, 64) || undefined;
                const newItem: StoreItem = {
                  ...item,
                  barcode: cleanBarcode,
                  id: `item-${Date.now()}`,
                  soldCount: 0,
                  costHistory: [
                    {
                      id: `ch-${Date.now()}`,
                      date: todayIso,
                      costPrice: item.costPrice,
                      sellingPrice: item.price,
                      note: 'Initial item registration',
                      updatedBy: currentUser?.name ?? 'Admin',
                    },
                  ],
                };
                const previousItems = items;
                setItems((prev) => [...prev, newItem]);
                try {
                  await saveStoreItem(newItem);
                } catch (err) {
                  setItems(previousItems);
                  throw err;
                }
              }}
              stockAdjustments={stockAdjustments}
              onAdjustStock={handleAdjustStock}
              onCreateManualSale={handleCreateManualSale}
              onApprovePendingOrder={handleApprovePendingOrder}
              onRejectPendingOrder={handleRejectPendingOrder}
              onSyncAllData={handleSyncAllData}
              requestedSubTab={requestedAdminSubTab}
              onExitPreview={isPreviewingOtherRole ? () => setPreviewRole(null) : undefined}
            />
          )}

          {activeSection === 'chat' && (
            <ChatHubView
              threads={threads}
              currentUser={currentUser}
              currentRole={currentRole}
              storeItems={items}
              dueDays={pautanganSettings.dueDays}
              pendingProofsCount={pendingProofsCount}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onSendMessage={handleSendMessage}
              onReceiveAiReply={handleReceiveAiReply}
              onMarkThreadRead={handleMarkThreadRead}
            />
          )}

          {activeSection === 'apps' && (
            <OtherAppsView
              apps={otherApps}
              onToggleInstallApp={(appId) => {
                setOtherApps((prev) =>
                  prev.map((a) => (a.id === appId ? { ...a, installed: true } : a))
                );
                if (authUser) {
                  void toggleInternalAppInstalled(appId, true);
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Slide-Out Web Navigation Drawer */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex bg-stone-950/60 backdrop-blur-xs">
          <div className="w-72 max-w-[85vw] bg-white dark:bg-[#121D1B] h-full p-5 overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-200 dark:border-stone-800">
              <span className="text-lg font-extrabold text-stone-900 dark:text-stone-100 font-display">
                DeskPantry
              </span>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1">{renderSidebarContent()}</div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileDrawerOpen(false)} />
        </div>
      )}

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 pb-[env(safe-area-inset-bottom)] bg-white/95 dark:bg-[#121D1B]/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 flex items-center justify-around px-1"
      >
        {[
          { id: 'store', label: 'Store', icon: Store, badge: 0 },
          {
            id: 'ewallet',
            label: 'E-Wallet',
            icon: ArrowLeftRight,
            badge: openEWalletCount,
          },
          {
            id: 'community',
            label: 'Community',
            icon: Users,
            badge: unreadCommunityCount,
          },
          ...(canViewPautanganNav
            ? [{ id: 'pautangan', label: 'Loan', icon: HandCoins, badge: 0 }]
            : []),
          ...(canViewDeliveryNav
            ? [{ id: 'delivery', label: 'Delivery', icon: Truck, badge: pendingDeliveriesCount }]
            : [{ id: 'ledger', label: 'Ledger', icon: LayoutDashboard, badge: 0 }]),
          ...(isAdminOrSuper
            ? [
                {
                  id: 'admin',
                  label: 'Config',
                  icon: ShieldCheck,
                  badge: pendingProofsCount + pendingOrdersCount,
                },
              ]
            : [{ id: 'chat', label: 'Chat', icon: MessageSquare, badge: unreadChatCount }]),
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTo(tab.id as ActiveSection)}
              className={`h-full flex-1 min-w-0 px-0.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer relative ${
                active
                  ? 'text-teal-700 dark:text-teal-400'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-4.5 h-4.5" />
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-teal-600 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight font-semibold tracking-tight truncate max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Floating Multi-turn Gemini AI Chatbot Drawer */}
      <GeminiChatbotDrawer
        currentUser={currentUser}
        currentRole={currentRole}
        storeItems={items}
        dueDays={pautanganSettings.dueDays}
        pendingProofsCount={pendingProofsCount}
      />

      {/* Modals & Offline Banner */}
      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSignedIn={(account) => {
          setAuthUser(account);
          setPreviewRole(null);
        }}
      />

      <QRShareModal isOpen={isQROpen} onClose={() => setIsQROpen(false)} />

      <OfflineIndicator />
    </div>
  );
}
