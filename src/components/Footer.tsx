import React, { useState } from 'react';
import { Sparkles, Phone, Mail, MapPin, ArrowRight } from 'lucide-react';

interface FooterProps {
  setActiveTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveTab }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-[#120D0B] text-[#F8F1E4] pt-20 pb-12 border-t border-[#D4AF62]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Newsletter Banner inside Footer */}
        <div className="bg-[#211713] rounded-2xl p-8 sm:p-12 border border-[#D4AF62]/30 mb-16 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center lg:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF62]/20 text-[#D4AF62] text-xs font-semibold tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SDA ROYAL CLUB</span>
            </div>
            <h3 className="font-cinzel text-2xl sm:text-3xl font-bold text-[#F8F1E4]">
              Subscribe for Exclusive Festive Drops & Gold Rate Alerts
            </h3>
            <p className="text-xs sm:text-sm text-[#F8F1E4]/80 font-poppins">
              Join 50,000+ fashion connoisseurs. Get instant updates on pure Kanchipuram arrivals and temple gold jewellery.
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Enter your email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="px-4 py-3.5 rounded-xl bg-[#120D0B] border border-[#D4AF62]/50 text-white text-xs sm:text-sm focus:outline-none focus:border-[#D4AF62] min-w-[280px]"
            />
            <button
              type="submit"
              className="px-6 py-3.5 bg-gradient-to-r from-[#D4AF62] to-[#AA8230] text-[#120D0B] font-bold rounded-xl text-xs sm:text-sm shadow-lg hover:from-[#f3e5ab] hover:to-[#d4af62] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>Subscribe</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          {subscribed && (
            <p className="text-xs text-[#D4AF62] font-medium lg:hidden">Thank you for subscribing to SDA Collections!</p>
          )}
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-16 border-b border-[#D4AF62]/20">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-cinzel text-2xl font-bold gold-gradient-text tracking-wider">
              SDA COLLECTIONS
            </h2>
            <p className="text-xs tracking-[0.2em] text-[#D4AF62] uppercase font-poppins">
              Shop Smart... Be Stylish...
            </p>
            <p className="text-xs text-[#F8F1E4]/80 leading-relaxed font-poppins pr-4">
              Your premier destination for authentic Indian luxury jewellery, pure Kanchipuram and Banarasi handloom sarees, and designer occasion wear. Crafted for eternity.
            </p>
            <div className="space-y-2 pt-2 text-xs text-[#F8F1E4]/80">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D4AF62] shrink-0" />
                <span>Banjara Hills Road No. 12, Hyderabad, Telangana 500034</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D4AF62] shrink-0" />
                <span>+91 98480 12345 / +91 40 2334 5678</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#D4AF62] shrink-0" />
                <span>support@sdacollections.com</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-cinzel font-bold text-sm text-[#D4AF62] uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2.5 text-xs text-[#F8F1E4]/80 font-poppins">
              <li><button onClick={() => setActiveTab('home')} className="hover:text-[#D4AF62] transition-colors">Home</button></li>
              <li><button onClick={() => setActiveTab('shop')} className="hover:text-[#D4AF62] transition-colors">Shop Catalogue</button></li>
              <li><button onClick={() => setActiveTab('jewellery')} className="hover:text-[#D4AF62] transition-colors">Gold & Silver Jewellery</button></li>
              <li><button onClick={() => setActiveTab('sarees')} className="hover:text-[#D4AF62] transition-colors">Pure Silk Sarees</button></li>
              <li><button onClick={() => setActiveTab('dresses')} className="hover:text-[#D4AF62] transition-colors">Designer Dresses</button></li>
              <li><button onClick={() => setActiveTab('collections')} className="hover:text-[#D4AF62] transition-colors">Wedding & Festive Edit</button></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="space-y-4">
            <h4 className="font-cinzel font-bold text-sm text-[#D4AF62] uppercase tracking-wider">Customer Care</h4>
            <ul className="space-y-2.5 text-xs text-[#F8F1E4]/80 font-poppins">
              <li><button onClick={() => setActiveTab('account')} className="hover:text-[#D4AF62] transition-colors">My Account & Orders</button></li>
              <li><button onClick={() => setActiveTab('track')} className="hover:text-[#D4AF62] transition-colors">Track Shipment</button></li>
              <li><button onClick={() => setActiveTab('faq')} className="hover:text-[#D4AF62] transition-colors">FAQ & Gold Purity Guide</button></li>
              <li><button onClick={() => setActiveTab('policies')} className="hover:text-[#D4AF62] transition-colors">Returns & Exchange Policy</button></li>
              <li><button onClick={() => setActiveTab('contact')} className="hover:text-[#D4AF62] transition-colors">Contact Concierge</button></li>
              <li><button onClick={() => setActiveTab('about')} className="hover:text-[#D4AF62] transition-colors">About SDA Boutique</button></li>
            </ul>
          </div>

          {/* Secure Payment & Trust */}
          <div className="space-y-4">
            <h4 className="font-cinzel font-bold text-sm text-[#D4AF62] uppercase tracking-wider">Secure Shopping</h4>
            <p className="text-xs text-[#F8F1E4]/80">
              We support simulated UPI, Cards, Net Banking, Wallets, and Cash on Delivery (COD) across India.
            </p>
            <div className="p-3 rounded-xl bg-[#211713] border border-[#D4AF62]/20 space-y-1">
              <p className="text-[11px] font-bold text-[#D4AF62]">BIS Hallmarked 916 Gold</p>
              <p className="text-[10px] text-white/70">100% Certified Authentic Handloom & Precious Metal Assurance.</p>
            </div>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#F8F1E4]/60 gap-4">
          <p>© 2026 SDA COLLECTIONS. All Rights Reserved. FASHION · BEAUTY · STYLE.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => setActiveTab('policies')} className="hover:text-[#D4AF62]">Privacy Policy</button>
            <button onClick={() => setActiveTab('policies')} className="hover:text-[#D4AF62]">Terms of Service</button>
            <button onClick={() => setActiveTab('policies')} className="hover:text-[#D4AF62]">Shipping Policy</button>
          </div>
        </div>

      </div>
    </footer>
  );
};
