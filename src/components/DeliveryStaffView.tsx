import React, { useMemo, useState } from 'react';
import {
  BellRing,
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
  StoreOrder,
  UserAccount,
  UserRole,
} from '../types';
import { formatPHP, isDateWithinPeriod } from '../utils/format';

interface DeliveryStaffViewProps {
  orders: StoreOrder[];
  currentUser: UserAccount | null;
  currentRole: UserRole;
  onUpdateDeliveryStatus: (
    orderId: string,
    status: 'Pending Dispatch' | 'Out for Delivery' | 'Delivered',
    cashCollected?: boolean
  ) => void;
  onNotifyCustomer: (order: StoreOrder) => void;
  onExitPreview?: () => void;
}

export const DeliveryStaffView: React.FC<DeliveryStaffViewProps> = ({
  orders,
  currentUser,
  currentRole,
  onUpdateDeliveryStatus,
  onNotifyCustomer,
  onExitPreview,
}) => {
  const [filter, setFilter] = useState<
    'active' | 'Pending Dispatch' | 'Out for Delivery' | 'Delivered' | 'delivery_only'
  >('active');
  const [commissionPeriod, setCommissionPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [banner, setBanner] = useState('');

  const canAccess =
    currentRole === UserRole.DeliveryStaff ||
    currentRole === UserRole.Admin ||
    currentRole === UserRole.SuperAdmin;

  // Commission & Cash Collection Dashboard strictly visible ONLY to Delivery Staff & Super Admin
  const canViewCommissionDashboard =
    currentRole === UserRole.DeliveryStaff || currentRole === UserRole.SuperAdmin;

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const ds = o.deliveryStatus ?? 'Pending Dispatch';
      if (filter === 'active') return ds !== 'Delivered';
      if (filter === 'delivery_only') return o.fulfillment === FulfillmentType.Delivery;
      return ds === filter;
    });
  }, [orders, filter]);

  const periodOrders = useMemo(() => {
    return orders.filter((o) => isDateWithinPeriod(o.orderDateIso, commissionPeriod));
  }, [orders, commissionPeriod]);

  // Delivery fee is 100% delivery staff commission
  const collectableDebtCommission = useMemo(() => {
    return periodOrders
      .filter(
        (o) =>
          o.fulfillment === FulfillmentType.Delivery &&
          o.paymentMethod === PaymentMethod.Debt
      )
      .reduce((sum, o) => sum + (o.deliveryCommission ?? o.deliveryFee ?? 0), 0);
  }, [periodOrders]);

  const paidNonDebtCommission = useMemo(() => {
    return periodOrders
      .filter(
        (o) =>
          o.fulfillment === FulfillmentType.Delivery &&
          o.paymentMethod !== PaymentMethod.Debt
      )
      .reduce((sum, o) => sum + (o.deliveryCommission ?? o.deliveryFee ?? 0), 0);
  }, [periodOrders]);

  const totalCashCollected = useMemo(() => {
    return periodOrders
      .filter((o) => o.paymentMethod === PaymentMethod.Cash && o.cashCollected)
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [periodOrders]);

  const pendingCashCollection = useMemo(() => {
    return periodOrders
      .filter((o) => o.paymentMethod === PaymentMethod.Cash && !o.cashCollected)
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [periodOrders]);

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center space-y-4">
        <ShieldAlert className="w-9 h-9 text-amber-600 dark:text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Delivery Staff Access Required
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          Only Delivery Staff, Admin, or Super Admin accounts can manage desk delivery runs, counter pickups, and cash-on-delivery collections.
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

  const pendingCount = orders.filter(
    (o) => (o.deliveryStatus ?? 'Pending Dispatch') === 'Pending Dispatch'
  ).length;
  const outCount = orders.filter((o) => o.deliveryStatus === 'Out for Delivery').length;
  const deliveredCount = orders.filter((o) => o.deliveryStatus === 'Delivered').length;

  const showToast = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(''), 4500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Delivery Staff Dispatch &amp; Commissions
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Runner: <strong className="text-stone-900 dark:text-stone-100">{currentUser?.name ?? 'Delivery Staff'}</strong> · Delivery fees go 100% to delivery staff commissions.
          </p>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Delivery Staff Commission &amp; Cash Collection Dashboard
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Visible only to Delivery Staff &amp; Super Admin · Delivery fee = 100% delivery staff commission.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 self-start">
              {(
                [
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
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    commissionPeriod === p.id
                      ? 'bg-teal-700 text-white'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">
                Collectable Commission on Delivery Fee (Debt)
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                {formatPHP(collectableDebtCommission, true)}
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                Delivery fees on Store Credit (Debt) orders
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">
                Total Collection on Cash ({commissionPeriod})
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {formatPHP(totalCashCollected, true)}
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                Pending COD to collect: {formatPHP(pendingCashCollection, true)}
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">
                Total Delivery Commission Earned
              </div>
              <div className="mt-1 text-2xl font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
                {formatPHP(collectableDebtCommission + paidNonDebtCommission, true)}
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                Cash/Digital Fee: {formatPHP(paidNonDebtCommission)} · Debt Fee: {formatPHP(collectableDebtCommission)}
              </div>
            </div>
          </div>
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
            New coworker Pickup and Desk Delivery orders appear here automatically.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-200 dark:divide-stone-800 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
          {filteredOrders.map((order) => {
            const ds = order.deliveryStatus ?? 'Pending Dispatch';
            const isCash = order.paymentMethod === PaymentMethod.Cash;
            const fee = order.deliveryCommission ?? order.deliveryFee ?? 0;
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
                    <span aria-hidden="true">·</span>
                    <span>{order.createdAt}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-stone-700 dark:text-stone-200">
                      {order.fulfillment}
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
                        ? order.deliveryNote || 'Office Floor Delivery'
                        : 'Pantry Counter B (Self-Pickup)'}
                    </span>
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
                  {ds !== 'Delivered' && (
                    <button
                      type="button"
                      onClick={() => {
                        onNotifyCustomer(order);
                        showToast(`Sent delivery arrival alert to ${order.userName}.`);
                      }}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#1F312E] cursor-pointer"
                    >
                      <BellRing className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      <span>Ping Customer</span>
                    </button>
                  )}

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
