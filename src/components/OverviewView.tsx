import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ArrowRight,
  Bell,
  Copy,
  CreditCard,
  Database,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import {
  ActiveTab,
  BenefitAsset,
  LedgerEntry,
  MajorBenefitGroup,
  MembershipRecord,
  ReminderSettings,
} from '../types/benefits';
import {
  ASSET_CATEGORY_LABELS,
  MAJOR_GROUP_LABELS,
  MAJOR_GROUP_ORDER,
  formatCurrency,
  formatQuantity,
  getAssetValueRmb,
  getDaysUntilExpiry,
  getExpiryUrgency,
  inferMajorGroup,
} from '../utils/calculations';
import { TrendCharts } from './TrendCharts';

interface OverviewViewProps {
  assets: BenefitAsset[];
  ledger: LedgerEntry[];
  memberships: MembershipRecord[];
  settings: ReminderSettings;
  onNavigate: (tab: ActiveTab) => void;
  onNavigateCatalogGroup: (group: MajorBenefitGroup) => void;
  onOpenAssetModal: () => void;
  onOpenMembershipModal: () => void;
  onOpenConsumeModal: (assetId?: string) => void;
  onOpenDataModal: () => void;
  onRenewMembership: (membership: MembershipRecord) => void;
  onCopyPath: (path: string, name: string) => void;
  onSelectAsset: (asset: BenefitAsset) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  assets,
  ledger,
  memberships,
  settings,
  onNavigate,
  onNavigateCatalogGroup,
  onOpenAssetModal,
  onOpenMembershipModal,
  onOpenConsumeModal,
  onOpenDataModal,
  onRenewMembership,
  onCopyPath,
  onSelectAsset,
}) => {
  const [groupSortDir, setGroupSortDir] = useState<'desc' | 'asc'>('desc');

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

    const dueMemberships = memberships.filter((m) => {
      const days = getDaysUntilExpiry(m.expiryDate);
      return days !== null && days <= Math.max(m.remindBeforeDays, settings.warningWindowDays);
    });

    const activeCount = assets.filter((a) => a.balance > 0).length;
    const channelCount = new Set(assets.map((a) => a.channelName)).size;

    return {
      totalValuation,
      totalSaved,
      monthSaved,
      expiringCount: expiringAssets.length,
      expiringValue,
      dueMembershipCount: dueMemberships.length,
      activeCount,
      channelCount,
    };
  }, [assets, ledger, memberships, settings.warningWindowDays]);

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
      .slice(0, 6);
  }, [assets, settings.warningWindowDays]);

  const upcomingMemberships = useMemo(() => {
    return memberships
      .map((m) => ({
        membership: m,
        days: getDaysUntilExpiry(m.expiryDate) ?? 9999,
      }))
      .filter(
        (item) =>
          item.days <= Math.max(item.membership.remindBeforeDays, settings.warningWindowDays)
      )
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  }, [memberships, settings.warningWindowDays]);

  // Grouped by Major Benefit Category
  const groupedAssets = useMemo(() => {
    const map = new Map<
      MajorBenefitGroup,
      {
        group: MajorBenefitGroup;
        label: string;
        items: BenefitAsset[];
        totalValue: number;
        expiringCount: number;
      }
    >();

    for (const g of MAJOR_GROUP_ORDER) {
      map.set(g, {
        group: g,
        label: MAJOR_GROUP_LABELS[g],
        items: [],
        totalValue: 0,
        expiringCount: 0,
      });
    }

    for (const a of assets) {
      const g = a.majorGroup || inferMajorGroup(a.category, a.channelType, a.name);
      const bucket = map.get(g);
      if (!bucket) continue;
      bucket.items.push(a);
      bucket.totalValue += getAssetValueRmb(a);
      const d = getDaysUntilExpiry(a.expiryDate);
      if (a.balance > 0 && d !== null && d <= settings.warningWindowDays) {
        bucket.expiringCount += 1;
      }
    }

    for (const bucket of map.values()) {
      bucket.items.sort((a, b) => {
        const diff = getAssetValueRmb(a) - getAssetValueRmb(b);
        return groupSortDir === 'desc' ? -diff : diff;
      });
    }

    const allBuckets = Array.from(map.values());
    const populated = allBuckets
      .filter((b) => b.items.length > 0)
      .sort((a, b) => {
        const diff = a.totalValue - b.totalValue;
        return groupSortDir === 'desc' ? -diff : diff;
      });
    const empty = allBuckets.filter((b) => b.items.length === 0);

    return { populated, empty, allBuckets };
  }, [assets, settings.warningWindowDays, groupSortDir]);

  const recentTransactions = useMemo(() => {
    return [...ledger].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [ledger]);

  return (
    <div className="space-y-6">
      {assets.length === 0 && memberships.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">开始建立你的全渠道权益与会员账本</h2>
            <p className="mt-1 text-xs text-slate-500">
              可手动录入银行信用卡积分、平台储值卡、贵宾厅与体检口腔权益、各类会员续卡周期，或直接通过 Excel / CSV / JSON 批量导入。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenDataModal}
              className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              批量导入数据
            </button>
            <button
              type="button"
              onClick={onOpenMembershipModal}
              className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              录入会员体系
            </button>
            <button
              type="button"
              onClick={onOpenAssetModal}
              className="min-h-[40px] px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              录入第一项权益
            </button>
          </div>
        </div>
      )}

      {/* 4-Column KPI Strip (2x2 compact on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">全渠道权益预估总值</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono-num text-slate-900 tracking-tight truncate">
            {formatCurrency(kpis.totalValuation)}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-slate-500 truncate">
            {kpis.channelCount} 个渠道 · {kpis.activeCount} 项可用
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">累计实际节省优惠</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono-num text-emerald-700 tracking-tight truncate">
            {formatCurrency(kpis.totalSaved)}
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-500">
            <span className="truncate">
              本月已省{' '}
              <span className="font-mono-num font-medium text-slate-800">
                {formatCurrency(kpis.monthSaved)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('savings')}
              className="text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
            >
              汇总
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
              {settings.warningWindowDays}天临期风险
            </span>
            {(kpis.expiringCount > 0 || kpis.dueMembershipCount > 0) && (
              <span className="text-[11px] font-medium text-amber-700 shrink-0 hidden sm:inline">
                需优先处理
              </span>
            )}
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono-num text-amber-700 tracking-tight truncate">
            {formatCurrency(kpis.expiringValue)}
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-500">
            <span className="truncate">
              {kpis.expiringCount}卡券 · {kpis.dueMembershipCount}会员
            </span>
            <button
              type="button"
              onClick={() => onNavigate('reminders')}
              className="text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
            >
              提醒
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] sm:text-xs font-medium text-slate-500">会员与流水台账</div>
            <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono-num text-slate-900 tracking-tight truncate">
              {memberships.length}
              <span className="text-xs sm:text-sm font-normal text-slate-500"> 会员 · </span>
              {ledger.length}
              <span className="text-xs sm:text-sm font-normal text-slate-500"> 笔</span>
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-1 text-[11px] sm:text-xs">
            <button
              type="button"
              onClick={() => onNavigate('memberships')}
              className="text-slate-600 hover:text-slate-900 truncate cursor-pointer"
            >
              会员体系
            </button>
            <button
              type="button"
              onClick={() => onOpenConsumeModal()}
              className="text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-3 h-3" />
              记一笔
            </button>
          </div>
        </div>
      </div>

      {/* Homepage Prominent Section 1: 临期卡券与会员续卡提醒 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">首页临期卡券与积分提醒</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reminders')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              提醒中心 ({kpis.expiringCount})
            </button>
          </div>

          {urgentWatchlist.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              当前 {settings.warningWindowDays} 天内暂无即将过期的有价卡券或积分。
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
                      <button
                        type="button"
                        onClick={() => onSelectAsset(asset)}
                        className="text-sm font-medium text-slate-900 hover:text-teal-700 truncate text-left cursor-pointer"
                      >
                        {asset.name}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>{asset.channelName}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {MAJOR_GROUP_LABELS[asset.majorGroup || inferMajorGroup(asset.category, asset.channelType, asset.name)]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num text-slate-700">
                          余 {formatQuantity(asset.balance, asset.unitLabel)} ({formatCurrency(val)})
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
                              : `剩 ${days} 天`}
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
                        className="min-h-[38px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        复制路径
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenConsumeModal(asset.id)}
                        className="min-h-[38px] sm:min-h-[34px] px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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

        {/* Membership Renewal Reminders Card */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-700 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">会员续卡与到期提醒</h2>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onOpenMembershipModal}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                + 录入会员
              </button>
              <button
                type="button"
                onClick={() => onNavigate('memberships')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                全部 ({memberships.length})
              </button>
            </div>
          </div>

          {upcomingMemberships.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 flex-1 flex flex-col items-center justify-center">
              <p>
                {memberships.length === 0
                  ? '尚未录入会员体系（如京东PLUS、88VIP、山姆、银行白金卡等）。'
                  : '近期暂无待续卡会员。'}
              </p>
              {memberships.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenMembershipModal}
                  className="mt-3 px-3.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
                >
                  录入会员与续卡提醒
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingMemberships.map(({ membership: m, days }) => (
                <div
                  key={m.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{m.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{m.platform}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{formatCurrency(m.feeRmb)}</span>
                      <span aria-hidden="true">·</span>
                      <span className={days <= 7 ? 'text-red-600 font-medium' : 'text-amber-700 font-medium'}>
                        {days < 0 ? `已过期 ${Math.abs(days)} 天` : days === 0 ? '今日到期' : `剩 ${days} 天续卡`}
                      </span>
                      {m.autoRenew && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-600">自动扣费</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRenewMembership(m)}
                    className="min-h-[38px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    续卡
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Homepage Prominent Section 2: 按大类划分的权益展示 */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">按大类划分的权益资产展示</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              涵盖生活购物商旅储值、信用卡积分、平台积分、贵宾厅出行、健康与口腔检查、居家洗车、文娱视听及有价卡券
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setGroupSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
              className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              {groupSortDir === 'desc' ? '按估值降序' : '按估值升序'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('catalog')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              权益库 →
            </button>
          </div>
        </div>

        {groupedAssets.populated.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {MAJOR_GROUP_ORDER.map((g) => (
              <button
                key={g}
                type="button"
                onClick={onOpenAssetModal}
                className="p-4 text-left border border-dashed border-slate-200 hover:border-teal-700/50 rounded-lg transition-colors cursor-pointer group"
              >
                <div className="text-xs font-semibold text-slate-800 group-hover:text-teal-700">
                  {MAJOR_GROUP_LABELS[g]}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">暂无条目 · 点击录入</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groupedAssets.populated.map((bucket) => (
              <div
                key={bucket.group}
                className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between bg-slate-50/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                    <div>
                      <button
                        type="button"
                        onClick={() => onNavigateCatalogGroup(bucket.group)}
                        className="text-sm font-semibold text-slate-900 hover:text-teal-700 text-left cursor-pointer"
                      >
                        {bucket.label}
                      </button>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {bucket.items.length} 项权益
                        {bucket.expiringCount > 0 && (
                          <span className="text-amber-700 font-medium">
                            {' '}
                            · {bucket.expiringCount} 项临期
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="font-mono-num text-sm font-bold text-teal-700">
                      {formatCurrency(bucket.totalValue)}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200/60 mt-1">
                    {bucket.items.slice(0, 4).map((item) => {
                      const days = getDaysUntilExpiry(item.expiryDate);
                      return (
                        <div
                          key={item.id}
                          className="py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onSelectAsset(item)}
                              className="font-medium text-slate-800 hover:text-teal-700 truncate block text-left max-w-[180px] cursor-pointer"
                            >
                              {item.name}
                            </button>
                            <div className="text-[11px] text-slate-400 truncate">
                              {item.channelName}
                              {days !== null && days <= settings.warningWindowDays && (
                                <span className="text-amber-700 ml-1">
                                  · {days < 0 ? '已过期' : `剩${days}天`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono-num">
                            <div className="text-slate-900 font-medium">
                              {formatQuantity(item.balance, item.unitLabel)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {formatCurrency(getAssetValueRmb(item))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {bucket.items.length > 4 && (
                  <button
                    type="button"
                    onClick={() => onNavigateCatalogGroup(bucket.group)}
                    className="mt-2 pt-2 border-t border-slate-200/70 text-xs font-medium text-teal-700 hover:text-teal-800 text-left cursor-pointer"
                  >
                    查看该大类全部 {bucket.items.length} 项 →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Interactive Trend Charts */}
      <TrendCharts assets={assets} ledger={ledger} />

      {/* Recent Ledger Highlights */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
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
  );
};
