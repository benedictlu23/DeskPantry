import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  INITIAL_CASH_ASSISTANCE_SETTINGS,
  INITIAL_CATALOG_TEMPLATES,
  INITIAL_CHAT_THREADS,
  INITIAL_EWALLET_POSTS,
  INITIAL_LOANS,
  INITIAL_MARKETPLACE_LISTINGS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ORDERS,
  INITIAL_OTHER_APPS,
  INITIAL_PAYMENT_PROOFS,
  INITIAL_PLATFORM_CONFIG,
  INITIAL_STORE_APPLICATIONS,
  INITIAL_STORE_CASH_ASSISTANCE,
  INITIAL_STORE_CONFIG,
  INITIAL_STORE_CUSTOMER_CREDITS,
  INITIAL_STORE_ITEMS,
  INITIAL_STORES,
  INITIAL_SUGGESTIONS,
  INITIAL_USERS,
} from '../data/seedData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CashAssistanceSettings,
  CashAssistanceSubscriptionStatus,
  CatalogTemplate,
  ChatMessage,
  ChatThread,
  CoworkerProfile,
  EWalletPost,
  InternalApp,
  LoanRecord,
  MarketplaceListing,
  NotificationItem,
  OrderLogEntry,
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
  SuggestionComment,
  SuggestionItem,
  UserAccount,
  UserRole,
} from '../types';
import { DEFAULT_STORE_ID, DEFAULT_STORE_NAME, DEFAULT_STORE_OWNER_ID } from '../utils/format';

export const BOOTSTRAPPED_SUPER_ADMIN_EMAIL = 'benedictlu23@gmail.com';

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return chars || 'DP';
}

function clampString(val: string | undefined, max: number): string {
  if (!val) return '';
  return val.length > max ? val.slice(0, max) : val;
}

const inFlightUpserts = new Map<string, Promise<UserAccount>>();

export async function upsertUserOnAuth(firebaseUser: User): Promise<UserAccount> {
  const uid = firebaseUser.uid;
  const active = inFlightUpserts.get(uid);
  if (active) return active;

  const task = (async () => {
    const userPath = `users/${uid}`;
    const profilePath = `coworkerProfiles/${uid}`;
    const email = (firebaseUser.email || '').trim().toLowerCase();
    const isBootstrapped =
      email === BOOTSTRAPPED_SUPER_ADMIN_EMAIL && firebaseUser.emailVerified;
    const googleName =
      firebaseUser.displayName?.trim() ||
      email.split('@')[0]?.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
      'Coworker';
    const googleAvatar = clampString(firebaseUser.photoURL || '', 1000);
    const nowIso = new Date().toISOString();

    let existingRaw: Record<string, unknown> | null = null;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        existingRaw = snap.data() as Record<string, unknown>;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userPath);
    }

    const legacyEnabledKey = 'pautan' + 'ganEnabled';
    const legacyLimitKey = 'pautan' + 'ganLimit';

    const existing = existingRaw as Partial<UserAccount> | null;
    const resolvedCashEnabled = existingRaw
      ? Boolean(existing?.cashAssistanceEnabled ?? existingRaw[legacyEnabledKey])
      : false;
    const resolvedCashLimit = existingRaw
      ? Number(existing?.cashAssistanceLimit ?? existingRaw[legacyLimitKey] ?? 0)
      : 0;

    const existingOwnedStores = Array.isArray(existing?.ownedStoreIds)
      ? existing!.ownedStoreIds
      : isBootstrapped
        ? [DEFAULT_STORE_ID]
        : [];
    const existingAssignedStores = Array.isArray(existing?.assignedStoreIds)
      ? existing!.assignedStoreIds
      : [];

    const nextAccount: UserAccount = existing
      ? {
          id: uid,
          email: String(existing.email || email),
          name: clampString(String(existing.name || googleName), 120),
          department: clampString(
            String(existing.department || (isBootstrapped ? 'Engineering Ops' : 'Department Staff')),
            120
          ),
          tableRow: clampString(String(existing.tableRow || ''), 40),
          tableNumber: clampString(String(existing.tableNumber || ''), 40),
          role: isBootstrapped ? UserRole.SuperAdmin : (existing.role as UserRole) || UserRole.Member,
          cashAssistanceEnabled: isBootstrapped ? true : resolvedCashEnabled,
          cashAssistanceLimit: isBootstrapped
            ? Math.max(resolvedCashLimit, 10000)
            : resolvedCashLimit,
          ownedStoreIds: existingOwnedStores,
          assignedStoreIds: existingAssignedStores,
          storeDebtBalances: existing.storeDebtBalances ?? {},
          avatarInitials: makeInitials(String(existing.name || googleName)),
          avatarUrl: googleAvatar || String(existing.avatarUrl || ''),
          debtBalance: Number(existing.debtBalance ?? 0),
          totalSpent: Number(existing.totalSpent ?? 0),
        }
      : {
          id: uid,
          name: clampString(googleName, 120),
          email,
          department: isBootstrapped ? 'Engineering Ops' : 'Department Staff',
          tableRow: '',
          tableNumber: '',
          role: isBootstrapped ? UserRole.SuperAdmin : UserRole.Member,
          debtBalance: 0,
          storeDebtBalances: {},
          cashAssistanceEnabled: isBootstrapped,
          cashAssistanceLimit: isBootstrapped ? 10000 : 0,
          ownedStoreIds: isBootstrapped ? [DEFAULT_STORE_ID] : [],
          assignedStoreIds: [],
          avatarInitials: makeInitials(googleName),
          avatarUrl: googleAvatar,
          totalSpent: 0,
        };

    try {
      if (existingRaw) {
        const hasLegacyFields =
          legacyEnabledKey in existingRaw ||
          legacyLimitKey in existingRaw ||
          !('cashAssistanceEnabled' in existingRaw);

        const patch: Record<string, unknown> = {
          name: nextAccount.name,
          department: nextAccount.department,
          tableRow: nextAccount.tableRow || '',
          tableNumber: nextAccount.tableNumber || '',
          avatarInitials: nextAccount.avatarInitials,
          avatarUrl: nextAccount.avatarUrl || '',
          updatedAt: nowIso,
        };
        if (isBootstrapped || hasLegacyFields) {
          patch.cashAssistanceEnabled = nextAccount.cashAssistanceEnabled;
          patch.cashAssistanceLimit = nextAccount.cashAssistanceLimit;
          if (hasLegacyFields) {
            patch[legacyEnabledKey] = deleteField();
            patch[legacyLimitKey] = deleteField();
          }
        }
        if (isBootstrapped) {
          patch.role = nextAccount.role;
          if (!Array.isArray(existing?.ownedStoreIds) || existing.ownedStoreIds.length === 0) {
            patch.ownedStoreIds = [DEFAULT_STORE_ID];
          }
        }
        await updateDoc(doc(db, 'users', uid), stripUndefined(patch));
      } else {
        const createPayload = stripUndefined({
          ...nextAccount,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        await setDoc(doc(db, 'users', uid), createPayload);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    }

    const profilePayload = stripUndefined({
      id: uid,
      name: nextAccount.name,
      department: nextAccount.department,
      tableRow: nextAccount.tableRow || '',
      tableNumber: nextAccount.tableNumber || '',
      avatarInitials: nextAccount.avatarInitials,
      avatarUrl: nextAccount.avatarUrl || '',
      updatedAt: nowIso,
    });

    try {
      await setDoc(doc(db, 'coworkerProfiles', uid), profilePayload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, profilePath);
    }

    return nextAccount;
  })();

  inFlightUpserts.set(uid, task);
  try {
    return await task;
  } finally {
    inFlightUpserts.delete(uid);
  }
}

export async function seedInitialFirestoreDataIfEmpty(
  currentUserEmail: string
): Promise<boolean> {
  try {
    const existingStoreConfig = await getDocFromServer(doc(db, 'config', 'store'));
    if (existingStoreConfig.exists()) {
      return false;
    }

    const existingItems = await getDocsFromServer(
      query(collection(db, 'storeItems'), limit(1))
    );
    if (!existingItems.empty) {
      return false;
    }
  } catch (err) {
    console.warn('Skipping initial seed check:', err);
    return false;
  }

  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);

  batch.set(
    doc(db, 'config', 'platform'),
    stripUndefined({
      ...INITIAL_PLATFORM_CONFIG,
      updatedAt: nowIso,
    })
  );

  batch.set(
    doc(db, 'config', 'store'),
    stripUndefined({
      ...INITIAL_STORE_CONFIG,
      dueDays: INITIAL_CASH_ASSISTANCE_SETTINGS.dueDays,
      updatedAt: nowIso,
    })
  );

  batch.set(
    doc(db, 'config', 'cashAssistance'),
    stripUndefined({
      ...INITIAL_CASH_ASSISTANCE_SETTINGS,
      updatedAt: nowIso,
    })
  );

  for (const store of INITIAL_STORES) {
    batch.set(
      doc(db, 'stores', store.id),
      stripUndefined({ ...store, updatedAt: nowIso })
    );
  }

  for (const ca of INITIAL_STORE_CASH_ASSISTANCE) {
    batch.set(
      doc(db, 'storeCashAssistance', ca.storeId),
      stripUndefined({ ...ca, updatedAt: nowIso })
    );
  }

  for (const appReq of INITIAL_STORE_APPLICATIONS) {
    batch.set(
      doc(db, 'storeApplications', appReq.id),
      stripUndefined({ ...appReq, updatedAt: nowIso })
    );
  }

  for (const tpl of INITIAL_CATALOG_TEMPLATES) {
    batch.set(
      doc(db, 'catalogTemplates', tpl.id),
      stripUndefined({ ...tpl, updatedAt: nowIso })
    );
  }

  for (const credit of INITIAL_STORE_CUSTOMER_CREDITS) {
    batch.set(doc(db, 'storeCustomerCredits', credit.id), stripUndefined(credit));
  }

  for (const item of INITIAL_STORE_ITEMS) {
    batch.set(
      doc(db, 'storeItems', item.id),
      stripUndefined({ ...item, updatedAt: nowIso })
    );
  }

  for (const appItem of INITIAL_OTHER_APPS) {
    batch.set(doc(db, 'internalApps', appItem.id), stripUndefined(appItem));
  }

  for (const sug of INITIAL_SUGGESTIONS) {
    batch.set(
      doc(db, 'suggestions', sug.id),
      stripUndefined({ ...sug, updatedAt: nowIso })
    );
  }

  for (const listing of INITIAL_MARKETPLACE_LISTINGS) {
    batch.set(
      doc(db, 'marketplaceListings', listing.id),
      stripUndefined({ ...listing, updatedAt: nowIso })
    );
  }

  for (const post of INITIAL_EWALLET_POSTS) {
    batch.set(
      doc(db, 'ewalletPosts', post.id),
      stripUndefined({ ...post, updatedAt: nowIso })
    );
  }

  for (const order of INITIAL_ORDERS) {
    batch.set(
      doc(db, 'orders', order.id),
      stripUndefined({ ...order, updatedAt: nowIso })
    );
  }

  for (const loan of INITIAL_LOANS) {
    batch.set(
      doc(db, 'loans', loan.id),
      stripUndefined({ ...loan, updatedAt: nowIso })
    );
  }

  for (const proof of INITIAL_PAYMENT_PROOFS) {
    batch.set(
      doc(db, 'paymentProofs', proof.id),
      stripUndefined({ ...proof, updatedAt: nowIso })
    );
  }

  for (let i = 0; i < INITIAL_NOTIFICATIONS.length; i++) {
    const n = INITIAL_NOTIFICATIONS[i];
    batch.set(
      doc(db, 'notifications', n.id),
      stripUndefined({
        ...n,
        targetUserId: n.targetUserId ?? 'all',
        createdAtMs: Date.now() - i * 60_000,
      })
    );
  }

  const normalizedEmail = currentUserEmail.trim().toLowerCase();
  for (const u of INITIAL_USERS) {
    if (u.email.toLowerCase() === normalizedEmail) continue;
    batch.set(
      doc(db, 'users', u.id),
      stripUndefined({ ...u, createdAt: nowIso, updatedAt: nowIso })
    );
    batch.set(
      doc(db, 'coworkerProfiles', u.id),
      stripUndefined({
        id: u.id,
        name: u.name,
        department: u.department,
        avatarInitials: u.avatarInitials,
        avatarUrl: u.avatarUrl || '',
        updatedAt: nowIso,
      })
    );
  }

  for (const t of INITIAL_CHAT_THREADS) {
    batch.set(
      doc(db, 'chatThreads', t.id),
      stripUndefined({
        id: t.id,
        title: t.title,
        subtitle: t.subtitle,
        type: t.type,
        participantIds: t.participantIds,
        unreadCount: t.unreadCount,
        updatedAt: nowIso,
      })
    );
    for (let idx = 0; idx < t.messages.length; idx++) {
      const m = t.messages[idx];
      batch.set(
        doc(db, 'chatThreads', t.id, 'messages', m.id),
        stripUndefined({
          ...m,
          createdAtMs: Date.now() - (t.messages.length - idx) * 30_000,
        })
      );
    }
  }

  try {
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seedBatch');
  }
}

