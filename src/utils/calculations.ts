import {
  AssetCategory,
  AssetCompositeSummary,
  BenefitAsset,
  ChannelType,
  DailyTrendPoint,
  LedgerEntry,
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

/**
 * Reconstructs daily asset valuation, cumulative savings, and daily inflow/outflow
 * over the past N days by walking backwards from current asset balances using ledger entries.
 */
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

  // Group ledger entries by date
  const byDate = new Map<string, LedgerEntry[]>();
  for (const tx of ledger) {
    const arr = byDate.get(tx.date) || [];
    arr.push(tx);
    byDate.set(tx.date, arr);
  }

  // Compute total cumulative saved across all time first
  const totalSavedAllTime = ledger.reduce((sum, tx) => sum + (tx.savedRmb || 0), 0);

  // Build backwards from today down to today - daysBack + 1
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

    // Step backwards to yesterday's end-of-day balance
    runningAssetRmb -= dayNetAssetDeltaRmb;
    runningSavedRmb -= daySavedRmb;
  }

  return pointsReverse.reverse();
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

  const csvContent =
    '\uFEFF' +
    [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `权益消长与优惠明细_${formatISODate(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
