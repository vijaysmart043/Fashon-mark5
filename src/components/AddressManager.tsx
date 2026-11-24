import React, { useState } from 'react';
import { MapPin, Plus, Trash2, Check, X } from 'lucide-react';

export interface Address {
  id: string;
  fullName: string;
  mobile: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  addressType: 'Home' | 'Work' | 'Other';
  isDefault: boolean;
}

interface AddressManagerProps {
  addresses: Address[];
  onAddAddress: (addr: Address) => void;
  onDeleteAddress: (id: string) => void;
  onSelectAddress: (addr: Address) => void;
  selectedAddressId?: string;
  onClose?: () => void;
}

export const AddressManager: React.FC<AddressManagerProps> = ({
  addresses,
  onAddAddress,
  onDeleteAddress,
  onSelectAddress,
  selectedAddressId,
  onClose
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [fullName, setFullName] = useState('Sravani Reddy');
  const [mobile, setMobile] = useState('9848012345');
  const [addressLine, setAddressLine] = useState('Plot 42, Road No. 12, Banjara Hills');
  const [city, setCity] = useState('Hyderabad');
  const [state, setState] = useState('Telangana');
  const [pincode, setPincode] = useState('500034');
  const [addressType, setAddressType] = useState<'Home' | 'Work' | 'Other'>('Home');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !addressLine || !pincode) return;

    const newAddr: Address = {
      id: 'addr-' + Date.now(),
      fullName,
      mobile,
      addressLine,
      city,
      state,
      pincode,
      addressType,
      isDefault: addresses.length === 0
    };

    onAddAddress(newAddr);
    onSelectAddress(newAddr);
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-cinzel font-bold text-base text-[#120D0B]">Delivery Addresses</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-3 py-1.5 bg-[#120D0B] text-[#F8F1E4] rounded-lg text-xs font-semibold hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add New Address
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 text-xs">
          <div className="flex justify-between items-center border-b pb-2">
            <h4 className="font-bold text-gray-800">New Address Details</h4>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Full Name</label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-3 py-1.5 rounded border bg-white" />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Mobile Number</label>
              <input type="tel" required value={mobile} onChange={e => setMobile(e.target.value)} className="w-full px-3 py-1.5 rounded border bg-white" />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Street Address</label>
            <input type="text" required value={addressLine} onChange={e => setAddressLine(e.target.value)} className="w-full px-3 py-1.5 rounded border bg-white" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">City</label>
              <input type="text" required value={city} onChange={e => setCity(e.target.value)} className="w-full px-3 py-1.5 rounded border bg-white" />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">State</label>
              <input type="text" required value={state} onChange={e => setState(e.target.value)} className="w-full px-3 py-1.5 rounded border bg-white" />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">PIN Code</label>
              <input type="text" required value={pincode} onChange={e => setPincode(e.target.value)} className="w-full px-3 py-1.5 rounded border bg-white" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-[#D4AF62] text-[#120D0B] font-bold rounded-lg">Save Address</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {addresses.map((addr) => {
          const isSelected = selectedAddressId === addr.id;
          return (
            <div
              key={addr.id}
              onClick={() => onSelectAddress(addr)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected ? 'bg-amber-50/50 border-[#D4AF62] shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-cinzel font-bold text-xs text-[#120D0B]">{addr.fullName}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-[10px] font-semibold text-gray-700">{addr.addressType}</span>
                </div>
                <p className="text-xs text-gray-600 font-poppins">{addr.addressLine}, {addr.city}, {addr.state} - {addr.pincode}</p>
                <p className="text-xs text-gray-500 font-mono">Mobile: {addr.mobile}</p>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 text-xs">
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  {isSelected && <Check className="w-3.5 h-3.5" />} {isSelected ? 'Selected for Delivery' : 'Select'}
                </span>
                <button onClick={(e) => { e.stopPropagation(); onDeleteAddress(addr.id); }} className="text-gray-400 hover:text-rose-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
