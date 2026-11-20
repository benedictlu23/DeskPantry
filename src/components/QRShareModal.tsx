import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, QrCode, X } from 'lucide-react';

interface QRShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRShareModal: React.FC<QRShareModalProps> = ({ isOpen, onClose }) => {
  const defaultUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://deskpantry.internal';
  const [shareUrl, setShareUrl] = useState(defaultUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    QRCode.toDataURL(shareUrl || defaultUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [isOpen, shareUrl, defaultUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'deskpantry-qr.png';
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Share DeskPantry
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Scan with Android or iOS camera to open the store
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            aria-label="Close QR share dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-6">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR code to open DeskPantry"
              className="w-52 h-52 rounded-lg border border-stone-200 bg-white p-2"
            />
          ) : (
            <div className="w-52 h-52 rounded-lg border border-stone-200 bg-white flex items-center justify-center text-xs text-stone-500">
              Generating QR code...
            </div>
          )}
          <p className="mt-3 text-xs font-medium text-stone-600 dark:text-stone-300 text-center">
            Point any smartphone camera here to open DeskPantry or install the Android PWA.
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
            Department Share Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={shareUrl}
              onChange={(e) => setShareUrl(e.target.value)}
              className="w-full min-h-[42px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-xs font-mono text-stone-700 dark:text-stone-200 focus:border-teal-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[42px] px-3.5 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1F312E] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
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

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download QR PNG</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-4 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#1F312E] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
