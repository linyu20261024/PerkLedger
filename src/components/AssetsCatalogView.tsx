import React, { useMemo, useState } from 'react';
import { Copy, Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import {
  AssetCategory,
  BenefitAsset,
  ChannelType,
  LedgerEntry,
  ReminderSettings,
} from '../types/benefits';
import {
  ASSET_CATEGORY_LABELS,
  CHANNEL_TYPE_LABELS,
  formatCurrency,
  formatQuantity,
  getAssetValueRmb,
  getDaysUntilExpiry,
  getExpiryLabel,
  getExpiryUrgency,
} from '../utils/calculations';

interface AssetsCatalogViewProps {
  assets: BenefitAsset[];
  ledger: LedgerEntry[];
  settings: ReminderSettings;
  selectedAsset: BenefitAsset | null;
  onSelectAsset: (asset: BenefitAsset | null) => void;
  onOpenAssetModal: (asset?: BenefitAsset) => void;
  onOpenConsumeModal: (assetId?: string) => void;
  onDeleteAsset: (assetId: string) => void;
  onCopyPath: (path: string, name: string) => void;
}

export const AssetsCatalogView: React.FC<AssetsCatalogViewProps> = ({
  assets,
  ledger,
  settings,
  selectedAsset,
  onSelectAsset,
  onOpenAssetModal,
  onOpenConsumeModal,
  onDeleteAsset,
  onCopyPath,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AssetCategory>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | ChannelType>('all');
  const [sortBy, setSortBy] = useState<'value' | 'expiry' | 'channel'>('value');

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => {
        if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
        if (channelFilter !== 'all' && a.channelType !== channelFilter) return false;
        if (!q) return true;
        return (
          a.name.toLowerCase().includes(q) ||
          a.channelName.toLowerCase().includes(q) ||
          a.appName.toLowerCase().includes(q) ||
          a.appPath.toLowerCase().includes(q) ||
          (a.notes || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'value') {
          return getAssetValueRmb(b) - getAssetValueRmb(a);
        }
        if (sortBy === 'expiry') {
          const da = getDaysUntilExpiry(a.expiryDate) ?? 99999;
          const db = getDaysUntilExpiry(b.expiryDate) ?? 99999;
          return da - db;
        }
        return a.channelName.localeCompare(b.channelName, 'zh-CN');
      });
  }, [assets, query, categoryFilter, channelFilter, sortBy]);

  const totalFilteredValue = useMemo(
    () => filteredAssets.reduce((sum, a) => sum + getAssetValueRmb(a), 0),
    [filteredAssets]
  );

  const selectedAssetLedger = useMemo(() => {
    if (!selectedAsset) return [];
    return ledger
      .filter((tx) => tx.assetId === selectedAsset.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [ledger, selectedAsset]);

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search across name, channel, AND in-app path */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索银行、平台、权益名称或 App 内路径关键词（如：贵宾厅、立减金、买单吧）..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-700 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="清除搜索"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'value' | 'expiry' | 'channel')}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-700 cursor-pointer"
              aria-label="排序方式"
            >
              <option value="value">按预估价值降序</option>
              <option value="expiry">按到期时间优先</option>
              <option value="channel">按渠道名称排序</option>
            </select>

            <button
              type="button"
              onClick={() => onOpenAssetModal()}
              className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              新增渠道权益
            </button>
          </div>
        </div>

        {/* Filter Bars */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: '全部类型' },
                  { id: 'points', label: '积分' },
                  { id: 'prepaid', label: '储值卡' },
                  { id: 'voucher', label: '有价卡券' },
                  { id: 'privilege', label: '次数权益' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: '全部渠道' },
                  { id: 'bank', label: '银行' },
                  { id: 'platform', label: '生活平台' },
                  { id: 'retail', label: '商超零售' },
                  { id: 'travel', label: '航司酒店' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChannelFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    channelFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-500">
            匹配 {filteredAssets.length} 项 · 估值合计{' '}
            <span className="font-mono-num font-semibold text-slate-900">
              {formatCurrency(totalFilteredValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table + Optional Detail Drawer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div
          className={`${
            selectedAsset ? 'xl:col-span-8' : 'xl:col-span-12'
          } bg-white border border-slate-200 rounded-xl overflow-hidden`}
        >
          {assets.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-900">当前暂未录入任何渠道权益资产</p>
              <p className="mt-1 text-xs text-slate-500">
                可录入银行积分、储值礼品卡、优惠卡券及对应的 App 内访问路径。
              </p>
              <button
                type="button"
                onClick={() => onOpenAssetModal()}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
              >
                录入第一项权益
              </button>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-900">未找到匹配的权益或路径记录</p>
              <p className="mt-1 text-xs text-slate-500">
                尝试更换关键词，或点击右上角新增银行积分、储值卡与App内路径。
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategoryFilter('all');
                  setChannelFilter('all');
                }}
                className="mt-4 px-3.5 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
              >
                重置筛选条件
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">权益名称与渠道</th>
                    <th className="py-3 px-4">App 内权益路径（支持查询）</th>
                    <th className="py-3 px-4 text-right">当前余额</th>
                    <th className="py-3 px-4 text-right">折合估值</th>
                    <th className="py-3 px-4">有效期状态</th>
                    <th className="py-3 px-4 text-right">快捷操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredAssets.map((asset) => {
                    const val = getAssetValueRmb(asset);
                    const urgency = getExpiryUrgency(
                      asset.expiryDate,
                      settings.urgentWindowDays,
                      settings.warningWindowDays
                    );
                    const isSelected = selectedAsset?.id === asset.id;

                    return (
                      <tr
                        key={asset.id}
                        onClick={() => onSelectAsset(asset)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-medium text-slate-900">{asset.name}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {asset.channelName} · {CHANNEL_TYPE_LABELS[asset.channelType]} ·{' '}
                            {ASSET_CATEGORY_LABELS[asset.category]}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top max-w-xs">
                          <div className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                            {asset.appPath}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                            <span>入口: {asset.appName}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCopyPath(asset.appPath, asset.name);
                              }}
                              className="text-teal-700 hover:text-teal-800 inline-flex items-center gap-0.5 font-medium cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              复制
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top text-right font-mono-num text-slate-900 whitespace-nowrap">
                          {formatQuantity(asset.balance, asset.unitLabel)}
                        </td>

                        <td className="py-3.5 px-4 align-top text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                          {formatCurrency(val)}
                        </td>

                        <td className="py-3.5 px-4 align-top whitespace-nowrap text-xs">
                          <span
                            className={
                              urgency === 'expired' || urgency === 'urgent'
                                ? 'text-red-600 font-medium'
                                : urgency === 'soon'
                                  ? 'text-amber-700 font-medium'
                                  : 'text-slate-500'
                            }
                          >
                            {getExpiryLabel(asset.expiryDate)}
                          </span>
                        </td>

                        <td
                          className="py-3.5 px-4 align-top text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenConsumeModal(asset.id)}
                              className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors cursor-pointer"
                            >
                              消长/核销
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenAssetModal(asset)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                              title="编辑权益"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Slide-in Detail Inspector Panel */}
        {selectedAsset && (
          <aside className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">
                  {selectedAsset.channelName} · {ASSET_CATEGORY_LABELS[selectedAsset.category]}
                </div>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {selectedAsset.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectAsset(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                aria-label="关闭详情"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Balance & Valuation */}
            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs text-slate-500">可用余量</div>
                <div className="mt-1 text-lg font-bold font-mono-num text-slate-900">
                  {formatQuantity(selectedAsset.balance, selectedAsset.unitLabel)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">折合人民币估值</div>
                <div className="mt-1 text-lg font-bold font-mono-num text-teal-700">
                  {formatCurrency(getAssetValueRmb(selectedAsset))}
                </div>
              </div>
            </div>

            {/* Full App Path Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">App 内权益访问路径</span>
                <button
                  type="button"
                  onClick={() => onCopyPath(selectedAsset.appPath, selectedAsset.name)}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  一键复制
                </button>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-800 leading-relaxed">
                {selectedAsset.appPath}
              </div>
              <div className="text-xs text-slate-500">
                所属应用: {selectedAsset.appName} · 到期: {getExpiryLabel(selectedAsset.expiryDate)}
              </div>
              {selectedAsset.notes && (
                <div className="text-xs text-slate-600 leading-relaxed pt-1">
                  备注: {selectedAsset.notes}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenConsumeModal(selectedAsset.id)}
                className="flex-1 py-2 px-3 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
              >
                记录消费 / 入账
              </button>
              <button
                type="button"
                onClick={() => onOpenAssetModal(selectedAsset)}
                className="py-2 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => onDeleteAsset(selectedAsset.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="删除此权益"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Single Asset Flow History */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-700">单项消长历史</h4>
                <span className="text-xs text-slate-400">{selectedAssetLedger.length} 笔</span>
              </div>
              {selectedAssetLedger.length === 0 ? (
                <div className="text-xs text-slate-400 py-3">暂无单笔消长记录</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {selectedAssetLedger.map((tx) => (
                    <div key={tx.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="text-slate-800 font-medium truncate">
                          {tx.merchantOrScene}
                        </div>
                        <div className="text-slate-400 font-mono-num mt-0.5">{tx.date}</div>
                      </div>
                      <div className="text-right shrink-0 font-mono-num">
                        <div className={tx.deltaQuantity >= 0 ? 'text-teal-700' : 'text-slate-900'}>
                          {tx.deltaQuantity >= 0 ? '+' : ''}
                          {formatQuantity(tx.deltaQuantity, tx.unitLabel)}
                        </div>
                        {tx.savedRmb > 0 && (
                          <div className="text-emerald-700">省 {formatCurrency(tx.savedRmb)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
