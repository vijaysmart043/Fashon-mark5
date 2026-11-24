import React, { useState, useRef } from 'react';
import { CATEGORIES } from '../data/mockData';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { CategoryDoc } from '../services/storeConfigService';

interface CategorySectionProps {
  onSelectCategory: (categoryName: string) => void;
  categories?: CategoryDoc[];
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  onSelectCategory,
  categories,
}) => {
  const [filterTab, setFilterTab] = useState('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const offset = direction === 'left' ? -clientWidth / 2 : clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollLeft + offset, behavior: 'smooth' });
    }
  };

  const baseCategories: CategoryDoc[] =
    categories && categories.length > 0
      ? categories.filter((c) => c.active !== false)
      : CATEGORIES.map((c) => ({ ...c, active: true }));

  const filteredCategories = baseCategories.filter((c) => {
    const n = c.name.toLowerCase();
    if (filterTab === 'JEWELLERY') return n.includes('jewellery') || n.includes('gold') || n.includes('silver');
    if (filterTab === 'SAREES') return n.includes('saree');
    if (filterTab === 'DRESSES') return n.includes('dress') || n.includes('lehenga') || n.includes('kurti');
    return true;
  });

  return (
    <section className="py-16 bg-[#120D0B] text-[#F8F1E4] border-b border-[#D4AF62]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header & Filter Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-6">
          <div>
            <h2 className="font-cinzel text-3xl sm:text-4xl font-bold tracking-tight text-[#F8F1E4]">
              Shop by Category
            </h2>
            <p className="text-xs sm:text-sm text-[#F8F1E4]/70 mt-2 font-poppins">
              Curated ateliers across fine jewellery, handloom weaves, and couture silhouettes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#211713] p-1.5 rounded-full border border-[#D4AF62]/30">
              {[`ALL (${baseCategories.length})`, 'JEWELLERY', 'SAREES', 'DRESSES'].map((tab) => {
                const pureTab = tab.split(' ')[0];
                return (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(pureTab)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      filterTab === pureTab
                        ? 'bg-[#D4AF62] text-[#120D0B] shadow'
                        : 'text-[#F8F1E4]/80 hover:text-[#D4AF62]'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => scroll('left')}
                className="w-10 h-10 rounded-full border border-[#D4AF62]/40 bg-[#211713] flex items-center justify-center text-[#D4AF62] hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scroll('right')}
                className="w-10 h-10 rounded-full border border-[#D4AF62]/40 bg-[#211713] flex items-center justify-center text-[#D4AF62] hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Sliding Row with Clover / Quatrefoil Golden Border */}
        <div
          ref={scrollRef}
          className="flex items-center gap-8 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-[#D4AF62] scrollbar-track-[#211713] scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
        >
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => onSelectCategory(cat.name)}
              className="group shrink-0 w-64 sm:w-72 cursor-pointer flex flex-col items-center text-center space-y-4"
            >
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-[40%] border-2 border-[#D4AF62] p-2 bg-[#211713] shadow-xl overflow-hidden group-hover:scale-105 transition-all duration-500">
                <img
                  src={cat.image}
                  alt={cat.name}
                  loading="lazy"
                  className="w-full h-full object-cover object-center rounded-[38%] opacity-85 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#120D0B]/80 via-transparent to-transparent"></div>

                <div className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-[#120D0B] border border-[#D4AF62] flex items-center justify-center text-[#D4AF62] group-hover:bg-[#D4AF62] group-hover:text-[#120D0B] transition-all">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>

              <div>
                <h3 className="font-cinzel text-lg font-bold text-[#F8F1E4] group-hover:text-[#D4AF62] transition-colors">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-[#D4AF62]/80 uppercase tracking-widest mt-0.5">
                  {cat.itemCount ? `${cat.itemCount} Designs` : 'Curated Collection'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full h-1 bg-[#211713] rounded-full mt-4 overflow-hidden">
          <div className="w-1/3 h-full bg-[#D4AF62] rounded-full"></div>
        </div>
      </div>
    </section>
  );
};
