import React, { useEffect, useState } from 'react';
import {
  Truck,
  Package,
  Copy,
  Check,
  ExternalLink,
  Clock,
  MapPin,
  Search,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchCustomerOrders,
  fetchCustomerShipments,
  fetchShipmentEvents,
} from '../services/shippingReturnsService';
import {
  OrderRecord,
  ShipmentEventRecord,
  ShipmentRecord,
} from '../types/shippingReturns';

interface ShipmentTrackerProps {
  initialOrderNumber?: string;
  onOpenAuth?: () => void;
  onGoToOrders?: () => void;
}

const formatTimestamp = (ts: any): string => {
  if (!ts) return 'Just now';
  if (typeof ts?.toDate === 'function') {
    return ts.toDate().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString('en-IN');
};

export const ShipmentTracker: React.FC<ShipmentTrackerProps> = ({
  initialOrderNumber = '',
  onOpenAuth,
  onGoToOrders,
}) => {
  const { firebaseUser } = useAuth();
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRecord | null>(null);
  const [events, setEvents] = useState<ShipmentEventRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialOrderNumber);
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialOrderNumber) {
      setSearchQuery(initialOrderNumber);
    }
  }, [initialOrderNumber]);

  useEffect(() => {
    if (!firebaseUser) return;
    const load = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const [shipList, orderList] = await Promise.all([
          fetchCustomerShipments(firebaseUser.uid),
          fetchCustomerOrders(firebaseUser.uid),
        ]);
        setShipments(shipList);
        setOrders(orderList);

        if (initialOrderNumber) {
          const matched = shipList.find(
            (s) =>
              s.orderNumber.toLowerCase() === initialOrderNumber.toLowerCase() ||
              s.id.toLowerCase() === initialOrderNumber.toLowerCase()
          );
          if (matched) {
            setSelectedShipment(matched);
          } else if (shipList.length > 0) {
            setSelectedShipment(shipList[0]);
          }
        } else if (shipList.length > 0) {
          setSelectedShipment(shipList[0]);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Unable to load your shipments right now.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [firebaseUser, initialOrderNumber]);

  useEffect(() => {
    if (!selectedShipment) {
      setEvents([]);
      return;
    }
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const ev = await fetchShipmentEvents(selectedShipment.id);
        setEvents(ev);
      } catch (err) {
        console.error('Error loading shipment events:', err);
      } finally {
        setLoadingEvents(false);
      }
    };
    void loadEvents();
  }, [selectedShipment]);

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedId(value);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const matched = shipments.find(
      (s) =>
        s.orderNumber.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.trackingNumber || '').toLowerCase().includes(q)
    );
    if (matched) {
      setSelectedShipment(matched);
      setErrorMsg('');
    } else {
      const orderExists = orders.find((o) => o.orderNumber.toLowerCase() === q);
      if (orderExists) {
        setSelectedShipment(null);
        setErrorMsg(
          `Order ${orderExists.orderNumber} is currently "${orderExists.status}". Store dispatch tracking has not been added yet.`
        );
      } else {
        setErrorMsg(`No shipment found for "${searchQuery}" under your account.`);
      }
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    if (status === 'Delivered') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (status === 'Delivery Attempt Failed' || status === 'Shipment Cancelled' || status === 'Returned to Sender') {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    if (status === 'Out for Delivery') return 'bg-amber-100 text-amber-900 border-amber-300';
    return 'bg-[#F8F1E4] text-[#65102F] border-[#D4AF62]/50';
  };

  if (!firebaseUser) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 p-8 sm:p-12 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#120D0B] text-[#D4AF62] flex items-center justify-center border border-[#D4AF62]/40">
          <Truck className="w-8 h-8" />
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h2 className="font-cinzel text-2xl font-bold text-[#120D0B]">Track Your Shipment</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            For customer privacy and order protection, sign in to view your store-updated shipment status, tracking numbers, and delivery timeline.
          </p>
        </div>
        {onOpenAuth && (
          <button
            onClick={onOpenAuth}
            className="px-6 py-3 bg-[#120D0B] text-[#F8F1E4] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors"
          >
            Sign In to Track Orders
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transparency Banner + Search */}
      <div className="bg-[#120D0B] text-[#F8F1E4] rounded-2xl p-6 sm:p-8 border border-[#D4AF62]/30 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#D4AF62] font-semibold">
              <Info className="w-3.5 h-3.5" /> Store-Updated Tracking (Not Live Courier Tracking)
            </span>
            <h2 className="font-cinzel text-2xl font-bold">Order & Shipment Tracker</h2>
            <p className="text-xs text-[#F8F1E4]/75">
              Tracking milestones and courier details below are updated manually by our SDA Collections dispatch desk.
            </p>
          </div>
          {onGoToOrders && (
            <button
              onClick={onGoToOrders}
              className="px-4 py-2 bg-[#211713] border border-[#D4AF62]/40 rounded-xl text-xs font-semibold text-[#D4AF62] hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors self-start md:self-auto"
            >
              View All Orders
            </button>
          )}
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#D4AF62] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order # (e.g. SDA-849201), Shipment ID, or Tracking #..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#211713] border border-[#D4AF62]/40 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#D4AF62]"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-[#D4AF62] to-[#AA8230] text-[#120D0B] font-bold rounded-xl text-xs uppercase tracking-wider hover:from-[#f3e5ab] hover:to-[#d4af62] transition-all"
          >
            Locate Shipment
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center text-xs text-gray-500 border border-[#D4AF62]/20">
          Loading your shipments...
        </div>
      ) : shipments.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center space-y-3 border border-[#D4AF62]/20 shadow-sm">
          <Package className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="font-cinzel text-lg font-bold text-[#120D0B]">No Shipments Dispatched Yet</h3>
          <p className="text-xs text-gray-600 max-w-md mx-auto">
            {orders.length > 0
              ? `You have ${orders.length} order(s). Once our dispatch team assigns a courier partner and tracking details, your shipment timeline will appear here.`
              : 'Place an order at checkout to receive dispatch tracking details here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shipment List Sidebar */}
          <div className="space-y-3">
            <h3 className="font-cinzel font-bold text-sm text-[#120D0B] uppercase tracking-wider">
              Your Shipments ({shipments.length})
            </h3>
            <div className="space-y-2.5">
              {shipments.map((s) => {
                const isSelected = selectedShipment?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedShipment(s);
                      setErrorMsg('');
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all space-y-1.5 ${
                      isSelected
                        ? 'bg-white border-[#D4AF62] shadow-md ring-1 ring-[#D4AF62]/40'
                        : 'bg-white/80 border-gray-200 hover:border-[#D4AF62]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-[#65102F]">{s.orderNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeStyle(s.status)}`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-700 font-medium">{s.courierName}</p>
                    <p className="text-[11px] font-mono text-gray-500">
                      {s.trackingNumber ? `AWB: ${s.trackingNumber}` : 'Tracking # pending'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Shipment Details & Timeline */}
          <div className="lg:col-span-2">
            {selectedShipment && (
              <div className="bg-white rounded-2xl shadow-xl border border-[#D4AF62]/30 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF6EE]">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#65102F]">{selectedShipment.orderNumber}</span>
                      <span className="text-gray-300">|</span>
                      <span className="font-mono text-[11px] text-gray-500">Shipment ID: {selectedShipment.id}</span>
                    </div>
                    <h3 className="font-cinzel text-xl font-bold text-[#120D0B] mt-1">
                      {selectedShipment.courierName}
                    </h3>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-bold border self-start sm:self-auto ${getStatusBadgeStyle(
                      selectedShipment.status
                    )}`}
                  >
                    {selectedShipment.status}
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {/* Tracking Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5">
                      <p className="text-[11px] text-gray-500 uppercase font-semibold">Tracking Number</p>
                      {selectedShipment.trackingNumber ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-sm text-[#120D0B] break-all">
                            {selectedShipment.trackingNumber}
                          </span>
                          <button
                            onClick={() => handleCopy(selectedShipment.trackingNumber || '')}
                            className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-[11px] font-semibold text-gray-700 hover:border-[#D4AF62] flex items-center gap-1 shrink-0"
                          >
                            {copiedId === selectedShipment.trackingNumber ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <p className="text-amber-700 font-medium">
                          Tracking number has not been entered by store dispatch yet.
                        </p>
                      )}
                      {selectedShipment.trackingUrl && (
                        <a
                          href={selectedShipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#65102F] hover:underline pt-1"
                        >
                          <span>Open Courier Tracking Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5">
                      <p className="text-[11px] text-gray-500 uppercase font-semibold">Delivery Schedule</p>
                      <p className="text-gray-700">
                        <strong>Dispatched:</strong> {selectedShipment.shippingDate || 'Pending dispatch'}
                      </p>
                      <p className="text-gray-700">
                        <strong>Estimated Delivery:</strong>{' '}
                        {selectedShipment.estimatedDeliveryDate || 'To be confirmed'}
                      </p>
                      {selectedShipment.actualDeliveryDate && (
                        <p className="text-emerald-700 font-semibold">
                          <strong>Delivered On:</strong> {selectedShipment.actualDeliveryDate}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedShipment.deliveryNotes && (
                    <div className="p-4 rounded-xl bg-amber-50/60 border border-[#D4AF62]/40 text-xs text-gray-800">
                      <span className="font-bold text-[#65102F]">Dispatch / Delivery Notes: </span>
                      {selectedShipment.deliveryNotes}
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-cinzel font-bold text-sm text-[#120D0B]">Shipment Timeline</h4>
                      <span className="text-[11px] text-gray-500">Store-updated milestones</span>
                    </div>

                    {loadingEvents ? (
                      <p className="text-xs text-gray-500 py-4">Loading timeline...</p>
                    ) : events.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4">
                        Shipment record created. Milestones will appear here as our team updates dispatch progress.
                      </p>
                    ) : (
                      <div className="space-y-4 pl-2">
                        {events.map((ev, idx) => {
                          const isLast = idx === events.length - 1;
                          return (
                            <div key={ev.id} className="relative pl-6 pb-2 border-l-2 border-[#D4AF62]/40 last:border-l-transparent">
                              <span
                                className={`absolute -left-[9px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                                  isLast
                                    ? 'bg-[#D4AF62] text-[#120D0B] ring-4 ring-[#D4AF62]/20'
                                    : 'bg-[#120D0B] text-[#D4AF62]'
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                              </span>
                              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/80 space-y-1">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                  <span className="font-bold text-xs text-[#120D0B]">{ev.status}</span>
                                  <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {formatTimestamp(ev.createdAt)}
                                  </span>
                                </div>
                                {ev.location && (
                                  <p className="text-[11px] text-[#65102F] font-medium flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {ev.location}
                                  </p>
                                )}
                                {ev.notes && <p className="text-xs text-gray-600">{ev.notes}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
