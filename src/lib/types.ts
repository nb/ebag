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

export type Cache = {
  products: Record<string, ProductSummary>;
  updatedAt?: string;
};