export async function ensureMultiStoreFoundation(adminUid: string): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const [platformSnap, flagshipSnap, cashAssistSnap] = await Promise.all([
      getDocFromServer(doc(db, 'config', 'platform')),
      getDocFromServer(doc(db, 'stores', DEFAULT_STORE_ID)),
      getDocFromServer(doc(db, 'config', 'cashAssistance')),
    ]);

    const batch = writeBatch(db);
    let hasWrites = false;

    if (!platformSnap.exists()) {
      batch.set(
        doc(db, 'config', 'platform'),
        stripUndefined({ ...INITIAL_PLATFORM_CONFIG, updatedAt: nowIso })
      );
      hasWrites = true;
    }

    if (!cashAssistSnap.exists()) {
      batch.set(
        doc(db, 'config', 'cashAssistance'),
        stripUndefined({ ...INITIAL_CASH_ASSISTANCE_SETTINGS, updatedAt: nowIso })
      );
      hasWrites = true;
    }

    if (!flagshipSnap.exists()) {
      const storeConfigSnap = await getDocFromServer(doc(db, 'config', 'store'));
      const sc: StoreConfig & { dueDays?: [number, number] } = storeConfigSnap.exists()
        ? (storeConfigSnap.data() as StoreConfig & { dueDays?: [number, number] })
        : (INITIAL_STORE_CONFIG as StoreConfig & { dueDays?: [number, number] });
      const baseFlagship = INITIAL_STORES[0];
      batch.set(
        doc(db, 'stores', DEFAULT_STORE_ID),
        stripUndefined({
          ...baseFlagship,
          ownerId: adminUid || DEFAULT_STORE_OWNER_ID,
          storeAnnouncement: sc.storeAnnouncement || baseFlagship.storeAnnouncement,
          deliveryEnabled: sc.deliveryEnabled ?? baseFlagship.deliveryEnabled,
          deliveryFee: sc.deliveryFee ?? baseFlagship.deliveryFee,
          walletAccountName: sc.walletAccountName || baseFlagship.walletAccountName,
          walletAccountNumber: sc.walletAccountNumber || baseFlagship.walletAccountNumber,
          dueDays: sc.dueDays || baseFlagship.dueDays,
          categories: sc.categories || baseFlagship.categories,
          paymentMethods: sc.paymentMethods || baseFlagship.paymentMethods,
          updatedAt: nowIso,
        })
      );
      batch.set(
        doc(db, 'storeCashAssistance', DEFAULT_STORE_ID),
        stripUndefined({
          ...INITIAL_STORE_CASH_ASSISTANCE[0],
          storeOwnerId: adminUid || DEFAULT_STORE_OWNER_ID,
          updatedAt: nowIso,
        })
      );
      for (const tpl of INITIAL_CATALOG_TEMPLATES) {
        batch.set(
          doc(db, 'catalogTemplates', tpl.id),
          stripUndefined({ ...tpl, updatedAt: nowIso }),
          { merge: true }
        );
      }
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('Multi-store foundation check skipped:', err);
  }
}

export function subscribePublicStoreData(handlers: {
  onItems: (items: StoreItem[]) => void;
  onStoreConfig: (config: StoreConfig & { dueDays?: [number, number] }) => void;
  onStores?: (stores: StoreProfile[]) => void;
}): Unsubscribe {
  const unsubItems = onSnapshot(
    collection(db, 'storeItems'),
    (snap) => {
      handlers.onItems(snap.docs.map((d) => d.data() as StoreItem));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'storeItems')
  );

  const unsubConfig = onSnapshot(
    doc(db, 'config', 'store'),
    (snap) => {
      if (snap.exists()) {
        handlers.onStoreConfig(snap.data() as StoreConfig & { dueDays?: [number, number] });
      }
    },
    (err) => handleFirestoreError(err, OperationType.GET, 'config/store')
  );

  const unsubStores = handlers.onStores
    ? onSnapshot(
        collection(db, 'stores'),
        (snap) => {
          handlers.onStores?.(snap.docs.map((d) => d.data() as StoreProfile));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'stores')
      )
    : () => {};

  return () => {
    unsubItems();
    unsubConfig();
    unsubStores();
  };
}

