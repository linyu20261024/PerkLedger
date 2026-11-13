import React, { useMemo, useState } from 'react';
import { Download, Plus, Search, Trash2, X } from 'lucide-react';
import { BenefitAsset, LedgerEntry, LedgerTxType } from '../types/benefits';
import {
  ASSET_CATEGORY_LABELS,
  buildCompositeSummaries,
  exportLedgerToCSV,
  formatCurrency,
  formatQuantity,
} from '../utils/calculations';

interface LedgerViewProps {
  assets: BenefitAsset[];
  ledger: LedgerEntry[];
  onOpenConsumeModal: (assetId?: string) => void;
  onDeleteLedgerEntry: (entryId: string) => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  assets,
  ledger,
  onOpenConsumeModal,
  onDeleteLedgerEntry,
}) => {
  const [subTab, setSubTab] = useState<'single' | 'composite'>('single');
  const [typeFilter, setTypeFilter] = useState<'all' | LedgerTxType>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const channels = useMemo(() => {
    const set = new Set(ledger.map((tx) => tx.channelName));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...ledger]
      .filter((tx) => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (channelFilter !== 'all' && tx.channelName !== channelFilter) return false;
        if (!q) return true;
        return (
          tx.assetName.toLowerCase().includes(q) ||
          tx.channelName.toLowerCase().includes(q) ||
          tx.merchantOrScene.toLowerCase().includes(q) ||
          (tx.notes || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [ledger, typeFilter, channelFilter, search]);

  const compositeSummaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return buildCompositeSummaries(assets, ledger)
      .filter((row) => {
        if (channelFilter !== 'all' && row.asset.channelName !== channelFilter) return false;
        if (!q) return true;
        return (
          row.asset.name.toLowerCase().includes(q) ||
          row.asset.channelName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.currentValueRmb + b.totalSavedRmb - (a.currentValueRmb + a.totalSavedRmb));
  }, [assets, ledger, channelFilter, search]);

  const singleTotals = useMemo(() => {
    let inflowRmb = 0;
    let consumeRmb = 0;
    let expireRmb = 0;
    let savedRmb = 0;

    for (const tx of filteredLedger) {
      if (tx.type === 'earn') inflowRmb += tx.estimatedValueRmb;
      else if (tx.type === 'consume') consumeRmb += tx.estimatedValueRmb;
      else if (tx.type === 'expire') expireRmb += tx.estimatedValueRmb;
      savedRmb += tx.savedRmb || 0;
    }

    return { inflowRmb, consumeRmb, expireRmb, savedRmb };
  }, [filteredLedger]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setSubTab('single')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  subTab === 'single'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                单笔消长耗明细 ({ledger.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('composite')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  subTab === 'composite'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                综合消长汇总 ({assets.length})
              </button>
            </div>

            <div className="relative w-64 sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="筛选商户、权益名称或备注..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-700"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-700 cursor-pointer"
            >
              <option value="all">全部渠道</option>
              {channels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => exportLedgerToCSV(filteredLedger)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              导出 CSV
            </button>

            <button
              type="button"
              onClick={() => onOpenConsumeModal()}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              记一笔消长
            </button>
          </div>
        </div>

        {subTab === 'single' && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: '全部流水' },
                  { id: 'consume', label: '消费核销' },
                  { id: 'earn', label: '入账获取' },
                  { id: 'expire', label: '过期损耗' },
                  { id: 'adjust', label: '盘点调整' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    typeFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono-num">
              <span className="text-slate-500">
                入账: <strong className="text-teal-700">+{formatCurrency(singleTotals.inflowRmb)}</strong>
              </span>
              <span className="text-slate-500">
                核销: <strong className="text-slate-900">-{formatCurrency(singleTotals.consumeRmb)}</strong>
              </span>
              <span className="text-slate-500">
                过期: <strong className="text-red-600">-{formatCurrency(singleTotals.expireRmb)}</strong>
              </span>
              <span className="text-slate-500">
                节省优惠: <strong className="text-emerald-700">{formatCurrency(singleTotals.savedRmb)}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {subTab === 'single' ? (
          filteredLedger.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              当前筛选条件下暂无消长流水记录。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">日期</th>
                    <th className="py-3 px-4">权益与渠道</th>
                    <th className="py-3 px-4">消长类型</th>
                    <th className="py-3 px-4">消费场景 / 变动说明</th>
                    <th className="py-3 px-4 text-right">数量变动</th>
                    <th className="py-3 px-4 text-right">原价 / 实付</th>
                    <th className="py-3 px-4 text-right">节省优惠</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredLedger.map((tx) => {
                    const typeMap: Record<LedgerTxType, { label: string; cls: string }> = {
                      earn: { label: '获取/入账', cls: 'text-teal-700 font-medium' },
                      consume: { label: '核销/消费', cls: 'text-slate-700 font-medium' },
                      expire: { label: '过期作废', cls: 'text-red-600 font-medium' },
                      adjust: { label: '盘点调整', cls: 'text-amber-700 font-medium' },
                    };
                    const meta = typeMap[tx.type];

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 text-xs sm:text-sm">
                            {tx.assetName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {tx.channelName} · {ASSET_CATEGORY_LABELS[tx.category]}
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-xs whitespace-nowrap ${meta.cls}`}>
                          {meta.label}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-xs text-slate-800">{tx.merchantOrScene}</div>
                          {tx.notes && (
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {tx.notes}
                            </div>
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono-num whitespace-nowrap font-medium ${
                            tx.type === 'expire'
                              ? 'text-red-600'
                              : tx.deltaQuantity >= 0
                                ? 'text-teal-700'
                                : 'text-slate-900'
                          }`}
                        >
                          {tx.deltaQuantity >= 0 ? '+' : ''}
                          {formatQuantity(tx.deltaQuantity, tx.unitLabel)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num text-xs text-slate-500 whitespace-nowrap">
                          {tx.originalPriceRmb != null
                            ? `${formatCurrency(tx.originalPriceRmb)} → ${formatCurrency(tx.actualPaidRmb ?? 0)}`
                            : `估值 ${formatCurrency(tx.estimatedValueRmb)}`}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num whitespace-nowrap">
                          {tx.savedRmb > 0 ? (
                            <span className="font-semibold text-emerald-700">
                              +{formatCurrency(tx.savedRmb)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onDeleteLedgerEntry(tx.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                            title="撤销并删除该流水"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : compositeSummaries.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            当前暂无权益资产，录入资产后将在此汇总各渠道期初、新增、核销与结余明细。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">权益与渠道</th>
                  <th className="py-3 px-4 text-right">期初建档余量</th>
                  <th className="py-3 px-4 text-right">累计获取 (+)</th>
                  <th className="py-3 px-4 text-right">累计核销 (-)</th>
                  <th className="py-3 px-4 text-right">过期损耗 (-)</th>
                  <th className="py-3 px-4 text-right">当前结余</th>
                  <th className="py-3 px-4 text-right">结余估值</th>
                  <th className="py-3 px-4 text-right">累计创造优惠</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {compositeSummaries.map((row) => (
                  <tr key={row.asset.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{row.asset.name}</div>
                      <div className="text-xs text-slate-500">
                        {row.asset.channelName} · {ASSET_CATEGORY_LABELS[row.asset.category]} ·{' '}
                        {row.txCount} 笔流水
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-xs text-slate-500 whitespace-nowrap">
                      {formatQuantity(row.asset.initialBalance, row.asset.unitLabel)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-teal-700 whitespace-nowrap">
                      +{formatQuantity(row.earnedTotal, row.asset.unitLabel)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-slate-800 whitespace-nowrap">
                      -{formatQuantity(row.consumedTotal, row.asset.unitLabel)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-red-600 whitespace-nowrap">
                      {row.expiredTotal > 0
                        ? `-${formatQuantity(row.expiredTotal, row.asset.unitLabel)}`
                        : '0'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                      {formatQuantity(row.asset.balance, row.asset.unitLabel)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-slate-700 whitespace-nowrap">
                      {formatCurrency(row.currentValueRmb)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-emerald-700 whitespace-nowrap">
                      {formatCurrency(row.totalSavedRmb)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
