export type ProductSummary = {
  id: number;
  name: string;
  nameEn?: string;
  price?: string;
  pricePromo?: string;
  currentPrice?: string;
  currency?: string;
  imageUrl?: string;
  urlSlug?: string;
  source?: 'list' | 'algolia';
  listNames?: string[];
};

export type ProductDetail = Record<string, unknown>;

export type ListProduct = {
  productId: number;
  quantity: number;
};

export type ListSummary = {
  id: number;
  name: string;
  type?: string;
  publicId?: string | null;
  isReadOnly?: boolean;
  products?: ListProduct[];
};

export type SearchResult = {
  query: string;
  results: ProductSummary[];
  sourceCounts: {
    list: number;
    algolia: number;
  };
};

export type Config = {
  baseUrl?: string;
  algolia?: {
    appId: string;
    apiKey: string;
    host?: string;
  };
};

export type Session = {
  cookies?: string;
  updatedAt?: string;
  userAgent?: string;
};

export type ProductCacheEntry = {
  product: ProductSummary;
  cachedAt: string;
};

export type Cache = {
  products: Record<string, ProductSummary | ProductCacheEntry>;
  orders?: Record<
    string,
    {
      status?: number;
      updatedAt?: string;
      detail: OrderDetail;
    }
  >;
  updatedAt?: string;
};

export type DeliverySlot = {
  date: string;
  key: string;
  start: number;
  end: number;
  isAvailable: boolean;
  loadPercent: number;
  cutoffAfter?: string | null;
  isPharmacyRestricted?: boolean;
  isBakeryRestricted?: boolean;
};

export type OrderSummary = {
  id: string;
  shippingDate?: string;
  timeSlotStart?: number;
  timeSlotEnd?: number;
  timeSlotDisplay?: string;
  status?: number;
  statusText?: string | null;
  finalAmount?: string;
  finalAmountEur?: string;
  additionalOrdersCount?: number;
  phone?: string;
};

export type OrderItem = {
  id?: number;
  name: string;
  quantity?: string;
  unit?: string;
  price?: string;
  priceEur?: string;
  regularPrice?: string;
  regularPriceEur?: string;
  group?: string;
};

export type OrderDetail = {
  id: string;
  status?: number;
  statusText?: string | null;
  shippingDate?: string;
  timeSlotDisplay?: string;
  address?: string;
  totals: {
    total?: string;
    totalEur?: string;
    totalPaid?: string;
    totalPaidEur?: string;
    discount?: string;
    discountEur?: string;
    tip?: string;
    tipEur?: string;
  };
  items: OrderItem[];
  additionalOrders?: OrderDetail[];
};
