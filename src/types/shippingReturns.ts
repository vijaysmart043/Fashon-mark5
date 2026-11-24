export const SHIPMENT_STATUSES = [
  'Shipment Created',
  'Ready for Pickup',
  'Picked Up',
  'In Transit',
  'Reached Destination Hub',
  'Out for Delivery',
  'Delivered',
  'Delivery Attempt Failed',
  'Returned to Sender',
  'Shipment Cancelled',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const VALID_SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  'Shipment Created': ['Ready for Pickup', 'Picked Up', 'Shipment Cancelled'],
  'Ready for Pickup': ['Picked Up', 'Shipment Cancelled'],
  'Picked Up': ['In Transit', 'Reached Destination Hub', 'Shipment Cancelled'],
  'In Transit': ['Reached Destination Hub', 'Out for Delivery', 'Delivery Attempt Failed', 'Returned to Sender'],
  'Reached Destination Hub': ['Out for Delivery', 'Delivery Attempt Failed', 'Returned to Sender'],
  'Out for Delivery': ['Delivered', 'Delivery Attempt Failed', 'Returned to Sender'],
  'Delivery Attempt Failed': ['Out for Delivery', 'Reached Destination Hub', 'Returned to Sender'],
  'Delivered': [],
  'Returned to Sender': [],
  'Shipment Cancelled': [],
};

export const RETURN_STATUSES = [
  'Requested',
  'Under Review',
  'Approved',
  'Rejected',
  'Pickup Pending',
  'Item Received',
  'Inspection Pending',
  'Inspection Passed',
  'Inspection Failed',
  'Refund Initiated',
  'Refunded',
  'Closed',
] as const;

export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const VALID_RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  'Requested': ['Under Review', 'Approved', 'Rejected', 'Closed'],
  'Under Review': ['Approved', 'Rejected', 'Closed'],
  'Approved': ['Pickup Pending', 'Item Received', 'Refund Initiated', 'Closed'],
  'Pickup Pending': ['Item Received', 'Closed'],
  'Item Received': ['Inspection Pending', 'Inspection Passed', 'Inspection Failed'],
  'Inspection Pending': ['Inspection Passed', 'Inspection Failed'],
  'Inspection Passed': ['Refund Initiated', 'Closed'],
  'Inspection Failed': ['Rejected', 'Closed'],
  'Refund Initiated': ['Refunded', 'Closed'],
  'Refunded': ['Closed'],
  'Rejected': [],
  'Closed': [],
};

export const REFUND_STATUSES = [
  'Requested',
  'Approved',
  'Processing',
  'Completed',
  'Failed',
  'Rejected',
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const VALID_REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  'Requested': ['Approved', 'Rejected'],
  'Approved': ['Processing', 'Completed', 'Failed', 'Rejected'],
  'Processing': ['Completed', 'Failed'],
  'Failed': ['Processing', 'Rejected'],
  'Completed': [],
  'Rejected': [],
};

export const STAFF_ROLES = [
  'super_admin',
  'product_manager',
  'order_manager',
  'inventory_manager',
  'customer_support',
  'delivery_manager',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number] | 'customer';

export const ROLE_PERMISSION_MATRIX: Record<
  Exclude<StaffRole, 'customer'>,
  {
    label: string;
    description: string;
    capabilities: string[];
  }
> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Full store governance across staff, security, catalogue, orders, analytics, and settings.',
    capabilities: [
      'staff',
      'roles',
      'analytics',
      'reports',
      'catalogue',
      'inventory',
      'metal_rates',
      'orders',
      'payments',
      'invoices',
      'coupons',
      'customers',
      'shipping',
      'couriers',
      'returns',
      'refunds',
      'settings',
      'banners',
      'notifications',
      'audit_logs',
    ],
  },
  product_manager: {
    label: 'Product Manager',
    description: 'Manage categories, products, variants, gold/silver rates, and homepage banners.',
    capabilities: ['analytics', 'catalogue', 'metal_rates', 'banners'],
  },
  inventory_manager: {
    label: 'Inventory Manager',
    description: 'Control SKU stock levels, low-stock alerts, inventory reports, and reservations.',
    capabilities: ['analytics', 'reports', 'inventory', 'catalogue'],
  },
  order_manager: {
    label: 'Order Manager',
    description: 'Manage customer orders, invoices, coupons, returns, simulated refunds, and sales reports.',
    capabilities: ['analytics', 'reports', 'orders', 'payments', 'invoices', 'coupons', 'returns', 'refunds', 'shipping'],
  },
  customer_support: {
    label: 'Customer Support',
    description: 'Review customer profiles, order statuses, return requests, and in-app notifications.',
    capabilities: ['customers', 'orders', 'returns', 'notifications'],
  },
  delivery_manager: {
    label: 'Delivery Manager',
    description: 'Create and update shipments, courier partners, AWB tracking numbers, and delivery notes.',
    capabilities: ['shipping', 'couriers', 'orders', 'reports'],
  },
};

