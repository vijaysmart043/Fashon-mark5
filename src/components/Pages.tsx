import React, { useEffect, useState } from 'react';
import { PRODUCTS, Product, MetalRate } from '../data/mockData';
import { ProductCard } from './ProductCard';
import {
  Search,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  Truck,
  Package,
  User,
  ArrowRight,
  HelpCircle,
  FileText,
  LogOut,
  ShieldAlert,
  Tag,
  Clock,
  Printer,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CreditCard,
  Info,
  Bell,
  Check,
} from 'lucide-react';
import { CartItem } from './CartDrawer';
import { useAuth } from '../context/AuthContext';
import { AddressManager, Address } from './AddressManager';
import { InvoiceView } from './InvoiceView';
import { ShipmentTracker } from './ShipmentTracker';
import { ReturnRequestModal } from './ReturnRequestModal';
import {
  fetchCustomerOrders,
  fetchCustomerRefunds,
  fetchCustomerReturns,
  fetchReturnPolicy,
  DEFAULT_RETURN_POLICY,
  updateReturnRequestWorkflow,
} from '../services/shippingReturnsService';
import {
  calculateOrderPricing,
  CategoryDoc,
  createOrRefreshStockReservation,
  DEFAULT_COUPONS,
  DEFAULT_STORE_CONFIG,
  deleteUserAddress,
  executeAtomicCheckout,
  fetchServerCheckoutQuote,
  fetchUserAddresses,
  saveUserAddress,
  validateCouponAgainstSubtotal,
} from '../services/storeConfigService';
import { triggerTransactionalEmail } from '../services/emailClientService';
import {
  CouponRecord,
  NotificationRecord,
  OrderItemSnapshot,
  OrderRecord,
  RefundRecord,
  ReturnPolicyConfig,
  ReturnRequestRecord,
  StoreConfigRecord,
} from '../types/shippingReturns';

interface PagesProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  products?: Product[];
  categories?: CategoryDoc[];
  metalRates: MetalRate[];
  coupons?: CouponRecord[];
  storeConfig?: StoreConfigRecord;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  initialCategory?: string;
  onCategoryChange?: (cat: string) => void;
  notifications?: NotificationRecord[];
  onMarkNotificationRead?: (id: string) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  wishlistIds: string[];
  onQuickView: (product: Product) => void;
  onOpenJewelleryCalc: (product: Product) => void;
  cartItems: CartItem[];
  onClearCart?: () => void;
  onOrderPlaced?: () => void;
  onProceedToCheckout: () => void;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
}

