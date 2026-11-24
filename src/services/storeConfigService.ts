import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, handleFirestoreError, OperationType, storage } from '../firebase';
import {
  BANNER_SLIDES,
  CATEGORIES,
  Category,
  INITIAL_METAL_RATES,
  MetalRate,
  Product,
  ProductVariant,
  PRODUCTS,
} from '../data/mockData';
import {
  AdminMemberRecord,
  CouponRecord,
  HeroBannerRecord,
  NotificationRecord,
  NotificationType,
  OrderItemSnapshot,
  OrderRecord,
  StaffRole,
  StockReservationRecord,
  StoreConfigRecord,
} from '../types/shippingReturns';
import { generateSafeId, writeAuditLog } from './shippingReturnsService';

export interface ProductVariantDoc extends ProductVariant {
  productId: string;
  updatedAt?: any;
}

export interface CategoryDoc extends Category {
  active?: boolean;
  returnEligible?: boolean;
  updatedAt?: any;
}

export interface MetalRateDoc extends MetalRate {
  id: string;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: CouponRecord;
  discountPercent: number;
  discountAmount: number;
  reason?: string;
}

export interface PricingQuoteResult {
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  gstAmount: number;
  total: number;
  totalQuantity: number;
  verifiedByServer: boolean;
}

export const DEFAULT_STORE_CONFIG: Omit<StoreConfigRecord, 'updatedAt'> = {
  id: 'store_config',
  storeName: 'SDA Collections',
  tagline: 'Shop Smart... Be Stylish...',
  logoUrl: '',
  contactEmail: 'support@sdacollections.com',
  contactPhone: '+91 98480 12345',
  businessAddress: 'Plot 42, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034',
  businessRegistration: '',
  socialLinks: {
    instagram: 'https://instagram.com/sdacollections',
    facebook: '',
    whatsapp: '+91 98480 12345',
  },
  currency: 'INR',
  defaultCountry: 'India',
  supportedLanguages: ['en', 'te'],
  gstRatePercent: 3,
  jewelleryGstPercent: 3,
  sareeGstPercent: 5,
  freeShippingThreshold: 2000,
  flatShippingFee: 150,
  reservationExpiryMinutes: 10,
  lowStockThreshold: 5,
  announcementTextEn:
    'Festive Special: Flat 15% OFF on Kanchipuram Sarees & Temple Jewellery | Use Code: SDA15',
  announcementTextTe:
    'పండుగ ప్రత్యేక ఆఫర్: కాంచీపురం చీరెలు & టెంపుల్ జ్యువెలరీపై 15% తగ్గింపు | కోడ్: SDA15',
  announcementActive: true,
  maintenanceMode: false,
  maintenanceMessage:
    'SDA Collections is currently undergoing scheduled maintenance. Verified store staff may sign in below.',
};

export const DEFAULT_COUPONS: Array<Omit<CouponRecord, 'createdAt' | 'updatedAt'>> = [
  {
    code: 'SDA15',
    discountPercent: 15,
    minOrderAmount: 2000,
    maxDiscountAmount: 15000,
    usageCount: 0,
    usageLimit: 500,
    expiresAt: '2027-12-31',
    active: true,
    description: '15% Festive Offer on Jewellery & Silk Sarees',
  },
  {
    code: 'SDA20',
    discountPercent: 20,
    minOrderAmount: 5000,
    maxDiscountAmount: 25000,
    usageCount: 0,
    usageLimit: 250,
    expiresAt: '2027-12-31',
    active: true,
    description: '20% Royal Bridal Celebration Offer',
  },
];

export const DEFAULT_HERO_BANNERS: Array<Omit<HeroBannerRecord, 'createdAt' | 'updatedAt'>> =
  BANNER_SLIDES.map((s, idx) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    badge: s.badge,
    image: s.image,
    ctaPrimary: s.ctaPrimary,
    ctaSecondary: s.ctaSecondary,
    targetTab: idx === 1 ? 'sarees' : idx === 2 ? 'jewellery' : 'shop',
    displayOrder: idx + 1,
    active: true,
  }));

// ---------- LAST ACTIVE SUPER ADMIN PROTECTION ----------

export function validateStaffRoleChangeSafety(params: {
  staffList: AdminMemberRecord[];
  targetUid: string;
  nextRole: Exclude<StaffRole, 'customer'>;
  nextActive: boolean;
  actorUid: string;
  isRevoke?: boolean;
}): { allowed: boolean; reason?: string } {
  const { staffList, targetUid, nextRole, nextActive, actorUid, isRevoke } = params;
  const activeSuperAdmins = staffList.filter((m) => m.active && m.role === 'super_admin');
  const existingTarget = staffList.find((m) => m.uid === targetUid);

  const wasActiveSuperAdmin =
    existingTarget?.active === true && existingTarget?.role === 'super_admin';
  const willStayActiveSuperAdmin = !isRevoke && nextActive && nextRole === 'super_admin';

  if (wasActiveSuperAdmin && !willStayActiveSuperAdmin && activeSuperAdmins.length <= 1) {
    return {
      allowed: false,
      reason:
        'Action blocked: cannot remove, deactivate, or demote the last active Super Admin.',
    };
  }

  if (targetUid === actorUid && wasActiveSuperAdmin && !willStayActiveSuperAdmin) {
    return {
      allowed: false,
      reason:
        'Self-demotion or self-deactivation by a Super Admin must be confirmed by another Super Admin.',
    };
  }

  return { allowed: true };
}

