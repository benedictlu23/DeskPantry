import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  MapPin,
  PackageCheck,
  ShieldAlert,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  FulfillmentType,
  PaymentMethod,
  PlatformConfig,
  StoreOrder,
  StoreProfile,
  UserAccount,
  UserRole,
} from '../types';
import {
  DEFAULT_STORE_ID,
  formatBuyerWorkstation,
  formatPHP,
  isApprovedDeliveryOrder,
  isDateInCutoffWindow,
  resolveOrderPaymentType,
  resolveOrderStoreId,
  resolveOrderStoreName,
} from '../utils/format';

interface DeliveryStaffViewProps {
  orders: StoreOrder[];
  stores?: StoreProfile[];
  platformConfig?: PlatformConfig;
  currentUser: UserAccount | null;
  currentRole: UserRole;
  onUpdateDeliveryStatus: (
    orderId: string,
    status: 'Pending Dispatch' | 'Out for Delivery' | 'Delivered',
    cashCollected?: boolean
  ) => void;
  onExitPreview?: () => void;
}

interface StoreBreakdownRow {
  storeId: string;
  storeName: string;
  orderCount: number;
  deliveredCount: number;
  collectedCash: number;
  paidCommission: number;
  futureCollectableCommission: number;
  totalCommission: number;
}

