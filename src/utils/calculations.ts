import {
  AssetCategory,
  AssetCompositeSummary,
  BenefitAsset,
  ChannelType,
  DailyTrendPoint,
  LedgerEntry,
  MajorBenefitGroup,
  MembershipBillingCycle,
  MembershipRecord,
} from '../types/benefits';
import { formatISODate, getTodayISO, shiftDateISO } from '../data/seedData';

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  bank: '银行渠道',
  platform: '生活平台',
  retail: '商超零售',
  travel: '航司酒店',
};

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  points: '积分资产',
  voucher: '有价卡券',
  prepaid: '储值卡',
  privilege: '次数权益',
};

export const MAJOR_GROUP_LABELS: Record<MajorBenefitGroup, string> = {
  credit_points: '信用卡积分',
  prepaid_stored: '生活购物商旅平台储值',
  platform_points: '平台 / 航司 / 酒店积分',
  lounge_travel: '贵宾厅与商旅出行权益',
  health_care: '健康检查与医疗权益',
  voucher_coupon: '有价卡券与立减金',
  lifestyle_service: '居家洗车与文娱权益',
};

export const MAJOR_GROUP_ORDER: MajorBenefitGroup[] = [
  'prepaid_stored',
  'credit_points',
  'platform_points',
  'lounge_travel',
  'health_care',
  'voucher_coupon',
  'lifestyle_service',
];

export const BILLING_CYCLE_LABELS: Record<MembershipBillingCycle, string> = {
  monthly: '月卡',
  quarterly: '季卡',
  yearly: '年卡',
  custom: '自定义周期',
};

export function inferMajorGroup(
  category: AssetCategory,
  channelType: ChannelType,
  name = ''
): MajorBenefitGroup {
  const lower = name.toLowerCase();
  if (
    lower.includes('体检') ||
    lower.includes('健康') ||
    lower.includes('洗牙') ||
    lower.includes('洁牙') ||
    lower.includes('医疗') ||
    lower.includes('挂号')
  ) {
    return 'health_care';
  }
  if (
    lower.includes('贵宾') ||
    lower.includes('接送') ||
    lower.includes('房券') ||
    lower.includes('延误') ||
    lower.includes('快速安检')
  ) {
    return 'lounge_travel';
  }
  if (category === 'prepaid') return 'prepaid_stored';
  if (category === 'points') {
    return channelType === 'bank' ? 'credit_points' : 'platform_points';
  }
  if (category === 'voucher') return 'voucher_coupon';
  if (channelType === 'travel') return 'lounge_travel';
  return 'lifestyle_service';
}

