import React, { useMemo, useState } from 'react';
import {
  Shield,
  Users,
  ClipboardList,
  Store,
  Percent,
  Truck,
  Image as ImageIcon,
  Bell,
  Plus,
  Trash2,
  Edit,
  Upload,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  X,
  Mail,
  RefreshCw,
} from 'lucide-react';
import {
  AdminMemberRecord,
  AuditLogRecord,
  EmailDeliveryStatus,
  EmailLogRecord,
  HeroBannerRecord,
  NotificationRecord,
  NotificationType,
  ROLE_PERMISSION_MATRIX,
  STAFF_ROLES,
  StaffRole,
  StoreConfigRecord,
} from '../types/shippingReturns';
import {
  createCustomerNotification,
  deleteHeroBannerDoc,
  fetchExternalNotificationProviders,
  revokeStaffAccess,
  saveHeroBanner,
  saveStoreConfig,
  uploadValidatedImageToStorage,
  upsertStaffMember,
} from '../services/storeConfigService';
import { refreshResendEmailDeliveryStatus } from '../services/emailClientService';

export type AdminSettingsSection =
  | 'staff'
  | 'roles'
  | 'auditLogs'
  | 'storeSettings'
  | 'gstSettings'
  | 'shippingSettings'
  | 'banners'
  | 'notifications';

interface AdminStaffSettingsPanelsProps {
  section: AdminSettingsSection;
  staffMembers: AdminMemberRecord[];
  auditLogs: AuditLogRecord[];
  storeConfig: StoreConfigRecord;
  banners: HeroBannerRecord[];
  notifications: NotificationRecord[];
  emailLogs?: EmailLogRecord[];
  customers: any[];
  actor: { uid: string; name: string; email: string; role: string };
  canManageStaff: boolean;
  canManageSettings: boolean;
  canManageMarketing: boolean;
  onRefresh: () => Promise<void>;
}

