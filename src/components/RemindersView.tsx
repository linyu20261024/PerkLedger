import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, Clock, Copy } from 'lucide-react';
import { BenefitAsset, ReminderSettings } from '../types/benefits';
import {
  ASSET_CATEGORY_LABELS,
  formatCurrency,
  formatQuantity,
  getAssetValueRmb,
  getDaysUntilExpiry,
} from '../utils/calculations';

interface RemindersViewProps {
  assets: BenefitAsset[];
  settings: ReminderSettings;
  onUpdateSettings: (next: ReminderSettings) => void;
  onOpenConsumeModal: (assetId: string) => void;
  onMarkExpired: (asset: BenefitAsset) => void;
  onSnoozeAsset: (assetId: string, days: number | null) => void;
  onCopyPath: (path: string, name: string) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  assets,
  settings,
  onUpdateSettings,
  onOpenConsumeModal,
  onMarkExpired,
  onSnoozeAsset,
  onCopyPath,
}) => {
  const [filterScope, setFilterScope] = useState<'active' | 'all' | 'snoozed'>('active');

  const todayISO = new Date().toISOString().slice(0, 10);

  const classified = useMemo(() => {
    const withExpiry = assets
      .filter((a) => a.balance > 0 && a.expiryDate !== null)
      .map((a) => {
        const days = getDaysUntilExpiry(a.expiryDate)!;
        const isSnoozed = Boolean(a.snoozedUntil && a.snoozedUntil > todayISO);
        return { asset: a, days, value: getAssetValueRmb(a), isSnoozed };
      })
      .sort((a, b) => a.days - b.days);

    const activeAlerts = withExpiry.filter(
      (item) => item.days <= settings.warningWindowDays && !item.isSnoozed
    );
    const snoozedAlerts = withExpiry.filter((item) => item.isSnoozed);

    const urgent = activeAlerts.filter((i) => i.days <= settings.urgentWindowDays);
    const upcoming = activeAlerts.filter((i) => i.days > settings.urgentWindowDays);
    const longTerm = withExpiry.filter((i) => i.days > settings.warningWindowDays);

    const totalAtRisk = activeAlerts.reduce((sum, i) => sum + i.value, 0);

    return {
      activeAlerts,
      snoozedAlerts,
      urgent,
      upcoming,
      longTerm,
      totalAtRisk,
    };
  }, [assets, settings.warningWindowDays, settings.urgentWindowDays, todayISO]);

  const listToDisplay =
    filterScope === 'active'
      ? classified.activeAlerts
      : filterScope === 'snoozed'
        ? classified.snoozedAlerts
        : [...classified.activeAlerts, ...classified.longTerm];

  return (
    <div className="space-y-5">
      {/* Top Control & Summary Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-600" />
            <h2 className="text-base font-semibold text-slate-900">临期卡券与积分消费提醒中心</h2>
          </div>
          <p className="text-xs text-slate-500">
            未来 {settings.warningWindowDays} 天内共有{' '}
            <span className="font-mono-num font-semibold text-slate-900">
              {classified.activeAlerts.length}
            </span>{' '}
            项权益即将过期，待抢救资产价值约{' '}
            <span className="font-mono-num font-semibold text-amber-700">
              {formatCurrency(classified.totalAtRisk)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>预警周期</span>
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
              {[15, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, warningWindowDays: d })
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    settings.warningWindowDays === d
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'active', label: `待处理 (${classified.activeAlerts.length})` },
                { id: 'all', label: '全部有期限资产' },
                { id: 'snoozed', label: `已暂缓 (${classified.snoozedAlerts.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterScope(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterScope === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert List */}
      {listToDisplay.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-900">当前筛选下无待处理过期提醒</p>
          <p className="mt-1 text-xs text-slate-500">
            你可以调大上方预警周期天数，或切换至「全部有期限资产」提前规划消费。
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {listToDisplay.map(({ asset, days, value, isSnoozed }) => {
            const isOverdue = days < 0;
            const isUrgent = days >= 0 && days <= settings.urgentWindowDays;
            const isSoon = days > settings.urgentWindowDays && days <= settings.warningWindowDays;

            return (
              <div
                key={asset.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-mono-num font-semibold ${
                        isOverdue || isUrgent
                          ? 'text-red-600'
                          : isSoon
                            ? 'text-amber-700'
                            : 'text-slate-600'
                      }`}
                    >
                      {isOverdue
                        ? `[已过期 ${Math.abs(days)} 天]`
                        : days === 0
                          ? '[今日到期]'
                          : `[剩余 ${days} 天]`}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">{asset.name}</h3>
                    <span className="text-xs text-slate-500">
                      · {asset.channelName} · {ASSET_CATEGORY_LABELS[asset.category]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span>
                      剩余可用：
                      <strong className="font-mono-num text-slate-900">
                        {formatQuantity(asset.balance, asset.unitLabel)}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      风险价值：
                      <strong className="font-mono-num text-slate-900">
                        {formatCurrency(value)}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num text-slate-500">
                      截止日期：{asset.expiryDate}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5">
                    <span className="truncate">App路径：{asset.appPath}</span>
                    <button
                      type="button"
                      onClick={() => onCopyPath(asset.appPath, asset.name)}
                      className="text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 shrink-0 font-medium cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      复制路径
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isSnoozed ? (
                    <button
                      type="button"
                      onClick={() => onSnoozeAsset(asset.id, null)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      恢复提醒
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSnoozeAsset(asset.id, 3)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      暂缓3天
                    </button>
                  )}

                  {isOverdue && (
                    <button
                      type="button"
                      onClick={() => onMarkExpired(asset)}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                    >
                      记为过期损耗
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenConsumeModal(asset.id)}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    立即核销消费
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
