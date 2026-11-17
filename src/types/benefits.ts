export type ChannelType = 'bank' | 'platform' | 'travel' | 'retail';

export type AssetCategory = 'points' | 'voucher' | 'prepaid' | 'privilege';

export type MajorBenefitGroup =
  | 'credit_points' // 信用卡积分
  | 'prepaid_stored' // 生活购物商旅平台储值
  | 'platform_points' // 平台/航司/酒店积分
  | 'lounge_travel' // 贵宾厅与商旅出行权益
  | 'health_care' // 健康检查与医疗权益（含体检、口腔检查等）
  | 'voucher_coupon' // 有价卡券与立减金
  | 'home_car_service' // 居家与洗车服务权益
  | 'entertainment'; // 文娱与视听权益

export type LedgerTxType = 'earn' | 'consume' | 'expire' | 'adjust';

export interface BenefitAsset {
  id: string;
  name: string;
  channelName: string;
  channelType: ChannelType;
  appName: string;
  category: AssetCategory;
  majorGroup: MajorBenefitGroup;
  unitLabel: string; // e.g. '分', '元', '张', '次'
  balance: number;
  initialBalance: number;
  rmbPerUnit: number;
  appPath: string;
  expiryDate: string | null; // YYYY-MM-DD or null for perpetual
  snoozedUntil?: string | null;
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
  deltaQuantity: number;
  unitLabel: string;
  estimatedValueRmb: number;
  originalPriceRmb?: number;
  actualPaidRmb?: number;
  savedRmb: number;
  merchantOrScene: string;
  date: string; // YYYY-MM-DD
  notes?: string;
}

export type MembershipBillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface MembershipRecord {
  id: string;
  name: string; // e.g. 京东PLUS会员 / 招行经典白金卡
  platform: string; // e.g. 京东 / 招商银行 / 山姆
  tierLevel: string; // e.g. 年卡 / 黑钻会员 / 经典白
  feeRmb: number; // 年费或续费成本
  billingCycle: MembershipBillingCycle;
  autoRenew: boolean;
  expiryDate: string; // YYYY-MM-DD
  remindBeforeDays: number; // e.g. 15, 30
  appPath: string; // 查看或取消自动续费/续卡路径
  corePerks: string; // 包含核心权益摘要
  snoozedUntil?: string | null;
  notes?: string;
  updatedAt: string;
}

export interface ReminderSettings {
  warningWindowDays: number; // default 30
  urgentWindowDays: number; // default 7
}

export type ActiveTab =
  | 'overview'
  | 'catalog'
  | 'memberships'
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
