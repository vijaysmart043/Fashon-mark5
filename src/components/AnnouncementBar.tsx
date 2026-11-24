import React from 'react';
import { Sparkles, Phone, MapPin, Globe } from 'lucide-react';
import { StoreConfigRecord } from '../types/shippingReturns';
import { DEFAULT_STORE_CONFIG } from '../services/storeConfigService';

interface AnnouncementBarProps {
  language: 'en' | 'te';
  setLanguage: (lang: 'en' | 'te') => void;
  storeConfig?: StoreConfigRecord;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  language,
  setLanguage,
  storeConfig = DEFAULT_STORE_CONFIG,
}) => {
  if (storeConfig.announcementActive === false) {
    return null;
  }

  return (
    <aside aria-label="Announcement" className="bg-[#120D0B] text-[#F8F1E4] text-xs py-2 px-4 border-b border-[#D4AF62]/20">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#D4AF62] animate-pulse" />
          <span className="font-medium">
            {language === 'en'
              ? storeConfig.announcementTextEn || DEFAULT_STORE_CONFIG.announcementTextEn
              : storeConfig.announcementTextTe || DEFAULT_STORE_CONFIG.announcementTextTe}
          </span>
        </div>

        <div className="flex items-center gap-4 text-[#D4AF62]">
          <div className="hidden md:flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            <span>{storeConfig.contactPhone || '+91 98480 12345'}</span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>Banjara Hills, Hyderabad</span>
          </div>
          <div className="flex items-center gap-1 bg-[#211713] px-2 py-0.5 rounded border border-[#D4AF62]/40">
            <Globe className="w-3 h-3 text-[#D4AF62]" />
            <button
              onClick={() => setLanguage('en')}
              className={`px-1.5 py-0.5 rounded transition-colors ${language === 'en' ? 'bg-[#D4AF62] text-[#120D0B] font-bold' : 'text-[#F8F1E4] hover:text-[#D4AF62]'}`}
            >
              EN
            </button>
            <span className="text-[#D4AF62]/50">|</span>
            <button
              onClick={() => setLanguage('te')}
              className={`px-1.5 py-0.5 rounded transition-colors ${language === 'te' ? 'bg-[#D4AF62] text-[#120D0B] font-bold' : 'text-[#F8F1E4] hover:text-[#D4AF62]'}`}
            >
              తెలుగు
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
