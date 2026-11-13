import React, { useMemo } from 'react';
import { ArrowRight, Bell, Copy, PlusCircle } from 'lucide-react';
import { ActiveTab, BenefitAsset, LedgerEntry, ReminderSettings } from '../types/benefits';
import {
  ASSET_CATEGORY_LABELS,
  formatCurrency,
  formatQuantity,
  getAssetValueRmb,
  getDaysUntilExpiry,
  getExpiryUrgency,
} from '../utils/calculations';
import { TrendCharts } from './TrendCharts';

interface OverviewViewProps {
  assets: BenefitAsset[];
  ledger: LedgerEntry[];
  settings: ReminderSettings;
  onNavigate: (tab: ActiveTab) => void;
  onOpenAssetModal: () => void;
  onOpenConsumeModal: (assetId?: string) => void;
  onCopyPath: (path: string, name: string) => void;
  onSelectAsset: (asset: BenefitAsset) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  assets,
  ledger,
  settings,
  onNavigate,
  onOpenAssetModal,
  onOpenConsumeModal,
  onCopyPath,
  onSelectAsset,
}) => {
  const kpis = useMemo(() => {
    const totalValuation = assets.reduce((sum, a) => sum + getAssetValueRmb(a), 0);
    const totalSaved = ledger.reduce((sum, tx) => sum + (tx.savedRmb || 0), 0);

    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthSaved = ledger
      .filter((tx) => tx.date.startsWith(monthPrefix))
      .reduce((sum, tx) => sum + (tx.savedRmb || 0), 0);

    const expiringAssets = assets.filter((a) => {
      if (a.balance <= 0) return false;
      const days = getDaysUntilExpiry(a.expiryDate);
      return days !== null && days <= settings.warningWindowDays;
    });
    const expiringValue = expiringAssets.reduce((sum, a) => sum + getAssetValueRmb(a), 0);
    const activeCount = assets.filter((a) => a.balance > 0).length;
    const channelCount = new Set(assets.map((a) => a.channelName)).size;

    return {
      totalValuation,
      totalSaved,
      monthSaved,
      expiringCount: expiringAssets.length,
      expiringValue,
      activeCount,
      channelCount,
    };
  }, [assets, ledger, settings.warningWindowDays]);

  const urgentWatchlist = useMemo(() => {
    return assets
      .filter((a) => {
        if (a.balance <= 0) return false;
        const days = getDaysUntilExpiry(a.expiryDate);
        return days !== null && days <= settings.warningWindowDays;
      })
      .sort((a, b) => {
        const da = getDaysUntilExpiry(a.expiryDate) ?? 9999;
        const db = getDaysUntilExpiry(b.expiryDate) ?? 9999;
        return da - db;
      })
      .slice(0, 5);
  }, [assets, settings.warningWindowDays]);

  const recentTransactions = useMemo(() => {
    return [...ledger]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
  }, [ledger]);

  return (
    <div className="space-y-6">
      {assets.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">开始建立你的全渠道权益账本</h2>
            <p className="mt-1 text-xs text-slate-500">
              当前暂无示例数据，点击右侧按钮录入你的银行积分、储值卡、有价卡券及 App 内访问路径。
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAssetModal}
            className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            录入第一项权益
          </button>
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">全渠道权益预估总值</div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-slate-900 tracking-tight">
            {formatCurrency(kpis.totalValuation)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            覆盖 {kpis.channelCount} 个渠道 · {kpis.activeCount} 项可用资产
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">累计实际节省优惠</div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-emerald-700 tracking-tight">
            {formatCurrency(kpis.totalSaved)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            本月已省 <span className="font-mono-num font-medium text-slate-800">{formatCurrency(kpis.monthSaved)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {settings.warningWindowDays}天内临期资产风险
            </span>
            {kpis.expiringCount > 0 && (
              <span className="text-xs font-medium text-amber-700">需优先核销</span>
            )}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-amber-700 tracking-tight">
            {formatCurrency(kpis.expiringValue)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>共 {kpis.expiringCount} 项卡券/积分临期</span>
            <button
              type="button"
              onClick={() => onNavigate('reminders')}
              className="text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              查看提醒
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">消长记录流水</div>
            <div className="mt-2 text-2xl font-bold font-mono-num text-slate-900 tracking-tight">
              {ledger.length} <span className="text-sm font-normal text-slate-500">笔</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">支持核销记优惠与入账</span>
            <button
              type="button"
              onClick={() => onOpenConsumeModal()}
              className="text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              记一笔
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Trend Charts */}
      <TrendCharts assets={assets} ledger={ledger} />

      {/* Bottom 2-Column Operational Feeds */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Expiring Watchlist */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">即将过期消费提醒</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reminders')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              全部提醒 ({kpis.expiringCount})
            </button>
          </div>

          {urgentWatchlist.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              当前 {settings.warningWindowDays} 天内无即将过期的有价卡券或积分。
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {urgentWatchlist.map((asset) => {
                const days = getDaysUntilExpiry(asset.expiryDate) ?? 0;
                const urgency = getExpiryUrgency(
                  asset.expiryDate,
                  settings.urgentWindowDays,
                  settings.warningWindowDays
                );
                const val = getAssetValueRmb(asset);
                return (
                  <div
                    key={asset.id}
                    className="px-5 py-3.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectAsset(asset)}
                          className="text-sm font-medium text-slate-900 hover:text-teal-700 truncate text-left cursor-pointer"
                        >
                          {asset.name}
                        </button>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>{asset.channelName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num text-slate-700">
                          余 {formatQuantity(asset.balance, asset.unitLabel)} (约 {formatCurrency(val)})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-medium ${
                            urgency === 'expired' || urgency === 'urgent'
                              ? 'text-red-600'
                              : 'text-amber-700'
                          }`}
                        >
                          {days < 0
                            ? `已过期 ${Math.abs(days)} 天`
                            : days === 0
                              ? '今日到期'
                              : `剩 ${days} 天 (${asset.expiryDate})`}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400 truncate max-w-md">
                        路径: {asset.appPath}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onCopyPath(asset.appPath, asset.name)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        title="复制App内路径"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        复制路径
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenConsumeModal(asset.id)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        核销消费
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Ledger Highlights */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">近期消长与优惠核销记录</h2>
            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              查看完整明细
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              暂无消长或核销记录，录入权益并核销后将在此展示流水动态。
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((tx) => {
              const isPositive = tx.deltaQuantity > 0;
              const typeText =
                tx.type === 'earn'
                  ? '入账获取'
                  : tx.type === 'consume'
                    ? '消费核销'
                    : tx.type === 'expire'
                      ? '过期作废'
                      : '盘点调整';
              return (
                <div
                  key={tx.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {tx.merchantOrScene}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="font-mono-num">{tx.date}</span>
                      <span aria-hidden="true">·</span>
                      <span>{tx.channelName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ASSET_CATEGORY_LABELS[tx.category]}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          tx.type === 'expire'
                            ? 'text-red-600'
                            : tx.type === 'earn'
                              ? 'text-teal-700'
                              : 'text-slate-600'
                        }
                      >
                        {typeText}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-mono-num font-medium ${
                        tx.type === 'expire'
                          ? 'text-red-600'
                          : isPositive
                            ? 'text-teal-700'
                            : 'text-slate-900'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {formatQuantity(tx.deltaQuantity, tx.unitLabel)}
                    </div>
                    {tx.savedRmb > 0 ? (
                      <div className="mt-0.5 text-xs font-mono-num text-emerald-700">
                        省 {formatCurrency(tx.savedRmb)}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs font-mono-num text-slate-400">
                        估值 {formatCurrency(tx.estimatedValueRmb)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