export interface AdminMemberRecord {
  uid: string;
  email: string;
  fullName?: string;
  role: Exclude<StaffRole, 'customer'>;
  active: boolean;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CourierProvider {
  id: string;
  name: string;
  trackingUrlTemplate?: string;
  defaultEstimatedDays: number;
  active: boolean;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ShipmentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  courierId?: string;
  courierName: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingDate?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: ShipmentStatus;
  deliveryNotes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ShipmentEventRecord {
  id: string;
  shipmentId: string;
  userId: string;
  status: ShipmentStatus;
  location?: string;
  notes?: string;
  updatedByUid: string;
  updatedByName?: string;
  createdAt?: any;
}

export interface ReturnPolicyConfig {
  id: string;
  returnsEnabled: boolean;
  returnWindowDays: number;
  inspectionRequired: boolean;
  eligibleCategories: string[];
  nonReturnableProductIds: string[];
  nonReturnableReasonsNote: string;
  returnReasons: string[];
  returnInstructions: string;
  updatedAt?: any;
}

export interface StoreConfigRecord {
  id: 'store_config';
  storeName: string;
  tagline: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  businessRegistration: string;
  socialLinks: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
  };
  currency: string;
  defaultCountry: string;
  supportedLanguages: string[];
  gstRatePercent: number;
  jewelleryGstPercent: number;
  sareeGstPercent: number;
  freeShippingThreshold: number;
  flatShippingFee: number;
  reservationExpiryMinutes: number;
  lowStockThreshold: number;
  announcementTextEn: string;
  announcementTextTe: string;
  announcementActive: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt?: any;
}

export interface HeroBannerRecord {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  ctaPrimary: string;
  ctaSecondary: string;
  targetTab: string;
  displayOrder: number;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface CouponRecord {
  code: string;
  discountPercent: number;
  minOrderAmount: number;
  maxDiscountAmount: number;
  usageCount: number;
  usageLimit: number;
  expiresAt?: string;
  active: boolean;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface StockReservationRecord {
  id: string;
  userId: string;
  items: Array<{
    productId: string;
    variantSku: string;
    quantity: number;
  }>;
  status: 'active' | 'converted' | 'expired' | 'released';
  expiresAt: string;
  orderId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type NotificationType =
  | 'order_confirmation'
  | 'payment_result'
  | 'order_status_update'
  | 'shipment_update'
  | 'return_update'
  | 'refund_update'
  | 'account_notification';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderNumber?: string;
  read: boolean;
  createdByUid?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ReturnItemPayload {
  productId: string;
  productName: string;
  category: string;
  variantSku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReturnRequestRecord {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  items: ReturnItemPayload[];
  requestedRefundAmount: number;
  reason: string;
  description?: string;
  imageUrls?: string[];
  status: ReturnStatus;
  inspectionNotes?: string;
  adminNotes?: string;
  receivedAt?: string;
  refundId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface RefundRecord {
  id: string;
  refundNumber: string;
  orderId: string;
  orderNumber: string;
  returnId?: string;
  userId: string;
  customerName: string;
  originalPaymentMethod: string;
  eligiblePaidAmount: number;
  refundAmount: number;
  isSimulated: boolean;
  refundModeNote?: string;
  status: RefundStatus;
  referenceId?: string;
  adminNotes?: string;
  processedByUid?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type TransactionalEmailType =
  | 'welcome'
  | 'email_verification'
  | 'password_reset'
  | 'order_confirmation'
  | 'payment_status'
  | 'invoice_notification'
  | 'shipment_update'
  | 'return_update'
  | 'refund_update';

export type EmailDeliveryStatus =
  | 'queued'
  | 'sent_to_provider'
  | 'delivered'
  | 'delivery_delayed'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'skipped_unconfigured';

export interface EmailLogRecord {
  id: string;
  requestId: string;
  resendEmailId: string;
  idempotencyKey: string;
  templateType: TransactionalEmailType;
  recipientEmail: string;
  userId?: string;
  orderNumber?: string;
  status: EmailDeliveryStatus;
  lastEvent: string;
  statusNote: string;
  errorCode?: string;
  errorMessage?: string;
  createdByUid?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type AuditEntityType =
  | 'shipment'
  | 'courier'
  | 'return'
  | 'refund'
  | 'policy'
  | 'order'
  | 'product'
  | 'variant'
  | 'category'
  | 'metalRate'
  | 'coupon'
  | 'staff'
  | 'storeSettings'
  | 'banner'
  | 'notification'
  | 'email'
  | 'auth';

export interface AuditLogRecord {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
  beforeValues?: Record<string, any> | null;
  afterValues?: Record<string, any> | null;
  correlationId?: string;
  reason?: string;
  details?: string;
  createdAt?: any;
}

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  category: string;
  variantSku: string;
  quantity: number;
  unitPrice: number;
  basePrice: number;
  discount: number;
  image?: string;
}

export interface OrderRecord {
  id: string;
  userId: string;
  customerName: string;
  customerEmail?: string;
  orderNumber: string;
  items: OrderItemSnapshot[];
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string;
  shippingFee?: number;
  gstAmount?: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: 'Successful' | 'Pending COD' | 'Failed' | 'Refunded' | 'Partially Refunded';
  shippingAddress?: {
    fullName: string;
    mobile: string;
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
  };
  shipmentId?: string;
  deliveredAt?: string;
  stockReserved?: boolean;
  stockRestored?: boolean;
  createdAt?: any;
  updatedAt?: any;
}
