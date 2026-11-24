import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  BellRing,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Lock,
  Plus,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { DEFAULT_PAYMENT_METHODS, ITEM_IMAGE_PRESETS } from '../data/seedData';
import {
  CatalogTemplate,
  FulfillmentType,
  LoanRecord,
  PaymentMethodConfig,
  PaymentProof,
  PlatformConfig,
  StockAdjustmentLog,
  StoreCashAssistanceConfig,
  StoreConfig,
  StoreCustomerCredit,
  StoreItem,
  StoreOrder,
  StoreProfile,
  UserAccount,
  UserRole,
} from '../types';
import { exportExcelWorkbook, exportPdfReport } from '../utils/exportReports';
import {
  DEFAULT_STORE_ID,
  formatPHP,
  isOrderPendingAdminConfirmation,
  resolveOrderPaymentType,
  resolveOrderStoreId,
} from '../utils/format';
import { compressImageFileToDataUrl } from '../utils/image';
import { AdminRestockPanel } from './AdminRestockPanel';
import { AdminSalesOrderPanel } from './AdminSalesOrderPanel';
import { AdminStockAdjustmentPanel } from './AdminStockAdjustmentPanel';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ImagePreviewModal, ImagePreviewTarget } from './ImagePreviewModal';
import { PaymentMethodCard } from './PaymentMethodCard';

interface StoreOwnerWorkspaceViewProps {
  currentUser: UserAccount | null;
  currentRole: UserRole;
  stores: StoreProfile[];
  items: StoreItem[];
  orders: StoreOrder[];
  proofs: PaymentProof[];
  loans: LoanRecord[];
  users: UserAccount[];
  coworkers: Array<{ id: string; name: string; department: string }>;
  catalogTemplates: CatalogTemplate[];
  storeCashAssistance: StoreCashAssistanceConfig[];
  storeCustomerCredits: StoreCustomerCredit[];
  stockAdjustments: StockAdjustmentLog[];
  platformConfig: PlatformConfig;
  requestedStoreId?: { storeId: string; tab?: string; nonce: number } | null;
  onUpdateStoreProfile: (nextStore: StoreProfile) => Promise<void> | void;
  onAddStoreItem: (
    store: StoreProfile,
    item: {
      name: string;
      category: string;
      description: string;
      price: number;
      costPrice: number;
      stock: number;
      image?: string;
      barcode?: string;
      templateId?: string;
    }
  ) => Promise<void> | void;
  onAdoptCatalogTemplate: (
    store: StoreProfile,
    template: CatalogTemplate,
    payload: { price: number; costPrice: number; stock: number }
  ) => Promise<void> | void;
  onUpdateItemPricing: (
    itemId: string,
    sellingPrice: number,
    costPrice: number,
    note?: string
  ) => void;
  onDeleteItem: (itemId: string) => Promise<void> | void;
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
  onAdjustStock: (payload: {
    itemId: string;
    adjustmentType: 'add' | 'deduct' | 'recount';
    quantityOrCount: number;
    reason: string;
    note?: string;
  }) => Promise<StockAdjustmentLog>;
  onApproveOrder: (orderId: string) => Promise<void>;
  onRejectOrder: (orderId: string) => Promise<void>;
  onCreateManualSale: (payload: {
    storeId?: string;
    customerMode: 'walkin' | 'coworker';
    customerId?: string;
    customerName: string;
    items: Array<{ itemId: string; quantity: number }>;
    fulfillment: FulfillmentType;
    deliveryNote?: string;
    paymentMethod: string;
  }) => Promise<StoreOrder>;
  onReviewProof: (proofId: string, decision: 'approved' | 'rejected') => Promise<void> | void;
  onSendStoreDebtReminders: (store: StoreProfile, credits: StoreCustomerCredit[]) => Promise<void> | void;
  onRequestStoreCashAssistance: (storeId: string, note: string) => Promise<void> | void;
  onIssueStoreLoan?: (
    store: StoreProfile,
    borrowerId: string,
    borrowerName: string,
    principal: number,
    months: number
  ) => Promise<void> | void;
  onMarkStoreLoanSettled?: (loanId: string) => Promise<void> | void;
  onOpenStorefrontApply?: () => void;
}

type WorkspaceTab =
  | 'orders'
  | 'items'
  | 'restock'
  | 'adjustments'
  | 'proofs'
  | 'delivery'
  | 'cashAssistance'
  | 'config'
  | 'reports';