export function subscribeAuthenticatedData(
  params: {
    uid: string;
    role: UserRole;
    cashAssistanceEnabled: boolean;
    ownedStoreIds: string[];
  },
  handlers: {
    onCurrentUser: (user: UserAccount) => void;
    onUsers: (users: UserAccount[]) => void;
    onCoworkerProfiles: (profiles: CoworkerProfile[]) => void;
    onOrders: (orders: StoreOrder[]) => void;
    onProofs: (proofs: PaymentProof[]) => void;
    onSuggestions: (suggestions: SuggestionItem[]) => void;
    onListings: (listings: MarketplaceListing[]) => void;
    onEWalletPosts: (posts: EWalletPost[]) => void;
    onCashAssistanceSettings: (settings: CashAssistanceSettings) => void;
    onLoans: (loans: LoanRecord[]) => void;
    onNotifications: (notifs: NotificationItem[]) => void;
    onInternalApps: (apps: InternalApp[]) => void;
    onChatThreads: (threads: ChatThread[]) => void;
    onStockAdjustments?: (logs: StockAdjustmentLog[]) => void;
    onSellerConfig?: (config: SellerConfig | null) => void;
    onPlatformConfig?: (config: PlatformConfig) => void;
    onStoreCashAssistance?: (configs: StoreCashAssistanceConfig[]) => void;
    onStoreApplications?: (apps: StoreApplication[]) => void;
    onCatalogTemplates?: (templates: CatalogTemplate[]) => void;
    onStoreCustomerCredits?: (credits: StoreCustomerCredit[]) => void;
  }
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const { uid, role, cashAssistanceEnabled, ownedStoreIds } = params;
  const isAdmin = role === UserRole.Admin || role === UserRole.SuperAdmin;
  const isSuperAdmin = role === UserRole.SuperAdmin;
  const isDelivery = role === UserRole.DeliveryStaff;
  const isStoreOwner = ownedStoreIds.length > 0;

  // 1. Own User Document
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserAccount;
          handlers.onCurrentUser({
            ...data,
            cashAssistanceEnabled: Boolean(data.cashAssistanceEnabled),
            cashAssistanceLimit: Number(data.cashAssistanceLimit ?? 0),
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    )
  );

  // 2. Coworker Profiles (non-PII)
  unsubs.push(
    onSnapshot(
      collection(db, 'coworkerProfiles'),
      (snap) => {
        handlers.onCoworkerProfiles(snap.docs.map((d) => d.data() as CoworkerProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'coworkerProfiles')
    )
  );

  // 3. Platform Config
  if (handlers.onPlatformConfig) {
    unsubs.push(
      onSnapshot(
        doc(db, 'config', 'platform'),
        (snap) => {
          if (snap.exists()) {
            handlers.onPlatformConfig?.(snap.data() as PlatformConfig);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'config/platform')
      )
    );
  }

  // 4. All Users (Admin / SuperAdmin only) & Stock Adjustments (Admin or Store Owner)
  if (isAdmin) {
    unsubs.push(
      onSnapshot(
        collection(db, 'users'),
        (snap) => {
          handlers.onUsers(snap.docs.map((d) => d.data() as UserAccount));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'users')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'stockAdjustments'),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as StockAdjustmentLog)
            .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
          handlers.onStockAdjustments?.(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'stockAdjustments')
      )
    );
  } else if (isStoreOwner) {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'stockAdjustments'), where('storeOwnerId', '==', uid)),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as StockAdjustmentLog)
            .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
          handlers.onStockAdjustments?.(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'stockAdjustments')
      )
    );
  } else {
    handlers.onStockAdjustments?.([]);
  }

  // 5. Orders (Admins see all; Store Owners see their stores; Delivery Staff see assigned stores; Buyers/Sellers see their own)
  if (isAdmin) {
    unsubs.push(
      onSnapshot(
        collection(db, 'orders'),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as StoreOrder)
            .sort((a, b) => (b.orderDateIso || '').localeCompare(a.orderDateIso || ''));
          handlers.onOrders(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
      )
    );
  } else {
    let boughtOrders: StoreOrder[] = [];
    let soldOrders: StoreOrder[] = [];
    let storeOwnedOrders: StoreOrder[] = [];
    let assignedDeliveryOrders: StoreOrder[] = [];
    let runnerDirectOrders: StoreOrder[] = [];
    const emitMergedOrders = () => {
      const merged = new Map<string, StoreOrder>();
      for (const o of boughtOrders) merged.set(o.id, o);
      for (const o of soldOrders) merged.set(o.id, o);
      for (const o of storeOwnedOrders) merged.set(o.id, o);
      for (const o of assignedDeliveryOrders) merged.set(o.id, o);
      for (const o of runnerDirectOrders) merged.set(o.id, o);
      const list = Array.from(merged.values()).sort((a, b) =>
        (b.orderDateIso || '').localeCompare(a.orderDateIso || '')
      );
      handlers.onOrders(list);
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, 'orders'), where('userId', '==', uid)),
        (snap) => {
          boughtOrders = snap.docs.map((d) => d.data() as StoreOrder);
          emitMergedOrders();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'orders'), where('sellerId', '==', uid)),
        (snap) => {
          soldOrders = snap.docs.map((d) => d.data() as StoreOrder);
          emitMergedOrders();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
      )
    );
    if (isStoreOwner) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'orders'), where('storeOwnerId', '==', uid)),
          (snap) => {
            storeOwnedOrders = snap.docs.map((d) => d.data() as StoreOrder);
            emitMergedOrders();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
        )
      );
    }
    if (isDelivery) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'orders'), where('assignedDeliveryStaffIds', 'array-contains', uid)),
          (snap) => {
            assignedDeliveryOrders = snap.docs.map((d) => d.data() as StoreOrder);
            emitMergedOrders();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'orders'), where('assignedRunnerId', '==', uid)),
          (snap) => {
            runnerDirectOrders = snap.docs.map((d) => d.data() as StoreOrder);
            emitMergedOrders();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
        )
      );
    }
  }

  // 6. Payment Proofs (Admin sees all; Store Owner sees their store proofs; Buyers/Sellers see their own)
  if (isAdmin) {
    unsubs.push(
      onSnapshot(
        collection(db, 'paymentProofs'),
        (snap) => {
          handlers.onProofs(snap.docs.map((d) => d.data() as PaymentProof));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'paymentProofs')
      )
    );
  } else {
    let mySubmittedProofs: PaymentProof[] = [];
    let receivedSellerProofs: PaymentProof[] = [];
    let storeOwnerProofs: PaymentProof[] = [];
    const emitMergedProofs = () => {
      const merged = new Map<string, PaymentProof>();
      for (const p of mySubmittedProofs) merged.set(p.id, p);
      for (const p of receivedSellerProofs) merged.set(p.id, p);
      for (const p of storeOwnerProofs) merged.set(p.id, p);
      handlers.onProofs(Array.from(merged.values()));
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, 'paymentProofs'), where('userId', '==', uid)),
        (snap) => {
          mySubmittedProofs = snap.docs.map((d) => d.data() as PaymentProof);
          emitMergedProofs();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'paymentProofs')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'paymentProofs'), where('sellerId', '==', uid)),
        (snap) => {
          receivedSellerProofs = snap.docs.map((d) => d.data() as PaymentProof);
          emitMergedProofs();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'paymentProofs')
      )
    );
    if (isStoreOwner) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'paymentProofs'), where('storeOwnerId', '==', uid)),
          (snap) => {
            storeOwnerProofs = snap.docs.map((d) => d.data() as PaymentProof);
            emitMergedProofs();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'paymentProofs')
        )
      );
    }
  }

  // 7. Store Customer Credits (Per-store isolated debt balances)
  if (handlers.onStoreCustomerCredits) {
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'storeCustomerCredits'),
          (snap) => {
            handlers.onStoreCustomerCredits?.(snap.docs.map((d) => d.data() as StoreCustomerCredit));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'storeCustomerCredits')
        )
      );
    } else {
      let buyerCredits: StoreCustomerCredit[] = [];
      let ownerCredits: StoreCustomerCredit[] = [];
      const emitCredits = () => {
        const merged = new Map<string, StoreCustomerCredit>();
        for (const c of buyerCredits) merged.set(c.id, c);
        for (const c of ownerCredits) merged.set(c.id, c);
        handlers.onStoreCustomerCredits?.(Array.from(merged.values()));
      };
      unsubs.push(
        onSnapshot(
          query(collection(db, 'storeCustomerCredits'), where('userId', '==', uid)),
          (snap) => {
            buyerCredits = snap.docs.map((d) => d.data() as StoreCustomerCredit);
            emitCredits();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'storeCustomerCredits')
        )
      );
      if (isStoreOwner) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'storeCustomerCredits'), where('storeOwnerId', '==', uid)),
            (snap) => {
              ownerCredits = snap.docs.map((d) => d.data() as StoreCustomerCredit);
              emitCredits();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'storeCustomerCredits')
          )
        );
      }
    }
  }

  // 8. Confidential Store Cash Assistance Subscriptions
  if (handlers.onStoreCashAssistance) {
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'storeCashAssistance'),
          (snap) => {
            handlers.onStoreCashAssistance?.(
              snap.docs.map((d) => d.data() as StoreCashAssistanceConfig)
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'storeCashAssistance')
        )
      );
    } else if (isStoreOwner) {
      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'storeCashAssistance'),
            where('storeOwnerId', '==', uid),
            where('visibleToOwner', '==', true)
          ),
          (snap) => {
            handlers.onStoreCashAssistance?.(
              snap.docs.map((d) => d.data() as StoreCashAssistanceConfig)
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'storeCashAssistance')
        )
      );
    } else {
      handlers.onStoreCashAssistance?.([]);
    }
  }

  // 9. Store Applications
  if (handlers.onStoreApplications) {
    const appsQuery = isAdmin
      ? collection(db, 'storeApplications')
      : query(collection(db, 'storeApplications'), where('applicantId', '==', uid));
    unsubs.push(
      onSnapshot(
        appsQuery,
        (snap) => {
          handlers.onStoreApplications?.(snap.docs.map((d) => d.data() as StoreApplication));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'storeApplications')
      )
    );
  }

  // 10. Shared Catalog Templates
  if (handlers.onCatalogTemplates) {
    unsubs.push(
      onSnapshot(
        collection(db, 'catalogTemplates'),
        (snap) => {
          handlers.onCatalogTemplates?.(snap.docs.map((d) => d.data() as CatalogTemplate));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'catalogTemplates')
      )
    );
  }

  // 11. Suggestions
  unsubs.push(
    onSnapshot(
      collection(db, 'suggestions'),
      (snap) => {
        handlers.onSuggestions(snap.docs.map((d) => d.data() as SuggestionItem));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'suggestions')
    )
  );

  // 12. Marketplace Listings
  if (isAdmin) {
    unsubs.push(
      onSnapshot(
        collection(db, 'marketplaceListings'),
        (snap) => {
          handlers.onListings(snap.docs.map((d) => d.data() as MarketplaceListing));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'marketplaceListings')
      )
    );
  } else {
    let approvedList: MarketplaceListing[] = [];
    let myList: MarketplaceListing[] = [];
    const mergeListings = () => {
      const map = new Map<string, MarketplaceListing>();
      for (const l of approvedList) map.set(l.id, l);
      for (const l of myList) map.set(l.id, l);
      handlers.onListings(Array.from(map.values()));
    };
    unsubs.push(
      onSnapshot(
        query(collection(db, 'marketplaceListings'), where('approvalStatus', '==', 'approved')),
        (snap) => {
          approvedList = snap.docs.map((d) => d.data() as MarketplaceListing);
          mergeListings();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'marketplaceListings')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'marketplaceListings'), where('sellerId', '==', uid)),
        (snap) => {
          myList = snap.docs.map((d) => d.data() as MarketplaceListing);
          mergeListings();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'marketplaceListings')
      )
    );
  }

  // 13. E-Wallet Posts
  unsubs.push(
    onSnapshot(
      collection(db, 'ewalletPosts'),
      (snap) => {
        handlers.onEWalletPosts(snap.docs.map((d) => d.data() as EWalletPost));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'ewalletPosts')
    )
  );

  // 14. Confidential Cash Assistance Settings & Loans
  if (isAdmin || cashAssistanceEnabled || isStoreOwner) {
    if (isAdmin || cashAssistanceEnabled) {
      unsubs.push(
        onSnapshot(
          doc(db, 'config', 'cashAssistance'),
          (snap) => {
            if (snap.exists()) {
              handlers.onCashAssistanceSettings(snap.data() as CashAssistanceSettings);
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, 'config/cashAssistance')
        )
      );
    }

    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'loans'),
          (snap) => {
            handlers.onLoans(snap.docs.map((d) => d.data() as LoanRecord));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'loans')
        )
      );
    } else {
      let userLoans: LoanRecord[] = [];
      let ownerLoans: LoanRecord[] = [];
      const emitLoans = () => {
        const merged = new Map<string, LoanRecord>();
        for (const l of userLoans) merged.set(l.id, l);
        for (const l of ownerLoans) merged.set(l.id, l);
        handlers.onLoans(Array.from(merged.values()));
      };
      if (cashAssistanceEnabled) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'loans'), where('userId', '==', uid)),
            (snap) => {
              userLoans = snap.docs.map((d) => d.data() as LoanRecord);
              emitLoans();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'loans')
          )
        );
      }
      if (isStoreOwner) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'loans'), where('storeOwnerId', '==', uid)),
            (snap) => {
              ownerLoans = snap.docs.map((d) => d.data() as LoanRecord);
              emitLoans();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'loans')
          )
        );
      }
    }
  } else {
    handlers.onLoans([]);
  }

  // 15. Notifications
  {
    const targetBuckets = ['uid', 'all'];
    if (isDelivery || isAdmin) targetBuckets.push('delivery');
    if (isAdmin) targetBuckets.push('admins');
    if (isSuperAdmin) targetBuckets.push('super_admin');

    const bucketDocs = new Map<string, Array<NotificationItem & { createdAtMs?: number }>>();
    const emitNotifs = () => {
      const merged = new Map<string, NotificationItem & { createdAtMs?: number }>();
      for (const list of bucketDocs.values()) {
        for (const n of list) merged.set(n.id, n);
      }
      handlers.onNotifications(
        Array.from(merged.values()).sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
      );
    };

    for (const bucket of targetBuckets) {
      const targetVal = bucket === 'uid' ? uid : bucket;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('targetUserId', '==', targetVal)),
          (snap) => {
            bucketDocs.set(
              bucket,
              snap.docs.map((d) => d.data() as NotificationItem & { createdAtMs?: number })
            );
            emitNotifs();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        )
      );
    }
  }

  // 16. Internal Apps
  unsubs.push(
    onSnapshot(
      collection(db, 'internalApps'),
      (snap) => {
        handlers.onInternalApps(snap.docs.map((d) => d.data() as InternalApp));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'internalApps')
    )
  );

  // 17. Chat Threads + Messages Subcollections
  const messageUnsubs = new Map<string, Unsubscribe>();
  const threadDocsMap = new Map<string, Omit<ChatThread, 'messages'>>();
  const threadMessagesMap = new Map<string, ChatMessage[]>();

  const emitThreads = () => {
    const merged: ChatThread[] = Array.from(threadDocsMap.values()).map((t) => ({
      ...t,
      messages: threadMessagesMap.get(t.id) ?? [],
    }));
    handlers.onChatThreads(merged);
  };

  const syncMessageListeners = (threadsMeta: Array<Omit<ChatThread, 'messages'>>) => {
    const activeIds = new Set(threadsMeta.map((t) => t.id));
    for (const [tid, unsub] of messageUnsubs.entries()) {
      if (!activeIds.has(tid)) {
        unsub();
        messageUnsubs.delete(tid);
        threadDocsMap.delete(tid);
        threadMessagesMap.delete(tid);
      }
    }

    for (const t of threadsMeta) {
      threadDocsMap.set(t.id, t);
      if (!messageUnsubs.has(t.id)) {
        const msgQuery = query(
          collection(db, 'chatThreads', t.id, 'messages'),
          orderBy('createdAtMs', 'asc')
        );
        const unsubMsg = onSnapshot(
          msgQuery,
          (snap) => {
            threadMessagesMap.set(
              t.id,
              snap.docs.map((d) => d.data() as ChatMessage)
            );
            emitThreads();
          },
          (err) =>
            handleFirestoreError(err, OperationType.LIST, `chatThreads/${t.id}/messages`)
        );
        messageUnsubs.set(t.id, unsubMsg);
      }
    }
    emitThreads();
  };

  if (isSuperAdmin) {
    unsubs.push(
      onSnapshot(
        collection(db, 'chatThreads'),
        (snap) => {
          syncMessageListeners(snap.docs.map((d) => d.data() as Omit<ChatThread, 'messages'>));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'chatThreads')
      )
    );
  } else {
    let channelThreads: Array<Omit<ChatThread, 'messages'>> = [];
    let participantThreads: Array<Omit<ChatThread, 'messages'>> = [];
    const mergeThreads = () => {
      const map = new Map<string, Omit<ChatThread, 'messages'>>();
      for (const t of channelThreads) map.set(t.id, t);
      for (const t of participantThreads) map.set(t.id, t);
      syncMessageListeners(Array.from(map.values()));
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, 'chatThreads'), where('type', '==', 'channel')),
        (snap) => {
          channelThreads = snap.docs.map((d) => d.data() as Omit<ChatThread, 'messages'>);
          mergeThreads();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'chatThreads')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'chatThreads'), where('participantIds', 'array-contains', uid)),
        (snap) => {
          participantThreads = snap.docs.map((d) => d.data() as Omit<ChatThread, 'messages'>);
          mergeThreads();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'chatThreads')
      )
    );
  }

  // 18. Seller Config
  if (handlers.onSellerConfig) {
    unsubs.push(
      onSnapshot(
        doc(db, 'sellerConfigs', uid),
        (snap) => {
          handlers.onSellerConfig?.(snap.exists() ? (snap.data() as SellerConfig) : null);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `sellerConfigs/${uid}`)
      )
    );
  }

  return () => {
    for (const unsub of unsubs) unsub();
    for (const unsub of messageUnsubs.values()) unsub();
  };
}

