import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  ChevronDown,
  Grid,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  QrCode,
  RotateCcw,
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
import { SignInModal } from './components/SignInModal';
import { StorefrontView } from './components/StorefrontView';
import {
  INITIAL_CHAT_THREADS,
  INITIAL_EWALLET_POSTS,
  INITIAL_LOANS,
  INITIAL_MARKETPLACE_LISTINGS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ORDERS,
  INITIAL_OTHER_APPS,
  INITIAL_PAUTANGAN_SETTINGS,
  INITIAL_PAYMENT_PROOFS,
  INITIAL_STORE_CONFIG,
  INITIAL_STORE_ITEMS,
  INITIAL_SUGGESTIONS,
  INITIAL_USERS,
  OWNER_BASE_COMMISSION_EARNED,
} from './data/seedData';
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
} from './utils/format';

interface PersistedState {
  darkMode: boolean;
  currentRole: UserRole;
  currentUserId: string | null;
  users: UserAccount[];
  items: StoreItem[];
  cart: CartItem[];
  orders: StoreOrder[];
  proofs: PaymentProof[];
  suggestions: SuggestionItem[];
  listings: MarketplaceListing[];
  ewalletPosts: EWalletPost[];
  pautanganSettings: PautanganSettings;
  storeConfig: StoreConfig;
  loans: LoanRecord[];
  threads: ChatThread[];
  notifications: NotificationItem[];
  otherApps: InternalApp[];
  ownerCommissionEarned: number;
  unreadCommunityCount: number;
  lastFeedEvent: string;
}

const STORAGE_KEY = 'deskpantry_state_v3';

function buildDefaultState(): PersistedState {
  return {
    darkMode: true,
    currentRole: UserRole.Guest,
    currentUserId: null,
    users: INITIAL_USERS,
    items: INITIAL_STORE_ITEMS,
    cart: [],
    orders: INITIAL_ORDERS,
    proofs: INITIAL_PAYMENT_PROOFS,
    suggestions: INITIAL_SUGGESTIONS,
    listings: INITIAL_MARKETPLACE_LISTINGS,
    ewalletPosts: INITIAL_EWALLET_POSTS,
    pautanganSettings: INITIAL_PAUTANGAN_SETTINGS,
    storeConfig: INITIAL_STORE_CONFIG,
    loans: INITIAL_LOANS,
    threads: INITIAL_CHAT_THREADS,
    notifications: INITIAL_NOTIFICATIONS,
    otherApps: INITIAL_OTHER_APPS,
    ownerCommissionEarned: OWNER_BASE_COMMISSION_EARNED,
    unreadCommunityCount: 2,
    lastFeedEvent: 'Marco Villanueva posted Roasted Manok & Creamy Buko Pandan Salad.',
  };
}

function getInitialState(): PersistedState {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const merged = { ...buildDefaultState(), ...(JSON.parse(saved) as Partial<PersistedState>) };
        merged.threads = merged.threads.map((t) => {
          if (t.id !== 'thread-ai') return t;
          return {
            ...t,
            subtitle: t.subtitle.includes('Pautangan')
              ? 'Gemini Assistant · Store Stock & Ledger Help'
              : t.subtitle,
            messages: t.messages.map((m) =>
              m.id === 'm-ai-1' && m.text.includes('Pautangan')
                ? {
                    ...m,
                    text: 'Kumusta! Ask me about current pantry stock, your 15th/30th store debt balance, payment proof uploads, or snack recommendations.',
                  }
                : m
            ),
          };
        });
        return merged;
      }
    } catch {
      // Ignore corrupt storage and fall back to seed data
    }
  }
  return buildDefaultState();
}

