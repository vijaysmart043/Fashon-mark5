export interface ProductVariant {
  sku: string;
  colour: string;
  size: string;
  weight?: string; // e.g. "24.5g"
  price: number;
  stock: number;
}

export interface JewellerySpecification {
  metalType: 'Gold' | 'Silver' | 'Platinum';
  purity: '22K (916)' | '18K (750)' | '925 Silver' | '24K';
  grossWeight: number; // in grams
  netWeight: number;
  stoneWeight: number;
  makingCharges: number; // fixed or per gram
  makingChargeType: 'fixed' | 'per_gram';
  additionalCharges: number;
  design: string;
  occasion: string;
}

export interface SareeSpecification {
  fabric: string;
  blousePiece: boolean;
  weaveType: string;
  length: string;
  washCare: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  type: 'jewellery' | 'saree' | 'dress' | 'fashion';
  description: string;
  shortDescription: string;
  images: string[];
  basePrice: number;
  discount: number; // percentage
  active: boolean;
  featured: boolean;
  bestseller?: boolean;
  newArrival?: boolean;
  rating: number;
  reviewsCount: number;
  variants: ProductVariant[];
  jewellerySpec?: JewellerySpecification;
  sareeSpec?: SareeSpecification;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  itemCount: number;
  description: string;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  comment: string;
  rating: number;
  productName: string;
  avatar: string;
}

export interface MetalRate {
  metal: string;
  purity: string;
  ratePerGram: number;
  currency: string;
  updatedAt: string;
}

export const INITIAL_METAL_RATES: MetalRate[] = [
  { metal: 'Gold', purity: '22K (916)', ratePerGram: 7250, currency: 'INR', updatedAt: 'Today, 10:00 AM' },
  { metal: 'Gold', purity: '24K (999)', ratePerGram: 7890, currency: 'INR', updatedAt: 'Today, 10:00 AM' },
  { metal: 'Gold', purity: '18K (750)', ratePerGram: 5950, currency: 'INR', updatedAt: 'Today, 10:00 AM' },
  { metal: 'Silver', purity: '925 Sterling', ratePerGram: 92, currency: 'INR', updatedAt: 'Today, 10:00 AM' },
];

export const CATEGORIES: Category[] = [
  {
    id: 'gold-jewellery',
    name: 'Gold Jewellery',
    slug: 'gold-jewellery',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    itemCount: 48,
    description: 'Exquisite 22K certified temple & antique gold necklaces, bangles and jhumkas.'
  },
  {
    id: 'kanchipuram-sarees',
    name: 'Kanchipuram Sarees',
    slug: 'kanchipuram-sarees',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
    itemCount: 64,
    description: 'Pure mulberry silk sarees with rich pure gold zari weaving for weddings & festivities.'
  },
  {
    id: 'bridal-jewellery',
    name: 'Bridal Jewellery',
    slug: 'bridal-jewellery',
    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
    itemCount: 32,
    description: 'Royal bridal sets, Kemp stone chokers, maang tikkas and heavy waist belts.'
  },
  {
    id: 'banarasi-sarees',
    name: 'Banarasi Sarees',
    slug: 'banarasi-sarees',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
    itemCount: 40,
    description: 'Handcrafted Katan silk Banarasi sarees featuring intricate Mughal floral motifs.'
  },
  {
    id: 'silver-jewellery',
    name: 'Silver Jewellery',
    slug: 'silver-jewellery',
    image: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=800&q=80',
    itemCount: 55,
    description: '925 Sterling silver oxidized ghungroo payals, antique rings and statement sets.'
  },
  {
    id: 'designer-dresses',
    name: 'Designer Dresses & Lehengas',
    slug: 'designer-dresses',
    image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
    itemCount: 28,
    description: 'Stunning embroidered lehengas, Anarkalis and Indo-western fusion gowns.'
  }
];

