import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Edit,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  CreditCard,
  Settings,
  ClipboardList,
  Clock,
  MapPin,
  Search,
  Info,
} from 'lucide-react';
import {
  AuditLogRecord,
  CourierProvider,
  OrderRecord,
  RefundRecord,
  RefundStatus,
  RETURN_STATUSES,
  ReturnPolicyConfig,
  ReturnRequestRecord,
  ReturnStatus,
  SHIPMENT_STATUSES,
  ShipmentEventRecord,
  ShipmentRecord,
  ShipmentStatus,
  VALID_REFUND_TRANSITIONS,
  VALID_RETURN_TRANSITIONS,
  VALID_SHIPMENT_TRANSITIONS,
} from '../types/shippingReturns';
import { PRODUCTS, CATEGORIES } from '../data/mockData';
import {
  createShipmentForOrder,
  createSimulatedRefund,
  fetchShipmentEvents,
  saveCourierProvider,
  saveReturnPolicy,
  seedDefaultCouriersIfEmpty,
  updateReturnRequestWorkflow,
  updateShipmentStatusAndDetails,
  updateSimulatedRefundStatus,
  validateSimulatedRefundRequest,
} from '../services/shippingReturnsService';

interface ActorInfo {
  uid: string;
  name: string;
  email: string;
}

// ---------- 1. SHIPPING & TRACKING PANEL ----------

