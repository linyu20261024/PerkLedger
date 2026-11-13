import React, { useMemo } from 'react';
import { BenefitAsset, LedgerEntry } from '../types/benefits';
import {
  ASSET_CATEGORY_LABELS,
  formatCurrency,
  getAssetValueRmb,
} from '../utils/calculations';

interface SavingsSummaryViewProps {
  assets: BenefitAsset[];
  ledger: LedgerEntry[];
  onOpenConsumeModal: () => void;
}

export const SavingsSummaryView: React.FC<SavingsSummaryViewProps> = ({
  assets,
  ledger,
  onOpenConsumeModal,
}) => {
  const analytics = useMemo(() => {
    const savingTxs = ledger.filter((tx) => tx.savedRmb > 0);
    const totalSaved = savingTxs.reduce((sum, tx) => sum + tx.savedRmb, 0);
    const totalOriginalSpend = savingTxs.reduce(
      (sum, tx) => sum + (tx.originalPriceRmb ?? tx.savedRmb),
      0
    );
    const totalExpiredLoss = ledger
      .filter((tx) => tx.type === 'expire')
      .reduce((sum, tx) => sum + tx.estimatedValueRmb, 0);
    const remainingValue = assets.reduce((sum, a) => sum + getAssetValueRmb(a), 0);

    const avgSaveRate =
      totalOriginalSpend > 0 ? (totalSaved / totalOriginalSpend) * 100 : 0;

    // By channel
    const channelMap = new Map<
      string,
      { name: string; saved: number; count: number; original: number }
    >();
    for (const tx of savingTxs) {
      const cur = channelMap.get(tx.channelName) || {
        name: tx.channelName,
        saved: 0,
        count: 0,
        original: 0,
      };
      cur.saved += tx.savedRmb;
      cur.count += 1;
      cur.original += tx.originalPriceRmb ?? tx.savedRmb;
      channelMap.set(tx.channelName, cur);
    }
    const byChannel = Array.from(channelMap.values()).sort((a, b) => b.saved - a.saved);

    // By category
    const categoryMap = new Map<string, { label: string; saved: number; count: number }>();
    for (const tx of savingTxs) {
      const cur = categoryMap.get(tx.category) || {
        label: ASSET_CATEGORY_LABELS[tx.category],
        saved: 0,
        count: 0,
      };
      cur.saved += tx.savedRmb;
      cur.count += 1;
      categoryMap.set(tx.category, cur);
    }
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.saved - a.saved);

    // By month (last 6 months present)
    const monthMap = new Map<string, number>();
    for (const tx of savingTxs) {
      const ym = tx.date.slice(0, 7);
      monthMap.set(ym, (monthMap.get(ym) || 0) + tx.savedRmb);
    }
    const byMonth = Array.from(monthMap.entries())
      .map(([month, saved]) => ({ month, saved }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const topRedemptions = [...savingTxs]
      .sort((a, b) => b.savedRmb - a.savedRmb)
      .slice(0, 6);

    return {
      totalSaved,
      savingTxCount: savingTxs.length,
      totalOriginalSpend,
      totalExpiredLoss,
      remainingValue,
      avgSaveRate,
      byChannel,
      byCategory,
      byMonth,
      topRedemptions,
    };
  }, [assets, ledger]);

  const maxChannelSaved = analytics.byChannel[0]?.saved || 1;
  const maxMonthSaved = Math.max(1, ...analytics.byMonth.map((m) => m.saved));

  return (
    <div className="space-y-6">
      {/* Top 4 Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">累计优惠节省总额</div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-emerald-700">
            {formatCurrency(analytics.totalSaved)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            累计核销省钱 {analytics.savingTxCount} 笔
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">综合优惠折扣率</div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-slate-900">
            {analytics.avgSaveRate.toFixed(1)}%
          </div>
          <div className="mt-2 text-xs text-slate-500">
            覆盖消费原价 {formatCurrency(analytics.totalOriginalSpend)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">待释放存量权益估值</div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-teal-700">
            {formatCurrency(analytics.remainingValue)}
          </div>
          <div className="mt-2 text-xs text-slate-500">后续核销可继续转化为优惠</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">过期作废损耗统计</div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-red-600">
            {formatCurrency(analytics.totalExpiredLoss)}
          </div>
          <div className="mt-2 text-xs text-slate-500">通过临期提醒尽量降为零损耗</div>
        </div>
      </div>

      {/* Middle 2 Columns: Channel Ranking + Monthly Trend & Category Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">各渠道累计优惠贡献排行</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                统计银行、生活平台与储值卡消费核销实际节省金额
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenConsumeModal}
              className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
            >
              补充核销记录
            </button>
          </div>

          {analytics.byChannel.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              暂无优惠核销记录，消费后记一笔即可生成渠道对比。
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {analytics.byChannel.map((ch, idx) => {
                const pct = Math.max(4, (ch.saved / maxChannelSaved) * 100);
                const share =
                  analytics.totalSaved > 0 ? (ch.saved / analytics.totalSaved) * 100 : 0;
                return (
                  <div key={ch.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-slate-400 w-5">
                          0{idx + 1}.
                        </span>
                        <span className="font-medium text-slate-900">{ch.name}</span>
                        <span className="text-slate-400">· {ch.count}笔</span>
                      </div>
                      <div className="font-mono-num flex items-center gap-3">
                        <span className="text-slate-400">占比 {share.toFixed(1)}%</span>
                        <span className="font-semibold text-emerald-700 w-20 text-right">
                          {formatCurrency(ch.saved)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
              按资产类型节省分布
            </h2>
            {analytics.byCategory.length === 0 ? (
              <div className="py-6 text-xs text-slate-400">暂无核销节省记录</div>
            ) : (
              <div className="mt-4 space-y-3">
                {analytics.byCategory.map((cat) => {
                  const share =
                    analytics.totalSaved > 0 ? (cat.saved / analytics.totalSaved) * 100 : 0;
                  return (
                    <div key={cat.label} className="flex items-center justify-between text-xs">
                      <div className="text-slate-700">
                        <span className="font-medium text-slate-900">{cat.label}</span>
                        <span className="text-slate-400 ml-1.5">· {cat.count} 笔</span>
                      </div>
                      <div className="font-mono-num flex items-center gap-3">
                        <span className="text-slate-400">{share.toFixed(1)}%</span>
                        <span className="font-semibold text-slate-900 w-20 text-right">
                          {formatCurrency(cat.saved)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-700 mb-3">月度优惠落袋趋势</h3>
            {analytics.byMonth.length === 0 ? (
              <div className="py-6 text-xs text-slate-400">记录消费优惠后将自动汇总月度趋势</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 items-end h-32 pt-4">
                {analytics.byMonth.map((m) => {
                  const hPct = Math.max(12, (m.saved / maxMonthSaved) * 100);
                  return (
                    <div key={m.month} className="flex flex-col items-center justify-end h-full gap-1.5">
                      <span className="text-[11px] font-mono-num font-medium text-emerald-700">
                        {formatCurrency(m.saved)}
                      </span>
                      <div className="w-full max-w-[44px] flex-1 flex items-end">
                        <div
                          className="w-full bg-teal-700 rounded-t-md transition-all"
                          style={{ height: `${hPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono-num text-slate-500">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* High-Value Redemption Showcase */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">高价值优惠核销Top记录</h2>
        </div>
        {analytics.topRedemptions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            暂无高价值核销记录。
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {analytics.topRedemptions.map((tx) => (
              <div
                key={tx.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{tx.merchantOrScene}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <span className="font-mono-num">{tx.date}</span> · {tx.channelName} ·{' '}
                    {tx.assetName}
                  </div>
                </div>
                <div className="font-mono-num text-right shrink-0">
                  <div className="text-sm font-semibold text-emerald-700">
                    省 {formatCurrency(tx.savedRmb)}
                  </div>
                  {tx.originalPriceRmb != null && (
                    <div className="text-xs text-slate-400">
                      原价 {formatCurrency(tx.originalPriceRmb)} → 实付{' '}
                      {formatCurrency(tx.actualPaidRmb ?? 0)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
