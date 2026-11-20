import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src?: string;
  alt: string;
  title: string;
  className?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  title,
  className = 'w-full h-full object-cover',
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50/60 to-stone-100 text-stone-500 p-4 text-center"
        role="img"
        aria-label={alt}
      >
        <div className="w-11 h-11 rounded-xl bg-white border border-stone-200 flex items-center justify-center mb-2 text-teal-700">
          <Package className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium text-stone-600 line-clamp-2 max-w-[180px]">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
