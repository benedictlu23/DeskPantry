import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`w-full inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#1F312E] hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
          compact ? 'px-3 py-1.5 text-xs font-medium' : 'px-3.5 py-2 text-xs font-semibold'
        }`}
      >
        {isInstallable ? (
          <Download className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
        )}
        <span>{isInstallable ? 'Install App' : 'Get Android App'}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Install DeskPantry on {isIOS ? 'iPhone / iPad' : 'Android & Desktop'}
                </h3>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                  Add DeskPantry to your home screen for full-screen access and offline pantry browsing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                aria-label="Close install instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-[#172523] rounded-xl p-4 border border-stone-200 dark:border-stone-800">
                <li>1. Tap the <strong>Share</strong> icon in your Safari toolbar.</li>
                <li>2. Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>3. Tap <strong>Add</strong> in the top corner to launch DeskPantry.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-sm text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-[#172523] rounded-xl p-4 border border-stone-200 dark:border-stone-800">
                <li>1. Open DeskPantry in <strong>Chrome</strong> on Android (or scan the QR Share code).</li>
                <li>2. Tap the browser menu (<strong>⋮</strong>) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>3. Launch DeskPantry directly from your Android app drawer.</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
