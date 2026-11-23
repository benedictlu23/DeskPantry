import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  History,
  Plus,
  RefreshCw,
  ScanBarcode,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { ITEM_IMAGE_PRESETS, OWNER_BASE_COMMISSION_EARNED } from '../data/seedData';
import {
  CommissionType,
  FulfillmentType,
  LoanRecord,
  MarketplaceListing,
  PautanganSettings,
  PaymentMethod,
  PaymentMethodConfig,
  PaymentProof,
  StockAdjustmentLog,
  StoreConfig,
  StoreItem,
  StoreOrder,
  UserAccount,
  UserRole,
} from '../types';
import { exportExcelWorkbook, exportPdfReport } from '../utils/exportReports';
import {
  computeCommission,
  formatPHP,
  isOrderPendingAdminConfirmation,
} from '../utils/format';
import { compressImageFileToDataUrl } from '../utils/image';
import { AdminRestockPanel } from './AdminRestockPanel';
import { AdminSalesOrderPanel } from './AdminSalesOrderPanel';
import { AdminStockAdjustmentPanel } from './AdminStockAdjustmentPanel';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { PaymentMethodCard } from './PaymentMethodCard';

interface AdminConsoleViewProps {
  currentRole: UserRole;
  currentUser: UserAccount | null;
  users: UserAccount[];
  items: StoreItem[];
  orders: StoreOrder[];
  proofs: PaymentProof[];
  listings: MarketplaceListing[];
  loans: LoanRecord[];
  pautanganSettings: PautanganSettings;
  storeConfig: StoreConfig;
  ownerTotalCommission: number;
  onReviewProof: (proofId: string, decision: 'approved' | 'rejected') => void;
  onReviewListing: (listingId: string, decision: 'approved' | 'rejected') => void;
  onDeleteListing: (listingId: string) => Promise<void> | void;
  onUpdateDueDays: (day1: number, day2: number) => void;
  onSendReminders: () => void;
  onUpdatePautanganGlobal: (enabled: boolean, rate: number) => void;
  onUpdatePautanganTerms: (terms: number[]) => void;
  onToggleUserPautangan: (userId: string, enabled: boolean, limit: number) => void;
  onUpdateUserRole: (userId: string, role: UserRole) => void;
  onAddDeliveryStaff: (name: string, email: string, department: string) => void;
  onUpdateStoreConfig: (next: StoreConfig) => void;
  onAddCategory: (category: string) => void;
  onEditCategory: (oldName: string, newName: string) => void;
  onRemoveCategory: (category: string) => Promise<void> | void;
  onRestockItem: (
    itemId: string,
    amount: number,
    options?: {
      unitCost?: number;
      sellingPrice?: number;
      note?: string;
      barcode?: string;
    }
  ) => Promise<void> | void;
  onUpdateItemBarcode: (itemId: string, barcode: string) => Promise<void> | void;
  onUpdateItemPricing: (
    itemId: string,
    sellingPrice: number,
    costPrice: number,
    note?: string
  ) => void;
  onDeleteItem: (itemId: string) => Promise<void> | void;
  onAddItem: (item: {
    name: string;
    category: string;
    description: string;
    price: number;
    costPrice: number;
    stock: number;
    image?: string;
    barcode?: string;
  }) => Promise<void> | void;
  onCreateManualSale: (payload: {
    customerMode: 'walkin' | 'coworker';
    customerId?: string;
    customerName: string;
    items: Array<{ itemId: string; quantity: number }>;
    fulfillment: FulfillmentType;
    deliveryNote?: string;
    paymentMethod: string;
  }) => Promise<StoreOrder>;
  stockAdjustments: StockAdjustmentLog[];
  onAdjustStock: (payload: {
    itemId: string;
    adjustmentType: 'add' | 'deduct' | 'recount';
    quantityOrCount: number;
    reason: string;
    note?: string;
  }) => Promise<StockAdjustmentLog>;
  onApprovePendingOrder: (orderId: string) => Promise<void>;
  onRejectPendingOrder: (orderId: string) => Promise<void>;
  onSyncAllData: () => Promise<{
    syncedAt: string;
    orderCount: number;
    itemCount: number;
    ownerCommission: number;
  }>;
  requestedSubTab?: {
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
  } | null;
  onExitPreview?: () => void;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  currentRole,
  currentUser,
  users,
  items,
  orders,
  proofs,
  listings,
  loans,
  pautanganSettings,
  storeConfig,
  ownerTotalCommission,
  onReviewProof,
  onReviewListing,
  onDeleteListing,
  onUpdateDueDays,
  onSendReminders,
  onUpdatePautanganGlobal,
  onUpdatePautanganTerms,
  onToggleUserPautangan,
  onUpdateUserRole,
  onAddDeliveryStaff,
  onUpdateStoreConfig,
  onAddCategory,
  onEditCategory,
  onRemoveCategory,
  onRestockItem,
  onUpdateItemBarcode,
  onUpdateItemPricing,
  onDeleteItem,
  onAddItem,
  onCreateManualSale,
  stockAdjustments,
  onAdjustStock,
  onApprovePendingOrder,
  onRejectPendingOrder,
  onSyncAllData,
  requestedSubTab,
  onExitPreview,
}) => {
  const [subTab, setSubTab] = useState<
    | 'items'
    | 'restock'
    | 'stockAdjustments'
    | 'salesOrder'
    | 'config'
    | 'pautangan'
    | 'superadmin'
    | 'proofs'
    | 'marketplace'
    | 'reports'
  >(requestedSubTab?.tab ?? 'items');
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    if (requestedSubTab?.tab) {
      setSubTab(requestedSubTab.tab);
    }
  }, [requestedSubTab]);

  // Store Config & Due Days State
  const [day1Input, setDay1Input] = useState(String(pautanganSettings.dueDays[0]));
  const [day2Input, setDay2Input] = useState(String(pautanganSettings.dueDays[1]));
  const [rateInput, setRateInput] = useState(String(pautanganSettings.monthlyInterestRate));
  const [newTermMonths, setNewTermMonths] = useState('12');
  const [announcement, setAnnouncement] = useState(storeConfig.storeAnnouncement);
  const [deliveryEnabled, setDeliveryEnabled] = useState(storeConfig.deliveryEnabled);
  const [deliveryFee, setDeliveryFee] = useState(String(storeConfig.deliveryFee));
  const [banner, setBanner] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  useEffect(() => {
    setDay1Input(String(pautanganSettings.dueDays[0]));
    setDay2Input(String(pautanganSettings.dueDays[1]));
    setRateInput(String(pautanganSettings.monthlyInterestRate));
  }, [pautanganSettings.dueDays, pautanganSettings.monthlyInterestRate]);

  useEffect(() => {
    setAnnouncement(storeConfig.storeAnnouncement);
    setDeliveryEnabled(storeConfig.deliveryEnabled);
    setDeliveryFee(String(storeConfig.deliveryFee));
  }, [storeConfig.storeAnnouncement, storeConfig.deliveryEnabled, storeConfig.deliveryFee]);

  // New store item state
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState<string>(storeConfig.categories[0] ?? 'Snacks & Pastries');
  const [newPrice, setNewPrice] = useState('90');
  const [newCost, setNewCost] = useState('55');
  const [newStock, setNewStock] = useState('15');
  const [newDesc, setNewDesc] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [isAddBarcodeScannerOpen, setIsAddBarcodeScannerOpen] = useState(false);
  const [newImage, setNewImage] = useState(ITEM_IMAGE_PRESETS[0].path);

  // Cost History Modal
  const [costHistoryItem, setCostHistoryItem] = useState<StoreItem | null>(null);
  const [editCostNote, setEditCostNote] = useState('');
  const [editCostInput, setEditCostInput] = useState('');
  const [editSellInput, setEditSellInput] = useState('');

  // Category CRUD state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');

  // Payment method add form
  const [newPmTitle, setNewPmTitle] = useState('');
  const [newPmType, setNewPmType] = useState<'digital' | 'cash' | 'debt'>('digital');
  const [newPmNumber, setNewPmNumber] = useState('');
  const [newPmName, setNewPmName] = useState('DeskPantry Ops');
  const [newPmIcon, setNewPmIcon] = useState('');
  const [newPmQr, setNewPmQr] = useState('');
  const [previewPmId, setPreviewPmId] = useState<string>('pm-gcash');

  // Add Delivery Staff state (Super Admin)
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDept, setStaffDept] = useState('Pantry Delivery & Logistics');

  const isAdmin = currentRole === UserRole.Admin || currentRole === UserRole.SuperAdmin;
  const isSuperAdmin = currentRole === UserRole.SuperAdmin;

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center space-y-4">
        <ShieldAlert className="w-9 h-9 text-amber-600 dark:text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Admin Configuration Restricted
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          The Admin &amp; Super Admin configuration workspace is hidden from public and coworker accounts.
        </p>
      </div>
    );
  }

  const pendingProofs = proofs.filter((p) => p.status === 'pending');
  const pendingListings = listings.filter((l) => l.approvalStatus === 'pending');
  const pendingOrdersCount = orders.filter(isOrderPendingAdminConfirmation).length;
  const marketplaceOrders = orders.filter((o) => (o.commissionEarned ?? 0) > 0);
  const marketplaceCommissionSum = marketplaceOrders.reduce(
    (sum, o) => sum + (o.commissionEarned ?? 0),
    0
  );
  const totalStoreDebt = users.reduce((s, u) => s + u.debtBalance, 0);
  const totalLoanDebt = loans
    .filter((l) => l.status === 'Active')
    .reduce((s, l) => s + l.remainingBalance, 0);
  const totalCollectibles = totalStoreDebt + totalLoanDebt;

  const grossSalesRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalDeliveryFees = orders
    .filter((o) => o.fulfillment === FulfillmentType.Delivery)
    .reduce((s, o) => s + (o.deliveryCommission ?? o.deliveryFee ?? 0), 0);
  const totalCashCollected = orders
    .filter((o) => o.paymentMethod === PaymentMethod.Cash && o.cashCollected)
    .reduce((s, o) => s + o.totalAmount, 0);

  const topSaleableItems = [...items].sort(
    (a, b) => b.soldCount * b.price - a.soldCount * a.price
  );
  const topCustomers = [...users].sort((a, b) => b.totalSpent - a.totalSpent);

  const showToast = (msg: string) => {
    setErrorBanner('');
    setBanner(msg);
    setTimeout(() => setBanner(''), 4500);
  };

  const showErrorToast = (msg: string) => {
    setBanner('');
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(''), 6000);
  };

  const readFileAsDataUrl = (file: File, onLoad: (url: string) => void) => {
    void compressImageFileToDataUrl(file).then(onLoad);
  };

  const handleSaveStoreConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const d1 = Math.min(28, Math.max(1, Number(day1Input) || 15));
    const d2 = Math.min(31, Math.max(1, Number(day2Input) || 30));
    onUpdateDueDays(d1, d2);
    onUpdateStoreConfig({
      ...storeConfig,
      storeAnnouncement: announcement.trim(),
      deliveryEnabled,
      deliveryFee: Math.max(0, Number(deliveryFee) || 0),
    });
    showToast('Store configuration, delivery fee, and cutoff dates saved.');
  };

  const handleAddStoreItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await onAddItem({
        name: newName.trim(),
        category: newCat || storeConfig.categories[0] || 'Snacks & Pastries',
        price: Math.max(1, Number(newPrice) || 50),
        costPrice: Math.max(0, Number(newCost) || 30),
        stock: Math.max(1, Number(newStock) || 10),
        description: newDesc.trim() || 'Freshly added department pantry item.',
        image: newImage || undefined,
        barcode: newBarcode.trim() || undefined,
      });
      setNewName('');
      setNewDesc('');
      setNewBarcode('');
      showToast('New store item & initial cost history added to DeskPantry.');
    } catch {
      showErrorToast('Failed to register store item. Please check Admin permissions or connection.');
    }
  };

  const handleUpdatePaymentMethodField = (
    pmId: string,
    patch: Partial<PaymentMethodConfig>
  ) => {
    const nextMethods = storeConfig.paymentMethods.map((m) =>
      m.id === pmId ? { ...m, ...patch } : m
    );
    onUpdateStoreConfig({ ...storeConfig, paymentMethods: nextMethods });
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPmTitle.trim()) return;
    const created: PaymentMethodConfig = {
      id: `pm-${Date.now()}`,
      title: newPmTitle.trim(),
      type: newPmType,
      enabled: true,
      iconImage: newPmIcon || undefined,
      accountNumber: newPmNumber.trim() || undefined,
      accountName: newPmName.trim() || undefined,
      qrCodeImage: newPmQr || undefined,
      instructions:
        newPmType === 'digital'
          ? `Transfer via ${newPmTitle.trim()} and upload your payment proof.`
          : undefined,
    };
    onUpdateStoreConfig({
      ...storeConfig,
      paymentMethods: [...storeConfig.paymentMethods, created],
    });
    setNewPmTitle('');
    setNewPmNumber('');
    setNewPmIcon('');
    setNewPmQr('');
    setPreviewPmId(created.id);
    showToast(`Added payment method "${created.title}".`);
  };

  const handleExportExcel = () => {
    exportExcelWorkbook(`DeskPantry-Reports-${new Date().toISOString().slice(0, 10)}.xls`, [
      {
        name: 'Sales & Orders',
        headers: [
          'Order ID',
          'Date',
          'Customer',
          'Fulfillment',
          'Delivered By',
          'Payment Method',
          'Status',
          'Delivery Fee (PHP)',
          'Total (PHP)',
        ],
        rows: orders.map((o) => [
          o.id,
          o.createdAt,
          o.userName,
          o.fulfillment,
          o.assignedRunner || '-',
          o.paymentMethod,
          o.deliveryStatus || o.status,
          o.deliveryFee ?? 0,
          o.totalAmount,
        ]),
      },
      {
        name: 'Inventory & Cost History',
        headers: [
          'Item',
          'Category',
          'Unit Cost (PHP)',
          'Selling Price (PHP)',
          'Margin (PHP)',
          'Stock',
          'Sold',
          'Gross Revenue (PHP)',
        ],
        rows: items.map((i) => [
          i.name,
          i.category,
          i.costPrice,
          i.price,
          i.price - i.costPrice,
          i.stock,
          i.soldCount,
          i.price * i.soldCount,
        ]),
      },
      {
        name: 'Top Customers & Debt',
        headers: ['Customer', 'Department', 'Role', 'Store Debt (PHP)', 'Total Spent (PHP)'],
        rows: topCustomers.map((u) => [
          u.name,
          u.department,
          u.role,
          u.debtBalance,
          u.totalSpent,
        ]),
      },
      {
        name: 'Delivery Commissions',
        headers: [
          'Order ID',
          'Date',
          'Customer',
          'Runner',
          'Payment Method',
          'Delivery Fee Commission (PHP)',
          'Cash Collected',
          'Delivery Status',
        ],
        rows: orders
          .filter((o) => o.fulfillment === FulfillmentType.Delivery)
          .map((o) => [
            o.id,
            o.createdAt,
            o.userName,
            o.assignedRunner || 'Unassigned',
            o.paymentMethod,
            o.deliveryCommission ?? o.deliveryFee ?? 0,
            o.cashCollected ? 'Yes' : 'No',
            o.deliveryStatus || 'Pending Dispatch',
          ]),
      },
      {
        name: 'Pautangan Loans',
        headers: [
          'Loan ID',
          'Coworker',
          'Principal (PHP)',
          'Term (Months)',
          'Rate (%)',
          'Total Payable (PHP)',
          'Remaining (PHP)',
          'Status',
        ],
        rows: loans.map((l) => [
          l.id,
          l.userName,
          l.principal,
          l.months,
          l.interestRate,
          l.totalPayable,
          l.remainingBalance,
          l.status,
        ]),
      },
      {
        name: 'Stock Adjustment Logs',
        headers: [
          'Date & Time',
          'Item',
          'Category',
          'Barcode',
          'Type',
          'Reason',
          'Previous Stock',
          'Delta',
          'New Stock',
          'Cost Impact (PHP)',
          'Adjusted By',
          'Note',
        ],
        rows: stockAdjustments.map((log) => [
          log.createdAt,
          log.itemName,
          log.itemCategory,
          log.barcode || '-',
          log.adjustmentType,
          log.reason,
          log.previousStock,
          log.delta,
          log.newStock,
          log.delta * (log.unitCostAtTime ?? 0),
          log.adjustedByName,
          log.note || '-',
        ]),
      },
    ]);
    showToast('Exported DeskPantry Excel workbook (.xls).');
  };

  const handleExportPdf = () => {
    exportPdfReport(
      `DeskPantry-Reports-${new Date().toISOString().slice(0, 10)}.pdf`,
      'DeskPantry Executive Operations & Financial Report',
      `Generated: ${new Date().toLocaleString()} | Role: ${currentRole}`,
      [
        {
          heading: '1. Executive Summary',
          lines: [
            `Gross Orders Value: PHP ${grossSalesRevenue.toFixed(2)} (${orders.length} orders)`,
            `Total Collectibles (Store Debt + Active Loans): PHP ${totalCollectibles.toFixed(2)}`,
            `Owner Marketplace Commission Share: PHP ${ownerTotalCommission.toFixed(2)}`,
            `Total Delivery Staff Commissions: PHP ${totalDeliveryFees.toFixed(2)}`,
            `Total Verified Cash Collected: PHP ${totalCashCollected.toFixed(2)}`,
          ],
        },
        {
          heading: '2. Most Saleable Items & Cost Margin',
          lines: topSaleableItems.map(
            (i, idx) =>
              `${idx + 1}. ${i.name} | Sold: ${i.soldCount} | Cost: PHP ${i.costPrice} | Price: PHP ${i.price} | Rev: PHP ${
                i.soldCount * i.price
              }`
          ),
        },
        {
          heading: '3. Top Customers & Open Balances',
          lines: topCustomers.map(
            (u, idx) =>
              `${idx + 1}. ${u.name} (${u.department}) | Spent: PHP ${u.totalSpent} | Open Debt: PHP ${u.debtBalance}`
          ),
        },
        {
          heading: '4. Delivery Staff Commissions (100% Delivery Fee)',
          lines: orders
            .filter((o) => o.fulfillment === FulfillmentType.Delivery)
            .map(
              (o) =>
                `${o.id} | ${o.assignedRunner || 'Runner'} | ${o.paymentMethod} | Fee Commission: PHP ${(
                  o.deliveryCommission ??
                  o.deliveryFee ??
                  0
                ).toFixed(2)} | ${o.deliveryStatus || 'Pending'}`
            ),
        },
        {
          heading: '5. Pautangan Cash Assistance Summary',
          lines: loans.map(
            (l) =>
              `${l.id} | ${l.userName} | ${l.months} mo @ ${l.interestRate}% | Total: PHP ${l.totalPayable} | Rem: PHP ${l.remainingBalance} | ${l.status}`
          ),
        },
        {
          heading: '6. Stock Adjustment History Logs',
          lines: stockAdjustments.slice(0, 40).map(
            (log) =>
              `${log.createdAt} | ${log.itemName} | ${log.adjustmentType.toUpperCase()} (${log.reason}) | ${log.previousStock} -> ${log.newStock} (${log.delta >= 0 ? `+${log.delta}` : log.delta}) | By ${log.adjustedByName}`
          ),
        },
      ]
    );
    showToast('Downloaded DeskPantry PDF report (.pdf).');
  };

  const latestHistoryItem = costHistoryItem
    ? items.find((i) => i.id === costHistoryItem.id) ?? costHistoryItem
    : null;

  const previewMethod =
    storeConfig.paymentMethods.find((m) => m.id === previewPmId) ??
    storeConfig.paymentMethods.find((m) => m.type === 'digital');

  const handleSyncAllClick = async () => {
    setIsSyncingAll(true);
    try {
      const res = await onSyncAllData();
      setLastSyncedAt(res.syncedAt);
      showToast(
        `Synced all live Firestore data at ${res.syncedAt} (${res.orderCount} orders, ${res.itemCount} items, Owner Share: ${formatPHP(res.ownerCommission, true)}).`
      );
    } catch (err) {
      showErrorToast(
        err instanceof Error ? err.message : 'Failed to sync Firestore data. Please check permissions.'
      );
    } finally {
      setIsSyncingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Admin &amp; Super Admin Configuration
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Manage store items, sales order approvals &amp; stock release, categories, payment methods, cash assistance, roles, delivery staff, and exportable reports.
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
          <button
            type="button"
            disabled={isSyncingAll}
            onClick={() => void handleSyncAllClick()}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>{isSyncingAll ? 'Syncing Firestore...' : 'Sync & Update All Data'}</span>
          </button>
          {lastSyncedAt && (
            <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
              Last server sync: {lastSyncedAt}
            </span>
          )}
        </div>
      </div>

      {banner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {errorBanner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm text-red-900 dark:text-red-200">
          <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Executive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Total Collectibles</div>
          <div className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {formatPHP(totalCollectibles, true)}
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            Store: {formatPHP(totalStoreDebt)} · Loans: {formatPHP(totalLoanDebt)}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Owner&apos;s Total Share</div>
          <div className="mt-1 text-xl font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
            {formatPHP(ownerTotalCommission, true)}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
            Base {formatPHP(OWNER_BASE_COMMISSION_EARNED)} + {formatPHP(marketplaceCommissionSum)} ({marketplaceOrders.length} marketplace orders)
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Pending Approvals</div>
          <div className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
            {pendingOrdersCount} Orders · {pendingProofs.length} Proofs
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            Sales Order &amp; Proof verification
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Pautangan Interest Rate</div>
          <div className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {pautanganSettings.monthlyInterestRate}% / mo
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            {users.filter((u) => u.pautanganEnabled).length} of {users.length} users enabled
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 overflow-x-auto">
        {[
          { id: 'items', label: 'Items & Categories' },
          { id: 'restock', label: 'Restock & Barcode' },
          { id: 'stockAdjustments', label: 'Stock Adjustment' },
          {
            id: 'salesOrder',
            label:
              pendingOrdersCount > 0
                ? `Sales Order (${pendingOrdersCount} Pending)`
                : 'Sales Order (Walk-In)',
          },
          { id: 'config', label: 'Store & Payments' },
          { id: 'pautangan', label: 'Cash Assistance' },
          { id: 'superadmin', label: 'Super Admin: Roles & Delivery' },
          { id: 'proofs', label: `Proofs & Reminders (${pendingProofs.length})` },
          { id: 'marketplace', label: `For-Sale (${pendingListings.length})` },
          { id: 'reports', label: 'Reports & Export (Excel/PDF)' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as typeof subTab)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              subTab === tab.id
                ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Items, Categories & Cost History */}
      {subTab === 'items' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Add New Store Item Form with Image Upload & Unit Cost */}
            <form
              onSubmit={handleAddStoreItem}
              className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    Register New Store Item
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Upload an item photo, set unit cost &amp; selling price, and record initial cost history.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Matcha Oat Latte (250ml)"
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  >
                    {storeConfig.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Unit Cost (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Selling Price (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Short description shown on the product card"
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Barcode (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={64}
                      value={newBarcode}
                      onChange={(e) => setNewBarcode(e.target.value)}
                      placeholder="EAN / UPC / SKU code"
                      className="flex-1 min-w-0 min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setIsAddBarcodeScannerOpen(true)}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1F312E] shrink-0 cursor-pointer"
                    >
                      <ScanBarcode className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                      <span>Scan</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Item Image on Registration: Upload File OR Choose Preset */}
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-stone-700 dark:text-stone-200">
                  Item Image on Registration
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {newImage ? (
                    <img
                      src={newImage}
                      alt="New item preview"
                      className="w-16 h-16 rounded-xl object-cover border border-stone-200 dark:border-stone-700 bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 flex items-center justify-center text-[10px] text-stone-400">
                      No img
                    </div>
                  )}
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer hover:bg-stone-50 dark:hover:bg-[#1F312E]">
                        <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                        <span>Upload Item Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) readFileAsDataUrl(f, setNewImage);
                          }}
                          className="hidden"
                        />
                      </label>
                      <select
                        value={
                          ITEM_IMAGE_PRESETS.some((p) => p.path === newImage)
                            ? newImage
                            : '__custom__'
                        }
                        onChange={(e) => {
                          if (e.target.value !== '__custom__') setNewImage(e.target.value);
                        }}
                        className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 py-1 text-xs text-stone-700 dark:text-stone-200"
                      >
                        {ITEM_IMAGE_PRESETS.map((preset) => (
                          <option key={preset.path} value={preset.path}>
                            Preset: {preset.label}
                          </option>
                        ))}
                        <option value="__custom__">Uploaded Custom Image</option>
                        <option value="">No Image (Icon Fallback)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Register Item to Storefront</span>
              </button>
            </form>

            {/* Manage Item Categories (Add, Edit, Remove) */}
            <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Manage Item Categories
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Add, rename, or remove storefront &amp; suggestion categories.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name (e.g. Frozen Meals)"
                  className="flex-1 min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newCategoryName.trim()) return;
                    onAddCategory(newCategoryName.trim());
                    showToast(`Added category "${newCategoryName.trim()}".`);
                    setNewCategoryName('');
                  }}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 shrink-0 cursor-pointer"
                >
                  Add
                </button>
              </div>

              <div className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
                {storeConfig.categories.map((cat) => (
                  <div
                    key={cat}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-stone-50/50 dark:bg-[#172523]"
                  >
                    {editingCategory === cat ? (
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingCategoryValue}
                          onChange={(e) => setEditingCategoryValue(e.target.value)}
                          className="flex-1 min-h-[32px] rounded-lg border border-teal-600 bg-white dark:bg-[#121D1B] px-2.5 text-xs text-stone-900 dark:text-stone-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingCategoryValue.trim()) {
                              onEditCategory(cat, editingCategoryValue.trim());
                              showToast(`Renamed "${cat}" to "${editingCategoryValue.trim()}".`);
                            }
                            setEditingCategory(null);
                          }}
                          className="min-h-[32px] px-2.5 rounded-lg bg-teal-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          className="min-h-[32px] px-2 rounded-lg text-xs text-stone-500 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                            {cat}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            {items.filter((i) => i.category === cat).length} items
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(cat);
                              setEditingCategoryValue(cat);
                            }}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-[#121D1B] cursor-pointer"
                            aria-label={`Edit ${cat}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={storeConfig.categories.length <= 1}
                            onClick={async () => {
                              try {
                                await onRemoveCategory(cat);
                                showToast(`Removed category "${cat}".`);
                              } catch {
                                showErrorToast(`Failed to remove category "${cat}". Please check permissions.`);
                              }
                            }}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 cursor-pointer"
                            aria-label={`Remove ${cat}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Inventory & Cost History Table */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Registered Items, Pricing &amp; Cost History ({items.length} items)
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Adjust selling price or inspect &amp; update unit cost history per registered item.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-600 dark:text-stone-300">
                    <th className="py-3 px-5">Item</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5 text-right">Unit Cost (₱)</th>
                    <th className="py-3 px-5 text-right">Selling (₱)</th>
                    <th className="py-3 px-5 text-right">Margin</th>
                    <th className="py-3 px-5 text-right">Stock</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-sm">
                  {items.map((item) => {
                    const margin = item.price - item.costPrice;
                    return (
                      <tr key={item.id}>
                        <td className="py-3 px-5 font-semibold text-stone-900 dark:text-stone-100">
                          <div>{item.name}</div>
                          {item.barcode && (
                            <div className="text-[11px] font-mono font-normal text-stone-500 dark:text-stone-400 mt-0.5">
                              Barcode: {item.barcode}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5 text-xs text-stone-500 dark:text-stone-400">
                          {item.category}
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums text-stone-700 dark:text-stone-300">
                          {formatPHP(item.costPrice)}
                        </td>
                        <td className="py-3 px-5 text-right font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                          {formatPHP(item.price)}
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          +{formatPHP(margin)}
                        </td>
                        <td
                          className={`py-3 px-5 text-right font-mono font-bold tabular-nums ${
                            item.stock <= 6
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-stone-900 dark:text-stone-100'
                          }`}
                        >
                          {item.stock} {item.stock <= 6 ? '(Low)' : ''}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCostHistoryItem(item);
                                setEditCostInput(String(item.costPrice));
                                setEditSellInput(String(item.price));
                                setEditCostNote('');
                              }}
                              className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/50 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 cursor-pointer"
                            >
                              <History className="w-3 h-3" />
                              <span>Cost History ({item.costHistory?.length ?? 1})</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await onRestockItem(item.id, 10);
                                  showToast(`Restocked +10 units of ${item.name}.`);
                                } catch {
                                  showErrorToast(`Could not restock ${item.name}. Please check Admin permissions.`);
                                }
                              }}
                              className="min-h-[32px] rounded-lg border border-stone-200 dark:border-stone-700 px-2.5 py-1 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#172523] cursor-pointer"
                            >
                              +10
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await onDeleteItem(item.id);
                                  showToast(`Removed ${item.name} from storefront.`);
                                } catch {
                                  showErrorToast(`Could not delete ${item.name}. Please check Admin permissions or connection.`);
                                }
                              }}
                              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                              aria-label={`Delete ${item.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Restock & Barcode Scanner */}
      {subTab === 'restock' && (
        <AdminRestockPanel
          items={items}
          onRestockItem={onRestockItem}
          onUpdateItemBarcode={onUpdateItemBarcode}
          onCreateNewWithBarcode={(code) => {
            setNewBarcode(code);
            setSubTab('items');
          }}
          onNotifySuccess={showToast}
          onNotifyError={showErrorToast}
        />
      )}

      {/* Tab: Stock Adjustment & History Logs */}
      {subTab === 'stockAdjustments' && (
        <AdminStockAdjustmentPanel
          items={items}
          stockAdjustments={stockAdjustments}
          onAdjustStock={onAdjustStock}
          onNotifySuccess={showToast}
          onNotifyError={showErrorToast}
        />
      )}

      {/* Tab: Sales Order (Pending Confirmation & Walk-In Counter POS) */}
      {subTab === 'salesOrder' && (
        <AdminSalesOrderPanel
          items={items}
          users={users}
          orders={orders}
          proofs={proofs}
          storeConfig={storeConfig}
          onApproveOrder={onApprovePendingOrder}
          onRejectOrder={onRejectPendingOrder}
          onCreateManualSale={onCreateManualSale}
          onNotifySuccess={showToast}
          onNotifyError={showErrorToast}
        />
      )}

      {/* Tab 2: Store Settings & Configurable Payment Methods */}
      {subTab === 'config' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleSaveStoreConfig}
              className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-[#172523] border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-200">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    Store, Delivery Commission &amp; Cutoffs
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Delivery fees are credited 100% as Delivery Staff commission.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Storefront Announcement Banner
                </label>
                <input
                  type="text"
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    1st Debt Cutoff Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={day1Input}
                    onChange={(e) => setDay1Input(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    2nd Debt Cutoff Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={day2Input}
                    onChange={(e) => setDay2Input(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Desk Delivery Mode
                  </label>
                  <button
                    type="button"
                    onClick={() => setDeliveryEnabled((prev) => !prev)}
                    className={`w-full min-h-[40px] rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer ${
                      deliveryEnabled
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                        : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {deliveryEnabled ? 'Desk Delivery Enabled' : 'Pickup Only'}
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Delivery Fee → Runner Commission (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-stone-900 dark:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 dark:hover:bg-teal-800 cursor-pointer"
              >
                Save Store Settings
              </button>
            </form>

            {/* Checkout Live Preview of GCash / Digital Wallet Card */}
            <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    Live Payment Card Preview (Copyable &amp; Downloadable QR)
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Exactly how coworkers see GCash, Maya, MariBank, or custom wallets at checkout.
                  </p>
                </div>
                <select
                  value={previewMethod?.id ?? ''}
                  onChange={(e) => setPreviewPmId(e.target.value)}
                  className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 text-xs font-semibold text-stone-800 dark:text-stone-100"
                >
                  {storeConfig.paymentMethods
                    .filter((m) => m.type === 'digital')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        Preview: {m.title}
                      </option>
                    ))}
                </select>
              </div>

              {previewMethod ? (
                <PaymentMethodCard method={previewMethod} amount={250} />
              ) : (
                <p className="text-xs text-stone-500">Add a digital payment method below.</p>
              )}
            </div>
          </div>

          {/* Configurable Payment Methods Editor */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Wallet className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Configure &amp; Populate Payment Methods
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Edit titles, icon images, account numbers, account names, QR codes, or add new payment methods.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storeConfig.paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#172523] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {pm.iconImage && (
                        <img
                          src={pm.iconImage}
                          alt={pm.title}
                          className="w-8 h-8 rounded-lg object-cover border border-stone-200 dark:border-stone-700 bg-white shrink-0"
                        />
                      )}
                      <input
                        type="text"
                        value={pm.title}
                        onChange={(e) =>
                          handleUpdatePaymentMethodField(pm.id, { title: e.target.value })
                        }
                        className="min-h-[34px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-sm font-bold text-stone-900 dark:text-stone-100 w-40"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdatePaymentMethodField(pm.id, { enabled: !pm.enabled })
                      }
                      className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                        pm.enabled
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {pm.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {pm.type === 'digital' && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-0.5">
                            Account Number
                          </label>
                          <input
                            type="text"
                            value={pm.accountNumber ?? ''}
                            onChange={(e) =>
                              handleUpdatePaymentMethodField(pm.id, {
                                accountNumber: e.target.value,
                              })
                            }
                            className="w-full min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs font-mono text-stone-900 dark:text-stone-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-0.5">
                            Account Name
                          </label>
                          <input
                            type="text"
                            value={pm.accountName ?? ''}
                            onChange={(e) =>
                              handleUpdatePaymentMethodField(pm.id, {
                                accountName: e.target.value,
                              })
                            }
                            className="w-full min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs text-stone-900 dark:text-stone-100"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 py-1 text-[11px] font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                          <Upload className="w-3 h-3 text-teal-700 dark:text-teal-400" />
                          <span>Upload Icon</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                readFileAsDataUrl(f, (url) =>
                                  handleUpdatePaymentMethodField(pm.id, { iconImage: url })
                                );
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        <label className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 py-1 text-[11px] font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                          <Upload className="w-3 h-3 text-teal-700 dark:text-teal-400" />
                          <span>{pm.qrCodeImage ? 'Replace QR Image' : 'Upload Custom QR'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                readFileAsDataUrl(f, (url) =>
                                  handleUpdatePaymentMethodField(pm.id, { qrCodeImage: url })
                                );
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        {pm.qrCodeImage && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePaymentMethodField(pm.id, { qrCodeImage: undefined })
                            }
                            className="text-[11px] text-stone-500 hover:text-red-600 cursor-pointer"
                          >
                            Use Auto QR
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Payment Method */}
            <form
              onSubmit={handleAddPaymentMethod}
              className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 p-4 space-y-3"
            >
              <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
                + Populate Additional Payment Method (e.g. GoTyme, BPI, SeaBank)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  required
                  value={newPmTitle}
                  onChange={(e) => setNewPmTitle(e.target.value)}
                  placeholder="Title (e.g. GoTyme)"
                  className="min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs text-stone-900 dark:text-stone-100"
                />
                <select
                  value={newPmType}
                  onChange={(e) => setNewPmType(e.target.value as typeof newPmType)}
                  className="min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 text-xs text-stone-900 dark:text-stone-100"
                >
                  <option value="digital">Digital Wallet / QR</option>
                  <option value="cash">Cash</option>
                  <option value="debt">Credit / Debt</option>
                </select>
                <input
                  type="text"
                  value={newPmNumber}
                  onChange={(e) => setNewPmNumber(e.target.value)}
                  placeholder="Account Number"
                  className="min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs font-mono text-stone-900 dark:text-stone-100"
                />
                <input
                  type="text"
                  value={newPmName}
                  onChange={(e) => setNewPmName(e.target.value)}
                  placeholder="Account Name"
                  className="min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 text-[11px] font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                    <Upload className="w-3 h-3 text-teal-700 dark:text-teal-400" />
                    <span>{newPmIcon ? 'Icon Selected' : 'Icon Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) readFileAsDataUrl(f, setNewPmIcon);
                      }}
                      className="hidden"
                    />
                  </label>
                  <label className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 text-[11px] font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                    <Upload className="w-3 h-3 text-teal-700 dark:text-teal-400" />
                    <span>{newPmQr ? 'QR Selected' : 'Custom QR Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) readFileAsDataUrl(f, setNewPmQr);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                >
                  Add Payment Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Cash Assistance (Pautangan) Config, Super Admin Terms & Who Can View */}
      {subTab === 'pautangan' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Cash Assistance (Pautangan) Interest Rate &amp; Global Visibility
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Configure monthly interest rate (%) and choose whether Pautangan is visible globally or per coworker.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Monthly Interest Rate (%):
                </label>
                <input
                  type="number"
                  min="0"
                  max="25"
                  step="0.5"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="w-20 min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 py-1.5 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePautanganGlobal(
                      pautanganSettings.globalEnabled,
                      Math.max(0, Number(rateInput) || 0)
                    );
                    showToast(`Cash Assistance interest rate updated to ${rateInput}% per month.`);
                  }}
                  className="min-h-[40px] rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                >
                  Save Rate
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !pautanganSettings.globalEnabled;
                  onUpdatePautanganGlobal(next, pautanganSettings.monthlyInterestRate);
                  showToast(next ? 'Pautangan enabled globally.' : 'Pautangan paused globally.');
                }}
                className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  pautanganSettings.globalEnabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-stone-900 text-white hover:bg-stone-800'
                }`}
              >
                {pautanganSettings.globalEnabled
                  ? 'Global Status: Visible & Active'
                  : 'Global Status: Paused'}
              </button>
            </div>
          </div>

          {/* Super Admin Loan Terms Configuration */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Cash Assistance Repayment Terms (Super Admin Configuration)
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Populate any number of loan month terms available to borrowers (not limited to 1–3 months).
                </p>
              </div>
              {!isSuperAdmin && (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Super Admin role required to edit terms
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[...pautanganSettings.availableTerms]
                .sort((a, b) => a - b)
                .map((term) => (
                  <div
                    key={term}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-1.5 text-xs font-semibold text-stone-800 dark:text-stone-200"
                  >
                    <span>
                      {term} {term === 1 ? 'Month' : 'Months'}
                    </span>
                    {isSuperAdmin && pautanganSettings.availableTerms.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdatePautanganTerms(
                            pautanganSettings.availableTerms.filter((t) => t !== term)
                          );
                          showToast(`Removed ${term}-month Pautangan term.`);
                        }}
                        className="text-stone-400 hover:text-red-600 cursor-pointer"
                        aria-label={`Remove ${term} month term`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {isSuperAdmin && (
              <div className="flex items-center gap-2 max-w-sm">
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={newTermMonths}
                  onChange={(e) => setNewTermMonths(e.target.value)}
                  placeholder="Months (e.g. 6, 9, 12)"
                  className="flex-1 min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs font-mono text-stone-900 dark:text-stone-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    const m = Math.max(1, Math.min(36, Math.round(Number(newTermMonths) || 0)));
                    if (m > 0 && !pautanganSettings.availableTerms.includes(m)) {
                      onUpdatePautanganTerms([...pautanganSettings.availableTerms, m]);
                      showToast(`Added ${m}-month repayment term.`);
                    }
                  }}
                  className="min-h-[38px] px-4 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                >
                  + Add Term (Months)
                </button>
              </div>
            )}
          </div>

          {/* Who Can View & Borrow Table */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Who Can View &amp; Borrow Cash Assistance (Per-User Access &amp; Limits)
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Toggle individual coworker access to view and apply for Pautangan, and edit their credit limit.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-600 dark:text-stone-300">
                    <th className="py-3 px-5">Coworker</th>
                    <th className="py-3 px-5">Department</th>
                    <th className="py-3 px-5 text-right">Store Debt</th>
                    <th className="py-3 px-5 text-right">Credit Limit (₱)</th>
                    <th className="py-3 px-5 text-right">Can View &amp; Borrow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-sm">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-50/60 dark:hover:bg-[#172523]/60">
                      <td className="py-3.5 px-5 font-semibold text-stone-900 dark:text-stone-100">
                        {u.name}
                      </td>
                      <td className="py-3.5 px-5 text-stone-600 dark:text-stone-400 text-xs">
                        {u.department}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                        {formatPHP(u.debtBalance, true)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={u.pautanganLimit}
                          onChange={(e) =>
                            onToggleUserPautangan(
                              u.id,
                              u.pautanganEnabled,
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className="w-24 min-h-[34px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2 py-1 text-right text-xs font-mono tabular-nums text-stone-900 dark:text-stone-100"
                          aria-label={`Credit limit for ${u.name}`}
                        />
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            onToggleUserPautangan(u.id, !u.pautanganEnabled, u.pautanganLimit);
                            showToast(
                              `${u.name} Cash Assistance access ${
                                !u.pautanganEnabled ? 'enabled' : 'hidden/disabled'
                              }.`
                            );
                          }}
                          className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            u.pautanganEnabled
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          {u.pautanganEnabled ? 'Allowed to View & Borrow' : 'Restricted'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Super Admin Roles & Delivery Staff Configuration */}
      {subTab === 'superadmin' && (
        <div className="space-y-6">
          {!isSuperAdmin ? (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 p-8 text-center space-y-3">
              <ShieldCheck className="w-8 h-8 text-amber-700 dark:text-amber-400 mx-auto" />
              <h2 className="text-lg font-bold text-amber-950 dark:text-amber-200">
                Super Admin Role Required
              </h2>
              <p className="text-xs text-amber-900 dark:text-amber-300 max-w-md mx-auto">
                Only Super Admin can register new Delivery Staff accounts and configure user access roles across the organization.
              </p>
              {onExitPreview && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="min-h-[42px] rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                >
                  Exit Preview to Super Admin
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Add Delivery Staff Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!staffName.trim() || !staffEmail.trim()) return;
                  onAddDeliveryStaff(
                    staffName.trim(),
                    staffEmail.trim(),
                    staffDept.trim() || 'Pantry Delivery & Logistics'
                  );
                  showToast(`Added Delivery Staff: ${staffName.trim()}.`);
                  setStaffName('');
                  setStaffEmail('');
                }}
                className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                      Add Delivery Staff (Super Admin)
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Register a new delivery runner with access to the Delivery Dispatch &amp; Commission Dashboard.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="e.g. Kuya Ariel Bautista"
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Email / Gmail
                  </label>
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="ariel.delivery@company.ph"
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Assigned Team / Floor Zone
                  </label>
                  <input
                    type="text"
                    value={staffDept}
                    onChange={(e) => setStaffDept(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Delivery Staff Account</span>
                </button>
              </form>

              {/* Access Role Configuration Table */}
              <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    Access Role Configuration
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Newly registered emails default to Coworker. Super Admin can assign Coworker, Delivery Staff, Admin, or Super Admin roles here.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-600 dark:text-stone-300">
                        <th className="py-3 px-5">User</th>
                        <th className="py-3 px-5">Department</th>
                        <th className="py-3 px-5 text-right">Assigned Access Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-sm">
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2.5">
                              {u.avatarUrl ? (
                                <img
                                  src={u.avatarUrl}
                                  alt={u.name}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                                />
                              ) : (
                                <span className="w-8 h-8 rounded-full bg-teal-700/15 dark:bg-teal-500/20 text-teal-800 dark:text-teal-200 text-xs font-bold flex items-center justify-center shrink-0">
                                  {u.avatarInitials}
                                </span>
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                                  {u.name}
                                </div>
                                <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-xs text-stone-600 dark:text-stone-400">
                            {u.department}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <select
                              value={u.role}
                              onChange={(e) => {
                                const nextRole = e.target.value as UserRole;
                                onUpdateUserRole(u.id, nextRole);
                                showToast(`Updated ${u.name}'s role to ${nextRole}.`);
                              }}
                              className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 text-xs font-semibold text-stone-900 dark:text-stone-100"
                            >
                              <option value={UserRole.Member}>Coworker (Default)</option>
                              <option value={UserRole.DeliveryStaff}>Delivery Staff</option>
                              <option value={UserRole.Admin}>Admin</option>
                              <option value={UserRole.SuperAdmin}>Super Admin</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Proofs & Reminders */}
      {subTab === 'proofs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Digital Payment Proof Verification Queue
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Inspect Storefront &amp; Pautangan wallet screenshots before updating customer store balances (Community Seller receipts are verified by each seller).
              </p>
            </div>

            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {proofs.map((prf) => (
                <div
                  key={prf.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={prf.imageDataUrl}
                      alt={`Receipt from ${prf.userName}`}
                      className="w-20 h-24 rounded-xl object-cover border border-stone-200 dark:border-stone-700 shrink-0 bg-stone-50"
                    />
                    <div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        <span className="font-mono font-semibold text-stone-700 dark:text-stone-200">
                          {prf.id}
                        </span>{' '}
                        · {prf.channel} · {prf.submittedAt}
                      </div>
                      <h3 className="mt-1 text-base font-bold text-stone-900 dark:text-stone-100">
                        {prf.userName} —{' '}
                        <span className="font-mono tabular-nums">
                          {formatPHP(prf.amount, true)}
                        </span>
                      </h3>
                      <div className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                        {prf.purpose} · Ref: <span className="font-mono">{prf.referenceNo}</span>
                      </div>
                      <div
                        className={`mt-1.5 text-xs font-semibold ${
                          prf.status === 'approved'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : prf.status === 'rejected'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {prf.status === 'approved'
                          ? `Confirmed (${prf.reviewedAt ?? 'Today'})`
                          : prf.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending Manual Confirmation'}
                      </div>
                    </div>
                  </div>

                  {prf.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onReviewProof(prf.id, 'rejected');
                          showToast(`Rejected proof ${prf.id}.`);
                        }}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onReviewProof(prf.id, 'approved');
                          showToast(`Confirmed ${formatPHP(prf.amount, true)} from ${prf.userName}.`);
                        }}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Payment</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 space-y-3">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Send Payment Reminders
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Notify {users.filter((u) => u.debtBalance > 0).length} coworkers with open store credit balances before the {pautanganSettings.dueDays[0]}th / {pautanganSettings.dueDays[1]}th cutoff.
            </p>
            <button
              type="button"
              onClick={() => {
                onSendReminders();
                showToast('Payment reminders dispatched to all coworkers with open balances.');
              }}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-teal-800 cursor-pointer"
            >
              <BellRing className="w-4 h-4" />
              <span>Send Due-Date Reminders</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 6: Marketplace Moderation */}
      {subTab === 'marketplace' && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Coworker For-Sale Feed Approvals
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Review submitted items and their store-owner commission terms before publishing.
            </p>
          </div>
          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {listings.map((l) => {
              const { ownerShare, sellerNet } = computeCommission(
                l.price,
                l.commissionType,
                l.commissionValue
              );
              return (
                <div
                  key={l.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {l.sellerName} · {l.sellerDepartment} · {l.createdAt}
                    </div>
                    <h3 className="mt-1 text-base font-bold text-stone-900 dark:text-stone-100">
                      {l.title} —{' '}
                      <span className="font-mono tabular-nums">{formatPHP(l.price)}</span>
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                      {l.description}
                    </p>
                    <div className="text-xs text-stone-700 dark:text-stone-300 mt-1.5 tabular-nums">
                      Commission:{' '}
                      <strong>
                        {l.commissionType === CommissionType.Percentage
                          ? `${l.commissionValue}%`
                          : `${formatPHP(l.commissionValue)} fixed`}
                      </strong>{' '}
                      (Owner: {formatPHP(ownerShare)} · Seller: {formatPHP(sellerNet)}) · Stock:{' '}
                      {l.stock}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {l.approvalStatus === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onReviewListing(l.id, 'rejected');
                            showToast(`Declined "${l.title}".`);
                          }}
                          className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onReviewListing(l.id, 'approved');
                            showToast(`Approved "${l.title}" — now live on the For-Sale feed.`);
                          }}
                          className="min-h-[40px] rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                        >
                          Approve Listing
                        </button>
                      </>
                    ) : l.approvalStatus === 'approved' ? (
                      <>
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mr-1">
                          Published
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onReviewListing(l.id, 'rejected');
                            showToast(`Unpublished "${l.title}" — removed from the public For-Sale feed.`);
                          }}
                          className="min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                        >
                          Unpublish
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400 mr-1">
                          Rejected
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onReviewListing(l.id, 'approved');
                            showToast(`Re-approved "${l.title}" — now live on the For-Sale feed.`);
                          }}
                          className="min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer"
                        >
                          Re-Approve
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onDeleteListing(l.id);
                          showToast(`Permanently removed "${l.title}".`);
                        } catch {
                          showErrorToast(`Could not delete "${l.title}". Please check Admin permissions or connection.`);
                        }
                      }}
                      title="Delete listing permanently"
                      aria-label={`Delete ${l.title}`}
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {listings.length === 0 && (
              <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                No coworker marketplace listings submitted yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Important Reports & Excel / PDF Export */}
      {subTab === 'reports' && (
        <div className="space-y-6">
          {/* Export Toolbar */}
          <div className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Department Financial, Inventory &amp; Collectibles Reports
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                Download multi-sheet Excel workbooks or formatted PDF executive reports anytime.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleExportExcel}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel (.xls)</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-stone-900 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-teal-800 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF (.pdf)</span>
              </button>
            </div>
          </div>

          {/* Summary Report Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
              <div className="text-xs text-stone-500 dark:text-stone-400">Gross Orders Revenue</div>
              <div className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                {formatPHP(grossSalesRevenue, true)}
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                {orders.length} orders logged
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
              <div className="text-xs text-stone-500 dark:text-stone-400">Cash Collected</div>
              <div className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {formatPHP(totalCashCollected, true)}
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                Confirmed COD &amp; Counter Cash
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
              <div className="text-xs text-stone-500 dark:text-stone-400">Delivery Staff Fees</div>
              <div className="mt-1 text-xl font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
                {formatPHP(totalDeliveryFees, true)}
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                100% Runner Commission
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
              <div className="text-xs text-stone-500 dark:text-stone-400">Low Stock SKUs</div>
              <div className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                {items.filter((i) => i.stock <= 6).length} SKUs
              </div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                Threshold: ≤ 6 units
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Most Saleable Items &amp; Profit Margin
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Ranked by gross pantry revenue
                </p>
              </div>
              <div className="divide-y divide-stone-200 dark:divide-stone-800">
                {topSaleableItems.slice(0, 6).map((item, idx) => {
                  const revenue = item.soldCount * item.price;
                  const profit = item.soldCount * (item.price - item.costPrice);
                  const maxRev =
                    (topSaleableItems[0]?.soldCount ?? 0) * (topSaleableItems[0]?.price ?? 0) || 1;
                  const pct = Math.round((revenue / maxRev) * 100);
                  return (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                          {formatPHP(revenue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                        <span>
                          {item.soldCount} sold · Cost {formatPHP(item.costPrice)} / Sell{' '}
                          {formatPHP(item.price)}
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          Est. Margin +{formatPHP(profit)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                        <div
                          className="h-full bg-teal-700 dark:bg-teal-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Top Customers &amp; Open Balances
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Ranked by lifetime pantry &amp; marketplace spend
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-600 dark:text-stone-300">
                      <th className="py-3 px-5">Customer</th>
                      <th className="py-3 px-5 text-right">Open Debt</th>
                      <th className="py-3 px-5 text-right">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-sm">
                    {topCustomers.map((cust, i) => (
                      <tr key={cust.id}>
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            {i + 1}. {cust.name}
                          </div>
                          <div className="text-xs text-stone-500 dark:text-stone-400">
                            {cust.department}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono tabular-nums text-stone-700 dark:text-stone-300">
                          {formatPHP(cust.debtBalance, true)}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                          {formatPHP(cust.totalSpent, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost History Modal for Registered Item */}
      {latestHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl space-y-4 my-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Cost History · {latestHistoryItem.name}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {latestHistoryItem.category} · Current Cost: {formatPHP(latestHistoryItem.costPrice)} · Selling:{' '}
                  {formatPHP(latestHistoryItem.price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCostHistoryItem(null)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Record New Cost Revision */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const nextCost = Math.max(0, Number(editCostInput) || 0);
                const nextSell = Math.max(1, Number(editSellInput) || 1);
                onUpdateItemPricing(
                  latestHistoryItem.id,
                  nextSell,
                  nextCost,
                  editCostNote.trim() || `Updated by ${currentUser?.name ?? 'Admin'}`
                );
                setEditCostNote('');
                showToast(`Logged new cost & price entry for ${latestHistoryItem.name}.`);
              }}
              className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-4 space-y-3"
            >
              <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
                Update Unit Cost / Selling Price
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1">
                    New Unit Cost (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editCostInput}
                    onChange={(e) => setEditCostInput(e.target.value)}
                    className="w-full min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs font-mono text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1">
                    New Selling Price (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editSellInput}
                    onChange={(e) => setEditSellInput(e.target.value)}
                    className="w-full min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs font-mono text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
              <input
                type="text"
                value={editCostNote}
                onChange={(e) => setEditCostNote(e.target.value)}
                placeholder="Reason / supplier batch note (e.g. Wholesale discount)"
                className="w-full min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 text-xs text-stone-900 dark:text-stone-100"
              />
              <button
                type="submit"
                className="w-full min-h-[38px] rounded-lg bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                Save &amp; Append Cost History Entry
              </button>
            </form>

            {/* Cost History Timeline */}
            <div className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl max-h-60 overflow-y-auto">
              {[...(latestHistoryItem.costHistory ?? [])]
                .reverse()
                .map((entry) => (
                  <div key={entry.id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-stone-900 dark:text-stone-100">
                        Cost: {formatPHP(entry.costPrice)} → Sell: {formatPHP(entry.sellingPrice)}{' '}
                        <span className="text-emerald-700 dark:text-emerald-400">
                          (Margin +{formatPHP(entry.sellingPrice - entry.costPrice)})
                        </span>
                      </div>
                      <div className="text-stone-500 dark:text-stone-400 mt-0.5">
                        {entry.note} · By {entry.updatedBy}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-stone-400 shrink-0">
                      {entry.date}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        isOpen={isAddBarcodeScannerOpen}
        title="Scan Barcode for New Item"
        subtitle="Scan the packaging barcode to pre-fill the SKU/barcode field for this new pantry item."
        onClose={() => setIsAddBarcodeScannerOpen(false)}
        onDetected={(code) => {
          setNewBarcode(code.slice(0, 64));
          setIsAddBarcodeScannerOpen(false);
        }}
      />
    </div>
  );
};
