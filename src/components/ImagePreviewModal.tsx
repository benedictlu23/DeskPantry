import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ImagePreviewTarget {
  src: string;
  title?: string;
  subtitle?: string;
}

interface ImagePreviewModalProps {
  preview: ImagePreviewTarget | null;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  preview,
  onClose,
}) => {
  useEffect(() => {
    if (!preview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview, onClose]);

  if (!preview) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/80 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={preview.title || 'Attached image preview'}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
              {preview.title || 'Attached Image Preview'}
            </div>
            {preview.subtitle && (
              <div className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                {preview.subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer shrink-0"
            aria-label="Close image preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-stone-100 dark:bg-[#0B1211] flex items-center justify-center max-h-[78vh]">
          <img
            src={preview.src}
            alt={preview.title || 'Attached image preview'}
            referrerPolicy="no-referrer"
            className="max-h-[70vh] max-w-full w-auto object-contain rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B]"
          />
        </div>
      </div>
    </div>
  );
};
