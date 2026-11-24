import React from 'react';
import { ShieldCheck, Truck, RotateCcw, Headphones } from 'lucide-react';

export const ServiceBenefits: React.FC = () => {
  const benefits = [
    {
      icon: ShieldCheck,
      title: '100% Certified Purity',
      description: 'BIS hallmarked gold & Silver certified with Silk Mark guarantee.'
    },
    {
      icon: Truck,
      title: 'Insured Express Shipping',
      description: 'Safe, fully insured door delivery across India with live tracking.'
    },
    {
      icon: RotateCcw,
      title: '7-Day Easy Returns',
      description: 'Hassle-free return and exchange policy on eligible saree & jewellery orders.'
    },
    {
      icon: Headphones,
      title: '24/7 Royal Concierge',
      description: 'Dedicated fashion and jewellery experts to assist your curation.'
    }
  ];

  return (
    <section className="bg-[#F8F1E4] py-16 border-t border-b border-[#D4AF62]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div key={idx} className="flex items-start gap-4 p-6 bg-white rounded-2xl shadow-sm border border-[#211713]/5">
                <div className="p-3 rounded-xl bg-[#120D0B] text-[#D4AF62] shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-cinzel font-bold text-base text-[#120D0B]">{b.title}</h4>
                  <p className="text-xs text-gray-600 mt-1 font-poppins">{b.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
