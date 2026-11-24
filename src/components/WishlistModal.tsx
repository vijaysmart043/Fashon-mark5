import React from 'react';
import { Product } from '../data/mockData';
import { X, Heart, ShoppingBag, Trash2 } from 'lucide-react';

interface WishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistProducts: Product[];
  onRemoveFromWishlist: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export const WishlistModal: React.FC<WishlistModalProps> = ({
  isOpen,
  onClose,
  wishlistProducts,
  onRemoveFromWishlist,
  onAddToCart
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-[#D4AF62]/30 animate-in fade-in zoom-in duration-200">
        
        <div className="bg-[#120D0B] text-[#F8F1E4] p-6 flex items-center justify-between border-b border-[#D4AF62]/30">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#D41472] fill-current" />
            <h3 className="font-cinzel text-lg font-bold">My Wishlist ({wishlistProducts.length})</h3>
          </div>
          <button onClick={onClose} className="text-[#F8F1E4]/70 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {wishlistProducts.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Heart className="w-12 h-12 text-gray-300 mx-auto" />
              <p className="font-cinzel text-base text-gray-700">Your wishlist is empty</p>
              <p className="text-xs text-gray-500">Save your favourite sarees and jewellery pieces here.</p>
            </div>
          ) : (
            wishlistProducts.map((product) => {
              const discountedPrice = Math.round(product.basePrice * (1 - product.discount / 100));
              return (
                <div key={product.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-4">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="font-cinzel text-xs font-bold text-[#120D0B]">{product.name}</h4>
                      <p className="text-xs font-mono font-bold text-gray-900 mt-1">₹{discountedPrice.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onAddToCart(product);
                        onRemoveFromWishlist(product);
                      }}
                      className="px-3.5 py-2 bg-[#120D0B] text-[#F8F1E4] text-xs font-semibold rounded-lg hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors flex items-center gap-1.5"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Move to Cart
                    </button>
                    <button
                      onClick={() => onRemoveFromWishlist(product)}
                      className="p-2 text-gray-400 hover:text-rose-600 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
