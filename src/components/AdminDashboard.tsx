import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Package,
  Grid,
  Gem,
  Sparkles,
  Boxes,
  Coins,
  ShoppingBag,
  CreditCard,
  FileText,
  Ticket,
  Users,
  Truck,
  MapPin,
  RotateCcw,
  RefreshCcw,
  UserCog,
  ShieldCheck,
  ClipboardList,
  Store,
  Percent,
  Settings,
  Image as ImageIcon,
  Bell,
  RefreshCw,
  Menu,
  X,
  Lock,
  AlertTriangle,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Product } from '../data/mockData';
import {
  AdminMemberRecord,
  AuditLogRecord,
  CouponRecord,
  CourierProvider,
  EmailLogRecord,
  HeroBannerRecord,
  NotificationRecord,
  OrderRecord,
  RefundRecord,
  ReturnPolicyConfig,
  ReturnRequestRecord,
  ROLE_PERMISSION_MATRIX,
  ShipmentRecord,
  StoreConfigRecord,
} from '../types/shippingReturns';
import {
  DEFAULT_RETURN_POLICY,
  fetchAllOrders,
  fetchAllRefunds,
  fetchAllReturns,
  fetchAllShipments,
  fetchAuditLogs,
  fetchCouriers,
  fetchPaymentsForAdmin,
  fetchReturnPolicy,
} from '../services/shippingReturnsService';
import { fetchEmailLogsForAdmin } from '../services/emailClientService';
import {
  CategoryDoc,
  DEFAULT_STORE_CONFIG,
  fetchAllCustomersForAdmin,
  fetchAllInvoicesForAdmin,
  fetchAllNotifications,
  fetchCategories,
  fetchCoupons,
  fetchHeroBanners,
  fetchMetalRates,
  fetchProductsAndVariants,
  fetchStaffMembers,
  fetchStoreConfig,
  MetalRateDoc,
  ProductVariantDoc,
} from '../services/storeConfigService';
import { computeBusinessAnalytics } from '../services/analyticsReportsService';
import { AdminAnalyticsPanel } from './AdminAnalyticsPanel';
import { AdminReportsPanel } from './AdminReportsPanel';
import { AdminCataloguePanels, CatalogueSection } from './AdminCataloguePanels';
import { AdminSalesPanels, SalesSection } from './AdminSalesPanels';
import { AdminSettingsSection, AdminStaffSettingsPanels } from './AdminStaffSettingsPanels';
import {
  AdminCourierPanel,
  AdminRefundsPanel,
  AdminReturnPolicyPanel,
  AdminReturnsPanel,
  AdminShippingPanel,
} from './AdminShippingReturnsPanels';

interface AdminDashboardProps {
  onClose: () => void;
}

export type AdminNavId =
  | 'dashboard'
  | 'analytics'
  | 'reports'
  | 'categories'
  | 'products'
  | 'variants'
  | 'jewellery'
  | 'sarees'
  | 'inventory'
  | 'metalRates'
  | 'orders'
  | 'payments'
  | 'invoices'
  | 'coupons'
  | 'customers'
  | 'shipping'
  | 'couriers'
  | 'returns'
  | 'refunds'
  | 'staff'
  | 'roles'
  | 'auditLogs'
  | 'storeSettings'
  | 'gstSettings'
  | 'shippingSettings'
  | 'policy'
  | 'banners'
  | 'notifications';

