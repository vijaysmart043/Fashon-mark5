import React from 'react';
import { Product, MetalRate } from '../data/mockData';
import { X, ShieldCheck, Scale, Calculator, Coins } from 'lucide-react';

interface JewelleryCalculatorModalProps {
  product: Product;
  metalRates: MetalRate[];
  onClose: () => void;
  onAddToCart: (product: Product) => void;
}

export const JewelleryCalculatorModal: React.FC<JewelleryCalculatorModalProps> = ({
  product,
  metalRates,
  onClose,
  onAddToCart
}) => {
  if (!product.jewellerySpec) return null;
  const spec = product.jewellerySpec;

  // Find applicable rate
  const matchingRate = metalRates.find(r => r.metal.toLowerCase() === spec.metalType.toLowerCase() && r.purity.includes(spec.purity.split(' ')[0])) || metalRates[0];
  const ratePerGram = matchingRate.ratePerGram;

  // Calculation formula
  const metalValue = Math.round(ratePerGram * spec.netWeight);
  const makingCharges = spec.makingCharges;
  const additionalCharges = spec.additionalCharges;
  const calculatedTotal = metalValue + makingCharges + additionalCharges;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#D4AF62]/30 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-[#120D0B] text-[#F8F1E4] p-6 flex items-center justify-between border-b border-[#D4AF62]/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#D4AF62]/20 text-[#D4AF62]">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-cinzel text-lg font-bold">Jewellery Price Breakdown</h3>
              <p className="text-xs text-[#D4AF62]">BIS Hallmarked Transparent Calculation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#F8F1E4]/70 hover:text-[#D4AF62]">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div>
            <h4 className="font-cinzel font-bold text-base text-[#120D0B]">{product.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{spec.metalType} — {spec.purity} Purity | Design: {spec.design}</p>
          </div>

          <div className="bg-[#F8F1E4]/50 rounded-xl p-4 space-y-3 border border-[#D4AF62]/20">
            <div className="flex items-center justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
              <span className="font-medium">Gross Weight</span>
              <span className="font-mono font-bold">{spec.grossWeight}g</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
              <span className="font-medium">Stone & Bead Weight</span>
              <span className="font-mono font-bold text-rose-700">-{spec.stoneWeight}g</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-800 font-semibold border-b border-gray-200 pb-2">
              <span>Net Billable Metal Weight</span>
              <span className="font-mono text-amber-800">{spec.netWeight}g</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
              <span>Applicable Metal Rate ({matchingRate.purity})</span>
              <span className="font-mono">₹{ratePerGram.toLocaleString('en-IN')} / g</span>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center text-gray-700">
              <span>Metal Value ({spec.netWeight}g × ₹{ratePerGram})</span>
              <span className="font-mono font-semibold">₹{metalValue.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-gray-700">
              <span>Making Charges ({spec.makingChargeType === 'fixed' ? 'Fixed Craftsmanship' : 'Per Gram'})</span>
              <span className="font-mono font-semibold">₹{makingCharges.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-gray-700">
              <span>Additional Stones & Polishing</span>
              <span className="font-mono font-semibold">₹{additionalCharges.toLocaleString('en-IN')}</span>
            </div>

            <div className="pt-4 border-t-2 border-dashed border-gray-200 flex justify-between items-center text-base font-bold text-[#120D0B]">
              <span className="font-cinzel">Calculated Total Price</span>
              <span className="font-mono text-xl text-[#65102F]">₹{calculatedTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800">
              100% BIS Hallmarked purity guaranteed. Includes lifetime exchange and buy-back assurance at prevailing market metal rates.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onAddToCart(product);
              onClose();
            }}
            className="px-6 py-2.5 bg-[#120D0B] text-[#F8F1E4] text-xs font-semibold rounded-lg hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors shadow"
          >
            Add to Cart (₹{calculatedTotal.toLocaleString('en-IN')})
          </button>
        </div>

      </div>
    </div>
  );
};
