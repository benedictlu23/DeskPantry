import {
  CommissionType,
  FulfillmentType,
  LoanInstallment,
  PaymentMethod,
  StoreCustomerCredit,
  StoreOrder,
} from '../types';

export const DEFAULT_STORE_ID = 'store-main';
export const DEFAULT_STORE_NAME = 'DeskPantry Flagship';
export const DEFAULT_STORE_OWNER_ID = 'u-benedict';

export function formatPHP(amount: number, showDecimals = false): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(value);
}

export function resolveOrderStoreId(order: Pick<StoreOrder, 'storeId'>): string {
  return order.storeId?.trim() || DEFAULT_STORE_ID;
}

export function resolveOrderStoreName(order: Pick<StoreOrder, 'storeName'>): string {
  return order.storeName?.trim() || DEFAULT_STORE_NAME;
}

export function resolveOrderPaymentType(
  order: Pick<StoreOrder, 'paymentType' | 'paymentMethod'>
): 'cash' | 'credit' | 'ewallet' {
  if (order.paymentType) return order.paymentType;
  if (order.paymentMethod === PaymentMethod.Debt) return 'credit';
  if (order.paymentMethod === PaymentMethod.Cash) return 'cash';
  return 'ewallet';
}

export function isOrderPendingAdminConfirmation(order: StoreOrder): boolean {
  return (
    order.status === 'Pending Admin Review' ||
    order.status === 'Pending Payment Proof' ||
    order.deliveryStatus === 'Pending Admin Approval'
  );
}

export function isOrderPendingSellerConfirmation(order: StoreOrder): boolean {
  return (
    order.source === 'marketplace' &&
    (order.status === 'Pending Seller Confirmation' ||
      order.deliveryStatus === 'Pending Seller Approval')
  );
}

export function isApprovedDeliveryOrder(order: StoreOrder): boolean {
  if (order.source === 'marketplace') return false;
  if (order.fulfillment !== FulfillmentType.Delivery) return false;
  if (
    order.status === 'Pending Admin Review' ||
    order.status === 'Pending Payment Proof' ||
    order.status === 'Pending Seller Confirmation' ||
    order.status === 'Rejected'
  ) {
    return false;
  }
  if (
    order.deliveryStatus === 'Pending Admin Approval' ||
    order.deliveryStatus === 'Pending Seller Approval' ||
    order.deliveryStatus === 'Cancelled'
  ) {
    return false;
  }
  return true;
}

export function formatBuyerWorkstation(order: {
  buyerDepartment?: string;
  buyerTableRow?: string;
  buyerTableNumber?: string;
}): string {
  const parts: string[] = [];
  if (order.buyerDepartment?.trim()) parts.push(order.buyerDepartment.trim());
  if (order.buyerTableRow?.trim()) parts.push(`Row ${order.buyerTableRow.trim()}`);
  if (order.buyerTableNumber?.trim()) parts.push(`Table ${order.buyerTableNumber.trim()}`);
  return parts.join(' · ');
}

export function getOrderItemsSubtotal(order: StoreOrder): number {
  if (typeof order.subtotal === 'number' && Number.isFinite(order.subtotal)) {
    return order.subtotal;
  }
  return order.items.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);
}

export function getOrderRemainingDebt(order: StoreOrder): number {
  if (order.paymentMethod !== PaymentMethod.Debt || order.debtSettled) {
    return 0;
  }
  const subtotal = getOrderItemsSubtotal(order);
  const paid = Math.max(0, Number(order.debtPaidAmount ?? 0));
  return Math.max(0, subtotal - paid);
}

export function summarizeOrderItems(orders: StoreOrder[]): string {
  const counts = new Map<string, number>();
  for (const ord of orders) {
    for (const li of ord.items) {
      const cleanName = li.name.replace(' (Coworker Sale)', '').trim();
      counts.set(cleanName, (counts.get(cleanName) ?? 0) + li.quantity);
    }
  }
  return Array.from(counts.entries())
    .map(([name, qty]) => `${qty}× ${name}`)
    .join(', ');
}

export function computeCommission(
  price: number,
  type: CommissionType,
  value: number
): { ownerShare: number; sellerNet: number } {
  const safePrice = Math.max(0, price);
  const safeVal = Math.max(0, value);
  const ownerShare =
    type === CommissionType.Percentage
      ? Math.round((safePrice * Math.min(safeVal, 100)) / 100)
      : Math.min(safeVal, safePrice);
  return {
    ownerShare,
    sellerNet: Math.max(0, safePrice - ownerShare),
  };
}

export function getNextDueDateLabel(dueDays: [number, number]): string {
  const now = new Date();
  const day = now.getDate();
  const sorted = [...dueDays].sort((a, b) => a - b);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const nextInMonth = sorted.find((d) => d >= day);
  if (nextInMonth !== undefined) {
    return `${monthNames[now.getMonth()]} ${nextInMonth}`;
  }
  const nextMonth = (now.getMonth() + 1) % 12;
  return `${monthNames[nextMonth]} ${sorted[0]}`;
}