const formatDate = (ts: any): string => {
  if (!ts) return 'Recent';
  if (typeof ts?.toDate === 'function') {
    return ts.toDate().toLocaleDateString('en-IN', { dateStyle: 'medium' });
  }
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

export const Pages: React.FC<PagesProps> = ({
  activeTab,
  setActiveTab,
  products = PRODUCTS,
  categories = [],
  metalRates,
  coupons = DEFAULT_COUPONS,
  storeConfig = DEFAULT_STORE_CONFIG,
  searchQuery = '',
  onSearchQueryChange,
  initialCategory = 'All',
  onCategoryChange,
  notifications = [],
  onMarkNotificationRead,
  onAddToCart,
  onToggleWishlist,
  wishlistIds,
  onQuickView,
  onOpenJewelleryCalc,
  cartItems,
  onClearCart,
  onOrderPlaced,
  onOpenAuth,
  onOpenAdmin,
}) => {
  const { firebaseUser, userProfile, isStaff, logout, verifyEmail } = useAuth();

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(initialCategory || 'All');
  const [sortBy, setSortBy] = useState('featured');
  const [searchFilter, setSearchFilter] = useState(searchQuery || '');

  useEffect(() => {
    setSearchFilter(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategoryFilter(initialCategory);
    }
  }, [initialCategory]);

  // Address book state
  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: 'addr-1',
      fullName: 'Sravani Reddy',
      mobile: '9848012345',
      addressLine: 'Plot 42, Road No. 12, Banjara Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500034',
      addressType: 'Home',
      isDefault: true,
    },
  ]);
  const [selectedAddress, setSelectedAddress] = useState<Address>(addresses[0]);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponRecord | null>(null);
  const [couponError, setCouponError] = useState('');

  // Checkout flow state
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'success'>('form');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking' | 'wallet' | 'cod'>('upi');
  const [demoPaymentOutcome, setDemoPaymentOutcome] = useState<'success' | 'failed'>('success');
  const [placedOrder, setPlacedOrder] = useState<OrderRecord | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [activeOrderForInvoice, setActiveOrderForInvoice] = useState<any | null>(null);
  const [activeReservationId, setActiveReservationId] = useState<string>('');

  // Account data state (Firestore-backed)
  const [accountSubTab, setAccountSubTab] = useState<'orders' | 'tracking' | 'returns' | 'addresses' | 'notifications'>('orders');
  const [customerOrders, setCustomerOrders] = useState<OrderRecord[]>([]);
  const [customerReturns, setCustomerReturns] = useState<ReturnRequestRecord[]>([]);
  const [customerRefunds, setCustomerRefunds] = useState<RefundRecord[]>([]);
  const [returnPolicy, setReturnPolicy] = useState<ReturnPolicyConfig>({ ...DEFAULT_RETURN_POLICY });
  const [accountLoading, setAccountLoading] = useState(false);
  const [trackOrderFilter, setTrackOrderFilter] = useState('');
  const [returnTargetOrder, setReturnTargetOrder] = useState<OrderRecord | null>(null);
  const [accountFeedback, setAccountFeedback] = useState('');

  // Contact form state
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const loadCustomerPortalData = async () => {
    const policy = await fetchReturnPolicy();
    setReturnPolicy(policy);

    if (!firebaseUser) return;
    setAccountLoading(true);
    try {
      const [ordersList, returnsList, refundsList, savedAddrs] = await Promise.all([
        fetchCustomerOrders(firebaseUser.uid),
        fetchCustomerReturns(firebaseUser.uid),
        fetchCustomerRefunds(firebaseUser.uid),
        fetchUserAddresses(firebaseUser.uid),
      ]);
      setCustomerOrders(ordersList);
      setCustomerReturns(returnsList);
      setCustomerRefunds(refundsList);
      if (savedAddrs.length > 0) {
        setAddresses(savedAddrs);
        setSelectedAddress(savedAddrs.find((a) => a.isDefault) || savedAddrs[0]);
      }
    } catch (err) {
      console.error('Error loading customer account records:', err);
    } finally {
      setAccountLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'account' || activeTab === 'policies' || activeTab === 'track' || activeTab === 'checkout') {
      void loadCustomerPortalData();
    }
  }, [activeTab, firebaseUser]);

  // Stock reservation refresh when entering checkout
  useEffect(() => {
    if (activeTab === 'checkout' && firebaseUser && cartItems.length > 0) {
      createOrRefreshStockReservation({
        userId: firebaseUser.uid,
        items: cartItems.map((ci) => ({
          productId: ci.product.id,
          variantSku: ci.variantSku || ci.product.variants?.[0]?.sku || 'STD',
          quantity: ci.quantity,
        })),
        expiryMinutes: storeConfig.reservationExpiryMinutes || 10,
      })
        .then((res) => setActiveReservationId(res.id))
        .catch(() => {});
    }
  }, [activeTab, firebaseUser, cartItems.length]);

  // Filter products based on tab
  const filteredProducts = products.filter((p) => {
    if (p.active === false) return false;
    if (activeTab === 'jewellery' && p.type !== 'jewellery') return false;
    if (activeTab === 'sarees' && p.type !== 'saree') return false;
    if (activeTab === 'dresses' && p.type !== 'dress') return false;
    if (activeTab === 'offers' && p.discount < 10) return false;
    if (selectedCategoryFilter !== 'All') {
      const cf = selectedCategoryFilter.toLowerCase();
      if (cf === 'new arrivals') {
        if (!p.newArrival) return false;
      } else if (cf === 'best sellers') {
        if (!p.bestseller) return false;
      } else if (cf === 'wedding collection' || cf === 'festive collection') {
        if (!p.featured && !p.category.toLowerCase().includes('bridal')) return false;
      } else if (p.category.toLowerCase() !== cf && !p.category.toLowerCase().includes(cf)) {
        return false;
      }
    }
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      const hay = `${p.name} ${p.category} ${p.shortDescription || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (sortBy === 'price-low') filteredProducts.sort((a, b) => a.basePrice - b.basePrice);
  if (sortBy === 'price-high') filteredProducts.sort((a, b) => b.basePrice - a.basePrice);
  if (sortBy === 'rating') filteredProducts.sort((a, b) => b.rating - a.rating);

  const renderMainContent = () => {
    if (
      activeTab === 'shop' ||
      activeTab === 'jewellery' ||
      activeTab === 'sarees' ||
      activeTab === 'dresses' ||
      activeTab === 'collections' ||
      activeTab === 'offers'
    ) {
      return (
        <div className="min-h-screen bg-[#F8F1E4] py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="bg-[#120D0B] text-[#F8F1E4] rounded-2xl p-8 sm:p-12 shadow-xl border border-[#D4AF62]/30 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3 text-center md:text-left">
                <span className="text-xs uppercase tracking-widest text-[#D4AF62] font-semibold">
                  SDA COLLECTIONS CATALOGUE
                </span>
                <h1 className="font-cinzel text-3xl sm:text-4xl font-bold capitalize">
                  {activeTab === 'collections' ? 'Wedding & Festive Edit' : activeTab}
                </h1>
                <p className="text-xs sm:text-sm text-[#F8F1E4]/80 max-w-xl font-poppins">
                  Explore hand-curated pure Kanchipuram silk sarees, BIS hallmarked 22K gold temple jewellery, and royal occasion wear.
                </p>
              </div>

              <div className="bg-[#211713] p-4 rounded-xl border border-[#D4AF62]/40 text-xs space-y-2 min-w-[240px]">
                <p className="font-bold text-[#D4AF62] uppercase tracking-wider text-center border-b border-[#D4AF62]/20 pb-1">
                  Live Metal Rates (Today)
                </p>
                {metalRates.map((mr, idx) => (
                  <div key={idx} className="flex justify-between items-center text-white/90 font-mono">
                    <span>
                      {mr.metal} ({mr.purity}):
                    </span>
                    <span className="font-bold text-[#D4AF62]">₹{mr.ratePerGram.toLocaleString('en-IN')}/g</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-[#211713]/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-semibold text-gray-700 mr-2">Category:</span>
                {[
                  'All',
                  ...(categories.length > 0
                    ? categories.filter((c) => c.active !== false).map((c) => c.name)
                    : [
                        'Gold Jewellery',
                        'Kanchipuram Sarees',
                        'Bridal Jewellery',
                        'Gadwal Sarees',
                        'Silver Jewellery',
                        'Designer Dresses',
                      ]),
                ].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategoryFilter(cat);
                      onCategoryChange?.(cat);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedCategoryFilter === cat
                        ? 'bg-[#120D0B] text-[#F8F1E4]'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter by name..."
                    value={searchFilter}
                    onChange={(e) => {
                      setSearchFilter(e.target.value);
                      onSearchQueryChange?.(e.target.value);
                    }}
                    className="pl-9 pr-4 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-[#D4AF62]"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-[#D4AF62] text-gray-700 font-medium"
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="font-cinzel text-xl font-bold text-gray-800">No products found</h3>
                <p className="text-xs text-gray-500 mt-1">Try clearing your filters or search terms.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
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
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'checkout') {
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
          setCouponError(check.reason || 'Invalid or expired coupon code.');
        }
      };

      const handleAddAndSaveAddress = async (addr: Address) => {
        setAddresses((prev) => [...prev, addr]);
        if (firebaseUser) {
          try {
            await saveUserAddress({ ...addr, userId: firebaseUser.uid });
          } catch {
            // non-blocking fallback if user isn't verified yet
          }
        }
      };

      const handleDeleteSavedAddress = async (id: string) => {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        if (firebaseUser) {
          try {
            await deleteUserAddress(id);
          } catch {
            // ignore
          }
        }
      };

      const handlePlaceOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setCheckoutError('');

        if (cartItems.length === 0) {
          setCheckoutError('Your shopping bag is empty. Add items before checking out.');
          return;
        }

        if (!firebaseUser) {
          setCheckoutError(
            'Please sign in first so your order, invoice, shipment tracking, and return rights are linked to your account.'
          );
          onOpenAuth();
          return;
        }

        const isPhoneAuth = firebaseUser.providerData.some((p) => p.providerId === 'phone');
        if (!firebaseUser.emailVerified && !isPhoneAuth) {
          setCheckoutError(
            'Please verify your email address before placing a secured order (check your inbox or resend from Account).'
          );
          return;
        }

        setCheckoutSubmitting(true);
        try {
          const verifiedQuote = await fetchServerCheckoutQuote({
            items: cartItems.map((ci) => ({ product: ci.product, quantity: ci.quantity })),
            storeConfig,
            appliedCoupon,
          });

          const recipientEmail = firebaseUser.email || '';
          const customerDisplayName =
            selectedAddress.fullName || userProfile?.fullName || 'Valued Customer';

          if (paymentMethod !== 'cod' && demoPaymentOutcome === 'failed') {
            const failAttemptId = `FAIL-${Date.now()}`;
            if (recipientEmail) {
              void triggerTransactionalEmail({
                templateType: 'payment_status',
                recipientEmail,
                recipientName: customerDisplayName,
                userId: firebaseUser.uid,
                idempotencyKey: `pay-fail-${firebaseUser.uid}-${failAttemptId}`,
                orderNumber: failAttemptId,
                amount: verifiedQuote.total,
                paymentMethod,
                paymentStatus: 'Failed',
                notes: 'Simulated online payment declined in demo checkout. No order was placed.',
              });
            }
            setCheckoutError(
              'Simulated payment declined (Demo Failure mode). Payment failure notification email logged; switch demo outcome to Success or choose COD to place order.'
            );
            return;
          }

          const itemSnapshots: OrderItemSnapshot[] = cartItems.map((ci) => {
            const unitPrice = Math.round(ci.product.basePrice * (1 - ci.product.discount / 100));
            return {
              productId: ci.product.id,
              name: ci.product.name,
              category: ci.product.category,
              variantSku: ci.variantSku || ci.product.variants[0]?.sku || 'STD',
              quantity: ci.quantity,
              unitPrice,
              basePrice: ci.product.basePrice,
              discount: ci.product.discount,
              image: ci.product.images[0] || '',
            };
          });

          const created = await executeAtomicCheckout({
            userId: firebaseUser.uid,
            customerName: customerDisplayName,
            customerEmail: recipientEmail,
            items: itemSnapshots,
            subtotal: verifiedQuote.subtotal,
            discountAmount: verifiedQuote.discountAmount,
            couponCode: appliedCoupon?.code || '',
            shippingFee: verifiedQuote.shippingFee,
            gstAmount: verifiedQuote.gstAmount,
            total: verifiedQuote.total,
            paymentMethod,
            reservationId: activeReservationId,
            shippingAddress: {
              fullName: selectedAddress.fullName,
              mobile: selectedAddress.mobile,
              addressLine: selectedAddress.addressLine,
              city: selectedAddress.city,
              state: selectedAddress.state,
              pincode: selectedAddress.pincode,
            },
          });

          if (recipientEmail) {
            void triggerTransactionalEmail({
              templateType: 'order_confirmation',
              recipientEmail,
              recipientName: customerDisplayName,
              userId: firebaseUser.uid,
              idempotencyKey: `order-confirm-${created.orderNumber}`,
              orderNumber: created.orderNumber,
              amount: created.total,
              paymentMethod: created.paymentMethod,
              paymentStatus: created.paymentStatus,
            });
            void triggerTransactionalEmail({
              templateType: 'payment_status',
              recipientEmail,
              recipientName: customerDisplayName,
              userId: firebaseUser.uid,
              idempotencyKey: `payment-${created.orderNumber}-${created.paymentStatus}`,
              orderNumber: created.orderNumber,
              amount: created.total,
              paymentMethod: created.paymentMethod,
              paymentStatus: created.paymentStatus,
            });
            void triggerTransactionalEmail({
              templateType: 'invoice_notification',
              recipientEmail,
              recipientName: customerDisplayName,
              userId: firebaseUser.uid,
              idempotencyKey: `invoice-${created.orderNumber}`,
              orderNumber: created.orderNumber,
              invoiceNumber: `INV-${created.orderNumber}`,
              amount: created.total,
            });
          }

          setPlacedOrder(created);
          setCheckoutStep('success');
          if (onClearCart) onClearCart();
          if (onOrderPlaced) onOrderPlaced();
        } catch (err: any) {
          setCheckoutError(err?.message || 'Unable to place simulated order. Please verify stock and session.');
        } finally {
          setCheckoutSubmitting(false);
        }
      };

      return (
        <div className="min-h-screen bg-[#F8F1E4] py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {checkoutStep === 'form' ? (
              <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 overflow-hidden">
                <div className="bg-[#120D0B] text-[#F8F1E4] p-6 border-b border-[#D4AF62]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h2 className="font-cinzel text-2xl font-bold">DEMO / SIMULATED Payment & Checkout</h2>
                    <p className="text-xs text-[#D4AF62]">
                      No real payment gateway or real money transfer occurs.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#211713] border border-[#D4AF62]/40 text-xs text-[#D4AF62]">
                    <Clock className="w-4 h-4 animate-pulse" />
                    <span>Stock Reserved for {storeConfig.reservationExpiryMinutes}:00 mins</span>
                  </div>
                </div>

                <form onSubmit={handlePlaceOrder} className="p-6 sm:p-8 space-y-8">
                  {!firebaseUser && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Sign in with your verified account to persist orders, tracking, and returns.</span>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="px-4 py-2 bg-[#120D0B] text-[#F8F1E4] rounded-lg font-bold shrink-0"
                      >
                        Sign In / Register
                      </button>
                    </div>
                  )}

                  {checkoutError && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="font-cinzel font-bold text-lg text-[#120D0B] border-b pb-2">
                      1. Delivery Address
                    </h3>
                    <AddressManager
                      addresses={addresses}
                      onAddAddress={(addr) => void handleAddAndSaveAddress(addr)}
                      onDeleteAddress={(id) => void handleDeleteSavedAddress(id)}
                      onSelectAddress={(addr) => setSelectedAddress(addr)}
                      selectedAddressId={selectedAddress.id}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-cinzel font-bold text-lg text-[#120D0B] border-b pb-2">
                      2. Order Summary & Pricing Breakdown
                    </h3>

                    <div className="space-y-3">
                      {cartItems.map((item, idx) => {
                        const unitPrice = Math.round(item.product.basePrice * (1 - item.product.discount / 100));
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={item.product.images[0]}
                                alt=""
                                className="w-12 h-12 object-cover rounded-lg"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <p className="font-cinzel font-bold text-[#120D0B]">{item.product.name}</p>
                                <p className="text-gray-500">
                                  Qty: {item.quantity} | SKU: {item.variantSku || item.product.variants?.[0]?.sku || 'STD'}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-gray-900">
                              ₹{(unitPrice * item.quantity).toLocaleString('en-IN')}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                      <label className="block text-xs font-semibold text-gray-700">Apply Promotional Coupon</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Enter coupon code (e.g. SDA15)"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-300 bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          className="px-4 py-2 bg-[#120D0B] text-[#F8F1E4] text-xs font-semibold rounded-lg hover:bg-[#D4AF62] hover:text-[#120D0B]"
                        >
                          Apply
                        </button>
                      </div>
                      {appliedCoupon && (
                        <p className="text-xs text-emerald-600 font-medium">
                          Coupon {appliedCoupon.code} applied ({appliedCoupon.discountPercent}% OFF)!
                        </p>
                      )}
                      {couponError && <p className="text-xs text-rose-600 font-medium">{couponError}</p>}
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-[#D4AF62]/40 space-y-2 text-xs text-gray-700 shadow-sm">
                      <div className="flex justify-between">
                        <span>Items Subtotal</span>
                        <span className="font-mono">₹{pricing.subtotal.toLocaleString('en-IN')}</span>
                      </div>
                      {pricing.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Coupon Discount ({appliedCoupon?.discountPercent}%)</span>
                          <span className="font-mono">-₹{pricing.discountAmount.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Estimated Insured Shipping</span>
                        <span className="font-mono">
                          {pricing.shippingFee === 0
                            ? `FREE (Orders >= ₹${storeConfig.freeShippingThreshold.toLocaleString('en-IN')})`
                            : `₹${pricing.shippingFee.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          Estimated GST ({storeConfig.jewelleryGstPercent}% Jewellery / {storeConfig.sareeGstPercent}% Silk)
                        </span>
                        <span className="font-mono">₹{pricing.gstAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold text-[#120D0B] pt-3 border-t border-gray-200">
                        <span className="font-cinzel text-base">Final Payable Total</span>
                        <span className="font-mono text-xl text-[#65102F]">₹{pricing.total.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-cinzel font-bold text-lg text-[#120D0B] border-b pb-2">
                      3. Payment Method (DEMO / SIMULATED)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {[
                        { id: 'upi', title: 'UPI (DEMO / SIMULATED)', sub: 'Simulated reference only' },
                        { id: 'card', title: 'Card (DEMO / SIMULATED)', sub: 'No card numbers collected' },
                        { id: 'netbanking', title: 'Net Banking (DEMO / SIMULATED)', sub: 'Simulated authorization' },
                        { id: 'wallet', title: 'Wallet (DEMO / SIMULATED)', sub: 'Simulated wallet transfer' },
                        { id: 'cod', title: 'Cash on Delivery (COD)', sub: 'Pay upon doorstep receipt' },
                      ].map((pm) => (
                        <label
                          key={pm.id}
                          className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                            paymentMethod === pm.id ? 'border-[#D4AF62] bg-amber-50/50' : 'border-gray-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="payment"
                            checked={paymentMethod === pm.id}
                            onChange={() => setPaymentMethod(pm.id as any)}
                          />
                          <div>
                            <p className="font-bold">{pm.title}</p>
                            <p className="text-[11px] text-gray-500">{pm.sub}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    {paymentMethod !== 'cod' && (
                      <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-gray-700">
                          Simulated Online Payment Outcome:
                        </span>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-700">
                            <input
                              type="radio"
                              name="demoOutcome"
                              checked={demoPaymentOutcome === 'success'}
                              onChange={() => setDemoPaymentOutcome('success')}
                            />
                            Simulate Payment Success
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-rose-700">
                            <input
                              type="radio"
                              name="demoOutcome"
                              checked={demoPaymentOutcome === 'failed'}
                              onChange={() => setDemoPaymentOutcome('failed')}
                            />
                            Simulate Payment Failure
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={checkoutSubmitting || cartItems.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-[#D4AF62] to-[#AA8230] text-[#120D0B] font-bold rounded-xl text-sm shadow-xl hover:from-[#f3e5ab] hover:to-[#d4af62] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>
                      {checkoutSubmitting
                        ? 'Recording Order & Reserving Inventory...'
                        : `Confirm Simulated Payment & Place Order (₹${pricing.total.toLocaleString('en-IN')})`}
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 p-8 sm:p-12 text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-cinzel text-3xl font-bold text-[#120D0B]">
                    Simulated Payment Recorded & Order Confirmed!
                  </h2>
                  <p className="text-xs text-gray-500">
                    Order Number:{' '}
                    <span className="font-mono font-bold text-[#65102F]">{placedOrder?.orderNumber}</span>
                  </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl max-w-md mx-auto text-left text-xs space-y-2 text-gray-700">
                  <p>
                    <strong>Delivery Address:</strong> {selectedAddress.addressLine}, {selectedAddress.city},{' '}
                    {selectedAddress.state} - {selectedAddress.pincode}
                  </p>
                  <p>
                    <strong>Payment Mode:</strong> {paymentMethod.toUpperCase()} ({placedOrder?.paymentStatus})
                  </p>
                  <p>
                    <strong>Shipping Note:</strong> Your order is saved in Firestore. Once dispatch assigns a courier,
                    store-updated tracking will appear under Track Shipment.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  <button
                    onClick={() => {
                      if (!placedOrder) return;
                      setActiveOrderForInvoice({
                        orderNumber: placedOrder.orderNumber,
                        createdAt: new Date().toLocaleDateString(),
                        items: placedOrder.items.map((it) => ({
                          product: { name: it.name, basePrice: it.basePrice, discount: it.discount },
                          quantity: it.quantity,
                          variantSku: it.variantSku,
                        })),
                        total: placedOrder.total,
                        paymentMethod: placedOrder.paymentMethod,
                        paymentStatus: placedOrder.paymentStatus,
                        shippingAddress: placedOrder.shippingAddress,
                      });
                    }}
                    className="px-6 py-3 bg-[#D4AF62] text-[#120D0B] rounded-xl text-xs font-bold hover:bg-[#f3e5ab] transition-colors flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Download Tax Invoice
                  </button>
                  <button
                    onClick={() => {
                      setCheckoutStep('form');
                      setActiveTab('account');
                      setAccountSubTab('orders');
                    }}
                    className="px-6 py-3 bg-[#120D0B] text-[#F8F1E4] rounded-xl text-xs font-semibold hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors"
                  >
                    View My Orders
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'account') {
      if (!firebaseUser) {
        return (
          <div className="min-h-[70vh] bg-[#F8F1E4] flex items-center justify-center py-16 px-4">
            <div className="bg-white p-10 rounded-2xl shadow-xl border border-[#D4AF62]/30 text-center max-w-md w-full space-y-6">
              <User className="w-16 h-16 text-[#D4AF62] mx-auto" />
              <div className="space-y-2">
                <h2 className="font-cinzel text-2xl font-bold text-[#120D0B]">Customer Account</h2>
                <p className="text-xs text-gray-600">
                  Please sign in or register to access your orders, shipment tracking, returns, and simulated refunds.
                </p>
              </div>
              <button
                onClick={onOpenAuth}
                className="w-full py-3 bg-[#120D0B] text-[#F8F1E4] rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors shadow"
              >
                Sign In / Register
              </button>
            </div>
          </div>
        );
      }

      const isPhoneAuth = firebaseUser.providerData.some((p) => p.providerId === 'phone');

      return (
        <div className="min-h-screen bg-[#F8F1E4] py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Profile Banner */}
            <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#120D0B] text-[#D4AF62] font-cinzel text-2xl font-bold flex items-center justify-center border-2 border-[#D4AF62]">
                  {(userProfile?.fullName || firebaseUser.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="space-y-1">
                  <h2 className="font-cinzel text-xl font-bold text-[#120D0B]">
                    {userProfile?.fullName || 'Valued Customer'}
                  </h2>
                  <p className="text-xs text-gray-500 font-mono">{firebaseUser.email || firebaseUser.phoneNumber}</p>
                  <p className="text-[11px] font-semibold text-[#65102F] uppercase">
                    Role: {userProfile?.role || 'customer'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {isStaff && (
                  <button
                    onClick={onOpenAdmin}
                    className="px-5 py-2.5 bg-[#120D0B] text-[#D4AF62] hover:bg-[#211713] rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 border border-[#D4AF62]/50 shadow"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Operations Admin Panel</span>
                  </button>
                )}
                <button
                  onClick={() => void loadCustomerPortalData()}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={async () => {
                    await logout();
                    setActiveTab('home');
                  }}
                  className="px-5 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 border border-rose-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {!firebaseUser.emailVerified && !isPhoneAuth && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>
                  Your email is not yet verified. Verify your email to submit orders, addresses, and return requests.
                </span>
                <button
                  onClick={async () => {
                    await verifyEmail();
                    setVerificationSent(true);
                  }}
                  className="px-4 py-2 bg-[#120D0B] text-[#F8F1E4] rounded-lg font-semibold shrink-0"
                >
                  {verificationSent ? 'Verification Email Sent' : 'Resend Verification Email'}
                </button>
              </div>
            )}

            {accountFeedback && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                <span>{accountFeedback}</span>
                <button onClick={() => setAccountFeedback('')} className="underline font-semibold">
                  Dismiss
                </button>
              </div>
            )}

            {/* Account Navigation Sub-Tabs */}
            <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl shadow-sm border border-[#D4AF62]/20">
              {[
                { id: 'orders', label: `My Orders (${customerOrders.length})`, icon: Package },
                { id: 'tracking', label: 'Track Shipments', icon: Truck },
                { id: 'returns', label: `Returns & Refunds (${customerReturns.length})`, icon: RotateCcw },
                { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
                { id: 'notifications', label: `Notifications (${notifications.filter((n) => !n.read).length})`, icon: Bell },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setAccountSubTab(t.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                      accountSubTab === t.id
                        ? 'bg-[#120D0B] text-[#F8F1E4]'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[#D4AF62]" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {accountSubTab === 'orders' && (
              <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-cinzel font-bold text-lg text-[#120D0B]">My Orders & Invoices</h3>
                  <button
                    onClick={() => setActiveTab('shop')}
                    className="text-xs font-semibold text-[#65102F] hover:underline"
                  >
                    Continue Shopping
                  </button>
                </div>

                {accountLoading ? (
                  <p className="text-xs text-gray-500 py-6 text-center">Loading your orders...</p>
                ) : customerOrders.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <Package className="w-12 h-12 text-gray-300 mx-auto" />
                    <p className="text-xs text-gray-600">No persisted orders found under your account yet.</p>
                    <button
                      onClick={() => setActiveTab('shop')}
                      className="px-5 py-2.5 bg-[#120D0B] text-[#F8F1E4] rounded-xl text-xs font-bold"
                    >
                      Explore Catalogue
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerOrders.map((ord) => {
                      const canReturn = ord.status === 'Delivered' || ord.status === 'Return Requested';
                      const relatedReturn = customerReturns.find((r) => r.orderId === ord.id);
                      return (
                        <div
                          key={ord.id}
                          className="p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-3 text-xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="font-mono font-bold text-sm text-[#65102F]">{ord.orderNumber}</span>
                              <span className="text-gray-400 mx-2">|</span>
                              <span className="text-gray-500">{formatDate(ord.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-1 rounded bg-[#FAF6EE] border border-[#D4AF62]/50 text-[#120D0B] font-bold">
                                {ord.status}
                              </span>
                              <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                                {ord.paymentMethod.toUpperCase()} · {ord.paymentStatus}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1 text-gray-700">
                            {ord.items.map((it, i) => (
                              <p key={i}>
                                {it.name} ({it.variantSku}) × {it.quantity} — ₹
                                {(it.unitPrice * it.quantity).toLocaleString('en-IN')}
                              </p>
                            ))}
                            <p className="font-mono font-bold text-[#120D0B] pt-1">
                              Total: ₹{ord.total.toLocaleString('en-IN')}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-gray-200">
                            <button
                              onClick={() => {
                                setActiveOrderForInvoice({
                                  orderNumber: ord.orderNumber,
                                  createdAt: formatDate(ord.createdAt),
                                  items: ord.items.map((it) => ({
                                    product: { name: it.name, basePrice: it.basePrice, discount: it.discount },
                                    quantity: it.quantity,
                                    variantSku: it.variantSku,
                                  })),
                                  total: ord.total,
                                  paymentMethod: ord.paymentMethod,
                                  paymentStatus: ord.paymentStatus,
                                  shippingAddress: ord.shippingAddress,
                                });
                              }}
                              className="px-3.5 py-2 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors flex items-center gap-1.5"
                            >
                              <Printer className="w-3.5 h-3.5" /> Invoice
                            </button>

                            <button
                              onClick={() => {
                                setTrackOrderFilter(ord.orderNumber);
                                setAccountSubTab('tracking');
                              }}
                              className="px-3.5 py-2 bg-white border border-gray-300 text-gray-800 rounded-lg font-semibold hover:border-[#D4AF62] flex items-center gap-1.5"
                            >
                              <Truck className="w-3.5 h-3.5 text-[#65102F]" /> Track Shipment
                            </button>

                            {canReturn && (
                              <button
                                onClick={() => setReturnTargetOrder(ord)}
                                className="px-3.5 py-2 bg-[#65102F] text-white rounded-lg font-semibold hover:bg-[#4a0b22] flex items-center gap-1.5"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Request Return
                              </button>
                            )}

                            {relatedReturn && (
                              <button
                                onClick={() => setAccountSubTab('returns')}
                                className="px-3 py-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg font-semibold"
                              >
                                Return {relatedReturn.returnNumber}: {relatedReturn.status}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {accountSubTab === 'tracking' && (
              <ShipmentTracker
                initialOrderNumber={trackOrderFilter}
                onOpenAuth={onOpenAuth}
                onGoToOrders={() => setAccountSubTab('orders')}
              />
            )}

            {accountSubTab === 'returns' && (
              <div className="space-y-6">
                {/* Return Requests */}
                <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 p-6 sm:p-8 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                    <div>
                      <h3 className="font-cinzel font-bold text-lg text-[#120D0B]">My Return Requests</h3>
                      <p className="text-[11px] text-gray-500">
                        Returns can be requested on delivered orders from the My Orders tab within {returnPolicy.returnWindowDays} days.
                      </p>
                    </div>
                  </div>

                  {customerReturns.length === 0 ? (
                    <p className="text-xs text-gray-500 py-6 text-center">No return requests submitted yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {customerReturns.map((ret) => {
                        const linkedRefund = customerRefunds.find((rf) => rf.returnId === ret.id);
                        return (
                          <div
                            key={ret.id}
                            className="p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-3 text-xs"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="font-mono font-bold text-sm text-[#65102F]">
                                  {ret.returnNumber}
                                </span>
                                <span className="text-gray-400 mx-2">|</span>
                                <span className="font-mono text-gray-700">Order: {ret.orderNumber}</span>
                              </div>
                              <span className="px-3 py-1 rounded-lg bg-[#FAF6EE] border border-[#D4AF62]/50 font-bold text-[#120D0B] self-start sm:self-auto">
                                {ret.status}
                              </span>
                            </div>

                            <div className="space-y-1 text-gray-700">
                              {ret.items.map((it, idx) => (
                                <p key={idx}>
                                  {it.productName} ({it.variantSku}) × {it.quantity} — ₹
                                  {it.lineTotal.toLocaleString('en-IN')}
                                </p>
                              ))}
                              <p>
                                <strong>Reason:</strong> {ret.reason}
                              </p>
                              {ret.description && (
                                <p>
                                  <strong>Details:</strong> {ret.description}
                                </p>
                              )}
                              {ret.inspectionNotes && (
                                <p className="text-[#65102F]">
                                  <strong>Inspection Notes:</strong> {ret.inspectionNotes}
                                </p>
                              )}
                              {ret.adminNotes && (
                                <p className="text-gray-700">
                                  <strong>Support Notes:</strong> {ret.adminNotes}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200">
                              <span className="font-mono font-bold text-[#120D0B]">
                                Requested Simulated Refund: ₹{ret.requestedRefundAmount.toLocaleString('en-IN')}
                              </span>
                              {ret.status === 'Requested' && (
                                <button
                                  onClick={async () => {
                                    await updateReturnRequestWorkflow({
                                      returnRequest: ret,
                                      nextStatus: 'Closed',
                                      actorUid: firebaseUser.uid,
                                      actorEmail: firebaseUser.email || '',
                                    });
                                    setAccountFeedback(`Return request ${ret.returnNumber} withdrawn.`);
                                    void loadCustomerPortalData();
                                  }}
                                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100"
                                >
                                  Withdraw Request
                                </button>
                              )}
                            </div>

                            {linkedRefund && (
                              <div className="p-3.5 rounded-xl bg-white border border-[#D4AF62]/40 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[#120D0B] flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5 text-[#D4AF62]" />
                                    Simulated Refund {linkedRefund.refundNumber}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                                    {linkedRefund.status}
                                  </span>
                                </div>
                                <p className="text-gray-600">
                                  Amount: <strong className="font-mono">₹{linkedRefund.refundAmount.toLocaleString('en-IN')}</strong> · Ref:{' '}
                                  <span className="font-mono">{linkedRefund.referenceId}</span>
                                </p>
                                {linkedRefund.refundModeNote && (
                                  <p className="text-[11px] text-gray-500">{linkedRefund.refundModeNote}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Standalone Simulated Refunds Overview */}
                {customerRefunds.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 p-6 sm:p-8 space-y-4">
                    <h3 className="font-cinzel font-bold text-lg text-[#120D0B] border-b pb-3">
                      Simulated Refund Ledger
                    </h3>
                    <div className="space-y-3">
                      {customerRefunds.map((rf) => (
                        <div key={rf.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-[#65102F]">{rf.refundNumber}</span>
                            <span className="px-2.5 py-0.5 rounded bg-white border border-[#D4AF62]/40 font-bold">
                              {rf.status}
                            </span>
                          </div>
                          <p>
                            Order {rf.orderNumber} · Method: {rf.originalPaymentMethod.toUpperCase()} · Amount:{' '}
                            <strong className="font-mono">₹{rf.refundAmount.toLocaleString('en-IN')}</strong>
                          </p>
                          <p className="text-[11px] text-gray-500">{rf.refundModeNote}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {accountSubTab === 'addresses' && (
              <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 p-6 sm:p-8">
                <AddressManager
                  addresses={addresses}
                  onAddAddress={async (addr) => {
                    setAddresses((prev) => [...prev, addr]);
                    if (firebaseUser) {
                      try {
                        await saveUserAddress({ ...addr, userId: firebaseUser.uid });
                      } catch {
                        // ignore
                      }
                    }
                  }}
                  onDeleteAddress={async (id) => {
                    setAddresses((prev) => prev.filter((a) => a.id !== id));
                    if (firebaseUser) {
                      try {
                        await deleteUserAddress(id);
                      } catch {
                        // ignore
                      }
                    }
                  }}
                  onSelectAddress={(addr) => setSelectedAddress(addr)}
                  selectedAddressId={selectedAddress.id}
                />
              </div>
            )}

            {accountSubTab === 'notifications' && (
              <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 p-6 sm:p-8 space-y-4">
                <h3 className="font-cinzel font-bold text-lg text-[#120D0B] border-b pb-3">
                  In-App Notifications ({notifications.length})
                </h3>
                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-500 py-8 text-center">No notifications recorded for your account yet.</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-4 ${
                          n.read ? 'bg-gray-50 border-gray-200' : 'bg-amber-50/70 border-[#D4AF62]/50'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#120D0B]">{n.title}</span>
                            <span className="text-[10px] uppercase tracking-wider text-[#65102F] font-semibold">
                              {n.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-gray-700">{n.message}</p>
                        </div>
                        {!n.read && onMarkNotificationRead && (
                          <button
                            onClick={() => onMarkNotificationRead(n.id)}
                            className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-emerald-700 font-semibold flex items-center gap-1 shrink-0 hover:bg-emerald-50"
                          >
                            <Check className="w-3.5 h-3.5" /> Mark Read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'track') {
      return (
        <div className="min-h-screen bg-[#F8F1E4] py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <ShipmentTracker
              initialOrderNumber={trackOrderFilter}
              onOpenAuth={onOpenAuth}
              onGoToOrders={() => {
                setActiveTab('account');
                setAccountSubTab('orders');
              }}
            />
          </div>
        </div>
      );
    }

    if (activeTab === 'policies') {
      return (
        <div className="min-h-screen bg-[#F8F1E4] py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-[#D4AF62]/30 space-y-6 text-xs leading-relaxed text-gray-700">
            <div className="border-b pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#65102F]">
                Store-Configured Demonstration Policies
              </span>
              <h1 className="font-cinzel text-3xl font-bold text-[#120D0B] mt-1">
                Shipping, Returns & Simulated Refund Policy
              </h1>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                These policy terms are configurable demonstration defaults for SDA Collections and must be reviewed and verified by store administrators before commercial deployment.
              </span>
            </div>

            <div className="space-y-3">
              <h2 className="font-cinzel text-lg font-bold text-[#120D0B]">1. Shipping & Store-Updated Tracking</h2>
              <p>
                Shipments are dispatched via store-configured courier partners (such as Blue Dart, Delhivery, or DTDC). Tracking milestones shown on our portal are store-updated records rather than live third-party courier API feeds.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="font-cinzel text-lg font-bold text-[#120D0B]">
                2. Return Eligibility ({returnPolicy.returnWindowDays}-Day Window)
              </h2>
              <p>
                <strong>Returns Status:</strong> {returnPolicy.returnsEnabled ? 'Currently Active' : 'Temporarily Paused'}
              </p>
              <p>
                <strong>Quality Inspection:</strong>{' '}
                {returnPolicy.inspectionRequired ? 'Physical inspection required before refund initiation' : 'Standard review'}
              </p>
              <p>
                <strong>Eligible Categories:</strong> {returnPolicy.eligibleCategories.join(', ')}
              </p>
              <p>
                <strong>Non-Returnable Rules:</strong> {returnPolicy.nonReturnableReasonsNote}
              </p>
              <p>{returnPolicy.returnInstructions}</p>
            </div>

            <div className="space-y-3">
              <h2 className="font-cinzel text-lg font-bold text-[#120D0B]">3. Simulated Refund Handling</h2>
              <p>
                All refunds recorded in this storefront are <strong>simulated operational records</strong>. No live payment gateway reversals or external bank transfers are executed. Cash on Delivery (COD) returns are logged as simulated COD / store-credit refund records.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'contact') {
      return (
        <div className="min-h-screen bg-[#F8F1E4] py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-[#D4AF62]/30 space-y-6">
            <h1 className="font-cinzel text-3xl font-bold text-[#120D0B]">Contact SDA Concierge</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
              <div className="space-y-4 text-gray-700">
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#65102F]" /> Banjara Hills Road No. 12, Hyderabad, Telangana 500034
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#65102F]" /> +91 98480 12345 / +91 40 2334 5678
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#65102F]" /> support@sdacollections.com
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setContactSubmitted(true);
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300"
                />
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300"
                />
                <textarea
                  rows={3}
                  required
                  placeholder="How can we assist you?"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#120D0B] text-[#F8F1E4] rounded-xl font-bold hover:bg-[#D4AF62] hover:text-[#120D0B]"
                >
                  Send Inquiry
                </button>
                {contactSubmitted && (
                  <p className="text-emerald-700 font-semibold">Inquiry received by our concierge desk.</p>
                )}
              </form>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'about' || activeTab === 'faq') {
      return (
        <div className="min-h-screen bg-[#F8F1E4] py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-[#D4AF62]/30 space-y-6 text-xs text-gray-700 leading-relaxed">
            <h1 className="font-cinzel text-3xl font-bold text-[#120D0B]">
              {activeTab === 'about' ? 'About SDA Collections' : 'Frequently Asked Questions'}
            </h1>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <h3 className="font-bold text-[#120D0B] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#65102F]" /> Jewellery & Handloom Heritage
                </h3>
                <p>
                  SDA Collections curates South Indian temple 22K jewellery, Silk Mark Kanchipuram pattu weaves, and bespoke designer couture.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <h3 className="font-bold text-[#120D0B] flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#65102F]" /> How does Shipment Tracking work?
                </h3>
                <p>
                  Once our dispatch desk updates your courier name, AWB tracking number, and status milestones, you can follow every step under Track Shipment or My Orders.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <h3 className="font-bold text-[#120D0B] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#65102F]" /> How do Returns & Refunds work?
                </h3>
                <p>
                  Delivered eligible items may be requested for return within the configured store window ({returnPolicy.returnWindowDays} days). Approved returns undergo inspection and simulated refund recording.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {renderMainContent()}
      {activeOrderForInvoice && (
        <InvoiceView order={activeOrderForInvoice} onClose={() => setActiveOrderForInvoice(null)} />
      )}
      {returnTargetOrder && firebaseUser && (
        <ReturnRequestModal
          order={returnTargetOrder}
          policy={returnPolicy}
          existingReturns={customerReturns}
          actorUid={firebaseUser.uid}
          actorEmail={firebaseUser.email || ''}
          onClose={() => setReturnTargetOrder(null)}
          onSuccess={(created) => {
            setReturnTargetOrder(null);
            setAccountFeedback(
              `Return request ${created.returnNumber} submitted for Order ${created.orderNumber}.`
            );
            setAccountSubTab('returns');
            void loadCustomerPortalData();
          }}
        />
      )}
    </>
  );
};
