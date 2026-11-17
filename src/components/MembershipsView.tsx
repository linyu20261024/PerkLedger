import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Bell,
  Copy,
  CreditCard,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { MembershipRecord } from '../types/benefits';
import {
  BILLING_CYCLE_LABELS,
  formatCurrency,
  getDaysUntilExpiry,
} from '../utils/calculations';

interface MembershipsViewProps {
  memberships: MembershipRecord[];
  onOpenMembershipModal: (membership?: MembershipRecord) => void;
  onRenewMembership: (membership: MembershipRecord) => void;
  onDeleteMembership: (id: string) => void;
  onSnoozeMembership: (id: string, days: number | null) => void;
  onCopyPath: (path: string, name: string) => void;
}

export const MembershipsView: React.FC<MembershipsViewProps> = ({
  memberships,
  onOpenMembershipModal,
  onRenewMembership,
  onDeleteMembership,
  onSnoozeMembership,
  onCopyPath,
}) => {
  const [filter, setFilter] = useState<'all' | 'due' | 'autorenew' | 'expired'>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'fee' | 'expiry'>('fee');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const todayISO = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    let totalFee = 0;
    let dueSoonCount = 0;
    let autoRenewCount = 0;

    for (const m of memberships) {
      totalFee += m.feeRmb || 0;
      if (m.autoRenew) autoRenewCount += 1;
      const days = getDaysUntilExpiry(m.expiryDate);
      if (days !== null && days <= m.remindBeforeDays) {
        dueSoonCount += 1;
      }
    }

    return {
      totalCount: memberships.length,
      totalFee,
      dueSoonCount,
      autoRenewCount,
    };
  }, [memberships]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...memberships]
      .filter((m) => {
        const days = getDaysUntilExpiry(m.expiryDate) ?? 9999;
        if (filter === 'due' && days > m.remindBeforeDays) return false;
        if (filter === 'autorenew' && !m.autoRenew) return false;
        if (filter === 'expired' && days >= 0) return false;
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          m.platform.toLowerCase().includes(q) ||
          m.tierLevel.toLowerCase().includes(q) ||
          m.corePerks.toLowerCase().includes(q) ||
          m.appPath.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'fee') {
          const diff = a.feeRmb - b.feeRmb;
          return sortDir === 'desc' ? -diff : diff;
        }
        const da = getDaysUntilExpiry(a.expiryDate) ?? 9999;
        const db = getDaysUntilExpiry(b.expiryDate) ?? 9999;
        return sortDir === 'desc' ? db - da : da - db;
      });
  }, [memberships, filter, query, sortBy, sortDir]);

  return (
    <div className="space-y-5">
      {/* KPI Row (2x2 on mobile) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">已纳管会员体系</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono-num text-slate-900">
            {stats.totalCount} <span className="text-xs sm:text-sm font-normal text-slate-500">项</span>
          </div>
          <div className="mt-1.5 text-[11px] sm:text-xs text-slate-500 truncate">电商、商旅、医疗与银行卡</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">周期会费总投入</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono-num text-slate-900">
            {formatCurrency(stats.totalFee)}
          </div>
          <div className="mt-1.5 text-[11px] sm:text-xs text-slate-500 truncate">单周期续费合计成本</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">待处理续卡提醒</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono-num text-amber-700">
            {stats.dueSoonCount} <span className="text-xs sm:text-sm font-normal text-slate-500">项</span>
          </div>
          <div className="mt-1.5 text-[11px] sm:text-xs text-slate-500 truncate">进入设定提前提醒期</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">已开启自动续费</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono-num text-teal-700">
            {stats.autoRenewCount} <span className="text-xs sm:text-sm font-normal text-slate-500">项</span>
          </div>
          <div className="mt-1.5 text-[11px] sm:text-xs text-slate-500 truncate">到期前核对防误扣费</div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
            {(
              [
                { id: 'all', label: `全部会员 (${memberships.length})` },
                { id: 'due', label: `临期续卡 (${stats.dueSoonCount})` },
                { id: 'autorenew', label: `自动续费 (${stats.autoRenewCount})` },
                { id: 'expired', label: '已到期' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索会员名、平台、等级或包含权益..."
              className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-700"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'fee' | 'expiry')}
            className="px-2.5 py-2 min-h-[38px] text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-700 cursor-pointer"
          >
            <option value="fee">按会费成本</option>
            <option value="expiry">按到期时间</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            className="px-2.5 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            {sortDir === 'desc' ? '降序' : '升序'}
          </button>

          <button
            type="button"
            onClick={() => onOpenMembershipModal()}
            className="px-3.5 py-2 min-h-[38px] text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            录入会员体系
          </button>
        </div>
      </div>

      {/* Membership List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {memberships.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-slate-900">尚未录入任何会员体系</p>
            <p className="mt-1 text-xs text-slate-500">
              录入如京东 PLUS、淘宝 88VIP、山姆会员、银行高端信用卡年费或体检/视频会员，系统将按预设周期自动发出续卡与防误扣提醒。
            </p>
            <button
              type="button"
              onClick={() => onOpenMembershipModal()}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              录入第一个会员
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            当前筛选条件下无匹配的会员记录。
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((m) => {
              const days = getDaysUntilExpiry(m.expiryDate) ?? 0;
              const isOverdue = days < 0;
              const isDueSoon = days >= 0 && days <= m.remindBeforeDays;
              const isSnoozed = Boolean(m.snoozedUntil && m.snoozedUntil > todayISO);

              return (
                <div
                  key={m.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{m.name}</h3>
                      <span className="text-xs text-slate-500">
                        · {m.platform} · {m.tierLevel} · {BILLING_CYCLE_LABELS[m.billingCycle]}
                      </span>
                      <span className="font-mono-num text-xs text-slate-700">
                        · 会费 {formatCurrency(m.feeRmb)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-mono-num font-medium ${
                          isOverdue
                            ? 'text-red-600'
                            : isDueSoon
                              ? 'text-amber-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {isOverdue
                          ? `已到期 ${Math.abs(days)} 天 (${m.expiryDate})`
                          : days === 0
                            ? `今日到期 (${m.expiryDate})`
                            : `距续卡剩 ${days} 天 (${m.expiryDate})`}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-slate-500">提前 {m.remindBeforeDays} 天提醒</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className={m.autoRenew ? 'text-teal-700 font-medium' : 'text-slate-500'}>
                        {m.autoRenew ? '已开启自动续费（注意扣费节点）' : '手动续卡（无自动扣费）'}
                      </span>
                      {isSnoozed && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-400">已暂缓至 {m.snoozedUntil}</span>
                        </>
                      )}
                    </div>

                    {m.corePerks && (
                      <div className="text-xs text-slate-700">
                        核心权益：{m.corePerks}
                      </div>
                    )}

                    {m.appPath && (
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="truncate">管理/退订路径：{m.appPath}</span>
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

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {(isDueSoon || isOverdue) && !isSnoozed && (
                      <button
                        type="button"
                        onClick={() => onSnoozeMembership(m.id, 7)}
                        className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        暂缓7天
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onRenewMembership(m)}
                      className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      确认续卡顺延
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenMembershipModal(m)}
                      className="min-h-[40px] min-w-[40px] p-2 text-slate-400 hover:text-slate-700 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer"
                      title="编辑会员"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteMembership(m.id)}
                      className="min-h-[40px] min-w-[40px] p-2 text-slate-400 hover:text-red-600 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer"
                      title="删除会员"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