export const DeliveryStaffView: React.FC<DeliveryStaffViewProps> = ({
  orders,
  stores = [],
  platformConfig,
  currentUser,
  currentRole,
  onUpdateDeliveryStatus,
  onExitPreview,
}) => {
  const [filter, setFilter] = useState<
    'active' | 'Pending Dispatch' | 'Out for Delivery' | 'Delivered' | 'delivery_only'
  >('active');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [commissionPeriod, setCommissionPeriod] = useState<
    'day' | 'week' | 'month' | 'year' | 'all'
  >('month');
  const [cutoffFilter, setCutoffFilter] = useState<'all' | '1-15' | '16-end'>('all');
  const [banner, setBanner] = useState('');

  const canAccess =
    currentRole === UserRole.DeliveryStaff ||
    currentRole === UserRole.Admin ||
    currentRole === UserRole.SuperAdmin;

  // Commission & Cash Collection Dashboard visible to Delivery Staff & Super Admin
  const canViewCommissionDashboard =
    currentRole === UserRole.DeliveryStaff || currentRole === UserRole.SuperAdmin;

  const assignedStoreIdSet = useMemo(() => {
    const set = new Set<string>(currentUser?.assignedStoreIds ?? []);
    for (const s of stores) {
      if (currentUser?.id && (s.assignedDeliveryStaffIds ?? []).includes(currentUser.id)) {
        set.add(s.id);
      }
    }
    return set;
  }, [currentUser?.id, currentUser?.assignedStoreIds, stores]);

  const dispatchableOrders = useMemo(() => {
    const approved = orders.filter(isApprovedDeliveryOrder);
    if (currentRole !== UserRole.DeliveryStaff) {
      return approved;
    }
    const uid = currentUser?.id ?? '';
    return approved.filter((o) => {
      const sid = resolveOrderStoreId(o);
      if (o.assignedRunnerId && o.assignedRunnerId === uid) return true;
      if ((o.assignedDeliveryStaffIds ?? []).includes(uid)) return true;
      if (assignedStoreIdSet.has(sid)) return true;
      return false;
    });
  }, [orders, currentRole, currentUser?.id, assignedStoreIdSet]);

  const storeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of stores) {
      if (currentRole !== UserRole.DeliveryStaff || assignedStoreIdSet.has(s.id)) {
        map.set(s.id, s.name);
      }
    }
    for (const o of dispatchableOrders) {
      const sid = resolveOrderStoreId(o);
      if (!map.has(sid)) {
        map.set(sid, resolveOrderStoreName(o));
      }
    }
    if (map.size === 0 && stores.length > 0) {
      map.set(stores[0].id || DEFAULT_STORE_ID, stores[0].name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [stores, dispatchableOrders, currentRole, assignedStoreIdSet]);

  const storeScopedOrders = useMemo(() => {
    if (storeFilter === 'all') return dispatchableOrders;
    return dispatchableOrders.filter((o) => resolveOrderStoreId(o) === storeFilter);
  }, [dispatchableOrders, storeFilter]);

  const filteredOrders = useMemo(() => {
    return storeScopedOrders.filter((o) => {
      const ds = o.deliveryStatus ?? 'Pending Dispatch';
      if (filter === 'active') return ds !== 'Delivered';
      if (filter === 'delivery_only') return o.fulfillment === FulfillmentType.Delivery;
      return ds === filter;
    });
  }, [storeScopedOrders, filter]);

  const periodOrders = useMemo(() => {
    return storeScopedOrders.filter((o) =>
      isDateInCutoffWindow(o.orderDateIso, commissionPeriod, cutoffFilter)
    );
  }, [storeScopedOrders, commissionPeriod, cutoffFilter]);

  const getOrderCommission = (o: StoreOrder) =>
    o.deliveryCommission ?? o.deliveryFee ?? 0;

  // Future Collectable Commission: delivery fees on unsettled Store Credit orders
  const futureCollectableCommission = useMemo(() => {
    return periodOrders
      .filter(
        (o) =>
          o.fulfillment === FulfillmentType.Delivery &&
          resolveOrderPaymentType(o) === 'credit' &&
          !o.debtSettled
      )
      .reduce((sum, o) => sum + getOrderCommission(o), 0);
  }, [periodOrders]);

  // Paid / Non-Debt Commissions: delivery fees on Cash, E-Wallet, or Settled Credit orders
  const paidNonDebtCommission = useMemo(() => {
    return periodOrders
      .filter(
        (o) =>
          o.fulfillment === FulfillmentType.Delivery &&
          (resolveOrderPaymentType(o) !== 'credit' || Boolean(o.debtSettled))
      )
      .reduce((sum, o) => sum + getOrderCommission(o), 0);
  }, [periodOrders]);

  const totalCashCollected = useMemo(() => {
    return periodOrders
      .filter(
        (o) =>
          (o.paymentMethod === PaymentMethod.Cash || resolveOrderPaymentType(o) === 'cash') &&
          o.cashCollected
      )
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [periodOrders]);

  const pendingCashCollection = useMemo(() => {
    return periodOrders
      .filter(
        (o) =>
          (o.paymentMethod === PaymentMethod.Cash || resolveOrderPaymentType(o) === 'cash') &&
          !o.cashCollected
      )
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [periodOrders]);

  const perStoreBreakdown = useMemo<StoreBreakdownRow[]>(() => {
    const map = new Map<string, StoreBreakdownRow>();
    for (const o of periodOrders) {
      const sid = resolveOrderStoreId(o);
      const sname = resolveOrderStoreName(o);
      const existing = map.get(sid) ?? {
        storeId: sid,
        storeName: sname,
        orderCount: 0,
        deliveredCount: 0,
        collectedCash: 0,
        paidCommission: 0,
        futureCollectableCommission: 0,
        totalCommission: 0,
      };
      existing.orderCount += 1;
      if (o.deliveryStatus === 'Delivered') existing.deliveredCount += 1;
      const isCash =
        o.paymentMethod === PaymentMethod.Cash || resolveOrderPaymentType(o) === 'cash';
      if (isCash && o.cashCollected) {
        existing.collectedCash += o.totalAmount;
      }
      if (o.fulfillment === FulfillmentType.Delivery) {
        const fee = getOrderCommission(o);
        const isUnsettledCredit =
          resolveOrderPaymentType(o) === 'credit' && !o.debtSettled;
        if (isUnsettledCredit) {
          existing.futureCollectableCommission += fee;
        } else {
          existing.paidCommission += fee;
        }
        existing.totalCommission += fee;
      }
      map.set(sid, existing);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalCommission - a.totalCommission
    );
  }, [periodOrders]);

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center space-y-4">
        <ShieldAlert className="w-9 h-9 text-amber-600 dark:text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Delivery Staff Access Required
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          Only Delivery Staff, Admin, or Super Admin accounts can manage desk delivery runs, pick-up orders, and cash-on-delivery collections.
        </p>
        {onExitPreview && (
          <button
            type="button"
            onClick={onExitPreview}
            className="min-h-[44px] rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
          >
            Exit Role Preview
          </button>
        )}
      </div>
    );
  }

  const pendingCount = storeScopedOrders.filter(
    (o) => (o.deliveryStatus ?? 'Pending Dispatch') === 'Pending Dispatch'
  ).length;
  const outCount = storeScopedOrders.filter(
    (o) => o.deliveryStatus === 'Out for Delivery'
  ).length;
  const deliveredCount = storeScopedOrders.filter(
    (o) => o.deliveryStatus === 'Delivered'
  ).length;

  const showToast = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(''), 4500);
  };

  const commissionRateLabel = platformConfig?.deliveryCommissionRate ?? 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Delivery Staff Dispatch &amp; Commissions
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Runner:{' '}
            <strong className="text-stone-900 dark:text-stone-100">
              {currentUser?.name ?? 'Delivery Staff'}
            </strong>{' '}
            · Delivery fees credit {commissionRateLabel}% to delivery staff commissions across assigned stores.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Building2 className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            aria-label="Filter delivery orders by store"
            className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 py-1.5 text-xs font-semibold text-stone-800 dark:text-stone-100"
          >
            <option value="all">All Assigned Stores ({storeOptions.length})</option>
            {storeOptions.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {banner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {/* Delivery Staff & Super Admin Exclusive Commission + Cash Collection Dashboard */}
      {canViewCommissionDashboard && (
        <section className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/25 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Multi-Store Commission &amp; Cash Collection Dashboard
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Filter by period and cutoff window (1st–15th or 16th–End of Month).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800">
                {(
                  [
                    { id: 'day', label: 'Today' },
                    { id: 'week', label: 'Week' },
                    { id: 'month', label: 'Month' },
                    { id: 'year', label: 'Year' },
                    { id: 'all', label: 'All' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCommissionPeriod(p.id)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      commissionPeriod === p.id
                        ? 'bg-teal-700 text-white'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <select
                value={cutoffFilter}
                onChange={(e) => setCutoffFilter(e.target.value as typeof cutoffFilter)}
                aria-label="Filter commission by payroll cutoff window"
                className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] px-3 text-xs font-semibold text-stone-700 dark:text-stone-200"
              >
                <option value="all">Cutoff: Full Period</option>
                <option value="1-15">Cutoff: 1st – 15th</option>
                <option value="16-end">Cutoff: 16th – End</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">
                Collected Cash &amp; Paid Commissions
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {formatPHP(paidNonDebtCommission, true)}
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                COD Collected: {formatPHP(totalCashCollected, true)} · Pending COD:{' '}
                {formatPHP(pendingCashCollection, true)}
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">
                Future Collectable Commission
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                {formatPHP(futureCollectableCommission, true)}
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                Unsettled Store Credit delivery fees
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">
                Total Period Commission
              </div>
              <div className="mt-1 text-2xl font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
                {formatPHP(futureCollectableCommission + paidNonDebtCommission, true)}
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                {periodOrders.length} orders across {perStoreBreakdown.length} store
                {perStoreBreakdown.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {/* Per-Store Earnings Breakdown */}
          {perStoreBreakdown.length > 0 && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#172523] flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  Per-Store Earnings Breakdown
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  {commissionPeriod.toUpperCase()} · {cutoffFilter === 'all' ? 'All Days' : cutoffFilter}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                      <th className="py-2.5 px-4 font-semibold">Store</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Deliveries</th>
                      <th className="py-2.5 px-4 font-semibold text-right">COD Collected</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Paid Comm.</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Future Collectable</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Total Comm.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                    {perStoreBreakdown.map((row) => (
                      <tr key={row.storeId}>
                        <td className="py-2.5 px-4 font-semibold text-stone-900 dark:text-stone-100">
                          {row.storeName}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-stone-600 dark:text-stone-300">
                          {row.deliveredCount}/{row.orderCount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                          {formatPHP(row.collectedCash, true)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                          {formatPHP(row.paidCommission, true)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                          {formatPHP(row.futureCollectableCommission, true)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-teal-700 dark:text-teal-400">
                          {formatPHP(row.totalCommission, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Dispatch Queue Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Pending Dispatch</div>
          <div className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
            {pendingCount}
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">Ready to pack &amp; run</div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Out for Delivery</div>
          <div className="mt-1 text-2xl font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
            {outCount}
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">En route to desks</div>
        </div>
        <div className="col-span-2 lg:col-span-1 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Delivered / Completed</div>
          <div className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {deliveredCount}
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">Handed to coworkers</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'active', label: `Active Queue (${pendingCount + outCount})` },
          { id: 'Pending Dispatch', label: `Pending (${pendingCount})` },
          { id: 'Out for Delivery', label: `Out for Delivery (${outCount})` },
          { id: 'delivery_only', label: 'Desk Delivery Only' },
          { id: 'Delivered', label: `Delivered (${deliveredCount})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id as typeof filter)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              filter === f.id
                ? 'bg-[#0F2E2A] dark:bg-teal-600 text-white'
                : 'bg-white dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Order Queue */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center">
          <PackageCheck className="w-9 h-9 text-stone-300 dark:text-stone-700 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
            No orders in this queue.
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Approved Desk Delivery orders from your assigned stores appear here once confirmed &amp; released on Sales Order. Pick Up and unapproved orders never enter the dispatch queue.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-200 dark:divide-stone-800 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
          {filteredOrders.map((order) => {
            const ds = order.deliveryStatus ?? 'Pending Dispatch';
            const isCash = order.paymentMethod === PaymentMethod.Cash;
            const fee = getOrderCommission(order);
            const storeLabel = resolveOrderStoreName(order);
            return (
              <div
                key={order.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                      {order.id}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-semibold">
                      {storeLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{order.createdAt}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-stone-700 dark:text-stone-200">
                      {order.fulfillment === FulfillmentType.Pickup ? 'Pick Up' : 'Delivery'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        ds === 'Delivered'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : ds === 'Out for Delivery'
                            ? 'text-teal-700 dark:text-teal-400'
                            : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {ds}
                    </span>
                  </div>

                  <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {order.userName} —{' '}
                    <span className="font-mono tabular-nums">
                      {formatPHP(order.totalAmount, true)}
                    </span>
                    {fee > 0 && (
                      <span className="ml-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
                        (+{formatPHP(fee)} Runner Commission)
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-stone-700 dark:text-stone-300">
                    {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-stone-400 pt-0.5">
                    <span className="inline-flex items-center gap-1 font-medium text-stone-800 dark:text-stone-200">
                      <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      {order.fulfillment === FulfillmentType.Delivery
                        ? formatBuyerWorkstation(order) || order.deliveryNote || 'Office Floor Delivery'
                        : 'Pick Up'}
                    </span>
                    {order.fulfillment === FulfillmentType.Delivery &&
                      formatBuyerWorkstation(order) &&
                      order.deliveryNote &&
                      order.deliveryNote !== formatBuyerWorkstation(order) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Note: {order.deliveryNote}</span>
                        </>
                      )}
                    <span aria-hidden="true">·</span>
                    <span>
                      Runner: <strong>{order.assignedRunner || 'Unassigned'}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Payment: <strong>{order.paymentMethod}</strong>
                      {isCash && (order.cashCollected ? ' (Cash Collected)' : ' (Collect Cash)')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {ds === 'Pending Dispatch' && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateDeliveryStatus(order.id, 'Out for Delivery');
                        showToast(`${order.id} marked Out for Delivery.`);
                      }}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Start Delivery</span>
                    </button>
                  )}

                  {ds !== 'Delivered' && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateDeliveryStatus(
                          order.id,
                          'Delivered',
                          isCash ? true : order.cashCollected
                        );
                        showToast(
                          `${order.id} marked Delivered${isCash ? ' & Cash Collected' : ''}.`
                        );
                      }}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-stone-900 dark:bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-emerald-800 cursor-pointer"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>{isCash ? 'Delivered + Collect Cash' : 'Confirm Delivered'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