// ---------- Mutation Helpers ----------

export async function savePlatformConfig(config: PlatformConfig): Promise<void> {
  try {
    await setDoc(
      doc(db, 'config', 'platform'),
      stripUndefined({ ...config, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'config/platform');
  }
}

export async function saveStoreProfile(store: StoreProfile): Promise<void> {
  try {
    await setDoc(
      doc(db, 'stores', store.id),
      stripUndefined({ ...store, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stores/${store.id}`);
  }
}

export async function saveStoreConfig(
  config: StoreConfig,
  dueDays: [number, number]
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await setDoc(
      doc(db, 'config', 'store'),
      stripUndefined({
        ...config,
        dueDays,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
    const flagshipSnap = await getDoc(doc(db, 'stores', DEFAULT_STORE_ID));
    if (flagshipSnap.exists()) {
      await updateDoc(
        doc(db, 'stores', DEFAULT_STORE_ID),
        stripUndefined({
          storeAnnouncement: config.storeAnnouncement,
          deliveryEnabled: config.deliveryEnabled,
          deliveryFee: config.deliveryFee,
          walletAccountName: config.walletAccountName,
          walletAccountNumber: config.walletAccountNumber,
          categories: config.categories,
          paymentMethods: config.paymentMethods,
          dueDays,
          updatedAt: nowIso,
        })
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'config/store');
  }
}

export async function saveCashAssistanceSettings(
  settings: CashAssistanceSettings
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await setDoc(
      doc(db, 'config', 'cashAssistance'),
      stripUndefined({
        ...settings,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
    await updateDoc(doc(db, 'config', 'store'), {
      dueDays: settings.dueDays,
      updatedAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'config/cashAssistance');
  }
}

export async function submitStoreApplication(application: StoreApplication): Promise<void> {
  try {
    await setDoc(
      doc(db, 'storeApplications', application.id),
      stripUndefined({ ...application, updatedAt: new Date().toISOString() })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `storeApplications/${application.id}`);
  }
}

export async function approveStoreApplicationAndProvisionStore(params: {
  application: StoreApplication;
  store: StoreProfile;
  storeCashAssistance: StoreCashAssistanceConfig;
  applicantOwnedStoreIds: string[];
  reviewedBy: string;
}): Promise<void> {
  const { application, store, storeCashAssistance, applicantOwnedStoreIds, reviewedBy } = params;
  const nowIso = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'storeApplications', application.id),
      stripUndefined({
        ...application,
        status: 'approved',
        reviewedBy,
        reviewedAt: nowIso.slice(0, 10),
        provisionedStoreId: store.id,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
    batch.set(
      doc(db, 'stores', store.id),
      stripUndefined({ ...store, updatedAt: nowIso })
    );
    batch.set(
      doc(db, 'storeCashAssistance', store.id),
      stripUndefined({ ...storeCashAssistance, updatedAt: nowIso })
    );
    batch.update(doc(db, 'users', application.applicantId), {
      ownedStoreIds: Array.from(new Set([...applicantOwnedStoreIds, store.id])),
      updatedAt: nowIso,
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stores/${store.id}`);
  }
}

export async function rejectStoreApplication(
  applicationId: string,
  reviewedBy: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'storeApplications', applicationId), {
      status: 'rejected',
      reviewedBy,
      reviewedAt: nowIso.slice(0, 10),
      updatedAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `storeApplications/${applicationId}`);
  }
}

export async function toggleStoreCashAssistanceVisibility(
  storeId: string,
  visibleToOwner: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'storeCashAssistance', storeId), {
      visibleToOwner,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `storeCashAssistance/${storeId}`);
  }
}

