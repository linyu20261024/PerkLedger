/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  CreditCard,
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
  MajorBenefitGroup,
  MembershipRecord,
  ReminderSettings,
} from './types/benefits';
import {
  addMonthsISO,
  createEmptyState,
  formatISODate,
  getTodayISO,
  shiftDateISO,
} from './data/seedData';
import {
  formatCurrency,
  getAssetValueRmb,
  getDaysUntilExpiry,
  inferMajorGroup,
  parseAssetsFromCSV,
} from './utils/calculations';
import { parseWorkbookFromExcel } from './utils/excel';
import { OverviewView } from './components/OverviewView';
import { AssetsCatalogView } from './components/AssetsCatalogView';
import { MembershipsView } from './components/MembershipsView';
import { RemindersView } from './components/RemindersView';
import { LedgerView } from './components/LedgerView';
import { SavingsSummaryView } from './components/SavingsSummaryView';
import {
  AssetFormModal,
  ConsumeFormModal,
  DataManageModal,
  MembershipFormModal,
} from './components/Modals';

const STORAGE_KEY = 'yzt_benefits_platform_clean_v1';

interface StoredState {
  assets: BenefitAsset[];
  ledger: LedgerEntry[];
  memberships: MembershipRecord[];
  settings: ReminderSettings;
  groupMigrationV2?: boolean;
}

function normalizeAssetGroup(
  asset: BenefitAsset,
  shouldReinferHomeCar = false
): MajorBenefitGroup {
  const raw = asset.majorGroup as string | undefined;
  if (!raw || raw === 'lifestyle_service' || (shouldReinferHomeCar && raw === 'home_car_service')) {
    return inferMajorGroup(asset.category, asset.channelType, asset.name);
  }
  return asset.majorGroup as MajorBenefitGroup;
}

function loadInitialState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      if (Array.isArray(parsed.assets) && Array.isArray(parsed.ledger)) {
        const shouldReinferHomeCar = !parsed.groupMigrationV2;
        return {
          assets: parsed.assets.map((a) => ({
            ...a,
            majorGroup: normalizeAssetGroup(a, shouldReinferHomeCar),
          })),
          ledger: parsed.ledger,
          memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
          settings: parsed.settings || { warningWindowDays: 30, urgentWindowDays: 7 },
          groupMigrationV2: true,
        };
      }
    }
  } catch {
    // Fallback to empty state on malformed localStorage
  }
  return { ...createEmptyState(), groupMigrationV2: true };
}