export const AdminShippingPanel: React.FC<{
  orders: OrderRecord[];
  shipments: ShipmentRecord[];
  couriers: CourierProvider[];
  actor: ActorInfo;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}> = ({ orders, shipments, couriers, actor, canEdit, onRefresh }) => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [creatingForOrder, setCreatingForOrder] = useState<OrderRecord | null>(null);
  const [editingShipment, setEditingShipment] = useState<ShipmentRecord | null>(null);
  const [eventsMap, setEventsMap] = useState<Record<string, ShipmentEventRecord[]>>({});
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);

  // Create shipment form state
  const activeCouriers = couriers.filter((c) => c.active);
  const [selectedCourierId, setSelectedCourierId] = useState(activeCouriers[0]?.id || '');
  const [customCourierName, setCustomCourierName] = useState(activeCouriers[0]?.name || 'Blue Dart Express Air');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [shippingDate, setShippingDate] = useState(new Date().toISOString().slice(0, 10));
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Update shipment state
  const [nextStatus, setNextStatus] = useState<ShipmentStatus>('Shipment Created');
  const [updateLocation, setUpdateLocation] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [actualDeliveryDate, setActualDeliveryDate] = useState('');

  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const ordersWithoutShipment = orders.filter(
    (o) => !shipments.some((s) => s.orderId === o.id) && o.status !== 'Cancelled'
  );

  const filteredShipments = shipments.filter((s) => {
    if (statusFilter !== 'All' && s.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        s.orderNumber.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.trackingNumber || '').toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCourierChange = (courierId: string, awb: string) => {
    setSelectedCourierId(courierId);
    const c = couriers.find((x) => x.id === courierId);
    if (c) {
      setCustomCourierName(c.name);
      if (c.trackingUrlTemplate && awb) {
        setTrackingUrl(c.trackingUrlTemplate.replace('{trackingNumber}', encodeURIComponent(awb)));
      }
      const est = new Date();
      est.setDate(est.getDate() + (c.defaultEstimatedDays || 4));
      setEstimatedDeliveryDate(est.toISOString().slice(0, 10));
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingForOrder) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await createShipmentForOrder({
        order: creatingForOrder,
        courierId: selectedCourierId,
        courierName: customCourierName,
        trackingNumber,
        trackingUrl,
        shippingDate,
        estimatedDeliveryDate,
        deliveryNotes,
        actorUid: actor.uid,
        actorName: actor.name,
        actorEmail: actor.email,
      });
      setFeedback(`Shipment created for order ${creatingForOrder.orderNumber}.`);
      setCreatingForOrder(null);
      setTrackingNumber('');
      setTrackingUrl('');
      setDeliveryNotes('');
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create shipment.');
    } finally {
      setBusy(false);
    }
  };

  const openUpdateForm = (s: ShipmentRecord) => {
    setEditingShipment(s);
    const allowed = VALID_SHIPMENT_TRANSITIONS[s.status] || [];
    setNextStatus(allowed[0] || s.status);
    setSelectedCourierId(s.courierId || '');
    setCustomCourierName(s.courierName);
    setTrackingNumber(s.trackingNumber || '');
    setTrackingUrl(s.trackingUrl || '');
    setShippingDate(s.shippingDate || new Date().toISOString().slice(0, 10));
    setEstimatedDeliveryDate(s.estimatedDeliveryDate || '');
    setActualDeliveryDate(s.actualDeliveryDate || '');
    setUpdateLocation('');
    setUpdateNotes(s.deliveryNotes || '');
    setErrorMsg('');
  };

  const handleUpdateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShipment) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await updateShipmentStatusAndDetails({
        shipment: editingShipment,
        nextStatus,
        courierId: selectedCourierId,
        courierName: customCourierName,
        trackingNumber,
        trackingUrl,
        shippingDate,
        estimatedDeliveryDate,
        actualDeliveryDate,
        deliveryNotes: updateNotes,
        location: updateLocation,
        actorUid: actor.uid,
        actorName: actor.name,
        actorEmail: actor.email,
      });
      setFeedback(`Shipment ${editingShipment.id} updated to "${nextStatus}".`);
      setEditingShipment(null);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update shipment.');
    } finally {
      setBusy(false);
    }
  };

  const toggleTimeline = async (shipmentId: string) => {
    if (expandedTimelineId === shipmentId) {
      setExpandedTimelineId(null);
      return;
    }
    setExpandedTimelineId(shipmentId);
    if (!eventsMap[shipmentId]) {
      const ev = await fetchShipmentEvents(shipmentId);
      setEventsMap((prev) => ({ ...prev, [shipmentId]: ev }));
    }
  };

  return (
    <div className="space-y-6 text-xs">
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
        <Info className="w-4 h-4 shrink-0" />
        <span>
          <strong>Store-Updated Tracking Mode:</strong> Courier names, tracking numbers, external links, and status milestones are manually managed by store staff (no live courier API integration).
        </span>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback('')} className="underline font-bold">Dismiss</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Orders Awaiting Shipment */}
      {canEdit && ordersWithoutShipment.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-[#D4AF62]/30 shadow-sm space-y-4">
          <h3 className="font-cinzel font-bold text-base text-[#120D0B]">
            Orders Pending Shipment Creation ({ordersWithoutShipment.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ordersWithoutShipment.map((ord) => (
              <div key={ord.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono font-bold text-[#65102F]">{ord.orderNumber}</p>
                  <p className="text-gray-700 font-medium">{ord.customerName} · ₹{ord.total.toLocaleString('en-IN')}</p>
                  <p className="text-[11px] text-gray-500">Order Status: {ord.status}</p>
                </div>
                <button
                  onClick={() => {
                    setCreatingForOrder(ord);
                    const defC = activeCouriers[0];
                    if (defC) handleCourierChange(defC.id, '');
                    setErrorMsg('');
                  }}
                  className="px-3.5 py-2 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold hover:bg-[#D4AF62] hover:text-[#120D0B] flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Shipment
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Shipment Modal/Drawer Inline */}
      {creatingForOrder && (
        <form onSubmit={handleCreateShipment} className="bg-white p-6 rounded-2xl border-2 border-[#D4AF62] shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h4 className="font-cinzel font-bold text-base text-[#120D0B]">
              New Shipment for Order {creatingForOrder.orderNumber}
            </h4>
            <button type="button" onClick={() => setCreatingForOrder(null)} className="text-gray-500 hover:text-black font-bold">
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Courier Partner</label>
              <select
                value={selectedCourierId}
                onChange={(e) => handleCourierChange(e.target.value, trackingNumber)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white"
              >
                {activeCouriers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="">Custom Courier</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Courier Display Name</label>
              <input
                type="text"
                required
                value={customCourierName}
                onChange={(e) => setCustomCourierName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tracking Number (Optional initially)</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  setTrackingNumber(val);
                  const c = couriers.find((x) => x.id === selectedCourierId);
                  if (c?.trackingUrlTemplate && val) {
                    setTrackingUrl(c.trackingUrlTemplate.replace('{trackingNumber}', encodeURIComponent(val)));
                  }
                }}
                placeholder="e.g. BD77889911IN"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">External Tracking URL</label>
              <input
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Shipping Date</label>
              <input
                type="date"
                value={shippingDate}
                onChange={(e) => setShippingDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Estimated Delivery Date</label>
              <input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Delivery / Dispatch Notes</label>
            <input
              type="text"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Tamper-proof sealed box, insured jewellery parcel..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setCreatingForOrder(null)} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
              {busy ? 'Creating...' : 'Save Shipment'}
            </button>
          </div>
        </form>
      )}

      {/* Update Shipment Form */}
      {editingShipment && (
        <form onSubmit={handleUpdateShipment} className="bg-white p-6 rounded-2xl border-2 border-[#65102F] shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h4 className="font-cinzel font-bold text-base text-[#120D0B]">
                Update Shipment {editingShipment.id} (Order {editingShipment.orderNumber})
              </h4>
              <p className="text-[11px] text-gray-500">Current Status: {editingShipment.status}</p>
            </div>
            <button type="button" onClick={() => setEditingShipment(null)} className="text-gray-500 hover:text-black font-bold">
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Next Shipment Status</label>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as ShipmentStatus)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white font-semibold"
              >
                <option value={editingShipment.status}>{editingShipment.status} (Keep current)</option>
                {(VALID_SHIPMENT_TRANSITIONS[editingShipment.status] || []).map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Hub / Event Location</label>
              <input
                type="text"
                value={updateLocation}
                onChange={(e) => setUpdateLocation(e.target.value)}
                placeholder="e.g. Hyderabad Central Hub / Banjara Hills"
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Courier Name</label>
              <input
                type="text"
                required
                value={customCourierName}
                onChange={(e) => setCustomCourierName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tracking Number</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tracking URL</label>
              <input
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Estimated Delivery Date</label>
              <input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            {nextStatus === 'Delivered' && (
              <div>
                <label className="block font-semibold mb-1">Actual Delivery Date</label>
                <input
                  type="date"
                  value={actualDeliveryDate || new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setActualDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold mb-1">Delivery / Milestone Notes</label>
            <input
              type="text"
              value={updateNotes}
              onChange={(e) => setUpdateNotes(e.target.value)}
              placeholder="Reason for delay, signed delivery confirmation, or hub scan note..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditingShipment(null)} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2 bg-[#65102F] text-white font-bold rounded-lg">
              {busy ? 'Updating...' : 'Commit Tracking Update'}
            </button>
          </div>
        </form>
      )}

      {/* Shipments Filter & List */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-cinzel font-bold text-lg text-[#120D0B]">
            All Shipments ({filteredShipments.length})
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search order #, AWB, customer..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-300"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white"
            >
              <option value="All">All Statuses</option>
              {SHIPMENT_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredShipments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No shipments match the selected filter.</p>
        ) : (
          <div className="space-y-3">
            {filteredShipments.map((s) => (
              <div key={s.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#65102F]">{s.orderNumber}</span>
                      <span className="font-mono text-gray-500">({s.id})</span>
                      <span className="px-2 py-0.5 rounded bg-white border border-[#D4AF62]/50 font-bold text-[#120D0B]">
                        {s.status}
                      </span>
                    </div>
                    <p className="text-gray-700">
                      Customer: <strong>{s.customerName}</strong> · Courier: <strong>{s.courierName}</strong> · AWB:{' '}
                      <span className="font-mono">{s.trackingNumber || 'Pending'}</span>
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Shipped: {s.shippingDate || '-'} · Est. Delivery: {s.estimatedDeliveryDate || '-'}
                      {s.actualDeliveryDate ? ` · Delivered: ${s.actualDeliveryDate}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {s.trackingUrl && (
                      <a
                        href={s.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold flex items-center gap-1 hover:border-[#D4AF62]"
                      >
                        <ExternalLink className="w-3 h-3" /> Link
                      </a>
                    )}
                    <button
                      onClick={() => void toggleTimeline(s.id)}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold hover:border-[#D4AF62]"
                    >
                      {expandedTimelineId === s.id ? 'Hide Timeline' : 'Timeline'}
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => openUpdateForm(s)}
                        className="px-3.5 py-1.5 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold hover:bg-[#D4AF62] hover:text-[#120D0B]"
                      >
                        Update Tracking
                      </button>
                    )}
                  </div>
                </div>

                {expandedTimelineId === s.id && (
                  <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                    <p className="font-bold text-[#120D0B]">Milestone History</p>
                    {(eventsMap[s.id] || []).length === 0 ? (
                      <p className="text-gray-500">No milestone events logged yet.</p>
                    ) : (
                      (eventsMap[s.id] || []).map((ev) => (
                        <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5 border-b last:border-b-0">
                          <div>
                            <span className="font-bold text-[#65102F]">{ev.status}</span>
                            {ev.location && <span className="text-gray-500"> · {ev.location}</span>}
                            {ev.notes && <p className="text-gray-600">{ev.notes}</p>}
                          </div>
                          <span className="text-[11px] font-mono text-gray-500">
                            {ev.createdAt?.toDate ? ev.createdAt.toDate().toLocaleString('en-IN') : 'Logged'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- 2. COURIER CONFIGURATION PANEL ----------

export const AdminCourierPanel: React.FC<{
  couriers: CourierProvider[];
  actor: ActorInfo;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}> = ({ couriers, actor, canEdit, onRefresh }) => {
  const [name, setName] = useState('');
  const [trackingUrlTemplate, setTrackingUrlTemplate] = useState('');
  const [defaultDays, setDefaultDays] = useState(4);
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingActive, setEditingActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveCourierProvider(
        {
          id: editingId || '',
          name,
          trackingUrlTemplate,
          defaultEstimatedDays: defaultDays,
          active: editingActive,
          notes,
        },
        !editingId,
        actor.uid,
        actor.email
      );
      setFeedback(editingId ? `Updated courier "${name}".` : `Added courier "${name}".`);
      setName('');
      setTrackingUrlTemplate('');
      setDefaultDays(4);
      setNotes('');
      setEditingId(null);
      setEditingActive(true);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">{feedback}</div>
      )}

      {canEdit && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-cinzel font-bold text-base text-[#120D0B]">
              {editingId ? 'Edit Courier Partner' : 'Add Courier Partner'}
            </h3>
            <button
              type="button"
              onClick={async () => {
                await seedDefaultCouriersIfEmpty(actor.uid, actor.email);
                await onRefresh();
              }}
              className="px-3 py-1.5 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200"
            >
              Seed Default Couriers
            </button>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Courier Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Blue Dart Express Air"
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Default Estimated Delivery (Days)</label>
              <input
                type="number"
                min={1}
                max={60}
                required
                value={defaultDays}
                onChange={(e) => setDefaultDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold mb-1">Tracking URL Template (use {'{trackingNumber}'})</label>
              <input
                type="text"
                value={trackingUrlTemplate}
                onChange={(e) => setTrackingUrlTemplate(e.target.value)}
                placeholder="https://www.bluedart.com/tracking?trackId={trackingNumber}"
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold mb-1">Service Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Insured jewellery & handloom silk service"
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="courierActive"
                type="checkbox"
                checked={editingActive}
                onChange={(e) => setEditingActive(e.target.checked)}
              />
              <label htmlFor="courierActive" className="font-semibold">Courier Active</label>
            </div>
            <div className="flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setName('');
                    setTrackingUrlTemplate('');
                    setNotes('');
                  }}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
              )}
              <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
                {busy ? 'Saving...' : editingId ? 'Save Changes' : 'Add Courier'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <h3 className="font-cinzel font-bold text-base text-[#120D0B]">Configured Couriers ({couriers.length})</h3>
        {couriers.map((c) => (
          <div key={c.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#120D0B]">{c.name}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                  {c.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-gray-500">Est. Transit: {c.defaultEstimatedDays} days · {c.notes}</p>
              {c.trackingUrlTemplate && <p className="font-mono text-[11px] text-gray-400">{c.trackingUrlTemplate}</p>}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingId(c.id);
                    setName(c.name);
                    setTrackingUrlTemplate(c.trackingUrlTemplate || '');
                    setDefaultDays(c.defaultEstimatedDays);
                    setNotes(c.notes || '');
                    setEditingActive(c.active);
                  }}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={async () => {
                    await saveCourierProvider({ ...c, active: !c.active }, false, actor.uid, actor.email);
                    await onRefresh();
                  }}
                  className="px-3 py-1.5 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold"
                >
                  {c.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- 3. RETURNS & INSPECTION PANEL ----------

export const AdminReturnsPanel: React.FC<{
  returns: ReturnRequestRecord[];
  orders: OrderRecord[];
  refunds: RefundRecord[];
  actor: ActorInfo;
  canEdit: boolean;
  canCreateRefund: boolean;
  onRefresh: () => Promise<void>;
}> = ({ returns, orders, refunds, actor, canEdit, canCreateRefund, onRefresh }) => {
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequestRecord | null>(null);
  const [nextStatus, setNextStatus] = useState<ReturnStatus>('Under Review');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = returns.filter((r) => statusFilter === 'All' || r.status === statusFilter);

  const handleOpenReview = (ret: ReturnRequestRecord) => {
    setSelectedReturn(ret);
    const allowed = VALID_RETURN_TRANSITIONS[ret.status] || [];
    setNextStatus(allowed[0] || ret.status);
    setInspectionNotes(ret.inspectionNotes || '');
    setAdminNotes(ret.adminNotes || '');
    setErrorMsg('');
  };

  const handleCommitReturnUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await updateReturnRequestWorkflow({
        returnRequest: selectedReturn,
        nextStatus,
        inspectionNotes,
        adminNotes,
        actorUid: actor.uid,
        actorEmail: actor.email,
      });
      setFeedback(`Return ${selectedReturn.returnNumber} updated to "${nextStatus}".`);
      setSelectedReturn(null);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update return.');
    } finally {
      setBusy(false);
    }
  };

  const handleInitiateRefund = async (ret: ReturnRequestRecord) => {
    setErrorMsg('');
    const ord = orders.find((o) => o.id === ret.orderId);
    if (!ord) {
      setErrorMsg(`Parent order ${ret.orderNumber} not found.`);
      return;
    }
    setBusy(true);
    try {
      const created = await createSimulatedRefund({
        order: ord,
        returnRequest: ret,
        existingRefunds: refunds,
        refundAmount: ret.requestedRefundAmount,
        adminNotes: `Initiated from return ${ret.returnNumber}`,
        actorUid: actor.uid,
        actorEmail: actor.email,
      });
      setFeedback(`Simulated refund ${created.refundNumber} created for ₹${created.refundAmount.toLocaleString('en-IN')}.`);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not initiate simulated refund.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback('')} className="underline font-bold">Dismiss</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {selectedReturn && (
        <form onSubmit={handleCommitReturnUpdate} className="bg-white p-6 rounded-2xl border-2 border-[#65102F] shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h4 className="font-cinzel font-bold text-base text-[#120D0B]">
                Review & Inspect Return {selectedReturn.returnNumber}
              </h4>
              <p className="text-[11px] text-gray-500">
                Current Status: {selectedReturn.status} · Customer: {selectedReturn.customerName}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedReturn(null)} className="font-bold text-gray-500">Close</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Transition Return Status</label>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as ReturnStatus)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white font-semibold"
              >
                <option value={selectedReturn.status}>{selectedReturn.status} (Keep current)</option>
                {(VALID_RETURN_TRANSITIONS[selectedReturn.status] || []).map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Admin / Customer Support Notes</label>
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Pickup scheduled or rejection reason..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Physical Quality Inspection Notes</label>
            <textarea
              rows={2}
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
              placeholder="Tags intact, BIS seal verified, weave unharmed..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setSelectedReturn(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
              {busy ? 'Saving...' : 'Save Return Status'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-cinzel font-bold text-lg text-[#120D0B]">Return Requests ({filtered.length})</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white"
          >
            <option value="All">All Statuses</option>
            {RETURN_STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No return requests found.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((ret) => {
              const canStartRefund =
                canCreateRefund &&
                !ret.refundId &&
                ['Approved', 'Inspection Passed'].includes(ret.status);

              return (
                <div key={ret.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-[#65102F]">{ret.returnNumber}</span>
                      <span className="text-gray-400 mx-2">|</span>
                      <span className="font-mono">Order {ret.orderNumber}</span>
                      <span className="text-gray-400 mx-2">|</span>
                      <span>{ret.customerName}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded bg-white border border-[#D4AF62]/50 font-bold">
                      {ret.status}
                    </span>
                  </div>

                  <div className="text-gray-700 space-y-1">
                    {ret.items.map((it, idx) => (
                      <p key={idx}>
                        {it.productName} ({it.variantSku}) × {it.quantity} — ₹{it.lineTotal.toLocaleString('en-IN')}
                      </p>
                    ))}
                    <p><strong>Reason:</strong> {ret.reason}</p>
                    {ret.description && <p><strong>Customer Note:</strong> {ret.description}</p>}
                    {ret.inspectionNotes && <p className="text-[#65102F]"><strong>Inspection:</strong> {ret.inspectionNotes}</p>}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200">
                    <span className="font-mono font-bold text-[#120D0B]">
                      Requested Refund: ₹{ret.requestedRefundAmount.toLocaleString('en-IN')}
                    </span>
                    <div className="flex items-center gap-2">
                      {canEdit && !['Closed', 'Rejected'].includes(ret.status) && (
                        <button
                          onClick={() => handleOpenReview(ret)}
                          className="px-3.5 py-1.5 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold hover:bg-[#D4AF62] hover:text-[#120D0B]"
                        >
                          Review / Inspect
                        </button>
                      )}
                      {canStartRefund && (
                        <button
                          onClick={() => void handleInitiateRefund(ret)}
                          disabled={busy}
                          className="px-3.5 py-1.5 bg-[#65102F] text-white rounded-lg font-bold hover:bg-[#4a0b22]"
                        >
                          Create Simulated Refund
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- 4. SIMULATED REFUNDS PANEL ----------

export const AdminRefundsPanel: React.FC<{
  refunds: RefundRecord[];
  orders: OrderRecord[];
  returns: ReturnRequestRecord[];
  actor: ActorInfo;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}> = ({ refunds, orders, returns, actor, canEdit, onRefresh }) => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [refundAmountInput, setRefundAmountInput] = useState<number>(0);
  const [adminNotes, setAdminNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const handleManualRefundCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setErrorMsg('');
    setBusy(true);
    try {
      const relatedReturn = returns.find((r) => r.orderId === selectedOrder.id && !r.refundId) || null;
      const created = await createSimulatedRefund({
        order: selectedOrder,
        returnRequest: relatedReturn,
        existingRefunds: refunds,
        refundAmount: Number(refundAmountInput),
        adminNotes,
        actorUid: actor.uid,
        actorEmail: actor.email,
      });
      setFeedback(`Created simulated refund ${created.refundNumber} for Order ${selectedOrder.orderNumber}.`);
      setSelectedOrderId('');
      setRefundAmountInput(0);
      setAdminNotes('');
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to create simulated refund.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-2">
        <Info className="w-4 h-4 shrink-0" />
        <span>
          <strong>SIMULATED REFUNDS ONLY:</strong> All refund entries represent internal demonstration records. No real bank, UPI, card, or payment gateway transfer occurs. Cash-on-Delivery orders are logged as simulated COD / store credit refunds.
        </span>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback('')} className="underline font-bold">Dismiss</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {canEdit && (
        <form onSubmit={handleManualRefundCreate} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-cinzel font-bold text-base text-[#120D0B]">Create Simulated Refund</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold mb-1">Select Order</label>
              <select
                value={selectedOrderId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedOrderId(id);
                  const ord = orders.find((o) => o.id === id);
                  if (ord) setRefundAmountInput(ord.total);
                }}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white"
              >
                <option value="">-- Choose Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} ({o.customerName} · ₹{o.total.toLocaleString('en-IN')} · {o.paymentMethod.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Simulated Refund Amount (₹)
                {selectedOrder ? ` (Max Paid: ₹${selectedOrder.total.toLocaleString('en-IN')})` : ''}
              </label>
              <input
                type="number"
                min={1}
                required
                value={refundAmountInput || ''}
                onChange={(e) => setRefundAmountInput(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Refund Admin Notes</label>
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Approved after cancellation / inspection"
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
          </div>
          {selectedOrder && (
            <p className="text-[11px] text-gray-600">
              {validateSimulatedRefundRequest({
                order: selectedOrder,
                existingRefunds: refunds,
                refundAmount: refundAmountInput,
              }).modeNote || 'Validates against paid amount and prevents duplicate refunds.'}
            </p>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
              {busy ? 'Creating...' : 'Create Simulated Refund Record'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h3 className="font-cinzel font-bold text-lg text-[#120D0B]">Simulated Refund Queue ({refunds.length})</h3>
        {refunds.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No simulated refund records created yet.</p>
        ) : (
          <div className="space-y-3">
            {refunds.map((rf) => {
              const allowedNext = VALID_REFUND_TRANSITIONS[rf.status] || [];
              return (
                <div key={rf.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-[#65102F]">{rf.refundNumber}</span>
                      <span className="text-gray-400 mx-2">|</span>
                      <span className="font-mono">Order {rf.orderNumber}</span>
                      <span className="text-gray-400 mx-2">|</span>
                      <span>{rf.customerName}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded bg-white border border-[#D4AF62]/50 font-bold">
                      {rf.status}
                    </span>
                  </div>
                  <p className="text-gray-700">
                    Refund Amount: <strong className="font-mono">₹{rf.refundAmount.toLocaleString('en-IN')}</strong> (Paid Cap:{' '}
                    <span className="font-mono">₹{rf.eligiblePaidAmount.toLocaleString('en-IN')}</span>) · Method:{' '}
                    <strong>{rf.originalPaymentMethod.toUpperCase()}</strong> · Ref:{' '}
                    <span className="font-mono">{rf.referenceId}</span>
                  </p>
                  {rf.refundModeNote && <p className="text-[11px] text-gray-500">{rf.refundModeNote}</p>}

                  {canEdit && allowedNext.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                      {allowedNext.map((nxt) => (
                        <button
                          key={nxt}
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setErrorMsg('');
                            try {
                              await updateSimulatedRefundStatus({
                                refund: rf,
                                nextStatus: nxt,
                                actorUid: actor.uid,
                                actorEmail: actor.email,
                              });
                              setFeedback(`Refund ${rf.refundNumber} transitioned to "${nxt}".`);
                              await onRefresh();
                            } catch (err: any) {
                              setErrorMsg(err?.message || 'Refund transition failed.');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold ${
                            nxt === 'Completed'
                              ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                              : nxt === 'Rejected' || nxt === 'Failed'
                              ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                              : 'bg-[#120D0B] text-[#D4AF62] hover:bg-[#D4AF62] hover:text-[#120D0B]'
                          }`}
                        >
                          Mark {nxt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- 5. RETURN POLICY CONFIGURATION PANEL ----------

export const AdminReturnPolicyPanel: React.FC<{
  policy: ReturnPolicyConfig;
  actor: ActorInfo;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}> = ({ policy, actor, canEdit, onRefresh }) => {
  const [returnsEnabled, setReturnsEnabled] = useState(policy.returnsEnabled);
  const [returnWindowDays, setReturnWindowDays] = useState(policy.returnWindowDays);
  const [inspectionRequired, setInspectionRequired] = useState(policy.inspectionRequired);
  const [eligibleCategories, setEligibleCategories] = useState<string[]>(policy.eligibleCategories);
  const [nonReturnableProductIds, setNonReturnableProductIds] = useState<string[]>(policy.nonReturnableProductIds);
  const [nonReturnableReasonsNote, setNonReturnableReasonsNote] = useState(policy.nonReturnableReasonsNote);
  const [returnReasonsText, setReturnReasonsText] = useState(policy.returnReasons.join('\n'));
  const [returnInstructions, setReturnInstructions] = useState(policy.returnInstructions);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveReturnPolicy(
        {
          id: 'return_policy',
          returnsEnabled,
          returnWindowDays,
          inspectionRequired,
          eligibleCategories,
          nonReturnableProductIds,
          nonReturnableReasonsNote,
          returnReasons: returnReasonsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          returnInstructions,
        },
        actor.uid,
        actor.email
      );
      setFeedback('Store return policy updated.');
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5 text-xs">
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
        <strong>Store-Configurable Return Policy (Demo Defaults):</strong> Store administrators must review, customize, and confirm legal compliance before live storefront launch.
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">{feedback}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border font-semibold">
          <input
            type="checkbox"
            checked={returnsEnabled}
            disabled={!canEdit}
            onChange={(e) => setReturnsEnabled(e.target.checked)}
          />
          <span>Enable Customer Returns</span>
        </label>

        <label className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border font-semibold">
          <input
            type="checkbox"
            checked={inspectionRequired}
            disabled={!canEdit}
            onChange={(e) => setInspectionRequired(e.target.checked)}
          />
          <span>Require Physical Inspection</span>
        </label>

        <div className="p-3 rounded-xl bg-gray-50 border">
          <label className="block font-semibold mb-1">Return Window (Days after Delivery)</label>
          <input
            type="number"
            min={0}
            max={90}
            disabled={!canEdit}
            value={returnWindowDays}
            onChange={(e) => setReturnWindowDays(Number(e.target.value))}
            className="w-full px-2.5 py-1 rounded border bg-white font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block font-bold mb-2">Return-Eligible Categories</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const checked = eligibleCategories.includes(c.name);
            return (
              <label key={c.id} className={`px-3 py-1.5 rounded-lg border cursor-pointer flex items-center gap-1.5 ${checked ? 'bg-[#120D0B] text-[#D4AF62] border-[#120D0B]' : 'bg-gray-50'}`}>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={checked}
                  onChange={() =>
                    setEligibleCategories(
                      checked ? eligibleCategories.filter((x) => x !== c.name) : [...eligibleCategories, c.name]
                    )
                  }
                />
                <span>{c.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block font-bold mb-2">Non-Returnable Products</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRODUCTS.map((p) => {
            const checked = nonReturnableProductIds.includes(p.id);
            return (
              <label key={p.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-gray-50">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={checked}
                  onChange={() =>
                    setNonReturnableProductIds(
                      checked
                        ? nonReturnableProductIds.filter((x) => x !== p.id)
                        : [...nonReturnableProductIds, p.id]
                    )
                  }
                />
                <span className="truncate">{p.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block font-bold mb-1">Return Reasons (one per line)</label>
        <textarea
          rows={4}
          disabled={!canEdit}
          value={returnReasonsText}
          onChange={(e) => setReturnReasonsText(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 font-poppins"
        />
      </div>

      <div>
        <label className="block font-bold mb-1">Non-Returnable Explanation Note</label>
        <input
          type="text"
          disabled={!canEdit}
          value={nonReturnableReasonsNote}
          onChange={(e) => setNonReturnableReasonsNote(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300"
        />
      </div>

      <div>
        <label className="block font-bold mb-1">Customer Return Instructions</label>
        <textarea
          rows={3}
          disabled={!canEdit}
          value={returnInstructions}
          onChange={(e) => setReturnInstructions(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300"
        />
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="px-6 py-2.5 bg-[#120D0B] text-[#D4AF62] font-bold rounded-xl">
            {busy ? 'Saving...' : 'Save Return Policy'}
          </button>
        </div>
      )}
    </form>
  );
};

// ---------- 6. AUDIT LOGS PANEL ----------

export const AdminAuditLogsPanel: React.FC<{ logs: AuditLogRecord[] }> = ({ logs }) => {
  const [filterType, setFilterType] = useState('all');
  const filtered = logs.filter((l) => filterType === 'all' || l.entityType === filterType);

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-cinzel font-bold text-lg text-[#120D0B]">
          Operational Audit Trail ({filtered.length})
        </h3>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white"
        >
          <option value="all">All Operations</option>
          <option value="shipment">Shipments</option>
          <option value="courier">Couriers</option>
          <option value="return">Returns</option>
          <option value="refund">Simulated Refunds</option>
          <option value="policy">Return Policy</option>
          <option value="order">Orders</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No audit logs recorded yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map((log) => (
            <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#FAF6EE] border border-[#D4AF62]/40 font-bold uppercase text-[10px]">
                    {log.entityType}
                  </span>
                  <span className="font-bold text-[#120D0B]">{log.action}</span>
                </div>
                <p className="text-gray-600">
                  Entity: <span className="font-mono">{log.entityId}</span> · Actor:{' '}
                  <span>{log.actorEmail || log.actorUid}</span>
                </p>
                {log.details && <p className="text-[11px] text-gray-500">{log.details}</p>}
              </div>
              <span className="font-mono text-[11px] text-gray-500 shrink-0">
                {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('en-IN') : 'Logged'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
