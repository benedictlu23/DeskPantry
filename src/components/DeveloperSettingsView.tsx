import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  HardDrive,
  Image as ImageIcon,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Terminal,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  CashAssistanceSubscriptionStatus,
  EWalletPost,
  InternalApp,
  MarketplaceListing,
  PaymentProof,
  PlatformConfig,
  StoreApplication,
  StoreCashAssistanceConfig,
  StoreConfig,
  StoreItem,
  StoreProfile,
  StoreSubscriptionStatus,
  UserAccount,
  UserRole,
} from '../types';
import { formatPHP } from '../utils/format';

export type MediaSourceCategory =
  | 'all'
  | 'proof'
  | 'store'
  | 'marketplace'
  | 'ewallet'
  | 'app'
  | 'paymentMethod';

export interface MediaAssetEntry {
  key: string;
  source: Exclude<MediaSourceCategory, 'all'>;
  sourceLabel: string;
  recordId: string;
  subRecordId?: string;
  paymentField?: 'qrCodeImage' | 'iconImage';
  title: string;
  subtitle: string;
  src: string;
  storageKind: 'uploaded' | 'external' | 'preset';
  byteSize: number;
  statusTag?: string;
}

interface DeveloperSettingsViewProps {
  currentRole: UserRole;
  storeItems: StoreItem[];
  listings: MarketplaceListing[];
  proofs: PaymentProof[];
  ewalletPosts: EWalletPost[];
  apps: InternalApp[];
  storeConfig: StoreConfig;
  platformConfig: PlatformConfig;
  stores: StoreProfile[];
  storeCashAssistance: StoreCashAssistanceConfig[];
  storeApplications: StoreApplication[];
  users: UserAccount[];
  onSavePlatformConfig: (next: PlatformConfig) => Promise<void> | void;
  onApproveStoreApplication: (appId: string) => Promise<void> | void;
  onRejectStoreApplication: (appId: string) => Promise<void> | void;
  onUpdateStoreSubscriptionStatus: (
    storeId: string,
    status: StoreSubscriptionStatus
  ) => Promise<void> | void;
  onToggleStoreCashAssistanceVisibility: (
    storeId: string,
    visible: boolean
  ) => Promise<void> | void;
  onReviewStoreCashAssistance: (
    storeId: string,
    status: CashAssistanceSubscriptionStatus
  ) => Promise<void> | void;
  onUpdateStoreDeliveryStaff: (
    storeId: string,
    staffIds: string[]
  ) => Promise<void> | void;
  onDeleteMediaAsset: (asset: MediaAssetEntry) => Promise<void>;
  onBulkDeleteMediaAssets: (assets: MediaAssetEntry[]) => Promise<void>;
  onExitPreview?: () => void;
}

function classifyImageSource(src: string): 'uploaded' | 'external' | 'preset' {
  const trimmed = src.trim();
  if (trimmed.startsWith('data:image/')) return 'uploaded';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 'external';
  return 'preset';
}

function measureStringBytes(value: string): number {
  if (!value) return 0;
  try {
    return new Blob([value]).size;
  } catch {
    return value.length;
  }
}

