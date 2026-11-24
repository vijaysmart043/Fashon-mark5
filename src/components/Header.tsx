import React, { useState } from 'react';
import { Search, Heart, ShoppingBag, User, Menu, X, Crown, Bell, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationRecord, StoreConfigRecord } from '../types/shippingReturns';
import { DEFAULT_STORE_CONFIG } from '../services/storeConfigService';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cartCount: number;
  wishlistCount: number;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  language: 'en' | 'te';
  setLanguage: (lang: 'en' | 'te') => void;
  onOpenAuth: () => void;
  storeConfig?: StoreConfigRecord;
  notifications?: NotificationRecord[];
  onMarkNotificationRead?: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  wishlistCount,
  onOpenCart,
  onOpenWishlist,
  searchQuery,
  setSearchQuery,
  language,
  setLanguage,
  onOpenAuth,
  storeConfig = DEFAULT_STORE_CONFIG,
  notifications = [],
  onMarkNotificationRead,
}) => {
  const { firebaseUser, userProfile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'new-arrivals', label: 'New Arrivals' },
    { id: 'jewellery', label: 'Jewellery' },
    { id: 'sarees', label: 'Sarees' },
    { id: 'dresses', label: 'Dresses' },
    { id: 'collections', label: 'Collections' },
    { id: 'bestsellers', label: 'Best Sellers' },
    { id: 'offers', label: 'Offers' },
    { id: 'track', label: 'Track Shipment' },
    { id: 'contact', label: 'Contact' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#120D0B] text-[#F8F1E4] border-b border-[#D4AF62]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              {storeConfig.logoUrl ? (
                <img
                  src={storeConfig.logoUrl}
                  alt={storeConfig.storeName}
                  className="w-10 h-10 rounded-full object-cover border border-[#D4AF62] shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#211713] border border-[#D4AF62] flex items-center justify-center text-[#D4AF62] shadow-md">
                  <Crown className="w-5 h-5 fill-current" />
                </div>
              )}
              <div>
                <h1 className="font-cinzel text-xl sm:text-2xl font-bold tracking-wider gold-gradient-text uppercase">
                  {storeConfig.storeName || 'SDA COLLECTIONS'}
                </h1>
                <p className="text-[9px] tracking-[0.2em] text-[#D4AF62] uppercase font-poppins">
                  {storeConfig.tagline || 'Shop Smart... Be Stylish...'}
                </p>
              </div>
            </button>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#D4AF62] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Kanchi sarees, 22K gold, lehengas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setActiveTab('shop');
                }}
                className="w-full pl-10 pr-16 py-2 rounded-full bg-[#1A120E] border border-[#D4AF62]/40 text-xs text-[#F8F1E4] placeholder-[#F8F1E4]/50 focus:outline-none focus:border-[#D4AF62] shadow-inner"
              />
              <button
                onClick={() => setActiveTab('shop')}
                className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#D4AF62] text-[#120D0B] text-[11px] font-bold rounded-full hover:bg-[#f3e5ab] transition-colors"
              >
                Go
              </button>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#211713] border border-[#D4AF62]/40 text-xs font-medium text-[#D4AF62] hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors"
            >
              <span>{language === 'en' ? 'EN / తెలుగు' : 'తెలుగు / EN'}</span>
            </button>

            {/* In-App Notifications */}
            {firebaseUser && (
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((o) => !o)}
                  className="p-1.5 text-[#F8F1E4]/90 hover:text-[#D4AF62] transition-colors relative"
                  title="Notifications"
                  aria-label="Customer notifications"
                >
                  <Bell className="w-4 h-4 text-[#D4AF62]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#D41472] text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-3 w-80 bg-white text-[#120D0B] rounded-xl shadow-2xl border border-[#D4AF62]/40 overflow-hidden z-50">
                    <div className="bg-[#120D0B] text-[#F8F1E4] px-4 py-3 flex items-center justify-between text-xs border-b border-[#D4AF62]/20">
                      <span className="font-cinzel font-bold">In-App Notifications ({unreadCount} unread)</span>
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="text-gray-400 hover:text-white"
                        aria-label="Close notifications"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-gray-500 text-center">No notifications yet.</p>
                      ) : (
                        notifications.slice(0, 12).map((n) => (
                          <div
                            key={n.id}
                            className={`p-3 text-xs space-y-1 ${n.read ? 'bg-white' : 'bg-amber-50/60'}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-[#120D0B]">{n.title}</p>
                              {!n.read && onMarkNotificationRead && (
                                <button
                                  onClick={() => onMarkNotificationRead(n.id)}
                                  className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5 shrink-0 hover:underline"
                                >
                                  <Check className="w-3 h-3" /> Read
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-600">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-2 bg-gray-50 border-t border-gray-100 text-center">
                      <button
                        onClick={() => {
                          setNotifOpen(false);
                          setActiveTab('account');
                        }}
                        className="text-[11px] font-semibold text-[#65102F] hover:underline"
                      >
                        Open Account Portal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Account */}
            <button
              onClick={() => {
                if (firebaseUser) {
                  setActiveTab('account');
                } else {
                  onOpenAuth();
                }
              }}
              className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-[#F8F1E4]/90 hover:text-[#D4AF62] transition-colors"
            >
              <User className="w-4 h-4 text-[#D4AF62]" />
              <span>{firebaseUser ? userProfile?.fullName || 'Account' : 'Sign In'}</span>
            </button>

            {/* Wishlist */}
            <button
              onClick={onOpenWishlist}
              className="flex items-center gap-1.5 text-xs font-medium text-[#F8F1E4]/90 hover:text-[#D4AF62] transition-colors relative p-1"
              title="Wishlist"
            >
              <Heart className="w-4 h-4 text-[#D4AF62]" />
              <span className="hidden sm:inline">Wishlist</span>
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#D41472] text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Bag */}
            <button
              onClick={onOpenCart}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#D4AF62] text-[#120D0B] text-xs font-bold hover:bg-[#f3e5ab] transition-colors shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Bag</span>
              <span className="bg-[#120D0B] text-[#D4AF62] px-1.5 py-0.2 rounded-full text-[10px]">
                {cartCount}
              </span>
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[#F8F1E4] hover:text-[#D4AF62]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Secondary Nav Bar */}
        <div className="hidden lg:flex items-center justify-center gap-7 py-3 border-t border-[#D4AF62]/10 text-xs font-medium tracking-wide">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id === 'new-arrivals' || link.id === 'bestsellers' ? 'shop' : link.id)}
              className={`transition-colors whitespace-nowrap hover:text-[#D4AF62] ${
                activeTab === link.id ? 'text-[#D4AF62] font-semibold border-b border-[#D4AF62] pb-0.5' : 'text-[#F8F1E4]/80'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#120D0B] border-t border-[#D4AF62]/20 px-6 py-6 space-y-3">
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-[#D4AF62] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sarees, jewellery..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full bg-[#1A120E] border border-[#D4AF62]/40 text-xs text-[#F8F1E4]"
            />
          </div>
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => {
                setActiveTab(link.id === 'new-arrivals' || link.id === 'bestsellers' ? 'shop' : link.id);
                setMobileMenuOpen(false);
              }}
              className="block text-left py-2 text-sm text-[#F8F1E4] hover:text-[#D4AF62] border-b border-white/5 w-full"
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => {
              if (firebaseUser) {
                setActiveTab('account');
              } else {
                onOpenAuth();
              }
              setMobileMenuOpen(false);
            }}
            className="block text-left py-2 text-sm text-[#D4AF62]"
          >
            {firebaseUser ? 'My Account & Orders' : 'Sign In / Register'}
          </button>
        </div>
      )}
    </header>
  );
};