export const StoreOwnerWorkspaceView: React.FC<StoreOwnerWorkspaceViewProps> = ({
  currentUser,
  currentRole,
  stores,
  items,
  orders,
  proofs,
  loans,
  users,
  coworkers,
  catalogTemplates,
  storeCashAssistance,
  storeCustomerCredits,
  stockAdjustments,
  platformConfig,
  requestedStoreId,
  onUpdateStoreProfile,
  onAddStoreItem,
  onAdoptCatalogTemplate,
  onUpdateItemPricing,
  onDeleteItem,
  onRestockItem,
  onUpdateItemBarcode,
  onAdjustStock,
  onApproveOrder,
  onRejectOrder,
  onCreateManualSale,
  onReviewProof,
  onSendStoreDebtReminders,
  onRequestStoreCashAssistance,
  onIssueStoreLoan,
  onMarkStoreLoanSettled,
  onOpenStorefrontApply,
}) => {
  const isAdminOrSuper =
    currentRole === UserRole.Admin || currentRole === UserRole.SuperAdmin;

  const accessibleStores = useMemo(() => {
    if (!currentUser) return [];
    if (isAdminOrSuper) return stores;
    const ownedIds = currentUser.ownedStoreIds ?? [];
    return stores.filter(
      (s) => s.ownerId === currentUser.id || ownedIds.includes(s.id)
    );
  }, [currentUser, isAdminOrSuper, stores]);

  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    accessibleStores[0]?.id ?? DEFAULT_STORE_ID
  );
  const [subTab, setSubTab] = useState<WorkspaceTab>('orders');
  const [banner, setBanner] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  useEffect(() => {
    if (
      accessibleStores.length > 0 &&
      !accessibleStores.some((s) => s.id === selectedStoreId)
    ) {
      setSelectedStoreId(accessibleStores[0].id);
    }
  }, [accessibleStores, selectedStoreId]);

  useEffect(() => {
    if (requestedStoreId?.storeId) {
      if (accessibleStores.some((s) => s.id === requestedStoreId.storeId)) {
        setSelectedStoreId(requestedStoreId.storeId);
      }
      if (requestedStoreId.tab) {
        setSubTab(requestedStoreId.tab as WorkspaceTab);
      }
    }
  }, [requestedStoreId?.nonce, accessibleStores]);

  const activeStore = useMemo(
    () =>
      accessibleStores.find((s) => s.id === selectedStoreId) ??
      accessibleStores[0] ??
      null,
    [accessibleStores, selectedStoreId]
  );

  // Scoped datasets for activeStore
  const storeItems = useMemo(
    () =>
      activeStore
        ? items.filter((i) => (i.storeId || DEFAULT_STORE_ID) === activeStore.id)
        : [],
    [activeStore, items]
  );

  const storeOrders = useMemo(
    () =>
      activeStore
        ? orders.filter(
            (o) =>
              o.source === 'store' && resolveOrderStoreId(o) === activeStore.id
          )
        : [],
    [activeStore, orders]
  );

  const storeProofs = useMemo(
    () =>
      activeStore
        ? proofs.filter(
            (p) =>
              p.purpose !== 'Community Seller Settlement' &&
              (p.storeId || DEFAULT_STORE_ID) === activeStore.id
          )
        : [],
    [activeStore, proofs]
  );

  const storeCredits = useMemo(
    () =>
      activeStore
        ? storeCustomerCredits.filter(
            (c) => c.storeId === activeStore.id && c.balance > 0
          )
        : [],
    [activeStore, storeCustomerCredits]
  );

  const storeAdjustments = useMemo(
    () =>
      activeStore
        ? stockAdjustments.filter(
            (l) => (l.storeId || DEFAULT_STORE_ID) === activeStore.id
          )
        : [],
    [activeStore, stockAdjustments]
  );

  const storeCaConfig = useMemo(() => {
    if (!activeStore) return null;
    return storeCashAssistance.find((c) => c.storeId === activeStore.id) ?? null;
  }, [activeStore, storeCashAssistance]);

  // Confidential check: Never expose Cash Assistance tab unless visibleToOwner === true or status !== 'locked'
  const canSeeStoreCashAssistanceTab = Boolean(
    storeCaConfig &&
      (storeCaConfig.visibleToOwner === true || storeCaConfig.status !== 'locked')
  );

  useEffect(() => {
    if (subTab === 'cashAssistance' && !canSeeStoreCashAssistanceTab) {
      setSubTab('orders');
    }
  }, [subTab, canSeeStoreCashAssistanceTab]);

  const storeLoans = useMemo(
    () =>
      activeStore
        ? loans.filter(
            (l) => (l.storeId || DEFAULT_STORE_ID) === activeStore.id
          )
        : [],
    [activeStore, loans]
  );

  const activeStoreConfig: StoreConfig = useMemo(() => {
    if (!activeStore) {
      return {
        storeAnnouncement: '',
        deliveryEnabled: true,
        deliveryFee: 15,
        walletAccountName: 'Store Ops',
        walletAccountNumber: '',
        categories: ['Snacks & Pastries', 'Coffee & Drinks'],
        paymentMethods: DEFAULT_PAYMENT_METHODS,
      };
    }
    return {
      storeAnnouncement: activeStore.storeAnnouncement || '',
      deliveryEnabled: activeStore.deliveryEnabled,
      deliveryFee: activeStore.deliveryFee,
      walletAccountName: activeStore.walletAccountName || activeStore.name,
      walletAccountNumber: activeStore.walletAccountNumber || '',
      categories:
        activeStore.categories?.length > 0
          ? activeStore.categories
          : ['Coffee & Drinks', 'Snacks & Pastries', 'Meals & Pantry', 'Desk Essentials'],
      paymentMethods:
        activeStore.paymentMethods?.length > 0
          ? activeStore.paymentMethods
          : DEFAULT_PAYMENT_METHODS,
    };
  }, [activeStore]);

  // Item creation & template adoption state
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState(
    activeStoreConfig.categories[0] ?? 'Snacks & Pastries'
  );
  const [newCost, setNewCost] = useState('30');
  const [newPrice, setNewPrice] = useState('45');
  const [newStock, setNewStock] = useState('20');
  const [newDesc, setNewDesc] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newImage, setNewImage] = useState(ITEM_IMAGE_PRESETS[1].path);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  const [adoptModalOpen, setAdoptModalOpen] = useState(false);
  const [adoptSearch, setAdoptSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CatalogTemplate | null>(null);
  const [adoptCost, setAdoptCost] = useState('28');
  const [adoptPrice, setAdoptPrice] = useState('40');
  const [adoptStock, setAdoptStock] = useState('25');

  // Cost history modal state
  const [costHistoryItem, setCostHistoryItem] = useState<StoreItem | null>(null);
  const [editCostInput, setEditCostInput] = useState('');
  const [editSellInput, setEditSellInput] = useState('');
  const [editCostNote, setEditCostNote] = useState('');

  // Store config editor state
  const [cfgName, setCfgName] = useState('');
  const [cfgDesc, setCfgDesc] = useState('');
  const [cfgAnnounce, setCfgAnnounce] = useState('');
  const [cfgDeliveryEnabled, setCfgDeliveryEnabled] = useState(true);
  const [cfgDeliveryFee, setCfgDeliveryFee] = useState('15');
  const [cfgDue1, setCfgDue1] = useState('15');
  const [cfgDue2, setCfgDue2] = useState('30');
  const [cfgWalletName, setCfgWalletName] = useState('');
  const [cfgWalletNumber, setCfgWalletNumber] = useState('');
  const [cfgMethods, setCfgMethods] = useState<PaymentMethodConfig[]>([]);
  const [newPmTitle, setNewPmTitle] = useState('');
  const [newPmType, setNewPmType] = useState<'digital' | 'cash' | 'debt'>('digital');
  const [newPmNumber, setNewPmNumber] = useState('');
  const [newPmAccountName, setNewPmAccountName] = useState('');

  // Cash Assistance store add-on state
  const [caRequestNote, setCaRequestNote] = useState('');
  const [caBorrowerId, setCaBorrowerId] = useState('');
  const [caPrincipal, setCaPrincipal] = useState('1000');
  const [caMonths, setCaMonths] = useState('2');

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<ImagePreviewTarget | null>(null);

  useEffect(() => {
    if (!activeStore) return;
    setCfgName(activeStore.name);
    setCfgDesc(activeStore.description);
    setCfgAnnounce(activeStore.storeAnnouncement || '');
    setCfgDeliveryEnabled(activeStore.deliveryEnabled);
    setCfgDeliveryFee(String(activeStore.deliveryFee));
    setCfgDue1(String(activeStore.dueDays?.[0] ?? 15));
    setCfgDue2(String(activeStore.dueDays?.[1] ?? 30));
    setCfgWalletName(activeStore.walletAccountName || activeStore.name);
    setCfgWalletNumber(activeStore.walletAccountNumber || '');
    setCfgMethods(
      activeStore.paymentMethods?.length > 0
        ? activeStore.paymentMethods
        : DEFAULT_PAYMENT_METHODS
    );
    setNewCat(activeStore.categories?.[0] ?? 'Snacks & Pastries');
  }, [activeStore?.id, activeStore?.updatedAt]);

  useEffect(() => {
    if (!caBorrowerId && coworkers.length > 0) {
      setCaBorrowerId(coworkers[0].id);
    }
  }, [coworkers, caBorrowerId]);

  const showToast = (msg: string) => {
    setErrorBanner('');
    setBanner(msg);
    setTimeout(() => setBanner(''), 4500);
  };

  const showError = (msg: string) => {
    setBanner('');
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(''), 6000);
  };

  // Financial report computations scoped strictly to activeStore
  const storeMetrics = useMemo(() => {
    const validOrders = storeOrders.filter((o) => o.status !== 'Rejected');
    let cashSales = 0;
    let ewalletSales = 0;
    let creditIssued = 0;
    let runnerCommissions = 0;
    let cogsEstimate = 0;
    let totalOrdersRevenue = 0;

    const itemPriceCostMap = new Map(storeItems.map((i) => [i.id, i]));

    for (const o of validOrders) {
      totalOrdersRevenue += o.totalAmount;
      const pType = resolveOrderPaymentType(o);
      if (pType === 'cash') cashSales += o.totalAmount;
      else if (pType === 'ewallet') ewalletSales += o.totalAmount;
      else if (pType === 'credit') creditIssued += o.totalAmount;

      if (o.fulfillment === FulfillmentType.Delivery) {
        runnerCommissions += o.deliveryCommission ?? o.deliveryFee ?? 0;
      }
      for (const li of o.items) {
        const ref = itemPriceCostMap.get(li.itemId);
        if (ref) cogsEstimate += ref.costPrice * li.quantity;
      }
    }

    const creditOutstanding = storeCredits.reduce((s, c) => s + c.balance, 0);
    const creditCollected = storeCustomerCredits
      .filter((c) => c.storeId === activeStore?.id)
      .reduce((s, c) => s + (c.totalPaid ?? 0), 0);
    const grossProfit = Math.max(0, totalOrdersRevenue - runnerCommissions - cogsEstimate);

    return {
      totalOrders: validOrders.length,
      totalOrdersRevenue,
      cashSales,
      ewalletSales,
      creditIssued,
      creditCollected,
      creditOutstanding,
      runnerCommissions,
      cogsEstimate,
      grossProfit,
    };
  }, [storeOrders, storeItems, storeCredits, storeCustomerCredits, activeStore?.id]);

  const pendingOrdersCount = storeOrders.filter(isOrderPendingAdminConfirmation).length;
  const pendingProofsCount = storeProofs.filter((p) => p.status === 'pending').length;

  const assignedRunners = useMemo(() => {
    if (!activeStore) return [];
    const staffIds = activeStore.assignedDeliveryStaffIds ?? [];
    return staffIds.map((id) => {
      const userMatch = users.find((u) => u.id === id);
      const coworkerMatch = coworkers.find((c) => c.id === id);
      const runnerOrders = storeOrders.filter((o) => o.assignedRunnerId === id);
      const deliveredCount = runnerOrders.filter(
        (o) => o.deliveryStatus === 'Delivered'
      ).length;
      const cashHeld = runnerOrders
        .filter((o) => resolveOrderPaymentType(o) === 'cash' && o.cashCollected)
        .reduce((s, o) => s + o.totalAmount, 0);
      const commissionSum = runnerOrders
        .filter((o) => o.fulfillment === FulfillmentType.Delivery)
        .reduce((s, o) => s + (o.deliveryCommission ?? o.deliveryFee ?? 0), 0);
      return {
        id,
        name: userMatch?.name || coworkerMatch?.name || id,
        department: userMatch?.department || coworkerMatch?.department || 'Delivery Staff',
        deliveredCount,
        totalAssignedOrders: runnerOrders.length,
        cashHeld,
        commissionSum,
      };
    });
  }, [activeStore, users, coworkers, storeOrders]);

  if (!currentUser || accessibleStores.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center space-y-4">
        <Store className="w-10 h-10 text-teal-700 dark:text-teal-400 mx-auto" />
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Store Owner Workspace
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          {currentUser
            ? 'You do not own an approved store yet. Apply to open a store from the Storefront to manage your own inventory, orders, and per-store ledger.'
            : 'Sign in first to access or apply for your own multi-store storefront.'}
        </p>
        {onOpenStorefrontApply && currentUser && (
          <button
            type="button"
            onClick={onOpenStorefrontApply}
            className="min-h-[42px] rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
          >
            Go to Storefront &amp; Apply to Open Store
          </button>
        )}
      </div>
    );
  }

  if (!activeStore) return null;

  const isSuspended = activeStore.subscriptionStatus === 'suspended';

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateStoreProfile({
        ...activeStore,
        name: cfgName.trim() || activeStore.name,
        description: cfgDesc.trim(),
        storeAnnouncement: cfgAnnounce.trim(),
        deliveryEnabled: cfgDeliveryEnabled,
        deliveryFee: Math.max(0, Number(cfgDeliveryFee) || 0),
        dueDays: [
          Math.min(28, Math.max(1, Number(cfgDue1) || 15)),
          Math.min(31, Math.max(1, Number(cfgDue2) || 30)),
        ],
        walletAccountName: cfgWalletName.trim(),
        walletAccountNumber: cfgWalletNumber.trim(),
        paymentMethods: cfgMethods,
      });
      showToast(`Saved store settings & payment channels for ${activeStore.name}.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to save store settings.');
    }
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await onAddStoreItem(activeStore, {
        name: newName.trim(),
        category: newCat || activeStoreConfig.categories[0] || 'Snacks & Pastries',
        description: newDesc.trim() || `${activeStore.name} stocked item.`,
        price: Math.max(1, Number(newPrice) || 40),
        costPrice: Math.max(0, Number(newCost) || 25),
        stock: Math.max(0, Number(newStock) || 10),
        image: newImage || undefined,
        barcode: newBarcode.trim() || undefined,
      });
      setNewName('');
      setNewDesc('');
      setNewBarcode('');
      showToast(`Added "${newName.trim()}" to ${activeStore.name} & shared catalog templates.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to register store item.');
    }
  };

  const handleAdoptConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    try {
      await onAdoptCatalogTemplate(activeStore, selectedTemplate, {
        costPrice: Math.max(0, Number(adoptCost) || 0),
        price: Math.max(1, Number(adoptPrice) || selectedTemplate.suggestedPrice || 40),
        stock: Math.max(0, Number(adoptStock) || 10),
      });
      setAdoptModalOpen(false);
      setSelectedTemplate(null);
      showToast(
        `Adopted "${selectedTemplate.name}" into ${activeStore.name} with your store's pricing & stock.`
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to adopt catalog item.');
    }
  };

  const handleExportStoreExcel = () => {
    exportExcelWorkbook(
      `${activeStore.name.replace(/\s+/g, '-')}-Report-${new Date().toISOString().slice(0, 10)}.xls`,
      [
        {
          name: 'Store Summary',
          headers: ['Metric', 'Value (PHP)'],
          rows: [
            ['Store Name', activeStore.name],
            ['Total Valid Orders', storeMetrics.totalOrders],
            ['Total Orders Revenue', storeMetrics.totalOrdersRevenue],
            ['Cash Sales Revenue', storeMetrics.cashSales],
            ['E-Wallet Sales Revenue', storeMetrics.ewalletSales],
            ['Store Credit Issued', storeMetrics.creditIssued],
            ['Store Credit Collected', storeMetrics.creditCollected],
            ['Store Credit Outstanding', storeMetrics.creditOutstanding],
            ['Delivery Runner Commissions', storeMetrics.runnerCommissions],
            ['Estimated COGS', storeMetrics.cogsEstimate],
            ['Estimated Gross Profit', storeMetrics.grossProfit],
          ],
        },
        {
          name: 'Store Orders',
          headers: ['Order ID', 'Date', 'Customer', 'Payment', 'Fulfillment', 'Status', 'Total (PHP)'],
          rows: storeOrders.map((o) => [
            o.id,
            o.createdAt,
            o.userName,
            o.paymentMethod,
            o.fulfillment,
            o.status,
            o.totalAmount,
          ]),
        },
        {
          name: 'Store Inventory',
          headers: ['Item', 'Category', 'Cost (PHP)', 'Price (PHP)', 'Stock', 'Sold'],
          rows: storeItems.map((i) => [
            i.name,
            i.category,
            i.costPrice,
            i.price,
            i.stock,
            i.soldCount,
          ]),
        },
      ]
    );
    showToast(`Exported Excel report for ${activeStore.name}.`);
  };

  const handleExportStorePdf = () => {
    exportPdfReport(
      `${activeStore.name.replace(/\s+/g, '-')}-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
      `${activeStore.name} — Isolated Store Financial Report`,
      `Owner: ${activeStore.ownerName} · Subscription: ${activeStore.subscriptionStatus}`,
      [
        {
          heading: '1. Revenue & Credit Breakdown',
          lines: [
            `Total Valid Orders: ${storeMetrics.totalOrders} (${formatPHP(storeMetrics.totalOrdersRevenue, true)})`,
            `Cash Sales: ${formatPHP(storeMetrics.cashSales, true)}`,
            `E-Wallet Sales: ${formatPHP(storeMetrics.ewalletSales, true)}`,
            `Store Credit Issued: ${formatPHP(storeMetrics.creditIssued, true)}`,
            `Store Credit Collected: ${formatPHP(storeMetrics.creditCollected, true)}`,
            `Store Credit Outstanding: ${formatPHP(storeMetrics.creditOutstanding, true)}`,
            `Runner Delivery Commissions: ${formatPHP(storeMetrics.runnerCommissions, true)}`,
            `Estimated Gross Profit: ${formatPHP(storeMetrics.grossProfit, true)}`,
          ],
        },
        {
          heading: '2. Store Inventory',
          lines: storeItems.map(
            (i) =>
              `${i.name} | Cost: ${formatPHP(i.costPrice)} | Sell: ${formatPHP(i.price)} | Stock: ${i.stock} | Sold: ${i.soldCount}`
          ),
        },
      ]
    );
    showToast(`Exported PDF report for ${activeStore.name}.`);
  };

  const adoptableTemplates = catalogTemplates.filter((tpl) => {
    const q = adoptSearch.trim().toLowerCase();
    const alreadyInStore = storeItems.some(
      (i) =>
        i.templateId === tpl.id ||
        i.name.trim().toLowerCase() === tpl.name.trim().toLowerCase()
    );
    if (alreadyInStore) return false;
    if (!q) return true;
    return (
      tpl.name.toLowerCase().includes(q) ||
      tpl.category.toLowerCase().includes(q) ||
      tpl.createdByStoreName.toLowerCase().includes(q)
    );
  });

  const latestHistoryItem = costHistoryItem
    ? storeItems.find((i) => i.id === costHistoryItem.id) ?? costHistoryItem
    : null;

  return (
    <div className="space-y-6">
      {/* Header & Store Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400">
            <Store className="w-3.5 h-3.5" />
            <span>Isolated Store Owner Workspace</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
              {activeStore.name}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                activeStore.subscriptionStatus === 'active'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : activeStore.subscriptionStatus === 'past_due'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
              }`}
            >
              Base Sub: {activeStore.subscriptionStatus} ({formatPHP(activeStore.monthlyFee)}/mo)
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Manage only {activeStore.name}&apos;s catalog, pricing, stock, orders, assigned delivery runners, customer store credit, and reports.
          </p>
        </div>

        {accessibleStores.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs font-semibold text-stone-600 dark:text-stone-300">
              Active Store:
            </label>
            <select
              value={activeStore.id}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 text-xs font-bold text-stone-900 dark:text-stone-100"
            >
              {accessibleStores.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.ownerName})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isSuspended && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 flex items-center gap-2.5 text-xs text-red-900 dark:text-red-200">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>
            <strong>Store Subscription Suspended:</strong> Buyers cannot place new orders for {activeStore.name} until Super Admin reactivates the base subscription in Developer Settings.
          </span>
        </div>
      )}

      {banner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {errorBanner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm text-red-900 dark:text-red-200">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Store KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Cash + E-Wallet Sales</div>
          <div className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            {formatPHP(storeMetrics.cashSales + storeMetrics.ewalletSales, true)}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            Cash {formatPHP(storeMetrics.cashSales)} · Wallet {formatPHP(storeMetrics.ewalletSales)}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Store Credit Outstanding</div>
          <div className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
            {formatPHP(storeMetrics.creditOutstanding, true)}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            {storeCredits.length} customer{storeCredits.length === 1 ? '' : 's'} with store balance
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Pending Store Actions</div>
          <div className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {pendingOrdersCount} Orders · {pendingProofsCount} Proofs
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            Independent store confirmation queue
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 sm:p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Est. Store Gross Profit</div>
          <div className="mt-1 text-xl font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
            {formatPHP(storeMetrics.grossProfit, true)}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            {storeItems.length} SKUs · {storeMetrics.totalOrders} orders
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 overflow-x-auto">
        {[
          {
            id: 'orders' as const,
            label:
              pendingOrdersCount > 0
                ? `Orders & POS (${pendingOrdersCount} Pending)`
                : 'Orders & POS',
          },
          { id: 'items' as const, label: `Items & Catalog (${storeItems.length})` },
          { id: 'restock' as const, label: 'Restock & Barcode' },
          { id: 'adjustments' as const, label: 'Stock Adjustments' },
          {
            id: 'proofs' as const,
            label: `Debt & Proofs (${pendingProofsCount})`,
          },
          {
            id: 'delivery' as const,
            label: `Delivery Staff (${assignedRunners.length})`,
          },
          ...(canSeeStoreCashAssistanceTab
            ? [{ id: 'cashAssistance' as const, label: 'Cash Assistance' }]
            : []),
          { id: 'config' as const, label: 'Store Config & Payments' },
          { id: 'reports' as const, label: 'Store Reports' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
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

      {/* SUBTAB: ORDERS & WALK-IN POS */}
      {subTab === 'orders' && (
        <AdminSalesOrderPanel
          items={storeItems}
          users={users}
          orders={storeOrders}
          proofs={storeProofs}
          storeConfig={activeStoreConfig}
          onApproveOrder={onApproveOrder}
          onRejectOrder={onRejectOrder}
          onCreateManualSale={(payload) =>
            onCreateManualSale({ ...payload, storeId: activeStore.id })
          }
          onNotifySuccess={showToast}
          onNotifyError={showError}
        />
      )}

      {/* SUBTAB: ITEMS & SHARED CATALOG ADOPTION */}
      {subTab === 'items' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Adopt Shared Catalog Items (e.g. Nova Chips)
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Use an item created by another store while keeping {activeStore.name}&apos;s own unit cost, selling price, and stock ledger strictly isolated.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAdoptModalOpen(true)}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 shrink-0 cursor-pointer"
            >
              <ClipboardCopy className="w-4 h-4" />
              <span>Browse Shared Catalog ({adoptableTemplates.length})</span>
            </button>
          </div>

          <form
            onSubmit={(e) => void handleAddItemSubmit(e)}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Register New Item in {activeStore.name}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Item Name (e.g. Nova Multigrain Chips)"
                className="sm:col-span-2 min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm text-stone-900 dark:text-stone-100"
              />
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm text-stone-900 dark:text-stone-100"
              >
                {activeStoreConfig.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-stone-600 dark:text-stone-400 mb-1">
                  Unit Cost (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-600 dark:text-stone-400 mb-1">
                  Selling Price (₱)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-600 dark:text-stone-400 mb-1">
                  Initial Stock
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Short description"
                className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm text-stone-900 dark:text-stone-100"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  placeholder="Barcode (Optional)"
                  className="flex-1 min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
                />
                <button
                  type="button"
                  onClick={() => setIsBarcodeScannerOpen(true)}
                  className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
                >
                  <ScanBarcode className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>Scan</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void compressImageFileToDataUrl(f).then(setNewImage);
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
                  className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 text-xs text-stone-700 dark:text-stone-200"
                >
                  {ITEM_IMAGE_PRESETS.map((p) => (
                    <option key={p.path} value={p.path}>
                      Preset: {p.label}
                    </option>
                  ))}
                  <option value="__custom__">Uploaded Custom Photo</option>
                </select>
              </div>
              <button
                type="submit"
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item to {activeStore.name}</span>
              </button>
            </div>
          </form>

          {/* Store Inventory Table */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {activeStore.name} Inventory ({storeItems.length} SKUs)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-600 dark:text-stone-300">
                    <th className="py-3 px-5">Item</th>
                    <th className="py-3 px-5 text-right">Cost</th>
                    <th className="py-3 px-5 text-right">Price</th>
                    <th className="py-3 px-5 text-right">Stock</th>
                    <th className="py-3 px-5 text-right">Sold</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-sm">
                  {storeItems.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 px-5">
                        <div className="font-semibold text-stone-900 dark:text-stone-100">
                          {item.name}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {item.category}
                          {item.templateId ? ' · Shared Catalog Adopted' : ''}
                        </div>
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums text-stone-700 dark:text-stone-300">
                        {formatPHP(item.costPrice)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
                        {formatPHP(item.price)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
                        {item.stock}
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums text-stone-600 dark:text-stone-400">
                        {item.soldCount}
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
                            className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/50 px-2.5 text-xs font-semibold text-teal-800 dark:text-teal-300 cursor-pointer"
                          >
                            <History className="w-3 h-3" />
                            <span>Price / Cost</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void onRestockItem(item.id, 10)}
                            className="min-h-[32px] rounded-lg border border-stone-200 dark:border-stone-700 px-2.5 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteItem(item.id)}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-red-600 cursor-pointer"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {storeItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-xs text-stone-500 dark:text-stone-400"
                      >
                        No items listed in {activeStore.name} yet. Create one above or adopt from the Shared Catalog!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: RESTOCK */}
      {subTab === 'restock' && (
        <AdminRestockPanel
          items={storeItems}
          onRestockItem={onRestockItem}
          onUpdateItemBarcode={onUpdateItemBarcode}
          onCreateNewWithBarcode={(code) => {
            setNewBarcode(code);
            setSubTab('items');
          }}
          onNotifySuccess={showToast}
          onNotifyError={showError}
        />
      )}

      {/* SUBTAB: STOCK ADJUSTMENTS */}
      {subTab === 'adjustments' && (
        <AdminStockAdjustmentPanel
          items={storeItems}
          stockAdjustments={storeAdjustments}
          onAdjustStock={onAdjustStock}
          onNotifySuccess={showToast}
          onNotifyError={showError}
        />
      )}

      {/* SUBTAB: DEBT & PAYMENT PROOFS */}
      {subTab === 'proofs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {activeStore.name} Payment Proofs ({storeProofs.length})
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Approve digital wallet receipts for {activeStore.name}. Settling Store Credit here reduces only the buyer&apos;s balance at {activeStore.name}.
              </p>
            </div>
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {storeProofs.map((prf) => (
                <div
                  key={prf.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    {prf.imageDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            src: prf.imageDataUrl,
                            title: `${prf.userName} · ${prf.channel}`,
                            subtitle: `${activeStore.name} · Ref ${prf.referenceNo}`,
                          })
                        }
                        className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 shrink-0 cursor-pointer"
                      >
                        <img
                          src={prf.imageDataUrl}
                          alt="Proof"
                          className="w-16 h-20 object-cover"
                        />
                      </button>
                    )}
                    <div>
                      <div className="text-xs font-mono text-stone-500 dark:text-stone-400">
                        {prf.id} · {prf.channel} · {prf.submittedAt}
                      </div>
                      <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                        {prf.userName} — {formatPHP(prf.amount, true)}
                      </div>
                      <div className="text-xs text-stone-600 dark:text-stone-400">
                        {prf.purpose} · Ref {prf.referenceNo} · Status:{' '}
                        <strong>{prf.status}</strong>
                      </div>
                    </div>
                  </div>
                  {prf.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          void onReviewProof(prf.id, 'rejected');
                          showToast(`Rejected receipt ${prf.id}.`);
                        }}
                        className="min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 px-3 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:text-red-600 cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void onReviewProof(prf.id, 'approved');
                          showToast(`Confirmed ${formatPHP(prf.amount, true)} for ${activeStore.name}.`);
                        }}
                        className="min-h-[38px] rounded-xl bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                      >
                        Confirm Payment
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {storeProofs.length === 0 && (
                <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                  No payment proofs submitted for {activeStore.name} yet.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Store Debtors ({storeCredits.length})
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Cutoffs: {activeStore.dueDays?.[0] ?? 15}th &amp; {activeStore.dueDays?.[1] ?? 30}th
                </p>
              </div>
              {storeCredits.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    void onSendStoreDebtReminders(activeStore, storeCredits);
                    showToast(`Sent cutoff reminders for ${activeStore.name}.`);
                  }}
                  className="min-h-[34px] inline-flex items-center gap-1.5 rounded-xl bg-stone-900 dark:bg-teal-700 px-3 text-xs font-semibold text-white cursor-pointer"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span>Remind All</span>
                </button>
              )}
            </div>
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {storeCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="px-5 py-3.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-stone-900 dark:text-stone-100">
                      {credit.userName}
                    </div>
                    <div className="text-stone-500 dark:text-stone-400">
                      Paid so far: {formatPHP(credit.totalPaid ?? 0)}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm tabular-nums">
                    {formatPHP(credit.balance, true)}
                  </div>
                </div>
              ))}
              {storeCredits.length === 0 && (
                <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                  No customers currently owe a balance to {activeStore.name}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: ASSIGNED DELIVERY STAFF */}
      {subTab === 'delivery' && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Assigned Delivery Staff for {activeStore.name}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Delivery runners are assigned in Developer Settings. Runners see approved Desk Delivery orders from {activeStore.name} and earn {platformConfig.deliveryCommissionRate}% of the {formatPHP(activeStore.deliveryFee)} delivery fee.
            </p>
          </div>
          {assignedRunners.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
              No delivery staff currently assigned to {activeStore.name}. Ask Super Admin to assign a runner in Developer Settings.
            </div>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {assignedRunners.map((r) => (
                <div
                  key={r.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {r.name}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        {r.department}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-5 text-xs tabular-nums">
                    <div>
                      <div className="text-stone-500 dark:text-stone-400">Delivered</div>
                      <div className="font-bold text-stone-900 dark:text-stone-100">
                        {r.deliveredCount} / {r.totalAssignedOrders}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500 dark:text-stone-400">COD Collected</div>
                      <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {formatPHP(r.cashHeld, true)}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500 dark:text-stone-400">Commission Accrued</div>
                      <div className="font-mono font-bold text-teal-700 dark:text-teal-400">
                        {formatPHP(r.commissionSum, true)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: CONFIDENTIAL CASH ASSISTANCE ADD-ON */}
      {subTab === 'cashAssistance' && canSeeStoreCashAssistanceTab && storeCaConfig && (
        <div className="space-y-6">
          {storeCaConfig.status === 'locked' && (
            <div className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/25 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    Confidential Cash Assistance Add-On Available for {activeStore.name}
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                    Separate from your {formatPHP(activeStore.monthlyFee)}/mo base subscription, enabling the Cash Assistance add-on costs{' '}
                    <strong>{formatPHP(storeCaConfig.monthlyFee || platformConfig.cashAssistanceMonthlyFee)}/mo</strong> and requires Admin / Super Admin approval.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={caRequestNote}
                  onChange={(e) => setCaRequestNote(e.target.value)}
                  placeholder="Optional application note (proposed interest rate or borrower rules)..."
                  className="flex-1 min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-3 text-xs text-stone-900 dark:text-stone-100"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await onRequestStoreCashAssistance(
                      activeStore.id,
                      caRequestNote.trim() || `Requesting Cash Assistance add-on for ${activeStore.name}.`
                    );
                    showToast('Cash Assistance add-on request sent for Admin approval.');
                  }}
                  className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit Add-On Application</span>
                </button>
              </div>
            </div>
          )}

          {storeCaConfig.status === 'pending_approval' && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/35 p-6">
              <h2 className="text-base font-bold text-amber-950 dark:text-amber-200">
                Cash Assistance Add-On Pending Admin Approval
              </h2>
              <p className="text-xs text-amber-900 dark:text-amber-300 mt-1">
                Submitted {storeCaConfig.requestedAt || 'recently'}. Once approved by Super Admin, you can manage Cash Assistance records isolated to {activeStore.name}.
              </p>
            </div>
          )}

          {storeCaConfig.status === 'suspended' && (
            <div className="rounded-2xl border border-red-200 dark:border-red-800/70 bg-red-50/70 dark:bg-red-950/35 p-6">
              <h2 className="text-base font-bold text-red-950 dark:text-red-200">
                Cash Assistance Add-On Suspended
              </h2>
              <p className="text-xs text-red-900 dark:text-red-300 mt-1">
                Contact Admin / Super Admin in Developer Settings to reactivate this add-on subscription.
              </p>
            </div>
          )}

          {storeCaConfig.status === 'active' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {onIssueStoreLoan && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const borrower = coworkers.find((c) => c.id === caBorrowerId);
                    if (!borrower) return;
                    await onIssueStoreLoan(
                      activeStore,
                      borrower.id,
                      borrower.name,
                      Math.max(100, Number(caPrincipal) || 500),
                      Math.max(1, Number(caMonths) || 1)
                    );
                    showToast(`Issued Cash Assistance loan for ${borrower.name} under ${activeStore.name}.`);
                  }}
                  className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4"
                >
                  <div className="flex items-center gap-2.5">
                    <Banknote className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                    <div>
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                        Issue Store Cash Assistance
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Rate: {storeCaConfig.monthlyInterestRate}%/mo · Strictly private to {activeStore.name}
                      </p>
                    </div>
                  </div>
                  <select
                    value={caBorrowerId}
                    onChange={(e) => setCaBorrowerId(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs font-semibold text-stone-900 dark:text-stone-100"
                  >
                    {coworkers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.department})
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="number"
                      min="100"
                      step="50"
                      value={caPrincipal}
                      onChange={(e) => setCaPrincipal(e.target.value)}
                      placeholder="Principal (₱)"
                      className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs font-mono text-stone-900 dark:text-stone-100"
                    />
                    <select
                      value={caMonths}
                      onChange={(e) => setCaMonths(e.target.value)}
                      className="min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs font-semibold text-stone-900 dark:text-stone-100"
                    >
                      {(storeCaConfig.availableTerms?.length
                        ? storeCaConfig.availableTerms
                        : [1, 2, 3]
                      ).map((m) => (
                        <option key={m} value={m}>
                          {m} {m === 1 ? 'Month' : 'Months'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full min-h-[42px] rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                  >
                    Record Cash Assistance
                  </button>
                </form>
              )}

              <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {activeStore.name} Cash Assistance Portfolio ({storeLoans.length})
                  </h3>
                </div>
                <div className="divide-y divide-stone-200 dark:divide-stone-800">
                  {storeLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-stone-900 dark:text-stone-100">
                          {loan.userName} · {formatPHP(loan.principal)} ({loan.months} mo)
                        </div>
                        <div className="text-stone-500 dark:text-stone-400">
                          {loan.id} · Next Due: {loan.nextDueDate} · Status: {loan.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                          {loan.remainingBalance > 0
                            ? formatPHP(loan.remainingBalance, true)
                            : 'Settled'}
                        </span>
                        {loan.remainingBalance > 0 && onMarkStoreLoanSettled && (
                          <button
                            type="button"
                            onClick={async () => {
                              await onMarkStoreLoanSettled(loan.id);
                              showToast(`Marked ${loan.id} settled.`);
                            }}
                            className="min-h-[34px] rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white cursor-pointer"
                          >
                            Mark Settled
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {storeLoans.length === 0 && (
                    <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                      No store Cash Assistance records yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: STORE CONFIG & PAYMENT METHODS */}
      {subTab === 'config' && (
        <form
          onSubmit={(e) => void handleSaveConfig(e)}
          className="space-y-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6"
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Store Configuration &amp; Accepted Payments ({activeStore.name})
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Customize your store&apos;s branding, delivery fee, cutoff schedule, and payout QR codes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Store Name
              </label>
              <input
                type="text"
                required
                value={cfgName}
                onChange={(e) => setCfgName(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Store Description
              </label>
              <input
                type="text"
                value={cfgDesc}
                onChange={(e) => setCfgDesc(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm text-stone-900 dark:text-stone-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Store Announcement
              </label>
              <input
                type="text"
                value={cfgAnnounce}
                onChange={(e) => setCfgAnnounce(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Delivery Mode
              </label>
              <button
                type="button"
                onClick={() => setCfgDeliveryEnabled((p) => !p)}
                className={`w-full min-h-[40px] rounded-xl border text-xs font-semibold cursor-pointer ${
                  cfgDeliveryEnabled
                    ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                    : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                }`}
              >
                {cfgDeliveryEnabled ? 'Desk Delivery On' : 'Pick Up Only'}
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Delivery Fee (₱)
              </label>
              <input
                type="number"
                min="0"
                value={cfgDeliveryFee}
                onChange={(e) => setCfgDeliveryFee(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Cutoff Day 1
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={cfgDue1}
                onChange={(e) => setCfgDue1(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Cutoff Day 2
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={cfgDue2}
                onChange={(e) => setCfgDue2(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>Store Payment Channels</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cfgMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#172523] p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {pm.title}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCfgMethods((prev) =>
                          prev.map((m) => (m.id === pm.id ? { ...m, enabled: !m.enabled } : m))
                        )
                      }
                      className={`min-h-[30px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                        pm.enabled
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {pm.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  {pm.type === 'digital' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={pm.accountNumber ?? ''}
                        onChange={(e) =>
                          setCfgMethods((prev) =>
                            prev.map((m) =>
                              m.id === pm.id ? { ...m, accountNumber: e.target.value } : m
                            )
                          )
                        }
                        placeholder="Account No."
                        className="min-h-[34px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs font-mono text-stone-900 dark:text-stone-100"
                      />
                      <input
                        type="text"
                        value={pm.accountName ?? ''}
                        onChange={(e) =>
                          setCfgMethods((prev) =>
                            prev.map((m) =>
                              m.id === pm.id ? { ...m, accountName: e.target.value } : m
                            )
                          )
                        }
                        placeholder="Account Name"
                        className="min-h-[34px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="text"
                value={newPmTitle}
                onChange={(e) => setNewPmTitle(e.target.value)}
                placeholder="Add Channel (e.g. GoTyme)"
                className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs text-stone-900 dark:text-stone-100"
              />
              <select
                value={newPmType}
                onChange={(e) => setNewPmType(e.target.value as typeof newPmType)}
                className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-2.5 text-xs text-stone-900 dark:text-stone-100"
              >
                <option value="digital">Digital Wallet</option>
                <option value="cash">Cash</option>
                <option value="debt">Credit</option>
              </select>
              <input
                type="text"
                value={newPmNumber}
                onChange={(e) => setNewPmNumber(e.target.value)}
                placeholder="Account Number"
                className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs font-mono text-stone-900 dark:text-stone-100"
              />
              <input
                type="text"
                value={newPmAccountName}
                onChange={(e) => setNewPmAccountName(e.target.value)}
                placeholder="Account Name"
                className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs text-stone-900 dark:text-stone-100"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newPmTitle.trim()) return;
                  setCfgMethods((prev) => [
                    ...prev,
                    {
                      id: `pm-${Date.now()}`,
                      title: newPmTitle.trim(),
                      type: newPmType,
                      enabled: true,
                      accountNumber: newPmNumber.trim() || undefined,
                      accountName: newPmAccountName.trim() || undefined,
                    },
                  ]);
                  setNewPmTitle('');
                  setNewPmNumber('');
                }}
                className="min-h-[36px] px-3 rounded-lg border border-teal-700 text-xs font-semibold text-teal-700 dark:text-teal-300 cursor-pointer"
              >
                + Add Channel
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[44px] rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
          >
            Save Store Configuration
          </button>
        </form>
      )}

      {/* SUBTAB: ISOLATED PER-STORE REPORTS */}
      {subTab === 'reports' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {activeStore.name} Financial &amp; Operations Report
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Strict store-scoped breakdown: Cash Sales, E-Wallet, Store Credit, COGS/Profit, Delivery Commissions, and Stock Adjustments.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportStoreExcel}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportStorePdf}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-stone-900 dark:bg-teal-700 px-4 text-xs font-semibold text-white cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">Total Revenue</div>
              <div className="mt-1 text-xl font-bold font-mono text-stone-900 dark:text-stone-100">
                {formatPHP(storeMetrics.totalOrdersRevenue, true)}
              </div>
              <div className="text-[11px] text-stone-500">{storeMetrics.totalOrders} valid orders</div>
            </div>
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">Credit Issued / Paid</div>
              <div className="mt-1 text-xl font-bold font-mono text-amber-700 dark:text-amber-400">
                {formatPHP(storeMetrics.creditIssued, true)}
              </div>
              <div className="text-[11px] text-stone-500">
                Collected: {formatPHP(storeMetrics.creditCollected)}
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">Delivery Commissions</div>
              <div className="mt-1 text-xl font-bold font-mono text-teal-700 dark:text-teal-400">
                {formatPHP(storeMetrics.runnerCommissions, true)}
              </div>
              <div className="text-[11px] text-stone-500">Paid to assigned runners</div>
            </div>
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4">
              <div className="text-xs text-stone-500 dark:text-stone-400">Stock Adjustments</div>
              <div className="mt-1 text-xl font-bold font-mono text-stone-900 dark:text-stone-100">
                {storeAdjustments.length}
              </div>
              <div className="text-[11px] text-stone-500">Logged store movements</div>
            </div>
          </div>
        </div>
      )}

      {/* ADOPT SHARED CATALOG MODAL */}
      {adoptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl space-y-4 my-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Adopt Shared Catalog Item into {activeStore.name}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Choose any existing product (e.g. Nova) created by another store and set {activeStore.name}&apos;s own cost, price, and inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdoptModalOpen(false);
                  setSelectedTemplate(null);
                }}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedTemplate ? (
              <form onSubmit={(e) => void handleAdoptConfirm(e)} className="space-y-4">
                <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/30 p-3.5 text-xs">
                  <div className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                    {selectedTemplate.name}
                  </div>
                  <div className="text-stone-600 dark:text-stone-400 mt-0.5">
                    {selectedTemplate.category} · Original template from {selectedTemplate.createdByStoreName}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Your Unit Cost (₱)
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={adoptCost}
                      onChange={(e) => setAdoptCost(e.target.value)}
                      className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Your Price (₱)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={adoptPrice}
                      onChange={(e) => setAdoptPrice(e.target.value)}
                      className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={adoptStock}
                      onChange={(e) => setAdoptStock(e.target.value)}
                      className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(null)}
                    className="min-h-[38px] px-4 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="min-h-[38px] px-4 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                  >
                    Add Listing to {activeStore.name}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <input
                  type="search"
                  value={adoptSearch}
                  onChange={(e) => setAdoptSearch(e.target.value)}
                  placeholder="Search shared items (e.g. Nova)..."
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 text-xs text-stone-900 dark:text-stone-100"
                />
                <div className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl max-h-72 overflow-y-auto">
                  {adoptableTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                          {tpl.name}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {tpl.category} · Suggested {formatPHP(tpl.suggestedPrice)} · By {tpl.createdByStoreName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplate(tpl);
                          setAdoptPrice(String(tpl.suggestedPrice));
                          setAdoptCost(String(Math.max(1, Math.round(tpl.suggestedPrice * 0.7))));
                          setAdoptStock('20');
                        }}
                        className="min-h-[34px] px-3 rounded-lg bg-teal-700 text-xs font-semibold text-white shrink-0 cursor-pointer"
                      >
                        Adopt
                      </button>
                    </div>
                  ))}
                  {adoptableTemplates.length === 0 && (
                    <div className="p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                      All matching shared catalog items are already in {activeStore.name}.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COST HISTORY MODAL */}
      {latestHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl space-y-4 my-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Cost History · {latestHistoryItem.name}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {activeStore.name} · Cost: {formatPHP(latestHistoryItem.costPrice)} · Selling: {formatPHP(latestHistoryItem.price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCostHistoryItem(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateItemPricing(
                  latestHistoryItem.id,
                  Math.max(1, Number(editSellInput) || 1),
                  Math.max(0, Number(editCostInput) || 0),
                  editCostNote.trim() || `Updated by ${currentUser.name}`
                );
                setEditCostNote('');
                showToast(`Updated cost & price for ${latestHistoryItem.name}.`);
              }}
              className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="number"
                  min="0"
                  required
                  value={editCostInput}
                  onChange={(e) => setEditCostInput(e.target.value)}
                  placeholder="Unit Cost"
                  className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs font-mono text-stone-900 dark:text-stone-100"
                />
                <input
                  type="number"
                  min="1"
                  required
                  value={editSellInput}
                  onChange={(e) => setEditSellInput(e.target.value)}
                  placeholder="Selling Price"
                  className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs font-mono text-stone-900 dark:text-stone-100"
                />
              </div>
              <input
                type="text"
                value={editCostNote}
                onChange={(e) => setEditCostNote(e.target.value)}
                placeholder="Note (e.g. New wholesale batch)"
                className="w-full min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] px-2.5 text-xs text-stone-900 dark:text-stone-100"
              />
              <button
                type="submit"
                className="w-full min-h-[36px] rounded-lg bg-teal-700 text-xs font-semibold text-white cursor-pointer"
              >
                Save Pricing &amp; Append History
              </button>
            </form>
            <div className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl max-h-52 overflow-y-auto">
              {[...(latestHistoryItem.costHistory ?? [])].reverse().map((entry) => (
                <div key={entry.id} className="p-3 text-xs flex justify-between gap-2">
                  <div>
                    <div className="font-semibold text-stone-900 dark:text-stone-100">
                      Cost {formatPHP(entry.costPrice)} → Sell {formatPHP(entry.sellingPrice)}
                    </div>
                    <div className="text-stone-500">
                      {entry.note} · {entry.updatedBy}
                    </div>
                  </div>
                  <span className="font-mono text-stone-400">{entry.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        title="Scan Barcode"
        subtitle={`Attach packaging barcode for ${activeStore.name}`}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onDetected={(code) => {
          setNewBarcode(code.slice(0, 64));
          setIsBarcodeScannerOpen(false);
        }}
      />
      <ImagePreviewModal
        preview={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};
