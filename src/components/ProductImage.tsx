import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { ASSET_MAP } from '../data/initialCatalog';

interface ProductImageProps {
  imageKey: string;
  alt: string;
  className?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  imageKey,
  alt,
  className = 'w-full h-full object-cover',
}) => {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = ASSET_MAP[imageKey] || imageKey;

  if (hasError || !resolvedSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-500 dark:text-slate-400 p-4 text-center ${className}`}
      >
        <Package className="w-8 h-8 mb-1.5 opacity-60 shrink-0" />
        <span className="text-xs font-medium line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
};
