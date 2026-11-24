import React, { useMemo, useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Search,
  Database,
  Upload,
  Gem,
  Sparkles,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import { Product, ProductVariant } from '../data/mockData';
import {
  adjustVariantStock,
  CategoryDoc,
  deleteCategoryDoc,
  deleteProductDoc,
  MetalRateDoc,
  ProductVariantDoc,
  saveCategory,
  saveMetalRate,
  saveProductWithVariants,
  seedDefaultCatalogueToFirestore,
  uploadValidatedImageToStorage,
} from '../services/storeConfigService';

export type CatalogueSection =
  | 'categories'
  | 'products'
  | 'variants'
  | 'jewellery'
  | 'sarees'
  | 'inventory'
  | 'metalRates';

interface AdminCataloguePanelsProps {
  section: CatalogueSection;
  categories: CategoryDoc[];
  products: Product[];
  variants: ProductVariantDoc[];
  metalRates: MetalRateDoc[];
  lowStockThreshold: number;
  actor: { uid: string; name: string; email: string; role: string };
  canEditCatalogue: boolean;
  canEditInventory: boolean;
  canEditRates: boolean;
  onRefresh: () => Promise<void>;
}

export const AdminCataloguePanels: React.FC<AdminCataloguePanelsProps> = ({
  section,
  categories,
  products,
  variants,
  metalRates,
  lowStockThreshold,
  actor,
  canEditCatalogue,
  canEditInventory,
  canEditRates,
  onRefresh,
}) => {
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Category Form State
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryDoc | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImg, setCatImg] = useState('');
  const [catActive, setCatActive] = useState(true);
  const [catReturnable, setCatReturnable] = useState(true);

  // Product Form State
  const [prodFormOpen, setProdFormOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState(categories[0]?.name || 'Gold Jewellery');
  const [prodType, setProdType] = useState<Product['type']>('jewellery');
  const [prodShortDesc, setProdShortDesc] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState(10000);
  const [prodDiscount, setProdDiscount] = useState(0);
  const [prodImage, setProdImage] = useState('');
  const [prodActive, setProdActive] = useState(true);
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodBestseller, setProdBestseller] = useState(false);
  const [prodNewArrival, setProdNewArrival] = useState(true);
  const [prodVariants, setProdVariants] = useState<ProductVariant[]>([]);
  const [jewelleryMetal, setJewelleryMetal] = useState<'Gold' | 'Silver' | 'Platinum'>('Gold');
  const [jewelleryPurity, setJewelleryPurity] = useState<'22K (916)' | '18K (750)' | '925 Silver' | '24K'>('22K (916)');
  const [jewelleryGrossWeight, setJewelleryGrossWeight] = useState(12);
  const [sareeFabric, setSareeFabric] = useState('Pure Kanchipuram Mulberry Silk');
  const [sareeWeave, setSareeWeave] = useState('Korvai Handloom Zari');
  const [sareeBlouse, setSareeBlouse] = useState(true);

  // Confirm Dialog State
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'category' | 'product';
    id: string;
    label: string;
  } | null>(null);

  // Inventory Delta State
  const [adjustingVar, setAdjustingVar] = useState<ProductVariantDoc | null>(null);
  const [stockDelta, setStockDelta] = useState<number>(0);
  const [stockReason, setStockReason] = useState('Manual stock count reconciliation');

  // Metal Rate inline editing state
  const [rateEdits, setRateEdits] = useState<Record<string, number>>({});

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (section === 'jewellery' && p.type !== 'jewellery') return false;
      if (section === 'sarees' && p.type !== 'saree') return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.variants.some((v) => v.sku.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, section, searchTerm]);

  const filteredVariants = useMemo(() => {
    if (!searchTerm.trim()) return variants;
    const q = searchTerm.toLowerCase();
    return variants.filter(
      (v) =>
        v.sku.toLowerCase().includes(q) ||
        v.colour.toLowerCase().includes(q) ||
        v.productId.toLowerCase().includes(q)
    );
  }, [variants, searchTerm]);

  const openCatEditor = (c?: CategoryDoc) => {
    if (c) {
      setEditingCat(c);
      setCatName(c.name);
      setCatSlug(c.slug);
      setCatDesc(c.description);
      setCatImg(c.image);
      setCatActive(c.active !== false);
      setCatReturnable(c.returnEligible !== false);
    } else {
      setEditingCat(null);
      setCatName('');
      setCatSlug('');
      setCatDesc('');
      setCatImg('');
      setCatActive(true);
      setCatReturnable(true);
    }
    setCatFormOpen(true);
    setErrorMsg('');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      await saveCategory({
        category: {
          id: editingCat?.id || '',
          name: catName,
          slug: catSlug || catName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: catDesc,
          image: catImg,
          itemCount: editingCat?.itemCount || 0,
          active: catActive,
          returnEligible: catReturnable,
        },
        isNew: !editingCat,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
      });
      setFeedback(editingCat ? `Category "${catName}" updated.` : `Category "${catName}" created.`);
      setCatFormOpen(false);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save category.');
    } finally {
      setBusy(false);
    }
  };

  const openProdEditor = (p?: Product) => {
    if (p) {
      setEditingProd(p);
      setProdName(p.name);
      setProdCategory(p.category);
      setProdType(p.type);
      setProdShortDesc(p.shortDescription);
      setProdDesc(p.description);
      setProdPrice(p.basePrice);
      setProdDiscount(p.discount);
      setProdImage(p.images?.[0] || '');
      setProdActive(p.active);
      setProdFeatured(p.featured);
      setProdBestseller(Boolean(p.bestseller));
      setProdNewArrival(Boolean(p.newArrival));
      setProdVariants(p.variants?.length ? p.variants.map((v) => ({ ...v })) : []);
      if (p.jewellerySpec) {
        setJewelleryMetal(p.jewellerySpec.metalType);
        setJewelleryPurity(p.jewellerySpec.purity);
        setJewelleryGrossWeight(p.jewellerySpec.grossWeight);
      }
      if (p.sareeSpec) {
        setSareeFabric(p.sareeSpec.fabric);
        setSareeWeave(p.sareeSpec.weaveType);
        setSareeBlouse(p.sareeSpec.blousePiece);
      }
    } else {
      const defType: Product['type'] =
        section === 'sarees' ? 'saree' : section === 'jewellery' ? 'jewellery' : 'jewellery';
      setEditingProd(null);
      setProdName('');
      setProdCategory(
        defType === 'saree' ? 'Kanchipuram Sarees' : categories[0]?.name || 'Gold Jewellery'
      );
      setProdType(defType);
      setProdShortDesc('');
      setProdDesc('');
      setProdPrice(12500);
      setProdDiscount(5);
      setProdImage('');
      setProdActive(true);
      setProdFeatured(false);
      setProdBestseller(false);
      setProdNewArrival(true);
      setProdVariants([
        {
          sku: `SDA-${Date.now().toString().slice(-5)}`,
          colour: defType === 'saree' ? 'Crimson & Gold' : '22K Antique Gold',
          size: 'Standard',
          weight: defType === 'jewellery' ? '14g' : '',
          price: 12500,
          stock: 10,
        },
      ]);
    }
    setProdFormOpen(true);
    setErrorMsg('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prodVariants.length === 0) {
      setErrorMsg('At least one product variant with an SKU is required.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const prodPayload: Product = {
        id: editingProd?.id || '',
        name: prodName,
        slug: editingProd?.slug || prodName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: prodCategory,
        type: prodType,
        description: prodDesc || prodShortDesc,
        shortDescription: prodShortDesc || prodName,
        images: prodImage ? [prodImage] : editingProd?.images || [],
        basePrice: Number(prodPrice),
        discount: Number(prodDiscount),
        active: prodActive,
        featured: prodFeatured,
        bestseller: prodBestseller,
        newArrival: prodNewArrival,
        rating: editingProd?.rating || 4.8,
        reviewsCount: editingProd?.reviewsCount || 0,
        variants: prodVariants,
        ...(prodType === 'jewellery'
          ? {
              jewellerySpec: {
                metalType: jewelleryMetal,
                purity: jewelleryPurity,
                grossWeight: Number(jewelleryGrossWeight),
                netWeight: Math.max(0, Number(jewelleryGrossWeight) - 1),
                stoneWeight: 1,
                makingCharges: 850,
                makingChargeType: 'per_gram',
                additionalCharges: 0,
                design: editingProd?.jewellerySpec?.design || 'Heritage Craft',
                occasion: editingProd?.jewellerySpec?.occasion || 'Bridal & Festive',
              },
            }
          : {}),
        ...(prodType === 'saree'
          ? {
              sareeSpec: {
                fabric: sareeFabric,
                blousePiece: sareeBlouse,
                weaveType: sareeWeave,
                length: '6.2 Meters (incl. 0.8m blouse)',
                washCare: 'Dry Clean Only',
              },
            }
          : {}),
      };

      await saveProductWithVariants({
        product: prodPayload,
        previousProduct: editingProd,
        isNew: !editingProd,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
      });
      setFeedback(editingProd ? `Saved updates to "${prodName}".` : `Created product "${prodName}".`);
      setProdFormOpen(false);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save product.');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadProductImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const url = await uploadValidatedImageToStorage(file, 'products');
      setProdImage(url);
      setFeedback('Product image uploaded to Firebase Storage.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    setErrorMsg('');
    try {
      if (confirmDelete.type === 'category') {
        await deleteCategoryDoc(confirmDelete.id, actor.uid, actor.role, actor.email);
      } else {
        await deleteProductDoc(confirmDelete.id, actor.uid, actor.role, actor.email);
      }
      setFeedback(`Deleted "${confirmDelete.label}".`);
      setConfirmDelete(null);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingVar) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const next = await adjustVariantStock({
        variant: adjustingVar,
        delta: stockDelta,
        reason: stockReason,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
      });
      setFeedback(`SKU ${adjustingVar.sku} stock updated to ${next} units.`);
      setAdjustingVar(null);
      setStockDelta(0);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Stock adjustment failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSyncCatalogueSeed = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      await seedDefaultCatalogueToFirestore({
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
      });
      setFeedback('Synced default categories, products, variants, metal rates, coupons & banners to Firestore.');
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Catalogue sync failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Top Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-cinzel text-base font-bold text-[#120D0B] uppercase tracking-wider">
            {section === 'categories' && `Categories Management (${categories.length})`}
            {section === 'products' && `All Products (${filteredProducts.length})`}
            {section === 'variants' && `Product Variants & SKUs (${filteredVariants.length})`}
            {section === 'jewellery' && `Jewellery Catalogue & Specifications (${filteredProducts.length})`}
            {section === 'sarees' && `Sarees & Silk Handlooms (${filteredProducts.length})`}
            {section === 'inventory' && `Inventory Control & Low-Stock Alerts (${variants.length} SKUs)`}
            {section === 'metalRates' && `Gold & Silver Daily Reference Rates`}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Backed by Firestore collections & audited on every modification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEditCatalogue && (
            <button
              onClick={handleSyncCatalogueSeed}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 font-semibold hover:bg-gray-100 flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5 text-[#65102F]" />
              <span>Sync Defaults to Firestore</span>
            </button>
          )}
          {canEditCatalogue && section === 'categories' && (
            <button
              onClick={() => openCatEditor()}
              className="px-3.5 py-1.5 rounded-lg bg-[#120D0B] text-[#D4AF62] font-bold hover:bg-[#D4AF62] hover:text-[#120D0B] flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Category
            </button>
          )}
          {canEditCatalogue && ['products', 'jewellery', 'sarees'].includes(section) && (
            <button
              onClick={() => openProdEditor()}
              className="px-3.5 py-1.5 rounded-lg bg-[#120D0B] text-[#D4AF62] font-bold hover:bg-[#D4AF62] hover:text-[#120D0B] flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          )}
        </div>
      </div>

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

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-cinzel font-bold text-base">Confirm Permanent Deletion</h4>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Are you sure you want to delete <strong>{confirmDelete.label}</strong>? This action is recorded in the audit log.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={busy}
                className="px-4 py-2 bg-rose-700 text-white rounded-lg font-bold hover:bg-rose-800"
              >
                {busy ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY EDITOR */}
      {section === 'categories' && catFormOpen && (
        <form onSubmit={handleSaveCategory} className="bg-white border-2 border-[#D4AF62] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2.5">
            <h4 className="font-cinzel font-bold text-sm text-[#120D0B]">
              {editingCat ? `Edit Category: ${editingCat.name}` : 'Create New Category'}
            </h4>
            <button type="button" onClick={() => setCatFormOpen(false)} className="text-gray-500">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Category Name</label>
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">URL Slug</label>
              <input
                type="text"
                value={catSlug}
                onChange={(e) => setCatSlug(e.target.value)}
                placeholder="auto-generated-from-name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold mb-1">Cover Image HTTPS URL</label>
              <input
                type="url"
                value={catImg}
                onChange={(e) => setCatImg(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold mb-1">Description</label>
              <input
                type="text"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={catActive} onChange={(e) => setCatActive(e.target.checked)} />
              Active on Storefront
            </label>
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={catReturnable} onChange={(e) => setCatReturnable(e.target.checked)} />
              Return Eligible Category
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCatFormOpen(false)} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
              {busy ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      )}

      {/* CATEGORIES TABLE */}
      {section === 'categories' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
              <tr>
                <th className="p-3">Category</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Returnable</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-[#120D0B]">{cat.name}</td>
                  <td className="p-3 font-mono text-gray-500">{cat.slug}</td>
                  <td className="p-3">{cat.returnEligible !== false ? 'Yes' : 'Final Sale'}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        cat.active !== false
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {cat.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {canEditCatalogue && (
                      <>
                        <button
                          onClick={() => openCatEditor(cat)}
                          className="px-2.5 py-1 border border-gray-300 rounded font-semibold hover:bg-gray-100 inline-flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ type: 'category', id: cat.id, label: cat.name })}
                          className="px-2.5 py-1 border border-rose-200 text-rose-700 rounded font-semibold hover:bg-rose-50 inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PRODUCT EDITOR MODAL/INLINE FORM */}
      {['products', 'jewellery', 'sarees'].includes(section) && prodFormOpen && (
        <form onSubmit={handleSaveProduct} className="bg-white border-2 border-[#D4AF62] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2.5">
            <h4 className="font-cinzel font-bold text-sm text-[#120D0B]">
              {editingProd ? `Edit Product: ${editingProd.name}` : 'Create New Product'}
            </h4>
            <button type="button" onClick={() => setProdFormOpen(false)} className="text-gray-500">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold mb-1">Product Name</label>
              <input
                type="text"
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Product Line Type</label>
              <select
                value={prodType}
                onChange={(e) => setProdType(e.target.value as Product['type'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="jewellery">Jewellery</option>
                <option value="saree">Saree</option>
                <option value="dress">Dress / Lehenga</option>
                <option value="fashion">Fashion</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Category</label>
              <select
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Base Price (INR)</label>
              <input
                type="number"
                min={0}
                required
                value={prodPrice}
                onChange={(e) => setProdPrice(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Discount (%)</label>
              <input
                type="number"
                min={0}
                max={95}
                value={prodDiscount}
                onChange={(e) => setProdDiscount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Primary Image URL (or upload to Firebase Storage)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={prodImage}
                  onChange={(e) => setProdImage(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <label className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg font-semibold cursor-pointer hover:bg-gray-200 flex items-center gap-1 shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => void handleUploadProductImage(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Short Description</label>
              <input
                type="text"
                value={prodShortDesc}
                onChange={(e) => setProdShortDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {prodType === 'jewellery' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 rounded-lg bg-amber-50/50 border border-amber-200">
              <div>
                <label className="block font-semibold mb-1">Metal Type</label>
                <select
                  value={jewelleryMetal}
                  onChange={(e) => setJewelleryMetal(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                >
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Platinum">Platinum</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Purity</label>
                <select
                  value={jewelleryPurity}
                  onChange={(e) => setJewelleryPurity(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                >
                  <option value="22K (916)">22K (916)</option>
                  <option value="24K">24K</option>
                  <option value="18K (750)">18K (750)</option>
                  <option value="925 Silver">925 Silver</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Gross Weight (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={jewelleryGrossWeight}
                  onChange={(e) => setJewelleryGrossWeight(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono"
                />
              </div>
            </div>
          )}

          {prodType === 'saree' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 rounded-lg bg-rose-50/40 border border-rose-200">
              <div>
                <label className="block font-semibold mb-1">Fabric</label>
                <input
                  type="text"
                  value={sareeFabric}
                  onChange={(e) => setSareeFabric(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Weave Type</label>
                <input
                  type="text"
                  value={sareeWeave}
                  onChange={(e) => setSareeWeave(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded"
                />
              </div>
              <label className="flex items-center gap-2 font-semibold pt-5">
                <input
                  type="checkbox"
                  checked={sareeBlouse}
                  onChange={(e) => setSareeBlouse(e.target.checked)}
                />
                Includes Unstitched Blouse Piece
              </label>
            </div>
          )}

          {/* Variants Editor */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#120D0B]">SKU Variants ({prodVariants.length})</span>
              <button
                type="button"
                onClick={() =>
                  setProdVariants((prev) => [
                    ...prev,
                    {
                      sku: `SDA-${Date.now().toString().slice(-5)}-${prev.length + 1}`,
                      colour: 'Standard',
                      size: 'Free Size',
                      weight: '',
                      price: prodPrice,
                      stock: 5,
                    },
                  ])
                }
                className="px-2.5 py-1 bg-gray-100 border rounded font-semibold hover:bg-gray-200"
              >
                + Add Variant Row
              </button>
            </div>
            {prodVariants.map((v, idx) => (
              <div key={idx} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center bg-gray-50 p-2 rounded-lg border">
                <input
                  type="text"
                  required
                  value={v.sku}
                  onChange={(e) => {
                    const copy = [...prodVariants];
                    copy[idx] = { ...v, sku: e.target.value };
                    setProdVariants(copy);
                  }}
                  placeholder="SKU"
                  className="px-2 py-1 border rounded font-mono"
                />
                <input
                  type="text"
                  value={v.colour}
                  onChange={(e) => {
                    const copy = [...prodVariants];
                    copy[idx] = { ...v, colour: e.target.value };
                    setProdVariants(copy);
                  }}
                  placeholder="Colour"
                  className="px-2 py-1 border rounded"
                />
                <input
                  type="text"
                  value={v.size}
                  onChange={(e) => {
                    const copy = [...prodVariants];
                    copy[idx] = { ...v, size: e.target.value };
                    setProdVariants(copy);
                  }}
                  placeholder="Size"
                  className="px-2 py-1 border rounded"
                />
                <input
                  type="number"
                  min={0}
                  value={v.price}
                  onChange={(e) => {
                    const copy = [...prodVariants];
                    copy[idx] = { ...v, price: Number(e.target.value) };
                    setProdVariants(copy);
                  }}
                  placeholder="Price"
                  className="px-2 py-1 border rounded font-mono"
                />
                <input
                  type="number"
                  min={0}
                  value={v.stock}
                  onChange={(e) => {
                    const copy = [...prodVariants];
                    copy[idx] = { ...v, stock: Math.max(0, Number(e.target.value)) };
                    setProdVariants(copy);
                  }}
                  placeholder="Stock"
                  className="px-2 py-1 border rounded font-mono"
                />
                <button
                  type="button"
                  onClick={() => setProdVariants((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-rose-700 font-semibold hover:underline text-center"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-1.5 font-semibold">
              <input type="checkbox" checked={prodActive} onChange={(e) => setProdActive(e.target.checked)} />
              Active
            </label>
            <label className="flex items-center gap-1.5 font-semibold">
              <input type="checkbox" checked={prodFeatured} onChange={(e) => setProdFeatured(e.target.checked)} />
              Featured
            </label>
            <label className="flex items-center gap-1.5 font-semibold">
              <input type="checkbox" checked={prodBestseller} onChange={(e) => setProdBestseller(e.target.checked)} />
              Bestseller
            </label>
            <label className="flex items-center gap-1.5 font-semibold">
              <input type="checkbox" checked={prodNewArrival} onChange={(e) => setProdNewArrival(e.target.checked)} />
              New Arrival
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setProdFormOpen(false)} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
              {busy ? 'Saving...' : 'Save Product & Variants'}
            </button>
          </div>
        </form>
      )}

      {/* PRODUCTS / JEWELLERY / SAREES LIST */}
      {['products', 'jewellery', 'sarees'].includes(section) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, category, or SKU..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Category / Spec</th>
                  <th className="p-3 text-right">Base Price</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Total Stock</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const totalStock = p.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-[#120D0B]">
                        <div className="flex items-center gap-2">
                          {p.images?.[0] && (
                            <img src={p.images[0]} alt={p.name} className="w-9 h-9 rounded object-cover border" />
                          )}
                          <div>
                            <p>{p.name}</p>
                            <p className="font-mono text-[10px] text-gray-400">
                              {p.variants.map((v) => v.sku).join(', ')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-gray-600">
                        <p className="font-medium">{p.category}</p>
                        {p.jewellerySpec && (
                          <p className="text-[10px] text-amber-800 flex items-center gap-1">
                            <Gem className="w-3 h-3" /> {p.jewellerySpec.purity} · {p.jewellerySpec.grossWeight}g
                          </p>
                        )}
                        {p.sareeSpec && (
                          <p className="text-[10px] text-rose-800 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> {p.sareeSpec.fabric}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">₹{p.basePrice.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono">{p.discount}%</td>
                      <td className="p-3 text-right font-mono font-bold">
                        <span className={totalStock <= lowStockThreshold ? 'text-rose-700' : 'text-emerald-700'}>
                          {totalStock}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            p.active
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {p.active ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {canEditCatalogue && (
                          <>
                            <button
                              onClick={() => openProdEditor(p)}
                              className="px-2.5 py-1 border border-gray-300 rounded font-semibold hover:bg-gray-100"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setConfirmDelete({ type: 'product', id: p.id, label: p.name })}
                              className="px-2.5 py-1 border border-rose-200 text-rose-700 rounded font-semibold hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VARIANTS & INVENTORY PANELS */}
      {['variants', 'inventory'].includes(section) && (
        <div className="space-y-4">
          {adjustingVar && (
            <form onSubmit={handleAdjustStock} className="bg-white border-2 border-[#65102F] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-cinzel font-bold text-sm">
                  Adjust Stock for SKU <span className="font-mono text-[#65102F]">{adjustingVar.sku}</span> (Current: {adjustingVar.stock})
                </h4>
                <button type="button" onClick={() => setAdjustingVar(null)} className="text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Quantity Delta (+ to add, - to deduct)</label>
                  <input
                    type="number"
                    required
                    value={stockDelta}
                    onChange={(e) => setStockDelta(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Resulting stock: <strong>{adjustingVar.stock + stockDelta}</strong> (negative values blocked)
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Audit Reason</label>
                  <input
                    type="text"
                    required
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAdjustingVar(null)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
                  {busy ? 'Updating...' : 'Apply Stock Adjustment'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative max-w-sm w-full">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by SKU, colour, or product ID..."
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg"
                />
              </div>
              <span className="text-[11px] font-semibold text-gray-600">
                Low Stock Alert Threshold: <strong>&le; {lowStockThreshold} units</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">Colour / Size / Weight</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Available Stock</th>
                    <th className="p-3">Health</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVariants.map((v) => {
                    const parent = products.find((p) => p.id === v.productId);
                    const isLow = v.stock <= lowStockThreshold;
                    return (
                      <tr key={v.sku} className="hover:bg-gray-50">
                        <td className="p-3 font-mono font-bold text-[#65102F]">{v.sku}</td>
                        <td className="p-3 font-medium text-[#120D0B]">{parent?.name || v.productId}</td>
                        <td className="p-3 text-gray-600">
                          {v.colour} / {v.size} {v.weight ? `/ ${v.weight}` : ''}
                        </td>
                        <td className="p-3 text-right font-mono">₹{v.price.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono font-bold">{v.stock}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              v.stock === 0
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : isLow
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {v.stock === 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'Healthy'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1.5">
                          {canEditInventory && (
                            <button
                              onClick={() => {
                                setAdjustingVar(v);
                                setStockDelta(5);
                                setErrorMsg('');
                              }}
                              className="px-2.5 py-1 bg-[#120D0B] text-[#D4AF62] rounded font-bold hover:bg-[#D4AF62] hover:text-[#120D0B]"
                            >
                              Adjust Stock
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GOLD & SILVER RATES */}
      {section === 'metalRates' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metalRates.map((mr) => {
              const currentEdit = rateEdits[mr.id] ?? mr.ratePerGram;
              return (
                <div key={mr.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-cinzel font-bold text-sm text-[#120D0B]">
                        {mr.metal} — {mr.purity}
                      </p>
                      <p className="text-[11px] text-gray-500">Last updated: {mr.updatedAt}</p>
                    </div>
                    <span className="font-mono font-bold text-base text-[#65102F]">
                      ₹{mr.ratePerGram.toLocaleString('en-IN')}/g
                    </span>
                  </div>

                  {canEditRates && (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                      <input
                        type="number"
                        min={1}
                        value={currentEdit}
                        onChange={(e) =>
                          setRateEdits((prev) => ({ ...prev, [mr.id]: Number(e.target.value) }))
                        }
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg font-mono bg-white"
                      />
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setErrorMsg('');
                          try {
                            await saveMetalRate({
                              rate: { ...mr, ratePerGram: currentEdit },
                              previousRatePerGram: mr.ratePerGram,
                              actorUid: actor.uid,
                              actorRole: actor.role,
                              actorEmail: actor.email,
                            });
                            setFeedback(`Updated ${mr.metal} (${mr.purity}) to ₹${currentEdit}/g.`);
                            await onRefresh();
                          } catch (err: any) {
                            setErrorMsg(err?.message || 'Failed to update metal rate.');
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="px-4 py-1.5 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold hover:bg-[#D4AF62] hover:text-[#120D0B]"
                      >
                        Save Rate
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
