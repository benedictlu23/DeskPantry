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
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  Terminal,
  Trash2,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { AdminConsoleView } from './components/AdminConsoleView';
import { CashAssistanceView } from './components/CashAssistanceView';
import { ChatHubView } from './components/ChatHubView';
import { CommunityFeedView } from './components/CommunityFeedView';
import { DeliveryStaffView } from './components/DeliveryStaffView';
import {
  DeveloperSettingsView,
  MediaAssetEntry,
} from './components/DeveloperSettingsView';
import { EWalletExchangeView } from './components/EWalletExchangeView';
import { GeminiChatbotDrawer } from './components/GeminiChatbotDrawer';
import { LedgerDashboardView } from './components/LedgerDashboardView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OtherAppsView } from './components/OtherAppsView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { QRShareModal } from './components/QRShareModal';
import { SellerDashboardView } from './components/SellerDashboardView';
import { SignInModal } from './components/SignInModal';
import { StorefrontView } from './components/StorefrontView';
import { StoreOwnerWorkspaceView } from './components/StoreOwnerWorkspaceView';
import { WorkstationSetupModal } from './components/WorkstationSetupModal';
import {
  DEFAULT_PAYMENT_METHODS,
  INITIAL_CASH_ASSISTANCE_SETTINGS,
  INITIAL_PLATFORM_CONFIG,
  INITIAL_STORE_CONFIG,
  OWNER_BASE_COMMISSION_EARNED,
} from './data/seedData';
import { auth } from './firebase';
import {
  addChatMessageToThread,
  approveSellerProofAndSettleOrders,
  approveStoreApplicationAndProvisionStore,
  assignDeliveryStaffToStore,
  clearInternalAppImage,
  clearMarketplaceListingImage,
  clearPaymentProofImage,
  clearStoreItemImage,
  createChatThread,
  createNotificationDoc,
  deleteChatMessage,
  deleteChatThread,
  deleteEWalletPost,
  deleteInternalApp,
  deleteNotificationDoc,
  deleteNotificationDocs,
  deleteSuggestionDoc,
  ensureMultiStoreFoundation,
  getSellerConfigById,
  markMarketplaceOrderDebtSettled,
  markNotificationReadDoc,
  markThreadUnreadCount,
  recordStockAdjustment,
  rejectStoreApplication,
  removeMarketplaceListing,
  removeStoreItem,
  requestStoreCashAssistanceAddon,
  reviewStoreCashAssistanceAddon,
  saveCashAssistanceSettings,
  saveCatalogTemplate,
  saveEWalletPost,
  saveInternalApp,
  saveLoanRecord,
  saveMarketplaceListing,
  saveOrder,
  savePaymentProof,
  savePlatformConfig,
  saveSellerConfig,
  saveStoreConfig,
  saveStoreCustomerCredit,
  saveStoreItem,
  saveStoreProfile,
  saveSuggestion,
  saveUserAccount,
  seedInitialFirestoreDataIfEmpty,
  submitStoreApplication,
  subscribeAuthenticatedData,
  subscribePublicStoreData,
  syncAllFirestoreDataNow,
  syncOwnerCommissionToStoreConfig,
  toggleInternalAppInstalled,
  toggleStoreCashAssistanceVisibility,
  updateEWalletPostPartial,
  updateMarketplaceListingStock,
  updateMarketplaceOrderConfirmation,
  updateOrderDeliveryFields,
  updateSellerListingConfig,
  updateStoreItemStock,
  updateSuggestionComments,
  updateSuggestionStatus,
  updateSuggestionVotes,
  updateUserCheckoutTotals,
  updateUserWorkstationProfile,
  upsertUserOnAuth,
} from './services/firestoreSync';
import {
  ActiveSection,
  CartItem,
  CashAssistanceSettings,
  CashAssistanceSubscriptionStatus,
  CatalogTemplate,
  ChatThread,
  CommissionType,
  CoworkerProfile,
  EWalletPost,
  FulfillmentType,
  InternalApp,
  LoanRecord,
  MarketplaceListing,
  NotificationItem,
  PaymentMethod,
  PaymentProof,
  PlatformConfig,
  SellerConfig,
  StockAdjustmentLog,
  StoreApplication,
  StoreCashAssistanceConfig,
  StoreConfig,
  StoreCustomerCredit,
  StoreItem,
  StoreOrder,
  StoreProfile,
  StoreSubscriptionStatus,
  SuggestionComment,
  SuggestionItem,
  UserAccount,
  UserRole,
} from './types';
import {
  buildLoanInstallments,
  computeCommission,
  DEFAULT_STORE_ID,
  DEFAULT_STORE_NAME,
  DEFAULT_STORE_OWNER_ID,
  formatBuyerWorkstation,
  formatPHP,
  getNextDueDateLabel,
  getOrderItemsSubtotal,
  getOrderRemainingDebt,
  isApprovedDeliveryOrder,
  isOrderPendingAdminConfirmation,
  isOrderPendingSellerConfirmation,
  resolveOrderPaymentType,
  resolveOrderStoreId,
  resolveOrderStoreName,
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
  const [coworkerProfiles, setCoworkerProfiles] = useState<CoworkerProfile[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [isStoreLoading, setIsStoreLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [ewalletPosts, setEWalletPosts] = useState<EWalletPost[]>([]);
  const [cashAssistanceSettings, setCashAssistanceSettings] =
    useState<CashAssistanceSettings>(INITIAL_CASH_ASSISTANCE_SETTINGS);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(
    INITIAL_PLATFORM_CONFIG
  );
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [storeCashAssistance, setStoreCashAssistance] = useState<
    StoreCashAssistanceConfig[]
  >([]);
  const [storeApplications, setStoreApplications] = useState<StoreApplication[]>([]);
  const [catalogTemplates, setCatalogTemplates] = useState<CatalogTemplate[]>([]);
  const [storeCustomerCredits, setStoreCustomerCredits] = useState<
    StoreCustomerCredit[]
  >([]);
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(INITIAL_STORE_CONFIG);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentLog[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [localReadNotifIds, setLocalReadNotifIds] = useState<Record<string, boolean>>({});
  const [dismissedNotifIds, setDismissedNotifIds] = useState<Record<string, boolean>>({});
  const [otherApps, setOtherApps] = useState<InternalApp[]>([]);
  const [sellerConfig, setSellerConfig] = useState<SellerConfig | null>(null);
  const [openCommunitySellSignal, setOpenCommunitySellSignal] = useState(0);
  const [unreadCommunityCount, setUnreadCommunityCount] = useState(0);
  const [lastFeedEvent, setLastFeedEvent] = useState(
    'Live coworker suggestions & approved for-sale drops sync automatically once signed in.'
  );

  const [activeSection, setActiveSection] = useState<ActiveSection>('store');
  const [requestedStoreWorkspace, setRequestedStoreWorkspace] = useState<{
    storeId: string;
    tab?: string;
    nonce: number;
  } | null>(null);
  const [requestedChatThreadId, setRequestedChatThreadId] = useState<{
    threadId: string;
    nonce: number;
  } | null>(null);
  const [requestedAdminSubTab, setRequestedAdminSubTab] = useState<{
    tab:
      | 'items'
      | 'restock'
      | 'stockAdjustments'
      | 'salesOrder'
      | 'config'
      | 'cashAssistance'
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
  const [isWorkstationModalOpen, setIsWorkstationModalOpen] = useState(false);
  const [isWorkstationFirstTime, setIsWorkstationFirstTime] = useState(false);
  const promptedWorkstationUidRef = useRef<string | null>(null);

  const dueDaysRef = useRef<[number, number]>(cashAssistanceSettings.dueDays);
  useEffect(() => {
    dueDaysRef.current = cashAssistanceSettings.dueDays;
  }, [cashAssistanceSettings.dueDays]);

  // Prompt newly signed-in users once to enter Department Name, Table Row & Table Number
  useEffect(() => {
    if (!authReady) return;
    if (!authUser || authUser.role === UserRole.Guest) {
      promptedWorkstationUidRef.current = null;
      setIsWorkstationModalOpen(false);
      return;
    }
    const needsWorkstation =
      !authUser.department?.trim() ||
      authUser.department === 'Department Staff' ||
      authUser.department === 'Unassigned' ||
      !authUser.tableRow?.trim() ||
      !authUser.tableNumber?.trim();

    if (needsWorkstation && promptedWorkstationUidRef.current !== authUser.id) {
      promptedWorkstationUidRef.current = authUser.id;
      setIsWorkstationFirstTime(true);
      setIsWorkstationModalOpen(true);
    }
  }, [
    authReady,
    authUser?.id,
    authUser?.role,
    authUser?.department,
    authUser?.tableRow,
    authUser?.tableNumber,
  ]);

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

  // Restore per-user read & dismissed state for notifications
  useEffect(() => {
    if (!authUser?.id) {
      setLocalReadNotifIds({});
      setDismissedNotifIds({});
      return;
    }
    try {
      const saved = window.localStorage.getItem(`deskpantry_read_notifs_${authUser.id}`);
      setLocalReadNotifIds(saved ? (JSON.parse(saved) as Record<string, boolean>) : {});
    } catch {
      setLocalReadNotifIds({});
    }
    try {
      const savedDismissed = window.localStorage.getItem(
        `deskpantry_dismissed_notifs_${authUser.id}`
      );
      setDismissedNotifIds(
        savedDismissed ? (JSON.parse(savedDismissed) as Record<string, boolean>) : {}
      );
    } catch {
      setDismissedNotifIds({});
    }
  }, [authUser?.id]);

  // Public storefront catalog, stores & store config live subscription
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
          setCashAssistanceSettings((prev) => ({
            ...prev,
            dueDays: [Number(syncedDueDays[0]), Number(syncedDueDays[1])],
          }));
        }
      },
      onStores: (nextStores) => {
        setStores(nextStores);
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
        setCoworkerProfiles([]);
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
        setStoreCashAssistance([]);
        setStoreApplications([]);
        setCatalogTemplates([]);
        setStoreCustomerCredits([]);
        setSellerConfig(null);
        setLocalReadNotifIds({});
        setDismissedNotifIds({});
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
            void ensureMultiStoreFoundation(account.id);
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

  // Authenticated Firestore real-time subscriptions keyed by verified UID, role, owned stores & Cash Assistance permission
  const authOwnedStoresKey = (authUser?.ownedStoreIds ?? []).join(',');
  useEffect(() => {
    if (!authUser) return;

    const unsubData = subscribeAuthenticatedData(
      {
        uid: authUser.id,
        role: authUser.role,
        cashAssistanceEnabled: authUser.cashAssistanceEnabled,
        ownedStoreIds: authUser.ownedStoreIds ?? [],
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
        onCoworkerProfiles: (profiles) => {
          setCoworkerProfiles(profiles);
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
        onCashAssistanceSettings: (nextSettings) => {
          dueDaysRef.current = nextSettings.dueDays;
          setCashAssistanceSettings(nextSettings);
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
        onPlatformConfig: (nextPlatformCfg) => {
          setPlatformConfig(nextPlatformCfg);
        },
        onStoreCashAssistance: (nextConfigs) => {
          setStoreCashAssistance(nextConfigs);
        },
        onStoreApplications: (nextApps) => {
          setStoreApplications(nextApps);
        },
        onCatalogTemplates: (nextTemplates) => {
          setCatalogTemplates(nextTemplates);
        },
        onStoreCustomerCredits: (nextCredits) => {
          setStoreCustomerCredits(nextCredits);
        },
      }
    );

    return () => unsubData();
  }, [
    authUser?.id,
    authUser?.role,
    authUser?.cashAssistanceEnabled,
    authOwnedStoresKey,
  ]);

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

  const isStoreOwnerUser = useMemo(() => {
    if (!currentUser || currentRole === UserRole.Guest) return false;
    if (isAdminOrSuper) return true;
    return (
      (currentUser.ownedStoreIds?.length ?? 0) > 0 ||
      stores.some((s) => s.ownerId === currentUser.id)
    );
  }, [currentUser, currentRole, isAdminOrSuper, stores]);

  const canManageStore = (storeId?: string, storeOwnerId?: string): boolean => {
    if (isActualAdmin) return true;
    if (!authUser?.id) return false;
    if (storeOwnerId && storeOwnerId === authUser.id) return true;
    const sid = storeId || DEFAULT_STORE_ID;
    const matched = stores.find((s) => s.id === sid);
    if (matched && matched.ownerId === authUser.id) return true;
    return (authUser.ownedStoreIds ?? []).includes(sid);
  };

  // Strict Confidentiality: Cash Assistance is never visible as a locked upsell to non-store-owners.
  // Store Owners only see it when visibleToOwner === true (controlled by Admin / Super Admin).
  const canViewCashAssistanceNav = Boolean(
    currentUser &&
      (currentRole === UserRole.SuperAdmin ||
        (currentUser.cashAssistanceEnabled &&
          (cashAssistanceSettings.globalEnabled || isAdminOrSuper)) ||
        storeCashAssistance.some(
          (c) =>
            c.storeOwnerId === currentUser.id &&
            (c.visibleToOwner === true || c.status === 'active')
        ))
  );

  // Ensure each signed-in coworker has a private DeskPantry AI conversation thread (ai-<uid>)
  const ensuredPrivateAiUidRef = useRef<string | null>(null);
  useEffect(() => {
    if (!authUser?.id || authUser.role === UserRole.Guest) {
      ensuredPrivateAiUidRef.current = null;
      return;
    }
    if (ensuredPrivateAiUidRef.current === authUser.id) return;
    ensuredPrivateAiUidRef.current = authUser.id;
    const privateAiId = `ai-${authUser.id}`;
    const meta: Omit<ChatThread, 'messages'> = {
      id: privateAiId,
      title: `DeskPantry AI · ${authUser.name}`.slice(0, 140),
      subtitle: 'Private Gemini Assistant · Visible only to you',
      type: 'ai',
      participantIds: [authUser.id],
      unreadCount: 0,
    };
    void createChatThread(meta)
      .then(() => {
        setThreads((prev) =>
          prev.some((t) => t.id === privateAiId)
            ? prev
            : [{ ...meta, messages: [] }, ...prev]
        );
      })
      .catch((err) => {
        console.error('Failed to ensure private AI thread:', err);
      });
  }, [authUser?.id, authUser?.role, authUser?.name]);

  // Guard restricted views and close notification drawer when signed out / guest
  useEffect(() => {
    if (!currentUser || currentRole === UserRole.Guest) {
      setIsNotifOpen(false);
      setIsProfileMenuOpen(false);
    }
    if ((activeSection === 'admin' || activeSection === 'developer') && !isAdminOrSuper) {
      setActiveSection('store');
    }
    if (activeSection === 'delivery' && !canViewDeliveryNav) {
      setActiveSection('store');
    }
    if (activeSection === 'storeOwner' && !isStoreOwnerUser) {
      setActiveSection('store');
    }
    if (activeSection === 'cashAssistance' && !canViewCashAssistanceNav) {
      setActiveSection('store');
    }
  }, [
    currentUser,
    currentRole,
    activeSection,
    isAdminOrSuper,
    canViewDeliveryNav,
    isStoreOwnerUser,
    canViewCashAssistanceNav,
  ]);

  const nextDueLabel = useMemo(
    () => getNextDueDateLabel(cashAssistanceSettings.dueDays),
    [cashAssistanceSettings.dueDays]
  );

  const ownerCommissionEarned = useMemo(
    () =>
      OWNER_BASE_COMMISSION_EARNED +
      orders.reduce((sum, o) => sum + (o.commissionEarned ?? 0), 0),
    [orders]
  );

  const allRegisteredCoworkers = useMemo<CoworkerProfile[]>(() => {
    const map = new Map<string, CoworkerProfile>();
    for (const p of coworkerProfiles) {
      if (p.id) map.set(p.id, p);
    }
    for (const u of users) {
      if (u.id && !map.has(u.id)) {
        map.set(u.id, {
          id: u.id,
          name: u.name,
          department: u.department,
          tableRow: u.tableRow,
          tableNumber: u.tableNumber,
          avatarInitials: u.avatarInitials,
          avatarUrl: u.avatarUrl,
        });
      }
    }
    if (authUser && !map.has(authUser.id)) {
      map.set(authUser.id, {
        id: authUser.id,
        name: authUser.name,
        department: authUser.department,
        tableRow: authUser.tableRow,
        tableNumber: authUser.tableNumber,
        avatarInitials: authUser.avatarInitials,
        avatarUrl: authUser.avatarUrl,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [coworkerProfiles, users, authUser]);

  const autoDeleteAttemptedRef = useRef<Set<string>>(new Set());
  const stampedCompletedAtRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!authUser?.id) return;
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    const runCleanup = () => {
      const now = Date.now();
      for (const post of ewalletPosts) {
        if (post.status !== 'Completed') continue;

        if (typeof post.completedAtMs === 'number') {
          if (now >= post.completedAtMs + ONE_WEEK_MS + 5000) {
            if (autoDeleteAttemptedRef.current.has(post.id)) continue;
            autoDeleteAttemptedRef.current.add(post.id);
            setEWalletPosts((prev) => prev.filter((p) => p.id !== post.id));
            void deleteEWalletPost(post.id).catch((err) => {
              autoDeleteAttemptedRef.current.delete(post.id);
              console.error('Failed to auto-delete expired E-Wallet post:', err);
            });
          }
        } else if (isActualAdmin && !stampedCompletedAtRef.current.has(post.id)) {
          stampedCompletedAtRef.current.add(post.id);
          const stampMs = now;
          setEWalletPosts((prev) =>
            prev.map((p) => (p.id === post.id ? { ...p, completedAtMs: stampMs } : p))
          );
          void updateEWalletPostPartial(post.id, { completedAtMs: stampMs }).catch(() => {
            stampedCompletedAtRef.current.delete(post.id);
          });
        }
      }
    };

    runCleanup();
    const timer = window.setInterval(runCleanup, 60_000);
    return () => window.clearInterval(timer);
  }, [ewalletPosts, authUser?.id, isActualAdmin]);

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
        return 'admins';
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

      // 2. Comments and share orders on their Buy/Sell E-Wallet post (never broadcast new posts)
      if (n.type === 'ewallet') {
        return (
          titleLower.includes('comment') ||
          bodyLower.includes('commented') ||
          titleLower.includes('share') ||
          titleLower.includes('order') ||
          bodyLower.includes('claimed')
        );
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

      // 4. Unread coworker chat messages, store updates & Cash Assistance notices
      if (
        n.type === 'chat' ||
        n.type === 'store' ||
        n.type === 'cash_assistance'
      ) {
        return true;
      }

      return false;
    };

    return notifications
      .filter((n) => !dismissedNotifIds[n.id])
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
    dismissedNotifIds,
    currentUser,
    currentRole,
    canViewDeliveryNav,
    isAdminOrSuper,
  ]);

  const myPrivateAiThread = useMemo<ChatThread | null>(() => {
    if (!currentUser) return null;
    const found = threads.find(
      (t) =>
        t.type === 'ai' &&
        (t.id === `ai-${currentUser.id}` || t.participantIds.includes(currentUser.id))
    );
    if (found) return found;
    return {
      id: `ai-${currentUser.id}`,
      title: `DeskPantry AI · ${currentUser.name}`.slice(0, 140),
      subtitle: 'Private Gemini Assistant · Visible only to you',
      type: 'ai',
      participantIds: [currentUser.id],
      unreadCount: 0,
      messages: [],
    };
  }, [threads, currentUser?.id, currentUser?.name]);

  const unreadNotifCount = effectiveNotifications.filter((n) => !n.read).length;
  const unreadChatCount = currentUser
    ? threads.reduce((sum, t) => {
        const isMyInbox =
          (t.type === 'ai' &&
            (t.id === `ai-${currentUser.id}` || t.participantIds.includes(currentUser.id))) ||
          t.type === 'channel' ||
          (t.type === 'dm' && t.participantIds.includes(currentUser.id));
        if (!isMyInbox) return sum;
        const countForMe =
          t.unreadBy && typeof t.unreadBy === 'object'
            ? Math.max(0, Number(t.unreadBy[currentUser.id] ?? 0))
            : Math.max(0, Number(t.unreadCount ?? 0));
        return sum + countForMe;
      }, 0)
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

  const handleSaveWorkstationProfile = async (workstation: {
    department: string;
    tableRow: string;
    tableNumber: string;
  }): Promise<void> => {
    if (!authUser) {
      throw new Error('Sign in to update your department and desk location.');
    }
    const cleanDept = workstation.department.trim();
    const cleanRow = workstation.tableRow.trim();
    const cleanTable = workstation.tableNumber.trim();
    const prevAuthUser = authUser;
    const prevUsers = users;
    const prevProfiles = coworkerProfiles;

    setAuthUser((prev) =>
      prev
        ? { ...prev, department: cleanDept, tableRow: cleanRow, tableNumber: cleanTable }
        : prev
    );
    setUsers((prev) =>
      prev.map((u) =>
        u.id === authUser.id
          ? { ...u, department: cleanDept, tableRow: cleanRow, tableNumber: cleanTable }
          : u
      )
    );
    setCoworkerProfiles((prev) =>
      prev.map((p) =>
        p.id === authUser.id
          ? { ...p, department: cleanDept, tableRow: cleanRow, tableNumber: cleanTable }
          : p
      )
    );

    try {
      await updateUserWorkstationProfile(authUser.id, {
        department: cleanDept,
        tableRow: cleanRow,
        tableNumber: cleanTable,
      });
    } catch (err) {
      setAuthUser(prevAuthUser);
      setUsers(prevUsers);
      setCoworkerProfiles(prevProfiles);
      throw err;
    }
  };

  const handleSubmitStoreApplication = async (payload: {
    storeName: string;
    description: string;
    paymentChannels: string;
  }): Promise<void> => {
    if (!currentUser) {
      throw new Error('Sign in first to apply for a store.');
    }
    const newApp: StoreApplication = {
      id: `app-${Date.now().toString(36)}`,
      applicantId: currentUser.id,
      applicantName: currentUser.name,
      applicantDepartment: currentUser.department || 'Team',
      storeName: payload.storeName.trim(),
      description: payload.description.trim(),
      paymentChannels: payload.paymentChannels.trim() || 'Cash, GCash, Maya',
      quotedBaseFee: platformConfig.baseStoreMonthlyFee,
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setStoreApplications((prev) => [newApp, ...prev]);
    try {
      await submitStoreApplication(newApp);
      await createNotificationDoc({
        id: `notif-storeapp-${Date.now()}`,
        title: `New Store Application · ${newApp.storeName}`.slice(0, 140),
        body: `${currentUser.name} (${currentUser.department}) applied to open "${newApp.storeName}". Review in Developer Settings.`.slice(
          0,
          500
        ),
        timestamp: 'Just now',
        type: 'store',
        read: false,
        targetUserId: 'super_admin',
      });
    } catch (err) {
      setStoreApplications((prev) => prev.filter((a) => a.id !== newApp.id));
      throw err;
    }
  };

  const handlePlaceSplitOrder = async (payload: {
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
  }): Promise<void> => {
    if (!currentUser) return;
    if (payload.groups.length === 0) return;

    const cleanBuyerDept = payload.buyerDepartment?.trim() || currentUser.department;
    const cleanBuyerRow = payload.buyerTableRow?.trim() || currentUser.tableRow || '';
    const cleanBuyerTable = payload.buyerTableNumber?.trim() || currentUser.tableNumber || '';

    const needsProfileSync =
      (!authUser?.department?.trim() ||
        authUser.department === 'Department Staff' ||
        authUser.department === 'Unassigned' ||
        !authUser?.tableRow?.trim() ||
        !authUser?.tableNumber?.trim()) &&
      Boolean(cleanBuyerDept && cleanBuyerRow && cleanBuyerTable);
    if (needsProfileSync) {
      void handleSaveWorkstationProfile({
        department: cleanBuyerDept,
        tableRow: cleanBuyerRow,
        tableNumber: cleanBuyerTable,
      }).catch(() => {});
    }

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${nowTime}`;
    const fallbackRunner = users.find((u) => u.role === UserRole.DeliveryStaff);

    const createdOrders: StoreOrder[] = [];
    const createdProofs: PaymentProof[] = [];

    for (const group of payload.groups) {
      const storeObj = stores.find((s) => s.id === group.storeId);
      if (storeObj?.subscriptionStatus === 'suspended') {
        throw new Error(`${group.storeName} is currently suspended and cannot accept orders.`);
      }

      const storeOwnerId = storeObj?.ownerId || DEFAULT_STORE_OWNER_ID;
      const storeDueDays = storeObj?.dueDays ?? cashAssistanceSettings.dueDays;
      const storeDueLabel = getNextDueDateLabel(storeDueDays);
      const deliveryEnabled = storeObj
        ? storeObj.deliveryEnabled
        : storeConfig.deliveryEnabled;
      const storeDeliveryFee = storeObj
        ? storeObj.deliveryFee
        : storeConfig.deliveryFee;

      const orderItems = group.items
        .map((line) => {
          const item = items.find((i) => i.id === line.itemId);
          if (!item) return null;
          return {
            itemId: item.id,
            name: item.name,
            quantity: line.quantity,
            unitPrice: item.price,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (orderItems.length === 0) continue;

      const subtotal = orderItems.reduce(
        (sum, li) => sum + li.quantity * li.unitPrice,
        0
      );
      const deliveryFee =
        group.fulfillment === FulfillmentType.Delivery && deliveryEnabled
          ? storeDeliveryFee
          : 0;
      const commissionPct = platformConfig.deliveryCommissionRate ?? 100;
      const deliveryCommission =
        deliveryFee > 0 ? Math.round((deliveryFee * commissionPct) / 100) : 0;
      const totalAmount = subtotal + deliveryFee;

      const isDigital = Boolean(group.proofChannel && group.proofImage);
      const paymentType = resolveOrderPaymentType({
        paymentMethod: group.paymentMethod,
      });
      const isDebt = paymentType === 'credit';
      const isPickup = group.fulfillment === FulfillmentType.Pickup;

      const assignedStaffIds = storeObj?.assignedDeliveryStaffIds ?? [];
      const preferredRunnerId = assignedStaffIds[0] ?? fallbackRunner?.id;
      const preferredRunnerName =
        users.find((u) => u.id === preferredRunnerId)?.name ??
        coworkerProfiles.find((c) => c.id === preferredRunnerId)?.name ??
        fallbackRunner?.name ??
        'Kuya Jun Reyes';
      const runnerName = isPickup ? 'Pick Up' : preferredRunnerName;

      const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`;

      const newOrder: StoreOrder = {
        id: orderId,
        storeId: group.storeId,
        storeName: group.storeName,
        storeOwnerId,
        assignedDeliveryStaffIds: assignedStaffIds,
        userId: currentUser.id,
        userName: currentUser.name,
        buyerDepartment: cleanBuyerDept || undefined,
        buyerTableRow: cleanBuyerRow || undefined,
        buyerTableNumber: cleanBuyerTable || undefined,
        items: orderItems,
        subtotal,
        totalAmount,
        deliveryFee,
        deliveryCommission,
        fulfillment: group.fulfillment,
        deliveryNote: group.deliveryNote || undefined,
        paymentMethod: group.paymentMethod,
        paymentType,
        status: 'Pending Admin Review',
        deliveryStatus: 'Pending Admin Approval',
        assignedRunnerId: isPickup ? undefined : preferredRunnerId,
        assignedRunner: runnerName,
        cashCollected: false,
        createdAt: nowLabel,
        orderDateIso: todayIso,
        dueDateLabel: isDebt ? storeDueLabel : undefined,
        source: 'store',
        logs: [
          {
            id: `lg-${Date.now()}-${createdOrders.length}-1`,
            timestamp: nowLabel,
            event: `Order placed at ${group.storeName} via ${group.paymentMethod} (${
              isPickup ? 'Pick Up' : 'Delivery'
            }) — Waiting for store owner confirmation & stock release`,
            actor: currentUser.name,
          },
          ...(deliveryFee > 0
            ? [
                {
                  id: `lg-${Date.now()}-${createdOrders.length}-2`,
                  timestamp: nowLabel,
                  event: `Assigned runner ${runnerName} (${formatPHP(deliveryCommission)} commission — dispatched after confirmation)`,
                  actor: 'System',
                },
              ]
            : []),
        ],
      };

      createdOrders.push(newOrder);

      if (isDigital && group.proofChannel && group.proofImage) {
        const newProof: PaymentProof = {
          id: `PRF-${Date.now().toString(36).toUpperCase()}-${Math.random()
            .toString(36)
            .slice(2, 5)
            .toUpperCase()}`,
          storeId: group.storeId,
          storeName: group.storeName,
          storeOwnerId,
          userId: currentUser.id,
          userName: currentUser.name,
          amount: totalAmount,
          channel: group.proofChannel,
          referenceNo: group.proofRef || 'REF-PENDING',
          purpose: 'Order Payment',
          imageDataUrl: group.proofImage,
          submittedAt: nowLabel,
          status: 'pending',
          orderId,
        };
        createdProofs.push(newProof);
      }
    }

    if (createdOrders.length === 0) return;

    setCart([]);
    setOrders((prev) => [...createdOrders, ...prev]);
    if (createdProofs.length > 0) {
      setProofs((prev) => [...createdProofs, ...prev]);
    }

    await Promise.all([
      ...createdOrders.map((ord) => saveOrder(ord)),
      ...createdProofs.map((prf) => savePaymentProof(prf)),
    ]);

    for (const ord of createdOrders) {
      const targetRecipient =
        ord.storeOwnerId && ord.storeOwnerId !== currentUser.id
          ? ord.storeOwnerId
          : 'admins';
      void createNotificationDoc({
        id: `notif-ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `New ${ord.storeName} Order Awaiting Confirmation · ${ord.id}`.slice(0, 140),
        body: `${currentUser.name} placed ${formatPHP(ord.totalAmount, true)} via ${ord.paymentMethod} (${
          ord.fulfillment === FulfillmentType.Pickup ? 'Pick Up' : 'Delivery'
        }). Confirm in Store Workspace.`.slice(0, 500),
        timestamp: 'Just now',
        type: 'store',
        read: false,
        targetUserId: targetRecipient,
      });
    }
  };

  const handlePlaceOrder = (payload: {
    fulfillment: FulfillmentType;
    deliveryNote: string;
    paymentMethod: string;
    proofChannel?: string;
    proofRef?: string;
    proofImage?: string;
    buyerDepartment?: string;
    buyerTableRow?: string;
    buyerTableNumber?: string;
  }) => {
    if (!currentUser) return;
    const grouped = new Map<string, Array<{ itemId: string; quantity: number }>>();
    for (const entry of cart) {
      const product = items.find((i) => i.id === entry.itemId);
      const sid = product?.storeId || DEFAULT_STORE_ID;
      const arr = grouped.get(sid) ?? [];
      arr.push({ itemId: entry.itemId, quantity: entry.quantity });
      grouped.set(sid, arr);
    }
    const groups = Array.from(grouped.entries()).map(([storeId, lineItems]) => {
      const st = stores.find((s) => s.id === storeId);
      return {
        storeId,
        storeName:
          st?.name ||
          items.find((i) => i.storeId === storeId)?.storeName ||
          DEFAULT_STORE_NAME,
        fulfillment: payload.fulfillment,
        deliveryNote: payload.deliveryNote,
        paymentMethod: payload.paymentMethod,
        proofChannel: payload.proofChannel,
        proofRef: payload.proofRef,
        proofImage: payload.proofImage,
        items: lineItems,
      };
    });
    void handlePlaceSplitOrder({
      groups,
      buyerDepartment: payload.buyerDepartment || currentUser.department,
      buyerTableRow: payload.buyerTableRow || currentUser.tableRow || '',
      buyerTableNumber: payload.buyerTableNumber || currentUser.tableNumber || '',
    });
  };

  const approveOrderInternal = async (
    orderId: string,
    options?: { skipProofId?: string }
  ): Promise<void> => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }
    if (!canManageStore(targetOrder.storeId, targetOrder.storeOwnerId)) {
      throw new Error('Only the Store Owner or an Admin can confirm this store order.');
    }
    if (!isOrderPendingAdminConfirmation(targetOrder)) {
      throw new Error(`Order ${orderId} has already been processed.`);
    }

    const wasPendingAdminReview = targetOrder.status === 'Pending Admin Review';
    const isPickup = targetOrder.fulfillment === FulfillmentType.Pickup;
    const paymentType = resolveOrderPaymentType(targetOrder);
    const isCash = paymentType === 'cash';
    const isDebt = paymentType === 'credit';
    const actorName = authUser?.name ?? currentUser?.name ?? 'Store Owner';
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${nowTime}`;

    const storeId = resolveOrderStoreId(targetOrder);
    const storeObj = stores.find((s) => s.id === storeId);
    const storeName = storeObj?.name || resolveOrderStoreName(targetOrder);
    const storeOwnerId =
      targetOrder.storeOwnerId || storeObj?.ownerId || DEFAULT_STORE_OWNER_ID;

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

    const assignedStaffIds =
      storeObj?.assignedDeliveryStaffIds ?? targetOrder.assignedDeliveryStaffIds ?? [];
    const defaultRunner =
      users.find((u) => assignedStaffIds.includes(u.id)) ??
      users.find((u) => u.role === UserRole.DeliveryStaff);
    const preferredRunnerId =
      targetOrder.assignedRunnerId ?? assignedStaffIds[0] ?? defaultRunner?.id;
    const preferredRunnerName =
      users.find((u) => u.id === preferredRunnerId)?.name ??
      coworkerProfiles.find((c) => c.id === preferredRunnerId)?.name ??
      defaultRunner?.name ??
      'Kuya Jun Reyes';

    const runnerName = isPickup
      ? 'Pick Up'
      : targetOrder.assignedRunner &&
          targetOrder.assignedRunner !== 'Counter B Pickup' &&
          targetOrder.assignedRunner !== 'Pick Up'
        ? targetOrder.assignedRunner
        : preferredRunnerName;

    const updatedOrder: StoreOrder = {
      ...targetOrder,
      storeId,
      storeName,
      storeOwnerId,
      assignedDeliveryStaffIds: assignedStaffIds,
      paymentType,
      status: isPickup ? 'Completed' : 'Confirmed',
      deliveryStatus: isPickup ? 'Delivered' : 'Pending Dispatch',
      assignedRunnerId: isPickup ? undefined : preferredRunnerId,
      assignedRunner: runnerName,
      deliveredAt: isPickup ? nowLabel : targetOrder.deliveredAt,
      cashCollected: isPickup && isCash ? true : targetOrder.cashCollected,
      logs: [
        ...(targetOrder.logs ?? []),
        {
          id: `lg-app-${Date.now()}`,
          timestamp: nowLabel,
          event: isPickup
            ? `Confirmed & stock released by ${actorName} (${storeName}) — Pick Up Completed`
            : `Confirmed & stock released by ${actorName} (${storeName}) — Dispatched to ${runnerName}`,
          actor: actorName,
        },
      ],
    };

    const previousOrders = orders;
    const previousItems = items;
    const previousUsers = users;
    const previousProofs = proofs;
    const previousCredits = storeCustomerCredits;

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

    let nextStoreCredit: StoreCustomerCredit | null = null;
    if (wasPendingAdminReview && isDebt && targetOrder.userId && targetOrder.userId !== 'walk-in') {
      const creditId = `${storeId}__${targetOrder.userId}`;
      const existingCredit = storeCustomerCredits.find((c) => c.id === creditId);
      nextStoreCredit = {
        id: creditId,
        storeId,
        storeName,
        storeOwnerId,
        userId: targetOrder.userId,
        userName: targetOrder.userName,
        balance: Math.max(0, (existingCredit?.balance ?? 0) + targetOrder.totalAmount),
        totalCharged: Math.max(
          0,
          (existingCredit?.totalCharged ?? 0) + targetOrder.totalAmount
        ),
        totalPaid: existingCredit?.totalPaid ?? 0,
        updatedAt: todayIso,
      };
      setStoreCustomerCredits((prev) => {
        const exists = prev.some((c) => c.id === creditId);
        return exists
          ? prev.map((c) => (c.id === creditId ? nextStoreCredit! : c))
          : [nextStoreCredit!, ...prev];
      });
    }

    const targetCustomer =
      targetOrder.userId && targetOrder.userId !== 'walk-in'
        ? users.find((u) => u.id === targetOrder.userId) ??
          (authUser?.id === targetOrder.userId ? authUser : undefined)
        : undefined;
    const canWriteBuyerUserDoc = Boolean(
      targetCustomer && (isActualAdmin || targetCustomer.id === authUser?.id)
    );
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
    const nextStoreDebtMap =
      shouldUpdateCustomerTotals && targetCustomer
        ? {
            ...(targetCustomer.storeDebtBalances ?? {}),
            ...(nextStoreCredit ? { [storeId]: nextStoreCredit.balance } : {}),
          }
        : undefined;

    if (shouldUpdateCustomerTotals && targetCustomer) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetCustomer.id
            ? {
                ...u,
                debtBalance: nextDebt,
                totalSpent: nextSpent,
                ...(nextStoreDebtMap ? { storeDebtBalances: nextStoreDebtMap } : {}),
              }
            : u
        )
      );
      if (authUser?.id === targetCustomer.id) {
        setAuthUser((prev) =>
          prev
            ? {
                ...prev,
                debtBalance: nextDebt,
                totalSpent: nextSpent,
                ...(nextStoreDebtMap ? { storeDebtBalances: nextStoreDebtMap } : {}),
              }
            : prev
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
            ? { ...p, status: 'approved', reviewedBy: actorName, reviewedAt: nowLabel }
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
      if (nextStoreCredit) {
        await saveStoreCustomerCredit(nextStoreCredit);
      }
      if (shouldUpdateCustomerTotals && targetCustomer && canWriteBuyerUserDoc) {
        await updateUserCheckoutTotals(
          targetCustomer.id,
          nextDebt,
          nextSpent,
          nextStoreDebtMap
        );
      }
      if (linkedPendingProofs.length > 0) {
        await Promise.all(
          linkedPendingProofs.map((p) =>
            savePaymentProof({
              ...p,
              status: 'approved',
              reviewedBy: actorName,
              reviewedAt: nowLabel,
            })
          )
        );
      }
    } catch (err) {
      setOrders(previousOrders);
      setItems(previousItems);
      setUsers(previousUsers);
      setProofs(previousProofs);
      setStoreCustomerCredits(previousCredits);
      throw err;
    }

    if (!isPickup) {
      void createNotificationDoc({
        id: `notif-del-${Date.now()}`,
        title: `Approved ${storeName} Delivery · ${updatedOrder.id}`.slice(0, 140),
        body: `${updatedOrder.userName}'s order from ${storeName} is ready for desk delivery (${updatedOrder.deliveryNote || 'Office Floor'}).`.slice(
          0,
          500
        ),
        timestamp: 'Just now',
        type: 'delivery',
        read: false,
        targetUserId: 'delivery',
      });
    }
  };

  const handleApprovePendingOrder = async (orderId: string): Promise<void> => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }
    if (!canManageStore(targetOrder.storeId, targetOrder.storeOwnerId)) {
      throw new Error('Store Owner or Admin access required to confirm sales orders.');
    }
    await approveOrderInternal(orderId);
  };

  const handleRejectPendingOrder = async (orderId: string): Promise<void> => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }
    if (!canManageStore(targetOrder.storeId, targetOrder.storeOwnerId)) {
      throw new Error('Store Owner or Admin access required to reject sales orders.');
    }
    if (!isOrderPendingAdminConfirmation(targetOrder)) {
      throw new Error(`Order ${orderId} has already been processed.`);
    }

    const actorName = authUser?.name ?? currentUser?.name ?? 'Store Owner';
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
          event: 'Order rejected by store owner (no stock or credit charged)',
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
            ? { ...p, status: 'rejected', reviewedBy: actorName, reviewedAt: nowLabel }
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
              reviewedAt: nowLabel,
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
    if (!authUser || !isActualAdmin) {
      throw new Error('Sign in with an Admin account to sync Firestore data.');
    }
    const res = await syncAllFirestoreDataNow({
      uid: authUser.id,
      role: authUser.role,
      cashAssistanceEnabled: authUser.cashAssistanceEnabled,
      ownedStoreIds: authUser.ownedStoreIds ?? [],
    });

    setItems(res.items);
    setStores(res.stores);
    if (res.platformConfig) setPlatformConfig(res.platformConfig);
    setStoreApplications(res.storeApplications);
    setCatalogTemplates(res.catalogTemplates);
    setStoreCustomerCredits(res.storeCustomerCredits);
    setIsStoreLoading(false);
    if (res.storeConfig) {
      const { dueDays: syncedDueDays, ...rest } = res.storeConfig;
      setStoreConfig(rest);
      if (Array.isArray(syncedDueDays) && syncedDueDays.length === 2) {
        dueDaysRef.current = [Number(syncedDueDays[0]), Number(syncedDueDays[1])];
      }
    }
    if (res.cashAssistanceSettings) {
      dueDaysRef.current = res.cashAssistanceSettings.dueDays;
      setCashAssistanceSettings(res.cashAssistanceSettings);
    }
    if (res.currentUser) setAuthUser(res.currentUser);
    if (res.users.length > 0) setUsers(res.users);
    if (res.coworkerProfiles.length > 0) setCoworkerProfiles(res.coworkerProfiles);
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
    if (actualRole !== UserRole.DeliveryStaff && !isActualAdmin) return;
    const actorName = currentUser?.name ?? 'Delivery Staff';
    const stamp = `${new Date().toISOString().slice(0, 10)} ${new Date().toLocaleTimeString(
      [],
      { hour: '2-digit', minute: '2-digit' }
    )}`;
    const target = orders.find((o) => o.id === orderId);
    if (!target || target.source === 'marketplace') return;

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

    const nextOrderStatus =
      deliveryStatus === 'Delivered' ? 'Completed' : target.status;

    const patch: Partial<StoreOrder> = {
      status: nextOrderStatus,
      deliveryStatus,
      cashCollected: cashCollected ?? target.cashCollected,
      assignedRunnerId: target.assignedRunnerId || authUser?.id,
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

  const handleToggleVote = (
    suggestionId: string,
    direction: 'up' | 'down' = 'up'
  ) => {
    if (!currentUser) return;
    const target = suggestions.find((s) => s.id === suggestionId);
    if (!target) return;

    const existingUpIds = target.voterIds ?? [];
    const existingUpNames = target.voterNames ?? [];
    const existingDownIds = target.downvoterIds ?? [];
    const existingDownNames = target.downvoterNames ?? [];

    let nextVoterIds = existingUpIds;
    let nextVoterNames = existingUpNames;
    let nextDownvoterIds = existingDownIds;
    let nextDownvoterNames = existingDownNames;

    if (direction === 'up') {
      const alreadyUp = existingUpIds.includes(currentUser.id);
      nextVoterIds = alreadyUp
        ? existingUpIds.filter((id) => id !== currentUser.id)
        : [...existingUpIds, currentUser.id];
      nextVoterNames = alreadyUp
        ? existingUpNames.filter((n) => n !== currentUser.name)
        : existingUpNames.includes(currentUser.name)
          ? existingUpNames
          : [...existingUpNames, currentUser.name];
      if (!alreadyUp) {
        nextDownvoterIds = existingDownIds.filter((id) => id !== currentUser.id);
        nextDownvoterNames = existingDownNames.filter((n) => n !== currentUser.name);
      }
    } else {
      const alreadyDown = existingDownIds.includes(currentUser.id);
      nextDownvoterIds = alreadyDown
        ? existingDownIds.filter((id) => id !== currentUser.id)
        : [...existingDownIds, currentUser.id];
      nextDownvoterNames = alreadyDown
        ? existingDownNames.filter((n) => n !== currentUser.name)
        : existingDownNames.includes(currentUser.name)
          ? existingDownNames
          : [...existingDownNames, currentUser.name];
      if (!alreadyDown) {
        nextVoterIds = existingUpIds.filter((id) => id !== currentUser.id);
        nextVoterNames = existingUpNames.filter((n) => n !== currentUser.name);
      }
    }

    setUnreadCommunityCount((c) => c + 1);
    setLastFeedEvent(
      `${currentUser.name} ${direction === 'up' ? 'upvoted' : 'downvoted'} "${target.title}".`
    );
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === suggestionId
          ? {
              ...s,
              voterIds: nextVoterIds,
              voterNames: nextVoterNames,
              downvoterIds: nextDownvoterIds,
              downvoterNames: nextDownvoterNames,
            }
          : s
      )
    );
    void updateSuggestionVotes(
      suggestionId,
      nextVoterIds,
      nextVoterNames,
      nextDownvoterIds,
      nextDownvoterNames
    );
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
      downvoterIds: [],
      downvoterNames: [],
      status: 'Open for Votes',
      comments: [],
    };
    setSuggestions((prev) => [newSug, ...prev]);
    setUnreadCommunityCount((c) => c + 1);
    setLastFeedEvent(`${currentUser.name} requested "${title}" on Suggestions Feed.`);
    void saveSuggestion(newSug);
  };

  const handleDeleteSuggestion = async (suggestionId: string): Promise<void> => {
    if (!currentUser) return;
    const target = suggestions.find((s) => s.id === suggestionId);
    if (!target) return;
    if (!isActualAdmin && target.requestedById !== currentUser.id) {
      throw new Error('Only the suggestion author or an Admin can delete this post.');
    }
    const previous = suggestions;
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    try {
      await deleteSuggestionDoc(suggestionId);
    } catch (err) {
      setSuggestions(previous);
      throw err;
    }
  };

  const handleAddSuggestionComment = (suggestionId: string, text: string) => {
    if (!currentUser) return;
    const target = suggestions.find((s) => s.id === suggestionId);
    if (!target || !text.trim()) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nextComment: SuggestionComment = {
      id: `sugc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userDepartment: currentUser.department,
      text: text.trim().slice(0, 400),
      createdAt: `${todayIso} ${nowTime}`,
    };
    const nextComments = [...(target.comments ?? []), nextComment];
    setSuggestions((prev) =>
      prev.map((s) => (s.id === suggestionId ? { ...s, comments: nextComments } : s))
    );
    void updateSuggestionComments(suggestionId, nextComments);
  };

  const handleUpdateSuggestionStatus = (
    suggestionId: string,
    status: SuggestionItem['status']
  ) => {
    if (!isActualAdmin) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const addedToStoreAt = status === 'Added to Pantry' ? `${todayIso} ${nowTime}` : undefined;
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === suggestionId ? { ...s, status, addedToStoreAt } : s
      )
    );
    void updateSuggestionStatus(suggestionId, status, addedToStoreAt);
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
      title: 'For-Sale Listing Pending Admin Approval',
      body: `${currentUser.name} submitted "${payload.title}" (${formatPHP(payload.price)}) for review.`,
      timestamp: 'Just now',
      type: 'marketplace',
      read: false,
      targetUserId: 'admins',
    });
  };

  const handleBuyListing = (
    listingId: string,
    paymentMethod: PaymentMethod.Cash | PaymentMethod.Debt,
    fulfillment: FulfillmentType,
    quantity = 1,
    buyerLocation?: {
      buyerDepartment?: string;
      buyerTableRow?: string;
      buyerTableNumber?: string;
    }
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

    // Community sellers handle delivery directly — independent of Store Delivery Staff & delivery fee
    const totalAmount = target.price * qty;
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const cleanBuyerDept = buyerLocation?.buyerDepartment?.trim() || currentUser.department;
    const cleanBuyerRow = buyerLocation?.buyerTableRow?.trim() || currentUser.tableRow || '';
    const cleanBuyerTable = buyerLocation?.buyerTableNumber?.trim() || currentUser.tableNumber || '';
    const workstationSummary = formatBuyerWorkstation({
      buyerDepartment: cleanBuyerDept,
      buyerTableRow: cleanBuyerRow,
      buyerTableNumber: cleanBuyerTable,
    });

    const needsProfileSync =
      (!authUser?.department?.trim() ||
        authUser.department === 'Department Staff' ||
        authUser.department === 'Unassigned' ||
        !authUser?.tableRow?.trim() ||
        !authUser?.tableNumber?.trim()) &&
      Boolean(cleanBuyerDept && cleanBuyerRow && cleanBuyerTable);
    if (needsProfileSync) {
      void handleSaveWorkstationProfile({
        department: cleanBuyerDept,
        tableRow: cleanBuyerRow,
        tableNumber: cleanBuyerTable,
      }).catch(() => {});
    }

    // Seller must confirm first before releasing stock, adding to buyer Community Debt ledger,
    // or starting seller delivery. Never touches Store debtBalance or Store Delivery Staff queue.
    const newOrder: StoreOrder = {
      id: `MKT-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      buyerDepartment: cleanBuyerDept || undefined,
      buyerTableRow: cleanBuyerRow || undefined,
      buyerTableNumber: cleanBuyerTable || undefined,
      items: [
        {
          itemId: target.id,
          name: `${target.title} (Coworker Sale)`,
          quantity: qty,
          unitPrice: target.price,
        },
      ],
      totalAmount,
      deliveryFee: 0,
      deliveryCommission: 0,
      fulfillment,
      deliveryNote:
        fulfillment === FulfillmentType.Delivery && workstationSummary
          ? workstationSummary
          : undefined,
      paymentMethod,
      status: 'Pending Seller Confirmation',
      deliveryStatus: 'Pending Seller Approval',
      assignedRunner:
        fulfillment === FulfillmentType.Delivery
          ? `${target.sellerName} (Seller Delivery)`
          : 'Seller Pickup',
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
    const ownsListing = targetOrder.items.some((li) =>
      listings.some((l) => l.id === li.itemId && l.sellerId === currentUser.id)
    );
    if (
      (targetOrder.sellerId && targetOrder.sellerId !== currentUser.id) ||
      (!targetOrder.sellerId && !ownsListing)
    ) {
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
    // Community seller fulfills Delivery personally (never routed to Store Delivery Staff)
    const runnerName = isPickup
      ? 'Seller Pickup'
      : `${currentUser.name} (Seller Delivery)`;
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
          : `Order confirmed & stock released by ${currentUser.name} — Prepared for Seller Delivery`,
        actor: currentUser.name,
      },
    ];

    const updatedOrder: StoreOrder = {
      ...targetOrder,
      status: isPickup ? 'Completed' : 'Confirmed',
      deliveryStatus: isPickup ? 'Delivered' : 'Pending Dispatch',
      assignedRunnerId: undefined,
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

  const handleSellerMarkOrderDelivered = async (orderId: string): Promise<void> => {
    if (!currentUser) return;
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }
    if (targetOrder.source !== 'marketplace') {
      throw new Error('Only community marketplace orders can be marked delivered here.');
    }
    const ownsListing = targetOrder.items.some((li) =>
      listings.some((l) => l.id === li.itemId && l.sellerId === currentUser.id)
    );
    if (
      (targetOrder.sellerId && targetOrder.sellerId !== currentUser.id) ||
      (!targetOrder.sellerId && !ownsListing)
    ) {
      throw new Error('Only the seller who posted this item can mark it delivered.');
    }
    if (
      targetOrder.fulfillment !== FulfillmentType.Delivery ||
      targetOrder.status !== 'Confirmed'
    ) {
      throw new Error('Only confirmed seller-delivery orders can be marked delivered.');
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowLabel = `${todayIso} ${nowTime}`;
    const isCash = targetOrder.paymentMethod === PaymentMethod.Cash;
    const nextLogs = [
      ...(targetOrder.logs ?? []),
      {
        id: `lg-sel-del-${Date.now()}`,
        timestamp: nowLabel,
        event: `Seller delivery completed by ${currentUser.name}${
          isCash ? ' & Cash collected' : ''
        }`,
        actor: currentUser.name,
      },
    ];

    const updatedOrder: StoreOrder = {
      ...targetOrder,
      status: 'Completed',
      deliveryStatus: 'Delivered',
      assignedRunnerId: undefined,
      assignedRunner: `${currentUser.name} (Seller Delivery)`,
      deliveredAt: nowLabel,
      cashCollected: isCash ? true : targetOrder.cashCollected,
      logs: nextLogs,
    };

    const prevOrders = orders;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
    try {
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
    const ownsListing = targetOrder.items.some((li) =>
      listings.some((l) => l.id === li.itemId && l.sellerId === currentUser.id)
    );
    if (
      (targetOrder.sellerId && targetOrder.sellerId !== currentUser.id) ||
      (!targetOrder.sellerId && !ownsListing)
    ) {
      throw new Error('Only the seller who posted this item can decline the order.');
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
    if (target.source !== 'marketplace') return;
    const ownsListing = target.items.some((li) =>
      listings.some((l) => l.id === li.itemId && l.sellerId === currentUser.id)
    );
    if (
      (target.sellerId && target.sellerId !== currentUser.id) ||
      (!target.sellerId && !ownsListing)
    ) {
      throw new Error('Only the seller who posted this item can mark its debt settled.');
    }
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
    const rate = cashAssistanceSettings.monthlyInterestRate;
    const totalPayable = principal + Math.round(principal * (rate / 100) * months);
    const loanId = `LN-${Date.now().toString().slice(-6)}`;
    const todayIso = new Date().toISOString().slice(0, 10);
    const installments = buildLoanInstallments(
      loanId,
      totalPayable,
      months,
      todayIso,
      cashAssistanceSettings.dueDays[1] ?? 30
    );

    const newLoan: LoanRecord = {
      id: loanId,
      storeId: DEFAULT_STORE_ID,
      storeName: DEFAULT_STORE_NAME,
      storeOwnerId: DEFAULT_STORE_OWNER_ID,
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
      const loanStoreId = targetLoan.storeId || DEFAULT_STORE_ID;
      const loanStoreName = targetLoan.storeName || DEFAULT_STORE_NAME;
      const loanStoreOwnerId = targetLoan.storeOwnerId || DEFAULT_STORE_OWNER_ID;
      const newProof: PaymentProof = {
        id: `PRF-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 5)
          .toUpperCase()}`,
        storeId: loanStoreId,
        storeName: loanStoreName,
        storeOwnerId: loanStoreOwnerId,
        userId: currentUser.id,
        userName: currentUser.name,
        amount: payload.amount,
        channel: payload.method,
        referenceNo: payload.referenceNo || 'REF-LOAN',
        purpose: 'Cash Assistance Repayment',
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
    storeId: string;
    storeName: string;
    storeOwnerId?: string;
    amount: number;
    channel: string;
    referenceNo: string;
    imageDataUrl: string;
  }) => {
    if (!currentUser) return;
    const storeId = payload.storeId || DEFAULT_STORE_ID;
    const storeObj = stores.find((s) => s.id === storeId);
    const storeName = payload.storeName || storeObj?.name || DEFAULT_STORE_NAME;
    const storeOwnerId =
      payload.storeOwnerId || storeObj?.ownerId || DEFAULT_STORE_OWNER_ID;

    const newProof: PaymentProof = {
      id: `PRF-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`,
      storeId,
      storeName,
      storeOwnerId,
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
      title: `New ${storeName} ${payload.channel} Proof`.slice(0, 140),
      body: `${currentUser.name} submitted ${formatPHP(payload.amount, true)} (${payload.referenceNo}) for ${storeName} Store Credit.`.slice(
        0,
        500
      ),
      timestamp: 'Just now',
      type: 'store',
      read: false,
      targetUserId:
        storeOwnerId && storeOwnerId !== currentUser.id ? storeOwnerId : 'admins',
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
    if (!canManageStore(target.storeId, target.storeOwnerId)) return;

    const actorName = currentUser?.name ?? 'Store Owner';
    const todayIso = new Date().toISOString().slice(0, 10);
    const updatedProof: PaymentProof = {
      ...target,
      status: decision,
      reviewedBy: actorName,
      reviewedAt: 'Just now',
    };

    setProofs((prev) => prev.map((p) => (p.id === proofId ? updatedProof : p)));
    void savePaymentProof(updatedProof);

    const isDebtPaymentProof =
      target.purpose === 'Store Debt Settlement' ||
      target.purpose === 'Cash Assistance Repayment' ||
      Boolean(target.loanId);

    if (decision === 'rejected') {
      if (isDebtPaymentProof) {
        void createNotificationDoc({
          id: `notif-rej-${Date.now()}`,
          title: `${target.loanId ? 'Cash Assistance' : 'Store Credit'} Payment Proof Rejected (${target.referenceNo})`.slice(
            0,
            140
          ),
          body: `${actorName} requested re-upload for ${target.userName}'s ${target.channel} payment (${formatPHP(target.amount, true)}).`.slice(
            0,
            500
          ),
          timestamp: 'Just now',
          type: 'payment',
          read: false,
          targetUserId: target.userId,
        });
      }
      return;
    }

    if (target.purpose === 'Store Debt Settlement') {
      const storeId = target.storeId || DEFAULT_STORE_ID;
      const storeObj = stores.find((s) => s.id === storeId);
      const storeName = target.storeName || storeObj?.name || DEFAULT_STORE_NAME;
      const storeOwnerId =
        target.storeOwnerId || storeObj?.ownerId || DEFAULT_STORE_OWNER_ID;
      const creditId = `${storeId}__${target.userId}`;
      const existingCredit = storeCustomerCredits.find((c) => c.id === creditId);
      const prevBal = existingCredit?.balance ?? target.amount;
      const nextBal = Math.max(0, prevBal - target.amount);
      const appliedPay = Math.min(prevBal, target.amount);

      const nextCredit: StoreCustomerCredit = {
        id: creditId,
        storeId,
        storeName,
        storeOwnerId,
        userId: target.userId,
        userName: target.userName,
        balance: nextBal,
        totalCharged: existingCredit?.totalCharged ?? prevBal,
        totalPaid: (existingCredit?.totalPaid ?? 0) + appliedPay,
        updatedAt: todayIso,
      };
      setStoreCustomerCredits((prev) => {
        const exists = prev.some((c) => c.id === creditId);
        return exists
          ? prev.map((c) => (c.id === creditId ? nextCredit : c))
          : [nextCredit, ...prev];
      });
      void saveStoreCustomerCredit(nextCredit);

      const targetUser = users.find((u) => u.id === target.userId);
      if (targetUser) {
        const nextStoreBalances = {
          ...(targetUser.storeDebtBalances ?? {}),
          [storeId]: nextBal,
        };
        const updatedUser: UserAccount = {
          ...targetUser,
          debtBalance: Math.max(0, targetUser.debtBalance - target.amount),
          storeDebtBalances: nextStoreBalances,
        };
        setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
        if (authUser?.id === updatedUser.id) setAuthUser(updatedUser);
        if (isActualAdmin || updatedUser.id === authUser?.id) {
          void saveUserAccount(updatedUser);
        }
      }
    }

    if (target.orderId) {
      const targetOrder = orders.find((o) => o.id === target.orderId);
      if (targetOrder) {
        if (isOrderPendingAdminConfirmation(targetOrder)) {
          void approveOrderInternal(targetOrder.id, { skipProofId: proofId }).catch(
            (err) => {
              console.error('Failed to approve & release stock for order proof:', err);
            }
          );
        } else {
          const updatedOrder: StoreOrder = { ...targetOrder, status: 'Confirmed' };
          setOrders((prev) =>
            prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
          );
          void saveOrder(updatedOrder);
        }
      }
    }

    if (target.loanId) {
      const targetLoan = loans.find((l) => l.id === target.loanId);
      if (targetLoan) {
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
        title: `${target.loanId ? 'Cash Assistance' : 'Store Credit'} Payment Approved (${target.referenceNo})`.slice(
          0,
          140
        ),
        body: `${formatPHP(target.amount, true)} ${target.channel} payment was verified by ${actorName}.`.slice(
          0,
          500
        ),
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
    if (!isActualAdmin) return;
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
    if (!currentUser) return;
    const target = listings.find((l) => l.id === listingId);
    if (!target) return;
    if (!isActualAdmin && target.sellerId !== currentUser.id) {
      throw new Error('Only the seller or an Admin can delete this listing.');
    }
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
    storeId?: string;
    customerMode: 'walkin' | 'coworker';
    customerId?: string;
    customerName: string;
    items: Array<{ itemId: string; quantity: number }>;
    fulfillment: FulfillmentType;
    deliveryNote?: string;
    paymentMethod: string;
  }): Promise<StoreOrder> => {
    const firstItem = items.find((i) => i.id === payload.items[0]?.itemId);
    const storeId = payload.storeId || firstItem?.storeId || DEFAULT_STORE_ID;
    const storeObj = stores.find((s) => s.id === storeId);
    if (!canManageStore(storeId, storeObj?.ownerId)) {
      throw new Error('Store Owner or Admin access required to create walk-in sales orders.');
    }

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

    const deliveryEnabled = storeObj
      ? storeObj.deliveryEnabled
      : storeConfig.deliveryEnabled;
    const storeDeliveryFee = storeObj
      ? storeObj.deliveryFee
      : storeConfig.deliveryFee;

    const subtotal = lineItems.reduce(
      (sum, entry) => sum + entry.quantity * entry.unitPrice,
      0
    );
    const deliveryFee =
      payload.fulfillment === FulfillmentType.Delivery && deliveryEnabled
        ? storeDeliveryFee
        : 0;
    const deliveryCommission =
      deliveryFee > 0
        ? Math.round((deliveryFee * (platformConfig.deliveryCommissionRate ?? 100)) / 100)
        : 0;
    const totalAmount = subtotal + deliveryFee;

    const targetCoworker =
      payload.customerMode === 'coworker' && payload.customerId
        ? users.find((u) => u.id === payload.customerId) ??
          coworkerProfiles.find((c) => c.id === payload.customerId)
        : undefined;

    const customerId = targetCoworker ? targetCoworker.id : 'walk-in';
    const customerName =
      (targetCoworker ? targetCoworker.name : payload.customerName.trim()) ||
      'Walk-in Customer';
    const paymentType = resolveOrderPaymentType({
      paymentMethod: payload.paymentMethod,
    });
    const isDebt = paymentType === 'credit' && Boolean(targetCoworker);
    const isCash = paymentType === 'cash';
    const isPickup = payload.fulfillment === FulfillmentType.Pickup;
    const assignedStaffIds = storeObj?.assignedDeliveryStaffIds ?? [];
    const defaultRunner =
      users.find((u) => assignedStaffIds.includes(u.id)) ??
      users.find((u) => u.role === UserRole.DeliveryStaff);
    const runnerId = assignedStaffIds[0] ?? defaultRunner?.id;
    const runnerName = isPickup
      ? 'Pick Up'
      : users.find((u) => u.id === runnerId)?.name ??
        defaultRunner?.name ??
        'Kuya Jun Reyes';

    const storeName = storeObj?.name || firstItem?.storeName || DEFAULT_STORE_NAME;
    const storeOwnerId =
      storeObj?.ownerId || firstItem?.storeOwnerId || DEFAULT_STORE_OWNER_ID;
    const storeDueLabel = getNextDueDateLabel(
      storeObj?.dueDays ?? cashAssistanceSettings.dueDays
    );

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 5)
      .toUpperCase()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowLabel = `${todayIso} ${nowTime}`;
    const actorName = currentUser?.name ?? 'Store Owner';

    const newOrder: StoreOrder = {
      id: orderId,
      storeId,
      storeName,
      storeOwnerId,
      assignedDeliveryStaffIds: assignedStaffIds,
      userId: customerId,
      userName: customerName,
      items: lineItems.map(({ itemId, name, quantity, unitPrice }) => ({
        itemId,
        name,
        quantity,
        unitPrice,
      })),
      subtotal,
      totalAmount,
      deliveryFee,
      deliveryCommission,
      fulfillment: payload.fulfillment,
      deliveryNote: payload.deliveryNote?.trim() || undefined,
      paymentMethod: payload.paymentMethod,
      paymentType,
      status: isPickup ? 'Completed' : 'Confirmed',
      deliveryStatus: isPickup ? 'Delivered' : 'Pending Dispatch',
      assignedRunnerId: isPickup ? undefined : runnerId,
      assignedRunner: runnerName,
      cashCollected: isCash,
      createdAt: nowLabel,
      orderDateIso: todayIso,
      deliveredAt: isPickup ? nowLabel : undefined,
      dueDateLabel: isDebt ? storeDueLabel : undefined,
      source: 'store',
      logs: [
        {
          id: `lg-${Date.now()}-1`,
          timestamp: nowLabel,
          event: `Manual sales order recorded for ${storeName} via ${payload.paymentMethod} (${
            isPickup ? 'Pick Up' : 'Delivery'
          })`,
          actor: actorName,
        },
      ],
    };

    const previousOrders = orders;
    const previousItems = items;
    const previousUsers = users;
    const previousCredits = storeCustomerCredits;

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

    let nextStoreCredit: StoreCustomerCredit | null = null;
    if (isDebt && targetCoworker) {
      const creditId = `${storeId}__${targetCoworker.id}`;
      const existingCredit = storeCustomerCredits.find((c) => c.id === creditId);
      nextStoreCredit = {
        id: creditId,
        storeId,
        storeName,
        storeOwnerId,
        userId: targetCoworker.id,
        userName: targetCoworker.name,
        balance: Math.max(0, (existingCredit?.balance ?? 0) + totalAmount),
        totalCharged: Math.max(0, (existingCredit?.totalCharged ?? 0) + totalAmount),
        totalPaid: existingCredit?.totalPaid ?? 0,
        updatedAt: todayIso,
      };
      setStoreCustomerCredits((prev) => {
        const exists = prev.some((c) => c.id === creditId);
        return exists
          ? prev.map((c) => (c.id === creditId ? nextStoreCredit! : c))
          : [nextStoreCredit!, ...prev];
      });
    }

    const matchedUserRecord = targetCoworker
      ? users.find((u) => u.id === targetCoworker.id)
      : undefined;
    const canWriteUserDoc = Boolean(
      matchedUserRecord && (isActualAdmin || matchedUserRecord.id === authUser?.id)
    );
    const nextDebt = matchedUserRecord
      ? isDebt
        ? matchedUserRecord.debtBalance + totalAmount
        : matchedUserRecord.debtBalance
      : 0;
    const nextSpent = matchedUserRecord ? matchedUserRecord.totalSpent + totalAmount : 0;
    const nextStoreDebtMap = matchedUserRecord
      ? {
          ...(matchedUserRecord.storeDebtBalances ?? {}),
          ...(nextStoreCredit ? { [storeId]: nextStoreCredit.balance } : {}),
        }
      : undefined;

    if (matchedUserRecord) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === matchedUserRecord.id
            ? {
                ...u,
                debtBalance: nextDebt,
                totalSpent: nextSpent,
                ...(nextStoreDebtMap ? { storeDebtBalances: nextStoreDebtMap } : {}),
              }
            : u
        )
      );
      if (authUser?.id === matchedUserRecord.id) {
        setAuthUser((prev) =>
          prev
            ? {
                ...prev,
                debtBalance: nextDebt,
                totalSpent: nextSpent,
                ...(nextStoreDebtMap ? { storeDebtBalances: nextStoreDebtMap } : {}),
              }
            : prev
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
      if (nextStoreCredit) {
        await saveStoreCustomerCredit(nextStoreCredit);
      }
      if (matchedUserRecord && canWriteUserDoc) {
        await updateUserCheckoutTotals(
          matchedUserRecord.id,
          nextDebt,
          nextSpent,
          nextStoreDebtMap
        );
      }
      return newOrder;
    } catch (err) {
      setOrders(previousOrders);
      setItems(previousItems);
      setUsers(previousUsers);
      setStoreCustomerCredits(previousCredits);
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
    const target = items.find((i) => i.id === payload.itemId);
    if (!target) {
      throw new Error('Selected item was not found.');
    }
    if (!actorId || !canManageStore(target.storeId, target.storeOwnerId)) {
      throw new Error('Store Owner or Admin access required to record stock adjustments.');
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

    const storeId = target.storeId || DEFAULT_STORE_ID;
    const storeName =
      target.storeName || stores.find((s) => s.id === storeId)?.name || DEFAULT_STORE_NAME;
    const storeOwnerId =
      target.storeOwnerId ||
      stores.find((s) => s.id === storeId)?.ownerId ||
      DEFAULT_STORE_OWNER_ID;

    const logEntry: StockAdjustmentLog = {
      id: `adj-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
      storeId,
      storeName,
      storeOwnerId,
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
      adjustedByName: (authUser?.name ?? currentUser?.name ?? 'Store Owner').slice(0, 120),
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
    if (!isActualAdmin) return;
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
    const targetThread = threads.find((t) => t.id === threadId);
    const msg = {
      id: `m-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let nextUnreadBy: Record<string, number> | undefined;
    let nextUnreadTotal = targetThread?.unreadCount ?? 0;

    if (targetThread && targetThread.type === 'dm') {
      const baseUnread: Record<string, number> = { ...(targetThread.unreadBy ?? {}) };
      baseUnread[currentUser.id] = 0;
      const otherParticipants = targetThread.participantIds.filter(
        (id) => id !== currentUser.id
      );
      for (const recipientId of otherParticipants) {
        baseUnread[recipientId] = Math.max(0, Number(baseUnread[recipientId] ?? 0)) + 1;
      }
      nextUnreadBy = baseUnread;
      nextUnreadTotal = Object.values(baseUnread).reduce(
        (sum, val) => sum + (Number(val) || 0),
        0
      );

      const nowMs = Date.now();
      otherParticipants.forEach((recipientId, idx) => {
        void createNotificationDoc({
          id: `notif-chat-${nowMs}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          title: `Unread Message from ${currentUser.name}`.slice(0, 140),
          body: `${currentUser.name}: "${text.slice(0, 140)}"`.slice(0, 500),
          timestamp: 'Just now',
          type: 'chat',
          read: false,
          targetUserId: recipientId,
        });
      });
    }

    if (
      currentUser &&
      threadId === `ai-${currentUser.id}` &&
      !threads.some((t) => t.id === threadId)
    ) {
      const meta: Omit<ChatThread, 'messages'> = {
        id: threadId,
        title: `DeskPantry AI · ${currentUser.name}`.slice(0, 140),
        subtitle: 'Private Gemini Assistant · Visible only to you',
        type: 'ai',
        participantIds: [currentUser.id],
        unreadCount: 0,
      };
      setThreads((prev) =>
        prev.some((t) => t.id === threadId)
          ? prev.map((t) =>
              t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t
            )
          : [{ ...meta, messages: [msg] }, ...prev]
      );
      void createChatThread(meta)
        .then(() => addChatMessageToThread(threadId, msg))
        .catch((err) => console.error('Failed to persist private AI message:', err));
      return;
    }

    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: [...t.messages, msg],
              ...(nextUnreadBy !== undefined
                ? { unreadBy: nextUnreadBy, unreadCount: nextUnreadTotal }
                : {}),
            }
          : t
      )
    );
    void addChatMessageToThread(threadId, msg);
    if (nextUnreadBy !== undefined) {
      void markThreadUnreadCount(threadId, nextUnreadTotal, nextUnreadBy);
    }
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
    if (
      currentUser &&
      threadId === `ai-${currentUser.id}` &&
      !threads.some((t) => t.id === threadId)
    ) {
      const meta: Omit<ChatThread, 'messages'> = {
        id: threadId,
        title: `DeskPantry AI · ${currentUser.name}`.slice(0, 140),
        subtitle: 'Private Gemini Assistant · Visible only to you',
        type: 'ai',
        participantIds: [currentUser.id],
        unreadCount: 0,
      };
      setThreads((prev) =>
        prev.some((t) => t.id === threadId)
          ? prev.map((t) =>
              t.id === threadId ? { ...t, messages: [...t.messages, aiMsg] } : t
            )
          : [{ ...meta, messages: [aiMsg] }, ...prev]
      );
      void createChatThread(meta)
        .then(() => addChatMessageToThread(threadId, aiMsg))
        .catch((err) => console.error('Failed to persist private AI reply:', err));
      return;
    }
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, aiMsg] } : t
      )
    );
    void addChatMessageToThread(threadId, aiMsg);
  };

  const handleMarkThreadRead = (threadId: string) => {
    if (!currentUser) return;
    const target = threads.find((t) => t.id === threadId);
    if (!target) return;
    const userUnread =
      target.unreadBy && typeof target.unreadBy === 'object'
        ? Math.max(0, Number(target.unreadBy[currentUser.id] ?? 0))
        : Math.max(0, Number(target.unreadCount ?? 0));
    if (userUnread === 0) return;

    const nextUnreadBy = {
      ...(target.unreadBy ?? {}),
      [currentUser.id]: 0,
    };
    const nextTotal =
      target.type === 'dm'
        ? Object.values(nextUnreadBy).reduce((sum, val) => sum + (Number(val) || 0), 0)
        : 0;

    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, unreadCount: nextTotal, unreadBy: nextUnreadBy }
          : t
      )
    );
    void markThreadUnreadCount(threadId, nextTotal, nextUnreadBy);
  };

  const handleStartDirectChat = async (recipient: CoworkerProfile): Promise<string> => {
    if (!currentUser) {
      throw new Error('Sign in to start a direct conversation.');
    }
    const pair = [currentUser.id, recipient.id].sort();
    const threadId = `dm-${pair[0]}--${pair[1]}`;
    const existing = threads.find((t) => t.id === threadId);
    if (existing) {
      return existing.id;
    }
    const meta: Omit<ChatThread, 'messages'> = {
      id: threadId,
      title: `${currentUser.name} & ${recipient.name}`.slice(0, 140),
      subtitle: `${currentUser.department || 'Team'} · ${recipient.department || 'Team'}`.slice(
        0,
        200
      ),
      type: 'dm',
      participantIds: [currentUser.id, recipient.id],
      unreadCount: 0,
    };
    await createChatThread(meta);
    setThreads((prev) =>
      prev.some((t) => t.id === threadId)
        ? prev
        : [{ ...meta, messages: [] }, ...prev]
    );
    return threadId;
  };

  const handleDeleteChatMessage = async (
    threadId: string,
    messageId: string
  ): Promise<void> => {
    const previous = threads;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, messages: t.messages.filter((m) => m.id !== messageId) }
          : t
      )
    );
    try {
      await deleteChatMessage(threadId, messageId);
    } catch (err) {
      setThreads(previous);
      throw err;
    }
  };

  const handleDeleteChatThread = async (threadId: string): Promise<void> => {
    const previous = threads;
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    try {
      await deleteChatThread(threadId);
    } catch (err) {
      setThreads(previous);
      throw err;
    }
  };

  const handleSaveInternalApp = async (app: InternalApp): Promise<void> => {
    if (!isActualAdmin) {
      throw new Error('Admin access required to manage department apps.');
    }
    const previous = otherApps;
    setOtherApps((prev) => {
      const exists = prev.some((a) => a.id === app.id);
      if (exists) return prev.map((a) => (a.id === app.id ? app : a));
      return [app, ...prev];
    });
    try {
      await saveInternalApp(app);
    } catch (err) {
      setOtherApps(previous);
      throw err;
    }
  };

  const handleDeleteInternalApp = async (appId: string): Promise<void> => {
    if (!isActualAdmin) {
      throw new Error('Admin access required to remove department apps.');
    }
    const previous = otherApps;
    setOtherApps((prev) => prev.filter((a) => a.id !== appId));
    try {
      await deleteInternalApp(appId);
    } catch (err) {
      setOtherApps(previous);
      throw err;
    }
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
    const completedAtMs =
      nextRemaining === 0 ? target.completedAtMs ?? Date.now() : target.completedAtMs;
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
          ? {
              ...p,
              remainingAmount: nextRemaining,
              status: nextStatus,
              ...(completedAtMs ? { completedAtMs } : {}),
              fills: nextFills,
            }
          : p
      )
    );
    void updateEWalletPostPartial(postId, {
      remainingAmount: nextRemaining,
      status: nextStatus,
      ...(completedAtMs ? { completedAtMs } : {}),
      fills: nextFills,
      comments: target.comments,
    });

    if (target.authorId && target.authorId !== currentUser.id) {
      const actionVerb = target.type === 'sell' ? 'ordered' : 'filled';
      void createNotificationDoc({
        id: `notif-ewf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: (nextRemaining === 0
          ? `Your ${target.walletProvider} Order Completed`
          : `New Share Order on Your ${target.walletProvider} Post`
        ).slice(0, 140),
        body: `${currentUser.name} ${actionVerb} ${formatPHP(take)} on your ${
          target.type === 'sell' ? 'Sell' : 'Buy'
        } ${target.walletProvider} post (${formatPHP(nextRemaining)} remaining)${
          note ? ` · Note: "${note.slice(0, 80)}"` : ''
        }.`.slice(0, 500),
        timestamp: 'Just now',
        type: 'ewallet',
        read: false,
        targetUserId: target.authorId,
      });
    }
  };

  const handleAddEWalletComment = (
    postId: string,
    text: string,
    imageDataUrl?: string
  ) => {
    if (!currentUser) return;
    const target = ewalletPosts.find((p) => p.id === postId);
    if (!target) return;
    const canComment =
      target.authorId === currentUser.id ||
      target.fills.some((f) => f.userId === currentUser.id);
    if (!canComment) return;

    const cleanText = text.trim() || (imageDataUrl ? 'Attached receipt screenshot.' : '');
    if (!cleanText && !imageDataUrl) return;

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
        text: cleanText,
        createdAt: nowLabel,
        ...(imageDataUrl ? { imageDataUrl } : {}),
      },
    ];
    setEWalletPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: nextComments } : p))
    );
    void updateEWalletPostPartial(postId, {
      remainingAmount: target.remainingAmount,
      status: target.status,
      ...(target.completedAtMs ? { completedAtMs: target.completedAtMs } : {}),
      fills: target.fills,
      comments: nextComments,
    });

    const recipientIds = Array.from(
      new Set([
        ...(target.authorId ? [target.authorId] : []),
        ...target.fills.map((f) => f.userId),
      ])
    ).filter((uid) => Boolean(uid) && uid !== currentUser.id);

    const nowMs = Date.now();
    recipientIds.forEach((recipientId, idx) => {
      const isAuthor = recipientId === target.authorId;
      void createNotificationDoc({
        id: `notif-ewc-${nowMs}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        title: (isAuthor
          ? `New Comment on Your ${target.walletProvider} Post`
          : `New Comment on ${target.authorName}'s ${target.walletProvider} Order`
        ).slice(0, 140),
        body: `${currentUser.name} commented on the ${
          target.type === 'sell' ? 'Sell' : 'Buy'
        } ${target.walletProvider} order: "${cleanText.slice(0, 160)}"`.slice(0, 500),
        timestamp: 'Just now',
        type: 'ewallet',
        read: false,
        targetUserId: recipientId,
      });
    });
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

  const persistLocalDismissedMap = (nextMap: Record<string, boolean>) => {
    if (!authUser?.id) return;
    try {
      window.localStorage.setItem(
        `deskpantry_dismissed_notifs_${authUser.id}`,
        JSON.stringify(nextMap)
      );
    } catch {
      // Ignore storage quota errors
    }
  };

  const canDeleteNotifInFirestore = (notif: NotificationItem): boolean => {
    if (!authUser?.id) return false;
    if (notif.targetUserId === authUser.id) return true;
    if (
      notif.targetUserId === 'delivery' &&
      (actualRole === UserRole.DeliveryStaff || isActualAdmin)
    ) {
      return true;
    }
    if (isActualAdmin && notif.targetUserId !== 'all') return true;
    return false;
  };

  const handleMarkNotificationRead = (notif: NotificationItem) => {
    setLocalReadNotifIds((prev) => {
      const next = { ...prev, [notif.id]: true };
      persistLocalReadMap(next);
      return next;
    });
    if (canPersistReadInFirestore(notif)) {
      void markNotificationReadDoc(notif.id).catch((err) => {
        console.error('Failed to mark notification read:', err);
      });
    }
  };

  const handleMarkAllNotificationsRead = () => {
    const nextIds: Record<string, boolean> = {};
    for (const n of effectiveNotifications) {
      nextIds[n.id] = true;
      if (!n.read && canPersistReadInFirestore(n)) {
        void markNotificationReadDoc(n.id).catch((err) => {
          console.error('Failed to mark notification read:', err);
        });
      }
    }
    setLocalReadNotifIds((prev) => {
      const merged = { ...prev, ...nextIds };
      persistLocalReadMap(merged);
      return merged;
    });
  };

  const handleDeleteNotification = (notif: NotificationItem) => {
    setDismissedNotifIds((prev) => {
      const next = { ...prev, [notif.id]: true };
      persistLocalDismissedMap(next);
      return next;
    });
    if (canDeleteNotifInFirestore(notif)) {
      setNotifications((prev) => prev.filter((item) => item.id !== notif.id));
      void deleteNotificationDoc(notif.id).catch((err) => {
        console.error('Failed to delete notification:', err);
      });
    }
  };

  const handleDeleteAllNotifications = () => {
    if (effectiveNotifications.length === 0) return;
    const nextDismissed: Record<string, boolean> = {};
    const deletableIds: string[] = [];
    for (const n of effectiveNotifications) {
      nextDismissed[n.id] = true;
      if (canDeleteNotifInFirestore(n)) {
        deletableIds.push(n.id);
      }
    }
    setDismissedNotifIds((prev) => {
      const merged = { ...prev, ...nextDismissed };
      persistLocalDismissedMap(merged);
      return merged;
    });
    if (deletableIds.length > 0) {
      const deleteSet = new Set(deletableIds);
      setNotifications((prev) => prev.filter((item) => !deleteSet.has(item.id)));
      void deleteNotificationDocs(deletableIds).catch((err) => {
        console.error('Failed to delete notifications:', err);
      });
    }
  };

  const handleDeleteMediaAsset = async (asset: MediaAssetEntry): Promise<void> => {
    if (!isActualAdmin) {
      throw new Error('Admin access required to delete media assets.');
    }
    if (asset.source === 'proof') {
      await clearPaymentProofImage(asset.recordId);
      setProofs((prev) =>
        prev.map((p) => (p.id === asset.recordId ? { ...p, imageDataUrl: '' } : p))
      );
      return;
    }
    if (asset.source === 'store') {
      await clearStoreItemImage(asset.recordId);
      setItems((prev) =>
        prev.map((i) => (i.id === asset.recordId ? { ...i, image: undefined } : i))
      );
      return;
    }
    if (asset.source === 'marketplace') {
      await clearMarketplaceListingImage(asset.recordId);
      setListings((prev) =>
        prev.map((l) => (l.id === asset.recordId ? { ...l, image: undefined } : l))
      );
      return;
    }
    if (asset.source === 'ewallet' && asset.subRecordId) {
      const targetPost = ewalletPosts.find((p) => p.id === asset.recordId);
      if (!targetPost) return;
      const nextComments = targetPost.comments.map((c) => {
        if (c.id !== asset.subRecordId) return c;
        const { imageDataUrl: _removed, ...rest } = c;
        return rest;
      });
      await updateEWalletPostPartial(asset.recordId, {
        remainingAmount: targetPost.remainingAmount,
        status: targetPost.status,
        ...(targetPost.completedAtMs ? { completedAtMs: targetPost.completedAtMs } : {}),
        fills: targetPost.fills,
        comments: nextComments,
      });
      setEWalletPosts((prev) =>
        prev.map((p) =>
          p.id === asset.recordId ? { ...p, comments: nextComments } : p
        )
      );
      return;
    }
    if (asset.source === 'app') {
      await clearInternalAppImage(asset.recordId);
      setOtherApps((prev) =>
        prev.map((a) => (a.id === asset.recordId ? { ...a, image: '' } : a))
      );
      return;
    }
    if (asset.source === 'paymentMethod' && asset.paymentField) {
      const nextConfig: StoreConfig = {
        ...storeConfig,
        paymentMethods: storeConfig.paymentMethods.map((pm) => {
          if (pm.id !== asset.recordId) return pm;
          const copy = { ...pm };
          if (asset.paymentField === 'qrCodeImage') {
            delete copy.qrCodeImage;
          } else {
            delete copy.iconImage;
          }
          return copy;
        }),
      };
      await saveStoreConfig(nextConfig, dueDaysRef.current);
      setStoreConfig(nextConfig);
    }
  };

  const handleBulkDeleteMediaAssets = async (
    assetsToDelete: MediaAssetEntry[]
  ): Promise<void> => {
    if (!isActualAdmin) {
      throw new Error('Admin access required to clear media storage.');
    }
    // Group e-wallet comment updates by postId and paymentMethod updates cleanly
    const ewalletByPost = new Map<string, Set<string>>();
    const pmFieldsByMethod = new Map<string, Set<'qrCodeImage' | 'iconImage'>>();
    const singleQueue: MediaAssetEntry[] = [];

    for (const asset of assetsToDelete) {
      if (asset.source === 'ewallet' && asset.subRecordId) {
        const set = ewalletByPost.get(asset.recordId) ?? new Set<string>();
        set.add(asset.subRecordId);
        ewalletByPost.set(asset.recordId, set);
      } else if (asset.source === 'paymentMethod' && asset.paymentField) {
        const set =
          pmFieldsByMethod.get(asset.recordId) ?? new Set<'qrCodeImage' | 'iconImage'>();
        set.add(asset.paymentField);
        pmFieldsByMethod.set(asset.recordId, set);
      } else {
        singleQueue.push(asset);
      }
    }

    for (const asset of singleQueue) {
      await handleDeleteMediaAsset(asset);
    }

    for (const [postId, commentIds] of ewalletByPost.entries()) {
      const targetPost = ewalletPosts.find((p) => p.id === postId);
      if (!targetPost) continue;
      const nextComments = targetPost.comments.map((c) => {
        if (!commentIds.has(c.id)) return c;
        const { imageDataUrl: _removed, ...rest } = c;
        return rest;
      });
      await updateEWalletPostPartial(postId, {
        remainingAmount: targetPost.remainingAmount,
        status: targetPost.status,
        ...(targetPost.completedAtMs ? { completedAtMs: targetPost.completedAtMs } : {}),
        fills: targetPost.fills,
        comments: nextComments,
      });
      setEWalletPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments: nextComments } : p))
      );
    }

    if (pmFieldsByMethod.size > 0) {
      const nextConfig: StoreConfig = {
        ...storeConfig,
        paymentMethods: storeConfig.paymentMethods.map((pm) => {
          const fields = pmFieldsByMethod.get(pm.id);
          if (!fields) return pm;
          const copy = { ...pm };
          if (fields.has('qrCodeImage')) delete copy.qrCodeImage;
          if (fields.has('iconImage')) delete copy.iconImage;
          return copy;
        }),
      };
      await saveStoreConfig(nextConfig, dueDaysRef.current);
      setStoreConfig(nextConfig);
    }
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
    ...(isStoreOwnerUser
      ? [
          {
            id: 'storeOwner' as ActiveSection,
            label: 'My Store',
            icon: ShoppingBag,
            badge: orders.filter(
              (o) =>
                o.source === 'store' &&
                isOrderPendingAdminConfirmation(o) &&
                (isAdminOrSuper || o.storeOwnerId === currentUser?.id)
            ).length,
          },
        ]
      : []),
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
    ...(canViewCashAssistanceNav
      ? [{ id: 'cashAssistance' as ActiveSection, label: 'Cash Assistance', icon: HandCoins }]
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
    // Config & Developer Settings tabs are strictly hidden from public / non-admin roles
    ...(isAdminOrSuper
      ? [
          {
            id: 'admin' as ActiveSection,
            label: 'Admin Config',
            icon: ShieldCheck,
            badge: pendingProofsCount + pendingOrdersCount,
          },
          {
            id: 'developer' as ActiveSection,
            label: 'Developer Settings',
            icon: Terminal,
            badge:
              storeApplications.filter((a) => a.status === 'pending').length +
              storeCashAssistance.filter((c) => c.status === 'pending_approval').length,
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
    ...(isStoreOwnerUser
      ? [
          {
            id: 'storeOwner',
            label: 'My Store',
            badge: orders.filter(
              (o) =>
                o.source === 'store' &&
                isOrderPendingAdminConfirmation(o) &&
                (isAdminOrSuper || o.storeOwnerId === currentUser?.id)
            ).length,
          },
        ]
      : []),
    ...(isAdminOrSuper
      ? [{ id: 'salesOrderShortcut', label: 'Sales Order', badge: pendingOrdersCount }]
      : []),
    { id: 'ewallet', label: 'Buy/Sell E-Wallet', badge: openEWalletCount },
    { id: 'community', label: 'Community', badge: unreadCommunityCount },
    ...(currentUser && currentRole !== UserRole.Guest
      ? [{ id: 'seller', label: 'Seller Hub', badge: sellerDebtSummary.unpaidCount }]
      : []),
    ...(canViewCashAssistanceNav
      ? [{ id: 'cashAssistance', label: 'Cash Assistance', badge: 0 }]
      : []),
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
    { id: 'chat', label: 'Chat', badge: unreadChatCount },
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
                            setIsWorkstationFirstTime(false);
                            setIsWorkstationModalOpen(true);
                          }}
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#172523] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5">
                            <MapPin className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                            <span>Department &amp; Desk</span>
                          </span>
                          <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 truncate max-w-[100px]">
                            {currentUser.tableRow && currentUser.tableNumber
                              ? `R${currentUser.tableRow}·T${currentUser.tableNumber}`
                              : 'Set Location'}
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
                  <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate tabular-nums">
                        Notifications ({unreadNotifCount} unread)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsNotifOpen(false)}
                        className="text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white whitespace-nowrap cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    {effectiveNotifications.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        {unreadNotifCount > 0 ? (
                          <button
                            type="button"
                            onClick={handleMarkAllNotificationsRead}
                            className="px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 text-xs font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 whitespace-nowrap cursor-pointer"
                          >
                            Mark all read
                          </button>
                        ) : (
                          <span className="text-[11px] text-stone-400 dark:text-stone-500">
                            All caught up
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleDeleteAllNotifications}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 whitespace-nowrap cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete all</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="divide-y divide-stone-200 dark:divide-stone-800 max-h-80 overflow-y-auto">
                    {effectiveNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                        No notifications yet.
                      </div>
                    ) : (
                      effectiveNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start justify-between gap-2.5 p-3.5 transition-colors hover:bg-stone-50 dark:hover:bg-[#172523] ${
                            !n.read
                              ? 'bg-teal-50/40 dark:bg-teal-950/35'
                              : 'bg-white dark:bg-[#121D1B]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              handleMarkNotificationRead(n);
                              if (n.type === 'delivery') {
                                navigateTo(canViewDeliveryNav ? 'delivery' : 'ledger');
                              } else if (n.type === 'store') {
                                if (isStoreOwnerUser) {
                                  navigateTo('storeOwner');
                                } else if (isAdminOrSuper) {
                                  navigateTo('developer');
                                } else {
                                  navigateTo('store');
                                }
                              } else if (n.type === 'cash_assistance') {
                                if (isAdminOrSuper) {
                                  navigateTo('developer');
                                } else if (isStoreOwnerUser) {
                                  navigateTo('storeOwner');
                                } else if (canViewCashAssistanceNav) {
                                  navigateTo('cashAssistance');
                                } else {
                                  navigateTo('ledger');
                                }
                              } else if (n.type === 'payment') {
                                if (n.targetUserId === 'admins' && isAdminOrSuper) {
                                  if (n.title.toLowerCase().includes('awaiting confirmation')) {
                                    setRequestedAdminSubTab({ tab: 'salesOrder', nonce: Date.now() });
                                  } else {
                                    setRequestedAdminSubTab({ tab: 'proofs', nonce: Date.now() });
                                  }
                                  navigateTo('admin');
                                } else if (isStoreOwnerUser && n.title.toLowerCase().includes('store')) {
                                  navigateTo('storeOwner');
                                } else {
                                  navigateTo('ledger');
                                }
                              } else if (n.type === 'marketplace') {
                                if (
                                  (n.targetUserId === 'admins' ||
                                    n.targetUserId === 'super_admin') &&
                                  isAdminOrSuper
                                ) {
                                  setRequestedAdminSubTab({
                                    tab: 'marketplace',
                                    nonce: Date.now(),
                                  });
                                  navigateTo('admin');
                                } else {
                                  navigateTo('community');
                                }
                              } else if (n.type === 'reminder') {
                                navigateTo('ledger');
                              } else if (n.type === 'ewallet') {
                                navigateTo('ewallet');
                              } else if (n.type === 'community') {
                                navigateTo('community');
                              } else if (n.type === 'chat') {
                                const senderMatch = allRegisteredCoworkers.find(
                                  (c) =>
                                    c.id !== currentUser.id &&
                                    n.title.toLowerCase().includes(c.name.toLowerCase())
                                );
                                if (senderMatch) {
                                  const matchedThread = threads.find(
                                    (t) =>
                                      t.type === 'dm' &&
                                      t.participantIds.includes(currentUser.id) &&
                                      t.participantIds.includes(senderMatch.id)
                                  );
                                  if (matchedThread) {
                                    setRequestedChatThreadId({
                                      threadId: matchedThread.id,
                                      nonce: Date.now(),
                                    });
                                  }
                                }
                                navigateTo('chat');
                              }
                            }}
                            className="flex-1 min-w-0 text-left space-y-1 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                                {!n.read ? 'New · ' : ''}
                                {n.title}
                              </span>
                              <span className="text-stone-400 shrink-0">{n.timestamp}</span>
                            </div>
                            <p className="text-xs text-stone-600 dark:text-stone-400">{n.body}</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteNotification(n)}
                            aria-label={`Delete notification ${n.title}`}
                            title="Delete notification"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-[11px] font-medium text-stone-600 dark:text-stone-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
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
              dueDays={cashAssistanceSettings.dueDays}
              nextDueLabel={nextDueLabel}
              storeConfig={storeConfig}
              stores={stores}
              storeApplications={storeApplications}
              platformConfig={platformConfig}
              storeCustomerCredits={storeCustomerCredits}
              orders={orders}
              onSubmitStoreApplication={handleSubmitStoreApplication}
              onAddToCart={handleAddToCart}
              onUpdateCartQty={handleUpdateCartQty}
              onClearCart={() => setCart([])}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onOpenQRShare={() => setIsQROpen(true)}
              onOpenSalesOrder={isAdminOrSuper ? openSalesOrderTab : undefined}
              pendingOrdersCount={pendingOrdersCount}
              onPlaceOrder={handlePlaceOrder}
              onPlaceSplitOrder={handlePlaceSplitOrder}
              isCartOpen={isCartOpen}
              setIsCartOpen={setIsCartOpen}
            />
          )}

          {activeSection === 'storeOwner' && isStoreOwnerUser && (
            <StoreOwnerWorkspaceView
              currentUser={currentUser}
              currentRole={currentRole}
              stores={stores}
              items={items}
              orders={orders}
              proofs={proofs}
              loans={loans}
              users={users}
              coworkers={allRegisteredCoworkers}
              catalogTemplates={catalogTemplates}
              storeCashAssistance={storeCashAssistance}
              storeCustomerCredits={storeCustomerCredits}
              stockAdjustments={stockAdjustments}
              platformConfig={platformConfig}
              requestedStoreId={requestedStoreWorkspace}
              onUpdateStoreProfile={async (nextStore) => {
                setStores((prev) =>
                  prev.map((s) => (s.id === nextStore.id ? nextStore : s))
                );
                await saveStoreProfile(nextStore);
                if (nextStore.id === DEFAULT_STORE_ID) {
                  const nextStoreCfg: StoreConfig = {
                    storeAnnouncement: nextStore.storeAnnouncement,
                    deliveryEnabled: nextStore.deliveryEnabled,
                    deliveryFee: nextStore.deliveryFee,
                    walletAccountName: nextStore.walletAccountName,
                    walletAccountNumber: nextStore.walletAccountNumber,
                    categories: nextStore.categories,
                    paymentMethods: nextStore.paymentMethods,
                  };
                  setStoreConfig(nextStoreCfg);
                  await saveStoreConfig(nextStoreCfg, nextStore.dueDays);
                }
              }}
              onAddStoreItem={async (store, item) => {
                const todayIso = new Date().toISOString().slice(0, 10);
                const cleanBarcode = item.barcode?.trim().slice(0, 64) || undefined;
                const templateId = item.templateId || `tpl-${Date.now().toString(36)}`;
                const newItem: StoreItem = {
                  id: `item-${Date.now().toString(36)}`,
                  storeId: store.id,
                  storeName: store.name,
                  storeOwnerId: store.ownerId,
                  templateId,
                  name: item.name,
                  category: item.category,
                  description: item.description,
                  price: item.price,
                  costPrice: item.costPrice,
                  stock: item.stock,
                  soldCount: 0,
                  image: item.image,
                  barcode: cleanBarcode,
                  costHistory: [
                    {
                      id: `ch-${Date.now()}`,
                      date: todayIso,
                      costPrice: item.costPrice,
                      sellingPrice: item.price,
                      note: `Initial item registration (${store.name})`,
                      updatedBy: currentUser?.name ?? store.ownerName,
                    },
                  ],
                };
                const newTpl: CatalogTemplate = {
                  id: templateId,
                  name: item.name,
                  category: item.category,
                  description: item.description,
                  suggestedPrice: item.price,
                  image: item.image,
                  barcode: cleanBarcode,
                  createdByStoreId: store.id,
                  createdByStoreName: store.name,
                  createdByUserId: currentUser?.id ?? store.ownerId,
                  createdAt: todayIso,
                };
                setItems((prev) => [...prev, newItem]);
                setCatalogTemplates((prev) =>
                  prev.some((t) => t.id === templateId) ? prev : [newTpl, ...prev]
                );
                await saveStoreItem(newItem);
                if (!item.templateId) {
                  await saveCatalogTemplate(newTpl);
                }
              }}
              onAdoptCatalogTemplate={async (store, template, payload) => {
                const todayIso = new Date().toISOString().slice(0, 10);
                const newItem: StoreItem = {
                  id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
                  storeId: store.id,
                  storeName: store.name,
                  storeOwnerId: store.ownerId,
                  templateId: template.id,
                  name: template.name,
                  category: template.category,
                  description: `${template.description} (Stocked by ${store.name})`.slice(0, 600),
                  price: payload.price,
                  costPrice: payload.costPrice,
                  stock: payload.stock,
                  soldCount: 0,
                  image: template.image,
                  barcode: template.barcode,
                  costHistory: [
                    {
                      id: `ch-${Date.now()}`,
                      date: todayIso,
                      costPrice: payload.costPrice,
                      sellingPrice: payload.price,
                      note: `Adopted shared catalog item (${template.createdByStoreName} -> ${store.name})`,
                      updatedBy: currentUser?.name ?? store.ownerName,
                    },
                  ],
                };
                setItems((prev) => [...prev, newItem]);
                await saveStoreItem(newItem);
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
                      updatedBy: currentUser?.name ?? 'Store Owner',
                    },
                  ],
                };
                setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
                void saveStoreItem(updated);
              }}
              onDeleteItem={async (itemId) => {
                const prevItems = items;
                setItems((prev) => prev.filter((i) => i.id !== itemId));
                setCart((prev) => prev.filter((c) => c.itemId !== itemId));
                try {
                  await removeStoreItem(itemId);
                } catch (err) {
                  setItems(prevItems);
                  throw err;
                }
              }}
              onRestockItem={async (itemId, amount, options) => {
                const target = items.find((i) => i.id === itemId);
                if (!target) return;
                const previousItems = items;
                const previousLogs = stockAdjustments;
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
                          updatedBy: currentUser?.name ?? 'Store Owner',
                        },
                      ]
                    : target.costHistory,
                };
                const actorId = authUser?.id ?? currentUser?.id;
                const nowMs = Date.now();
                const nowTime = new Date(nowMs).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const restockLog: StockAdjustmentLog | null = actorId
                  ? {
                      id: `adj-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
                      storeId: target.storeId || DEFAULT_STORE_ID,
                      storeName: target.storeName || DEFAULT_STORE_NAME,
                      storeOwnerId: target.storeOwnerId || DEFAULT_STORE_OWNER_ID,
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
                      adjustedByName: (authUser?.name ?? currentUser?.name ?? 'Store Owner').slice(0, 120),
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
                const cleanBarcode = barcode.trim().slice(0, 64);
                const updated: StoreItem = {
                  ...target,
                  barcode: cleanBarcode || undefined,
                };
                setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
                await saveStoreItem(updated);
              }}
              onAdjustStock={handleAdjustStock}
              onApproveOrder={handleApprovePendingOrder}
              onRejectOrder={handleRejectPendingOrder}
              onCreateManualSale={handleCreateManualSale}
              onReviewProof={handleReviewProof}
              onSendStoreDebtReminders={async (store, credits) => {
                const storeDue = getNextDueDateLabel(store.dueDays);
                const nowMs = Date.now();
                await Promise.all(
                  credits.map((c, idx) =>
                    createNotificationDoc({
                      id: `notif-rem-${nowMs}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
                      title: `${store.name} Cutoff Reminder (${storeDue})`.slice(0, 140),
                      body: `Friendly reminder: you have a ${formatPHP(c.balance, true)} store credit balance with ${store.name} due by ${storeDue}.`.slice(
                        0,
                        500
                      ),
                      timestamp: 'Just now',
                      type: 'reminder',
                      read: false,
                      targetUserId: c.userId,
                    })
                  )
                );
              }}
              onRequestStoreCashAssistance={async (storeId, note) => {
                const cfg = storeCashAssistance.find((c) => c.storeId === storeId);
                if (!cfg) return;
                const nowIso = new Date().toISOString().slice(0, 10);
                setStoreCashAssistance((prev) =>
                  prev.map((c) =>
                    c.storeId === storeId
                      ? { ...c, status: 'pending_approval', requestedAt: nowIso, requestNote: note }
                      : c
                  )
                );
                await requestStoreCashAssistanceAddon(storeId, note);
                await createNotificationDoc({
                  id: `notif-ca-req-${Date.now()}`,
                  title: `Cash Assistance Add-On Request · ${cfg.storeName}`.slice(0, 140),
                  body: `${currentUser?.name ?? 'Store Owner'} requested to enable the Cash Assistance add-on for ${cfg.storeName}. Approve in Developer Settings.`.slice(
                    0,
                    500
                  ),
                  timestamp: 'Just now',
                  type: 'cash_assistance',
                  read: false,
                  targetUserId: 'super_admin',
                });
              }}
              onIssueStoreLoan={async (store, borrowerId, borrowerName, principal, months) => {
                const cfg = storeCashAssistance.find((c) => c.storeId === store.id);
                const rate = cfg?.monthlyInterestRate ?? cashAssistanceSettings.monthlyInterestRate;
                const totalPayable = principal + Math.round(principal * (rate / 100) * months);
                const loanId = `LN-${Date.now().toString().slice(-6)}`;
                const todayIso = new Date().toISOString().slice(0, 10);
                const installments = buildLoanInstallments(
                  loanId,
                  totalPayable,
                  months,
                  todayIso,
                  store.dueDays?.[1] ?? 30
                );
                const newLoan: LoanRecord = {
                  id: loanId,
                  storeId: store.id,
                  storeName: store.name,
                  storeOwnerId: store.ownerId,
                  userId: borrowerId,
                  userName: borrowerName,
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
                await saveLoanRecord(newLoan);
              }}
              onMarkStoreLoanSettled={async (loanId) => {
                const target = loans.find((l) => l.id === loanId);
                if (!target) return;
                const todayIso = new Date().toISOString().slice(0, 10);
                const settled: LoanRecord = {
                  ...target,
                  remainingBalance: 0,
                  status: 'Settled',
                  installments: (target.installments ?? []).map((i) => ({
                    ...i,
                    status: 'Paid',
                    paidAt: i.paidAt || todayIso,
                  })),
                };
                setLoans((prev) => prev.map((l) => (l.id === loanId ? settled : l)));
                await saveLoanRecord(settled);
              }}
              onOpenStorefrontApply={() => navigateTo('store')}
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
              totalRegisteredUsers={allRegisteredCoworkers.length}
              openSellFormSignal={openCommunitySellSignal}
              onDeleteSuggestion={handleDeleteSuggestion}
              onAddSuggestionComment={handleAddSuggestionComment}
              onUpdateSuggestionStatus={handleUpdateSuggestionStatus}
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
              onMarkOrderDelivered={handleSellerMarkOrderDelivered}
              onReviewSellerProof={handleReviewSellerProof}
              onSendDebtReminder={handleSendSellerDebtReminder}
              onMarkOrderDebtSettled={handleMarkSellerOrderDebtSettled}
              onUpdateListingConfig={handleUpdateSellerListingConfig}
              onDeleteListing={handleDeleteListing}
              onSaveSellerConfig={handleSaveSellerConfig}
            />
          )}

          {activeSection === 'cashAssistance' && canViewCashAssistanceNav && (
            <CashAssistanceView
              settings={cashAssistanceSettings}
              platformConfig={platformConfig}
              loans={loans}
              paymentMethods={storeConfig.paymentMethods}
              storeCashAssistance={storeCashAssistance}
              currentUser={currentUser}
              currentRole={currentRole}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onOpenLedger={() => navigateTo('ledger')}
              onOpenStoreWorkspace={(storeId) => {
                setRequestedStoreWorkspace({
                  storeId,
                  tab: 'cashAssistance',
                  nonce: Date.now(),
                });
                navigateTo('storeOwner');
              }}
              onRequestLoan={handleRequestLoan}
              onRepayLoan={handleRepayLoan}
              onRequestStoreCashAssistance={async (storeId, note) => {
                const nowIso = new Date().toISOString().slice(0, 10);
                setStoreCashAssistance((prev) =>
                  prev.map((c) =>
                    c.storeId === storeId
                      ? { ...c, status: 'pending_approval', requestedAt: nowIso, requestNote: note }
                      : c
                  )
                );
                await requestStoreCashAssistanceAddon(storeId, note);
              }}
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
              stores={stores}
              storeCustomerCredits={storeCustomerCredits}
              ownerTotalCommission={ownerCommissionEarned}
              dueDays={cashAssistanceSettings.dueDays}
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
              stores={stores}
              platformConfig={platformConfig}
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
              cashAssistanceSettings={cashAssistanceSettings}
              storeConfig={storeConfig}
              stores={stores}
              ownerTotalCommission={ownerCommissionEarned}
              onReviewProof={handleReviewProof}
              onReviewListing={handleReviewListing}
              onDeleteListing={handleDeleteListing}
              onUpdateDueDays={(d1, d2) => {
                const nextDays: [number, number] = [d1, d2];
                dueDaysRef.current = nextDays;
                const nextSettings = { ...cashAssistanceSettings, dueDays: nextDays };
                setCashAssistanceSettings(nextSettings);
                void saveCashAssistanceSettings(nextSettings);
              }}
              onSendReminders={handleSendReminders}
              onUpdateCashAssistanceGlobal={(enabled, rate) => {
                const nextSettings = {
                  ...cashAssistanceSettings,
                  globalEnabled: enabled,
                  monthlyInterestRate: rate,
                };
                setCashAssistanceSettings(nextSettings);
                void saveCashAssistanceSettings(nextSettings);
              }}
              onUpdateCashAssistanceTerms={(terms) => {
                const nextSettings = {
                  ...cashAssistanceSettings,
                  availableTerms: terms,
                };
                setCashAssistanceSettings(nextSettings);
                void saveCashAssistanceSettings(nextSettings);
              }}
              onToggleUserCashAssistance={(userId, enabled, limit) => {
                const target = users.find((u) => u.id === userId);
                if (!target) return;
                const updated: UserAccount = {
                  ...target,
                  cashAssistanceEnabled: enabled,
                  cashAssistanceLimit: limit,
                };
                setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
                if (authUser?.id === userId) setAuthUser(updated);
                void saveUserAccount(updated);
              }}
              onUpdateUserRole={(userId, role) => {
                if (!isActualSuperAdmin) return;
                const target = users.find((u) => u.id === userId);
                if (!target) return;
                const updated: UserAccount = { ...target, role };
                setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
                if (authUser?.id === userId) setAuthUser(updated);
                void saveUserAccount(updated);
              }}
              onAddDeliveryStaff={(name, email, department) => {
                if (!isActualSuperAdmin) return;
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
                  cashAssistanceEnabled: true,
                  cashAssistanceLimit: 3000,
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
                      storeId: target.storeId || DEFAULT_STORE_ID,
                      storeName: target.storeName || DEFAULT_STORE_NAME,
                      storeOwnerId: target.storeOwnerId || DEFAULT_STORE_OWNER_ID,
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
                  storeId: DEFAULT_STORE_ID,
                  storeName: DEFAULT_STORE_NAME,
                  storeOwnerId: DEFAULT_STORE_OWNER_ID,
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

          {activeSection === 'developer' && isAdminOrSuper && (
            <DeveloperSettingsView
              currentRole={currentRole}
              storeItems={items}
              listings={listings}
              proofs={proofs}
              ewalletPosts={ewalletPosts}
              apps={otherApps}
              storeConfig={storeConfig}
              platformConfig={platformConfig}
              stores={stores}
              storeCashAssistance={storeCashAssistance}
              storeApplications={storeApplications}
              users={users}
              onSavePlatformConfig={async (nextCfg) => {
                if (!isActualSuperAdmin) return;
                setPlatformConfig(nextCfg);
                await savePlatformConfig(nextCfg);
              }}
              onApproveStoreApplication={async (appId) => {
                if (!isActualAdmin) return;
                const app = storeApplications.find((a) => a.id === appId);
                if (!app || app.status !== 'pending') return;
                const todayIso = new Date().toISOString().slice(0, 10);
                const storeId = `store-${Date.now().toString(36)}`;
                const applicant = users.find((u) => u.id === app.applicantId);
                const actorName = currentUser?.name ?? 'Super Admin';
                const newStore: StoreProfile = {
                  id: storeId,
                  name: app.storeName,
                  description: app.description,
                  ownerId: app.applicantId,
                  ownerName: app.applicantName,
                  status: 'active',
                  subscriptionStatus: 'active',
                  monthlyFee: app.quotedBaseFee || platformConfig.baseStoreMonthlyFee,
                  cashAssistanceActive: false,
                  assignedDeliveryStaffIds: [],
                  storeAnnouncement: `Welcome to ${app.storeName}! Check stock and payment options below.`,
                  deliveryEnabled: true,
                  deliveryFee: platformConfig.defaultDeliveryFee ?? 15,
                  walletAccountName: app.applicantName,
                  walletAccountNumber: '',
                  dueDays: platformConfig.defaultDueDays ?? [15, 30],
                  categories: [...storeConfig.categories],
                  paymentMethods: DEFAULT_PAYMENT_METHODS.map((pm) => ({
                    ...pm,
                    accountName: pm.type === 'digital' ? app.applicantName : pm.accountName,
                  })),
                  createdAt: todayIso,
                };
                const newCa: StoreCashAssistanceConfig = {
                  storeId,
                  storeName: app.storeName,
                  storeOwnerId: app.applicantId,
                  status: 'locked',
                  visibleToOwner: false,
                  monthlyFee: platformConfig.cashAssistanceMonthlyFee,
                  monthlyInterestRate: cashAssistanceSettings.monthlyInterestRate,
                  dueDays: platformConfig.defaultDueDays ?? [15, 30],
                  availableTerms: cashAssistanceSettings.availableTerms,
                };
                const applicantOwned = applicant?.ownedStoreIds ?? [];
                await approveStoreApplicationAndProvisionStore({
                  application: app,
                  store: newStore,
                  storeCashAssistance: newCa,
                  applicantOwnedStoreIds: applicantOwned,
                  reviewedBy: actorName,
                });
                setStoreApplications((prev) =>
                  prev.map((a) =>
                    a.id === appId
                      ? { ...a, status: 'approved', provisionedStoreId: storeId, reviewedBy: actorName, reviewedAt: todayIso }
                      : a
                  )
                );
                setStores((prev) => [...prev, newStore]);
                setStoreCashAssistance((prev) => [...prev, newCa]);
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === app.applicantId
                      ? {
                          ...u,
                          ownedStoreIds: Array.from(new Set([...(u.ownedStoreIds ?? []), storeId])),
                        }
                      : u
                  )
                );
                if (authUser?.id === app.applicantId) {
                  setAuthUser((prev) =>
                    prev
                      ? {
                          ...prev,
                          ownedStoreIds: Array.from(new Set([...(prev.ownedStoreIds ?? []), storeId])),
                        }
                      : prev
                  );
                }
                void createNotificationDoc({
                  id: `notif-storeapp-ok-${Date.now()}`,
                  title: `Store Approved · ${app.storeName}`.slice(0, 140),
                  body: `Your store "${app.storeName}" is now active! Open "My Store" in the navigation bar to add items or adopt shared catalog listings.`,
                  timestamp: 'Just now',
                  type: 'store',
                  read: false,
                  targetUserId: app.applicantId,
                });
              }}
              onRejectStoreApplication={async (appId) => {
                if (!isActualAdmin) return;
                const app = storeApplications.find((a) => a.id === appId);
                if (!app) return;
                const actorName = currentUser?.name ?? 'Super Admin';
                await rejectStoreApplication(appId, actorName);
                setStoreApplications((prev) =>
                  prev.map((a) =>
                    a.id === appId ? { ...a, status: 'rejected', reviewedBy: actorName } : a
                  )
                );
                void createNotificationDoc({
                  id: `notif-storeapp-rej-${Date.now()}`,
                  title: `Store Application Declined · ${app.storeName}`.slice(0, 140),
                  body: `Your application for "${app.storeName}" was declined by ${actorName}.`,
                  timestamp: 'Just now',
                  type: 'store',
                  read: false,
                  targetUserId: app.applicantId,
                });
              }}
              onUpdateStoreSubscriptionStatus={async (storeId, status: StoreSubscriptionStatus) => {
                if (!isActualAdmin) return;
                const target = stores.find((s) => s.id === storeId);
                if (!target) return;
                const updated: StoreProfile = {
                  ...target,
                  status,
                  subscriptionStatus: status,
                };
                setStores((prev) => prev.map((s) => (s.id === storeId ? updated : s)));
                await saveStoreProfile(updated);
              }}
              onToggleStoreCashAssistanceVisibility={async (storeId, visible) => {
                if (!isActualAdmin) return;
                setStoreCashAssistance((prev) =>
                  prev.map((c) =>
                    c.storeId === storeId ? { ...c, visibleToOwner: visible } : c
                  )
                );
                await toggleStoreCashAssistanceVisibility(storeId, visible);
              }}
              onReviewStoreCashAssistance={async (storeId, status: CashAssistanceSubscriptionStatus) => {
                if (!isActualAdmin) return;
                const actorName = currentUser?.name ?? 'Super Admin';
                const targetCa = storeCashAssistance.find((c) => c.storeId === storeId);
                setStoreCashAssistance((prev) =>
                  prev.map((c) =>
                    c.storeId === storeId
                      ? {
                          ...c,
                          status,
                          visibleToOwner: status === 'locked' ? false : true,
                          ...(status === 'active' ? { approvedBy: actorName } : {}),
                        }
                      : c
                  )
                );
                setStores((prev) =>
                  prev.map((s) =>
                    s.id === storeId ? { ...s, cashAssistanceActive: status === 'active' } : s
                  )
                );
                await reviewStoreCashAssistanceAddon({
                  storeId,
                  status,
                  approvedBy: actorName,
                });
                if (status === 'active' && targetCa) {
                  void createNotificationDoc({
                    id: `notif-ca-ok-${Date.now()}`,
                    title: `Cash Assistance Activated · ${targetCa.storeName}`.slice(0, 140),
                    body: `Your Cash Assistance add-on for ${targetCa.storeName} is now active in My Store.`,
                    timestamp: 'Just now',
                    type: 'cash_assistance',
                    read: false,
                    targetUserId: targetCa.storeOwnerId,
                  });
                }
              }}
              onUpdateStoreDeliveryStaff={async (storeId, staffIds) => {
                if (!isActualAdmin) return;
                const userUpdates: Array<{ userId: string; assignedStoreIds: string[] }> = [];
                const nextUsers = users.map((u) => {
                  const prevAssigned = u.assignedStoreIds ?? [];
                  const shouldHave = staffIds.includes(u.id);
                  const has = prevAssigned.includes(storeId);
                  if (shouldHave === has) return u;
                  const nextAssigned = shouldHave
                    ? Array.from(new Set([...prevAssigned, storeId]))
                    : prevAssigned.filter((id) => id !== storeId);
                  userUpdates.push({ userId: u.id, assignedStoreIds: nextAssigned });
                  return { ...u, assignedStoreIds: nextAssigned };
                });
                setStores((prev) =>
                  prev.map((s) =>
                    s.id === storeId ? { ...s, assignedDeliveryStaffIds: staffIds } : s
                  )
                );
                setUsers(nextUsers);
                await assignDeliveryStaffToStore({
                  storeId,
                  assignedDeliveryStaffIds: staffIds,
                  userUpdates,
                });
              }}
              onDeleteMediaAsset={handleDeleteMediaAsset}
              onBulkDeleteMediaAssets={handleBulkDeleteMediaAssets}
              onExitPreview={isPreviewingOtherRole ? () => setPreviewRole(null) : undefined}
            />
          )}

          {activeSection === 'chat' && (
            <ChatHubView
              threads={threads}
              coworkers={allRegisteredCoworkers}
              currentUser={currentUser}
              currentRole={currentRole}
              storeItems={items}
              dueDays={cashAssistanceSettings.dueDays}
              pendingProofsCount={pendingProofsCount}
              requestedThreadId={requestedChatThreadId}
              onOpenSignIn={() => setIsSignInOpen(true)}
              onSendMessage={handleSendMessage}
              onReceiveAiReply={handleReceiveAiReply}
              onMarkThreadRead={handleMarkThreadRead}
              onStartDirectChat={handleStartDirectChat}
              onDeleteMessage={handleDeleteChatMessage}
              onDeleteThread={handleDeleteChatThread}
            />
          )}

          {activeSection === 'apps' && (
            <OtherAppsView
              apps={otherApps}
              currentRole={currentRole}
              onToggleInstallApp={(appId) => {
                setOtherApps((prev) =>
                  prev.map((a) => (a.id === appId ? { ...a, installed: true } : a))
                );
                if (authUser) {
                  void toggleInternalAppInstalled(appId, true);
                }
              }}
              onSaveApp={handleSaveInternalApp}
              onDeleteApp={handleDeleteInternalApp}
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
          ...(canViewCashAssistanceNav
            ? [{ id: 'cashAssistance', label: 'Assist', icon: HandCoins, badge: 0 }]
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
        dueDays={cashAssistanceSettings.dueDays}
        pendingProofsCount={pendingProofsCount}
        aiThread={myPrivateAiThread}
        onSendMessage={handleSendMessage}
        onReceiveAiReply={handleReceiveAiReply}
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

      {currentUser && (
        <WorkstationSetupModal
          isOpen={isWorkstationModalOpen}
          isDark={darkMode}
          currentUser={currentUser}
          isFirstTimeSetup={isWorkstationFirstTime}
          onClose={() => setIsWorkstationModalOpen(false)}
          onSave={handleSaveWorkstationProfile}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
