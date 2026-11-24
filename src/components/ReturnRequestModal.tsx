import React, { useMemo, useState } from 'react';
import { X, RotateCcw, AlertCircle, CheckCircle2, Info, Plus, Trash2 } from 'lucide-react';
import { OrderRecord, ReturnPolicyConfig, ReturnRequestRecord } from '../types/shippingReturns';
import { checkReturnEligibility, submitReturnRequest } from '../services/shippingReturnsService';

interface ReturnRequestModalProps {
  order: OrderRecord;
  policy: ReturnPolicyConfig;
  existingReturns: ReturnRequestRecord[];
  actorUid: string;
  actorEmail?: string;
  onClose: () => void;
  onSuccess: (created: ReturnRequestRecord) => void;
}

export const ReturnRequestModal: React.FC<ReturnRequestModalProps> = ({
  order,
  policy,
  existingReturns,
  actorUid,
  actorEmail,
  onClose,
  onSuccess,
}) => {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const item of order.items) {
      const key = `${item.productId}::${item.variantSku || 'STD'}`;
      const isNonReturnable = policy.nonReturnableProductIds.includes(item.productId);
      const isCategoryOk =
        policy.eligibleCategories.length === 0 || policy.eligibleCategories.includes(item.category);
      initial[key] = !isNonReturnable && isCategoryOk ? 1 : 0;
    }
    return initial;
  });

  const [reason, setReason] = useState(policy.returnReasons[0] || 'Damaged or tampered parcel on arrival');
  const [description, setDescription] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedItems = useMemo(() => {
    return order.items
      .map((item) => {
        const key = `${item.productId}::${item.variantSku || 'STD'}`;
        return {
          productId: item.productId,
          variantSku: item.variantSku || 'STD',
          quantity: quantities[key] || 0,
        };
      })
      .filter((s) => s.quantity > 0);
  }, [order.items, quantities]);

  const eligibilityPreview = useMemo(() => {
    return checkReturnEligibility({
      order,
      policy,
      existingReturns,
      selectedItems,
    });
  }, [order, policy, existingReturns, selectedItems]);

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (imageUrls.length >= 5) return;
    setImageUrls([...imageUrls, trimmed]);
    setImageUrlInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!eligibilityPreview.eligible) {
      setErrorMsg(eligibilityPreview.reason || 'Selected items are not eligible for return.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await submitReturnRequest({
        order,
        policy,
        existingReturns,
        selectedItems,
        reason,
        description,
        imageUrls,
        actorUid,
        actorEmail,
      });
      onSuccess(created);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not submit return request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-[#D4AF62]/40 my-8">
        <div className="bg-[#120D0B] text-[#F8F1E4] px-6 py-4 flex items-center justify-between border-b border-[#D4AF62]/30">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-5 h-5 text-[#D4AF62]" />
            <div>
              <h3 className="font-cinzel text-lg font-bold">Request Return & Simulated Refund</h3>
              <p className="text-[11px] text-[#D4AF62] font-mono">Order #{order.orderNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
          {/* Policy Summary */}
          <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#D4AF62]/40 space-y-1.5 text-gray-700">
            <p className="font-bold text-[#120D0B] flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#65102F]" />
              Store Return Policy ({policy.returnWindowDays}-Day Demo Window)
            </p>
            <p>{policy.returnInstructions}</p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Items Selection */}
          <div className="space-y-2.5">
            <label className="block font-bold text-[#120D0B] text-sm font-cinzel">
              1. Select Item(s) to Return
            </label>
            <div className="space-y-2">
              {order.items.map((item) => {
                const key = `${item.productId}::${item.variantSku || 'STD'}`;
                const isNonReturnable = policy.nonReturnableProductIds.includes(item.productId);
                const isCatEligible =
                  policy.eligibleCategories.length === 0 || policy.eligibleCategories.includes(item.category);
                const qty = quantities[key] || 0;

                return (
                  <div
                    key={key}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isNonReturnable || !isCatEligible
                        ? 'bg-gray-50 border-gray-200 opacity-75'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-[#120D0B]">{item.name}</p>
                      <p className="text-[11px] text-gray-500">
                        SKU: {item.variantSku || 'STD'} | Category: {item.category} | Paid Unit: ₹
                        {item.unitPrice.toLocaleString('en-IN')} (Ordered Qty: {item.quantity})
                      </p>
                      {(isNonReturnable || !isCatEligible) && (
                        <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                          Non-returnable under store policy
                        </span>
                      )}
                    </div>

                    {!isNonReturnable && isCatEligible && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-gray-500">Return Qty:</span>
                        <select
                          value={qty}
                          onChange={(e) =>
                            setQuantities({ ...quantities, [key]: Number(e.target.value) })
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white font-mono font-bold"
                        >
                          {Array.from({ length: item.quantity + 1 }, (_, n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reason & Description */}
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-[#120D0B] mb-1">2. Return Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#D4AF62]"
              >
                {policy.returnReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#120D0B] mb-1">
                3. Issue Description (for Quality Inspection Team)
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue with packaging, sizing, or finish..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#D4AF62]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#120D0B] mb-1">
                4. Evidence Image URLs (Optional)
              </label>
              <p className="text-[11px] text-gray-500 mb-2">
                Firebase Storage binary upload is not enabled in this demo; paste reference image URLs if needed.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://example.com/item-photo.jpg"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {imageUrls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg border">
                      <span className="truncate max-w-md font-mono text-[11px]">{url}</span>
                      <button
                        type="button"
                        onClick={() => setImageUrls(imageUrls.filter((_, i) => i !== idx))}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Eligibility & Refund Preview */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              eligibilityPreview.eligible
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {eligibilityPreview.eligible ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <div>
                <p className="font-bold">
                  {eligibilityPreview.eligible ? 'Eligible for Return Review' : 'Eligibility Check'}
                </p>
                <p className="text-[11px]">
                  {eligibilityPreview.eligible
                    ? 'Estimated Simulated Refund (pending inspection & admin approval):'
                    : eligibilityPreview.reason}
                </p>
              </div>
            </div>
            {eligibilityPreview.eligible && (
              <span className="font-mono text-lg font-bold text-[#65102F]">
                ₹{eligibilityPreview.requestedRefundAmount.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !eligibilityPreview.eligible}
              className="px-6 py-2.5 rounded-xl bg-[#120D0B] text-[#F8F1E4] font-bold hover:bg-[#D4AF62] hover:text-[#120D0B] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Return Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
