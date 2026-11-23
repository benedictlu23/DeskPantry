import {
  CommissionType,
  FulfillmentType,
  LoanInstallment,
  PaymentMethod,
  StoreOrder,
} from '../types';

export function formatPHP(amount: number, showDecimals = false): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(value);
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
  period: 'week' | 'month' | 'year' | 'all'
): boolean {
  if (period === 'all') return true;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return true;
  const now = new Date();
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