export function formatCurrency(val: number): string {
  return `¥${val.toLocaleString('zh-CN', {
    minimumFractionDigits: val % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatQuantity(val: number, unit: string): string {
  const formatted = Number.isInteger(val)
    ? val.toLocaleString('zh-CN')
    : val.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  return `${formatted} ${unit}`;
}

export function getAssetValueRmb(asset: BenefitAsset): number {
  return Math.max(0, Number((asset.balance * asset.rmbPerUnit).toFixed(2)));
}

export function getDaysUntilExpiry(expiryDate: string | null, baseISO = getTodayISO()): number | null {
  if (!expiryDate) return null;
  const [ey, em, ed] = expiryDate.split('-').map(Number);
  const [by, bm, bd] = baseISO.split('-').map(Number);
  if (!ey || !em || !ed) return null;
  const exp = new Date(ey, em - 1, ed);
  const base = new Date(by, bm - 1, bd);
  return Math.round((exp.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

export type ExpiryUrgency = 'expired' | 'urgent' | 'soon' | 'normal' | 'perpetual';

export function getExpiryUrgency(
  expiryDate: string | null,
  urgentDays = 7,
  warningDays = 30
): ExpiryUrgency {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'perpetual';
  if (days < 0) return 'expired';
  if (days <= urgentDays) return 'urgent';
  if (days <= warningDays) return 'soon';
  return 'normal';
}

export function getExpiryLabel(expiryDate: string | null): string {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return '长期有效';
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return '今日到期';
  return `${days} 天后到期 (${expiryDate})`;
}

export function buildCompositeSummaries(
  assets: BenefitAsset[],
  ledger: LedgerEntry[]
): AssetCompositeSummary[] {
  return assets.map((asset) => {
    const entries = ledger.filter((tx) => tx.assetId === asset.id);
    let earnedTotal = 0;
    let consumedTotal = 0;
    let expiredTotal = 0;
    let totalSavedRmb = 0;

    for (const tx of entries) {
      if (tx.type === 'earn') {
        earnedTotal += Math.abs(tx.deltaQuantity);
      } else if (tx.type === 'consume') {
        consumedTotal += Math.abs(tx.deltaQuantity);
      } else if (tx.type === 'expire') {
        expiredTotal += Math.abs(tx.deltaQuantity);
      } else if (tx.type === 'adjust') {
        if (tx.deltaQuantity >= 0) earnedTotal += tx.deltaQuantity;
        else consumedTotal += Math.abs(tx.deltaQuantity);
      }
      totalSavedRmb += tx.savedRmb || 0;
    }

    return {
      asset,
      currentValueRmb: getAssetValueRmb(asset),
      earnedTotal,
      consumedTotal,
      expiredTotal,
      totalSavedRmb: Number(totalSavedRmb.toFixed(2)),
      txCount: entries.length,
    };
  });
}

export function buildDailyTrendSeries(
  assets: BenefitAsset[],
  ledger: LedgerEntry[],
  daysBack = 45
): DailyTrendPoint[] {
  const today = getTodayISO();
  const assetRateMap = new Map<string, number>();
  let currentTotalRmb = 0;

  for (const a of assets) {
    assetRateMap.set(a.id, a.rmbPerUnit);
    currentTotalRmb += getAssetValueRmb(a);
  }

  const byDate = new Map<string, LedgerEntry[]>();
  for (const tx of ledger) {
    const arr = byDate.get(tx.date) || [];
    arr.push(tx);
    byDate.set(tx.date, arr);
  }

  const totalSavedAllTime = ledger.reduce((sum, tx) => sum + (tx.savedRmb || 0), 0);

  const pointsReverse: DailyTrendPoint[] = [];
  let runningAssetRmb = currentTotalRmb;
  let runningSavedRmb = totalSavedAllTime;

  for (let i = 0; i < daysBack; i++) {
    const dateISO = shiftDateISO(today, -i);
    const dayTxs = byDate.get(dateISO) || [];

    let inflowRmb = 0;
    let consumptionRmb = 0;
    let expiryLossRmb = 0;
    let dayNetAssetDeltaRmb = 0;
    let daySavedRmb = 0;

    for (const tx of dayTxs) {
      const rate = assetRateMap.get(tx.assetId) ?? 1;
      const val = Math.abs(tx.deltaQuantity * rate);
      if (tx.type === 'earn') {
        inflowRmb += val;
        dayNetAssetDeltaRmb += val;
      } else if (tx.type === 'consume') {
        consumptionRmb += val;
        dayNetAssetDeltaRmb -= val;
      } else if (tx.type === 'expire') {
        expiryLossRmb += val;
        dayNetAssetDeltaRmb -= val;
      } else if (tx.type === 'adjust') {
        if (tx.deltaQuantity >= 0) {
          inflowRmb += val;
          dayNetAssetDeltaRmb += val;
        } else {
          consumptionRmb += val;
          dayNetAssetDeltaRmb -= val;
        }
      }
      daySavedRmb += tx.savedRmb || 0;
    }

    const [, m, d] = dateISO.split('-');
    pointsReverse.push({
      date: dateISO,
      label: `${Number(m)}/${Number(d)}`,
      totalAssetRmb: Math.max(0, Number(runningAssetRmb.toFixed(2))),
      cumulativeSavedRmb: Math.max(0, Number(runningSavedRmb.toFixed(2))),
      inflowRmb: Number(inflowRmb.toFixed(2)),
      consumptionRmb: Number(consumptionRmb.toFixed(2)),
      expiryLossRmb: Number(expiryLossRmb.toFixed(2)),
    });

    runningAssetRmb -= dayNetAssetDeltaRmb;
    runningSavedRmb -= daySavedRmb;
  }

  return pointsReverse.reverse();
}

function downloadCSV(filename: string, headers: string[], rows: string[][]): void {
  const csvContent =
    '\uFEFF' +
    [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportLedgerToCSV(ledger: LedgerEntry[]): void {
  const headers = [
    '日期',
    '渠道',
    '权益名称',
    '变动类型',
    '数量变动',
    '单位',
    '折合价值(元)',
    '原价(元)',
    '实付(元)',
    '节省优惠(元)',
    '消费场景/商户',
    '备注',
  ];
  const typeLabel: Record<string, string> = {
    earn: '获取/入账',
    consume: '核销/消费',
    expire: '过期作废',
    adjust: '盘点调整',
  };

  const rows = ledger.map((tx) => [
    tx.date,
    tx.channelName,
    tx.assetName,
    typeLabel[tx.type] || tx.type,
    String(tx.deltaQuantity),
    tx.unitLabel,
    String(tx.estimatedValueRmb),
    tx.originalPriceRmb != null ? String(tx.originalPriceRmb) : '',
    tx.actualPaidRmb != null ? String(tx.actualPaidRmb) : '',
    String(tx.savedRmb),
    tx.merchantOrScene,
    tx.notes || '',
  ]);

  downloadCSV(`权益消长与优惠明细_${formatISODate(new Date())}.csv`, headers, rows);
}

export function exportAssetsToCSV(assets: BenefitAsset[]): void {
  const headers = [
    '权益名称',
    '所属渠道',
    '渠道分类',
    '所属App',
    '资产类型',
    '权益大类',
    '当前余额',
    '计量单位',
    '单价估值(元)',
    '折合总值(元)',
    'App内访问路径',
    '到期日期',
    '备注',
  ];

  const rows = assets.map((a) => [
    a.name,
    a.channelName,
    CHANNEL_TYPE_LABELS[a.channelType],
    a.appName,
    ASSET_CATEGORY_LABELS[a.category],
    MAJOR_GROUP_LABELS[a.majorGroup || inferMajorGroup(a.category, a.channelType, a.name)],
    String(a.balance),
    a.unitLabel,
    String(a.rmbPerUnit),
    String(getAssetValueRmb(a)),
    a.appPath,
    a.expiryDate || '长期有效',
    a.notes || '',
  ]);

  downloadCSV(`全渠道权益资产台账_${formatISODate(new Date())}.csv`, headers, rows);
}

export function exportMembershipsToCSV(memberships: MembershipRecord[]): void {
  const headers = [
    '会员名称',
    '所属平台/机构',
    '会员等级',
    '续费周期',
    '会费成本(元)',
    '是否自动续费',
    '到期/续卡日期',
    '提前提醒天数',
    'App内续费/管理路径',
    '核心权益摘要',
    '备注',
  ];

  const rows = memberships.map((m) => [
    m.name,
    m.platform,
    m.tierLevel,
    BILLING_CYCLE_LABELS[m.billingCycle],
    String(m.feeRmb),
    m.autoRenew ? '是' : '否',
    m.expiryDate,
    String(m.remindBeforeDays),
    m.appPath,
    m.corePerks,
    m.notes || '',
  ]);

  downloadCSV(`会员体系与续卡台账_${formatISODate(new Date())}.csv`, headers, rows);
}

export function downloadAssetCsvTemplate(): void {
  const headers = [
    '权益名称',
    '所属渠道',
    '渠道分类(bank/platform/retail/travel)',
    '所属App',
    '资产类型(points/prepaid/voucher/privilege)',
    '权益大类(credit_points/prepaid_stored/platform_points/lounge_travel/health_care/voucher_coupon/lifestyle_service)',
    '当前余额',
    '计量单位',
    '单价估值',
    'App内访问路径',
    '到期日期(YYYY-MM-DD或空)',
    '备注',
  ];
  const sampleRow = [
    '示例：某银行信用卡积分（可删改此行）',
    '某银行',
    'bank',
    '银行App',
    'points',
    'credit_points',
    '10000',
    '分',
    '0.02',
    '银行App -> 我的 -> 积分兑换',
    '2026-12-31',
    '按实际需求修改后导入',
  ];
  downloadCSV('权益批量导入模板.csv', headers, [sampleRow]);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseAssetsFromCSV(rawText: string): BenefitAsset[] {
  const clean = rawText.replace(/^\uFEFF/, '');
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const today = getTodayISO();
  const reverseChannelType: Record<string, ChannelType> = {
    bank: 'bank',
    银行渠道: 'bank',
    platform: 'platform',
    生活平台: 'platform',
    retail: 'retail',
    商超零售: 'retail',
    travel: 'travel',
    航司酒店: 'travel',
  };
  const reverseCategory: Record<string, AssetCategory> = {
    points: 'points',
    积分资产: 'points',
    prepaid: 'prepaid',
    储值卡: 'prepaid',
    voucher: 'voucher',
    有价卡券: 'voucher',
    privilege: 'privilege',
    次数权益: 'privilege',
  };
  const reverseMajorGroup: Record<string, MajorBenefitGroup> = {
    credit_points: 'credit_points',
    信用卡积分: 'credit_points',
    prepaid_stored: 'prepaid_stored',
    生活购物商旅平台储值: 'prepaid_stored',
    platform_points: 'platform_points',
    '平台 / 航司 / 酒店积分': 'platform_points',
    lounge_travel: 'lounge_travel',
    贵宾厅与商旅出行权益: 'lounge_travel',
    health_care: 'health_care',
    健康检查与医疗权益: 'health_care',
    voucher_coupon: 'voucher_coupon',
    有价卡券与立减金: 'voucher_coupon',
    lifestyle_service: 'lifestyle_service',
    居家洗车与文娱权益: 'lifestyle_service',
  };

  // Detect whether exported CSV (13 cols, col 9 is total value) or template CSV (12 cols)
  const headerCols = parseCSVLine(lines[0]);
  const hasTotalCol = headerCols.some((h) => h.includes('折合总值'));

  const results: BenefitAsset[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 7) continue;

    const name = cols[0];
    const channelName = cols[1];
    if (!name || !channelName) continue;

    const channelType = reverseChannelType[cols[2]] || 'platform';
    const appName = cols[3] || `${channelName}App`;
    const category = reverseCategory[cols[4]] || 'points';
    const rawGroup = cols[5];
    const majorGroup =
      reverseMajorGroup[rawGroup] || inferMajorGroup(category, channelType, name);

    const balance = Math.max(0, Number(cols[6]) || 0);
    const unitLabel = cols[7] || '份';
    const rmbPerUnit = Math.max(0, Number(cols[8]) || 0);

    const offset = hasTotalCol ? 1 : 0;
    const appPath = cols[9 + offset] || `${appName} -> 权益中心`;
    const rawExpiry = cols[10 + offset] || '';
    const expiryDate =
      rawExpiry && rawExpiry !== '长期有效' && /^\d{4}-\d{2}-\d{2}$/.test(rawExpiry)
        ? rawExpiry
        : null;
    const notes = cols[11 + offset] || undefined;

    results.push({
      id: `ast-imp-${Date.now()}-${i}`,
      name,
      channelName,
      channelType,
      appName,
      category,
      majorGroup,
      unitLabel,
      balance,
      initialBalance: balance,
      rmbPerUnit,
      appPath,
      expiryDate,
      notes,
      updatedAt: today,
    });
  }

  return results;
}
