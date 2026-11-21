import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardCheck,
  History,
  Minus,
  Plus,
  RefreshCw,
  ScanBarcode,
  Search,
  X,
} from 'lucide-react';
import { StockAdjustmentLog, StockAdjustmentType, StoreItem } from '../types';
import { formatPHP } from '../utils/format';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ProductImage } from './ProductImage';

interface AdminStockAdjustmentPanelProps {
  items: StoreItem[];
  stockAdjustments: StockAdjustmentLog[];
  onAdjustStock: (payload: {
    itemId: string;
    adjustmentType: 'add' | 'deduct' | 'recount';
    quantityOrCount: number;
    reason: string;
    note?: string;
  }) => Promise<StockAdjustmentLog>;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
}

const REASONS_BY_MODE: Record<'deduct' | 'add' | 'recount', string[]> = {
  deduct: [
    'Damaged / Spoiled',
    'Expired Stock',
    'Missing / Shrinkage',
    'Office Pantry Internal Use',
    'Sample / Promo Giveaway',
    'Other Write-Off',
  ],
  add: [
    'Found / Uncounted Stock',
    'Customer Return',
    'Supplier Bonus / Freebie',
    'Manual Stock Correction',
    'Other Addition',
  ],
  recount: [
    'Physical Inventory Count',
    'End-of-Day Shelf Audit',
    'Cutoff Cycle Count',
    'Reconciliation Override',
  ],
};

const TYPE_META: Record<
  StockAdjustmentType,
  { label: string; textClass: string }