export default function App() {
  const [state, setState] = useState<StoredState>(loadInitialState);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Selected asset & group filter in catalog
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [majorGroupFilter, setMajorGroupFilter] = useState<'all' | MajorBenefitGroup>('all');

  // Modals
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<BenefitAsset | null>(null);

  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<MembershipRecord | null>(null);

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

  const dueMembershipCount = useMemo(() => {
    const today = getTodayISO();
    return state.memberships.filter((m) => {
      if (m.snoozedUntil && m.snoozedUntil > today) return false;
      const days = getDaysUntilExpiry(m.expiryDate, today);
      return days !== null && days <= Math.max(m.remindBeforeDays, state.settings.warningWindowDays);
    }).length;
  }, [state.memberships, state.settings.warningWindowDays]);

  const urgentReminderCount = useMemo(() => {
    const today = getTodayISO();
    const assetCount = state.assets.filter((a) => {
      if (a.balance <= 0 || !a.expiryDate) return false;
      if (a.snoozedUntil && a.snoozedUntil > today) return false;
      const days = getDaysUntilExpiry(a.expiryDate, today);
      return days !== null && days <= state.settings.warningWindowDays;
    }).length;
    return assetCount + dueMembershipCount;
  }, [state.assets, state.settings.warningWindowDays, dueMembershipCount]);

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

  const handleSaveMembership = (
    data: Omit<MembershipRecord, 'id' | 'updatedAt'>,
    existingId?: string
  ) => {
    const today = getTodayISO();
    if (existingId) {
      setState((prev) => ({
        ...prev,
        memberships: prev.memberships.map((m) =>
          m.id === existingId ? { ...m, ...data, updatedAt: today } : m
        ),
      }));
      showToast(`已更新会员「${data.name}」`);
    } else {
      const newRecord: MembershipRecord = {
        ...data,
        id: `mem-${Date.now()}`,
        updatedAt: today,
      };
      setState((prev) => ({
        ...prev,
        memberships: [newRecord, ...prev.memberships],
      }));
      showToast(`已录入会员「${data.name}」`);
    }
  };

  const handleRenewMembership = (membership: MembershipRecord) => {
    const today = getTodayISO();
    const baseDate =
      membership.expiryDate >= today ? membership.expiryDate : today;
    const monthsToAdd =
      membership.billingCycle === 'monthly'
        ? 1
        : membership.billingCycle === 'quarterly'
          ? 3
          : 12;
    const nextExpiry = addMonthsISO(baseDate, monthsToAdd);

    setState((prev) => ({
      ...prev,
      memberships: prev.memberships.map((m) =>
        m.id === membership.id
          ? { ...m, expiryDate: nextExpiry, snoozedUntil: null, updatedAt: today }
          : m
      ),
    }));
    showToast(`「${membership.name}」已续卡顺延至 ${nextExpiry}`);
  };

  const handleDeleteMembership = (id: string) => {
    const target = state.memberships.find((m) => m.id === id);
    setState((prev) => ({
      ...prev,
      memberships: prev.memberships.filter((m) => m.id !== id),
    }));
    if (target) showToast(`已删除会员「${target.name}」`);
  };

  const handleSnoozeMembership = (id: string, days: number | null) => {
    const snoozedUntil = days ? shiftDateISO(getTodayISO(), days) : null;
    setState((prev) => ({
      ...prev,
      memberships: prev.memberships.map((m) =>
        m.id === id ? { ...m, snoozedUntil } : m
      ),
    }));
    showToast(days ? `已暂缓续卡提醒 ${days} 天` : '已恢复会员续卡提醒');
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
    a.download = `益账通全量数据备份_${formatISODate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('全量 JSON 数据备份已导出');
  };

  const handleImportJSON = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      if (Array.isArray(parsed.assets) && Array.isArray(parsed.ledger)) {
        const shouldReinferHomeCar = !parsed.groupMigrationV2;
        setState({
          assets: parsed.assets.map((a) => ({
            ...a,
            majorGroup: normalizeAssetGroup(a, shouldReinferHomeCar),
          })),
          ledger: parsed.ledger,
          memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
          settings: parsed.settings || { warningWindowDays: 30, urgentWindowDays: 7 },
          groupMigrationV2: true,
        });
        showToast('已成功从 JSON 备份恢复全部数据');
      } else {
        showToast('备份文件格式不完整');
      }
    } catch {
      showToast('无法解析 JSON 文件');
    }
  };

  const handleImportAssetsCSV = (raw: string) => {
    const imported = parseAssetsFromCSV(raw);
    if (imported.length === 0) {
      showToast('CSV 文件中未解析到有效权益记录，请核对格式或使用导入模板');
      return;
    }
    const today = getTodayISO();
    const initialEntries: LedgerEntry[] = imported
      .filter((a) => a.balance > 0)
      .map((a, idx) => ({
        id: `tx-imp-${Date.now()}-${idx}`,
        assetId: a.id,
        assetName: a.name,
        channelName: a.channelName,
        category: a.category,
        type: 'earn',
        deltaQuantity: a.balance,
        unitLabel: a.unitLabel,
        estimatedValueRmb: getAssetValueRmb(a),
        savedRmb: 0,
        merchantOrScene: 'CSV 批量导入建档入账',
        date: today,
      }));

    setState((prev) => ({
      ...prev,
      assets: [...imported, ...prev.assets],
      ledger: [...initialEntries, ...prev.ledger],
    }));
    showToast(`已成功批量导入 ${imported.length} 条权益资产`);
  };

  const handleImportExcel = (buffer: ArrayBuffer) => {
    try {
      const { assets: importedAssets, memberships: importedMemberships } =
        parseWorkbookFromExcel(buffer);
      if (importedAssets.length === 0 && importedMemberships.length === 0) {
        showToast('Excel 中未解析到有效权益或会员数据，请核对表头或下载导入模板');
        return;
      }
      const today = getTodayISO();
      const initialEntries: LedgerEntry[] = importedAssets
        .filter((a) => a.balance > 0)
        .map((a, idx) => ({
          id: `tx-xlsx-${Date.now()}-${idx}`,
          assetId: a.id,
          assetName: a.name,
          channelName: a.channelName,
          category: a.category,
          type: 'earn',
          deltaQuantity: a.balance,
          unitLabel: a.unitLabel,
          estimatedValueRmb: getAssetValueRmb(a),
          savedRmb: 0,
          merchantOrScene: 'Excel 批量导入建档入账',
          date: today,
        }));

      setState((prev) => ({
        ...prev,
        assets: [...importedAssets, ...prev.assets],
        memberships: [...importedMemberships, ...prev.memberships],
        ledger: [...initialEntries, ...prev.ledger],
      }));
      showToast(
        `已成功导入 ${importedAssets.length} 条权益资产、${importedMemberships.length} 条会员体系`
      );
    } catch {
      showToast('Excel 文件解析失败，请确认文件格式为 .xlsx 或 .xls');
    }
  };

  const handleClearAllData = () => {
    const fresh = { ...createEmptyState(), groupMigrationV2: true };
    setState(fresh);
    setSelectedAssetId(null);
    showToast('已清空全部本地数据');
  };

  const navItems: {
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
  }[] = [
    { id: 'overview', label: '资产总览与趋势', shortLabel: '总览', icon: BarChart3 },
    { id: 'catalog', label: '权益与路径库', shortLabel: '权益库', icon: Layers },
    {
      id: 'memberships',
      label: '会员体系与续卡',
      shortLabel: '会员',
      icon: CreditCard,
      badgeCount: dueMembershipCount,
    },
    {
      id: 'reminders',
      label: '到期与续卡提醒',
      shortLabel: '提醒',
      icon: Bell,
      badgeCount: urgentReminderCount,
    },
    { id: 'ledger', label: '单笔与综合消长', shortLabel: '消长', icon: ListOrdered },
    { id: 'savings', label: '优惠汇总分析', shortLabel: '汇总', icon: PieChart },
  ];

  const mobileTabItems = navItems.slice(0, 5);
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

        {/* Bottom Workspace Summary & Data Import/Export Trigger */}
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
            className="w-full py-2 px-3 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            数据导入与导出
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-12 sm:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3.5 sm:px-6 flex items-center justify-between gap-3 sm:gap-6 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[40px] min-w-[40px] p-2 -ml-2 text-slate-600 hover:text-slate-900 inline-flex items-center justify-center cursor-pointer"
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

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDataModalOpen(true)}
              className="hidden sm:inline-flex min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              导入 / 导出
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingAsset(null);
                setAssetModalOpen(true);
              }}
              className="min-h-[36px] px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="sm:hidden">录入</span>
              <span className="hidden sm:inline">录入新权益</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConsumeDefaultAssetId(undefined);
                setConsumeModalOpen(true);
              }}
              className="min-h-[36px] px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="sm:hidden">记一笔</span>
              <span className="hidden sm:inline">记一笔消长</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 pb-20 lg:pb-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              assets={state.assets}
              ledger={state.ledger}
              memberships={state.memberships}
              settings={state.settings}
              onNavigate={setActiveTab}
              onNavigateCatalogGroup={(group) => {
                setMajorGroupFilter(group);
                setActiveTab('catalog');
              }}
              onOpenAssetModal={() => {
                setEditingAsset(null);
                setAssetModalOpen(true);
              }}
              onOpenMembershipModal={() => {
                setEditingMembership(null);
                setMembershipModalOpen(true);
              }}
              onOpenConsumeModal={(assetId) => {
                setConsumeDefaultAssetId(assetId);
                setConsumeModalOpen(true);
              }}
              onOpenDataModal={() => setDataModalOpen(true)}
              onRenewMembership={handleRenewMembership}
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
              majorGroupFilter={majorGroupFilter}
              onMajorGroupFilterChange={setMajorGroupFilter}
              onSelectAsset={(asset) => setSelectedAssetId(asset?.id || null)}
              onOpenAssetModal={(asset) => {
                setEditingAsset(asset || null);
                setAssetModalOpen(true);
              }}
              onOpenConsumeModal={(assetId) => {
                setConsumeDefaultAssetId(assetId);
                setConsumeModalOpen(true);
              }}
              onOpenDataModal={() => setDataModalOpen(true)}
              onDeleteAsset={handleDeleteAsset}
              onCopyPath={handleCopyPath}
            />
          )}

          {activeTab === 'memberships' && (
            <MembershipsView
              memberships={state.memberships}
              onOpenMembershipModal={(m) => {
                setEditingMembership(m || null);
                setMembershipModalOpen(true);
              }}
              onRenewMembership={handleRenewMembership}
              onDeleteMembership={handleDeleteMembership}
              onSnoozeMembership={handleSnoozeMembership}
              onCopyPath={handleCopyPath}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersView
              assets={state.assets}
              memberships={state.memberships}
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
              onRenewMembership={handleRenewMembership}
              onSnoozeMembership={handleSnoozeMembership}
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
              onNavigateSavings={() => setActiveTab('savings')}
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

      <MembershipFormModal
        isOpen={membershipModalOpen}
        editingMembership={editingMembership}
        onClose={() => {
          setMembershipModalOpen(false);
          setEditingMembership(null);
        }}
        onSave={handleSaveMembership}
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
        assets={state.assets}
        ledger={state.ledger}
        memberships={state.memberships}
        onClose={() => setDataModalOpen(false)}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onImportAssetsCSV={handleImportAssetsCSV}
        onImportExcel={handleImportExcel}
        onClearAllData={handleClearAllData}
      />

      {/* Mobile Thumb-Zone Bottom Tab Bar */}
      <nav
        aria-label="移动端主导航"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5"
      >
        {mobileTabItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                isActive ? 'text-teal-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.badgeCount != null && item.badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-3.5 px-1 rounded-full bg-amber-600 text-white text-[9px] leading-3.5 font-mono-num text-center">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
              </div>
              <span className="truncate max-w-full px-1">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Non-intrusive Toast */}
      {toastMsg && (
        <div className="fixed bottom-16 lg:bottom-5 left-3 right-3 sm:left-auto sm:right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg text-center sm:text-left">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
