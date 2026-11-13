import React, { useEffect, useState } from 'react';
import { Download, RotateCcw, Upload, X } from 'lucide-react';
import {
  AssetCategory,
  BenefitAsset,
  ChannelType,
  LedgerEntry,
  LedgerTxType,
} from '../types/benefits';
import { getTodayISO } from '../data/seedData';
import { formatCurrency, formatQuantity } from '../utils/calculations';

/* =========================================================
   1. Asset Create / Edit Modal
   ========================================================= */
interface AssetFormModalProps {
  isOpen: boolean;
  editingAsset: BenefitAsset | null;
  onClose: () => void;
  onSave: (assetData: Omit<BenefitAsset, 'id' | 'updatedAt'>, existingId?: string) => void;
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
  isOpen,
  editingAsset,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('bank');
  const [appName, setAppName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('points');
  const [unitLabel, setUnitLabel] = useState('分');
  const [balance, setBalance] = useState('0');
  const [rmbPerUnit, setRmbPerUnit] = useState('0.02');
  const [appPath, setAppPath] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingAsset) {
      setName(editingAsset.name);
      setChannelName(editingAsset.channelName);
      setChannelType(editingAsset.channelType);
      setAppName(editingAsset.appName);
      setCategory(editingAsset.category);
      setUnitLabel(editingAsset.unitLabel);
      setBalance(String(editingAsset.balance));
      setRmbPerUnit(String(editingAsset.rmbPerUnit));
      setAppPath(editingAsset.appPath);
      setExpiryDate(editingAsset.expiryDate || '');
      setNotes(editingAsset.notes || '');
    } else {
      setName('');
      setChannelName('');
      setChannelType('bank');
      setAppName('');
      setCategory('points');
      setUnitLabel('分');
      setBalance('1000');
      setRmbPerUnit('0.02');
      setAppPath('');
      setExpiryDate('');
      setNotes('');
    }
  }, [isOpen, editingAsset]);

  if (!isOpen) return null;

  const handleCategoryChange = (next: AssetCategory) => {
    setCategory(next);
    if (!editingAsset) {
      if (next === 'points') {
        setUnitLabel('分');
        setRmbPerUnit('0.02');
      } else if (next === 'prepaid') {
        setUnitLabel('元');
        setRmbPerUnit('1');
      } else if (next === 'voucher') {
        setUnitLabel('张');
        setRmbPerUnit('20');
      } else {
        setUnitLabel('次');
        setRmbPerUnit('100');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numBal = Math.max(0, Number(balance) || 0);
    const numRate = Math.max(0, Number(rmbPerUnit) || 0);
    if (!name.trim() || !channelName.trim() || !appPath.trim()) return;

    onSave(
      {
        name: name.trim(),
        channelName: channelName.trim(),
        channelType,
        appName: appName.trim() || `${channelName.trim()}App`,
        category,
        unitLabel: unitLabel.trim() || '份',
        balance: numBal,
        initialBalance: editingAsset ? editingAsset.initialBalance : numBal,
        rmbPerUnit: numRate,
        appPath: appPath.trim(),
        expiryDate: expiryDate ? expiryDate : null,
        notes: notes.trim() || undefined,
      },
      editingAsset?.id
    );
    onClose();
  };

  const previewVal = (Number(balance) || 0) * (Number(rmbPerUnit) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[1px]">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {editingAsset ? '编辑权益资产与路径' : '录入新渠道权益 / 积分 / 储值卡'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                权益 / 卡券名称 *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：招行经典白洗车权益"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                所属渠道 / 机构 *
              </label>
              <input
                required
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="如：招商银行、支付宝、美团"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">渠道分类</label>
              <select
                value={channelType}
                onChange={(e) => setChannelType(e.target.value as ChannelType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-700"
              >
                <option value="bank">银行渠道</option>
                <option value="platform">生活平台</option>
                <option value="retail">商超零售</option>
                <option value="travel">航司酒店</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">资产类型</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-700"
              >
                <option value="points">积分资产</option>
                <option value="prepaid">储值卡</option>
                <option value="voucher">有价卡券</option>
                <option value="privilege">次数权益</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">所属 App 入口</label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="如：掌上生活App"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              App 内权益访问与核销路径 *（支持全文检索）
            </label>
            <input
              required
              type="text"
              value={appPath}
              onChange={(e) => setAppPath(e.target.value)}
              placeholder="例如：掌上生活App → 我的 → 积分 → 积分兑换"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">当前余额 *</label>
              <input
                required
                type="number"
                step="any"
                min="0"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">计量单位</label>
              <input
                required
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="分 / 元 / 张 / 次"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                单价估值 (¥/{unitLabel || '单位'})
              </label>
              <input
                required
                type="number"
                step="any"
                min="0"
                value={rmbPerUnit}
                onChange={(e) => setRmbPerUnit(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                到期日期（空=长期）
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-2.5 py-2 text-sm font-mono-num border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 flex items-center justify-between">
            <span>自动预估人民币价值</span>
            <span className="font-mono-num font-semibold text-teal-700">
              {formatCurrency(previewVal)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">使用规则与备注</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="记录使用门槛、携伴限制或最佳兑换比例..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              {editingAsset ? '保存修改' : '确认录入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================================================
   2. Log Consumption / Earn / Expiry Modal
   ========================================================= */
interface ConsumeFormModalProps {
  isOpen: boolean;
  assets: BenefitAsset[];
  defaultAssetId?: string;
  onClose: () => void;
  onSubmit: (entry: Omit<LedgerEntry, 'id'>) => void;
}

export const ConsumeFormModal: React.FC<ConsumeFormModalProps> = ({
  isOpen,
  assets,
  defaultAssetId,
  onClose,
  onSubmit,
}) => {
  const [assetId, setAssetId] = useState('');
  const [txType, setTxType] = useState<LedgerTxType>('consume');
  const [quantity, setQuantity] = useState('1');
  const [originalPrice, setOriginalPrice] = useState('');
  const [actualPaid, setActualPaid] = useState('0');
  const [manualSaved, setManualSaved] = useState('');
  const [merchantOrScene, setMerchantOrScene] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const chosenId = defaultAssetId || assets[0]?.id || '';
    setAssetId(chosenId);
    setTxType('consume');
    const chosen = assets.find((a) => a.id === chosenId);
    if (chosen) {
      const defQty = chosen.category === 'points' ? Math.min(1000, chosen.balance) : 1;
      setQuantity(String(defQty || 1));
      const est = Number(((defQty || 1) * chosen.rmbPerUnit).toFixed(2));
      setOriginalPrice(String(est));
      setActualPaid('0');
      setManualSaved('');
    } else {
      setQuantity('1');
      setOriginalPrice('');
      setActualPaid('0');
      setManualSaved('');
    }
    setMerchantOrScene('');
    setDate(getTodayISO());
    setNotes('');
  }, [isOpen, defaultAssetId, assets]);

  if (!isOpen) return null;

  const selectedAsset = assets.find((a) => a.id === assetId);
  const absQty = Math.max(0, Number(quantity) || 0);
  const estVal = selectedAsset ? Number((absQty * selectedAsset.rmbPerUnit).toFixed(2)) : 0;

  // Compute saved amount from original - actualPaid, or manual override
  const computedSaved =
    manualSaved !== ''
      ? Math.max(0, Number(manualSaved) || 0)
      : originalPrice !== ''
        ? Math.max(0, Number(((Number(originalPrice) || 0) - (Number(actualPaid) || 0)).toFixed(2)))
        : 0;

  const handleAssetSwitch = (nextId: string) => {
    setAssetId(nextId);
    const nextAsset = assets.find((a) => a.id === nextId);
    if (nextAsset) {
      const defQty =
        nextAsset.category === 'points'
          ? Math.min(1000, nextAsset.balance || 1000)
          : nextAsset.category === 'prepaid'
            ? Math.min(100, nextAsset.balance || 100)
            : 1;
      setQuantity(String(defQty));
      if (txType === 'consume') {
        setOriginalPrice(String(Number((defQty * nextAsset.rmbPerUnit).toFixed(2))));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || absQty <= 0) return;

    const deltaQuantity =
      txType === 'earn'
        ? absQty
        : txType === 'consume' || txType === 'expire'
          ? -absQty
          : Number(quantity) || 0;

    onSubmit({
      assetId: selectedAsset.id,
      assetName: selectedAsset.name,
      channelName: selectedAsset.channelName,
      category: selectedAsset.category,
      type: txType,
      deltaQuantity,
      unitLabel: selectedAsset.unitLabel,
      estimatedValueRmb: estVal,
      originalPriceRmb: originalPrice !== '' ? Number(originalPrice) : undefined,
      actualPaidRmb: originalPrice !== '' ? Number(actualPaid) || 0 : undefined,
      savedRmb: txType === 'expire' ? 0 : computedSaved,
      merchantOrScene:
        merchantOrScene.trim() ||
        (txType === 'earn'
          ? `${selectedAsset.channelName}入账获取`
          : txType === 'expire'
            ? '到期自动清零/作废'
            : `${selectedAsset.channelName}消费核销`),
      date: date || getTodayISO(),
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[1px]">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">记录消长流水与核销优惠</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          {/* Type segmented control */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'consume', label: '核销消费 (-)' },
                { id: 'earn', label: '获取/充值 (+)' },
                { id: 'expire', label: '过期作废 (-)' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTxType(t.id)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  txType === t.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">关联权益资产 *</label>
            {assets.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                当前暂无已录入的权益或储值卡，请先点击右上角「录入新权益」添加资产后再记账。
              </div>
            ) : (
              <select
                required
                value={assetId}
                onChange={(e) => handleAssetSwitch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-700"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.channelName}] {a.name}（余 {formatQuantity(a.balance, a.unitLabel)}）
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                变动数量 ({selectedAsset?.unitLabel || '单位'}) *
              </label>
              <input
                required
                type="number"
                step="any"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
              {selectedAsset && (
                <div className="mt-1 text-[11px] text-slate-500">
                  折合资产估值: {formatCurrency(estVal)}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">发生日期 *</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          {txType !== 'expire' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span>优惠节省核算（选填）</span>
                <span className="font-mono-num text-emerald-700 font-semibold">
                  本次省 {formatCurrency(computedSaved)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">消费原价 (¥)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={originalPrice}
                    onChange={(e) => {
                      setOriginalPrice(e.target.value);
                      setManualSaved('');
                    }}
                    placeholder="如 120"
                    className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">现金实付 (¥)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={actualPaid}
                    onChange={(e) => {
                      setActualPaid(e.target.value);
                      setManualSaved('');
                    }}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">或直填省钱 (¥)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={manualSaved}
                    onChange={(e) => setManualSaved(e.target.value)}
                    placeholder="自动算"
                    className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              消费商户 / 变动说明 *
            </label>
            <input
              required
              type="text"
              value={merchantOrScene}
              onChange={(e) => setMerchantOrScene(e.target.value)}
              placeholder={
                txType === 'earn'
                  ? '如：95折充值卡入账 / 信用卡活动返积分'
                  : '如：盒马门店生鲜采购 / 虹桥机场贵宾厅核销'
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">备注</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="选填..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={assets.length === 0}
              className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg cursor-pointer"
            >
              确认记账
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================================================
   3. Data Backup / Import / Reset Modal
   ========================================================= */
interface DataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportJSON: () => void;
  onImportJSON: (raw: string) => void;
  onClearAllData: () => void;
}

export const DataManageModal: React.FC<DataModalProps> = ({
  isOpen,
  onClose,
  onExportJSON,
  onImportJSON,
  onClearAllData,
}) => {
  if (!isOpen) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportJSON(reader.result);
        onClose();
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[1px]">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-lg">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">本地数据备份与管理</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-sm">
          <p className="text-xs text-slate-500 leading-relaxed">
            所有渠道权益、App路径、消长流水与优惠记录均自动保存在当前浏览器本地存储中。你可随时导出 JSON 备份或恢复。
          </p>

          <button
            type="button"
            onClick={onExportJSON}
            className="w-full py-2.5 px-4 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            导出全量 JSON 备份文件
          </button>

          <label className="w-full py-2.5 px-4 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center justify-center gap-2 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            从 JSON 文件恢复数据
            <input type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
          </label>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onClearAllData();
                onClose();
              }}
              className="w-full py-2.5 px-4 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              清空全部本地数据
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
