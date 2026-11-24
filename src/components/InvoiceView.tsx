import React from 'react';
import { X, Printer, ShieldCheck } from 'lucide-react';

interface InvoiceViewProps {
  order: {
    orderNumber: string;
    createdAt: string;
    items: Array<{ product: { name: string; basePrice: number; discount: number }, quantity: number, variantSku?: string }>;
    total: number;
    paymentMethod: string;
    paymentStatus: string;
    shippingAddress?: { fullName: string; addressLine: string; city: string; state: string; pincode: string; mobile: string };
  };
  onClose: () => void;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({ order, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-[#D4AF62]/40 relative">
        
        {/* Controls */}
        <div className="bg-[#120D0B] text-[#F8F1E4] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#D4AF62]" />
            <h3 className="font-cinzel text-base font-bold">SDA Collections — Tax Invoice (Demo)</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[#D4AF62] text-[#120D0B] text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-[#f3e5ab]"
            >
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div className="p-8 space-y-8 text-xs text-gray-800 font-poppins">
          <div className="flex justify-between items-start border-b pb-6">
            <div>
              <h1 className="font-cinzel text-2xl font-bold gold-gradient-text">SDA COLLECTIONS</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">FASHION · BEAUTY · STYLE</p>
              <p className="text-gray-600 mt-2">Banjara Hills Road No. 12, Hyderabad, Telangana 500034</p>
              <p className="text-gray-600">Helpline: +91 98480 12345 | support@sdacollections.com</p>
            </div>
            <div className="text-right space-y-1 font-mono">
              <h2 className="font-bold text-sm text-[#120D0B]">INVOICE</h2>
              <p>Invoice #: INV-{order.orderNumber}</p>
              <p>Date: {order.createdAt || 'Today'}</p>
              <p>Payment: {order.paymentMethod.toUpperCase()} ({order.paymentStatus})</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl">
            <div>
              <h4 className="font-bold text-gray-700 uppercase tracking-wider mb-1">Billed To:</h4>
              <p className="font-bold text-gray-900">{order.shippingAddress?.fullName || 'Valued Customer'}</p>
              <p className="text-gray-600">{order.shippingAddress?.addressLine || 'Banjara Hills, Hyderabad'}</p>
              <p className="text-gray-600">{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
              <p className="text-gray-600 font-mono">Mobile: {order.shippingAddress?.mobile || '9848012345'}</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-700 uppercase tracking-wider mb-1">Shipping & Dispatch:</h4>
              <p className="text-gray-600">Courier: Blue Dart Express Air</p>
              <p className="text-gray-600">Status: Confirmed & Packed</p>
              <p className="text-gray-600">GST Registration: Unverified Demo Entity</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 text-gray-700">
                <th className="py-2">Item Description</th>
                <th className="py-2">SKU</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((item, idx) => {
                const unitPrice = Math.round(item.product.basePrice * (1 - item.product.discount / 100));
                return (
                  <tr key={idx}>
                    <td className="py-3 font-medium">{item.product.name}</td>
                    <td className="py-3 font-mono text-gray-500">{item.variantSku || 'STD'}</td>
                    <td className="py-3 text-center">{item.quantity}</td>
                    <td className="py-3 text-right font-mono">₹{unitPrice.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right font-mono font-bold">₹{(unitPrice * item.quantity).toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-end pt-4 border-t">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-mono">₹{order.total.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-gray-600"><span>Shipping</span><span className="font-mono">FREE</span></div>
              <div className="flex justify-between text-gray-600"><span>GST (3% Included)</span><span className="font-mono">Included</span></div>
              <div className="flex justify-between text-sm font-bold text-[#120D0B] pt-2 border-t">
                <span>Grand Total</span>
                <span className="font-mono text-[#65102F]">₹{order.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t text-center text-[11px] text-gray-500 italic">
            This is a computer-generated simulated invoice for demonstration purposes under SDA Collections.
          </div>
        </div>

      </div>
    </div>
  );
};
