export type AssetType = 'JP_STOCK' | 'US_STOCK' | 'TRUST' | 'ETF' | 'bank' | 'cash' | 'credit' | 'other';
export type AccountType = 'TOKUTEI' | 'NISA_TSUMITATE' | 'NISA_GROWTH' | 'IDECO';
export type Currency = 'JPY' | 'USD';

export interface Asset {
  id: string;
  ticker?: string | null; // Optional for non-investment assets
  name: string;
  type: AssetType;
  account?: AccountType | null; // Optional for non-investment assets
  quantity?: number | null; // Optional for non-investment assets
  avgCost?: number | null; // In original currency, optional
  currency: Currency;
  currentPrice?: number | null; // In original currency
  dividendRate?: number | null;
  dividendYield?: number | null;
  nextDividendDate?: string | null;
  dividendFrequency?: 'quarterly' | 'semiannual' | 'annual' | 'monthly' | null;
  sector?: string | null;
  manualPrice?: number | null;
  // For cash/bank assets
  balance?: number | null;
  description?: string | null;
  createdAt?: number;
  updatedAt?: number;
  isArchived?: boolean;
}

export interface Dividend {
  id: string;
  assetId: string;
  date: string;
  amount: number; // In original currency
  currency: Currency;
}

export interface Portfolio {
  assets: Asset[];
  dividends: Dividend[];
}

export interface HistoryEntry {
  date: string;
  totalValue: number;
  totalCost: number;
  totalPL: number;
}

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  amount: number;
  type: TransactionType;
  category: string;
  description?: string;
  assetId?: string; // Optional: ID of the associated asset
  createdAt: number;
}



export interface CategoryRule {
  pattern: string;
  category: string;
}

export interface AnalysisLog {
  id: string;
  date: string;
  title: string;
  summary: string;
  script?: string | null;
  sources?: string | null; // JSON string
}
