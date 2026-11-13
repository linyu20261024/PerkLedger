/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Database,
  Layers,
  ListOrdered,
  Menu,
  PieChart,
  Plus,
  X,
} from 'lucide-react';
import {
  ActiveTab,
  BenefitAsset,
  LedgerEntry,
  ReminderSettings,
} from './types/benefits';
import {
  createEmptyState,
  formatISODate,
  getTodayISO,
  shiftDateISO,
} from './data/seedData';
import { formatCurrency, getAssetValueRmb, getDaysUntilExpiry } from './utils/calculations';
import { OverviewView } from './components/OverviewView';
import { AssetsCatalogView } from './components/AssetsCatalogView';
import { RemindersView } from './components/RemindersView';
import { LedgerView } from './components/LedgerView';
import { SavingsSummaryView } from './components/SavingsSummaryView';
import { AssetFormModal, ConsumeFormModal, DataManageModal } from './components/Modals';

const STORAGE_KEY = 'yzt_benefits_platform_clean_v1';

interface StoredState {
  assets: BenefitAsset[];
  ledger: LedgerEntry[];
  settings: ReminderSettings;
}

function loadInitialState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState;
      if (Array.isArray(parsed.assets) && Array.isArray(parsed.ledger)) {
        return {
          assets: parsed.assets,
          ledger: parsed.ledger,
          settings: parsed.settings || { warningWindowDays: 30, urgentWindowDays: 7 },
        };
      }
    }
  } catch {
    // Fallback to empty state on malformed localStorage
  }
  return createEmptyState();
}