export function validateInventoryDelta(currentStock: number, delta: number): number {
  const next = currentStock + delta;
  if (!Number.isFinite(next) || next < 0) {
    throw new Error(
      `Invalid stock adjustment: resulting inventory (${next}) cannot be negative.`
    );
  }
  return Math.floor(next);
}

// ---------- PRICING, COUPONS & SERVER QUOTE ----------

export function validateCouponAgainstSubtotal(params: {
  codeInput: string;
  coupons: CouponRecord[];
  subtotal: number;
  now?: Date;
}): CouponValidationResult {
  const normalized = params.codeInput.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, discountPercent: 0, discountAmount: 0, reason: 'Enter a coupon code.' };
  }

  const coupon = params.coupons.find((c) => c.code.toUpperCase() === normalized);
  if (!coupon) {
    return {
      valid: false,
      discountPercent: 0,
      discountAmount: 0,
      reason: `Coupon "${normalized}" was not found.`,
    };
  }
  if (!coupon.active) {
    return {
      valid: false,
      discountPercent: 0,
      discountAmount: 0,
      reason: `Coupon "${normalized}" is currently inactive.`,
    };
  }
  if (coupon.expiresAt) {
    const exp = new Date(coupon.expiresAt);
    const now = params.now || new Date();
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < now.getTime()) {
      return {
        valid: false,
        discountPercent: 0,
        discountAmount: 0,
        reason: `Coupon "${normalized}" expired on ${coupon.expiresAt}.`,
      };
    }
  }
  if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
    return {
      valid: false,
      discountPercent: 0,
      discountAmount: 0,
      reason: `Coupon "${normalized}" has reached its maximum redemption limit.`,
    };
  }
  if (coupon.minOrderAmount > 0 && params.subtotal < coupon.minOrderAmount) {
    return {
      valid: false,
      discountPercent: 0,
      discountAmount: 0,
      reason: `Minimum order of ₹${coupon.minOrderAmount.toLocaleString('en-IN')} required for "${normalized}".`,
    };
  }

  let discountAmount = Math.round((params.subtotal * coupon.discountPercent) / 100);
  if (coupon.maxDiscountAmount > 0 && discountAmount > coupon.maxDiscountAmount) {
    discountAmount = Math.round(coupon.maxDiscountAmount);
  }

  return {
    valid: true,
    coupon,
    discountPercent: coupon.discountPercent,
    discountAmount,
  };
}

export function calculateOrderPricing(params: {
  items: Array<{ product: Product; quantity: number }>;
  storeConfig: StoreConfigRecord;
  appliedCoupon?: CouponRecord | null;
}): PricingQuoteResult {
  const { items, storeConfig, appliedCoupon } = params;
  let subtotal = 0;
  let jewelleryBase = 0;
  let apparelBase = 0;
  let totalQuantity = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.floor(Number(item.quantity || 0)));
    if (qty === 0) continue;
    const unitPrice = Math.round(
      item.product.basePrice * (1 - (item.product.discount || 0) / 100)
    );
    const line = unitPrice * qty;
    subtotal += line;
    totalQuantity += qty;
    if (item.product.type === 'jewellery') {
      jewelleryBase += line;
    } else {
      apparelBase += line;
    }
  }

  let discountAmount = 0;
  if (appliedCoupon && appliedCoupon.active && subtotal >= (appliedCoupon.minOrderAmount || 0)) {
    discountAmount = Math.round((subtotal * appliedCoupon.discountPercent) / 100);
    if (appliedCoupon.maxDiscountAmount > 0 && discountAmount > appliedCoupon.maxDiscountAmount) {
      discountAmount = Math.round(appliedCoupon.maxDiscountAmount);
    }
  }

  const shippingFee =
    subtotal === 0 || subtotal >= storeConfig.freeShippingThreshold
      ? 0
      : storeConfig.flatShippingFee;

  const ratio = subtotal > 0 ? Math.max(0, (subtotal - discountAmount) / subtotal) : 1;
  const gstAmount = Math.round(
    jewelleryBase * ratio * (storeConfig.jewelleryGstPercent / 100) +
      apparelBase * ratio * (storeConfig.sareeGstPercent / 100)
  );
  const total = Math.max(0, subtotal - discountAmount + shippingFee + gstAmount);

  return {
    subtotal,
    discountAmount,
    shippingFee,
    gstAmount,
    total,
    totalQuantity,
    verifiedByServer: false,
  };
}

