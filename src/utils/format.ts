import { CommissionType, LoanInstallment } from '../types';

export function formatPHP(amount: number, showDecimals = false): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(value);
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
