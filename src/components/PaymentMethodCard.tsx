import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, Wallet } from 'lucide-react';
import { PaymentMethodConfig } from '../types';
import { formatPHP } from '../utils/format';

interface PaymentMethodCardProps {
  method: PaymentMethodConfig;
  amount?: number;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ method, amount }) => {
  const [generatedQr, setGeneratedQr] = useState<string>('');
  const [copiedField, setCopiedField] = useState<'number' | 'name' | null>(null);

  const qrImage = method.qrCodeImage || generatedQr;

  useEffect(() => {
    if (method.qrCodeImage) {
      setGeneratedQr('');
      return;
    }
    let active = true;
    const payload = `${method.title} | ${method.accountName || 'DeskPantry Ops'} | ${
      method.accountNumber || '0917-555-0194'
    }${amount ? ` | PHP ${amount}` : ''}`;

    QRCode.toDataURL(payload, {
      width: 240,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setGeneratedQr(url);
      })
      .catch(() => {
        if (active) setGeneratedQr('');
      });

    return () => {
      active = false;
    };
  }, [method.title, method.accountName, method.accountNumber, method.qrCodeImage, amount]);

  const handleCopy = async (text: string | undefined, field: 'number' | 'name') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      setCopiedField(null);
    }
  };

  const handleDownloadQr = () => {
    if (!qrImage) return;
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `${method.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`;
    link.click();
  };

  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/50 dark:bg-teal-950/30 p-4 space-y-3">
      {/* Header: Title + Display Icon Image */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {method.iconImage ? (
            <img
              src={method.iconImage}
              alt={`${method.title} icon`}
              className="w-9 h-9 rounded-xl object-cover border border-stone-200 dark:border-stone-700 bg-white shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
              {method.title}
            </div>
            {amount !== undefined && (
              <div className="text-xs text-stone-600 dark:text-stone-400 tabular-nums">
                Amount to pay: <strong className="font-mono text-stone-900 dark:text-stone-100">{formatPHP(amount, true)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {method.instructions && (
        <p className="text-xs text-stone-600 dark:text-stone-300">{method.instructions}</p>
      )}

      {/* Account Details + Downloadable QR */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div className="sm:col-span-7 space-y-2.5">
          <div>
            <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
              Account Number
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={method.accountNumber || ''}
                className="flex-1 min-w-0 min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] px-2.5 py-1.5 text-xs font-mono font-semibold text-stone-900 dark:text-stone-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopy(method.accountNumber, 'number')}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#1F312E] inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedField === 'number' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
              Account Name
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={method.accountName || ''}
                className="flex-1 min-w-0 min-h-[38px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] px-2.5 py-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopy(method.accountName, 'name')}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#1F312E] inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedField === 'name' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* QR Code Image + Download */}
        <div className="sm:col-span-5 flex flex-col items-center rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] p-2.5 gap-2">
          {qrImage ? (
            <img
              src={qrImage}
              alt={`${method.title} QR code`}
              className="w-24 h-24 rounded-lg object-contain bg-white p-1 border border-stone-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-[10px] text-stone-500">
              Loading QR...
            </div>
          )}
          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={!qrImage}
            className="w-full min-h-[32px] inline-flex items-center justify-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Download QR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
