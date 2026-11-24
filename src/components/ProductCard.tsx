import React from 'react';
import { Product } from '../data/mockData';
import { Heart, ShoppingBag, Eye, Star, Info } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  isWishlisted: boolean;
  onQuickView: (product: Product) => void;
  onOpenJewelleryCalc?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
  onQuickView,
  onOpenJewelleryCalc
}) => {
  const discountedPrice = Math.round(product.basePrice * (1 - product.discount / 100));

  return (
    <div className="group bg-white rounded-xl overflow-hidden border border-[#211713]/10 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
      {/* Image Container */}
      <div className="relative h-72 sm:h-80 bg-[#F8F1E4] overflow-hidden">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />

        {/* Discount Badge */}
        {product.discount > 0 && (
          <span className="absolute top-3 left-3 bg-[#65102F] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow">
            {product.discount}% OFF
          </span>
        )}

        {/* Wishlist Button */}
        <button
          onClick={() => onToggleWishlist(product)}
          className={`absolute top-3 right-3 p-2 rounded-full shadow-md transition-colors ${
            isWishlisted
              ? 'bg-[#D41472] text-white'
              : 'bg-white/90 text-[#120D0B] hover:text-[#D41472]'
          }`}
          aria-label="Wishlist"
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Quick View Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onQuickView(product)}
            className="px-3 py-1.5 bg-white text-[#120D0B] text-xs font-semibold rounded shadow hover:bg-[#D4AF62] transition-colors flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" /> Quick View
          </button>
          {product.type === 'jewellery' && onOpenJewelleryCalc && (
            <button
              onClick={() => onOpenJewelleryCalc(product)}
              className="px-3 py-1.5 bg-[#D4AF62] text-[#120D0B] text-xs font-semibold rounded shadow hover:bg-[#c39e50] transition-colors flex items-center gap-1"
              title="Gold Price Breakdown"
            >
              <Info className="w-3.5 h-3.5" /> Price Breakdown
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="uppercase tracking-wider text-[10px] font-semibold text-[#65102F]">
              {product.category}
            </span>
            <div className="flex items-center gap-1 text-amber-600 font-medium">
              <Star className="w-3 h-3 fill-current" />
              <span>{product.rating} ({product.reviewsCount})</span>
            </div>
          </div>

          <h3 
            onClick={() => onQuickView(product)}
            className="font-cinzel text-sm sm:text-base font-bold text-[#120D0B] line-clamp-1 hover:text-[#D4AF62] cursor-pointer"
          >
            {product.name}
          </h3>

          <p className="text-xs text-gray-600 line-clamp-1 mt-1 font-poppins">
            {product.shortDescription}
          </p>
        </div>

        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-base sm:text-lg text-[#120D0B] font-mono tabular-nums">
                ₹{discountedPrice.toLocaleString('en-IN')}
              </span>
              {product.discount > 0 && (
                <span className="text-xs text-gray-400 line-through font-mono tabular-nums">
                  ₹{product.basePrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => onAddToCart(product)}
            className="p-2.5 rounded-lg bg-[#120D0B] text-[#F8F1E4] hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>
    </div>
  );
};
