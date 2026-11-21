import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
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
} from '../data/seedData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ChatMessage,
  ChatThread,
  EWalletPost,
  InternalApp,
  LoanRecord,
  MarketplaceListing,
  NotificationItem,
  PautanganSettings,
  PaymentProof,
  StockAdjustmentLog,
  StoreConfig,
  StoreItem,
  StoreOrder,
  SuggestionItem,
  UserAccount,
  UserRole,
} from '../types';

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

    let existing: UserAccount | null = null;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        existing = snap.data() as UserAccount;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userPath);
    }

    const nextAccount: UserAccount = existing
      ? {
          ...existing,
          id: uid,
          email: existing.email || email,
          name: clampString(existing.name || googleName, 120),
          department: clampString(
            existing.department || (isBootstrapped ? 'Engineering Ops' : 'Department Staff'),
            120
          ),
          role: isBootstrapped ? UserRole.SuperAdmin : existing.role,
          pautanganEnabled: isBootstrapped ? true : Boolean(existing.pautanganEnabled),
          pautanganLimit: isBootstrapped
            ? Math.max(Number(existing.pautanganLimit || 0), 10000)
            : Number(existing.pautanganLimit ?? 0),
          avatarInitials: makeInitials(existing.name || googleName),
          avatarUrl: googleAvatar || existing.avatarUrl || '',
          debtBalance: Number(existing.debtBalance ?? 0),
          totalSpent: Number(existing.totalSpent ?? 0),
        }
      : {
          id: uid,
          name: clampString(googleName, 120),
          email,
          department: isBootstrapped ? 'Engineering Ops' : 'Department Staff',
          role: isBootstrapped ? UserRole.SuperAdmin : UserRole.Member,
          debtBalance: 0,
          pautanganEnabled: isBootstrapped,
          pautanganLimit: isBootstrapped ? 10000 : 0,
          avatarInitials: makeInitials(googleName),
          avatarUrl: googleAvatar,
          totalSpent: 0,
        };

    try {
      if (existing) {
        const patch: Record<string, unknown> = {
          name: nextAccount.name,
          department: nextAccount.department,
          avatarInitials: nextAccount.avatarInitials,
          avatarUrl: nextAccount.avatarUrl || '',
          updatedAt: nowIso,
        };
        if (isBootstrapped) {
          patch.role = nextAccount.role;
          patch.pautanganEnabled = nextAccount.pautanganEnabled;
          patch.pautanganLimit = nextAccount.pautanganLimit;
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
    // Check live server state for config/store first so deleting all storeItems
    // never triggers re-seeding of INITIAL_STORE_ITEMS or overwrites config/store.
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
    // Do not blindly overwrite Firestore if offline or server check failed
    console.warn('Skipping initial seed check:', err);
    return false;
  }

  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);

  batch.set(
    doc(db, 'config', 'store'),
    stripUndefined({
      ...INITIAL_STORE_CONFIG,
      dueDays: INITIAL_PAUTANGAN_SETTINGS.dueDays,
      updatedAt: nowIso,
    })
  );

  batch.set(
    doc(db, 'config', 'pautangan'),
    stripUndefined({
      ...INITIAL_PAUTANGAN_SETTINGS,
      updatedAt: nowIso,
    })
  );

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

export function subscribePublicStoreData(handlers: {
  onItems: (items: StoreItem[]) => void;
  onStoreConfig: (config: StoreConfig & { dueDays?: [number, number] }) => void;
}): Unsubscribe {
  let latestItems: StoreItem[] | null = null;
  let configExists: boolean | null = null;

  const emitItemsIfReady = () => {
    if (latestItems === null) return;
    if (latestItems.length > 0 || configExists === true) {
      handlers.onItems(latestItems);
    }
  };

  const unsubItems = onSnapshot(
    collection(db, 'storeItems'),
    (snap) => {
      latestItems = snap.docs.map((d) => d.data() as StoreItem);
      emitItemsIfReady();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'storeItems')
  );

  const unsubConfig = onSnapshot(
    doc(db, 'config', 'store'),
    (snap) => {
      configExists = snap.exists();
      if (snap.exists()) {
        handlers.onStoreConfig(snap.data() as StoreConfig & { dueDays?: [number, number] });
      }
      emitItemsIfReady();
    },
    (err) => handleFirestoreError(err, OperationType.GET, 'config/store')
  );

  return () => {
    unsubItems();
    unsubConfig();
  };
}

export function subscribeAuthenticatedData(
  params: {
    uid: string;
    role: UserRole;
    pautanganEnabled: boolean;
  },
  handlers: {
    onCurrentUser: (user: UserAccount) => void;
    onUsers: (users: UserAccount[]) => void;
    onCoworkerProfiles: (
      profiles: Array<{
        id: string;
        name: string;
        department: string;
        avatarInitials: string;
        avatarUrl?: string;
      }>
    ) => void;
    onOrders: (orders: StoreOrder[]) => void;
    onProofs: (proofs: PaymentProof[]) => void;
    onSuggestions: (suggestions: SuggestionItem[]) => void;
    onListings: (listings: MarketplaceListing[]) => void;
    onEWalletPosts: (posts: EWalletPost[]) => void;
    onPautanganSettings: (settings: PautanganSettings) => void;
    onLoans: (loans: LoanRecord[]) => void;
    onNotifications: (notifs: NotificationItem[]) => void;
    onInternalApps: (apps: InternalApp[]) => void;
    onChatThreads: (threads: ChatThread[]) => void;
    onStockAdjustments?: (logs: StockAdjustmentLog[]) => void;
  }
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const { uid, role, pautanganEnabled } = params;
  const isAdmin = role === UserRole.Admin || role === UserRole.SuperAdmin;
  const isSuperAdmin = role === UserRole.SuperAdmin;
  const isDelivery = role === UserRole.DeliveryStaff || isAdmin;

  // 1. Own User Document
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          handlers.onCurrentUser(snap.data() as UserAccount);
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
        const profiles = snap.docs.map(
          (d) =>
            d.data() as {
              id: string;
              name: string;
              department: string;
              avatarInitials: string;
              avatarUrl?: string;
            }
        );
        handlers.onCoworkerProfiles(profiles);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'coworkerProfiles')
    )
  );

  // 3. All Users & Stock Adjustment Audit Logs (Admin / SuperAdmin only)
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
  } else {
    handlers.onStockAdjustments?.([]);
  }

  // 4. Orders
  const ordersQuery = isDelivery
    ? collection(db, 'orders')
    : query(collection(db, 'orders'), where('userId', '==', uid));
  unsubs.push(
    onSnapshot(
      ordersQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as StoreOrder)
          .sort((a, b) => (b.orderDateIso || '').localeCompare(a.orderDateIso || ''));
        handlers.onOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    )
  );

  // 5. Payment Proofs
  const proofsQuery = isAdmin
    ? collection(db, 'paymentProofs')
    : query(collection(db, 'paymentProofs'), where('userId', '==', uid));
  unsubs.push(
    onSnapshot(
      proofsQuery,
      (snap) => {
        handlers.onProofs(snap.docs.map((d) => d.data() as PaymentProof));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'paymentProofs')
    )
  );

  // 6. Suggestions
  unsubs.push(
    onSnapshot(
      collection(db, 'suggestions'),
      (snap) => {
        handlers.onSuggestions(snap.docs.map((d) => d.data() as SuggestionItem));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'suggestions')
    )
  );

  // 7. Marketplace Listings (Admins see all; members see approved + their own pending)
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

  // 8. E-Wallet Posts
  unsubs.push(
    onSnapshot(
      collection(db, 'ewalletPosts'),
      (snap) => {
        handlers.onEWalletPosts(snap.docs.map((d) => d.data() as EWalletPost));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'ewalletPosts')
    )
  );

  // 9. Confidential Pautangan Settings & Loans (only if Admin or explicitly allowed)
  if (isAdmin || pautanganEnabled) {
    unsubs.push(
      onSnapshot(
        doc(db, 'config', 'pautangan'),
        (snap) => {
          if (snap.exists()) {
            handlers.onPautanganSettings(snap.data() as PautanganSettings);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'config/pautangan')
      )
    );

    const loansQuery = isAdmin
      ? collection(db, 'loans')
      : query(collection(db, 'loans'), where('userId', '==', uid));
    unsubs.push(
      onSnapshot(
        loansQuery,
        (snap) => {
          handlers.onLoans(snap.docs.map((d) => d.data() as LoanRecord));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'loans')
      )
    );
  } else {
    handlers.onLoans([]);
  }

  // 10. Notifications (strictly role- and user-scoped)
  {
    const targetBuckets = ['uid', 'all'];
    if (isDelivery) targetBuckets.push('delivery');
    if (isAdmin) targetBuckets.push('admins');
    if (isSuperAdmin) targetBuckets.push('super_admin');

    const bucketDocs = new Map<string, Array<NotificationItem & { createdAtMs?: number }>>();
    const emitNotifs = () => {
      const merged = new Map<string, NotificationItem & { createdAtMs?: number }>();
      for (const list of bucketDocs.values()) {
        for (const n of list) {
          merged.set(n.id, n);
        }
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

  // 11. Internal Apps
  unsubs.push(
    onSnapshot(
      collection(db, 'internalApps'),
      (snap) => {
        if (!snap.empty) {
          handlers.onInternalApps(snap.docs.map((d) => d.data() as InternalApp));
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'internalApps')
    )
  );

  // 12. Chat Threads + Messages Subcollections
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
    let aiThreads: Array<Omit<ChatThread, 'messages'>> = [];
    let channelThreads: Array<Omit<ChatThread, 'messages'>> = [];
    let dmThreads: Array<Omit<ChatThread, 'messages'>> = [];
    const mergeThreads = () => {
      const map = new Map<string, Omit<ChatThread, 'messages'>>();
      for (const t of aiThreads) map.set(t.id, t);
      for (const t of channelThreads) map.set(t.id, t);
      for (const t of dmThreads) map.set(t.id, t);
      syncMessageListeners(Array.from(map.values()));
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, 'chatThreads'), where('type', '==', 'ai')),
        (snap) => {
          aiThreads = snap.docs.map((d) => d.data() as Omit<ChatThread, 'messages'>);
          mergeThreads();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'chatThreads')
      )
    );
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
          dmThreads = snap.docs.map((d) => d.data() as Omit<ChatThread, 'messages'>);
          mergeThreads();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'chatThreads')
      )
    );
  }

  return () => {
    for (const unsub of unsubs) unsub();
    for (const unsub of messageUnsubs.values()) unsub();
  };
}

