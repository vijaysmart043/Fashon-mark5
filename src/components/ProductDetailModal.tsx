import React, { useState } from 'react';
import { Product } from '../data/mockData';
import { X, Star, ShoppingBag, Heart, ShieldCheck, Truck, RotateCcw } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, variantSku?: string) => void;
  onToggleWishlist: (product: Product) => void;
  isWishlisted: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onToggleWishlist,
  isWishlisted
}) => {
  const [selectedImage, setSelectedImage] = useState(product.images[0]);
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [quantity, setQuantity] = useState(1);

  const discountedPrice = Math.round(product.basePrice * (1 - product.discount / 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-[#D4AF62]/30 animate-in fade-in zoom-in duration-200 grid grid-cols-1 md:grid-cols-2">
        
        {/* Left: Images */}
        <div className="p-6 bg-[#F8F1E4]/50 flex flex-col justify-between">
          <div className="relative h-80 sm:h-96 rounded-xl overflow-hidden bg-white shadow-inner">
            <img
              src={selectedImage}
              alt={product.name}
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
            {product.discount > 0 && (
              <span className="absolute top-3 left-3 bg-[#65102F] text-white text-xs font-bold px-3 py-1 rounded shadow">
                {product.discount}% OFF
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-2">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(img)}
                className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                  selectedImage === img ? 'border-[#D4AF62] scale-105 shadow-md' : 'border-transparent opacity-70'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Details */}
        <div className="p-6 sm:p-8 flex flex-col justify-between relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="uppercase tracking-widest text-[#65102F] font-semibold">{product.category}</span>
              <div className="flex items-center gap-1 text-amber-600 font-medium">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{product.rating} ({product.reviewsCount} reviews)</span>
              </div>
            </div>

            <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-[#120D0B]">{product.name}</h2>

            <div className="flex items-baseline gap-3">
              <span className="font-mono text-2xl font-bold text-[#120D0B]">
                ₹{discountedPrice.toLocaleString('en-IN')}
              </span>
              {product.discount > 0 && (
                <span className="font-mono text-base text-gray-400 line-through">
                  ₹{product.basePrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-gray-600 font-poppins leading-relaxed">
              {product.description}
            </p>

            {/* Variants */}
            {product.variants.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Select Variant / Option:
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.sku}
                      onClick={() => setSelectedVariant(variant)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                        selectedVariant.sku === variant.sku
                          ? 'bg-[#120D0B] text-[#F8F1E4] border-[#120D0B] shadow'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF62]'
                      }`}
                    >
                      {variant.colour} {variant.size && `(${variant.size})`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Specifications */}
            {product.jewellerySpec && (
              <div className="bg-[#F8F1E4]/60 rounded-xl p-3 text-xs space-y-1 text-gray-700 border border-[#D4AF62]/30">
                <p><strong>Metal:</strong> {product.jewellerySpec.metalType} ({product.jewellerySpec.purity})</p>
                <p><strong>Gross Weight:</strong> {product.jewellerySpec.grossWeight}g | <strong>Net Weight:</strong> {product.jewellerySpec.netWeight}g</p>
                <p><strong>Occasion:</strong> {product.jewellerySpec.occasion}</p>
              </div>
            )}

            {product.sareeSpec && (
              <div className="bg-[#F8F1E4]/60 rounded-xl p-3 text-xs space-y-1 text-gray-700 border border-[#D4AF62]/30">
                <p><strong>Fabric:</strong> {product.sareeSpec.fabric}</p>
                <p><strong>Weave:</strong> {product.sareeSpec.weaveType} | <strong>Blouse Piece:</strong> {product.sareeSpec.blousePiece ? 'Included' : 'Not Included'}</p>
                <p><strong>Length:</strong> {product.sareeSpec.length}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-6 border-t border-gray-100 space-y-3 mt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  -
                </button>
                <span className="px-4 py-2 font-mono text-sm font-bold text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => {
                  for (let i = 0; i < quantity; i++) {
                    onAddToCart(product, selectedVariant?.sku);
                  }
                  onClose();
                }}
                className="flex-1 py-3 bg-[#120D0B] text-[#F8F1E4] rounded-lg font-bold text-xs sm:text-sm hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors shadow flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" /> Add to Cart — ₹{(discountedPrice * quantity).toLocaleString('en-IN')}
              </button>

              <button
                onClick={() => onToggleWishlist(product)}
                className={`p-3 rounded-lg border transition-colors ${
                  isWishlisted ? 'bg-[#D41472] text-white border-[#D41472]' : 'border-gray-300 text-gray-700 hover:border-[#D41472]'
                }`}
                title="Wishlist"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-gray-500 text-center">
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-[#D4AF62]" />
                <span>100% Certified Purity</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Truck className="w-4 h-4 text-[#D4AF62]" />
                <span>Free Insured Shipping</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <RotateCcw className="w-4 h-4 text-[#D4AF62]" />
                <span>7-Day Easy Returns</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