export async function requestStoreCashAssistanceAddon(
  storeId: string,
  requestNote: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(
      doc(db, 'storeCashAssistance', storeId),
      stripUndefined({
        status: 'pending_approval',
        requestedAt: nowIso.slice(0, 10),
        requestNote: clampString(requestNote.trim(), 400),
        updatedAt: nowIso,
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `storeCashAssistance/${storeId}`);
  }
}

export async function reviewStoreCashAssistanceAddon(params: {
  storeId: string;
  status: CashAssistanceSubscriptionStatus;
  approvedBy: string;
  monthlyInterestRate?: number;
  monthlyFee?: number;
}): Promise<void> {
  const { storeId, status, approvedBy, monthlyInterestRate, monthlyFee } = params;
  const nowIso = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.update(
      doc(db, 'storeCashAssistance', storeId),
      stripUndefined({
        status,
        visibleToOwner: status === 'locked' ? false : true,
        ...(monthlyInterestRate !== undefined ? { monthlyInterestRate } : {}),
        ...(monthlyFee !== undefined ? { monthlyFee } : {}),
        ...(status === 'active'
          ? { approvedBy, approvedAt: nowIso.slice(0, 10) }
          : {}),
        updatedAt: nowIso,
      })
    );
    batch.update(doc(db, 'stores', storeId), {
      cashAssistanceActive: status === 'active',
      updatedAt: nowIso,
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `storeCashAssistance/${storeId}`);
  }
}

export async function assignDeliveryStaffToStore(params: {
  storeId: string;
  assignedDeliveryStaffIds: string[];
  userUpdates: Array<{ userId: string; assignedStoreIds: string[] }>;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'stores', params.storeId), {
      assignedDeliveryStaffIds: params.assignedDeliveryStaffIds,
      updatedAt: nowIso,
    });
    for (const u of params.userUpdates) {
      batch.update(doc(db, 'users', u.userId), {
        assignedStoreIds: u.assignedStoreIds,
        updatedAt: nowIso,
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `stores/${params.storeId}`);
  }
}

export async function saveCatalogTemplate(template: CatalogTemplate): Promise<void> {
  try {
    await setDoc(
      doc(db, 'catalogTemplates', template.id),
      stripUndefined({ ...template, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `catalogTemplates/${template.id}`);
  }
}

export async function saveStoreItem(item: StoreItem): Promise<void> {
  try {
    await setDoc(
      doc(db, 'storeItems', item.id),
      stripUndefined({
        ...item,
        storeId: item.storeId || DEFAULT_STORE_ID,
        storeName: item.storeName || DEFAULT_STORE_NAME,
        storeOwnerId: item.storeOwnerId || DEFAULT_STORE_OWNER_ID,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `storeItems/${item.id}`);
  }
}

export async function updateStoreItemStock(
  itemId: string,
  stock: number,
  soldCount: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'storeItems', itemId), {
      stock,
      soldCount,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `storeItems/${itemId}`);
  }
}

export async function removeStoreItem(itemId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'storeItems', itemId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `storeItems/${itemId}`);
  }
}

export async function recordStockAdjustment(
  updatedItem: StoreItem,
  log: StockAdjustmentLog
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'storeItems', updatedItem.id),
      stripUndefined({ ...updatedItem, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
    batch.set(doc(db, 'stockAdjustments', log.id), stripUndefined(log));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stockAdjustments/${log.id}`);
  }
}

export async function saveStoreCustomerCredit(credit: StoreCustomerCredit): Promise<void> {
  try {
    await setDoc(
      doc(db, 'storeCustomerCredits', credit.id),
      stripUndefined(credit),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `storeCustomerCredits/${credit.id}`);
  }
}

export async function createSplitOrdersBatch(params: {
  orders: StoreOrder[];
  proofs: PaymentProof[];
  stockUpdates: Array<{ itemId: string; stock: number; soldCount: number }>;
  creditUpdates: StoreCustomerCredit[];
  userDebtTotal: number;
  userStoreDebtBalances: Record<string, number>;
  userTotalSpent: number;
  userId: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    for (const order of params.orders) {
      batch.set(
        doc(db, 'orders', order.id),
        stripUndefined({ ...order, updatedAt: nowIso })
      );
    }
    for (const proof of params.proofs) {
      batch.set(
        doc(db, 'paymentProofs', proof.id),
        stripUndefined({ ...proof, updatedAt: nowIso })
      );
    }
    for (const su of params.stockUpdates) {
      batch.update(doc(db, 'storeItems', su.itemId), {
        stock: su.stock,
        soldCount: su.soldCount,
        updatedAt: nowIso,
      });
    }
    for (const credit of params.creditUpdates) {
      batch.set(
        doc(db, 'storeCustomerCredits', credit.id),
        stripUndefined(credit),
        { merge: true }
      );
    }
    batch.update(doc(db, 'users', params.userId), {
      debtBalance: Math.max(0, params.userDebtTotal),
      storeDebtBalances: params.userStoreDebtBalances,
      totalSpent: Math.max(0, params.userTotalSpent),
      updatedAt: nowIso,
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'splitCheckoutBatch');
  }
}

export async function saveUserAccount(user: UserAccount): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await setDoc(
      doc(db, 'users', user.id),
      stripUndefined({
        ...user,
        tableRow: clampString(user.tableRow || '', 40),
        tableNumber: clampString(user.tableNumber || '', 40),
        updatedAt: nowIso,
      }),
      { merge: true }
    );
    await setDoc(
      doc(db, 'coworkerProfiles', user.id),
      stripUndefined({
        id: user.id,
        name: user.name,
        department: user.department,
        tableRow: clampString(user.tableRow || '', 40),
        tableNumber: clampString(user.tableNumber || '', 40),
        avatarInitials: user.avatarInitials,
        avatarUrl: user.avatarUrl || '',
        updatedAt: nowIso,
      }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
  }
}

export async function updateUserWorkstationProfile(
  userId: string,
  workstation: { department: string; tableRow: string; tableNumber: string }
): Promise<void> {
  const nowIso = new Date().toISOString();
  const department = clampString(workstation.department.trim(), 120);
  const tableRow = clampString(workstation.tableRow.trim(), 40);
  const tableNumber = clampString(workstation.tableNumber.trim(), 40);
  try {
    await updateDoc(doc(db, 'users', userId), {
      department,
      tableRow,
      tableNumber,
      updatedAt: nowIso,
    });
    await updateDoc(doc(db, 'coworkerProfiles', userId), {
      department,
      tableRow,
      tableNumber,
      updatedAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
  }
}

export async function updateUserCheckoutTotals(
  userId: string,
  debtBalance: number,
  totalSpent: number,
  storeDebtBalances?: Record<string, number>
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'users', userId),
      stripUndefined({
        debtBalance,
        ...(storeDebtBalances !== undefined ? { storeDebtBalances } : {}),
        totalSpent,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
  }
}

export async function saveOrder(order: StoreOrder): Promise<void> {
  try {
    await setDoc(
      doc(db, 'orders', order.id),
      stripUndefined({ ...order, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `orders/${order.id}`);
  }
}

export async function updateOrderDeliveryFields(
  orderId: string,
  patch: Partial<
    Pick<
      StoreOrder,
      | 'status'
      | 'deliveryStatus'
      | 'cashCollected'
      | 'deliveredAt'
      | 'assignedRunnerId'
      | 'assignedRunner'
      | 'logs'
    >
  >
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'orders', orderId),
      stripUndefined({ ...patch, updatedAt: new Date().toISOString() })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function savePaymentProof(proof: PaymentProof): Promise<void> {
  try {
    await setDoc(
      doc(db, 'paymentProofs', proof.id),
      stripUndefined({ ...proof, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `paymentProofs/${proof.id}`);
  }
}

export async function saveLoanRecord(loan: LoanRecord): Promise<void> {
  try {
    await setDoc(
      doc(db, 'loans', loan.id),
      stripUndefined({ ...loan, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `loans/${loan.id}`);
  }
}

export async function saveSuggestion(suggestion: SuggestionItem): Promise<void> {
  try {
    await setDoc(
      doc(db, 'suggestions', suggestion.id),
      stripUndefined({ ...suggestion, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `suggestions/${suggestion.id}`);
  }
}

export async function updateSuggestionVotes(
  suggestionId: string,
  voterIds: string[],
  voterNames: string[],
  downvoterIds: string[] = [],
  downvoterNames: string[] = []
): Promise<void> {
  try {
    await updateDoc(doc(db, 'suggestions', suggestionId), {
      voterIds,
      voterNames,
      downvoterIds,
      downvoterNames,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `suggestions/${suggestionId}`);
  }
}

export async function updateSuggestionComments(
  suggestionId: string,
  comments: SuggestionComment[]
): Promise<void> {
  try {
    await updateDoc(doc(db, 'suggestions', suggestionId), {
      comments: stripUndefined(comments.slice(-200)),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `suggestions/${suggestionId}`);
  }
}

export async function updateSuggestionStatus(
  suggestionId: string,
  status: SuggestionItem['status'],
  addedToStoreAt?: string
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'suggestions', suggestionId),
      stripUndefined({
        status,
        addedToStoreAt: status === 'Added to Pantry' ? addedToStoreAt : '',
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `suggestions/${suggestionId}`);
  }
}

export async function deleteSuggestionDoc(suggestionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'suggestions', suggestionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `suggestions/${suggestionId}`);
  }
}

export async function saveMarketplaceListing(
  listing: MarketplaceListing
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'marketplaceListings', listing.id),
      stripUndefined({ ...listing, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `marketplaceListings/${listing.id}`);
  }
}

export async function updateMarketplaceListingStock(
  listingId: string,
  stock: number,
  soldCount: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'marketplaceListings', listingId), {
      stock,
      soldCount,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `marketplaceListings/${listingId}`);
  }
}

export async function removeMarketplaceListing(listingId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'marketplaceListings', listingId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `marketplaceListings/${listingId}`);
  }
}

export async function updateSellerListingConfig(
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
): Promise<void> {
  try {
    const sanitized = stripUndefined({
      ...patch,
      ...(patch.title !== undefined ? { title: clampString(patch.title.trim(), 140) } : {}),
      ...(patch.description !== undefined
        ? { description: clampString(patch.description.trim(), 600) }
        : {}),
      ...(patch.pickupNote !== undefined
        ? { pickupNote: clampString(patch.pickupNote.trim(), 200) }
        : {}),
      ...(patch.paymentDetails !== undefined
        ? { paymentDetails: clampString(patch.paymentDetails.trim(), 200) }
        : {}),
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'marketplaceListings', listingId), sanitized);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `marketplaceListings/${listingId}`);
  }
}

export async function markMarketplaceOrderDebtSettled(
  orderId: string,
  debtSettled: boolean,
  settledAt: string,
  logs: OrderLogEntry[],
  debtPaidAmount?: number
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'orders', orderId),
      stripUndefined({
        debtSettled,
        ...(debtPaidAmount !== undefined
          ? { debtPaidAmount: Math.max(0, Number(debtPaidAmount) || 0) }
          : {}),
        settledAt: clampString(settledAt, 80),
        logs: logs.slice(-50),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function approveSellerProofAndSettleOrders(
  updatedProof: PaymentProof,
  orderPatches: Array<{
    orderId: string;
    debtSettled: boolean;
    debtPaidAmount: number;
    settledAt?: string;
    logs: OrderLogEntry[];
  }>
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'paymentProofs', updatedProof.id),
      stripUndefined({
        ...updatedProof,
        updatedAt: nowIso,
      }),
      { merge: true }
    );

    for (const patch of orderPatches) {
      batch.update(
        doc(db, 'orders', patch.orderId),
        stripUndefined({
          debtSettled: patch.debtSettled,
          debtPaidAmount: Math.max(0, Number(patch.debtPaidAmount) || 0),
          ...(patch.settledAt !== undefined
            ? { settledAt: clampString(patch.settledAt, 80) }
            : {}),
          logs: patch.logs.slice(-50),
          updatedAt: nowIso,
        })
      );
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `paymentProofs/${updatedProof.id}`);
  }
}

export async function updateMarketplaceOrderConfirmation(
  orderId: string,
  patch: Partial<
    Pick<
      StoreOrder,
      | 'status'
      | 'deliveryStatus'
      | 'assignedRunnerId'
      | 'assignedRunner'
      | 'deliveredAt'
      | 'cashCollected'
      | 'debtSettled'
      | 'settledAt'
      | 'logs'
    >
  >
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'orders', orderId),
      stripUndefined({
        ...patch,
        ...(patch.logs ? { logs: patch.logs.slice(-50) } : {}),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function getSellerConfigById(sellerId: string): Promise<SellerConfig | null> {
  if (!sellerId) return null;
  try {
    const snap = await getDoc(doc(db, 'sellerConfigs', sellerId));
    return snap.exists() ? (snap.data() as SellerConfig) : null;
  } catch {
    return null;
  }
}

export async function saveSellerConfig(config: SellerConfig): Promise<void> {
  try {
    const payload = stripUndefined({
      userId: config.userId,
      gcashNumber: clampString(config.gcashNumber?.trim(), 60),
      mayaNumber: clampString(config.mayaNumber?.trim(), 60),
      paymentNotes: clampString(config.paymentNotes?.trim(), 300),
      defaultPickupNote: clampString(config.defaultPickupNote?.trim(), 200),
      defaultReminderTemplate: clampString(
        config.defaultReminderTemplate.trim() ||
          'Hi {buyer}, friendly reminder to settle {amount} for {item} via Cash or GCash/Maya.',
        300
      ),
      defaultAllowCash: Boolean(config.defaultAllowCash),
      defaultAllowDebt: Boolean(config.defaultAllowDebt),
      notifyOnNewSale: Boolean(config.notifyOnNewSale),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'sellerConfigs', config.userId), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sellerConfigs/${config.userId}`);
  }
}

