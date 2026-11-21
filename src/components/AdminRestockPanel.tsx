import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  PackagePlus,
  Plus,
  ScanBarcode,
  Search,
  X,
} from 'lucide-react';
import { StoreItem } from '../types';
import { formatPHP } from '../utils/format';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ProductImage } from './ProductImage';

interface AdminRestockPanelProps {
  items: StoreItem[];
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
  onCreateNewWithBarcode: (barcode: string) => void;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
}

export const AdminRestockPanel: React.FC<AdminRestockPanelProps> = ({
  items,
  onRestockItem,
  onUpdateItemBarcode,
  onCreateNewWithBarcode,
  onNotifySuccess,
  onNotifyError,
}) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [lookupQuery, setLookupQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [restockQty, setRestockQty] = useState<string>('10');
  const [unitCostInput, setUnitCostInput] = useState<string>('');
  const [sellingPriceInput, setSellingPriceInput] = useState<string>('');
  const [restockNote, setRestockNote] = useState<string>('');
  const [barcodeDraft, setBarcodeDraft] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const [unmatchedBarcode, setUnmatchedBarcode] = useState<string>('');
  const [linkTargetItemId, setLinkTargetItemId] = useState<string>('');

  const [scannerMode, setScannerMode] = useState<null | 'lookup' | 'assign'>(null);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  // Sync form defaults whenever selected item changes
  useEffect(() => {
    if (!selectedItem) return;
    setUnitCostInput(String(selectedItem.costPrice));
    setSellingPriceInput(String(selectedItem.price));
    setBarcodeDraft(selectedItem.barcode ?? '');
    setRestockNote('');
  }, [selectedItem?.id]);

  const sortedWatchlist = useMemo(() => {
    return [...items].sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  }, [items]);

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
      setUnmatchedBarcode('');
      onNotifySuccess(
        `Matched "${exactBarcodeMatch.name}" (${exactBarcodeMatch.stock} in stock).`
      );
      return;
    }

    const idMatch = items.find((i) => i.id.toLowerCase() === normalized);
    if (idMatch) {
      setSelectedItemId(idMatch.id);
      setUnmatchedBarcode('');
      onNotifySuccess(`Matched "${idMatch.name}" (${idMatch.stock} in stock).`);
      return;
    }

    const nameMatches = items.filter((i) => i.name.toLowerCase().includes(normalized));
    if (nameMatches.length === 1) {
      setSelectedItemId(nameMatches[0].id);
      setUnmatchedBarcode('');
      onNotifySuccess(`Matched "${nameMatches[0].name}".`);
      return;
    }

    setUnmatchedBarcode(code);
    if (items.length > 0 && !linkTargetItemId) {
      setLinkTargetItemId(items[0].id);
    }
  };

  // Auto-select immediately as user/USB-scanner types an exact barcode match
  const handleLookupChange = (val: string) => {
    setLookupQuery(val);
    setUnmatchedBarcode('');
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) return;
    const exactMatch = items.find(
      (i) => i.barcode && i.barcode.trim().toLowerCase() === trimmed
    );
    if (exactMatch) {
      setSelectedItemId(exactMatch.id);
    }
  };

  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const qty = Math.max(1, Math.round(Number(restockQty) || 0));
    const nextCost = Math.max(0, Number(unitCostInput) || 0);
    const nextSell = Math.max(1, Number(sellingPriceInput) || 1);

    setIsSaving(true);
    try {
      await onRestockItem(selectedItem.id, qty, {
        unitCost: nextCost,
        sellingPrice: nextSell,
        note: restockNote.trim() || undefined,
        barcode: barcodeDraft.trim(),
      });
      onNotifySuccess(
        `Restocked +${qty} units of "${selectedItem.name}" (New stock: ${
          selectedItem.stock + qty
        }).`
      );
      setRestockNote('');
    } catch {
      onNotifyError(`Failed to restock "${selectedItem.name}". Please check connection or permissions.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickRestock = async (item: StoreItem, amount: number) => {
    try {
      await onRestockItem(item.id, amount);
      onNotifySuccess(
        `Restocked +${amount} units of "${item.name}" (New stock: ${item.stock + amount}).`
      );
    } catch {
      onNotifyError(`Failed to restock "${item.name}".`);
    }
  };

  const handleLinkBarcode = async () => {
    if (!unmatchedBarcode || !linkTargetItemId) return;
    const target = items.find((i) => i.id === linkTargetItemId);
    if (!target) return;
    try {
      await onUpdateItemBarcode(target.id, unmatchedBarcode);
      setSelectedItemId(target.id);
      setUnmatchedBarcode('');
      onNotifySuccess(`Linked barcode ${unmatchedBarcode} to "${target.name}".`);
    } catch {
      onNotifyError(`Could not save barcode for "${target.name}".`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barcode Search & Scanner Bar */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Restock &amp; Barcode Lookup
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Scan a product barcode with your camera or USB scanner to locate the item and update stock immediately.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setScannerMode('lookup')}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ScanBarcode className="w-4 h-4" />
            <span>Scan Barcode</span>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyScannedOrEnteredCode(lookupQuery);
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={lookupQuery}
              onChange={(e) => handleLookupChange(e.target.value)}
              placeholder="Scan barcode or search by item name / SKU..."
              aria-label="Scan barcode or search item to restock"
              className="w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] pl-10 pr-9 py-2 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-teal-700 focus:bg-white dark:focus:bg-[#121D1B] focus:outline-none"
            />
            {lookupQuery && (
              <button
                type="button"
                onClick={() => {
                  setLookupQuery('');
                  setUnmatchedBarcode('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-4 py-2 text-xs font-semibold text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-[#1F312E] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Find Item
          </button>
        </form>

        {/* Live Search Suggestions */}
        {lookupQuery.trim() && matchingSuggestions.length > 0 && (
          <div className="divide-y divide-stone-200 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden bg-stone-50/70 dark:bg-[#172523]">
            {matchingSuggestions.slice(0, 6).map((item) => {
              const isSelected = item.id === selectedItemId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setUnmatchedBarcode('');
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-teal-50 dark:bg-teal-950/60'
                      : 'hover:bg-white dark:hover:bg-[#121D1B]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">
                      {item.category}
                      {item.barcode ? (
                        <>
                          {' '}
                          · Barcode: <span className="font-mono">{item.barcode}</span>
                        </>
                      ) : (
                        ' · No barcode linked'
                      )}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                      item.stock <= 6
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-stone-700 dark:text-stone-200'
                    }`}
                  >
                    {item.stock} in stock
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Unmatched Barcode Helper */}
        {unmatchedBarcode && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-950 dark:text-amber-200">
                  No item matched barcode <span className="font-mono">{unmatchedBarcode}</span>
                </div>
                <p className="text-xs text-amber-900 dark:text-amber-300">
                  Link this barcode to an existing storefront item or register a new item with it.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {items.length > 0 && (
                <>
                  <select
                    value={linkTargetItemId}
                    onChange={(e) => setLinkTargetItemId(e.target.value)}
                    aria-label="Select item to link barcode"
                    className="flex-1 min-h-[38px] rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#121D1B] px-3 text-xs text-stone-900 dark:text-stone-100"
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.stock} in stock)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleLinkBarcode()}
                    className="min-h-[38px] rounded-lg bg-stone-900 dark:bg-teal-700 px-3.5 text-xs font-semibold text-white hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Link &amp; Restock
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onCreateNewWithBarcode(unmatchedBarcode)}
                className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-400 dark:border-amber-700 bg-white dark:bg-[#121D1B] px-3.5 text-xs font-semibold text-amber-950 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Item</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Item Restock Form */}
      {selectedItem ? (
        <form
          onSubmit={(e) => void handleConfirmRestock(e)}
          className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-white dark:bg-[#121D1B] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 shrink-0 bg-stone-100 dark:bg-[#172523]">
                <ProductImage src={selectedItem.image} alt={selectedItem.name} title={selectedItem.name} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {selectedItem.category} · Cost {formatPHP(selectedItem.costPrice)} · Sell{' '}
                  {formatPHP(selectedItem.price)}
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
                  {selectedItem.name}
                </h3>
                <div className="mt-0.5 text-xs font-mono tabular-nums text-stone-600 dark:text-stone-300">
                  Current Stock:{' '}
                  <strong
                    className={
                      selectedItem.stock <= 6
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-teal-700 dark:text-teal-400'
                    }
                  >
                    {selectedItem.stock} units
                  </strong>{' '}
                  → After Restock:{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {selectedItem.stock + Math.max(0, Math.round(Number(restockQty) || 0))} units
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedItemId('')}
              className="min-h-[36px] self-start sm:self-center rounded-lg border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#172523] cursor-pointer"
            >
              Clear Selection
            </button>
          </div>

          {/* Quick Quantity Buttons + Custom Qty */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-5 space-y-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Quick Add Stock Units
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 5, 10, 20, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRestockQty(String(preset))}
                    className={`min-h-[38px] px-3 rounded-lg border text-xs font-mono font-semibold tabular-nums cursor-pointer transition-colors ${
                      Number(restockQty) === preset
                        ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200'
                        : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1F312E]'
                    }`}
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Units to Add
              </label>
              <input
                type="number"
                min="1"
                required
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Unit Cost (₱)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitCostInput}
                onChange={(e) => setUnitCostInput(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Selling Price (₱)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={sellingPriceInput}
                onChange={(e) => setSellingPriceInput(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Linked Barcode
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    maxLength={64}
                    value={barcodeDraft}
                    onChange={(e) => setBarcodeDraft(e.target.value)}
                    placeholder="Scan or type barcode"
                    className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] pl-9 pr-3 py-2 text-xs font-mono text-stone-900 dark:text-stone-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setScannerMode('assign')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1F312E] shrink-0 cursor-pointer"
                >
                  <ScanBarcode className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Scan</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Batch / Supplier Note (Optional)
              </label>
              <input
                type="text"
                value={restockNote}
                onChange={(e) => setRestockNote(e.target.value)}
                placeholder="e.g. S&R bulk delivery receipt #412"
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSaving
                ? 'Saving Restock...'
                : `Confirm Restock (+${Math.max(1, Math.round(Number(restockQty) || 1))} units)`}
            </span>
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50/70 dark:bg-[#121D1B] p-6 text-center space-y-2">
          <ScanBarcode className="w-7 h-7 text-teal-700 dark:text-teal-400 mx-auto" />
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-200">
            Scan a barcode or pick an item below to restock
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Items matched by barcode open automatically with quick stock presets, unit cost updates, and barcode assignment.
          </p>
        </div>
      )}

      {/* Low Stock & Inventory Watchlist Table */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Stock Watchlist &amp; Barcodes ({items.length} items)
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Sorted by lowest remaining stock first for quick replenishment.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-600 dark:text-stone-300">
                <th className="py-3 px-5">Item</th>
                <th className="py-3 px-5">Barcode</th>
                <th className="py-3 px-5 text-right">Stock</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-sm">
              {sortedWatchlist.map((item) => (
                <tr
                  key={item.id}
                  className={
                    item.id === selectedItemId
                      ? 'bg-teal-50/50 dark:bg-teal-950/30'
                      : 'hover:bg-stone-50/60 dark:hover:bg-[#172523]/50'
                  }
                >
                  <td className="py-3 px-5">
                    <div className="font-semibold text-stone-900 dark:text-stone-100">
                      {item.name}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {item.category} · {formatPHP(item.price)}
                    </div>
                  </td>
                  <td className="py-3 px-5 font-mono text-xs text-stone-600 dark:text-stone-300">
                    {item.barcode || <span className="text-stone-400">Not set</span>}
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
                        onClick={() => void handleQuickRestock(item, 10)}
                        className="min-h-[32px] rounded-lg border border-stone-200 dark:border-stone-700 px-2.5 py-1 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#172523] cursor-pointer"
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setUnmatchedBarcode('');
                        }}
                        className="min-h-[32px] rounded-lg bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                      >
                        Restock
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedWatchlist.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-xs text-stone-500 dark:text-stone-400"
                  >
                    No items registered yet. Add items in the Items &amp; Categories tab first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={scannerMode !== null}
        title={
          scannerMode === 'assign'
            ? `Assign Barcode to ${selectedItem?.name ?? 'Item'}`
            : 'Scan Barcode to Restock'
        }
        subtitle={
          scannerMode === 'assign'
            ? 'Scan the product barcode to link it to this item.'
            : 'Scan any product barcode to automatically open its restock form.'
        }
        onDetected={(code) => {
          const mode = scannerMode;
          setScannerMode(null);
          if (mode === 'assign') {
            setBarcodeDraft(code);
            onNotifySuccess(`Captured barcode ${code}. Save restock to persist.`);
          } else {
            applyScannedOrEnteredCode(code);
          }
        }}
        onClose={() => setScannerMode(null)}
      />
    </div>
  );
};
