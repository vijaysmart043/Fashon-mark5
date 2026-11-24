/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect, useState } from 'react';
import { PRODUCTS, INITIAL_METAL_RATES, Product, MetalRate } from './data/mockData';
import { AnnouncementBar } from './components/AnnouncementBar';
import { Header } from './components/Header';
import { HeroSlider } from './components/HeroSlider';
import { CategorySection } from './components/CategorySection';
import { ProductGridSection } from './components/ProductGridSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { ServiceBenefits } from './components/ServiceBenefits';
import { Footer } from './components/Footer';
import { ProductDetailModal } from './components/ProductDetailModal';
import { JewelleryCalculatorModal } from './components/JewelleryCalculatorModal';
import { CartDrawer } from './components/CartDrawer';
import { WishlistModal } from './components/WishlistModal';
import { Pages } from './components/Pages';
import { AuthModal } from './components/AuthModal';
import { useCartAndWishlist } from './hooks/useCartAndWishlist';

const AdminDashboard = React.lazy(() =>
  import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
import { useAuth } from './context/AuthContext';
import {
  CategoryDoc,
  DEFAULT_COUPONS,
  DEFAULT_HERO_BANNERS,
  DEFAULT_STORE_CONFIG,
  fetchCategories,
  fetchCoupons,
  fetchCustomerNotifications,
  fetchHeroBanners,
  fetchMetalRates,
  fetchProductsAndVariants,
  fetchStoreConfig,
  markNotificationRead,
} from './services/storeConfigService';
import { CouponRecord, HeroBannerRecord, NotificationRecord, StoreConfigRecord } from './types/shippingReturns';
import { ShieldAlert, Wrench } from 'lucide-react';

export default function App() {
  const { firebaseUser, isStaff } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [language, setLanguage] = useState<'en' | 'te'>('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const {
    cartItems,
    wishlistIds,
    addToCart,
    updateQuantity,
    removeFromCart,
    toggleWishlist,
    addRecentlyViewed,
    clearCart,
  } = useCartAndWishlist();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [calcProduct, setCalcProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const [storeConfig, setStoreConfig] = useState<StoreConfigRecord>(DEFAULT_STORE_CONFIG);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [metalRates, setMetalRates] = useState<MetalRate[]>(INITIAL_METAL_RATES);
  const [heroBanners, setHeroBanners] = useState<HeroBannerRecord[]>(DEFAULT_HERO_BANNERS);
  const [coupons, setCoupons] = useState<CouponRecord[]>(DEFAULT_COUPONS);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  const loadLiveStorefront = async () => {
    try {
      const [cfg, cats, prodBundle, rates, banners, coups] = await Promise.all([
        fetchStoreConfig(),
        fetchCategories(),
        fetchProductsAndVariants(),
        fetchMetalRates(),
        fetchHeroBanners(),
        fetchCoupons(),
      ]);
      setStoreConfig(cfg);
      setCategories(cats);
      setProducts(prodBundle.products.filter((p) => p.active !== false));
      setMetalRates(rates);
      setHeroBanners(banners);
      setCoupons(coups);
    } catch (err) {
      console.warn('Using fallback storefront catalogue defaults:', err);
    }
  };

  const loadNotifications = async () => {
    if (!firebaseUser) {
      setNotifications([]);
      return;
    }
    const list = await fetchCustomerNotifications(firebaseUser.uid);
    setNotifications(list);
  };

  useEffect(() => {
    void loadLiveStorefront();
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [firebaseUser]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, isAdminOpen]);

  const wishlistProducts = products.filter((p) => wishlistIds.includes(p.id));

  if (isAdminOpen) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#120D0B] text-[#D4AF62] flex items-center justify-center font-cinzel text-sm">
            Loading SDA Operations Portal...
          </div>
        }
      >
        <AdminDashboard
          onClose={() => {
            setIsAdminOpen(false);
            void loadLiveStorefront();
            void loadNotifications();
          }}
        />
      </Suspense>
    );
  }

  // Maintenance mode gate for non-staff visitors
  if (storeConfig.maintenanceMode && !isStaff) {
    return (
      <div className="min-h-screen bg-[#120D0B] text-[#F8F1E4] flex items-center justify-center p-6 font-poppins">
        <div className="max-w-md w-full bg-[#211713] border border-[#D4AF62]/40 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#D4AF62]/20 text-[#D4AF62] flex items-center justify-center border border-[#D4AF62]/40">
            <Wrench className="w-7 h-7" />
          </div>
          <h1 className="font-cinzel text-2xl font-bold text-[#D4AF62]">{storeConfig.storeName}</h1>
          <p className="text-xs text-[#F8F1E4]/80 leading-relaxed">
            {storeConfig.maintenanceMessage || DEFAULT_STORE_CONFIG.maintenanceMessage}
          </p>
          <button
            onClick={() => setIsAuthOpen(true)}
            className="px-6 py-2.5 bg-[#D4AF62] text-[#120D0B] rounded-xl text-xs font-bold hover:bg-[#f3e5ab]"
          >
            Staff Sign In
          </button>
        </div>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F1E4] text-[#120D0B] font-poppins selection:bg-[#D4AF62] selection:text-[#120D0B]">
      {/* Maintenance Notice Banner for Staff Preview */}
      {storeConfig.maintenanceMode && isStaff && (
        <div className="bg-[#65102F] text-[#F8F1E4] text-xs py-2 px-4 text-center flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#D4AF62]" />
          <span>Storefront is currently in Maintenance Mode for customers (visible to verified staff).</span>
          <button onClick={() => setIsAdminOpen(true)} className="underline text-[#D4AF62] font-semibold">
            Manage Settings
          </button>
        </div>
      )}

      {/* Announcement Bar */}
      <AnnouncementBar language={language} setLanguage={setLanguage} storeConfig={storeConfig} />

      {/* Luxury Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cartItems.reduce((a, b) => a + b.quantity, 0)}
        wishlistCount={wishlistIds.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={(q) => {
          setSearchQuery(q);
          if (q) setActiveTab('shop');
        }}
        language={language}
        setLanguage={setLanguage}
        onOpenAuth={() => setIsAuthOpen(true)}
        storeConfig={storeConfig}
        notifications={notifications}
        onMarkNotificationRead={async (id) => {
          await markNotificationRead(id);
          await loadNotifications();
        }}
      />

      {/* Main Content Router */}
      {activeTab === 'home' ? (
        <main>
          <HeroSlider onShopClick={setActiveTab} banners={heroBanners} />
          <CategorySection
            categories={categories}
            onSelectCategory={(catName) => {
              setSelectedCategory(catName || 'All');
              setActiveTab('shop');
            }}
          />

          <ProductGridSection
            title="Exquisite Gold & Temple Jewellery"
            subtitle="BIS Hallmarked 22K Purity"
            products={products.filter((p) => p.type === 'jewellery')}
            onAddToCart={addToCart}
            onToggleWishlist={toggleWishlist}
            wishlistIds={wishlistIds}
            onQuickView={(p) => {
              setSelectedProduct(p);
              addRecentlyViewed(p.id);
            }}
            onOpenJewelleryCalc={(p) => setCalcProduct(p)}
          />

          <ProductGridSection
            title="Royal Kanchipuram & Banarasi Sarees"
            subtitle="Handwoven Pure Silk & Gold Zari"
            products={products.filter((p) => p.type === 'saree')}
            onAddToCart={addToCart}
            onToggleWishlist={toggleWishlist}
            wishlistIds={wishlistIds}
            onQuickView={(p) => {
              setSelectedProduct(p);
              addRecentlyViewed(p.id);
            }}
            onOpenJewelleryCalc={(p) => setCalcProduct(p)}
          />

          <ServiceBenefits />
          <TestimonialsSection />
        </main>
      ) : (
        <Pages
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          products={products}
          categories={categories}
          metalRates={metalRates}
          coupons={coupons}
          storeConfig={storeConfig}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          initialCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          notifications={notifications}
          onMarkNotificationRead={async (id) => {
            await markNotificationRead(id);
            await loadNotifications();
          }}
          onAddToCart={addToCart}
          onToggleWishlist={toggleWishlist}
          wishlistIds={wishlistIds}
          onQuickView={(p) => {
            setSelectedProduct(p);
            addRecentlyViewed(p.id);
          }}
          onOpenJewelleryCalc={(p) => setCalcProduct(p)}
          cartItems={cartItems}
          onClearCart={clearCart}
          onOrderPlaced={() => {
            void loadLiveStorefront();
            void loadNotifications();
          }}
          onProceedToCheckout={() => {
            setIsCartOpen(false);
            setActiveTab('checkout');
          }}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenAdmin={() => setIsAdminOpen(true)}
        />
      )}

      {/* Footer */}
      <Footer setActiveTab={setActiveTab} />

      {/* Modals & Drawers */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
          onToggleWishlist={toggleWishlist}
          isWishlisted={wishlistIds.includes(selectedProduct.id)}
        />
      )}

      {calcProduct && (
        <JewelleryCalculatorModal
          product={calcProduct}
          metalRates={metalRates}
          onClose={() => setCalcProduct(null)}
          onAddToCart={addToCart}
        />
      )}

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        storeConfig={storeConfig}
        coupons={coupons}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setActiveTab('checkout');
        }}
      />

      <WishlistModal
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        wishlistProducts={wishlistProducts}
        onRemoveFromWishlist={toggleWishlist}
        onAddToCart={addToCart}
      />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