export async function saveEWalletPost(post: EWalletPost): Promise<void> {
  try {
    await setDoc(
      doc(db, 'ewalletPosts', post.id),
      stripUndefined({ ...post, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `ewalletPosts/${post.id}`);
  }
}

export async function updateEWalletPostPartial(
  postId: string,
  patch: Partial<
    Pick<
      EWalletPost,
      'remainingAmount' | 'status' | 'completedAtMs' | 'fills' | 'comments'
    >
  >
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'ewalletPosts', postId),
      stripUndefined({ ...patch, updatedAt: new Date().toISOString() })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `ewalletPosts/${postId}`);
  }
}

export async function deleteEWalletPost(postId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'ewalletPosts', postId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `ewalletPosts/${postId}`);
  }
}

export async function createChatThread(
  thread: Omit<ChatThread, 'messages'>
): Promise<void> {
  try {
    const threadRef = doc(db, 'chatThreads', thread.id);
    const existingSnap = await getDoc(threadRef);
    if (existingSnap.exists()) {
      return;
    }
    try {
      await setDoc(
        threadRef,
        stripUndefined({
          id: thread.id,
          title: clampString(thread.title, 140),
          subtitle: clampString(thread.subtitle, 200),
          type: thread.type,
          participantIds: thread.participantIds.slice(0, 50),
          unreadCount: Math.max(0, Number(thread.unreadCount) || 0),
          ...(thread.unreadBy ? { unreadBy: thread.unreadBy } : {}),
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (writeErr) {
      const raceSnap = await getDoc(threadRef).catch(() => null);
      if (raceSnap?.exists()) {
        return;
      }
      throw writeErr;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `chatThreads/${thread.id}`);
  }
}

export async function deleteChatMessage(
  threadId: string,
  messageId: string
): Promise<void> {
  const path = `chatThreads/${threadId}/messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'chatThreads', threadId, 'messages', messageId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function deleteChatThread(threadId: string): Promise<void> {
  const path = `chatThreads/${threadId}`;
  try {
    const msgsSnap = await getDocsFromServer(
      collection(db, 'chatThreads', threadId, 'messages')
    );
    const refs = msgsSnap.docs.map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      for (const ref of refs.slice(i, i + 400)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
    await deleteDoc(doc(db, 'chatThreads', threadId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function addChatMessageToThread(
  threadId: string,
  message: ChatMessage
): Promise<void> {
  const path = `chatThreads/${threadId}/messages/${message.id}`;
  try {
    await setDoc(
      doc(db, 'chatThreads', threadId, 'messages', message.id),
      stripUndefined({
        ...message,
        createdAtMs: Date.now(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markThreadUnreadCount(
  threadId: string,
  unreadCount: number,
  unreadBy?: Record<string, number>
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'chatThreads', threadId),
      stripUndefined({
        unreadCount: Math.max(0, Number(unreadCount) || 0),
        ...(unreadBy !== undefined ? { unreadBy } : {}),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chatThreads/${threadId}`);
  }
}

export async function createNotificationDoc(
  notif: NotificationItem
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'notifications', notif.id),
      stripUndefined({
        ...notif,
        targetUserId: notif.targetUserId ?? 'all',
        createdAtMs: Date.now(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `notifications/${notif.id}`);
  }
}

export async function markNotificationReadDoc(notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notifId}`);
  }
}

export async function deleteNotificationDoc(notifId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notifId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `notifications/${notifId}`);
  }
}

export async function deleteNotificationDocs(notifIds: string[]): Promise<void> {
  if (notifIds.length === 0) return;
  try {
    for (let i = 0; i < notifIds.length; i += 400) {
      const batch = writeBatch(db);
      for (const id of notifIds.slice(i, i + 400)) {
        batch.delete(doc(db, 'notifications', id));
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'notifications');
  }
}

export async function clearStoreItemImage(itemId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'storeItems', itemId), {
      image: deleteField(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `storeItems/${itemId}`);
  }
}

export async function clearMarketplaceListingImage(listingId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'marketplaceListings', listingId), {
      image: deleteField(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `marketplaceListings/${listingId}`);
  }
}

export async function clearPaymentProofImage(proofId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'paymentProofs', proofId), {
      imageDataUrl: '',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `paymentProofs/${proofId}`);
  }
}

export async function clearInternalAppImage(appId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'internalApps', appId), {
      image: '',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `internalApps/${appId}`);
  }
}

export async function toggleInternalAppInstalled(
  appId: string,
  installed: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'internalApps', appId), { installed });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `internalApps/${appId}`);
  }
}

export async function saveInternalApp(app: InternalApp): Promise<void> {
  try {
    await setDoc(
      doc(db, 'internalApps', app.id),
      stripUndefined({
        id: app.id,
        name: clampString(app.name.trim(), 120),
        tagline: clampString(app.tagline.trim(), 200),
        description: clampString(app.description.trim(), 500),
        platform: clampString(app.platform.trim() || 'Web Workspace', 80),
        version: clampString(app.version.trim() || 'v1.0', 40),
        actionType: app.actionType === 'install' ? 'install' : 'open',
        installed: Boolean(app.installed),
        image: clampString(app.image, 400000),
        url: clampString(app.url.trim() || '#', 500),
      }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `internalApps/${app.id}`);
  }
}

export async function deleteInternalApp(appId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'internalApps', appId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `internalApps/${appId}`);
  }
}

export async function syncOwnerCommissionToStoreConfig(
  ownerCommissionEarned: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'config', 'store'), {
      ownerCommissionEarned: Math.max(0, Number(ownerCommissionEarned) || 0),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'config/store');
  }
}

export interface FullSyncResult {
  items: StoreItem[];
  stores: StoreProfile[];
  platformConfig: PlatformConfig | null;
  storeConfig: (StoreConfig & { dueDays?: [number, number] }) | null;
  cashAssistanceSettings: CashAssistanceSettings | null;
  sellerConfig: SellerConfig | null;
  currentUser: UserAccount | null;
  users: UserAccount[];
  coworkerProfiles: CoworkerProfile[];
  orders: StoreOrder[];
  proofs: PaymentProof[];
  suggestions: SuggestionItem[];
  listings: MarketplaceListing[];
  ewalletPosts: EWalletPost[];
  loans: LoanRecord[];
  stockAdjustments: StockAdjustmentLog[];
  internalApps: InternalApp[];
  storeApplications: StoreApplication[];
  catalogTemplates: CatalogTemplate[];
  storeCustomerCredits: StoreCustomerCredit[];
  syncedAt: string;
}

export async function syncAllFirestoreDataNow(params: {
  uid: string;
  role: UserRole;
  cashAssistanceEnabled: boolean;
  ownedStoreIds: string[];
}): Promise<FullSyncResult> {
  const { uid, role, cashAssistanceEnabled, ownedStoreIds } = params;
  const isAdmin = role === UserRole.Admin || role === UserRole.SuperAdmin;
  const isDelivery = role === UserRole.DeliveryStaff;
  const isStoreOwner = ownedStoreIds.length > 0;

  const fetchCollection = async <T,>(
    q: ReturnType<typeof collection> | ReturnType<typeof query>,
    path: string
  ): Promise<T[]> => {
    try {
      const snap = await getDocsFromServer(q);
      return snap.docs.map((d) => d.data() as T);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  };

  const fetchDoc = async <T,>(
    ref: ReturnType<typeof doc>,
    path: string
  ): Promise<T | null> => {
    try {
      const snap = await getDocFromServer(ref);
      return snap.exists() ? (snap.data() as T) : null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  };

  const [
    items,
    stores,
    platformConfig,
    storeConfig,
    sellerConfig,
    currentUser,
    users,
    coworkerProfiles,
    boughtOrAllOrders,
    sellerOrders,
    ownedStoreOrders,
    assignedDeliveryOrders,
    submittedOrAllProofs,
    receivedSellerProofs,
    storeOwnerProofs,
    suggestions,
    approvedOrAllListings,
    myListings,
    ewalletPosts,
    cashAssistanceSettings,
    loans,
    stockAdjustments,
    internalApps,
    storeApplications,
    catalogTemplates,
    storeCustomerCredits,
  ] = await Promise.all([
    fetchCollection<StoreItem>(collection(db, 'storeItems'), 'storeItems'),
    fetchCollection<StoreProfile>(collection(db, 'stores'), 'stores'),
    fetchDoc<PlatformConfig>(doc(db, 'config', 'platform'), 'config/platform'),
    fetchDoc<StoreConfig & { dueDays?: [number, number] }>(
      doc(db, 'config', 'store'),
      'config/store'
    ),
    fetchDoc<SellerConfig>(doc(db, 'sellerConfigs', uid), `sellerConfigs/${uid}`),
    fetchDoc<UserAccount>(doc(db, 'users', uid), `users/${uid}`),
    isAdmin
      ? fetchCollection<UserAccount>(collection(db, 'users'), 'users')
      : Promise.resolve([] as UserAccount[]),
    fetchCollection<CoworkerProfile>(collection(db, 'coworkerProfiles'), 'coworkerProfiles'),
    fetchCollection<StoreOrder>(
      isAdmin
        ? collection(db, 'orders')
        : query(collection(db, 'orders'), where('userId', '==', uid)),
      'orders'
    ),
    isAdmin
      ? Promise.resolve([] as StoreOrder[])
      : fetchCollection<StoreOrder>(query(collection(db, 'orders'), where('sellerId', '==', uid)), 'orders'),
    !isAdmin && isStoreOwner
      ? fetchCollection<StoreOrder>(
          query(collection(db, 'orders'), where('storeOwnerId', '==', uid)),
          'orders'
        )
      : Promise.resolve([] as StoreOrder[]),
    !isAdmin && isDelivery
      ? fetchCollection<StoreOrder>(
          query(collection(db, 'orders'), where('assignedDeliveryStaffIds', 'array-contains', uid)),
          'orders'
        )
      : Promise.resolve([] as StoreOrder[]),
    fetchCollection<PaymentProof>(
      isAdmin
        ? collection(db, 'paymentProofs')
        : query(collection(db, 'paymentProofs'), where('userId', '==', uid)),
      'paymentProofs'
    ),
    isAdmin
      ? Promise.resolve([] as PaymentProof[])
      : fetchCollection<PaymentProof>(
          query(collection(db, 'paymentProofs'), where('sellerId', '==', uid)),
          'paymentProofs'
        ),
    !isAdmin && isStoreOwner
      ? fetchCollection<PaymentProof>(
          query(collection(db, 'paymentProofs'), where('storeOwnerId', '==', uid)),
          'paymentProofs'
        )
      : Promise.resolve([] as PaymentProof[]),
    fetchCollection<SuggestionItem>(collection(db, 'suggestions'), 'suggestions'),
    isAdmin
      ? fetchCollection<MarketplaceListing>(collection(db, 'marketplaceListings'), 'marketplaceListings')
      : fetchCollection<MarketplaceListing>(
          query(collection(db, 'marketplaceListings'), where('approvalStatus', '==', 'approved')),
          'marketplaceListings'
        ),
    isAdmin
      ? Promise.resolve([] as MarketplaceListing[])
      : fetchCollection<MarketplaceListing>(
          query(collection(db, 'marketplaceListings'), where('sellerId', '==', uid)),
          'marketplaceListings'
        ),
    fetchCollection<EWalletPost>(collection(db, 'ewalletPosts'), 'ewalletPosts'),
    isAdmin || cashAssistanceEnabled
      ? fetchDoc<CashAssistanceSettings>(doc(db, 'config', 'cashAssistance'), 'config/cashAssistance')
      : Promise.resolve(null),
    isAdmin || cashAssistanceEnabled
      ? fetchCollection<LoanRecord>(
          isAdmin ? collection(db, 'loans') : query(collection(db, 'loans'), where('userId', '==', uid)),
          'loans'
        )
      : Promise.resolve([] as LoanRecord[]),
    isAdmin
      ? fetchCollection<StockAdjustmentLog>(collection(db, 'stockAdjustments'), 'stockAdjustments')
      : isStoreOwner
        ? fetchCollection<StockAdjustmentLog>(
            query(collection(db, 'stockAdjustments'), where('storeOwnerId', '==', uid)),
            'stockAdjustments'
          )
        : Promise.resolve([] as StockAdjustmentLog[]),
    fetchCollection<InternalApp>(collection(db, 'internalApps'), 'internalApps'),
    fetchCollection<StoreApplication>(
      isAdmin
        ? collection(db, 'storeApplications')
        : query(collection(db, 'storeApplications'), where('applicantId', '==', uid)),
      'storeApplications'
    ),
    fetchCollection<CatalogTemplate>(collection(db, 'catalogTemplates'), 'catalogTemplates'),
    fetchCollection<StoreCustomerCredit>(
      isAdmin
        ? collection(db, 'storeCustomerCredits')
        : query(collection(db, 'storeCustomerCredits'), where('userId', '==', uid)),
      'storeCustomerCredits'
    ),
  ]);

  const mergedOrdersMap = new Map<string, StoreOrder>();
  for (const o of boughtOrAllOrders) mergedOrdersMap.set(o.id, o);
  for (const o of sellerOrders) mergedOrdersMap.set(o.id, o);
  for (const o of ownedStoreOrders) mergedOrdersMap.set(o.id, o);
  for (const o of assignedDeliveryOrders) mergedOrdersMap.set(o.id, o);
  const orders = Array.from(mergedOrdersMap.values()).sort((a, b) =>
    (b.orderDateIso || '').localeCompare(a.orderDateIso || '')
  );

  const mergedProofsMap = new Map<string, PaymentProof>();
  for (const p of submittedOrAllProofs) mergedProofsMap.set(p.id, p);
  for (const p of receivedSellerProofs) mergedProofsMap.set(p.id, p);
  for (const p of storeOwnerProofs) mergedProofsMap.set(p.id, p);
  const proofs = Array.from(mergedProofsMap.values());

  const mergedListingsMap = new Map<string, MarketplaceListing>();
  for (const l of approvedOrAllListings) mergedListingsMap.set(l.id, l);
  for (const l of myListings) mergedListingsMap.set(l.id, l);
  const listings = Array.from(mergedListingsMap.values());

  return {
    items,
    stores,
    platformConfig,
    storeConfig,
    cashAssistanceSettings,
    sellerConfig,
    currentUser,
    users,
    coworkerProfiles,
    orders,
    proofs,
    suggestions,
    listings,
    ewalletPosts,
    loans,
    stockAdjustments: [...stockAdjustments].sort(
      (a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)
    ),
    internalApps,
    storeApplications,
    catalogTemplates,
    storeCustomerCredits,
    syncedAt: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}
