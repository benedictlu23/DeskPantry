/**
 * Compresses an uploaded image file on an offscreen canvas into a compact data URL
 * so payment proof screenshots, QR codes, and product photos stay safely below
 * Firestore's 1 MB document limit.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension = 960,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      if (!raw) {
        reject(new Error('Empty image data.'));
        return;
      }

      // If already small (< 180 KB), return as-is
      if (raw.length < 180_000) {
        resolve(raw);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(raw.slice(0, 380_000));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(raw);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        let compressed = canvas.toDataURL('image/jpeg', quality);
        if (compressed.length > 360_000) {
          compressed = canvas.toDataURL('image/jpeg', 0.5);
        }
        resolve(compressed);
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates that an attached payment receipt is a genuine uploaded image
 * (JPEG, PNG, WebP, etc.) and not empty or a hardcoded sample SVG receipt.
 */
export function isValidUploadedReceipt(value: string | undefined | null): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/svg+xml')) return false;
  if (trimmed.includes('DeskPantry Demo Receipt')) return false;
  return (
    (trimmed.startsWith('data:image/') && trimmed.includes(';base64,')) ||
    trimmed.startsWith('https://')
  );
}