export const AdminStaffSettingsPanels: React.FC<AdminStaffSettingsPanelsProps> = ({
  section,
  staffMembers,
  auditLogs,
  storeConfig,
  banners,
  notifications,
  emailLogs = [],
  customers,
  actor,
  canManageStaff,
  canManageSettings,
  canManageMarketing,
  onRefresh,
}) => {
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Staff Form State
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [editingStaffUid, setEditingStaffUid] = useState<string | null>(null);
  const [staffUid, setStaffUid] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRoleInput, setStaffRoleInput] = useState<Exclude<StaffRole, 'customer'>>('order_manager');
  const [staffActive, setStaffActive] = useState(true);
  const [staffNotes, setStaffNotes] = useState('');
  const [confirmRevokeStaff, setConfirmRevokeStaff] = useState<AdminMemberRecord | null>(null);

  // Audit Log Filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('All');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  // Store / GST / Shipping Config Form State
  const [cfg, setCfg] = useState<Omit<StoreConfigRecord, 'updatedAt'>>({ ...storeConfig });
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);

  // Banners State
  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerBadge, setBannerBadge] = useState('FESTIVE COLLECTION');
  const [bannerImage, setBannerImage] = useState('');
  const [bannerCtaPrimary, setBannerCtaPrimary] = useState('Shop Now');
  const [bannerCtaSecondary, setBannerCtaSecondary] = useState('Explore Collections');
  const [bannerTargetTab, setBannerTargetTab] = useState('shop');
  const [bannerOrder, setBannerOrder] = useState(1);
  const [bannerActive, setBannerActive] = useState(true);
  const [confirmDeleteBanner, setConfirmDeleteBanner] = useState<HeroBannerRecord | null>(null);

  // Notifications State
  const [notifUserId, setNotifUserId] = useState(customers[0]?.uid || '');
  const [notifType, setNotifType] = useState<NotificationType>('account_notification');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifOrderNum, setNotifOrderNum] = useState('');
  const [providerStatus, setProviderStatus] = useState<{
    emailConfigured: boolean;
    resendConfigured?: boolean;
    resendFromConfigured?: boolean;
    smsConfigured: boolean;
    mode: string;
    note: string;
  } | null>(null);
  const [checkingEmailId, setCheckingEmailId] = useState<string | null>(null);

  React.useEffect(() => {
    setCfg({ ...storeConfig });
  }, [storeConfig]);

  React.useEffect(() => {
    if (section === 'notifications' && !providerStatus) {
      void fetchExternalNotificationProviders().then(setProviderStatus);
    }
  }, [section, providerStatus]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditEntityFilter !== 'All' && log.entityType !== auditEntityFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const hay = `${log.action} ${log.entityId} ${log.actorEmail || ''} ${log.actorUid} ${
          log.correlationId || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (auditStartDate || auditEndDate) {
        const dt = log.createdAt?.toDate ? log.createdAt.toDate() : null;
        if (!dt) return false;
        if (auditStartDate && dt < new Date(auditStartDate)) return false;
        if (auditEndDate && dt > new Date(`${auditEndDate}T23:59:59`)) return false;
      }
      return true;
    });
  }, [auditLogs, auditEntityFilter, auditSearch, auditStartDate, auditEndDate]);

  const openStaffEditor = (m?: AdminMemberRecord) => {
    if (m) {
      setEditingStaffUid(m.uid);
      setStaffUid(m.uid);
      setStaffEmail(m.email);
      setStaffName(m.fullName || '');
      setStaffRoleInput(m.role);
      setStaffActive(m.active);
      setStaffNotes(m.notes || '');
    } else {
      setEditingStaffUid(null);
      setStaffUid('');
      setStaffEmail('');
      setStaffName('');
      setStaffRoleInput('order_manager');
      setStaffActive(true);
      setStaffNotes('');
    }
    setStaffFormOpen(true);
    setErrorMsg('');
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      await upsertStaffMember({
        member: {
          uid: staffUid.trim(),
          email: staffEmail.trim(),
          fullName: staffName.trim(),
          role: staffRoleInput,
          active: staffActive,
          notes: staffNotes.trim(),
        },
        staffList: staffMembers,
        actorUid: actor.uid,
        actorEmail: actor.email,
      });
      setFeedback(`Staff profile for ${staffEmail} saved with role "${staffRoleInput}".`);
      setStaffFormOpen(false);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update staff member.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRevokeStaff = async () => {
    if (!confirmRevokeStaff) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await revokeStaffAccess({
        target: confirmRevokeStaff,
        staffList: staffMembers,
        actorUid: actor.uid,
        actorEmail: actor.email,
      });
      setFeedback(`Revoked staff privileges for ${confirmRevokeStaff.email}.`);
      setConfirmRevokeStaff(null);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Revocation failed.');
      setConfirmRevokeStaff(null);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveStoreSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cfg.maintenanceMode && !storeConfig.maintenanceMode && !confirmMaintenance) {
      setConfirmMaintenance(true);
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      await saveStoreConfig({
        nextConfig: cfg,
        previousConfig: storeConfig,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
      });
      setConfirmMaintenance(false);
      setFeedback('Store configuration persisted and audited.');
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save configuration.');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadBannerOrLogo = async (
    file: File | undefined,
    target: 'banner' | 'logo'
  ) => {
    if (!file) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const url = await uploadValidatedImageToStorage(file, 'banners');
      if (target === 'banner') {
        setBannerImage(url);
      } else {
        setCfg((prev) => ({ ...prev, logoUrl: url }));
      }
      setFeedback('Image uploaded to Firebase Storage successfully.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const openBannerEditor = (b?: HeroBannerRecord) => {
    if (b) {
      setEditingBannerId(b.id);
      setBannerTitle(b.title);
      setBannerSubtitle(b.subtitle);
      setBannerBadge(b.badge);
      setBannerImage(b.image);
      setBannerCtaPrimary(b.ctaPrimary);
      setBannerCtaSecondary(b.ctaSecondary);
      setBannerTargetTab(b.targetTab);
      setBannerOrder(b.displayOrder);
      setBannerActive(b.active);
    } else {
      setEditingBannerId(null);
      setBannerTitle('');
      setBannerSubtitle('');
      setBannerBadge('NEW SEASON');
      setBannerImage('');
      setBannerCtaPrimary('Shop Now');
      setBannerCtaSecondary('Explore');
      setBannerTargetTab('shop');
      setBannerOrder(banners.length + 1);
      setBannerActive(true);
    }
    setBannerFormOpen(true);
    setErrorMsg('');
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      await saveHeroBanner({
        banner: {
          id: editingBannerId || '',
          title: bannerTitle,
          subtitle: bannerSubtitle,
          badge: bannerBadge,
          image: bannerImage,
          ctaPrimary: bannerCtaPrimary,
          ctaSecondary: bannerCtaSecondary,
          targetTab: bannerTargetTab,
          displayOrder: bannerOrder,
          active: bannerActive,
        },
        isNew: !editingBannerId,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
      });
      setFeedback(`Hero banner "${bannerTitle}" saved.`);
      setBannerFormOpen(false);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save banner.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifUserId.trim()) {
      setErrorMsg('Target customer UID is required.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      await createCustomerNotification({
        userId: notifUserId.trim(),
        type: notifType,
        title: notifTitle,
        message: notifMessage,
        orderNumber: notifOrderNum,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
      });
      setFeedback('In-app notification delivered to customer account.');
      setNotifTitle('');
      setNotifMessage('');
      setNotifOrderNum('');
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to dispatch notification.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {confirmRevokeStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-cinzel font-bold text-base">Revoke Staff Privileges</h4>
            </div>
            <p className="text-gray-600">
              Revoke admin access for <strong>{confirmRevokeStaff.email}</strong> ({confirmRevokeStaff.role})? Last-active Super Admin protection applies automatically.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRevokeStaff(null)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleConfirmRevokeStaff}
                disabled={busy}
                className="px-4 py-2 bg-rose-700 text-white font-bold rounded-lg"
              >
                {busy ? 'Revoking...' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmMaintenance && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-cinzel font-bold text-base">Enable Store Maintenance Mode?</h4>
            </div>
            <p className="text-gray-600">
              Enabling Maintenance Mode replaces the public customer storefront with your maintenance notice. Staff accounts retain access.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmMaintenance(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveStoreSettings()}
                disabled={busy}
                className="px-4 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg"
              >
                Confirm Maintenance Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteBanner && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <h4 className="font-cinzel font-bold text-base text-rose-700">Delete Hero Banner</h4>
            <p className="text-gray-600">
              Delete banner <strong>"{confirmDeleteBanner.title}"</strong> from the homepage slider?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteBanner(null)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await deleteHeroBannerDoc(
                      confirmDeleteBanner.id,
                      actor.uid,
                      actor.role,
                      actor.email
                    );
                    setFeedback(`Deleted banner "${confirmDeleteBanner.title}".`);
                    setConfirmDeleteBanner(null);
                    await onRefresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-2 bg-rose-700 text-white font-bold rounded-lg"
              >
                Delete Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback('')} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. STAFF MANAGEMENT */}
      {section === 'staff' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-cinzel font-bold text-base text-[#120D0B] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#65102F]" /> Staff Accounts & Role Assignment ({staffMembers.length})
              </h3>
              <p className="text-[11px] text-gray-500">
                Super Admin protected. Last active Super Admin cannot be removed, demoted, or deactivated.
              </p>
            </div>
            {canManageStaff && (
              <button
                onClick={() => openStaffEditor()}
                className="px-3.5 py-2 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Staff Member
              </button>
            )}
          </div>

          {staffFormOpen && (
            <form onSubmit={handleSaveStaff} className="bg-white border-2 border-[#D4AF62] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-cinzel font-bold text-sm">
                  {editingStaffUid ? `Edit Staff: ${staffEmail}` : 'Authorize New Staff Account'}
                </h4>
                <button type="button" onClick={() => setStaffFormOpen(false)} className="text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Firebase User UID</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingStaffUid)}
                    value={staffUid}
                    onChange={(e) => setStaffUid(e.target.value)}
                    placeholder="Paste Firebase Auth UID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Staff Email</label>
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Assigned Role</label>
                  <select
                    value={staffRoleInput}
                    onChange={(e) => setStaffRoleInput(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white font-semibold"
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_PERMISSION_MATRIX[r].label} ({r})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Notes</label>
                  <input
                    type="text"
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={staffActive} onChange={(e) => setStaffActive(e.target.checked)} />
                  Staff Access Active
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setStaffFormOpen(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
                  {busy ? 'Saving...' : 'Save Staff Member'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Staff Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">UID</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffMembers.map((m) => (
                  <tr key={m.uid} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold text-[#120D0B]">{m.fullName || 'Staff Member'}</td>
                    <td className="p-3">{m.email}</td>
                    <td className="p-3 font-mono text-[10px] text-gray-500">{m.uid}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded font-semibold">
                        {ROLE_PERMISSION_MATRIX[m.role]?.label || m.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          m.active
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {m.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {canManageStaff && (
                        <>
                          <button
                            onClick={() => openStaffEditor(m)}
                            className="px-2.5 py-1 border border-gray-300 rounded font-semibold hover:bg-gray-100"
                          >
                            Edit Role
                          </button>
                          <button
                            onClick={() => setConfirmRevokeStaff(m)}
                            className="px-2.5 py-1 border border-rose-200 text-rose-700 rounded font-semibold hover:bg-rose-50"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. ROLES & PERMISSIONS MATRIX */}
      {section === 'roles' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-cinzel font-bold text-base text-[#120D0B] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#65102F]" /> Role-Based Access Control (RBAC) Matrix
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Enforced across UI modules, API authorization endpoints, and Firestore security rules.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STAFF_ROLES.map((roleKey) => {
              const info = ROLE_PERMISSION_MATRIX[roleKey];
              return (
                <div key={roleKey} className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span className="font-cinzel font-bold text-sm text-[#120D0B]">{info.label}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white border border-gray-200 text-[#65102F]">
                      {roleKey}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">{info.description}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {info.capabilities.slice(0, 10).map((sec) => (
                      <span
                        key={sec}
                        className="px-2 py-0.5 rounded bg-white border border-gray-200 text-[10px] font-mono text-gray-700"
                      >
                        {sec}
                      </span>
                    ))}
                    {info.capabilities.length > 10 && (
                      <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-[10px] font-mono text-gray-500">
                        +{info.capabilities.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. AUDIT LOGS WITH BEFORE/AFTER DIFF */}
      {section === 'auditLogs' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-cinzel font-bold text-base text-[#120D0B] flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#65102F]" /> Immutable System Audit Logs ({filteredAuditLogs.length})
              </h3>
              <p className="text-[11px] text-gray-500">
                Sensitive fields (passwords, tokens, CVVs, UPI PINs, keys) are automatically redacted before persistence.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Actor, action, entity..."
                  className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg"
                />
              </div>
              <select
                value={auditEntityFilter}
                onChange={(e) => setAuditEntityFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white"
              >
                <option value="All">All Entities</option>
                {[
                  'order',
                  'shipment',
                  'return',
                  'refund',
                  'product',
                  'variant',
                  'category',
                  'coupon',
                  'staff',
                  'storeSettings',
                  'banner',
                  'notification',
                  'email',
                  'metalRate',
                ].map((et) => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </select>
              <input
                type="date"
                value={auditStartDate}
                onChange={(e) => setAuditStartDate(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg font-mono"
              />
              <input
                type="date"
                value={auditEndDate}
                onChange={(e) => setAuditEndDate(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
            {filteredAuditLogs.length === 0 ? (
              <p className="p-8 text-center text-gray-500">No audit entries match your filters.</p>
            ) : (
              filteredAuditLogs.map((log) => {
                const expanded = expandedAuditId === log.id;
                const hasDiff = Boolean(log.beforeValues || log.afterValues);
                return (
                  <div key={log.id} className="p-3.5 bg-white hover:bg-gray-50/70 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-[10px] uppercase">
                            {log.entityType}
                          </span>
                          <span className="font-bold text-[#120D0B]">{log.action}</span>
                          {log.correlationId && (
                            <span className="font-mono text-[10px] text-gray-400">#{log.correlationId}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-600">
                          Entity: <span className="font-mono">{log.entityId}</span> · Actor:{' '}
                          <strong>{log.actorEmail || log.actorUid}</strong>
                          {log.actorRole ? ` (${log.actorRole})` : ''}
                          {log.reason ? ` · Reason: ${log.reason}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-gray-500">
                          {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('en-IN') : 'Logged'}
                        </span>
                        {hasDiff && (
                          <button
                            onClick={() => setExpandedAuditId(expanded ? null : log.id)}
                            className="px-2.5 py-1 border border-gray-300 rounded font-semibold flex items-center gap-1 hover:bg-gray-100"
                          >
                            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            <span>Diff</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {expanded && hasDiff && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-200 overflow-x-auto">
                          <p className="text-[10px] font-bold text-rose-800 uppercase mb-1">Before Values</p>
                          <pre className="text-[11px] font-mono text-gray-700 whitespace-pre-wrap">
                            {log.beforeValues ? JSON.stringify(log.beforeValues, null, 2) : 'null'}
                          </pre>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200 overflow-x-auto">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase mb-1">After Values</p>
                          <pre className="text-[11px] font-mono text-gray-700 whitespace-pre-wrap">
                            {log.afterValues ? JSON.stringify(log.afterValues, null, 2) : 'null'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. STORE SETTINGS / GST SETTINGS / SHIPPING SETTINGS */}
      {['storeSettings', 'gstSettings', 'shippingSettings'].includes(section) && (
        <form onSubmit={handleSaveStoreSettings} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="border-b pb-3 flex items-center justify-between">
            <h3 className="font-cinzel font-bold text-base text-[#120D0B] flex items-center gap-2">
              {section === 'storeSettings' && <Store className="w-4 h-4 text-[#65102F]" />}
              {section === 'gstSettings' && <Percent className="w-4 h-4 text-[#65102F]" />}
              {section === 'shippingSettings' && <Truck className="w-4 h-4 text-[#65102F]" />}
              <span>
                {section === 'storeSettings' && 'Store Identity, Announcement & Maintenance Configuration'}
                {section === 'gstSettings' && 'GST & Tax Slab Configuration'}
                {section === 'shippingSettings' && 'Shipping Rules, Stock Reservation & Low-Stock Thresholds'}
              </span>
            </h3>
            {!canManageSettings && (
              <span className="text-[11px] text-amber-700 font-semibold">Read-only (Super Admin required)</span>
            )}
          </div>

          {section === 'storeSettings' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Store Name</label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={cfg.storeName}
                  onChange={(e) => setCfg({ ...cfg, storeName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Tagline</label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={cfg.tagline}
                  onChange={(e) => setCfg({ ...cfg, tagline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  disabled={!canManageSettings}
                  value={cfg.contactEmail}
                  onChange={(e) => setCfg({ ...cfg, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Helpline Phone</label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={cfg.contactPhone}
                  onChange={(e) => setCfg({ ...cfg, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Business Address</label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={cfg.businessAddress}
                  onChange={(e) => setCfg({ ...cfg, businessAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Business Registration / GSTIN (Optional)</label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={cfg.businessRegistration}
                  onChange={(e) => setCfg({ ...cfg, businessRegistration: e.target.value })}
                  placeholder="Leave blank if unverified demo entity"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Store Logo URL (or Upload)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    disabled={!canManageSettings}
                    value={cfg.logoUrl}
                    onChange={(e) => setCfg({ ...cfg, logoUrl: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  {canManageSettings && (
                    <label className="px-3 py-2 bg-gray-100 border rounded-lg cursor-pointer flex items-center gap-1 font-semibold">
                      <Upload className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => void handleUploadBannerOrLogo(e.target.files?.[0], 'logo')}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Announcement Bar Text (English)</label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={cfg.announcementTextEn}
                  onChange={(e) => setCfg({ ...cfg, announcementTextEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Announcement Bar Text (Telugu)</label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={cfg.announcementTextTe}
                  onChange={(e) => setCfg({ ...cfg, announcementTextTe: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  disabled={!canManageSettings}
                  checked={cfg.announcementActive}
                  onChange={(e) => setCfg({ ...cfg, announcementActive: e.target.checked })}
                />
                Show Storefront Announcement Bar
              </label>
              <label className="flex items-center gap-2 font-semibold text-rose-800">
                <input
                  type="checkbox"
                  disabled={!canManageSettings}
                  checked={cfg.maintenanceMode}
                  onChange={(e) => setCfg({ ...cfg, maintenanceMode: e.target.checked })}
                />
                Enable Store Maintenance Mode
              </label>
              {cfg.maintenanceMode && (
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Maintenance Message</label>
                  <input
                    type="text"
                    disabled={!canManageSettings}
                    value={cfg.maintenanceMessage}
                    onChange={(e) => setCfg({ ...cfg, maintenanceMessage: e.target.value })}
                    className="w-full px-3 py-2 border border-rose-300 rounded-lg"
                  />
                </div>
              )}
            </div>
          )}

          {section === 'gstSettings' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold mb-1">Jewellery GST Slab (%)</label>
                <input
                  type="number"
                  min={0}
                  max={28}
                  step="0.5"
                  disabled={!canManageSettings}
                  value={cfg.jewelleryGstPercent}
                  onChange={(e) => setCfg({ ...cfg, jewelleryGstPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Sarees & Apparel GST Slab (%)</label>
                <input
                  type="number"
                  min={0}
                  max={28}
                  step="0.5"
                  disabled={!canManageSettings}
                  value={cfg.sareeGstPercent}
                  onChange={(e) => setCfg({ ...cfg, sareeGstPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Default Fallback GST (%)</label>
                <input
                  type="number"
                  min={0}
                  max={28}
                  step="0.5"
                  disabled={!canManageSettings}
                  value={cfg.gstRatePercent}
                  onChange={(e) => setCfg({ ...cfg, gstRatePercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>
          )}

          {section === 'shippingSettings' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Free Shipping Threshold (INR)</label>
                <input
                  type="number"
                  min={0}
                  disabled={!canManageSettings}
                  value={cfg.freeShippingThreshold}
                  onChange={(e) => setCfg({ ...cfg, freeShippingThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Standard Flat Shipping Fee (INR)</label>
                <input
                  type="number"
                  min={0}
                  disabled={!canManageSettings}
                  value={cfg.flatShippingFee}
                  onChange={(e) => setCfg({ ...cfg, flatShippingFee: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Checkout Stock Reservation Expiry (Minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  disabled={!canManageSettings}
                  value={cfg.reservationExpiryMinutes}
                  onChange={(e) => setCfg({ ...cfg, reservationExpiryMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Low-Stock Alert Threshold (Units)</label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  disabled={!canManageSettings}
                  value={cfg.lowStockThreshold}
                  onChange={(e) => setCfg({ ...cfg, lowStockThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>
          )}

          {canManageSettings && (
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold hover:bg-[#D4AF62] hover:text-[#120D0B]"
              >
                {busy ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* 5. HOMEPAGE BANNERS */}
      {section === 'banners' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-cinzel font-bold text-base text-[#120D0B] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#65102F]" /> Homepage Hero Banners ({banners.length})
              </h3>
              <p className="text-[11px] text-gray-500">
                Supports Firebase Storage upload (JPG/PNG/WEBP &le; 2 MB) or HTTPS image URLs.
              </p>
            </div>
            {canManageMarketing && (
              <button
                onClick={() => openBannerEditor()}
                className="px-3.5 py-2 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Banner
              </button>
            )}
          </div>

          {bannerFormOpen && (
            <form onSubmit={handleSaveBanner} className="bg-white border-2 border-[#D4AF62] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-cinzel font-bold text-sm">
                  {editingBannerId ? `Edit Banner` : 'Create Homepage Banner'}
                </h4>
                <button type="button" onClick={() => setBannerFormOpen(false)} className="text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Headline Title</label>
                  <input
                    type="text"
                    required
                    value={bannerTitle}
                    onChange={(e) => setBannerTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={bannerBadge}
                    onChange={(e) => setBannerBadge(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Subtitle</label>
                  <input
                    type="text"
                    required
                    value={bannerSubtitle}
                    onChange={(e) => setBannerSubtitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Banner Image URL (or upload)</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      required
                      value={bannerImage}
                      onChange={(e) => setBannerImage(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <label className="px-3 py-2 bg-gray-100 border rounded-lg cursor-pointer flex items-center gap-1 font-semibold shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => void handleUploadBannerOrLogo(e.target.files?.[0], 'banner')}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Primary CTA Label</label>
                  <input
                    type="text"
                    value={bannerCtaPrimary}
                    onChange={(e) => setBannerCtaPrimary(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Target Section</label>
                  <select
                    value={bannerTargetTab}
                    onChange={(e) => setBannerTargetTab(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="shop">Shop All</option>
                    <option value="jewellery">Jewellery</option>
                    <option value="sarees">Sarees</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    min={1}
                    value={bannerOrder}
                    onChange={(e) => setBannerOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <label className="flex items-center gap-2 font-semibold pt-5">
                  <input type="checkbox" checked={bannerActive} onChange={(e) => setBannerActive(e.target.checked)} />
                  Banner Active on Homepage
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setBannerFormOpen(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
                  {busy ? 'Saving...' : 'Save Banner'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {banners.map((b) => (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                {b.image && (
                  <img src={b.image} alt={b.title} className="w-full h-36 object-cover border-b border-gray-200" />
                )}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-gray-500">Order #{b.displayOrder}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {b.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h4 className="font-cinzel font-bold text-sm text-[#120D0B] mt-1">{b.title}</h4>
                    <p className="text-[11px] text-gray-600 line-clamp-2">{b.subtitle}</p>
                  </div>
                  {canManageMarketing && (
                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => openBannerEditor(b)}
                        className="px-2.5 py-1 border border-gray-300 rounded font-semibold hover:bg-gray-100 inline-flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteBanner(b)}
                        className="px-2.5 py-1 border border-rose-200 text-rose-700 rounded font-semibold hover:bg-rose-50 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. NOTIFICATIONS & TRANSACTIONAL EMAIL CENTER */}
      {section === 'notifications' && (
        <div className="space-y-4">
          <div
            className={`p-4 rounded-xl border flex items-start gap-2.5 ${
              providerStatus?.resendConfigured
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                Resend Transactional Email Status: {providerStatus?.mode || 'checking...'}
              </p>
              <p className="text-[11px]">
                {providerStatus?.note ||
                  'Checking server-side RESEND_API_KEY and RESEND_FROM_EMAIL configuration...'}
              </p>
              <p className="text-[11px] opacity-80">
                Note: Accepted/queued emails are recorded as <span className="font-mono font-bold">sent_to_provider</span> and only marked{' '}
                <span className="font-mono font-bold">delivered</span> when Resend delivery status confirms{' '}
                <span className="font-mono">last_event: delivered</span>.
              </p>
            </div>
          </div>

          {/* Resend Transactional Email Logs */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-cinzel font-bold text-base text-[#120D0B] flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#65102F]" /> Resend Transactional Email Delivery Logs ({emailLogs.length})
                </h3>
                <p className="text-[11px] text-gray-500">
                  Tracks request IDs, Resend email IDs, idempotency keys, and honest provider vs confirmed delivery status without storing secrets.
                </p>
              </div>
            </div>

            {emailLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No transactional email attempts recorded yet.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Template & Order</th>
                      <th className="p-3">Recipient</th>
                      <th className="p-3">Request / Resend ID</th>
                      <th className="p-3">Delivery Status</th>
                      <th className="p-3">Details</th>
                      <th className="p-3 text-right">Verify Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {emailLogs.slice(0, 50).map((log) => {
                      const badgeMap: Record<EmailDeliveryStatus, string> = {
                        delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        sent_to_provider: 'bg-sky-50 text-sky-800 border-sky-200',
                        queued: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                        delivery_delayed: 'bg-amber-50 text-amber-800 border-amber-200',
                        skipped_unconfigured: 'bg-gray-100 text-gray-700 border-gray-300',
                        bounced: 'bg-rose-50 text-rose-800 border-rose-200',
                        complained: 'bg-rose-50 text-rose-800 border-rose-200',
                        failed: 'bg-rose-50 text-rose-800 border-rose-200',
                      };
                      return (
                        <tr key={log.id} className="hover:bg-gray-50 align-top">
                          <td className="p-3">
                            <p className="font-bold text-[#120D0B]">{log.templateType}</p>
                            {log.orderNumber && (
                              <p className="font-mono text-[10px] text-[#65102F]">{log.orderNumber}</p>
                            )}
                          </td>
                          <td className="p-3 text-gray-700">{log.recipientEmail}</td>
                          <td className="p-3 font-mono text-[10px] space-y-0.5">
                            <p className="text-gray-800">Req: {log.requestId}</p>
                            {log.resendEmailId && (
                              <p className="text-gray-600">Resend: {log.resendEmailId}</p>
                            )}
                            <p className="text-gray-400 truncate max-w-[190px]" title={log.idempotencyKey}>
                              Key: {log.idempotencyKey}
                            </p>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                                badgeMap[log.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                              }`}
                            >
                              {log.status}
                            </span>
                            <p className="text-[10px] font-mono text-gray-500 mt-1">
                              Event: {log.lastEvent}
                            </p>
                          </td>
                          <td className="p-3 text-[11px] text-gray-600 max-w-xs">
                            <p>{log.statusNote}</p>
                            {log.errorMessage && (
                              <p className="text-rose-700 font-semibold mt-0.5">
                                {log.errorCode ? `[${log.errorCode}] ` : ''}
                                {log.errorMessage}
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {log.resendEmailId ? (
                              <button
                                type="button"
                                disabled={checkingEmailId === log.id}
                                onClick={async () => {
                                  setCheckingEmailId(log.id);
                                  setErrorMsg('');
                                  try {
                                    const updated = await refreshResendEmailDeliveryStatus({
                                      log,
                                      actorUid: actor.uid,
                                      actorEmail: actor.email,
                                    });
                                    setFeedback(
                                      `Resend status for ${updated.resendEmailId}: ${updated.status} (${updated.lastEvent}).`
                                    );
                                    await onRefresh();
                                  } catch (err: any) {
                                    setErrorMsg(err?.message || 'Unable to verify delivery status from Resend.');
                                  } finally {
                                    setCheckingEmailId(null);
                                  }
                                }}
                                className="px-2.5 py-1 border border-gray-300 rounded-lg font-semibold hover:bg-gray-100 inline-flex items-center gap-1"
                              >
                                <RefreshCw
                                  className={`w-3 h-3 ${checkingEmailId === log.id ? 'animate-spin' : ''}`}
                                />
                                <span>Check Status</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-400">No provider ID</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form onSubmit={handleSendNotification} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-cinzel font-bold text-base text-[#120D0B] flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#65102F]" /> Send Customer In-App Notification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold mb-1">Recipient Customer UID</label>
                <select
                  value={notifUserId}
                  onChange={(e) => setNotifUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.uid} value={c.uid}>
                      {c.fullName || c.email} ({c.uid.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Notification Type</label>
                <select
                  value={notifType}
                  onChange={(e) => setNotifType(e.target.value as NotificationType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="account_notification">Account Notification</option>
                  <option value="order_status_update">Order Status Update</option>
                  <option value="shipment_update">Shipment Update</option>
                  <option value="return_update">Return Update</option>
                  <option value="refund_update">Refund Update</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Order Number (Optional)</label>
                <input
                  type="text"
                  value={notifOrderNum}
                  onChange={(e) => setNotifOrderNum(e.target.value)}
                  placeholder="SDA-123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-semibold mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="Special Bridal Preview or Order Dispatch Update"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-semibold mb-1">Message</label>
                <textarea
                  rows={2}
                  required
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg"
              >
                {busy ? 'Sending...' : 'Persist In-App Notification'}
              </button>
            </div>
          </form>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h4 className="font-cinzel font-bold text-sm text-[#120D0B]">
              Recent Customer Notifications ({notifications.length})
            </h4>
            {notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No customer notifications logged yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.slice(0, 30).map((n) => (
                  <div key={n.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#120D0B]">{n.title}</p>
                      <p className="text-gray-600">{n.message}</p>
                      <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                        To UID: {n.userId} · Type: {n.type} {n.orderNumber ? `· ${n.orderNumber}` : ''}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        n.read ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {n.read ? 'Read' : 'Unread'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