export default function App() {
  const [state, setState] = useState<StoredState>(loadInitialState);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Selected asset for detail drawer in catalog
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Modals
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<BenefitAsset | null>(null);

  const [consumeModalOpen, setConsumeModalOpen] = useState(false);
  const [consumeDefaultAssetId, setConsumeDefaultAssetId] = useState<string | undefined>(
    undefined
  );

  const [dataModalOpen, setDataModalOpen] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 2800);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const selectedAsset = useMemo(
    () => state.assets.find((a) => a.id === selectedAssetId) || null,
    [state.assets, selectedAssetId]
  );

  const urgentReminderCount = useMemo(() => {
    const today = getTodayISO();
    return state.assets.filter((a) => {
      if (a.balance <= 0 || !a.expiryDate) return false;
      if (a.snoozedUntil && a.snoozedUntil > today) return false;
      const days = getDaysUntilExpiry(a.expiryDate, today);
      return days !== null && days <= state.settings.warningWindowDays;
    }).length;
  }, [state.assets, state.settings.warningWindowDays]);

  const totalValuation = useMemo(
    () => state.assets.reduce((sum, a) => sum + getAssetValueRmb(a), 0),
    [state.assets]
  );

  const handleCopyPath = async (path: string, name: string) => {
    try {
      await navigator.clipboard.writeText(path);
      showToast(`已复制「${name}」App 内路径`);
    } catch {
      showToast(`路径：${path}`);
    }
  };

  const handleSaveAsset = (
    assetData: Omit<BenefitAsset, 'id' | 'updatedAt'>,
    existingId?: string
  ) => {
    const today = getTodayISO();
    if (existingId) {
      setState((prev) => ({
        ...prev,
        assets: prev.assets.map((a) =>
          a.id === existingId ? { ...a, ...assetData, updatedAt: today } : a
        ),
      }));
      showToast(`已更新「${assetData.name}」`);
    } else {
      const newId = `ast-${Date.now()}`;
      const newAsset: BenefitAsset = {
        ...assetData,
        id: newId,
        updatedAt: today,
      };
      // Also log initial onboarding inflow if balance > 0
      const initialEntry: LedgerEntry | null =
        newAsset.balance > 0
          ? {
              id: `tx-${Date.now()}`,
              assetId: newId,
              assetName: newAsset.name,
              channelName: newAsset.channelName,
              category: newAsset.category,
              type: 'earn',
              deltaQuantity: newAsset.balance,
              unitLabel: newAsset.unitLabel,
              estimatedValueRmb: getAssetValueRmb(newAsset),
              savedRmb: 0,
              merchantOrScene: '新渠道权益建档入账',
              date: today,
            }
          : null;

      setState((prev) => ({
        ...prev,
        assets: [newAsset, ...prev.assets],
        ledger: initialEntry ? [initialEntry, ...prev.ledger] : prev.ledger,
      }));
      showToast(`已录入「${assetData.name}」`);
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    const target = state.assets.find((a) => a.id === assetId);
    setState((prev) => ({
      ...prev,
      assets: prev.assets.filter((a) => a.id !== assetId),
    }));
    if (selectedAssetId === assetId) setSelectedAssetId(null);
    if (target) showToast(`已移除「${target.name}」`);
  };

  const handleAddLedgerEntry = (entryData: Omit<LedgerEntry, 'id'>) => {
    const newEntry: LedgerEntry = {
      ...entryData,
      id: `tx-${Date.now()}`,
    };
    const today = getTodayISO();

    setState((prev) => ({
      ...prev,
      assets: prev.assets.map((a) => {
        if (a.id !== entryData.assetId) return a;
        const nextBalance = Math.max(
          0,
          Number((a.balance + entryData.deltaQuantity).toFixed(4))
        );
        return {
          ...a,
          balance: nextBalance,
          updatedAt: today,
        };
      }),
      ledger: [newEntry, ...prev.ledger],
    }));

    showToast(
      entryData.savedRmb > 0
        ? `已记账，本次节省 ${formatCurrency(entryData.savedRmb)}`
        : '已记录一笔消长明细'
    );
  };

  const handleDeleteLedgerEntry = (entryId: string) => {
    const target = state.ledger.find((tx) => tx.id === entryId);
    if (!target) return;

    setState((prev) => ({
      ...prev,
      assets: prev.assets.map((a) => {
        if (a.id !== target.assetId) return a;
        const revertedBalance = Math.max(
          0,
          Number((a.balance - target.deltaQuantity).toFixed(4))
        );
        return { ...a, balance: revertedBalance };
      }),
      ledger: prev.ledger.filter((tx) => tx.id !== entryId),
    }));
    showToast('已撤销流水并同步恢复权益余额');
  };

  const handleMarkExpired = (asset: BenefitAsset) => {
    if (asset.balance <= 0) return;
    handleAddLedgerEntry({
      assetId: asset.id,
      assetName: asset.name,
      channelName: asset.channelName,
      category: asset.category,
      type: 'expire',
      deltaQuantity: -asset.balance,
      unitLabel: asset.unitLabel,
      estimatedValueRmb: getAssetValueRmb(asset),
      savedRmb: 0,
      merchantOrScene: '过期失效清零记录',
      date: getTodayISO(),
    });
  };

  const handleSnoozeAsset = (assetId: string, days: number | null) => {
    const snoozedUntil = days ? shiftDateISO(getTodayISO(), days) : null;
    setState((prev) => ({
      ...prev,
      assets: prev.assets.map((a) => (a.id === assetId ? { ...a, snoozedUntil } : a)),
    }));
    showToast(days ? `已暂缓提醒 ${days} 天` : '已恢复该权益提醒');
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `益账通权益数据备份_${formatISODate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('JSON 数据备份已导出');
  };

  const handleImportJSON = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as StoredState;
      if (Array.isArray(parsed.assets) && Array.isArray(parsed.ledger)) {
        setState({
          assets: parsed.assets,
          ledger: parsed.ledger,
          settings: parsed.settings || { warningWindowDays: 30, urgentWindowDays: 7 },
        });
        showToast('已成功从备份恢复数据');
      } else {
        showToast('备份文件格式不完整');
      }
    } catch {
      showToast('无法解析 JSON 文件');
    }
  };

  const handleClearAllData = () => {
    const fresh = createEmptyState();
    setState(fresh);
    setSelectedAssetId(null);
    showToast('已清空全部本地数据');
  };

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
  }[] = [
    { id: 'overview', label: '资产总览与趋势', icon: BarChart3 },
    { id: 'catalog', label: '权益与路径库', icon: Layers },
    {
      id: 'reminders',
      label: '到期消费提醒',
      icon: Bell,
      badgeCount: urgentReminderCount,
    },
    { id: 'ledger', label: '单笔与综合消长', icon: ListOrdered },
    { id: 'savings', label: '优惠汇总分析', icon: PieChart },
  ];

  const activeTitle = navItems.find((n) => n.id === activeTab)?.label || '资产总览';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Wordmark */}
          <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              益账通 · 权益账本
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.badgeCount != null && item.badgeCount > 0 && (
                    <span
                      className={`font-mono-num text-xs font-semibold ${
                        isActive ? 'text-amber-300' : 'text-amber-700'
                      }`}
                    >
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Workspace Summary & Backup Trigger */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          <div>
            <div className="text-[11px] text-slate-400">当前账面总估值</div>
            <div className="mt-0.5 text-base font-bold font-mono-num text-slate-900">
              {formatCurrency(totalValuation)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDataModalOpen(true)}
            className="w-full py-2 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            备份与数据管理
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1-2 primary actions on right */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 cursor-pointer"
              aria-label="打开菜单"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">权益平台</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{activeTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingAsset(null);
                setAssetModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              录入新权益
            </button>
            <button
              type="button"
              onClick={() => {
                setConsumeDefaultAssetId(undefined);
                setConsumeModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              记一笔消长
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              assets={state.assets}
              ledger={state.ledger}
              settings={state.settings}
              onNavigate={setActiveTab}
              onOpenAssetModal={() => {
                setEditingAsset(null);
                setAssetModalOpen(true);
              }}
              onOpenConsumeModal={(assetId) => {
                setConsumeDefaultAssetId(assetId);
                setConsumeModalOpen(true);
              }}
              onCopyPath={handleCopyPath}
              onSelectAsset={(asset) => {
                setSelectedAssetId(asset.id);
                setActiveTab('catalog');
              }}
            />
          )}

          {activeTab === 'catalog' && (
            <AssetsCatalogView
              assets={state.assets}
              ledger={state.ledger}
              settings={state.settings}
              selectedAsset={selectedAsset}
              onSelectAsset={(asset) => setSelectedAssetId(asset?.id || null)}
              onOpenAssetModal={(asset) => {
                setEditingAsset(asset || null);
                setAssetModalOpen(true);
              }}
              onOpenConsumeModal={(assetId) => {
                setConsumeDefaultAssetId(assetId);
                setConsumeModalOpen(true);
              }}
              onDeleteAsset={handleDeleteAsset}
              onCopyPath={handleCopyPath}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersView
              assets={state.assets}
              settings={state.settings}
              onUpdateSettings={(next) =>
                setState((prev) => ({ ...prev, settings: next }))
              }
              onOpenConsumeModal={(assetId) => {
                setConsumeDefaultAssetId(assetId);
                setConsumeModalOpen(true);
              }}
              onMarkExpired={handleMarkExpired}
              onSnoozeAsset={handleSnoozeAsset}
              onCopyPath={handleCopyPath}
            />
          )}

          {activeTab === 'ledger' && (
            <LedgerView
              assets={state.assets}
              ledger={state.ledger}
              onOpenConsumeModal={(assetId) => {
                setConsumeDefaultAssetId(assetId);
                setConsumeModalOpen(true);
              }}
              onDeleteLedgerEntry={handleDeleteLedgerEntry}
            />
          )}

          {activeTab === 'savings' && (
            <SavingsSummaryView
              assets={state.assets}
              ledger={state.ledger}
              onOpenConsumeModal={() => {
                setConsumeDefaultAssetId(undefined);
                setConsumeModalOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <AssetFormModal
        isOpen={assetModalOpen}
        editingAsset={editingAsset}
        onClose={() => {
          setAssetModalOpen(false);
          setEditingAsset(null);
        }}
        onSave={handleSaveAsset}
      />

      <ConsumeFormModal
        isOpen={consumeModalOpen}
        assets={state.assets}
        defaultAssetId={consumeDefaultAssetId}
        onClose={() => {
          setConsumeModalOpen(false);
          setConsumeDefaultAssetId(undefined);
        }}
        onSubmit={handleAddLedgerEntry}
      />

      <DataManageModal
        isOpen={dataModalOpen}
        onClose={() => setDataModalOpen(false)}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onClearAllData={handleClearAllData}
      />

      {/* Non-intrusive Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