export const PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Royal Heritage 22K Gold Kemp Necklace Set',
    slug: 'royal-heritage-22k-gold-kemp-necklace',
    category: 'Gold Jewellery',
    type: 'jewellery',
    description: 'Crafted with peerless precision in 22K yellow gold, embedded with authentic ruby Kemp stones and freshwater pearls. This regal bridal necklace set reflects centuries of South Indian royal heritage.',
    shortDescription: '22K Gold Temple Necklace with Kemp Rubies & Pearls',
    images: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80'
    ],
    basePrice: 145000,
    discount: 10,
    active: true,
    featured: true,
    bestseller: true,
    rating: 4.9,
    reviewsCount: 38,
    jewellerySpec: {
      metalType: 'Gold',
      purity: '22K (916)',
      grossWeight: 48.5,
      netWeight: 45.0,
      stoneWeight: 3.5,
      makingCharges: 12500,
      makingChargeType: 'fixed',
      additionalCharges: 1500,
      design: 'Temple Antique',
      occasion: 'Bridal / Wedding'
    },
    variants: [
      { sku: 'JWL-GLD-001-STD', colour: 'Antique Gold', size: 'Standard (Adjustable Dori)', weight: '48.5g', price: 145000, stock: 5 }
    ]
  },
  {
    id: 'prod-2',
    name: 'Varanasi Royal Brocade Katan Silk Saree',
    slug: 'varanasi-royal-brocade-katan-silk-saree',
    category: 'Kanchipuram Sarees',
    type: 'saree',
    description: 'Exquisite handwoven Katan silk saree in deep royal maroon with heavy gold zari jangla work across the drape. Comes with an unstitched matching heavy brocade blouse piece.',
    shortDescription: 'Pure Katan Silk Saree with Heavy Gold Zari Weaving',
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80'
    ],
    basePrice: 24500,
    discount: 15,
    active: true,
    featured: true,
    bestseller: true,
    rating: 4.8,
    reviewsCount: 52,
    sareeSpec: {
      fabric: 'Pure Katan Silk',
      blousePiece: true,
      weaveType: 'Handwoven Zari Jangla',
      length: '6.5 Meters (Includes 1m Blouse)',
      washCare: 'Dry Clean Only'
    },
    variants: [
      { sku: 'SAR-KAT-002-MRN', colour: 'Royal Maroon & Gold', size: 'Standard 6.5m', weight: '780g', price: 24500, stock: 12 },
      { sku: 'SAR-KAT-002-EMR', colour: 'Emerald Green & Gold', size: 'Standard 6.5m', weight: '780g', price: 24500, stock: 8 }
    ]
  },
  {
    id: 'prod-3',
    name: 'Traditional Kemp Nakshatra Jhumkas',
    slug: 'traditional-kemp-nakshatra-jhumkas',
    category: 'Bridal Jewellery',
    type: 'jewellery',
    description: 'Handcrafted traditional temple jhumkas featuring goddess Lakshmi motifs, ruby red stones, and delicate pearl drops. BIS hallmarked 22K gold.',
    shortDescription: '22K Gold Temple Goddess Jhumkas with Pearls',
    images: [
      'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80'
    ],
    basePrice: 42000,
    discount: 5,
    active: true,
    featured: true,
    newArrival: true,
    rating: 4.9,
    reviewsCount: 19,
    jewellerySpec: {
      metalType: 'Gold',
      purity: '22K (916)',
      grossWeight: 14.2,
      netWeight: 13.0,
      stoneWeight: 1.2,
      makingCharges: 3500,
      makingChargeType: 'fixed',
      additionalCharges: 500,
      design: 'Nakshatra Temple',
      occasion: 'Festive / Party'
    },
    variants: [
      { sku: 'JWL-JHM-003-STD', colour: 'Gold & Ruby', size: 'Standard Drop', weight: '14.2g', price: 42000, stock: 10 }
    ]
  },
  {
    id: 'prod-4',
    name: 'Gadwal Handloom Silk Saree in Magenta Pink',
    slug: 'gadwal-handloom-silk-saree-magenta',
    category: 'Gadwal Sarees',
    type: 'saree',
    description: 'Handcrafted Gadwal silk saree with distinctive interlocked wieft (Kuppada pattu) technique. Vibrant magenta pink body with contrasting rich gold zari pallu.',
    shortDescription: 'Handloom Gadwal Silk Saree with Zari Pallu',
    images: [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80'
    ],
    basePrice: 16800,
    discount: 10,
    active: true,
    featured: true,
    bestseller: true,
    rating: 4.7,
    reviewsCount: 24,
    sareeSpec: {
      fabric: 'Gadwal Silk & Cotton Mix',
      blousePiece: true,
      weaveType: 'Kuppada Handloom',
      length: '6.5 Meters',
      washCare: 'Dry Clean Only'
    },
    variants: [
      { sku: 'SAR-GDW-004-MAG', colour: 'Magenta & Gold', size: 'Standard 6.5m', weight: '650g', price: 16800, stock: 15 }
    ]
  },
  {
    id: 'prod-5',
    name: 'Antique Oxidized Silver Statement Payal & Toe Rings',
    slug: 'antique-oxidized-silver-statement-payal',
    category: 'Silver Jewellery',
    type: 'jewellery',
    description: '925 Sterling silver heavy ghungroo payal set with intricate tribal motifs and oxidized finish. Perfect for ethnic occasions and bridal wear.',
    shortDescription: '925 Sterling Silver Heavy Ghungroo Payal',
    images: [
      'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'
    ],
    basePrice: 8500,
    discount: 12,
    active: true,
    featured: false,
    newArrival: true,
    rating: 4.6,
    reviewsCount: 31,
    jewellerySpec: {
      metalType: 'Silver',
      purity: '925 Silver',
      grossWeight: 85.0,
      netWeight: 85.0,
      stoneWeight: 0,
      makingCharges: 1500,
      makingChargeType: 'fixed',
      additionalCharges: 200,
      design: 'Oxidized Tribal Ghungroo',
      occasion: 'Traditional / Daily'
    },
    variants: [
      { sku: 'JWL-SLV-005-STD', colour: 'Oxidized Silver', size: '10.5 Inch', weight: '85g', price: 8500, stock: 20 }
    ]
  },
  {
    id: 'prod-6',
    name: 'Royal Zardozi Embroidered Velvet Lehenga Set',
    slug: 'royal-zardozi-embroidered-velvet-lehenga',
    category: 'Designer Dresses',
    type: 'dress',
    description: 'Luxurious royal maroon velvet lehenga intricately hand-embroidered with real gold zardozi, dabka, and pearl work. Accompanied by a heavily embellished net dupatta.',
    shortDescription: 'Royal Maroon Velvet Lehenga with Gold Zardozi Work',
    images: [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80'
    ],
    basePrice: 58000,
    discount: 20,
    active: true,
    featured: true,
    bestseller: true,
    rating: 5.0,
    reviewsCount: 14,
    sareeSpec: {
      fabric: 'Pure Velvet & Net Dupatta',
      blousePiece: true,
      weaveType: 'Hand Zardozi Embroidery',
      length: 'Customizable Stitched',
      washCare: 'Professional Dry Clean Only'
    },
    variants: [
      { sku: 'DRS-LEH-006-S', colour: 'Royal Maroon', size: 'Small (36)', weight: '2.5kg', price: 58000, stock: 3 },
      { sku: 'DRS-LEH-006-M', colour: 'Royal Maroon', size: 'Medium (38)', weight: '2.5kg', price: 58000, stock: 5 },
      { sku: 'DRS-LEH-006-L', colour: 'Royal Maroon', size: 'Large (40)', weight: '2.5kg', price: 58000, stock: 4 }
    ]
  },
  {
    id: 'prod-7',
    name: 'Pure Kanchipuram Bridal Pattu Saree in Gold & Crimson',
    slug: 'pure-kanchipuram-bridal-pattu-saree',
    category: 'Kanchipuram Sarees',
    type: 'saree',
    description: 'Authentic 4-ply pure mulberry silk Kanchipuram pattu saree with heavy gold zari brocade peacock pallu. Certified Silk Mark India guarantee.',
    shortDescription: 'Pure Silk Kanchipuram Saree with Silk Mark',
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80'
    ],
    basePrice: 32000,
    discount: 10,
    active: true,
    featured: true,
    bestseller: true,
    rating: 4.9,
    reviewsCount: 44,
    sareeSpec: {
      fabric: '100% Pure Mulberry Silk',
      blousePiece: true,
      weaveType: 'Handloom Pure Zari',
      length: '6.5 Meters',
      washCare: 'Dry Clean Only'
    },
    variants: [
      { sku: 'SAR-KAN-007-CRM', colour: 'Crimson & Gold', size: 'Standard 6.5m', weight: '820g', price: 32000, stock: 7 }
    ]
  },
  {
    id: 'prod-8',
    name: 'Temple Lakshmi Kasu Gold Choker Necklace',
    slug: 'temple-lakshmi-kasu-gold-choker',
    category: 'Gold Jewellery',
    type: 'jewellery',
    description: 'Stunning 22K gold coin (Kasu) choker necklace featuring Goddess Lakshmi motifs bordered with ruby stones. An absolute masterpiece for weddings.',
    shortDescription: '22K Gold Lakshmi Kasu Choker Necklace',
    images: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80'
    ],
    basePrice: 115000,
    discount: 8,
    active: true,
    featured: true,
    newArrival: true,
    rating: 4.8,
    reviewsCount: 22,
    jewellerySpec: {
      metalType: 'Gold',
      purity: '22K (916)',
      grossWeight: 36.4,
      netWeight: 34.0,
      stoneWeight: 2.4,
      makingCharges: 9800,
      makingChargeType: 'fixed',
      additionalCharges: 1000,
      design: 'Lakshmi Kasu',
      occasion: 'Bridal / Festive'
    },
    variants: [
      { sku: 'JWL-KAS-008-STD', colour: 'Gold & Ruby', size: 'Adjustable Choker', weight: '36.4g', price: 115000, stock: 4 }
    ]
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'test-1',
    name: 'Sravani Reddy',
    location: 'Hyderabad',
    comment: 'The Kanchipuram silk saree I ordered for my sister wedding was breathtaking! The gold zari work and fabric quality exceeded expectations. SDA Collections is truly world-class.',
    rating: 5,
    productName: 'Pure Kanchipuram Bridal Pattu Saree',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
  },
  {
    id: 'test-2',
    name: 'Dr. Rajeshwari Sharma',
    location: 'Bengaluru',
    comment: 'Bought the 22K Kemp necklace set. The price breakdown transparently showed the metal rate and making charges. Very genuine gold purity with BIS hallmark certificate.',
    rating: 5,
    productName: 'Royal Heritage 22K Gold Kemp Necklace Set',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
  },
  {
    id: 'test-3',
    name: 'Anusha Varma',
    location: 'Chennai',
    comment: 'Shop Smart... Be Stylish... SDA Collections lives up to this slogan entirely! Excellent customer support and lightning fast delivery to Chennai.',
    rating: 5,
    productName: 'Varanasi Royal Brocade Katan Silk Saree',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80'
  }
];

export const BANNER_SLIDES = [
  {
    id: 'slide-1',
    title: 'Discover Your Royal Style',
    subtitle: 'Jewellery, sarees and designer fashion curated for every special occasion.',
    badge: 'NEW BRIDAL EDIT 2026',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1600&q=80',
    ctaPrimary: 'Shop Now',
    ctaSecondary: 'Explore Collections'
  },
  {
    id: 'slide-2',
    title: 'Timeless Kanchipuram Pattu Sarees',
    subtitle: 'Handwoven pure mulberry silk drapes infused with 24K gold zari.',
    badge: 'FESTIVE SPECIAL',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1600&q=80',
    ctaPrimary: 'Explore Sarees',
    ctaSecondary: 'View Offers'
  },
  {
    id: 'slide-3',
    title: 'Exquisite 22K Temple Jewellery',
    subtitle: 'BIS Hallmarked antique gold sets crafted by master South Indian artisans.',
    badge: 'CERTIFIED 916 GOLD',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1600&q=80',
    ctaPrimary: 'Discover Jewellery',
    ctaSecondary: 'Check Gold Rates'
  }
];