> = {
  add: {
    label: 'Manual Add',
    textClass: 'text-emerald-700 dark:text-emerald-400',
  },
  deduct: {
    label: 'Deduct / Write-Off',
    textClass: 'text-red-700 dark:text-red-400',
  },
  recount: {
    label: 'Physical Recount',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  restock: {
    label: 'Restock',
    textClass: 'text-teal-700 dark:text-teal-400',
  },
};

export const AdminStockAdjustmentPanel: React.FC<AdminStockAdjustmentPanelProps> = ({
  items,
  stockAdjustments,
  onAdjustStock,
  onNotifySuccess,
  onNotifyError,
}) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [lookupQuery, setLookupQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [mode, setMode] = useState<'deduct' | 'add' | 'recount'>('deduct');
  const [qtyInput, setQtyInput] = useState<string>('1');
  const [reason, setReason] = useState<string>(REASONS_BY_MODE.deduct[0]);
  const [note, setNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // History filter state
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | StockAdjustmentType>('all');

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  // Keep reason synced to mode
  useEffect(() => {
    setReason(REASONS_BY_MODE[mode][0]);
    if (mode === 'recount' && selectedItem) {
      setQtyInput(String(selectedItem.stock));
    } else if (mode !== 'recount') {
      setQtyInput('1');
    }
  }, [mode, selectedItem?.id]);

  // Search matching items
  const matchingSuggestions = useMemo(() => {
    const q = lookupQuery.trim().toLowerCase();
    if (!q) return [];
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.id.toLowerCase() === q ||
        (i.barcode ? i.barcode.toLowerCase().includes(q) : false)
    );
  }, [items, lookupQuery]);

  const handleLookupChange = (val: string) => {
    setLookupQuery(val);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) return;
    const exactMatch = items.find(
      (i) => i.barcode && i.barcode.trim().toLowerCase() === trimmed
    );
    if (exactMatch) {
      setSelectedItemId(exactMatch.id);
    }
  };

  const applyScannedOrEnteredCode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    const normalized = code.toLowerCase();
    setLookupQuery(code);

    const exactBarcodeMatch = items.find(
      (i) => i.barcode && i.barcode.trim().toLowerCase() === normalized
    );
    if (exactBarcodeMatch) {
      setSelectedItemId(exactBarcodeMatch.id);
      onNotifySuccess(
        `Selected "${exactBarcodeMatch.name}" (${exactBarcodeMatch.stock} in stock).`
      );
      return;
    }

    const nameMatches = items.filter((i) => i.name.toLowerCase().includes(normalized));
    if (nameMatches.length === 1) {
      setSelectedItemId(nameMatches[0].id);
      onNotifySuccess(`Selected "${nameMatches[0].name}".`);
      return;
    }

    onNotifyError(`No store item matched "${code}". Select an item manually below.`);
  };

  // Compute live preview of adjustment
  const parsedValue = Math.max(0, Math.round(Number(qtyInput) || 0));
  const previewCalc = useMemo(() => {
    if (!selectedItem) {
      return { previousStock: 0, delta: 0, newStock: 0, exceedsStock: false, costImpact: 0 };
    }
    const prev = selectedItem.stock;
    if (mode === 'add') {
      const delta = parsedValue;
      return {
        previousStock: prev,
        delta,
        newStock: prev + delta,
        exceedsStock: false,
        costImpact: delta * selectedItem.costPrice,
      };
    }
    if (mode === 'deduct') {
      const exceedsStock = parsedValue > prev;
      const delta = -parsedValue;
      return {
        previousStock: prev,
        delta,
        newStock: Math.max(0, prev - parsedValue),
        exceedsStock,
        costImpact: delta * selectedItem.costPrice,
      };
    }
    const delta = parsedValue - prev;
    return {
      previousStock: prev,
      delta,
      newStock: parsedValue,
      exceedsStock: false,
      costImpact: delta * selectedItem.costPrice,
    };
  }, [selectedItem, mode, parsedValue]);

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (mode !== 'recount' && parsedValue <= 0) {
      onNotifyError('Enter an adjustment quantity greater than 0.');
      return;
    }
    if (mode === 'deduct' && parsedValue > selectedItem.stock) {
      onNotifyError(
        `Cannot deduct ${parsedValue} units — only ${selectedItem.stock} units are in stock.`
      );
      return;
    }
    if (mode === 'recount' && parsedValue === selectedItem.stock) {
      onNotifyError('Counted stock matches the current stock level (no change to record).');
      return;
    }

    setIsSaving(true);
    try {
      const createdLog = await onAdjustStock({
        itemId: selectedItem.id,
        adjustmentType: mode,
        quantityOrCount: parsedValue,
        reason: reason.trim().slice(0, 120) || 'Manual Stock Adjustment',
        note: note.trim().slice(0, 400) || undefined,
      });
      const signed =
        createdLog.delta > 0 ? `+${createdLog.delta}` : `${createdLog.delta}`;
      onNotifySuccess(
        `Recorded ${signed} units for "${createdLog.itemName}" (New stock: ${createdLog.newStock}).`
      );
      setNote('');
      if (mode === 'recount') {
        setQtyInput(String(createdLog.newStock));
      } else {
        setQtyInput('1');
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to save stock adjustment. Check Admin permissions or connection.';
      onNotifyError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Summary metrics from history logs
  const summaryStats = useMemo(() => {
    let unitsAdded = 0;
    let unitsDeducted = 0;
    let netCostImpact = 0;
    for (const log of stockAdjustments) {
      if (log.delta > 0) unitsAdded += log.delta;
      if (log.delta < 0) unitsDeducted += Math.abs(log.delta);
      netCostImpact += log.delta * (log.unitCostAtTime ?? 0);
    }
    return {
      totalCount: stockAdjustments.length,
      unitsAdded,
      unitsDeducted,
      netCostImpact,
    };
  }, [stockAdjustments]);

  const filteredLogs = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return stockAdjustments.filter((log) => {
      if (historyTypeFilter !== 'all' && log.adjustmentType !== historyTypeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        log.itemName.toLowerCase().includes(q) ||
        log.itemCategory.toLowerCase().includes(q) ||
        log.reason.toLowerCase().includes(q) ||
        log.adjustedByName.toLowerCase().includes(q) ||
        (log.barcode ? log.barcode.toLowerCase().includes(q) : false) ||
        (log.note ? log.note.toLowerCase().includes(q) : false)
      );
    });
  }, [stockAdjustments, historySearch, historyTypeFilter]);

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Logged Movements</div>
          <div className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {summaryStats.totalCount}
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            Audit trail entries
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Units Added / Restocked</div>
          <div className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            +{summaryStats.unitsAdded}
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            Positive stock variance
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Units Deducted</div>
          <div className="mt-1 text-xl font-bold text-red-700 dark:text-red-400 font-mono tabular-nums">
            -{summaryStats.unitsDeducted}
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            Damaged, expired, or recount
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Net Cost Variance</div>
          <div
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              summaryStats.netCostImpact >= 0
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {summaryStats.netCostImpact >= 0 ? '+' : '-'}
            {formatPHP(Math.abs(summaryStats.netCostImpact), true)}
          </div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            At item unit cost
          </div>
        </div>
      </div>

      {/* Main Adjustment Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Item Search & Selection */}
        <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                1. Select Pantry Item
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Scan a product barcode or pick an item to adjust stock.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 shrink-0 whitespace-nowrap cursor-pointer"
            >
              <ScanBarcode className="w-4 h-4" />
              <span>Scan Barcode</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={lookupQuery}
              onChange={(e) => handleLookupChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyScannedOrEnteredCode(lookupQuery);
                }
              }}
              placeholder="Scan barcode or search item name..."
              className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] pl-10 pr-9 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:bg-white dark:focus:bg-[#121D1B] focus:outline-none"
            />
            {lookupQuery && (
              <button
                type="button"
                onClick={() => {
                  setLookupQuery('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear item search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="border border-stone-200 dark:border-stone-800 rounded-xl divide-y divide-stone-200 dark:divide-stone-800 max-h-[360px] overflow-y-auto">
            {(lookupQuery.trim() ? matchingSuggestions : items).length === 0 ? (
              <div className="p-5 text-center text-xs text-stone-500 dark:text-stone-400">
                No store items match &ldquo;{lookupQuery}&rdquo;.
              </div>
            ) : (
              (lookupQuery.trim() ? matchingSuggestions : items).map((item) => {
                const isSelected = item.id === selectedItemId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/60'
                        : 'hover:bg-stone-50 dark:hover:bg-[#172523]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                        {item.category}
                        {item.barcode ? ` · ${item.barcode}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <div
                        className={`text-xs font-bold ${
                          item.stock <= 6
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        {item.stock} left
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        {formatPHP(item.costPrice)} cost
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Stock Adjustment Action Form */}
        <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 sm:p-6">
          {selectedItem ? (
            <form onSubmit={(e) => void handleSubmitAdjustment(e)} className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 shrink-0 bg-stone-100 dark:bg-[#172523]">
                    <ProductImage
                      src={selectedItem.image}
                      alt={selectedItem.name}
                      title={selectedItem.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {selectedItem.category}
                      {selectedItem.barcode ? ` · Barcode ${selectedItem.barcode}` : ''}
                    </div>
                    <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 truncate">
                      {selectedItem.name}
                    </h3>
                    <div className="text-xs font-mono tabular-nums text-stone-600 dark:text-stone-300 mt-0.5">
                      Current Stock: <strong>{selectedItem.stock} units</strong> · Unit Cost:{' '}
                      {formatPHP(selectedItem.costPrice)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedItemId('')}
                  className="min-h-[36px] px-3 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#172523] shrink-0 cursor-pointer"
                >
                  Change Item
                </button>
              </div>

              {/* Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                  Adjustment Action
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-stone-100 dark:bg-[#172523] border border-stone-200 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setMode('deduct')}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                      mode === 'deduct'
                        ? 'bg-white dark:bg-red-900/70 text-red-700 dark:text-red-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Deduct (-)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('add')}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                      mode === 'add'
                        ? 'bg-white dark:bg-emerald-800 text-emerald-700 dark:text-emerald-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('recount')}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                      mode === 'recount'
                        ? 'bg-white dark:bg-amber-800 text-amber-800 dark:text-amber-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Recount (=)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    {mode === 'recount'
                      ? 'Actual Physical Count'
                      : mode === 'deduct'
                        ? 'Quantity to Deduct'
                        : 'Quantity to Add'}
                  </label>
                  <input
                    type="number"
                    min={mode === 'recount' ? 0 : 1}
                    required
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3.5 py-2 text-base font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                  {mode !== 'recount' && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {[1, 2, 5, 10, 20].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setQtyInput(String(preset))}
                          className={`min-h-[32px] px-2.5 rounded-lg border text-xs font-mono font-semibold cursor-pointer ${
                            Number(qtyInput) === preset
                              ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#172523]'
                          }`}
                        >
                          {mode === 'deduct' ? `-${preset}` : `+${preset}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    Adjustment Reason
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  >
                    {REASONS_BY_MODE[mode].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Audit Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. 2 pouches crushed on shelf, expired batch 11/20, verified by supervisor"
                  className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3.5 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
              </div>

              {/* Impact Preview */}
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-stone-600 dark:text-stone-300 font-mono tabular-nums space-y-0.5">
                  <div>
                    Stock Preview: <strong>{previewCalc.previousStock}</strong>{' '}
                    <span
                      className={
                        previewCalc.delta > 0
                          ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                          : previewCalc.delta < 0
                            ? 'text-red-700 dark:text-red-400 font-bold'
                            : 'text-stone-500'
                      }
                    >
                      ({previewCalc.delta > 0 ? `+${previewCalc.delta}` : previewCalc.delta})
                    </span>{' '}
                    → <strong>{previewCalc.newStock} units</strong>
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                    Estimated Cost Value Impact:{' '}
                    {previewCalc.costImpact >= 0 ? '+' : '-'}
                    {formatPHP(Math.abs(previewCalc.costImpact), true)}
                  </div>
                </div>

                {previewCalc.exceedsStock && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Exceeds available stock ({selectedItem.stock})</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  isSaving ||
                  previewCalc.exceedsStock ||
                  previewCalc.delta === 0
                }
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>
                  {isSaving ? 'Saving Adjustment Log...' : 'Save Stock Adjustment & Log History'}
                </span>
              </button>
            </form>
          ) : (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-[#172523] border border-stone-200 dark:border-stone-800 flex items-center justify-center mx-auto text-teal-700 dark:text-teal-400">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Select or Scan an Item to Adjust Stock
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                Use the item list or Scan Barcode on the left to record damaged write-offs, expired items, found stock, or physical inventory recounts. Every change writes an immutable audit log below.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stock Adjustment History Logs Table */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Stock Adjustment History Logs ({filteredLogs.length})
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Chronological ledger of manual stock adjustments, physical recounts, and restock entries.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Filter logs by item, reason, staff..."
                className="w-full sm:w-56 min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] pl-8 pr-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-100 dark:bg-[#172523] border border-stone-200 dark:border-stone-800 overflow-x-auto">
              {[
                { id: 'all', label: 'All' },
                { id: 'deduct', label: 'Deductions' },
                { id: 'add', label: 'Additions' },
                { id: 'recount', label: 'Recounts' },
                { id: 'restock', label: 'Restocks' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setHistoryTypeFilter(opt.id as typeof historyTypeFilter)}
                  className={`min-h-[30px] px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    historyTypeFilter === opt.id
                      ? 'bg-white dark:bg-teal-700 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
              {stockAdjustments.length === 0
                ? 'No stock adjustment logs recorded yet'
                : 'No logs match the current filter'}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
              {stockAdjustments.length === 0
                ? 'Select any pantry item above to record a deduction, addition, or physical recount, or restock items in the Restock & Barcode tab.'
                : 'Try clearing the search query or switching the log type filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-600 dark:text-stone-300">
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Type &amp; Reason</th>
                  <th className="py-3 px-4 text-right">Before</th>
                  <th className="py-3 px-4 text-right">Delta</th>
                  <th className="py-3 px-4 text-right">After</th>
                  <th className="py-3 px-4 text-right">Cost Impact</th>
                  <th className="py-3 px-4">Adjusted By &amp; Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                {filteredLogs.map((log) => {
                  const meta = TYPE_META[log.adjustmentType] ?? TYPE_META.add;
                  const costDelta = log.delta * (log.unitCostAtTime ?? 0);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-stone-50/70 dark:hover:bg-[#172523]/70 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums text-stone-500 dark:text-stone-400 whitespace-nowrap">
                        {log.createdAt}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900 dark:text-stone-100">
                          {log.itemName}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">
                          {log.itemCategory}
                          {log.barcode ? ` · ${log.barcode}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-semibold inline-flex items-center gap-1 ${meta.textClass}`}>
                          {log.delta >= 0 ? (
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{meta.label}</span>
                        </div>
                        <div className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5">
                          {log.reason}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-600 dark:text-stone-300">
                        {log.previousStock}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${
                          log.delta > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : log.delta < 0
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-stone-500'
                        }`}
                      >
                        {log.delta > 0 ? `+${log.delta}` : log.delta}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
                        {log.newStock}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap ${
                          costDelta >= 0
                            ? 'text-stone-700 dark:text-stone-300'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {costDelta >= 0 ? '+' : '-'}
                        {formatPHP(Math.abs(costDelta), true)}
                      </td>
                      <td className="py-3 px-4 max-w-[260px]">
                        <div className="font-medium text-stone-800 dark:text-stone-200">
                          {log.adjustedByName}
                        </div>
                        {log.note && (
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate" title={log.note}>
                            {log.note}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        title="Scan Barcode to Adjust Stock"
        subtitle="Point your camera at the product barcode or upload a photo to locate the item."
        onClose={() => setIsScannerOpen(false)}
        onDetected={(code) => {
          setIsScannerOpen(false);
          applyScannedOrEnteredCode(code);
        }}
      />
    </div>
  );
};
