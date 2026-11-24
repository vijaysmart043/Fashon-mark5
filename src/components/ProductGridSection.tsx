import React from 'react';
import { Product } from '../data/mockData';
import { ProductCard } from './ProductCard';
import { Sparkles } from 'lucide-react';

interface ProductGridSectionProps {
  title: string;
  subtitle?: string;
  products: Product[];
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  wishlistIds: string[];
  onQuickView: (product: Product) => void;
  onOpenJewelleryCalc: (product: Product) => void;
}

export const ProductGridSection: React.FC<ProductGridSectionProps> = ({
  title,
  subtitle,
  products,
  onAddToCart,
  onToggleWishlist,
  wishlistIds,
  onQuickView,
  onOpenJewelleryCalc
}) => {
  if (products.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
          <div>
            {subtitle && (
              <p className="text-xs font-semibold tracking-widest uppercase text-[#65102F] mb-1">
                {subtitle}
              </p>
            )}
            <h2 className="font-cinzel text-3xl sm:text-4xl font-bold tracking-tight text-[#120D0B]">
              {title}
            </h2>
          </div>
          <div className="w-24 h-0.5 bg-[#D4AF62] mt-3 md:mt-0"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
              onToggleWishlist={onToggleWishlist}
              isWishlisted={wishlistIds.includes(product.id)}
              onQuickView={onQuickView}
              onOpenJewelleryCalc={onOpenJewelleryCalc}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
