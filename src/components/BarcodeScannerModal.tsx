import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Camera, Keyboard, RefreshCw, ScanBarcode, Upload, X } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  title = 'Scan Item Barcode',
  subtitle = 'Point your camera at a product barcode (EAN-13, UPC, Code 128, QR) or enter it manually.',
  onDetected,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const hasDetectedRef = useRef(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');

  const stopCamera = () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      controlsRef.current = null;
    }
    const videoEl = videoRef.current;
    if (videoEl && videoEl.srcObject) {
      const stream = videoEl.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoEl.srcObject = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      hasDetectedRef.current = false;
      setCameraError('');
      setManualCode('');
      return;
    }

    let cancelled = false;
    hasDetectedRef.current = false;
    const reader = new BrowserMultiFormatReader();

    const startScanner = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Camera access is unavailable in this browser context. You can upload a barcode photo or enter the code below.'
        );
        return;
      }

      setIsStarting(true);
      setCameraError('');

      try {
        const videoDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(videoDevices);

        const preferredDeviceId =
          selectedDeviceId ||
          videoDevices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ||
          videoDevices[0]?.deviceId ||
          undefined;

        if (!videoRef.current) return;

        const controls = await reader.decodeFromVideoDevice(
          preferredDeviceId,
          videoRef.current,
          (result) => {
            if (cancelled || hasDetectedRef.current) return;
            if (result) {
              const code = result.getText().trim();
              if (code) {
                hasDetectedRef.current = true;
                stopCamera();
                onDetected(code);
              }
            }
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Unable to access camera';
          setCameraError(
            msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')
              ? 'Camera permission was blocked. Allow camera access, upload a barcode photo, or enter the barcode manually.'
              : 'Could not start camera preview. You can upload a barcode image or type/scan via USB scanner below.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsStarting(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, selectedDeviceId, onDetected]);

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError('');
    const objectUrl = URL.createObjectURL(file);
    try {
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      const code = result.getText().trim();
      if (code) {
        stopCamera();
        onDetected(code);
      }
    } catch {
      setCameraError(
        'No readable barcode detected in that image. Try a clearer photo or type the digits below.'
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      e.target.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualCode.trim();
    if (!cleaned) return;
    stopCamera();
    onDetected(cleaned);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0">
              <ScanBarcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {title}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close scanner"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-[#172523] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera Viewfinder */}
          <div className="relative rounded-xl overflow-hidden bg-stone-950 border border-stone-800 aspect-[4/3] flex items-center justify-center">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!cameraError && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-28 rounded-xl border-2 border-teal-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex items-center justify-center">
                  <div className="w-full h-0.5 bg-teal-400/75" />
                </div>
              </div>
            )}
            {isStarting && !cameraError && (
              <div className="absolute inset-0 bg-stone-950/75 flex flex-col items-center justify-center gap-2 text-xs text-stone-200">
                <Camera className="w-6 h-6 text-teal-400" />
                <span>Starting camera viewfinder...</span>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 bg-stone-950/90 p-5 flex flex-col items-center justify-center text-center gap-2">
                <Camera className="w-7 h-7 text-amber-400" />
                <p className="text-xs text-stone-200 leading-relaxed">{cameraError}</p>
              </div>
            )}
          </div>

          {/* Camera Switcher + Upload Image Fallback */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {devices.length > 1 ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                <RefreshCw className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  aria-label="Select camera"
                  className="w-full min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-2.5 text-xs text-stone-800 dark:text-stone-100"
                >
                  {devices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Supports EAN-13, UPC, Code 128 &amp; QR
              </span>
            )}

            <label className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1F312E] cursor-pointer shrink-0">
              <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>Scan Photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void handleImageUpload(e)}
                className="hidden"
              />
            </label>
          </div>

          {/* Manual / USB Scanner Input Fallback */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 dark:text-stone-300">
              <Keyboard className="w-3.5 h-3.5 text-stone-400" />
              <span>Or enter / scan with USB barcode reader</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. 4800016644801"
                className="flex-1 min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-xs font-mono text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Use Code
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