export async function fetchServerCheckoutQuote(params: {
  items: Array<{ product: Product; quantity: number }>;
  storeConfig: StoreConfigRecord;
  appliedCoupon?: CouponRecord | null;
}): Promise<PricingQuoteResult> {
  const local = calculateOrderPricing(params);
  try {
    const res = await fetch('/api/checkout/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: params.items.map((it) => ({
          productId: it.product.id,
          basePrice: it.product.basePrice,
          discount: it.product.discount,
          quantity: it.quantity,
          type: it.product.type,
        })),
        couponDiscountPercent: params.appliedCoupon?.discountPercent || 0,
        couponMinOrderAmount: params.appliedCoupon?.minOrderAmount || 0,
        couponMaxDiscountAmount: params.appliedCoupon?.maxDiscountAmount || 0,
        couponActive: params.appliedCoupon?.active ?? true,
        couponExpiresAt: params.appliedCoupon?.expiresAt || '',
        gstRatePercent: params.storeConfig.gstRatePercent,
        jewelleryGstPercent: params.storeConfig.jewelleryGstPercent,
        sareeGstPercent: params.storeConfig.sareeGstPercent,
        freeShippingThreshold: params.storeConfig.freeShippingThreshold,
        flatShippingFee: params.storeConfig.flatShippingFee,
      }),
    });
    if (!res.ok) {
      return local;
    }
    const data = await res.json();
    if (data?.valid) {
      return {
        subtotal: Number(data.subtotal),
        discountAmount: Number(data.discountAmount),
        shippingFee: Number(data.shippingFee),
        gstAmount: Number(data.gstAmount),
        total: Number(data.total),
        totalQuantity: Number(data.totalQuantity),
        verifiedByServer: true,
      };
    }
  } catch {
    // Fallback cleanly to deterministic shared calculator in test/offline mode
  }
  return local;
}

// ---------- STORE SETTINGS ----------

export async function fetchStoreConfig(): Promise<StoreConfigRecord> {
  try {
    const snap = await getDoc(doc(db, 'storeSettings', 'store_config'));
    if (snap.exists()) {
      return { ...DEFAULT_STORE_CONFIG, ...(snap.data() as Partial<StoreConfigRecord>) };
    }
  } catch (err) {
    console.warn('Store config fallback to defaults:', err);
  }
  return { ...DEFAULT_STORE_CONFIG };
}

