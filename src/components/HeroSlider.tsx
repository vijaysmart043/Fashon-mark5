import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Gem } from 'lucide-react';
import { HeroBannerRecord } from '../types/shippingReturns';
import { DEFAULT_HERO_BANNERS } from '../services/storeConfigService';

interface HeroSliderProps {
  onShopClick: (tab: string) => void;
  banners?: HeroBannerRecord[];
}

export const HeroSlider: React.FC<HeroSliderProps> = ({
  onShopClick,
  banners = DEFAULT_HERO_BANNERS,
}) => {
  const activeSlides = banners.filter((b) => b.active !== false);
  const slides = activeSlides.length > 0 ? activeSlides : DEFAULT_HERO_BANNERS;
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    setCurrentSlide(0);
  }, [slides.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[currentSlide % slides.length] || slides[0];

  return (
    <div className="relative overflow-hidden bg-[#120D0B] text-white min-h-[620px] flex items-center border-b border-[#D4AF62]/20">
      {/* Background Decorative Geometric Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#D4AF62_1px,transparent_1px)] [background-size:24px_24px]"></div>
      <div className="absolute inset-0 border-[16px] border-[#D4AF62]/5 pointer-events-none m-4 rounded-3xl"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.25em] text-[#D4AF62] uppercase">
              <span className="w-8 h-[1px] bg-[#D4AF62]"></span>
              <span>{slide.badge || 'SIGNATURE BRIDAL & HERITAGE COUTURE'}</span>
            </div>

            <h2 className="font-cinzel text-4xl sm:text-6xl font-extrabold tracking-tight text-[#F8F1E4] leading-[1.1]">
              {slide.title}
            </h2>

            <p className="font-poppins text-sm sm:text-base text-[#F8F1E4]/90 max-w-xl font-light leading-relaxed">
              {slide.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs italic text-[#D4AF62] pt-1">
              <span>“Shop Smart... Be Stylish...”</span>
              <span className="text-[#D4AF62]/55">·</span>
              <span>“Your Style... Our Priority...”</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button
                onClick={() => onShopClick(slide.targetTab || 'shop')}
                className="px-8 py-3.5 bg-gradient-to-r from-[#D4AF62] to-[#AA8230] text-[#120D0B] font-bold rounded-lg shadow-lg hover:from-[#f3e5ab] hover:to-[#d4af62] transition-all transform hover:-translate-y-0.5 flex items-center gap-2 text-xs tracking-wider uppercase"
              >
                <span>{slide.ctaPrimary || 'Shop Now'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onShopClick('collections')}
                className="px-8 py-3.5 bg-transparent border border-[#D4AF62] text-[#F8F1E4] font-semibold rounded-lg hover:bg-[#D4AF62]/10 transition-all text-xs tracking-wider uppercase"
              >
                {slide.ctaSecondary || 'Explore Collections'}
              </button>
            </div>

            {/* Bottom Feature Cards */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-[#D4AF62]/20 max-w-lg">
              <div className="flex items-center gap-3 bg-[#211713]/80 p-3 rounded-xl border border-[#D4AF62]/30">
                <div className="p-2 rounded-lg bg-[#D4AF62]/20 text-[#D4AF62]">
                  <Gem className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-cinzel text-xs font-bold text-[#F8F1E4]">100% Pure Silk & Gold</h4>
                  <p className="text-[10px] text-[#F8F1E4]/70">Authentic handloom & 916</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#211713]/80 p-3 rounded-xl border border-[#D4AF62]/30">
                <div className="p-2 rounded-lg bg-[#D4AF62]/20 text-[#D4AF62]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-cinzel text-xs font-bold text-[#F8F1E4]">Pure Zari & Nakshi</h4>
                  <p className="text-[10px] text-[#F8F1E4]/70">Crafted with precision</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Arch Window Image Column */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-md h-[460px] rounded-t-[200px] border-2 border-[#D4AF62] overflow-hidden bg-[#211713] shadow-2xl p-2">
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover object-center rounded-t-[190px]"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#120D0B] via-transparent to-black/20"></div>

              <div className="absolute top-8 left-8 w-20 h-20 rounded-full bg-[#120D0B]/90 border border-[#D4AF62] flex flex-col items-center justify-center text-center p-2 shadow-xl">
                <span className="font-cinzel text-[10px] font-bold text-[#D4AF62]">Royal</span>
                <span className="font-cinzel text-[9px] text-[#F8F1E4]">Couture</span>
              </div>

              <div className="absolute bottom-6 right-6 bg-[#120D0B]/95 border border-[#D4AF62] rounded-xl p-2 shadow-2xl flex items-center gap-3 w-48">
                <img
                  src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=200&q=80"
                  alt="Thumbnail"
                  className="w-12 h-12 object-cover rounded-lg border border-[#D4AF62]/50"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="font-cinzel text-[11px] font-bold text-[#F8F1E4]">Elegance & Tradition</p>
                  <p className="text-[9px] text-[#D4AF62]">Pure Kanchipuram</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slider Controls & Indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-[#120D0B]/80 px-4 py-2 rounded-full border border-[#D4AF62]/40 backdrop-blur">
        <button
          onClick={() => setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
          className="text-[#D4AF62] hover:text-white transition-colors"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                currentSlide === idx ? 'w-8 bg-[#D4AF62]' : 'w-2 bg-[#D4AF62]/40'
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
          className="text-[#D4AF62] hover:text-white transition-colors"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