function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const DeveloperSettingsView: React.FC<DeveloperSettingsViewProps> = ({
  currentRole,
  storeItems,
  listings,
  proofs,
  ewalletPosts,
  apps,
  storeConfig,
  platformConfig,
  stores,
  storeCashAssistance,
  storeApplications,
  users,
  onSavePlatformConfig,
  onApproveStoreApplication,
  onRejectStoreApplication,
  onUpdateStoreSubscriptionStatus,
  onToggleStoreCashAssistanceVisibility,
  onReviewStoreCashAssistance,
  onUpdateStoreDeliveryStaff,
  onDeleteMediaAsset,
  onBulkDeleteMediaAssets,
  onExitPreview,
}) => {
  const isSuperAdmin = currentRole === UserRole.SuperAdmin;
  const isAuthorized =
    currentRole === UserRole.Admin || currentRole === UserRole.SuperAdmin;

  const [devTab, setDevTab] = useState<'platform' | 'media'>(
    isSuperAdmin ? 'platform' : 'media'
  );

  // Platform fees state
  const [baseFeeInput, setBaseFeeInput] = useState(
    String(platformConfig.baseStoreMonthlyFee)
  );
  const [cashAssistFeeInput, setCashAssistFeeInput] = useState(
    String(platformConfig.cashAssistanceMonthlyFee)
  );
  const [dueDay1Input, setDueDay1Input] = useState(
    String(platformConfig.defaultDueDays[0] ?? 15)
  );
  const [dueDay2Input, setDueDay2Input] = useState(
    String(platformConfig.defaultDueDays[1] ?? 30)
  );
  const [deliveryFeeInput, setDeliveryFeeInput] = useState(
    String(platformConfig.defaultDeliveryFee ?? 15)
  );
  const [commissionRateInput, setCommissionRateInput] = useState(
    String(platformConfig.deliveryCommissionRate ?? 100)
  );
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  useEffect(() => {
    setBaseFeeInput(String(platformConfig.baseStoreMonthlyFee));
    setCashAssistFeeInput(String(platformConfig.cashAssistanceMonthlyFee));
    setDueDay1Input(String(platformConfig.defaultDueDays[0] ?? 15));
    setDueDay2Input(String(platformConfig.defaultDueDays[1] ?? 30));
    setDeliveryFeeInput(String(platformConfig.defaultDeliveryFee ?? 15));
    setCommissionRateInput(String(platformConfig.deliveryCommissionRate ?? 100));
  }, [platformConfig]);

  // Media manager state
  const [sourceFilter, setSourceFilter] = useState<MediaSourceCategory>('all');
  const [onlyUploaded, setOnlyUploaded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaAssetEntry | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const deliveryStaffUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === UserRole.DeliveryStaff ||
          u.role === UserRole.Admin ||
          u.role === UserRole.SuperAdmin
      ),
    [users]
  );

  const pendingApplications = useMemo(
    () => storeApplications.filter((a) => a.status === 'pending'),
    [storeApplications]
  );

  const allAssets = useMemo<MediaAssetEntry[]>(() => {
    const list: MediaAssetEntry[] = [];

    for (const prf of proofs) {
      if (!prf.imageDataUrl?.trim()) continue;
      list.push({
        key: `proof-${prf.id}`,
        source: 'proof',
        sourceLabel: 'Payment Proof',
        recordId: prf.id,
        title: `${prf.userName} · ${prf.channel} Receipt`,
        subtitle: `${prf.purpose} · Ref ${prf.referenceNo} · ${prf.submittedAt}`,
        src: prf.imageDataUrl,
        storageKind: classifyImageSource(prf.imageDataUrl),
        byteSize: measureStringBytes(prf.imageDataUrl),
        statusTag: prf.status,
      });
    }

    for (const item of storeItems) {
      if (!item.image?.trim()) continue;
      list.push({
        key: `store-${item.id}`,
        source: 'store',
        sourceLabel: 'Store Item',
        recordId: item.id,
        title: `${item.name}${item.storeName ? ` (${item.storeName})` : ''}`,
        subtitle: `${item.category} · ${item.stock} in stock`,
        src: item.image,
        storageKind: classifyImageSource(item.image),
        byteSize: measureStringBytes(item.image),
      });
    }

    for (const listing of listings) {
      if (!listing.image?.trim()) continue;
      list.push({
        key: `listing-${listing.id}`,
        source: 'marketplace',
        sourceLabel: 'Community Item',
        recordId: listing.id,
        title: listing.title,
        subtitle: `Seller: ${listing.sellerName} · ${listing.createdAt}`,
        src: listing.image,
        storageKind: classifyImageSource(listing.image),
        byteSize: measureStringBytes(listing.image),
        statusTag: listing.approvalStatus,
      });
    }

    for (const post of ewalletPosts) {
      for (const comment of post.comments ?? []) {
        if (!comment.imageDataUrl?.trim()) continue;
        list.push({
          key: `ewallet-${post.id}-${comment.id}`,
          source: 'ewallet',
          sourceLabel: 'E-Wallet Comment',
          recordId: post.id,
          subRecordId: comment.id,
          title: `${comment.userName} on ${post.walletProvider} (${post.authorName})`,
          subtitle: `${comment.createdAt} · "${comment.text.slice(0, 60)}"`,
          src: comment.imageDataUrl,
          storageKind: classifyImageSource(comment.imageDataUrl),
          byteSize: measureStringBytes(comment.imageDataUrl),
          statusTag: post.status,
        });
      }
    }

    for (const app of apps) {
      if (!app.image?.trim()) continue;
      list.push({
        key: `app-${app.id}`,
        source: 'app',
        sourceLabel: 'Department App',
        recordId: app.id,
        title: app.name,
        subtitle: `${app.platform} · ${app.version}`,
        src: app.image,
        storageKind: classifyImageSource(app.image),
        byteSize: measureStringBytes(app.image),
      });
    }

    for (const pm of storeConfig.paymentMethods ?? []) {
      if (pm.qrCodeImage?.trim()) {
        list.push({
          key: `pm-qr-${pm.id}`,
          source: 'paymentMethod',
          sourceLabel: 'Payment QR Code',
          recordId: pm.id,
          paymentField: 'qrCodeImage',
          title: `${pm.title} · QR Code`,
          subtitle: pm.accountNumber
            ? `${pm.accountName || ''} (${pm.accountNumber})`
            : 'Storefront checkout QR',
          src: pm.qrCodeImage,
          storageKind: classifyImageSource(pm.qrCodeImage),
          byteSize: measureStringBytes(pm.qrCodeImage),
        });
      }
      if (pm.iconImage?.trim()) {
        list.push({
          key: `pm-icon-${pm.id}`,
          source: 'paymentMethod',
          sourceLabel: 'Payment Icon',
          recordId: pm.id,
          paymentField: 'iconImage',
          title: `${pm.title} · Wallet Icon`,
          subtitle: 'Payment method badge image',
          src: pm.iconImage,
          storageKind: classifyImageSource(pm.iconImage),
          byteSize: measureStringBytes(pm.iconImage),
        });
      }
    }

    return list.sort((a, b) => b.byteSize - a.byteSize);
  }, [proofs, storeItems, listings, ewalletPosts, apps, storeConfig.paymentMethods]);

  const uploadedAssets = useMemo(
    () => allAssets.filter((a) => a.storageKind === 'uploaded'),
    [allAssets]
  );
  const totalUploadedBytes = useMemo(
    () => uploadedAssets.reduce((sum, a) => sum + a.byteSize, 0),
    [uploadedAssets]
  );
  const totalProofBytes = useMemo(
    () =>
      allAssets
        .filter((a) => a.source === 'proof' && a.storageKind === 'uploaded')
        .reduce((sum, a) => sum + a.byteSize, 0),
    [allAssets]
  );

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allAssets.filter((asset) => {
      if (onlyUploaded && asset.storageKind !== 'uploaded') return false;
      if (sourceFilter !== 'all' && asset.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        asset.title.toLowerCase().includes(q) ||
        asset.subtitle.toLowerCase().includes(q) ||
        asset.sourceLabel.toLowerCase().includes(q)
      );
    });
  }, [allAssets, onlyUploaded, sourceFilter, searchQuery]);

  const deletableFilteredAssets = useMemo(
    () => filteredAssets.filter((a) => a.storageKind === 'uploaded'),
    [filteredAssets]
  );
  const deletableFilteredBytes = useMemo(
    () => deletableFilteredAssets.reduce((sum, a) => sum + a.byteSize, 0),
    [deletableFilteredAssets]
  );

  if (!isAuthorized) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center space-y-3">
        <Terminal className="w-8 h-8 text-stone-400 mx-auto" />
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Admin &amp; Developer Access Required
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          Platform Settings, Multi-Store Governance, and Media Storage management are restricted to Admin and Super Admin accounts.
        </p>
        {onExitPreview && (
          <button
            type="button"
            onClick={onExitPreview}
            className="min-h-[40px] rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
          >
            Exit Role Preview
          </button>
        )}
      </div>
    );
  }

  const handleSavePlatformFees = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlatform(true);
    setFeedback(null);
    try {
      const nextConfig: PlatformConfig = {
        baseStoreMonthlyFee: Math.max(0, Number(baseFeeInput) || 0),
        cashAssistanceMonthlyFee: Math.max(0, Number(cashAssistFeeInput) || 0),
        defaultDueDays: [
          Math.min(28, Math.max(1, Number(dueDay1Input) || 15)),
          Math.min(31, Math.max(1, Number(dueDay2Input) || 30)),
        ],
        defaultDeliveryFee: Math.max(0, Number(deliveryFeeInput) || 0),
        deliveryCommissionRate: Math.min(100, Math.max(0, Number(commissionRateInput) || 100)),
      };
      await onSavePlatformConfig(nextConfig);
      setFeedback({
        type: 'success',
        message: `Platform fees & rules saved (Base Store: ${formatPHP(
          nextConfig.baseStoreMonthlyFee
        )}/mo · Cash Assistance Add-On: ${formatPHP(nextConfig.cashAssistanceMonthlyFee)}/mo).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to save platform config.',
      });
    } finally {
      setSavingPlatform(false);
    }
  };

  const runGovernanceAction = async (
    actionKey: string,
    fn: () => Promise<void> | void,
    successMsg: string
  ) => {
    setBusyActionId(actionKey);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ type: 'success', message: successMsg });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Action failed.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDeleteSingle = async (asset: MediaAssetEntry) => {
    setDeletingKey(asset.key);
    setFeedback(null);
    try {
      await onDeleteMediaAsset(asset);
      setFeedback({
        type: 'success',
        message: `Removed "${asset.title}" image (${formatStorageBytes(asset.byteSize)} freed).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to delete media asset.',
      });
    } finally {
      setDeletingKey(null);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (deletableFilteredAssets.length === 0) return;
    setIsBulkDeleting(true);
    setFeedback(null);
    try {
      const count = deletableFilteredAssets.length;
      const freed = deletableFilteredBytes;
      await onBulkDeleteMediaAssets(deletableFilteredAssets);
      setConfirmBulkOpen(false);
      setFeedback({
        type: 'success',
        message: `Removed ${count} uploaded image${count === 1 ? '' : 's'} (${formatStorageBytes(freed)} freed from Firestore).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to clear selected media.',
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const sourceOptions: { id: MediaSourceCategory; label: string; count: number }[] = [
    { id: 'all', label: 'All Sources', count: allAssets.length },
    { id: 'proof', label: 'Payment Proofs', count: allAssets.filter((a) => a.source === 'proof').length },
    { id: 'store', label: 'Store Items', count: allAssets.filter((a) => a.source === 'store').length },
    { id: 'marketplace', label: 'Community Items', count: allAssets.filter((a) => a.source === 'marketplace').length },
    { id: 'ewallet', label: 'E-Wallet Receipts', count: allAssets.filter((a) => a.source === 'ewallet').length },
    { id: 'app', label: 'Department Apps', count: allAssets.filter((a) => a.source === 'app').length },
    { id: 'paymentMethod', label: 'Payment QR/Icons', count: allAssets.filter((a) => a.source === 'paymentMethod').length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400">
            <Terminal className="w-3.5 h-3.5" />
            <span>Developer Settings</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Platform Governance &amp; Media Storage
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Configure multi-store subscription fees, review store applications, control confidential Cash Assistance visibility, assign delivery staff, and prune Firestore media.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#121D1B] border border-stone-200 dark:border-stone-800 self-start">
          <button
            type="button"
            onClick={() => setDevTab('platform')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
              devTab === 'platform'
                ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>
              Platform Fees &amp; Stores
              {pendingApplications.length > 0 ? ` (${pendingApplications.length})` : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDevTab('media')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
              devTab === 'media'
                ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Media Storage ({uploadedAssets.length})</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 text-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200'
          }`}
        >
          <span className="inline-flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: PLATFORM FEES & MULTI-STORE GOVERNANCE */}
      {devTab === 'platform' && (
        <div className="space-y-6">
          {/* Platform Fees & Rules Form */}
          <form
            onSubmit={(e) => void handleSavePlatformFees(e)}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    Subscription Pricing &amp; Platform Defaults
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Set separate monthly fees for Base Store storefronts vs the confidential Cash Assistance add-on, plus cutoff &amp; delivery defaults.
                  </p>
                </div>
              </div>
              {!isSuperAdmin && (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Super Admin required to modify platform pricing
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Base Store Monthly Fee (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!isSuperAdmin}
                  value={baseFeeInput}
                  onChange={(e) => setBaseFeeInput(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100 disabled:opacity-60"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Cash Assistance Add-On Fee (₱/mo)
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!isSuperAdmin}
                  value={cashAssistFeeInput}
                  onChange={(e) => setCashAssistFeeInput(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Default Delivery Fee (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!isSuperAdmin}
                  value={deliveryFeeInput}
                  onChange={(e) => setDeliveryFeeInput(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Runner Share (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={!isSuperAdmin}
                  value={commissionRateInput}
                  onChange={(e) => setCommissionRateInput(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100 disabled:opacity-60"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Cutoff Day 1
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    disabled={!isSuperAdmin}
                    value={dueDay1Input}
                    onChange={(e) => setDueDay1Input(e.target.value)}
                    className="w-24 min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100 disabled:opacity-60"
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
                    disabled={!isSuperAdmin}
                    value={dueDay2Input}
                    onChange={(e) => setDueDay2Input(e.target.value)}
                    className="w-24 min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-sm font-mono text-stone-900 dark:text-stone-100 disabled:opacity-60"
                  />
                </div>
              </div>

              {isSuperAdmin && (
                <button
                  type="submit"
                  disabled={savingPlatform}
                  className="min-h-[42px] rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                >
                  {savingPlatform ? 'Saving...' : 'Save Platform Pricing & Rules'}
                </button>
              )}
            </div>
          </form>

          {/* Store Applications Review Queue */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Coworker Store Applications ({storeApplications.length})
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Approving provisions a dedicated Store Profile with Cash Assistance strictly locked &amp; hidden by default.
                </p>
              </div>
              {pendingApplications.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  {pendingApplications.length} Pending
                </span>
              )}
            </div>

            {storeApplications.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                No coworker store applications submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-stone-200 dark:divide-stone-800">
                {storeApplications.map((app) => (
                  <div
                    key={app.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-stone-500 dark:text-stone-400">
                          {app.createdAt}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold ${
                            app.status === 'approved'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : app.status === 'rejected'
                                ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {app.status}
                        </span>
                        <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                          Quoted: {formatPHP(app.quotedBaseFee)}/mo
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                        {app.storeName} · Applicant: {app.applicantName}
                      </h3>
                      <p className="text-xs text-stone-600 dark:text-stone-400">
                        {app.description}
                      </p>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        Department: <strong>{app.applicantDepartment}</strong> · Payment Channels:{' '}
                        <strong>{app.paymentChannels}</strong>
                      </div>
                    </div>

                    {app.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyActionId === `reject-${app.id}`}
                          onClick={() =>
                            void runGovernanceAction(
                              `reject-${app.id}`,
                              () => onRejectStoreApplication(app.id),
                              `Declined store application "${app.storeName}".`
                            )
                          }
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyActionId === `approve-${app.id}`}
                          onClick={() =>
                            void runGovernanceAction(
                              `approve-${app.id}`,
                              () => onApproveStoreApplication(app.id),
                              `Approved & provisioned store "${app.storeName}" for ${app.applicantName}.`
                            )
                          }
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve &amp; Provision Store</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Stores Governance Table/Cards */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Active Stores, Cash Assistance Confidentiality &amp; Delivery Runners ({stores.length})
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Manage each store&apos;s base subscription, toggle whether its owner can see the confidential Cash Assistance add-on, review add-on subscriptions, and assign multi-store delivery runners.
              </p>
            </div>

            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {stores.map((store) => {
                const ca = storeCashAssistance.find((c) => c.storeId === store.id);
                const caStatus = ca?.status ?? 'locked';
                const caVisible = ca?.visibleToOwner ?? false;

                return (
                  <div key={store.id} className="p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                            {store.name}
                          </h3>
                          <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
                            ({store.id})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              store.subscriptionStatus === 'active'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : store.subscriptionStatus === 'past_due'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                            }`}
                          >
                            Base Sub: {store.subscriptionStatus}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              caStatus === 'active'
                                ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                                : caStatus === 'pending_approval'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                            }`}
                          >
                            Cash Assist Add-On: {caStatus}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400">
                          Owner: <strong>{store.ownerName}</strong> · Base Fee: {formatPHP(store.monthlyFee)}/mo · Delivery:{' '}
                          {store.deliveryEnabled ? `${formatPHP(store.deliveryFee)}` : 'Disabled'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Subscription status for ${store.name}`}
                          value={store.subscriptionStatus}
                          onChange={(e) =>
                            void runGovernanceAction(
                              `sub-${store.id}`,
                              () =>
                                onUpdateStoreSubscriptionStatus(
                                  store.id,
                                  e.target.value as StoreSubscriptionStatus
                                ),
                              `Updated ${store.name} base subscription to ${e.target.value}.`
                            )
                          }
                          className="min-h-[36px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs font-semibold text-stone-800 dark:text-stone-200"
                        >
                          <option value="active">Base: Active</option>
                          <option value="past_due">Base: Past Due</option>
                          <option value="suspended">Base: Suspended</option>
                        </select>

                        <button
                          type="button"
                          disabled={busyActionId === `vis-${store.id}`}
                          onClick={() =>
                            void runGovernanceAction(
                              `vis-${store.id}`,
                              () => onToggleStoreCashAssistanceVisibility(store.id, !caVisible),
                              `${!caVisible ? 'Revealed' : 'Hidden'} Cash Assistance module for ${store.ownerName} (${store.name}).`
                            )
                          }
                          className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold cursor-pointer ${
                            caVisible
                              ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200'
                              : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-stone-600 dark:text-stone-300'
                          }`}
                        >
                          {caVisible ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Visible to Store Owner</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Hidden from Store Owner</span>
                            </>
                          )}
                        </button>

                        {(caStatus === 'pending_approval' || caStatus === 'locked' || caStatus === 'suspended') && (
                          <button
                            type="button"
                            disabled={busyActionId === `ca-act-${store.id}`}
                            onClick={() =>
                              void runGovernanceAction(
                                `ca-act-${store.id}`,
                                () => onReviewStoreCashAssistance(store.id, 'active'),
                                `Activated Cash Assistance Add-On for ${store.name}.`
                              )
                            }
                            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>
                              {caStatus === 'pending_approval'
                                ? 'Approve Add-On'
                                : 'Activate Cash Assist'}
                            </span>
                          </button>
                        )}

                        {caStatus === 'active' && (
                          <button
                            type="button"
                            disabled={busyActionId === `ca-susp-${store.id}`}
                            onClick={() =>
                              void runGovernanceAction(
                                `ca-susp-${store.id}`,
                                () => onReviewStoreCashAssistance(store.id, 'suspended'),
                                `Suspended Cash Assistance Add-On for ${store.name}.`
                              )
                            }
                            className="min-h-[36px] rounded-xl border border-red-200 dark:border-red-800 px-3 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                          >
                            Suspend Add-On
                          </button>
                        )}
                      </div>
                    </div>

                    {ca?.requestNote && caStatus === 'pending_approval' && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-200">
                        <strong>Add-On Request Note:</strong> {ca.requestNote}
                      </div>
                    )}

                    {/* Multi-store Delivery Staff Assignment */}
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#172523] p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200">
                        <Truck className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                        <span>Assigned Delivery Staff for {store.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {deliveryStaffUsers.map((runner) => {
                          const assigned = (store.assignedDeliveryStaffIds ?? []).includes(
                            runner.id
                          );
                          return (
                            <label
                              key={`${store.id}-${runner.id}`}
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                                assigned
                                  ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                                  : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] text-stone-600 dark:text-stone-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={assigned}
                                onChange={() => {
                                  const curr = store.assignedDeliveryStaffIds ?? [];
                                  const next = assigned
                                    ? curr.filter((id) => id !== runner.id)
                                    : [...curr, runner.id];
                                  void runGovernanceAction(
                                    `staff-${store.id}-${runner.id}`,
                                    () => onUpdateStoreDeliveryStaff(store.id, next),
                                    `Updated delivery staff assignment for ${store.name}.`
                                  );
                                }}
                                className="accent-teal-700"
                              />
                              <span>
                                {runner.name} ({runner.role === UserRole.DeliveryStaff ? 'Runner' : runner.role})
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEDIA STORAGE MANAGER */}
      {devTab === 'media' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Media Storage Manager
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Inspect every uploaded photo, QR code, and receipt stored in Firestore and remove unused images to save space.
              </p>
            </div>
            {deletableFilteredAssets.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmBulkOpen((prev) => !prev)}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/70 whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>
                  Clear Filtered Uploads ({deletableFilteredAssets.length} ·{' '}
                  {formatStorageBytes(deletableFilteredBytes)})
                </span>
              </button>
            )}
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
                <span>Uploaded Media Payload</span>
                <HardDrive className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                {formatStorageBytes(totalUploadedBytes)}
              </div>
              <div className="mt-1 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                {uploadedAssets.length} base64 uploaded image{uploadedAssets.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
                <span>Receipt &amp; Proof Uploads</span>
                <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                {formatStorageBytes(totalProofBytes)}
              </div>
              <div className="mt-1 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                {allAssets.filter((a) => a.source === 'proof').length} payment proof attachment
                {allAssets.filter((a) => a.source === 'proof').length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
                <span>Total Tracked Media Entries</span>
                <ImageIcon className="w-4 h-4 text-stone-500 dark:text-stone-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                {allAssets.length}
              </div>
              <div className="mt-1 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                {allAssets.length - uploadedAssets.length} external/preset asset link
                {allAssets.length - uploadedAssets.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {confirmBulkOpen && deletableFilteredAssets.length > 0 && (
            <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-red-900 dark:text-red-200">
                <strong>Confirm Storage Cleanup:</strong> Delete{' '}
                <strong className="tabular-nums">{deletableFilteredAssets.length}</strong> uploaded
                image{deletableFilteredAssets.length === 1 ? '' : 's'} (saving{' '}
                <strong className="font-mono tabular-nums">
                  {formatStorageBytes(deletableFilteredBytes)}
                </strong>
                )? Order ledger amounts and reference numbers stay intact.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmBulkOpen(false)}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={() => void handleConfirmBulkDelete()}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {isBulkDeleting ? 'Clearing...' : 'Delete Filtered Uploads'}
                </button>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by item name, user, or reference..."
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] pl-9 pr-3 py-2 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyUploaded}
                  onChange={(e) => setOnlyUploaded(e.target.checked)}
                  className="w-4 h-4 rounded accent-teal-700"
                />
                <span>Uploaded Base64 Images Only (Saves Firestore Space)</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {sourceOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSourceFilter(opt.id);
                    setConfirmBulkOpen(false);
                  }}
                  className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    sourceFilter === opt.id
                      ? 'border-teal-700 bg-[#0F2E2A] dark:bg-teal-700 text-white'
                      : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#1E302D]'
                  }`}
                >
                  {opt.label} ({opt.count})
                </button>
              ))}
            </div>
          </div>

          {/* Media Asset List */}
          {filteredAssets.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-12 text-center space-y-2">
              <HardDrive className="w-8 h-8 text-stone-400 mx-auto" />
              <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                No media files match this filter
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {onlyUploaded
                  ? 'No uploaded Base64 images remain in this category. Toggle off "Uploaded Base64 Images Only" to inspect external URLs or catalog assets.'
                  : 'No image entries found.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => {
                const isDeleting = deletingKey === asset.key;
                return (
                  <article
                    key={asset.key}
                    className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-40 bg-stone-100 dark:bg-[#0B1211] border-b border-stone-200 dark:border-stone-800 flex items-center justify-center overflow-hidden">
                        <img
                          src={asset.src}
                          alt={asset.title}
                          referrerPolicy="no-referrer"
                          onClick={() => setPreviewAsset(asset)}
                          title="Click to preview full image"
                          className="w-full h-full object-contain cursor-pointer hover:opacity-95 transition-opacity"
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewAsset(asset)}
                          aria-label={`Preview ${asset.title}`}
                          className="absolute top-2.5 right-2.5 min-h-[32px] px-2.5 py-1 rounded-lg bg-stone-900/80 text-white text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-stone-900 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                      </div>

                      <div className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-teal-700 dark:text-teal-400">
                            {asset.sourceLabel}
                            {asset.statusTag ? ` · ${asset.statusTag}` : ''}
                          </span>
                          <span className="font-mono font-bold text-stone-700 dark:text-stone-200 tabular-nums">
                            {asset.storageKind === 'uploaded'
                              ? formatStorageBytes(asset.byteSize)
                              : asset.storageKind === 'external'
                                ? 'External URL'
                                : 'Preset Asset'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                          {asset.title}
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {asset.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-stone-400 truncate">
                        {asset.recordId}
                      </span>
                      <button
                        type="button"
                        disabled={isDeleting || isBulkDeleting}
                        onClick={() => void handleDeleteSingle(asset)}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/70 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{isDeleting ? 'Removing...' : 'Delete Image'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Preview Modal */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4 backdrop-blur-xs"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                  {previewAsset.title}
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                  {previewAsset.sourceLabel} ·{' '}
                  {previewAsset.storageKind === 'uploaded'
                    ? formatStorageBytes(previewAsset.byteSize)
                    : previewAsset.storageKind}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-stone-100 dark:bg-[#0B1211] flex items-center justify-center max-h-[70vh]">
              <img
                src={previewAsset.src}
                alt={previewAsset.title}
                referrerPolicy="no-referrer"
                className="max-h-[62vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
