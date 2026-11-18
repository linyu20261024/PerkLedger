import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, Clock, Copy, CreditCard, RefreshCw } from 'lucide-react';
import { BenefitAsset, MembershipRecord, ReminderSettings } from '../types/benefits';
import {
  ASSET_CATEGORY_LABELS,
  BILLING_CYCLE_LABELS,
  formatCurrency,
  formatQuantity,
  getAssetValueRmb,
  getDaysUntilExpiry,
  isMembershipLifetime,
} from '../utils/calculations';

interface RemindersViewProps {
  assets: BenefitAsset[];
  memberships: MembershipRecord[];
  settings: ReminderSettings;
  onUpdateSettings: (next: ReminderSettings) => void;
  onOpenConsumeModal: (assetId: string) => void;
  onMarkExpired: (asset: BenefitAsset) => void;
  onSnoozeAsset: (assetId: string, days: number | null) => void;
  onRenewMembership: (membership: MembershipRecord) => void;
  onSnoozeMembership: (id: string, days: number | null) => void;
  onCopyPath: (path: string, name: string) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  assets,
  memberships,
  settings,
  onUpdateSettings,
  onOpenConsumeModal,
  onMarkExpired,
  onSnoozeAsset,
  onRenewMembership,
  onSnoozeMembership,
  onCopyPath,
}) => {
  const [filterScope, setFilterScope] = useState<'active' | 'memberships' | 'all' | 'snoozed'>(
    'active'
  );

  const todayISO = new Date().toISOString().slice(0, 10);

  const classifiedAssets = useMemo(() => {
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
    const longTerm = withExpiry.filter((i) => i.days > settings.warningWindowDays);
    const totalAtRisk = activeAlerts.reduce((sum, i) => sum + i.value, 0);

    return {
      activeAlerts,
      snoozedAlerts,
      longTerm,
      totalAtRisk,
    };
  }, [assets, settings.warningWindowDays, todayISO]);

  const classifiedMemberships = useMemo(() => {
    return memberships
      .filter((m) => !isMembershipLifetime(m))
      .map((m) => {
        const days = getDaysUntilExpiry(m.expiryDate) ?? 9999;
        const isSnoozed = Boolean(m.snoozedUntil && m.snoozedUntil > todayISO);
        const isDue = days <= Math.max(m.remindBeforeDays, settings.warningWindowDays);
        return { membership: m, days, isSnoozed, isDue };
      })
      .filter((item) => item.isDue && !item.isSnoozed)
      .sort((a, b) => a.days - b.days);
  }, [memberships, settings.warningWindowDays, todayISO]);

  const listToDisplay =
    filterScope === 'active'
      ? classifiedAssets.activeAlerts
      : filterScope === 'snoozed'
        ? classifiedAssets.snoozedAlerts
        : [...classifiedAssets.activeAlerts, ...classifiedAssets.longTerm];

  return (
    <div className="space-y-5">
      {/* Top Control & Summary Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-600" />
            <h2 className="text-base font-semibold text-slate-900">
              临期卡券消费与会员续卡提醒中心
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            未来 {settings.warningWindowDays} 天内共有{' '}
            <span className="font-mono-num font-semibold text-slate-900">
              {classifiedAssets.activeAlerts.length}
            </span>{' '}
            项卡券/积分临期（估值约{' '}
            <span className="font-mono-num font-semibold text-amber-700">
              {formatCurrency(classifiedAssets.totalAtRisk)}
            </span>
            ），以及{' '}
            <span className="font-mono-num font-semibold text-slate-900">
              {classifiedMemberships.length}
            </span>{' '}
            项会员即将到期续卡
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
                  onClick={() => onUpdateSettings({ ...settings, warningWindowDays: d })}
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

          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
            {(
              [
                { id: 'active', label: `卡券积分临期 (${classifiedAssets.activeAlerts.length})` },
                { id: 'memberships', label: `会员续卡 (${classifiedMemberships.length})` },
                { id: 'all', label: '全部有期限权益' },
                { id: 'snoozed', label: `已暂缓 (${classifiedAssets.snoozedAlerts.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterScope(tab.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

      {/* Membership Renewal Reminders Section (when in active or memberships tab) */}
      {(filterScope === 'memberships' ||
        (filterScope === 'active' && classifiedMemberships.length > 0)) && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-semibold text-slate-900">会员续卡与防自动扣费提醒</h3>
            </div>
            <span className="text-xs text-slate-400">{classifiedMemberships.length} 项待处理</span>
          </div>

          {classifiedMemberships.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              当前没有进入续卡提醒周期的会员记录（长期有效会员已自动免提醒）。
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {classifiedMemberships.map(({ membership: m, days }) => (
                <div
                  key={m.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-mono-num font-semibold ${
                          days <= 7 ? 'text-red-600' : 'text-amber-700'
                        }`}
                      >
                        {days < 0
                          ? `[已过期 ${Math.abs(days)} 天]`
                          : days === 0
                            ? '[今日续卡]'
                            : `[剩余 ${days} 天续卡]`}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{m.name}</span>
                      <span className="text-xs text-slate-500">
                        · {m.platform} · {m.tierLevel} · {BILLING_CYCLE_LABELS[m.billingCycle]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                      <span>
                        会费：<strong className="font-mono-num">{formatCurrency(m.feeRmb)}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={m.autoRenew ? 'text-red-600 font-medium' : 'text-slate-500'}>
                        {m.autoRenew ? '已开启自动扣费（如需取消请按路径关闭）' : '手动续卡'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">到期日：{m.expiryDate}</span>
                    </div>
                    {m.appPath && (
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="truncate">管理路径：{m.appPath}</span>
                        <button
                          type="button"
                          onClick={() => onCopyPath(m.appPath, m.name)}
                          className="text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 shrink-0 font-medium cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          复制
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSnoozeMembership(m.id, 7)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      暂缓7天
                    </button>
                    <button
                      type="button"
                      onClick={() => onRenewMembership(m)}
                      className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      确认续卡顺延
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Asset Expiry List */}
      {filterScope !== 'memberships' && (
        <>
          {listToDisplay.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="mt-3 text-sm font-medium text-slate-900">
                当前筛选下无待处理卡券或积分过期提醒
              </p>
              <p className="mt-1 text-xs text-slate-500">
                你可以调大上方预警周期天数，或切换至「全部有期限权益」提前规划消费。
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
                          className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          恢复提醒
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSnoozeAsset(asset.id, 3)}
                          className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          暂缓3天
                        </button>
                      )}

                      {isOverdue && (
                        <button
                          type="button"
                          onClick={() => onMarkExpired(asset)}
                          className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                        >
                          记为过期损耗
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenConsumeModal(asset.id)}
                        className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        立即核销消费
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
