import React from 'react';
import { TESTIMONIALS } from '../data/mockData';
import { Star, Quote } from 'lucide-react';

export const TestimonialsSection: React.FC = () => {
  return (
    <section className="py-20 bg-[#120D0B] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#D4AF62_1px,transparent_1px)] [background-size:16px_16px]"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#D4AF62]">
            CUSTOMER LOVE
          </p>
          <h2 className="font-cinzel text-3xl sm:text-4xl font-bold tracking-tight text-[#F8F1E4]">
            Stories of Royal Delight
          </h2>
          <p className="text-xs text-[#F8F1E4]/70 italic">Shop Smart... Be Stylish...</p>
          <div className="w-16 h-0.5 bg-[#D4AF62] mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.id}
              className="bg-[#211713] border border-[#D4AF62]/20 rounded-2xl p-8 flex flex-col justify-between shadow-xl relative group hover:border-[#D4AF62]/60 transition-all"
            >
              <Quote className="absolute top-6 right-6 w-10 h-10 text-[#D4AF62]/10 group-hover:text-[#D4AF62]/25 transition-colors" />

              <div className="space-y-4">
                <div className="flex items-center gap-1 text-[#D4AF62]">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>

                <p className="font-poppins text-sm text-[#F8F1E4]/90 italic leading-relaxed">
                  "{t.comment}"
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-[#D4AF62]/10 flex items-center gap-4">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-12 h-12 rounded-full object-cover border border-[#D4AF62]"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="font-cinzel text-sm font-bold text-[#F8F1E4]">{t.name}</h4>
                  <p className="text-xs text-[#D4AF62]">{t.location} — <span className="text-white/60 text-[11px]">{t.productName}</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
