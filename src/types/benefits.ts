export type ChannelType = 'bank' | 'platform' | 'travel' | 'retail';

export type AssetCategory = 'points' | 'voucher' | 'prepaid' | 'privilege';

export type LedgerTxType = 'earn' | 'consume' | 'expire' | 'adjust';

export interface BenefitAsset {
  id: string;
  name: string;
  channelName: string;
  channelType: ChannelType;
  appName: string;
  category: AssetCategory;
  unitLabel: string; // e.g. '分', '元', '张', '次'
  balance: number;
  initialBalance: number;
  rmbPerUnit: number; // valuation rate: for prepaid RMB card = 1; for points = e.g. 0.02; for voucher = face value
  appPath: string; // Detailed in-app path, e.g. "招商银行App → 搜索「高端权益」→ 精选权益 → 机场贵宾厅"
  expiryDate: string | null; // YYYY-MM-DD or null for perpetual
  snoozedUntil?: string | null; // YYYY-MM-DD if user snoozed reminder
  notes?: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  assetId: string;
  assetName: string;
  channelName: string;
  category: AssetCategory;
  type: LedgerTxType;
  deltaQuantity: number; // positive for earn/adjust-up, negative for consume/expire
  unitLabel: string;
  estimatedValueRmb: number; // absolute RMB value impact of this flow
  originalPriceRmb?: number; // original order/ticket price before benefit
  actualPaidRmb?: number; // out-of-pocket cash paid
  savedRmb: number; // actual discount / savings achieved
  merchantOrScene: string;
  date: string; // YYYY-MM-DD
  notes?: string;
}

export interface ReminderSettings {
  warningWindowDays: number; // default 30
  urgentWindowDays: number; // default 7
}

export type ActiveTab =
  | 'overview'
  | 'catalog'
  | 'reminders'
  | 'ledger'
  | 'savings';

export interface AssetCompositeSummary {
  asset: BenefitAsset;
  currentValueRmb: number;
  earnedTotal: number;
  consumedTotal: number;
  expiredTotal: number;
  totalSavedRmb: number;
  txCount: number;
}

export interface DailyTrendPoint {
  date: string;
  label: string;
  totalAssetRmb: number;
  cumulativeSavedRmb: number;
  inflowRmb: number;
  consumptionRmb: number;
  expiryLossRmb: number;
}