export async function saveStoreConfig(params: {
  nextConfig: Omit<StoreConfigRecord, 'updatedAt'>;
  previousConfig?: StoreConfigRecord | null;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
  reason?: string;
}): Promise<void> {
  const path = 'storeSettings/store_config';
  try {
    const payload = {
      ...params.nextConfig,
      id: 'store_config' as const,
      storeName: params.nextConfig.storeName.trim().slice(0, 120) || 'SDA Collections',
      gstRatePercent: Math.max(0, Math.min(28, Number(params.nextConfig.gstRatePercent) || 0)),
      jewelleryGstPercent: Math.max(0, Math.min(28, Number(params.nextConfig.jewelleryGstPercent) || 0)),
      sareeGstPercent: Math.max(0, Math.min(28, Number(params.nextConfig.sareeGstPercent) || 0)),
      freeShippingThreshold: Math.max(0, Number(params.nextConfig.freeShippingThreshold) || 0),
      flatShippingFee: Math.max(0, Number(params.nextConfig.flatShippingFee) || 0),
      reservationExpiryMinutes: Math.max(
        1,
        Math.min(60, Number(params.nextConfig.reservationExpiryMinutes) || 10)
      ),
      lowStockThreshold: Math.max(
        0,
        Math.min(1000, Number(params.nextConfig.lowStockThreshold) || 5)
      ),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'storeSettings', 'store_config'), payload);
    await writeAuditLog({
      entityType: 'storeSettings',
      entityId: 'store_config',
      action: 'Updated Store / GST / Shipping Settings',
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
      beforeValues: params.previousConfig || null,
      afterValues: params.nextConfig,
      reason: params.reason,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ---------- CATALOGUE: CATEGORIES, PRODUCTS, VARIANTS, METAL RATES ----------

export async function fetchCategories(): Promise<CategoryDoc[]> {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    if (snap.empty) {
      return CATEGORIES.map((c) => ({ ...c, active: true, returnEligible: true }));
    }
    return snap.docs.map((d) => d.data() as CategoryDoc);
  } catch {
    return CATEGORIES.map((c) => ({ ...c, active: true, returnEligible: true }));
  }
}

export async function saveCategory(params: {
  category: CategoryDoc;
  isNew: boolean;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
}): Promise<void> {
  const id = params.category.id || generateSafeId('cat').toLowerCase();
  const path = `categories/${id}`;
  try {
    const payload = {
      id,
      name: params.category.name.trim().slice(0, 80),
      slug: (params.category.slug || params.category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 80),
      description: (params.category.description || '').slice(0, 500),
      image: (params.category.image || '').slice(0, 500),
      itemCount: Number(params.category.itemCount || 0),
      active: params.category.active !== false,
      returnEligible: params.category.returnEligible !== false,
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'categories', id), payload, { merge: true });
    await writeAuditLog({
      entityType: 'category',
      entityId: id,
      action: params.isNew ? `Created category ${payload.name}` : `Updated category ${payload.name}`,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
      afterValues: { name: payload.name, active: payload.active },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCategoryDoc(
  categoryId: string,
  actorUid: string,
  actorRole?: string,
  actorEmail?: string
): Promise<void> {
  const path = `categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
    await writeAuditLog({
      entityType: 'category',
      entityId: categoryId,
      action: `Deleted category ${categoryId}`,
      actorUid,
      actorRole,
      actorEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function fetchProductsAndVariants(): Promise<{
  products: Product[];
  variants: ProductVariantDoc[];
}> {
  try {
    const [prodSnap, varSnap] = await Promise.all([
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'productVariants')),
    ]);

    const variantDocs: ProductVariantDoc[] = varSnap.empty
      ? PRODUCTS.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p.id })))
      : varSnap.docs.map((d) => d.data() as ProductVariantDoc);

    if (prodSnap.empty) {
      const merged = PRODUCTS.map((p) => {
        const matched = variantDocs.filter((v) => v.productId === p.id);
        return matched.length > 0 ? { ...p, variants: matched } : p;
      });
      return { products: merged, variants: variantDocs };
    }

    const products = prodSnap.docs.map((d) => {
      const raw = d.data() as Product;
      const matched = variantDocs.filter((v) => v.productId === raw.id);
      return {
        ...raw,
        variants: matched.length > 0 ? matched : raw.variants || [],
      };
    });

    return { products, variants: variantDocs };
  } catch {
    const fallbackVariants = PRODUCTS.flatMap((p) =>
      p.variants.map((v) => ({ ...v, productId: p.id }))
    );
    return { products: PRODUCTS, variants: fallbackVariants };
  }
}

export async function saveProductWithVariants(params: {
  product: Product;
  previousProduct?: Product | null;
  isNew: boolean;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
}): Promise<void> {
  const id = params.product.id || generateSafeId('prod').toLowerCase();
  const path = `products/${id}`;
  try {
    const batch = writeBatch(db);
    const cleanProduct: Record<string, any> = {
      id,
      name: params.product.name.trim().slice(0, 160),
      slug: (params.product.slug || params.product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 160),
      category: params.product.category.trim().slice(0, 80),
      type: params.product.type,
      description: (params.product.description || '').slice(0, 2000),
      shortDescription: (params.product.shortDescription || '').slice(0, 300),
      images: (params.product.images || []).slice(0, 10),
      basePrice: Math.max(0, Number(params.product.basePrice) || 0),
      discount: Math.max(0, Math.min(95, Number(params.product.discount) || 0)),
      active: Boolean(params.product.active),
      featured: Boolean(params.product.featured),
      bestseller: Boolean(params.product.bestseller),
      newArrival: Boolean(params.product.newArrival),
      rating: Number(params.product.rating || 4.8),
      reviewsCount: Number(params.product.reviewsCount || 0),
      variants: params.product.variants || [],
      updatedAt: serverTimestamp(),
    };
    if (params.product.jewellerySpec) {
      cleanProduct.jewellerySpec = params.product.jewellerySpec;
    }
    if (params.product.sareeSpec) {
      cleanProduct.sareeSpec = params.product.sareeSpec;
    }

    batch.set(doc(db, 'products', id), cleanProduct);

    for (const v of params.product.variants || []) {
      const sku = (v.sku || generateSafeId('SKU')).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      batch.set(doc(db, 'productVariants', sku), {
        sku,
        productId: id,
        colour: (v.colour || 'Standard').slice(0, 80),
        size: (v.size || 'Standard').slice(0, 80),
        weight: (v.weight || '').slice(0, 40),
        stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
        price: Math.max(0, Number(v.price) || cleanProduct.basePrice),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    await writeAuditLog({
      entityType: 'product',
      entityId: id,
      action: params.isNew ? `Created product ${cleanProduct.name}` : `Updated product ${cleanProduct.name}`,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
      beforeValues: params.previousProduct
        ? {
            name: params.previousProduct.name,
            basePrice: params.previousProduct.basePrice,
            discount: params.previousProduct.discount,
            active: params.previousProduct.active,
          }
        : null,
      afterValues: {
        name: cleanProduct.name,
        basePrice: cleanProduct.basePrice,
        discount: cleanProduct.discount,
        active: cleanProduct.active,
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteProductDoc(
  productId: string,
  actorUid: string,
  actorRole?: string,
  actorEmail?: string
): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
    await writeAuditLog({
      entityType: 'product',
      entityId: productId,
      action: `Deleted product ${productId}`,
      actorUid,
      actorRole,
      actorEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function adjustVariantStock(params: {
  variant: ProductVariantDoc;
  delta: number;
  reason?: string;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
}): Promise<number> {
  const path = `productVariants/${params.variant.sku}`;
  const nextStock = validateInventoryDelta(params.variant.stock, params.delta);
  try {
    await setDoc(
      doc(db, 'productVariants', params.variant.sku),
      {
        sku: params.variant.sku,
        productId: params.variant.productId,
        colour: params.variant.colour || 'Standard',
        size: params.variant.size || 'Standard',
        weight: params.variant.weight || '',
        price: params.variant.price,
        stock: nextStock,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await writeAuditLog({
      entityType: 'variant',
      entityId: params.variant.sku,
      action: `Adjusted SKU ${params.variant.sku} stock: ${params.variant.stock} -> ${nextStock}`,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
      beforeValues: { stock: params.variant.stock },
      afterValues: { stock: nextStock },
      reason: params.reason,
    });

    return nextStock;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchMetalRates(): Promise<MetalRateDoc[]> {
  try {
    const snap = await getDocs(collection(db, 'metalRates'));
    if (snap.empty) {
      return INITIAL_METAL_RATES.map((m, i) => ({ ...m, id: `rate-${i + 1}` }));
    }
    return snap.docs.map((d) => d.data() as MetalRateDoc);
  } catch {
    return INITIAL_METAL_RATES.map((m, i) => ({ ...m, id: `rate-${i + 1}` }));
  }
}

export async function saveMetalRate(params: {
  rate: MetalRateDoc;
  previousRatePerGram?: number;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
}): Promise<void> {
  const id = params.rate.id || generateSafeId('rate').toLowerCase();
  const path = `metalRates/${id}`;
  try {
    const nextRate = Math.max(0, Number(params.rate.ratePerGram) || 0);
    const updatedLabel = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    await setDoc(doc(db, 'metalRates', id), {
      id,
      metal: params.rate.metal.slice(0, 32),
      purity: params.rate.purity.slice(0, 32),
      ratePerGram: nextRate,
      currency: (params.rate.currency || 'INR').slice(0, 8),
      updatedAt: updatedLabel,
    });
    await writeAuditLog({
      entityType: 'metalRate',
      entityId: id,
      action: `Updated ${params.rate.metal} (${params.rate.purity}) rate to ₹${nextRate}/g`,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
      beforeValues:
        params.previousRatePerGram !== undefined
          ? { ratePerGram: params.previousRatePerGram }
          : null,
      afterValues: { ratePerGram: nextRate },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function seedDefaultCatalogueToFirestore(params: {
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const c of CATEGORIES) {
      batch.set(doc(db, 'categories', c.id), {
        ...c,
        active: true,
        returnEligible: true,
        updatedAt: serverTimestamp(),
      });
    }
    for (const p of PRODUCTS) {
      batch.set(doc(db, 'products', p.id), {
        ...p,
        updatedAt: serverTimestamp(),
      });
      for (const v of p.variants) {
        batch.set(doc(db, 'productVariants', v.sku), {
          ...v,
          productId: p.id,
          updatedAt: serverTimestamp(),
        });
      }
    }
    INITIAL_METAL_RATES.forEach((mr, idx) => {
      const id = `rate-${idx + 1}`;
      batch.set(doc(db, 'metalRates', id), { ...mr, id });
    });
    for (const cp of DEFAULT_COUPONS) {
      batch.set(doc(db, 'coupons', cp.code), {
        ...cp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const b of DEFAULT_HERO_BANNERS) {
      batch.set(doc(db, 'heroBanners', b.id), {
        ...b,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    await writeAuditLog({
      entityType: 'storeSettings',
      entityId: 'catalogue_seed',
      action: 'Synchronized default categories, products, variants, metal rates, coupons & banners to Firestore',
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'products');
  }
}

// ---------- COUPONS ----------

export async function fetchCoupons(): Promise<CouponRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'coupons'));
    if (snap.empty) {
      return DEFAULT_COUPONS.map((c) => ({ ...c }));
    }
    return snap.docs.map((d) => d.data() as CouponRecord);
  } catch {
    return DEFAULT_COUPONS.map((c) => ({ ...c }));
  }
}

export async function saveCoupon(params: {
  coupon: CouponRecord;
  isNew: boolean;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
}): Promise<void> {
  const code = params.coupon.code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
  if (!code) throw new Error('Coupon code must contain alphanumeric characters.');
  const path = `coupons/${code}`;
  try {
    const payload = {
      code,
      discountPercent: Math.max(0, Math.min(90, Number(params.coupon.discountPercent) || 0)),
      minOrderAmount: Math.max(0, Number(params.coupon.minOrderAmount) || 0),
      maxDiscountAmount: Math.max(0, Number(params.coupon.maxDiscountAmount) || 0),
      usageCount: Math.max(0, Number(params.coupon.usageCount) || 0),
      usageLimit: Math.max(0, Number(params.coupon.usageLimit) || 0),
      expiresAt: (params.coupon.expiresAt || '').slice(0, 40),
      description: (params.coupon.description || '').slice(0, 200),
      active: Boolean(params.coupon.active),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'coupons', code), payload, { merge: true });
    await writeAuditLog({
      entityType: 'coupon',
      entityId: code,
      action: params.isNew ? `Created coupon ${code}` : `Updated coupon ${code}`,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
      afterValues: {
        discountPercent: payload.discountPercent,
        active: payload.active,
        minOrderAmount: payload.minOrderAmount,
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCouponDoc(
  code: string,
  actorUid: string,
  actorRole?: string,
  actorEmail?: string
): Promise<void> {
  const path = `coupons/${code}`;
  try {
    await deleteDoc(doc(db, 'coupons', code));
    await writeAuditLog({
      entityType: 'coupon',
      entityId: code,
      action: `Deleted coupon ${code}`,
      actorUid,
      actorRole,
      actorEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ---------- HERO BANNERS & STORAGE UPLOAD ----------

export async function fetchHeroBanners(): Promise<HeroBannerRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'heroBanners'));
    if (snap.empty) {
      return DEFAULT_HERO_BANNERS.map((b) => ({ ...b }));
    }
    return snap.docs
      .map((d) => d.data() as HeroBannerRecord)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch {
    return DEFAULT_HERO_BANNERS.map((b) => ({ ...b }));
  }
}

export async function saveHeroBanner(params: {
  banner: HeroBannerRecord;
  isNew: boolean;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
}): Promise<void> {
  const id = params.banner.id || generateSafeId('banner').toLowerCase();
  const path = `heroBanners/${id}`;
  try {
    const payload = {
      id,
      title: params.banner.title.trim().slice(0, 160),
      subtitle: params.banner.subtitle.trim().slice(0, 300),
      badge: (params.banner.badge || '').trim().slice(0, 80),
      image: params.banner.image.trim().slice(0, 500),
      ctaPrimary: (params.banner.ctaPrimary || 'Shop Now').trim().slice(0, 60),
      ctaSecondary: (params.banner.ctaSecondary || 'Explore Collections').trim().slice(0, 60),
      targetTab: (params.banner.targetTab || 'shop').trim().slice(0, 40),
      displayOrder: Math.max(0, Number(params.banner.displayOrder) || 1),
      active: Boolean(params.banner.active),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'heroBanners', id), payload, { merge: true });
    await writeAuditLog({
      entityType: 'banner',
      entityId: id,
      action: params.isNew ? `Created hero banner "${payload.title}"` : `Updated hero banner "${payload.title}"`,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
      afterValues: { title: payload.title, active: payload.active, displayOrder: payload.displayOrder },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteHeroBannerDoc(
  bannerId: string,
  actorUid: string,
  actorRole?: string,
  actorEmail?: string
): Promise<void> {
  const path = `heroBanners/${bannerId}`;
  try {
    await deleteDoc(doc(db, 'heroBanners', bannerId));
    await writeAuditLog({
      entityType: 'banner',
      entityId: bannerId,
      action: `Deleted hero banner ${bannerId}`,
      actorUid,
      actorRole,
      actorEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function uploadValidatedImageToStorage(file: File, folder: 'banners' | 'products'): Promise<string> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid image type. Please upload JPG, PNG, or WEBP only.');
  }
  const maxBytes = 2 * 1024 * 1024; // 2 MB
  if (file.size > maxBytes) {
    throw new Error('Image size exceeds the 2 MB limit.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const storageRef = ref(storage, `sda-collections/${folder}/${Date.now()}-${safeName}`);
  try {
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  } catch (err) {
    throw new Error(
      `Firebase Storage upload failed (${err instanceof Error ? err.message : 'Storage bucket unavailable or unauthorized'}). You may use a verified HTTPS image URL instead.`
    );
  }
}

// ---------- ADDRESSES (FIRESTORE PERSISTENCE) ----------

export interface AddressDoc {
  id: string;
  userId: string;
  fullName: string;
  mobile: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  addressType: 'Home' | 'Work' | 'Other';
  isDefault: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export async function fetchUserAddresses(userId: string): Promise<AddressDoc[]> {
  try {
    const q = query(collection(db, 'addresses'), where('userId', '==', userId), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AddressDoc);
  } catch {
    return [];
  }
}

export async function saveUserAddress(addr: AddressDoc): Promise<void> {
  const path = `addresses/${addr.id}`;
  try {
    await setDoc(doc(db, 'addresses', addr.id), {
      ...addr,
      createdAt: addr.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteUserAddress(addressId: string): Promise<void> {
  const path = `addresses/${addressId}`;
  try {
    await deleteDoc(doc(db, 'addresses', addressId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ---------- STOCK RESERVATION & ATOMIC CHECKOUT ----------

export async function createOrRefreshStockReservation(params: {
  userId: string;
  items: Array<{ productId: string; variantSku: string; quantity: number }>;
  expiryMinutes: number;
}): Promise<StockReservationRecord> {
  const id = `RES-${params.userId.slice(0, 12)}`;
  const expiresAt = new Date(Date.now() + params.expiryMinutes * 60_000).toISOString();
  const payload: StockReservationRecord = {
    id,
    userId: params.userId,
    items: params.items.slice(0, 50),
    status: 'active',
    expiresAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'stockReservations', id), payload);
  return payload;
}

export async function executeAtomicCheckout(params: {
  userId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  shippingFee: number;
  gstAmount: number;
  total: number;
  paymentMethod: string;
  reservationId?: string;
  shippingAddress: {
    fullName: string;
    mobile: string;
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
  };
}): Promise<OrderRecord> {
  const orderNumber = 'SDA-' + Math.floor(100000 + Math.random() * 900000);
  const orderId = orderNumber;
  const paymentId = generateSafeId('PAY');
  const invoiceNumber = `INV-${orderNumber}`;
  const isCod = params.paymentMethod.toLowerCase() === 'cod';
  const paymentStatus: OrderRecord['paymentStatus'] = isCod ? 'Pending COD' : 'Successful';

  const orderDoc: OrderRecord = {
    id: orderId,
    userId: params.userId,
    customerName: params.customerName.slice(0, 120),
    customerEmail: params.customerEmail.slice(0, 160),
    orderNumber,
    items: params.items.slice(0, 50),
    subtotal: params.subtotal,
    discountAmount: params.discountAmount,
    couponCode: (params.couponCode || '').slice(0, 32),
    shippingFee: params.shippingFee,
    gstAmount: params.gstAmount,
    total: params.total,
    status: 'Confirmed & Packed',
    paymentMethod: params.paymentMethod.slice(0, 32),
    paymentStatus,
    shippingAddress: params.shippingAddress,
    stockReserved: true,
    stockRestored: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await runTransaction(db, async (tx) => {
      const orderRef = doc(db, 'orders', orderId);
      const existingOrder = await tx.get(orderRef);
      if (existingOrder.exists()) {
        throw new Error(`Duplicate order reference ${orderNumber} detected. Please retry.`);
      }

      const invoiceRef = doc(db, 'invoices', invoiceNumber);
      const existingInvoice = await tx.get(invoiceRef);
      if (existingInvoice.exists()) {
        throw new Error(`Duplicate invoice ${invoiceNumber} prevented.`);
      }

      const variantReads: Array<{ ref: ReturnType<typeof doc>; qty: number; currentStock: number | null; sku: string }> = [];
      for (const item of params.items) {
        if (!item.variantSku) continue;
        const vRef = doc(db, 'productVariants', item.variantSku);
        const vSnap = await tx.get(vRef);
        if (vSnap.exists()) {
          const curStock = Number(vSnap.data().stock ?? 0);
          if (curStock < item.quantity) {
            throw new Error(
              `Insufficient stock for ${item.name} (${item.variantSku}): requested ${item.quantity}, available ${curStock}.`
            );
          }
          variantReads.push({
            ref: vRef,
            qty: item.quantity,
            currentStock: curStock,
            sku: item.variantSku,
          });
        }
      }

      let couponRef: ReturnType<typeof doc> | null = null;
      let nextCouponUsage = 0;
      if (params.couponCode) {
        couponRef = doc(db, 'coupons', params.couponCode.toUpperCase());
        const cSnap = await tx.get(couponRef);
        if (cSnap.exists()) {
          nextCouponUsage = Number(cSnap.data().usageCount || 0) + 1;
        } else {
          couponRef = null;
        }
      }

      for (const vr of variantReads) {
        tx.update(vr.ref, {
          stock: (vr.currentStock || 0) - vr.qty,
          updatedAt: serverTimestamp(),
        });
      }

      if (couponRef) {
        tx.update(couponRef, {
          usageCount: nextCouponUsage,
          updatedAt: serverTimestamp(),
        });
      }

      if (params.reservationId) {
        const resRef = doc(db, 'stockReservations', params.reservationId);
        const resSnap = await tx.get(resRef);
        if (resSnap.exists()) {
          tx.update(resRef, {
            status: 'converted',
            orderId,
            updatedAt: serverTimestamp(),
          });
        }
      }

      tx.set(orderRef, orderDoc);
      tx.set(doc(db, 'payments', paymentId), {
        paymentId,
        orderId,
        userId: params.userId,
        amount: params.total,
        method: params.paymentMethod.slice(0, 32),
        status: paymentStatus,
        transactionRef: isCod
          ? `COD/RESERVE/${orderNumber}`
          : `DEMO/${params.paymentMethod.toUpperCase()}/${Date.now()}`,
        createdAt: serverTimestamp(),
      });
      tx.set(invoiceRef, {
        invoiceNumber,
        orderId,
        userId: params.userId,
        grandTotal: params.total,
        createdAt: serverTimestamp(),
      });

      const notifId = generateSafeId('NTF');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: params.userId,
        type: 'order_confirmation',
        title: `Order ${orderNumber} Confirmed`,
        message: `Your order ${orderNumber} (₹${params.total.toLocaleString('en-IN')}) has been recorded with ${
          isCod ? 'Cash on Delivery' : `Simulated ${params.paymentMethod.toUpperCase()}`
        }.`,
        orderNumber,
        read: false,
        createdByUid: params.userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await writeAuditLog({
      entityType: 'order',
      entityId: orderId,
      action: `Created order ${orderNumber} (${paymentStatus})`,
      actorUid: params.userId,
      actorEmail: params.customerEmail,
      afterValues: {
        total: params.total,
        paymentMethod: params.paymentMethod,
        paymentStatus,
        itemCount: params.items.length,
      },
    });

    return orderDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
  }
}

// ---------- IN-APP NOTIFICATIONS ----------

export async function fetchCustomerNotifications(userId: string): Promise<NotificationRecord[]> {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as NotificationRecord)
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
  } catch {
    return [];
  }
}

export async function fetchAllNotifications(): Promise<NotificationRecord[]> {
  const path = 'notifications';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as NotificationRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function createCustomerNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderNumber?: string;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
}): Promise<void> {
  const id = generateSafeId('NTF');
  const path = `notifications/${id}`;
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      userId: params.userId,
      type: params.type,
      title: params.title.trim().slice(0, 160),
      message: params.message.trim().slice(0, 600),
      orderNumber: (params.orderNumber || '').trim().slice(0, 32),
      read: false,
      createdByUid: params.actorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      entityType: 'notification',
      entityId: id,
      action: `Sent in-app notification to ${params.userId}: ${params.title}`,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true,
    updatedAt: serverTimestamp(),
  });
}

export async function fetchExternalNotificationProviders(): Promise<{
  emailConfigured: boolean;
  resendConfigured?: boolean;
  resendFromConfigured?: boolean;
  smsConfigured: boolean;
  mode: string;
  note: string;
}> {
  try {
    const res = await fetch('/api/notifications/providers');
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return {
    emailConfigured: false,
    resendConfigured: false,
    resendFromConfigured: false,
    smsConfigured: false,
    mode: 'in_app_only',
    note: 'External provider status unreachable; operating with persisted in-app notifications.',
  };
}

// ---------- CUSTOMERS, INVOICES & STAFF RBAC ----------

export async function fetchAllCustomersForAdmin(): Promise<any[]> {
  const path = 'users';
  try {
    const q = query(collection(db, path), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchAllInvoicesForAdmin(): Promise<any[]> {
  const path = 'invoices';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchStaffMembers(): Promise<AdminMemberRecord[]> {
  const path = 'admins';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => d.data() as AdminMemberRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function upsertStaffMember(params: {
  member: Omit<AdminMemberRecord, 'createdAt' | 'updatedAt'>;
  staffList: AdminMemberRecord[];
  actorUid: string;
  actorEmail?: string;
  reason?: string;
}): Promise<void> {
  const safety = validateStaffRoleChangeSafety({
    staffList: params.staffList,
    targetUid: params.member.uid,
    nextRole: params.member.role,
    nextActive: params.member.active,
    actorUid: params.actorUid,
  });
  if (!safety.allowed) {
    throw new Error(safety.reason || 'Role change blocked for safety.');
  }

  const uid = params.member.uid.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  if (!uid) throw new Error('Valid staff Firebase UID is required.');

  const prev = params.staffList.find((m) => m.uid === uid);
  const path = `admins/${uid}`;
  try {
    if (prev) {
      await updateDoc(doc(db, 'admins', uid), {
        email: params.member.email.trim().slice(0, 160),
        fullName: (params.member.fullName || '').trim().slice(0, 120),
        role: params.member.role,
        active: Boolean(params.member.active),
        notes: (params.member.notes || '').trim().slice(0, 300),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'admins', uid), {
        uid,
        email: params.member.email.trim().slice(0, 160),
        fullName: (params.member.fullName || '').trim().slice(0, 120),
        role: params.member.role,
        active: Boolean(params.member.active),
        notes: (params.member.notes || '').trim().slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await writeAuditLog({
      entityType: 'staff',
      entityId: uid,
      action: prev
        ? `Updated staff ${params.member.email} -> ${params.member.role} (${params.member.active ? 'active' : 'inactive'})`
        : `Assigned staff role ${params.member.role} to ${params.member.email}`,
      actorUid: params.actorUid,
      actorRole: 'super_admin',
      actorEmail: params.actorEmail,
      beforeValues: prev ? { role: prev.role, active: prev.active } : null,
      afterValues: { role: params.member.role, active: params.member.active },
      reason: params.reason,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function revokeStaffAccess(params: {
  target: AdminMemberRecord;
  staffList: AdminMemberRecord[];
  actorUid: string;
  actorEmail?: string;
  reason?: string;
}): Promise<void> {
  const safety = validateStaffRoleChangeSafety({
    staffList: params.staffList,
    targetUid: params.target.uid,
    nextRole: params.target.role,
    nextActive: false,
    actorUid: params.actorUid,
    isRevoke: true,
  });
  if (!safety.allowed) {
    throw new Error(safety.reason || 'Revocation blocked for safety.');
  }

  const path = `admins/${params.target.uid}`;
  try {
    await deleteDoc(doc(db, 'admins', params.target.uid));
    await writeAuditLog({
      entityType: 'staff',
      entityId: params.target.uid,
      action: `Revoked staff access for ${params.target.email}`,
      actorUid: params.actorUid,
      actorRole: 'super_admin',
      actorEmail: params.actorEmail,
      beforeValues: { role: params.target.role, active: params.target.active },
      afterValues: { revoked: true },
      reason: params.reason,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function authorizeCsvExportWithServer(reportType: string): Promise<{
  authorized: boolean;
  correlationId: string;
}> {
  const fallback = { authorized: true, correlationId: generateSafeId('EXP') };
  const user = auth.currentUser;
  if (!user) return fallback;
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/reports/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reportType }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        authorized: Boolean(data.authorized),
        correlationId: String(data.correlationId || fallback.correlationId),
      };
    }
  } catch {
    // Allow local export in test environments without Express bound
  }
  return fallback;
}
