export type ItemStatus = '未開封' | '已開封' | '已用完';

export interface Trip {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  note?: string;
}

export interface Invoice {
  id: string;
  tripId?: string;
  shopName: string;
  shopAddress?: string;
  country?: string;
  tel?: string;
  currency: string;
  txDate: string;
  txTime: string;
  totalAmount: number;
  totalAmountHomeCurrency?: number;
}

export interface Item {
  id: string;
  invoiceId: string;
  barcode?: string;
  nameOriginal: string;
  nameChinese: string;
  type: string;
  qty: number;
  price: number;
  priceHomeCurrency?: number;
  currency: string;
  discount: number;
  expiryDate?: string;
  openDate?: string;
  status: ItemStatus;
}

export interface Settings {
  homeCurrency: string;
  geminiApiKey?: string;
  geminiModel?: string;
  exchangeRates: Record<string, number>;
}
