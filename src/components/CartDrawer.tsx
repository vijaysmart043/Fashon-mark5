import React, { useState } from 'react';
import { Product } from '../data/mockData';
import { X, Trash2, ShoppingBag, ArrowRight, Tag, ShieldCheck } from 'lucide-react';
import { CouponRecord, StoreConfigRecord } from '../types/shippingReturns';
import {
  calculateOrderPricing,
  DEFAULT_COUPONS,
  DEFAULT_STORE_CONFIG,
  validateCouponAgainstSubtotal,
} from '../services/storeConfigService';

export interface CartItem {
  product: Product;
  quantity: number;
  variantSku?: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (product: Product, delta: number, variantSku?: string) => void;
  onRemoveItem: (product: Product, variantSku?: string) => void;
  onProceedToCheckout: () => void;
  storeConfig?: StoreConfigRecord;
  coupons?: CouponRecord[];
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  storeConfig = DEFAULT_STORE_CONFIG,
  coupons = DEFAULT_COUPONS,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponRecord | null>(null);
  const [couponError, setCouponError] = useState('');

  if (!isOpen) return null;

  const pricing = calculateOrderPricing({
    items: cartItems.map((ci) => ({ product: ci.product, quantity: ci.quantity })),
    storeConfig,
    appliedCoupon,
  });

  const handleApplyCoupon = () => {
    const check = validateCouponAgainstSubtotal({
      codeInput: couponCode,
      coupons,
      subtotal: pricing.subtotal,
    });
    if (check.valid && check.coupon) {
      setAppliedCoupon(check.coupon);
      setCouponError('');
    } else {
      setAppliedCoupon(null);
      setCouponError(check.reason || 'Invalid coupon code.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="bg-[#120D0B] text-[#F8F1E4] p-6 flex items-center justify-between border-b border-[#D4AF62]/30">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#D4AF62]" />
              <h3 className="font-cinzel text-lg font-bold">
                Your Shopping Cart ({cartItems.reduce((a, b) => a + b.quantity, 0)})
              </h3>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full" aria-label="Close Cart">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cartItems.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto" />
                <p className="font-cinzel text-lg text-gray-700">Your cart is currently empty</p>
                <p className="text-xs text-gray-500">Explore our exquisite collection of sarees and jewellery.</p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-[#120D0B] text-[#F8F1E4] rounded-lg text-xs font-semibold hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              cartItems.map((item, idx) => {
                const finalPrice = Math.round(item.product.basePrice * (1 - item.product.discount / 100));
                const variantObj = item.product.variants?.find((v) => v.sku === item.variantSku) || item.product.variants?.[0];
                const lineSubtotal = finalPrice * item.quantity;
                return (
                  <div
                    key={`${item.product.id}-${item.variantSku || idx}`}
                    className="flex gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100 items-center"
                  >
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded-lg shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-cinzel text-xs font-bold text-[#120D0B] truncate">{item.product.name}</h4>
                      <p className="text-[10px] text-gray-500 font-mono truncate">
                        SKU: {item.variantSku || variantObj?.sku || 'STD'}
                        {variantObj?.colour ? ` · ${variantObj.colour}` : ''}
                        {variantObj?.size ? ` · ${variantObj.size}` : ''}
                        {variantObj?.weight ? ` · ${variantObj.weight}` : ''}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] font-mono text-gray-600">
                          ₹{finalPrice.toLocaleString('en-IN')} × {item.quantity}
                        </p>
                        <p className="text-[11px] font-mono font-bold text-gray-900">
                          ₹{lineSubtotal.toLocaleString('en-IN')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border border-gray-300 rounded bg-white text-xs">
                          <button
                            onClick={() => onUpdateQuantity(item.product, -1, item.variantSku)}
                            className="px-2 py-0.5 hover:bg-gray-100 text-gray-600"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="px-2 font-mono font-bold">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(item.product, 1, item.variantSku)}
                            className="px-2 py-0.5 hover:bg-gray-100 text-gray-600"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.product, item.variantSku)}
                      className="p-2 text-gray-400 hover:text-rose-600 transition-colors"
                      title="Remove"
                      aria-label={`Remove ${item.product.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Summary & Checkout */}
          {cartItems.length > 0 && (
            <div className="border-t border-gray-200 p-6 bg-gray-50 space-y-4">
              {/* Coupon Box */}
              <div className="space-y-1">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Coupon Code (e.g. SDA15)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-[#D4AF62]"
                    />
                  </div>
                  <button
                    onClick={handleApplyCoupon}
                    className="px-4 py-2 bg-[#120D0B] text-[#F8F1E4] text-xs font-semibold rounded-lg hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {appliedCoupon && (
                  <p className="text-[11px] text-emerald-600 font-medium">
                    Coupon {appliedCoupon.code} applied ({appliedCoupon.discountPercent}% OFF)!
                  </p>
                )}
                {couponError && <p className="text-[11px] text-rose-600 font-medium">{couponError}</p>}
              </div>

              {/* Totals */}
              <div className="space-y-1.5 text-xs text-gray-600 pt-2 border-t border-gray-200">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">₹{pricing.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {pricing.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount ({appliedCoupon?.discountPercent}%)</span>
                    <span className="font-mono">-₹{pricing.discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Estimated Shipping</span>
                  <span className="font-mono">
                    {pricing.shippingFee === 0 ? 'FREE' : `₹${pricing.shippingFee.toLocaleString('en-IN')}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated GST</span>
                  <span className="font-mono">₹{pricing.gstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-[#120D0B] pt-2 border-t border-gray-300">
                  <span className="font-cinzel">Estimated Total</span>
                  <span className="font-mono text-lg text-[#65102F]">₹{pricing.total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                onClick={onProceedToCheckout}
                className="w-full py-3.5 bg-gradient-to-r from-[#D4AF62] to-[#AA8230] text-[#120D0B] font-bold rounded-xl text-sm shadow-lg hover:from-[#f3e5ab] hover:to-[#d4af62] transition-all flex items-center justify-center gap-2"
              >
                <span>Proceed to Secure Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Simulated Secure Payment & COD Available</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