export default function App() {
  const [state, setState] = useState<PersistedState>(getInitialState);
  const [activeSection, setActiveSection] = useState<ActiveSection>('store');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.darkMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const currentUser = useMemo(() => {
    if (state.currentRole === UserRole.Guest || !state.currentUserId) return null;
    return state.users.find((u) => u.id === state.currentUserId) ?? null;
  }, [state.currentRole, state.currentUserId, state.users]);

  const isAdminOrSuper =
    state.currentRole === UserRole.Admin || state.currentRole === UserRole.SuperAdmin;
  const canViewDeliveryNav =
    state.currentRole === UserRole.DeliveryStaff || isAdminOrSuper;

  // Guard restricted views if role switches away
  useEffect(() => {
    if (activeSection === 'admin' && !isAdminOrSuper) {
      setActiveSection('store');
    }
    if (activeSection === 'delivery' && !canViewDeliveryNav) {
      setActiveSection('store');
    }
  }, [activeSection, isAdminOrSuper, canViewDeliveryNav]);

  const nextDueLabel = useMemo(
    () => getNextDueDateLabel(state.pautanganSettings.dueDays),
    [state.pautanganSettings.dueDays]
  );

  const unreadNotifCount = state.notifications.filter((n) => !n.read).length;
  const unreadChatCount = state.threads.reduce((sum, t) => sum + t.unreadCount, 0);
  const pendingProofsCount = state.proofs.filter((p) => p.status === 'pending').length;
  const pendingDeliveriesCount = state.orders.filter(
    (o) => (o.deliveryStatus ?? 'Pending Dispatch') !== 'Delivered'
  ).length;
  const openEWalletCount = state.ewalletPosts.filter((p) => p.status !== 'Completed').length;
  const cartCount = state.cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleResetDemo = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(buildDefaultState());
    setActiveSection('store');
    setIsMobileDrawerOpen(false);
  };

  const handleSwitchDemoRole = (role: UserRole) => {
    if (role === UserRole.Guest) {
      setState((prev) => ({ ...prev, currentRole: UserRole.Guest, currentUserId: null }));
      return;
    }
    const matchingUser = state.users.find((u) => u.role === role) ?? state.users[0];
    setState((prev) => ({
      ...prev,
      currentRole: role,
      currentUserId: matchingUser.id,
    }));
  };

  const handleSignInUser = (user: UserAccount) => {
    setIsProfileMenuOpen(false);
    setState((prev) => ({
      ...prev,
      currentRole: user.role,
      currentUserId: user.id,
    }));
  };

  const handleSignOut = () => {
    setIsProfileMenuOpen(false);
    setIsNotifOpen(false);
    setIsMobileDrawerOpen(false);
    setIsCartOpen(false);
    setState((prev) => ({
      ...prev,
      currentRole: UserRole.Guest,
      currentUserId: null,
      cart: [],
    }));
  };

  // Newly registered users always default to UserRole.Member (Coworker)
  const handleSignInEmail = (name: string, email: string, _role: UserRole) => {
    const newId = `u-${Date.now()}`;
    const initials = name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const newUser: UserAccount = {
      id: newId,
      name,
      email,
      department: 'Department Staff',
      role: UserRole.Member,
      debtBalance: 0,
      pautanganEnabled: true,
      pautanganLimit: 3000,
      avatarInitials: initials || 'DP',
      totalSpent: 0,
    };
    setState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
      currentRole: UserRole.Member,
      currentUserId: newId,
    }));
  };

  const handleGoogleSignIn = (profile: {
    name: string;
    email: string;
    avatarUrl?: string;
  }) => {
    const normalizedEmail = profile.email.trim().toLowerCase();
    const displayName =
      profile.name.trim() ||
      normalizedEmail
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    setState((prev) => {
      const existing = prev.users.find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
      if (existing) {
        const updatedUsers = prev.users.map((u) =>
          u.id === existing.id
            ? {
                ...u,
                avatarUrl: profile.avatarUrl || u.avatarUrl,
              }
            : u
        );
        return {
          ...prev,
          users: updatedUsers,
          currentRole: existing.role,
          currentUserId: existing.id,
        };
      }

      const newId = `u-${Date.now()}`;
      const initials = displayName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      const newUser: UserAccount = {
        id: newId,
        name: displayName,
        email: normalizedEmail,
        department: 'Department Staff',
        role: UserRole.Member,
        debtBalance: 0,
        pautanganEnabled: true,
        pautanganLimit: 3000,
        avatarInitials: initials || 'DP',
        avatarUrl: profile.avatarUrl || undefined,
        totalSpent: 0,
      };

      return {
        ...prev,
        users: [...prev.users, newUser],
        currentRole: UserRole.Member,
        currentUserId: newId,
      };
    });
  };

  const handleAddToCart = (itemId: string) => {
    if (state.currentRole === UserRole.Guest || !currentUser) {
      setIsSignInOpen(true);
      return;
    }
    setState((prev) => {
      const existing = prev.cart.find((c) => c.itemId === itemId);
      const nextCart = existing
        ? prev.cart.map((c) =>
            c.itemId === itemId ? { ...c, quantity: c.quantity + 1 } : c
          )
        : [...prev.cart, { itemId, quantity: 1 }];
      return { ...prev, cart: nextCart };
    });
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setState((prev) => {
      const nextCart = prev.cart
        .map((c) =>
          c.itemId === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0);
      return { ...prev, cart: nextCart };
    });
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

    setState((prev) => {
      const orderItems = prev.cart
        .map((c) => {
          const item = prev.items.find((i) => i.id === c.itemId);
          if (!item) return null;
          return {
            itemId: item.id,
            name: item.name,
            quantity: c.quantity,
            unitPrice: item.price,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (orderItems.length === 0) return prev;
      const subtotal = orderItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      const deliveryFee =
        payload.fulfillment === FulfillmentType.Delivery && prev.storeConfig.deliveryEnabled
          ? prev.storeConfig.deliveryFee
          : 0;
      const totalAmount = subtotal + deliveryFee;

      const isDigital = Boolean(payload.proofChannel && payload.proofImage);
      const isDebt = payload.paymentMethod === PaymentMethod.Debt;
      const orderId = `ORD-${Math.floor(2500 + Math.random() * 7000)}`;
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const todayIso = new Date().toISOString().slice(0, 10);
      const nowLabel = `${todayIso} ${nowTime}`;

      const defaultRunner = prev.users.find((u) => u.role === UserRole.DeliveryStaff);
      const runnerName =
        payload.fulfillment === FulfillmentType.Delivery
          ? defaultRunner?.name ?? 'Kuya Jun Reyes'
          : 'Counter B Pickup';

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
        status: isDigital ? 'Pending Payment Proof' : 'Confirmed',
        deliveryStatus: 'Pending Dispatch',
        assignedRunnerId: defaultRunner?.id,
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
            event: `Order placed via ${payload.paymentMethod} (${payload.fulfillment})`,
            actor: currentUser.name,
          },
          ...(deliveryFee > 0
            ? [
                {
                  id: `lg-${Date.now()}-2`,
                  timestamp: nowLabel,
                  event: `Assigned to ${runnerName} (${formatPHP(deliveryFee)} delivery fee commission)`,
                  actor: 'System',
                },
              ]
            : []),
        ],
      };

      const nextItems = prev.items.map((item) => {
        const bought = orderItems.find((o) => o.itemId === item.id);
        if (!bought) return item;
        return {
          ...item,
          stock: Math.max(0, item.stock - bought.quantity),
          soldCount: item.soldCount + bought.quantity,
        };
      });

      const nextUsers = prev.users.map((u) => {
        if (u.id !== currentUser.id) return u;
        return {
          ...u,
          debtBalance: isDebt ? u.debtBalance + totalAmount : u.debtBalance,
          totalSpent: u.totalSpent + totalAmount,
        };
      });

      const nextProofs = [...prev.proofs];
      if (isDigital && payload.proofChannel && payload.proofImage) {
        nextProofs.unshift({
          id: `PRF-${Math.floor(900 + Math.random() * 900)}`,
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
        });
      }

      const nextNotifications = [...prev.notifications];
      if (payload.fulfillment === FulfillmentType.Delivery) {
        nextNotifications.unshift({
          id: `notif-del-${Date.now()}`,
          title: `New Delivery Order · ${orderId}`,
          body: `${currentUser.name} requested desk delivery (${payload.deliveryNote || 'Office Floor'}).`,
          timestamp: 'Just now',
          type: 'delivery',
          read: false,
        });
      }
      if (isDigital) {
        nextNotifications.unshift({
          id: `notif-${Date.now()}`,
          title: `Payment Proof Submitted · ${payload.proofChannel}`,
          body: `${currentUser.name} submitted ${formatPHP(totalAmount, true)} proof for ${orderId}.`,
          timestamp: 'Just now',
          type: 'payment',
          read: false,
        });
      }

      return {
        ...prev,
        items: nextItems,
        users: nextUsers,
        orders: [newOrder, ...prev.orders],
        proofs: nextProofs,
        notifications: nextNotifications,
        cart: [],
      };
    });
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
    setState((prev) => {
      const target = prev.orders.find((o) => o.id === orderId);
      const nextOrders = prev.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          deliveryStatus,
          status: deliveryStatus === 'Delivered' ? ('Completed' as const) : o.status,
          cashCollected: cashCollected ?? o.cashCollected,
          assignedRunner: o.assignedRunner || actorName,
          deliveredAt: deliveryStatus === 'Delivered' ? stamp : o.deliveredAt,
          logs: [
            ...(o.logs ?? []),
            {
              id: `lg-${Date.now()}`,
              timestamp: stamp,
              event:
                deliveryStatus === 'Delivered'
                  ? `Delivered to customer${cashCollected ? ' & Cash collected' : ''}`
                  : `Updated status to ${deliveryStatus}`,
              actor: actorName,
            },
          ],
        };
      });

      const nextNotifications = [...prev.notifications];
      if (target) {
        nextNotifications.unshift({
          id: `notif-ds-${Date.now()}`,
          title: `Order ${orderId} · ${deliveryStatus}`,
          body: `${target.userName}'s order is now ${deliveryStatus.toLowerCase()} by ${actorName}.`,
          timestamp: 'Just now',
          type: 'delivery',
          read: false,
        });
      }

      return {
        ...prev,
        orders: nextOrders,
        notifications: nextNotifications,
      };
    });
  };

  const handleNotifyDeliveryCustomer = (order: StoreOrder) => {
    const runner = currentUser?.name ?? order.assignedRunner ?? 'Delivery Staff';
    setState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `notif-ping-${Date.now()}`,
          title: `Delivery Runner Alert · ${order.id}`,
          body: `${runner} is heading to ${order.deliveryNote || 'your floor'} with your DeskPantry order.`,
          timestamp: 'Just now',
          type: 'delivery',
          read: false,
        },
        ...prev.notifications,
      ],
    }));
  };

  const handleToggleVote = (suggestionId: string) => {
    if (!currentUser) return;
    setState((prev) => {
      const target = prev.suggestions.find((s) => s.id === suggestionId);
      return {
        ...prev,
        unreadCommunityCount: prev.unreadCommunityCount + 1,
        lastFeedEvent: target
          ? `${currentUser.name} voted on "${target.title}".`
          : prev.lastFeedEvent,
        suggestions: prev.suggestions.map((s) => {
          if (s.id !== suggestionId) return s;
          const already = s.voterIds.includes(currentUser.id);
          return {
            ...s,
            voterIds: already
              ? s.voterIds.filter((id) => id !== currentUser.id)
              : [...s.voterIds, currentUser.id],
            voterNames: already
              ? s.voterNames.filter((n) => n !== currentUser.name)
              : [...s.voterNames, currentUser.name],
          };
        }),
      };
    });
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
    setState((prev) => ({
      ...prev,
      suggestions: [newSug, ...prev.suggestions],
      unreadCommunityCount: prev.unreadCommunityCount + 1,
      lastFeedEvent: `${currentUser.name} requested "${title}" on Suggestions Feed.`,
      notifications: [
        {
          id: `notif-com-${Date.now()}`,
          title: 'New Community Suggestion',
          body: `${currentUser.name} suggested "${title}" (${category}).`,
          timestamp: 'Just now',
          type: 'community',
          read: false,
        },
        ...prev.notifications,
      ],
    }));
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
    };
    setState((prev) => ({
      ...prev,
      listings: [newListing, ...prev.listings],
      unreadCommunityCount: prev.unreadCommunityCount + 1,
      lastFeedEvent: `${currentUser.name} submitted "${payload.title}" for sale.`,
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: 'New Marketplace Listing Pending Review',
          body: `${currentUser.name} submitted "${payload.title}" (${formatPHP(payload.price)}).`,
          timestamp: 'Just now',
          type: 'community',
          read: false,
        },
        ...prev.notifications,
      ],
    }));
  };

  const handleBuyListing = (
    listingId: string,
    paymentMethod: PaymentMethod.Cash | PaymentMethod.Debt,
    fulfillment: FulfillmentType
  ) => {
    if (!currentUser) return;
    setState((prev) => {
      const target = prev.listings.find((l) => l.id === listingId);
      if (!target || target.stock <= 0) return prev;

      const { ownerShare } = computeCommission(
        target.price,
        target.commissionType,
        target.commissionValue
      );

      const deliveryFee =
        fulfillment === FulfillmentType.Delivery && prev.storeConfig.deliveryEnabled
          ? prev.storeConfig.deliveryFee
          : 0;
      const totalAmount = target.price + deliveryFee;
      const todayIso = new Date().toISOString().slice(0, 10);
      const nowLabel = `${todayIso} ${new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
      const runner = prev.users.find((u) => u.role === UserRole.DeliveryStaff);

      const newOrder: StoreOrder = {
        id: `MKT-${Math.floor(1000 + Math.random() * 8999)}`,
        userId: currentUser.id,
        userName: currentUser.name,
        items: [
          {
            itemId: target.id,
            name: `${target.title} (Coworker Sale)`,
            quantity: 1,
            unitPrice: target.price,
          },
        ],
        totalAmount,
        deliveryFee,
        deliveryCommission: deliveryFee,
        fulfillment,
        paymentMethod,
        status: 'Confirmed',
        deliveryStatus: 'Pending Dispatch',
        assignedRunnerId: runner?.id,
        assignedRunner:
          fulfillment === FulfillmentType.Delivery
            ? runner?.name ?? 'Kuya Jun Reyes'
            : 'Seller Pickup',
        createdAt: nowLabel,
        orderDateIso: todayIso,
        dueDateLabel:
          paymentMethod === PaymentMethod.Debt ? nextDueLabel : undefined,
        source: 'marketplace',
        commissionEarned: ownerShare,
        logs: [
          {
            id: `lg-mkt-${Date.now()}`,
            timestamp: nowLabel,
            event: `Purchased coworker listing "${target.title}" via ${paymentMethod}`,
            actor: currentUser.name,
          },
        ],
      };

      return {
        ...prev,
        listings: prev.listings.map((l) =>
          l.id === listingId
            ? { ...l, stock: l.stock - 1, soldCount: l.soldCount + 1 }
            : l
        ),
        users: prev.users.map((u) => {
          if (u.id !== currentUser.id) return u;
          return {
            ...u,
            debtBalance:
              paymentMethod === PaymentMethod.Debt
                ? u.debtBalance + totalAmount
                : u.debtBalance,
            totalSpent: u.totalSpent + totalAmount,
          };
        }),
        orders: [newOrder, ...prev.orders],
        ownerCommissionEarned: prev.ownerCommissionEarned + ownerShare,
      };
    });
  };

  const handleRequestLoan = (principal: number, months: number) => {
    if (!currentUser) return;
    setState((prev) => {
      const rate = prev.pautanganSettings.monthlyInterestRate;
      const totalPayable = principal + Math.round(principal * (rate / 100) * months);
      const loanId = `LN-${Math.floor(510 + Math.random() * 480)}`;
      const todayIso = new Date().toISOString().slice(0, 10);
      const installments = buildLoanInstallments(
        loanId,
        totalPayable,
        months,
        todayIso,
        prev.pautanganSettings.dueDays[1] ?? 30
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
      return {
        ...prev,
        loans: [newLoan, ...prev.loans],
      };
    });
  };

  const handleRepayLoan = (payload: {
    loanId: string;
    amount: number;
    method: string;
    referenceNo?: string;
    proofImage?: string;
  }) => {
    if (!currentUser) return;
    setState((prev) => {
      if (payload.method !== 'Cash' && payload.proofImage) {
        const newProof: PaymentProof = {
          id: `PRF-${Math.floor(900 + Math.random() * 900)}`,
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
        return {
          ...prev,
          proofs: [newProof, ...prev.proofs],
          loans: prev.loans.map((loan) => {
            if (loan.id !== payload.loanId) return loan;
            let marked = false;
            return {
              ...loan,
              installments: (loan.installments ?? []).map((inst) => {
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
          }),
        };
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      return {
        ...prev,
        loans: prev.loans.map((loan) => {
          if (loan.id !== payload.loanId) return loan;
          const nextRemaining = Math.max(0, loan.remainingBalance - payload.amount);
          let covered = payload.amount;
          const nextInstallments = (loan.installments ?? []).map((inst) => {
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
          return {
            ...loan,
            remainingBalance: nextRemaining,
            status: nextRemaining === 0 ? 'Settled' : 'Active',
            installments: nextInstallments,
            repayments: [
              ...loan.repayments,
              {
                id: `rep-${Date.now()}`,
                date: todayIso,
                amount: payload.amount,
                method: payload.method,
                note: `${loan.months}-month term installment`,
              },
            ],
          };
        }),
      };
    });
  };

  const handleSubmitDebtProof = (payload: {
    amount: number;
    channel: string;
    referenceNo: string;
    imageDataUrl: string;
  }) => {
    if (!currentUser) return;
    const newProof: PaymentProof = {
      id: `PRF-${Math.floor(900 + Math.random() * 900)}`,
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
    setState((prev) => ({
      ...prev,
      proofs: [newProof, ...prev.proofs],
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: `New ${payload.channel} Payment Proof`,
          body: `${currentUser.name} submitted ${formatPHP(payload.amount, true)} (${payload.referenceNo}).`,
          timestamp: 'Just now',
          type: 'payment',
          read: false,
        },
        ...prev.notifications,
      ],
    }));
  };

  const handleReviewProof = (proofId: string, decision: 'approved' | 'rejected') => {
    setState((prev) => {
      const target = prev.proofs.find((p) => p.id === proofId);
      if (!target || target.status !== 'pending') return prev;

      const nextProofs = prev.proofs.map((p) =>
        p.id === proofId
          ? {
              ...p,
              status: decision,
              reviewedBy: currentUser?.name ?? 'Admin',
              reviewedAt: 'Just now',
            }
          : p
      );

      if (decision === 'rejected') {
        return {
          ...prev,
          proofs: nextProofs,
          notifications: [
            {
              id: `notif-${Date.now()}`,
              title: `Payment Proof Rejected (${target.referenceNo})`,
              body: `Admin requested re-upload for ${target.userName}'s ${target.channel} payment.`,
              timestamp: 'Just now',
              type: 'payment',
              read: false,
            },
            ...prev.notifications,
          ],
        };
      }

      const nextUsers = prev.users.map((u) => {
        if (u.id !== target.userId) return u;
        if (target.purpose === 'Store Debt Settlement') {
          return { ...u, debtBalance: Math.max(0, u.debtBalance - target.amount) };
        }
        return u;
      });

      const nextOrders = prev.orders.map((o) =>
        o.id === target.orderId ? { ...o, status: 'Confirmed' as const } : o
      );

      const todayIso = new Date().toISOString().slice(0, 10);
      const nextLoans = prev.loans.map((l) => {
        if (l.id !== target.loanId) return l;
        const rem = Math.max(0, l.remainingBalance - target.amount);
        let covered = target.amount;
        const nextInst = (l.installments ?? []).map((inst) => {
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
        return {
          ...l,
          remainingBalance: rem,
          status: rem === 0 ? ('Settled' as const) : ('Active' as const),
          installments: nextInst,
          repayments: [
            ...l.repayments,
            {
              id: `rep-${Date.now()}`,
              date: todayIso,
              amount: target.amount,
              method: target.channel,
              note: `Confirmed ref ${target.referenceNo}`,
            },
          ],
        };
      });

      return {
        ...prev,
        proofs: nextProofs,
        users: nextUsers,
        orders: nextOrders,
        loans: nextLoans,
      };
    });
  };

  const handleReviewListing = (
    listingId: string,
    decision: 'approved' | 'rejected'
  ) => {
    setState((prev) => {
      const target = prev.listings.find((l) => l.id === listingId);
      return {
        ...prev,
        unreadCommunityCount:
          decision === 'approved' ? prev.unreadCommunityCount + 1 : prev.unreadCommunityCount,
        lastFeedEvent:
          decision === 'approved' && target
            ? `"${target.title}" is now approved and live in Public For-Sale Feed!`
            : prev.lastFeedEvent,
        listings: prev.listings.map((l) =>
          l.id === listingId ? { ...l, approvalStatus: decision } : l
        ),
      };
    });
  };

  const handleSendReminders = () => {
    const debtors = state.users.filter((u) => u.debtBalance > 0);
    setState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: `Due-Date Reminder Sent (${nextDueLabel})`,
          body: `Notified ${debtors.length} coworkers (${debtors
            .map((d) => d.name.split(' ')[0])
            .join(', ')}) ahead of the ${nextDueLabel} cutoff.`,
          timestamp: 'Just now',
          type: 'reminder',
          read: false,
        },
        ...prev.notifications,
      ],
    }));
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
    setState((prev) => ({
      ...prev,
      threads: prev.threads.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t
      ),
    }));
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
    setState((prev) => ({
      ...prev,
      threads: prev.threads.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, aiMsg] } : t
      ),
    }));
  };

  const handleMarkThreadRead = (threadId: string) => {
    setState((prev) => ({
      ...prev,
      threads: prev.threads.map((t) =>
        t.id === threadId ? { ...t, unreadCount: 0 } : t
      ),
    }));
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
    setState((prev) => ({
      ...prev,
      ewalletPosts: [newPost, ...prev.ewalletPosts],
      notifications: [
        {
          id: `notif-ew-${Date.now()}`,
          title: `New ${payload.type === 'sell' ? 'Sell' : 'Buy'} ${payload.walletProvider} Post`,
          body: `${currentUser.name} posted ${formatPHP(payload.totalAmount)} ${payload.walletProvider} on Buy/Sell E-Wallet.`,
          timestamp: 'Just now',
          type: 'ewallet',
          read: false,
        },
        ...prev.notifications,
      ],
    }));
  };

  const handleClaimEWalletShare = (postId: string, amount: number, note?: string) => {
    if (!currentUser) return;
    const nowLabel = `Today · ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    setState((prev) => {
      const target = prev.ewalletPosts.find((p) => p.id === postId);
      if (!target || target.remainingAmount <= 0) return prev;
      const take = Math.min(target.remainingAmount, Math.max(1, amount));
      const nextRemaining = Math.max(0, target.remainingAmount - take);
      const nextStatus: EWalletPost['status'] =
        nextRemaining === 0 ? 'Completed' : 'Partially Filled';

      return {
        ...prev,
        ewalletPosts: prev.ewalletPosts.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            remainingAmount: nextRemaining,
            status: nextStatus,
            fills: [
              ...p.fills,
              {
                id: `ewf-${Date.now()}`,
                userId: currentUser.id,
                userName: currentUser.name,
                userDepartment: currentUser.department,
                amount: take,
                createdAt: nowLabel,
                note,
              },
            ],
          };
        }),
        notifications: [
          {
            id: `notif-ewf-${Date.now()}`,
            title: `E-Wallet Share Claimed (${target.walletProvider})`,
            body: `${currentUser.name} took ${formatPHP(take)} from ${target.accountName}'s post (${
              nextRemaining === 0 ? 'Completed!' : `${formatPHP(nextRemaining)} left`
            }).`,
            timestamp: 'Just now',
            type: 'ewallet',
            read: false,
          },
          ...prev.notifications,
        ],
      };
    });
  };

  const handleAddEWalletComment = (postId: string, text: string) => {
    if (!currentUser) return;
    const nowLabel = `Today · ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    setState((prev) => ({
      ...prev,
      ewalletPosts: prev.ewalletPosts.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: [
            ...p.comments,
            {
              id: `ewc-${Date.now()}`,
              userId: currentUser.id,
              userName: currentUser.name,
              userDepartment: currentUser.department,
              text,
              createdAt: nowLabel,
            },
          ],
        };
      }),
    }));
  };

  const navigateTo = (section: ActiveSection) => {
    setActiveSection(section);
    setIsMobileDrawerOpen(false);
    setIsNotifOpen(false);
    setIsProfileMenuOpen(false);
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
      badge: state.unreadCommunityCount,
    },
    { id: 'pautangan', label: 'Pautangan', icon: HandCoins },
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
            badge: pendingProofsCount,
          },
        ]
      : []),
    { id: 'apps', label: 'Other Apps', icon: Grid },
  ];

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
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-teal-700/15 dark:bg-teal-500/20 text-teal-800 dark:text-teal-200 text-xs font-bold flex items-center justify-center shrink-0">
                  {currentUser ? currentUser.avatarInitials : 'GV'}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                  {currentUser ? currentUser.name : 'Guest Visitor'}
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  {currentUser ? currentUser.department : 'Sign in to place orders'}
                </div>
              </div>
            </div>
            {currentUser ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsSignInOpen(true);
                  }}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Switch
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  Log out
                </button>
              </div>
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

      {/* Bottom Role Switcher & Utilities */}
      <div className="space-y-4 pt-4 border-t border-stone-200 dark:border-stone-800">
        <div>
          <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2">
            Role View
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
                onClick={() => handleSwitchDemoRole(r.role)}
                className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  state.currentRole === r.role
                    ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#1F312E]'
                } ${r.role === UserRole.SuperAdmin ? 'col-span-2' : ''}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

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

          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <PWAInstallButton compact />
            </div>
            <button
              type="button"
              onClick={handleResetDemo}
              title="Reset demo data"
              className="min-h-[40px] px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-xs font-medium text-stone-500 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-50 dark:hover:bg-[#1F312E] inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const topNavLinks = [
    { id: 'store', label: 'Store', badge: 0 },
    { id: 'ewallet', label: 'Buy/Sell E-Wallet', badge: openEWalletCount },
    { id: 'community', label: 'Community', badge: state.unreadCommunityCount },
    { id: 'pautangan', label: 'Pautangan', badge: 0 },
    ...(canViewDeliveryNav
      ? [{ id: 'delivery', label: 'Delivery', badge: pendingDeliveriesCount }]
      : []),
    // Config tab strictly hidden from public, Coworker, and Delivery Staff
    ...(isAdminOrSuper
      ? [{ id: 'admin', label: 'Admin Config', badge: pendingProofsCount }]
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

          {/* Zone 2: Concise single-line desktop web navigation links (matches lg: sidebar breakpoint) */}
          <nav className="hidden lg:flex items-center gap-3.5 xl:gap-5 text-[13px] xl:text-sm font-medium text-teal-100/80 min-w-0">
            {topNavLinks.map((link) => {
              const active = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => navigateTo(link.id as ActiveSection)}
                  className={`py-1.5 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'text-white font-semibold border-b-2 border-teal-300'
                      : 'hover:text-white'
                  }`}
                >
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
              onClick={() =>
                setState((prev) => ({ ...prev, darkMode: !prev.darkMode }))
              }
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-teal-100 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label={state.darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              title={state.darkMode ? 'Light Theme' : 'Dark Theme'}
            >
              {state.darkMode ? (
                <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              )}
            </button>

            {/* Message Unread Indicator (hidden on tiny xs screens since Chat is in mobile drawer/nav) */}
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

            {/* Notification Bell Indicator */}
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

            <span className="h-5 w-px bg-white/15 mx-0.5 sm:mx-1 shrink-0" aria-hidden="true" />

            {state.currentRole === UserRole.Guest || !currentUser ? (
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
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      referrerPolicy="no-referrer"
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
                        {currentUser.avatarUrl ? (
                          <img
                            src={currentUser.avatarUrl}
                            alt={currentUser.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-teal-700/15 dark:bg-teal-500/20 text-teal-800 dark:text-teal-200 text-sm font-bold flex items-center justify-center shrink-0">
                            {currentUser.avatarInitials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                            {currentUser.name}
                          </div>
                          <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                            {currentUser.email}
                          </div>
                          <div className="mt-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                            {currentUser.role === UserRole.SuperAdmin
                              ? 'Super Admin'
                              : currentUser.role === UserRole.Admin
                                ? 'Admin'
                                : currentUser.role === UserRole.DeliveryStaff
                                  ? 'Delivery Staff'
                                  : 'Coworker'}{' '}
                            · {currentUser.department}
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
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            setIsSignInOpen(true);
                          }}
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#172523] flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                          <span>Switch Account</span>
                        </button>

                        <div className="my-1 border-t border-stone-200 dark:border-stone-800" />

                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleSignOut}
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

            {/* Notification Bell Dropdown Popover */}
            {isNotifOpen && (
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
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              notifications: prev.notifications.map((n) => ({
                                ...n,
                                read: true,
                              })),
                            }))
                          }
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
                    {state.notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setState((prev) => ({
                            ...prev,
                            notifications: prev.notifications.map((item) =>
                              item.id === n.id ? { ...item, read: true } : item
                            ),
                          }));
                          if (n.type === 'delivery' && canViewDeliveryNav) navigateTo('delivery');
                          else if (n.type === 'payment' && isAdminOrSuper) navigateTo('admin');
                          else if (n.type === 'ewallet') navigateTo('ewallet');
                          else if (n.type === 'community') navigateTo('community');
                          else if (n.type === 'chat') navigateTo('chat');
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
                    ))}
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
        <main className="flex-1 min-w-0">
          {activeSection === 'store' && (
            <StorefrontView
              items={state.items}
              cart={state.cart}
              currentUser={currentUser}
              currentRole={state.currentRole}
              dueDays={state.pautanganSettings.dueDays}
              nextDueLabel={nextDueLabel}
              storeConfig={state.storeConfig}
              onAddToCart={handleAddToCart}
              onUpdateCartQty={handleUpdateCartQty}
              onClearCart={() => setState((prev) => ({ ...prev, cart: [] }))}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onOpenQRShare={() => setIsQROpen(true)}
              onPlaceOrder={handlePlaceOrder}
              isCartOpen={isCartOpen}
              setIsCartOpen={setIsCartOpen}
            />
          )}

          {activeSection === 'ewallet' && (
            <EWalletExchangeView
              posts={state.ewalletPosts}
              currentUser={currentUser}
              currentRole={state.currentRole}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onCreatePost={handleCreateEWalletPost}
              onClaimShare={handleClaimEWalletShare}
              onAddComment={handleAddEWalletComment}
            />
          )}

          {activeSection === 'community' && (
            <CommunityFeedView
              suggestions={state.suggestions}
              listings={state.listings}
              categories={state.storeConfig.categories}
              unreadCommunityCount={state.unreadCommunityCount}
              lastFeedEvent={state.lastFeedEvent}
              currentUser={currentUser}
              currentRole={state.currentRole}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onClearCommunityUnread={() =>
                setState((prev) => ({ ...prev, unreadCommunityCount: 0 }))
              }
              onToggleVote={handleToggleVote}
              onCreateSuggestion={handleCreateSuggestion}
              onCreateListing={handleCreateListing}
              onBuyListing={handleBuyListing}
            />
          )}

          {activeSection === 'pautangan' && (
            <PautanganView
              settings={state.pautanganSettings}
              loans={state.loans}
              paymentMethods={state.storeConfig.paymentMethods}
              currentUser={currentUser}
              currentRole={state.currentRole}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onOpenLedger={() => navigateTo('ledger')}
              onRequestLoan={handleRequestLoan}
              onRepayLoan={handleRepayLoan}
            />
          )}

          {activeSection === 'ledger' && (
            <LedgerDashboardView
              currentUser={currentUser}
              currentRole={state.currentRole}
              users={state.users}
              orders={state.orders}
              loans={state.loans}
              proofs={state.proofs}
              paymentMethods={state.storeConfig.paymentMethods}
              ownerTotalCommission={state.ownerCommissionEarned}
              dueDays={state.pautanganSettings.dueDays}
              nextDueLabel={nextDueLabel}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onSubmitDebtProof={handleSubmitDebtProof}
            />
          )}

          {activeSection === 'delivery' && canViewDeliveryNav && (
            <DeliveryStaffView
              orders={state.orders}
              currentUser={currentUser}
              currentRole={state.currentRole}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
              onNotifyCustomer={handleNotifyDeliveryCustomer}
              onSwitchDemoRole={handleSwitchDemoRole}
            />
          )}

          {activeSection === 'admin' && isAdminOrSuper && (
            <AdminConsoleView
              currentRole={state.currentRole}
              currentUser={currentUser}
              users={state.users}
              items={state.items}
              orders={state.orders}
              proofs={state.proofs}
              listings={state.listings}
              loans={state.loans}
              pautanganSettings={state.pautanganSettings}
              storeConfig={state.storeConfig}
              ownerTotalCommission={state.ownerCommissionEarned}
              onReviewProof={handleReviewProof}
              onReviewListing={handleReviewListing}
              onUpdateDueDays={(d1, d2) =>
                setState((prev) => ({
                  ...prev,
                  pautanganSettings: { ...prev.pautanganSettings, dueDays: [d1, d2] },
                }))
              }
              onSendReminders={handleSendReminders}
              onUpdatePautanganGlobal={(enabled, rate) =>
                setState((prev) => ({
                  ...prev,
                  pautanganSettings: {
                    ...prev.pautanganSettings,
                    globalEnabled: enabled,
                    monthlyInterestRate: rate,
                  },
                }))
              }
              onUpdatePautanganTerms={(terms) =>
                setState((prev) => ({
                  ...prev,
                  pautanganSettings: {
                    ...prev.pautanganSettings,
                    availableTerms: terms,
                  },
                }))
              }
              onToggleUserPautangan={(userId, enabled, limit) =>
                setState((prev) => ({
                  ...prev,
                  users: prev.users.map((u) =>
                    u.id === userId
                      ? { ...u, pautanganEnabled: enabled, pautanganLimit: limit }
                      : u
                  ),
                }))
              }
              onUpdateUserRole={(userId, role) =>
                setState((prev) => ({
                  ...prev,
                  users: prev.users.map((u) =>
                    u.id === userId ? { ...u, role } : u
                  ),
                  currentRole: prev.currentUserId === userId ? role : prev.currentRole,
                }))
              }
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
                  email,
                  department,
                  role: UserRole.DeliveryStaff,
                  debtBalance: 0,
                  pautanganEnabled: true,
                  pautanganLimit: 3000,
                  avatarInitials: initials || 'DS',
                  totalSpent: 0,
                };
                setState((prev) => ({
                  ...prev,
                  users: [...prev.users, staff],
                }));
              }}
              onUpdateStoreConfig={(next) =>
                setState((prev) => ({ ...prev, storeConfig: next }))
              }
              onAddCategory={(cat) =>
                setState((prev) => {
                  if (prev.storeConfig.categories.includes(cat)) return prev;
                  return {
                    ...prev,
                    storeConfig: {
                      ...prev.storeConfig,
                      categories: [...prev.storeConfig.categories, cat],
                    },
                  };
                })
              }
              onEditCategory={(oldName, newName) =>
                setState((prev) => ({
                  ...prev,
                  storeConfig: {
                    ...prev.storeConfig,
                    categories: prev.storeConfig.categories.map((c) =>
                      c === oldName ? newName : c
                    ),
                  },
                  items: prev.items.map((i) =>
                    i.category === oldName ? { ...i, category: newName } : i
                  ),
                  suggestions: prev.suggestions.map((s) =>
                    s.category === oldName ? { ...s, category: newName } : s
                  ),
                }))
              }
              onRemoveCategory={(cat) =>
                setState((prev) => ({
                  ...prev,
                  storeConfig: {
                    ...prev.storeConfig,
                    categories: prev.storeConfig.categories.filter((c) => c !== cat),
                  },
                }))
              }
              onRestockItem={(itemId, amount) =>
                setState((prev) => ({
                  ...prev,
                  items: prev.items.map((i) =>
                    i.id === itemId ? { ...i, stock: i.stock + amount } : i
                  ),
                }))
              }
              onUpdateItemPricing={(itemId, sellingPrice, costPrice, note) =>
                setState((prev) => ({
                  ...prev,
                  items: prev.items.map((i) => {
                    if (i.id !== itemId) return i;
                    return {
                      ...i,
                      price: sellingPrice,
                      costPrice,
                      costHistory: [
                        ...(i.costHistory ?? []),
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
                  }),
                }))
              }
              onDeleteItem={(itemId) =>
                setState((prev) => ({
                  ...prev,
                  items: prev.items.filter((i) => i.id !== itemId),
                  cart: prev.cart.filter((c) => c.itemId !== itemId),
                }))
              }
              onAddItem={(item) => {
                const todayIso = new Date().toISOString().slice(0, 10);
                setState((prev) => ({
                  ...prev,
                  items: [
                    ...prev.items,
                    {
                      ...item,
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
                    },
                  ],
                }));
              }}
              onSwitchDemoRole={handleSwitchDemoRole}
            />
          )}

          {activeSection === 'chat' && (
            <ChatHubView
              threads={state.threads}
              currentUser={currentUser}
              currentRole={state.currentRole}
              storeItems={state.items}
              dueDays={state.pautanganSettings.dueDays}
              pendingProofsCount={pendingProofsCount}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onSendMessage={handleSendMessage}
              onReceiveAiReply={handleReceiveAiReply}
              onMarkThreadRead={handleMarkThreadRead}
            />
          )}

          {activeSection === 'apps' && (
            <OtherAppsView
              apps={state.otherApps}
              onToggleInstallApp={(appId) =>
                setState((prev) => ({
                  ...prev,
                  otherApps: prev.otherApps.map((a) =>
                    a.id === appId ? { ...a, installed: true } : a
                  ),
                }))
              }
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
            badge: state.unreadCommunityCount,
          },
          { id: 'pautangan', label: 'Loan', icon: HandCoins, badge: 0 },
          ...(canViewDeliveryNav
            ? [{ id: 'delivery', label: 'Delivery', icon: Truck, badge: pendingDeliveriesCount }]
            : [{ id: 'ledger', label: 'Ledger', icon: LayoutDashboard, badge: 0 }]),
          ...(isAdminOrSuper
            ? [{ id: 'admin', label: 'Config', icon: ShieldCheck, badge: pendingProofsCount }]
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
        currentRole={state.currentRole}
        storeItems={state.items}
        dueDays={state.pautanganSettings.dueDays}
        pendingProofsCount={pendingProofsCount}
      />

      {/* Modals & Offline Banner */}
      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        users={state.users}
        onSignInUser={handleSignInUser}
        onSignInEmail={handleSignInEmail}
        onGoogleSignIn={handleGoogleSignIn}
      />

      <QRShareModal isOpen={isQROpen} onClose={() => setIsQROpen(false)} />

      <OfflineIndicator />
    </div>
  );
}