export function buildLoanInstallments(
  loanId: string,
  totalPayable: number,
  months: number,
  startIso: string,
  dueDay = 30
): LoanInstallment[] {
  const count = Math.max(1, months);
  const baseAmt = Math.floor(totalPayable / count);
  const remainder = totalPayable - baseAmt * count;
  const startDate = new Date(startIso || Date.now());

  return Array.from({ length: count }, (_, idx) => {
    const due = new Date(startDate);
    due.setMonth(due.getMonth() + idx + 1);
    const maxDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
    due.setDate(Math.min(dueDay, maxDay));
    return {
      id: `${loanId}-inst-${idx + 1}`,
      termNumber: idx + 1,
      totalTerms: count,
      dueDate: due.toISOString().slice(0, 10),
      amount: idx === count - 1 ? baseAmt + remainder : baseAmt,
      status: 'Upcoming' as const,
    };
  });
}

export function isDateWithinPeriod(
  isoDate: string,
  period: 'day' | 'week' | 'month' | 'year' | 'all'
): boolean {
  if (period === 'all') return true;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return true;
  const now = new Date();
  if (period === 'day') {
    return (
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth() &&
      target.getDate() === now.getDate()
    );
  }
  const diffMs = now.getTime() - target.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (period === 'week') return diffDays <= 7 && diffDays >= -1;
  if (period === 'month') {
    return (
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth()
    );
  }
  if (period === 'year') {
    return target.getFullYear() === now.getFullYear();
  }
  return true;
}

export function isDateInCutoffWindow(
  isoDate: string,
  period: 'day' | 'week' | 'month' | 'year' | 'all',
  cutoff: 'all' | '1-15' | '16-end'
): boolean {
  if (!isDateWithinPeriod(isoDate, period)) return false;
  if (cutoff === 'all') return true;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return true;
  const dom = target.getDate();
  return cutoff === '1-15' ? dom <= 15 : dom >= 16;
}

export interface BuyerStoreDebtEntry {
  storeId: string;
  storeName: string;
  storeOwnerId: string;
  balance: number;
  creditOrdersRemaining: number;
}

export function computeBuyerStoreDebts(params: {
  userId: string;
  fallbackDebtBalance: number;
  storeDebtBalances?: Record<string, number>;
  customerCredits: StoreCustomerCredit[];
  orders: StoreOrder[];
  stores: { id: string; name: string; ownerId: string }[];
}): { totalDebt: number; byStore: BuyerStoreDebtEntry[] } {
  const { userId, fallbackDebtBalance, storeDebtBalances, customerCredits, orders, stores } = params;
  const storeLookup = new Map(stores.map((s) => [s.id, s]));
  const map = new Map<string, BuyerStoreDebtEntry>();

  const ensureEntry = (storeId: string) => {
    const existing = map.get(storeId);
    if (existing) return existing;
    const store = storeLookup.get(storeId);
    const entry: BuyerStoreDebtEntry = {
      storeId,
      storeName: store?.name || (storeId === DEFAULT_STORE_ID ? DEFAULT_STORE_NAME : storeId),
      storeOwnerId: store?.ownerId || DEFAULT_STORE_OWNER_ID,
      balance: 0,
      creditOrdersRemaining: 0,
    };
    map.set(storeId, entry);
    return entry;
  };

  const userCredits = customerCredits.filter((c) => c.userId === userId);
  for (const credit of userCredits) {
    const entry = ensureEntry(credit.storeId);
    if (credit.storeName) entry.storeName = credit.storeName;
    if (credit.storeOwnerId) entry.storeOwnerId = credit.storeOwnerId;
    entry.balance = Math.max(0, Number(credit.balance ?? 0));
  }

  if (storeDebtBalances) {
    for (const [storeId, bal] of Object.entries(storeDebtBalances)) {
      if (!userCredits.some((c) => c.storeId === storeId)) {
        const entry = ensureEntry(storeId);
        entry.balance = Math.max(0, Number(bal ?? 0));
      }
    }
  }

  for (const ord of orders) {
    if (ord.userId !== userId || ord.source !== 'store') continue;
    if (ord.paymentMethod !== PaymentMethod.Debt || ord.status === 'Rejected') continue;
    const sid = resolveOrderStoreId(ord);
    const entry = ensureEntry(sid);
    entry.creditOrdersRemaining += getOrderRemainingDebt(ord);
  }

  if (map.size === 0 && fallbackDebtBalance > 0) {
    const entry = ensureEntry(DEFAULT_STORE_ID);
    entry.balance = Math.max(0, fallbackDebtBalance);
  }

  const byStore = Array.from(map.values()).filter(
    (entry) => entry.balance > 0 || entry.creditOrdersRemaining > 0
  );
  const totalDebt =
    byStore.length > 0
      ? byStore.reduce((sum, entry) => sum + entry.balance, 0)
      : Math.max(0, fallbackDebtBalance);

  return { totalDebt, byStore };
}