interface NavGroup {
  group: string;
  items: Array<{
    id: AdminNavId;
    label: string;
    icon: React.FC<{ className?: string }>;
    requiredCap?: string;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'analytics', label: 'Sales Analytics', icon: TrendingUp, requiredCap: 'analytics' },
      { id: 'reports', label: 'Business Reports', icon: FileSpreadsheet, requiredCap: 'reports' },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { id: 'categories', label: 'Categories', icon: Layers, requiredCap: 'catalogue' },
      { id: 'products', label: 'Products', icon: Package, requiredCap: 'catalogue' },
      { id: 'variants', label: 'Product Variants', icon: Grid, requiredCap: 'catalogue' },
      { id: 'jewellery', label: 'Jewellery', icon: Gem, requiredCap: 'catalogue' },
      { id: 'sarees', label: 'Sarees', icon: Sparkles, requiredCap: 'catalogue' },
      { id: 'inventory', label: 'Inventory', icon: Boxes, requiredCap: 'inventory' },
      { id: 'metalRates', label: 'Gold and Silver Rates', icon: Coins, requiredCap: 'metal_rates' },
    ],
  },
  {
    group: 'Sales',
    items: [
      { id: 'orders', label: 'Orders', icon: ShoppingBag, requiredCap: 'orders' },
      { id: 'payments', label: 'Payments', icon: CreditCard, requiredCap: 'payments' },
      { id: 'invoices', label: 'Invoices', icon: FileText, requiredCap: 'invoices' },
      { id: 'coupons', label: 'Coupons', icon: Ticket, requiredCap: 'coupons' },
      { id: 'customers', label: 'Customers', icon: Users, requiredCap: 'customers' },
    ],
  },
  {
    group: 'Fulfilment',
    items: [
      { id: 'shipping', label: 'Shipments', icon: Truck, requiredCap: 'shipping' },
      { id: 'couriers', label: 'Courier Configuration', icon: MapPin, requiredCap: 'couriers' },
      { id: 'returns', label: 'Returns', icon: RotateCcw, requiredCap: 'returns' },
      { id: 'refunds', label: 'Refunds', icon: RefreshCcw, requiredCap: 'refunds' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { id: 'staff', label: 'Staff Management', icon: UserCog, requiredCap: 'staff' },
      { id: 'roles', label: 'Roles and Permissions', icon: ShieldCheck, requiredCap: 'roles' },
      { id: 'auditLogs', label: 'Audit Logs', icon: ClipboardList, requiredCap: 'audit_logs' },
      { id: 'storeSettings', label: 'Store Settings', icon: Store, requiredCap: 'settings' },
      { id: 'gstSettings', label: 'GST Settings', icon: Percent, requiredCap: 'settings' },
      { id: 'shippingSettings', label: 'Shipping Settings', icon: Settings, requiredCap: 'settings' },
      { id: 'policy', label: 'Return Policy', icon: RotateCcw, requiredCap: 'settings' },
      { id: 'banners', label: 'Homepage Banners', icon: ImageIcon, requiredCap: 'banners' },
      { id: 'notifications', label: 'Notifications', icon: Bell, requiredCap: 'notifications' },
    ],
  },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const { userProfile, firebaseUser, isStaff, staffRole, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminNavId>('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const [storeConfig, setStoreConfig] = useState<StoreConfigRecord>({ ...DEFAULT_STORE_CONFIG });
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariantDoc[]>([]);
  const [metalRates, setMetalRates] = useState<MetalRateDoc[]>([]);
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [banners, setBanners] = useState<HeroBannerRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [staffMembers, setStaffMembers] = useState<AdminMemberRecord[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [couriers, setCouriers] = useState<CourierProvider[]>([]);
  const [returns, setReturns] = useState<ReturnRequestRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [policy, setPolicy] = useState<ReturnPolicyConfig>({ ...DEFAULT_RETURN_POLICY });
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const effectiveRole =
    staffRole && staffRole !== 'customer' ? staffRole : 'super_admin';
  const roleCapabilities = useMemo(() => {
    if (!isStaff || staffRole === 'customer') return [] as string[];
    return ROLE_PERMISSION_MATRIX[effectiveRole]?.capabilities || [];
  }, [isStaff, staffRole, effectiveRole]);

  const hasCap = (cap?: string) => {
    if (!cap) return true;
    if (staffRole === 'super_admin') return true;
    return roleCapabilities.includes(cap);
  };

  const loadAllOperationsData = async () => {
    if (!firebaseUser || !isStaff) return;
    setLoading(true);
    try {
      const [
        ords,
        pays,
        shps,
        cous,
        rets,
        refs,
        pol,
        logs,
        cfg,
        cats,
        prodData,
        rates,
        cpns,
        bnrs,
        notifs,
        stf,
        custs,
        invs,
        emls,
      ] = await Promise.all([
        fetchAllOrders().catch(() => []),
        fetchPaymentsForAdmin().catch(() => []),
        fetchAllShipments().catch(() => []),
        fetchCouriers().catch(() => []),
        fetchAllReturns().catch(() => []),
        fetchAllRefunds().catch(() => []),
        fetchReturnPolicy().catch(() => ({ ...DEFAULT_RETURN_POLICY })),
        fetchAuditLogs().catch(() => []),
        fetchStoreConfig().catch(() => ({ ...DEFAULT_STORE_CONFIG })),
        fetchCategories().catch(() => []),
        fetchProductsAndVariants().catch(() => ({ products: [], variants: [] })),
        fetchMetalRates().catch(() => []),
        fetchCoupons().catch(() => []),
        fetchHeroBanners().catch(() => []),
        fetchAllNotifications().catch(() => []),
        fetchStaffMembers().catch(() => []),
        fetchAllCustomersForAdmin().catch(() => []),
        fetchAllInvoicesForAdmin().catch(() => []),
        fetchEmailLogsForAdmin().catch(() => []),
      ]);

      setOrders(ords);
      setPayments(pays);
      setShipments(shps);
      setCouriers(cous);
      setReturns(rets);
      setRefunds(refs);
      setPolicy(pol);
      setAuditLogs(logs);
      setStoreConfig(cfg);
      setCategories(cats);
      setProducts(prodData.products);
      setVariants(prodData.variants);
      setMetalRates(rates);
      setCoupons(cpns);
      setBanners(bnrs);
      setNotifications(notifs);
      setStaffMembers(stf);
      setCustomers(custs);
      setInvoices(invs);
      setEmailLogs(emls);
    } catch (err) {
      console.error('Error loading admin operations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllOperationsData();
  }, [firebaseUser, isStaff]);

  if (!firebaseUser || !isStaff) {
    return (
      <div className="min-h-screen bg-[#F8F1E4] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#D4AF62]/40 shadow-xl p-8 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 text-[#65102F] flex items-center justify-center border border-rose-200">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="font-cinzel text-xl font-bold text-[#120D0B]">Staff Authorization Required</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              This operations console is restricted to verified SDA Collections administrators and operations staff.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#120D0B] text-[#F8F1E4] rounded-xl text-xs font-bold hover:bg-[#D4AF62] hover:text-[#120D0B]"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  const actor = {
    uid: firebaseUser.uid,
    name: userProfile?.fullName || firebaseUser.email || 'Admin',
    email: firebaseUser.email || '',
    role: staffRole,
  };

  const canManageCatalogue = hasCap('catalogue');
  const canManageInventory = hasCap('inventory');
  const canManageRates = hasCap('metal_rates');
  const canManageOrders = hasCap('orders');
  const canManageCoupons = hasCap('coupons');
  const canManageShipping = ['super_admin', 'delivery_manager', 'order_manager'].includes(staffRole);
  const canManageCouriers = ['super_admin', 'delivery_manager'].includes(staffRole);
  const canManageReturns = ['super_admin', 'order_manager', 'customer_support'].includes(staffRole);
  const canManageRefunds = ['super_admin', 'order_manager'].includes(staffRole);
  const canManagePolicy = staffRole === 'super_admin';
  const canManageStaff = staffRole === 'super_admin';
  const canManageSettings = staffRole === 'super_admin';
  const canManageMarketing = hasCap('banners');

  const analyticsSummary = useMemo(
    () =>
      computeBusinessAnalytics({
        orders,
        payments,
        returns,
        refunds,
        shipments,
        customers,
        variants,
        lowStockThreshold: storeConfig.lowStockThreshold,
        dateFilter: { preset: 'all_time' },
      }),
    [orders, payments, returns, refunds, shipments, customers, variants, storeConfig.lowStockThreshold]
  );

  const activeNavMeta =
    NAV_GROUPS.flatMap((g) => g.items).find((it) => it.id === activeTab) ||
    NAV_GROUPS[0].items[0];

  const handleSelectNav = (id: AdminNavId) => {
    setActiveTab(id);
    setMobileDrawerOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#120D0B] text-[#F8F1E4] border-r border-[#D4AF62]/25">
      <div className="px-5 py-5 border-b border-[#D4AF62]/20 flex items-center justify-between">
        <div>
          <p className="font-cinzel text-base font-bold tracking-wider text-[#D4AF62]">
            {storeConfig.storeName}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-[#F8F1E4]/60">
            Admin Operations Portal
          </p>
        </div>
        <button
          onClick={() => setMobileDrawerOpen(false)}
          className="lg:hidden text-[#F8F1E4]/70 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((grp) => {
          const visibleItems = grp.items.filter((item) => hasCap(item.requiredCap));
          if (visibleItems.length === 0) return null;
          return (
            <div key={grp.group} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#D4AF62]/70">
                {grp.group}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectNav(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                        active
                          ? 'bg-[#D4AF62] text-[#120D0B] font-bold'
                          : 'text-[#F8F1E4]/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-[#120D0B]' : 'text-[#D4AF62]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#D4AF62]/20 space-y-2.5 text-xs">
        <div className="px-2">
          <p className="font-semibold text-[#F8F1E4] truncate">{actor.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-[#D4AF62] font-mono">
            {staffRole}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg bg-[#211713] border border-[#D4AF62]/40 text-[#D4AF62] font-bold text-[11px] hover:bg-[#D4AF62] hover:text-[#120D0B]"
          >
            Storefront
          </button>
          <button
            onClick={() => void logout()}
            title="Sign Out"
            className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-rose-700 text-[11px]"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F4F1] flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-[260px] h-full">
            <SidebarContent />
          </div>
          <div
            className="flex-1 bg-black/60"
            onClick={() => setMobileDrawerOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-gray-300 text-[#120D0B]"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-cinzel text-base sm:text-lg font-bold text-[#120D0B]">
                {activeNavMeta.label}
              </h1>
              <p className="text-[11px] text-gray-500">
                SDA Collections Admin · Role: <span className="font-mono">{staffRole}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {storeConfig.maintenanceMode && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold">
                <AlertTriangle className="w-3 h-3" /> Maintenance Active
              </span>
            )}
            <button
              onClick={() => void loadAllOperationsData()}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-[#120D0B] hover:bg-gray-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-[#120D0B] text-[#D4AF62] text-xs font-bold hover:bg-[#D4AF62] hover:text-[#120D0B]"
            >
              View Storefront
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Orders', val: analyticsSummary.totalOrders, sub: `${analyticsSummary.confirmedOrders} active` },
                  {
                    label: 'Gross Order Value',
                    val: `₹${analyticsSummary.grossOrderValue.toLocaleString('en-IN')}`,
                    sub: 'Simulated + COD orders',
                  },
                  {
                    label: 'Net Simulated Revenue',
                    val: `₹${analyticsSummary.netSimulatedRevenue.toLocaleString('en-IN')}`,
                    sub: 'Excl. Pending COD & Refunds',
                  },
                  {
                    label: 'Pending COD Collection',
                    val: `₹${analyticsSummary.pendingCodValue.toLocaleString('en-IN')}`,
                    sub: 'Awaiting doorstep payment',
                  },
                  {
                    label: 'Low Stock SKUs',
                    val: analyticsSummary.lowStockVariantsCount,
                    sub: `Threshold <= ${storeConfig.lowStockThreshold}`,
                  },
                  {
                    label: 'Pending Shipments',
                    val: analyticsSummary.pendingShipmentsCount,
                    sub: `${shipments.length} total shipments`,
                  },
                  {
                    label: 'Pending Returns',
                    val: analyticsSummary.pendingReturnsCount,
                    sub: `${returns.length} total requests`,
                  },
                  {
                    label: 'Registered Customers',
                    val: analyticsSummary.totalRegisteredCustomers,
                    sub: `${staffMembers.filter((m) => m.active).length} active staff`,
                  },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{kpi.label}</p>
                    <p className="font-mono text-xl font-bold text-[#120D0B] mt-1.5 tabular-nums">{kpi.val}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{kpi.sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Low Stock Alerts Quick Panel */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-cinzel font-bold text-sm text-[#120D0B]">
                      Low Stock Alert Queue
                    </h3>
                    {hasCap('inventory') && (
                      <button
                        onClick={() => setActiveTab('inventory')}
                        className="text-[#65102F] font-bold inline-flex items-center gap-1 hover:underline"
                      >
                        Manage Inventory <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {variants
                      .filter((v) => v.stock <= storeConfig.lowStockThreshold)
                      .slice(0, 5)
                      .map((v) => (
                        <div key={v.sku} className="py-2 flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-[#65102F]">{v.sku}</span>
                            <span className="text-gray-500 ml-2">
                              {v.colour} / {v.size}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-rose-700">{v.stock} left</span>
                        </div>
                      ))}
                    {variants.filter((v) => v.stock <= storeConfig.lowStockThreshold).length === 0 && (
                      <p className="text-gray-500 py-4 text-center">
                        All variants are currently above the low-stock threshold ({storeConfig.lowStockThreshold} units).
                      </p>
                    )}
                  </div>
                </div>

                {/* Recent Audit Trail Preview */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-cinzel font-bold text-sm text-[#120D0B]">
                      Recent Operational Audit Activity
                    </h3>
                    {hasCap('audit_logs') && (
                      <button
                        onClick={() => setActiveTab('auditLogs')}
                        className="text-[#65102F] font-bold inline-flex items-center gap-1 hover:underline"
                      >
                        Full Audit Logs <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {auditLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#120D0B] truncate">{log.action}</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {log.actorEmail || log.actorUid} · {log.entityType}/{log.entityId}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-gray-400 shrink-0">
                          {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString('en-IN') : 'Logged'}
                        </span>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <p className="text-gray-500 py-4 text-center">No operational audit events recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ANALYTICS */}
          {activeTab === 'analytics' && (
            <AdminAnalyticsPanel
              orders={orders}
              payments={payments}
              returns={returns}
              refunds={refunds}
              shipments={shipments}
              customers={customers}
              variants={variants}
              lowStockThreshold={storeConfig.lowStockThreshold}
            />
          )}

          {/* REPORTS */}
          {activeTab === 'reports' && (
            <AdminReportsPanel
              orders={orders}
              payments={payments}
              returns={returns}
              refunds={refunds}
              shipments={shipments}
              customers={customers}
              products={products}
              variants={variants}
              coupons={coupons}
              lowStockThreshold={storeConfig.lowStockThreshold}
              actor={{ uid: actor.uid, email: actor.email, role: actor.role }}
            />
          )}

          {/* CATALOGUE SECTIONS */}
          {['categories', 'products', 'variants', 'jewellery', 'sarees', 'inventory', 'metalRates'].includes(
            activeTab
          ) && (
            <AdminCataloguePanels
              section={activeTab as CatalogueSection}
              categories={categories}
              products={products}
              variants={variants}
              metalRates={metalRates}
              lowStockThreshold={storeConfig.lowStockThreshold}
              actor={actor}
              canEditCatalogue={canManageCatalogue}
              canEditInventory={canManageInventory}
              canEditRates={canManageRates}
              onRefresh={loadAllOperationsData}
            />
          )}

          {/* SALES SECTIONS */}
          {['orders', 'payments', 'invoices', 'coupons', 'customers'].includes(activeTab) && (
            <AdminSalesPanels
              section={activeTab as SalesSection}
              orders={orders}
              payments={payments}
              invoices={invoices}
              coupons={coupons}
              customers={customers}
              actor={actor}
              canManageOrders={canManageOrders}
              canManageCoupons={canManageCoupons}
              onJumpToShipping={() => setActiveTab('shipping')}
              onRefresh={loadAllOperationsData}
            />
          )}

          {/* FULFILMENT SECTIONS (MILESTONE 7 REUSED) */}
          {activeTab === 'shipping' && (
            <AdminShippingPanel
              orders={orders}
              shipments={shipments}
              couriers={couriers}
              actor={actor}
              canEdit={canManageShipping}
              onRefresh={loadAllOperationsData}
            />
          )}

          {activeTab === 'couriers' && (
            <AdminCourierPanel
              couriers={couriers}
              actor={actor}
              canEdit={canManageCouriers}
              onRefresh={loadAllOperationsData}
            />
          )}

          {activeTab === 'returns' && (
            <AdminReturnsPanel
              returns={returns}
              orders={orders}
              refunds={refunds}
              actor={actor}
              canEdit={canManageReturns}
              canCreateRefund={canManageRefunds}
              onRefresh={loadAllOperationsData}
            />
          )}

          {activeTab === 'refunds' && (
            <AdminRefundsPanel
              refunds={refunds}
              orders={orders}
              returns={returns}
              actor={actor}
              canEdit={canManageRefunds}
              onRefresh={loadAllOperationsData}
            />
          )}

          {activeTab === 'policy' && (
            <AdminReturnPolicyPanel
              policy={policy}
              actor={actor}
              canEdit={canManagePolicy}
              onRefresh={loadAllOperationsData}
            />
          )}

          {/* ADMINISTRATION SECTIONS */}
          {[
            'staff',
            'roles',
            'auditLogs',
            'storeSettings',
            'gstSettings',
            'shippingSettings',
            'banners',
            'notifications',
          ].includes(activeTab) && (
            <AdminStaffSettingsPanels
              section={activeTab as AdminSettingsSection}
              staffMembers={staffMembers}
              auditLogs={auditLogs}
              storeConfig={storeConfig}
              banners={banners}
              notifications={notifications}
              emailLogs={emailLogs}
              customers={customers}
              actor={actor}
              canManageStaff={canManageStaff}
              canManageSettings={canManageSettings}
              canManageMarketing={canManageMarketing}
              onRefresh={loadAllOperationsData}
            />
          )}
        </main>
      </div>
    </div>
  );
};