// ---------- Mutation Helpers ----------

export async function saveStoreConfig(
  config: StoreConfig,
  dueDays: [number, number]
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'config', 'store'),
      stripUndefined({
        ...config,
        dueDays,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'config/store');
  }
}

export async function savePautanganSettings(
  settings: PautanganSettings
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'config', 'pautangan'),
      stripUndefined({
        ...settings,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    // Keep public store dueDays in sync
    await updateDoc(doc(db, 'config', 'store'), {
      dueDays: settings.dueDays,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'config/pautangan');
  }
}

export async function saveStoreItem(item: StoreItem): Promise<void> {
  try {
    await setDoc(
      doc(db, 'storeItems', item.id),
      stripUndefined({ ...item, updatedAt: new Date().toISOString() }),
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

export async function saveUserAccount(user: UserAccount): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await setDoc(
      doc(db, 'users', user.id),
      stripUndefined({ ...user, updatedAt: nowIso }),
      { merge: true }
    );
    await setDoc(
      doc(db, 'coworkerProfiles', user.id),
      stripUndefined({
        id: user.id,
        name: user.name,
        department: user.department,
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

export async function updateUserCheckoutTotals(
  userId: string,
  debtBalance: number,
  totalSpent: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      debtBalance,
      totalSpent,
      updatedAt: new Date().toISOString(),
    });
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
  voterNames: string[]
): Promise<void> {
  try {
    await updateDoc(doc(db, 'suggestions', suggestionId), {
      voterIds,
      voterNames,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `suggestions/${suggestionId}`);
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
  patch: Pick<EWalletPost, 'remainingAmount' | 'status' | 'fills' | 'comments'>
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
  unreadCount: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'chatThreads', threadId), {
      unreadCount,
      updatedAt: new Date().toISOString(),
    });
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
