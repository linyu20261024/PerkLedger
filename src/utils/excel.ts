import * as XLSX from 'xlsx';
import {
  AssetCategory,
  BenefitAsset,
  ChannelType,
  LedgerEntry,
  MajorBenefitGroup,
  MembershipBillingCycle,
  MembershipRecord,
} from '../types/benefits';
import { formatISODate, getTodayISO } from '../data/seedData';
import {
  ASSET_CATEGORY_LABELS,
  BILLING_CYCLE_LABELS,
  CHANNEL_TYPE_LABELS,
  MAJOR_GROUP_LABELS,
  getAssetValueRmb,
  inferMajorGroup,
  isMembershipLifetime,
} from './calculations';

function normalizeExcelDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number' && !Number.isNaN(val)) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${m}-${d}`;
    }
  }

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return formatISODate(val);
  }

  const str = String(val).trim();
  if (!str || str === '长期有效') return null;

  // Accept YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

export function exportWorkbookToExcel(
  assets: BenefitAsset[],
  ledger: LedgerEntry[],
  memberships: MembershipRecord[]
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 权益资产台账
  const assetRows = assets.map((a) => ({
    权益名称: a.name,
    所属渠道: a.channelName,
    渠道分类: CHANNEL_TYPE_LABELS[a.channelType],
    所属App: a.appName,
    资产类型: ASSET_CATEGORY_LABELS[a.category],
    权益大类:
      MAJOR_GROUP_LABELS[a.majorGroup || inferMajorGroup(a.category, a.channelType, a.name)],
    当前余额: a.balance,
    计量单位: a.unitLabel,
    单价估值: a.rmbPerUnit,
    折合总值: getAssetValueRmb(a),
    App内访问路径: a.appPath,
    到期日期: a.expiryDate || '长期有效',
    备注: a.notes || '',
  }));
  const wsAssets = XLSX.utils.json_to_sheet(
    assetRows.length > 0
      ? assetRows
      : [
          {
            权益名称: '',
            所属渠道: '',
            渠道分类: '',
            所属App: '',
            资产类型: '',
            权益大类: '',
            当前余额: '',
            计量单位: '',
            单价估值: '',
            折合总值: '',
            App内访问路径: '',
            到期日期: '',
            备注: '',
          },
        ]
  );
  wsAssets['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 24 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 42 },
    { wch: 14 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAssets, '权益资产台账');

  // Sheet 2: 消长与优惠流水
  const typeLabel: Record<string, string> = {
    earn: '获取/入账',
    consume: '核销/消费',
    expire: '过期作废',
    adjust: '盘点调整',
  };
  const ledgerRows = ledger.map((tx) => ({
    日期: tx.date,
    所属渠道: tx.channelName,
    权益名称: tx.assetName,
    变动类型: typeLabel[tx.type] || tx.type,
    数量变动: tx.deltaQuantity,
    计量单位: tx.unitLabel,
    折合价值: tx.estimatedValueRmb,
    消费原价: tx.originalPriceRmb ?? '',
    现金实付: tx.actualPaidRmb ?? '',
    节省优惠: tx.savedRmb,
    消费场景或商户: tx.merchantOrScene,
    备注: tx.notes || '',
  }));
  const wsLedger = XLSX.utils.json_to_sheet(
    ledgerRows.length > 0
      ? ledgerRows
      : [
          {
            日期: '',
            所属渠道: '',
            权益名称: '',
            变动类型: '',
            数量变动: '',
            计量单位: '',
            折合价值: '',
            消费原价: '',
            现金实付: '',
            节省优惠: '',
            消费场景或商户: '',
            备注: '',
          },
        ]
  );
  wsLedger['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLedger, '消长与优惠流水');

  // Sheet 3: 会员体系与续卡
  const memberRows = memberships.map((m) => {
    const lifetime = isMembershipLifetime(m);
    return {
      会员名称: m.name,
      所属平台: m.platform,
      会员等级: m.tierLevel,
      续费周期: BILLING_CYCLE_LABELS[m.billingCycle],
      会费成本: m.feeRmb,
      是否自动续费: lifetime ? '无需续费' : m.autoRenew ? '是' : '否',
      到期续卡日期: lifetime ? '长期有效' : m.expiryDate || '',
      提前提醒天数: lifetime ? 0 : m.remindBeforeDays,
      App内管理路径: m.appPath,
      核心权益摘要: m.corePerks,
      备注: m.notes || '',
    };
  });
  const wsMembers = XLSX.utils.json_to_sheet(
    memberRows.length > 0
      ? memberRows
      : [
          {
            会员名称: '',
            所属平台: '',
            会员等级: '',
            续费周期: '',
            会费成本: '',
            是否自动续费: '',
            到期续卡日期: '',
            提前提醒天数: '',
            App内管理路径: '',
            核心权益摘要: '',
            备注: '',
          },
        ]
  );
  wsMembers['!cols'] = [
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 36 },
    { wch: 34 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMembers, '会员体系与续卡');

  XLSX.writeFile(wb, `益账通_全渠道权益总账_${formatISODate(new Date())}.xlsx`);
}

export function downloadExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  const wsAssets = XLSX.utils.json_to_sheet([
    {
      权益名称: '示例：某行信用卡积分（可删改）',
      所属渠道: '某银行',
      渠道分类: '银行渠道',
      所属App: '银行App',
      资产类型: '积分资产',
      权益大类: '信用卡积分',
      当前余额: 10000,
      计量单位: '分',
      单价估值: 0.02,
      App内访问路径: '银行App → 我的 → 积分兑换',
      到期日期: '2026-12-31',
      备注: '支持直接填写中文分类名，到期日期留空表示长期有效',
    },
  ]);
  wsAssets['!cols'] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 36 },
    { wch: 14 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAssets, '权益资产台账');

  const wsMembers = XLSX.utils.json_to_sheet([
    {
      会员名称: '示例：电商会员年卡（可删改）',
      所属平台: '某平台',
      会员等级: '年度会员',
      续费周期: '年卡',
      会费成本: 99,
      是否自动续费: '否',
      到期续卡日期: '2027-06-30',
      提前提醒天数: 15,
      App内管理路径: '平台App → 我的 → 会员中心 → 续费管理',
      核心权益摘要: '免运费券、专属折扣、联名视频会员',
      备注: '续费周期支持：年卡/季卡/月卡/自定义周期/长期有效；长期有效可留空到期日',
    },
  ]);
  wsMembers['!cols'] = [
    { wch: 26 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 36 },
    { wch: 34 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMembers, '会员体系与续卡');

  XLSX.writeFile(wb, '益账通_Excel批量导入模板.xlsx');
}

export function parseWorkbookFromExcel(buffer: ArrayBuffer): {
  assets: BenefitAsset[];
  memberships: MembershipRecord[];
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const today = getTodayISO();

  const reverseChannelType: Record<string, ChannelType> = {
    bank: 'bank',
    银行渠道: 'bank',
    银行: 'bank',
    platform: 'platform',
    生活平台: 'platform',
    retail: 'retail',
    商超零售: 'retail',
    travel: 'travel',
    航司酒店: 'travel',
  };
  const reverseCategory: Record<string, AssetCategory> = {
    points: 'points',
    积分资产: 'points',
    积分: 'points',
    prepaid: 'prepaid',
    储值卡: 'prepaid',
    voucher: 'voucher',
    有价卡券: 'voucher',
    卡券: 'voucher',
    privilege: 'privilege',
    次数权益: 'privilege',
  };
  const reverseMajorGroup: Record<string, MajorBenefitGroup> = {
    credit_points: 'credit_points',
    信用卡积分: 'credit_points',
    prepaid_stored: 'prepaid_stored',
    生活购物商旅平台储值: 'prepaid_stored',
    platform_points: 'platform_points',
    '平台 / 航司 / 酒店积分': 'platform_points',
    lounge_travel: 'lounge_travel',
    贵宾厅与商旅出行权益: 'lounge_travel',
    health_care: 'health_care',
    健康检查与医疗权益: 'health_care',
    voucher_coupon: 'voucher_coupon',
    有价卡券与立减金: 'voucher_coupon',
    home_car_service: 'home_car_service',
    居家与洗车服务权益: 'home_car_service',
    entertainment: 'entertainment',
    文娱与视听权益: 'entertainment',
    lifestyle_service: 'home_car_service',
    居家洗车与文娱权益: 'home_car_service',
  };
  const reverseCycle: Record<string, MembershipBillingCycle> = {
    monthly: 'monthly',
    月卡: 'monthly',
    quarterly: 'quarterly',
    季卡: 'quarterly',
    yearly: 'yearly',
    年卡: 'yearly',
    custom: 'custom',
    自定义周期: 'custom',
    lifetime: 'lifetime',
    '长期有效（免续卡）': 'lifetime',
    长期有效: 'lifetime',
    长期: 'lifetime',
    永久有效: 'lifetime',
    永久: 'lifetime',
    终身: 'lifetime',
    免续卡: 'lifetime',
  };

  const assets: BenefitAsset[] = [];
  const memberships: MembershipRecord[] = [];

  const getField = (row: Record<string, unknown>, keys: string[]): unknown => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== '') return row[k];
    }
    return undefined;
  };

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (rows.length === 0) continue;

    const firstKeys = Object.keys(rows[0]);
    const isMemberSheet =
      sheetName.includes('会员') ||
      firstKeys.some((k) => k.includes('会员名称') || k.includes('到期续卡日期'));
    const isAssetSheet =
      sheetName.includes('权益') ||
      firstKeys.some((k) => k.includes('权益名称') || k.includes('所属渠道'));

    if (isMemberSheet) {
      rows.forEach((row, idx) => {
        const name = String(getField(row, ['会员名称', '名称']) || '').trim();
        const platform = String(getField(row, ['所属平台', '所属平台/机构', '平台']) || '').trim();
        if (!name || !platform) return;

        const tierLevel = String(getField(row, ['会员等级', '等级']) || '标准会员').trim();
        const cycleRaw = String(getField(row, ['续费周期', '周期']) || 'yearly').trim();
        const parsedCycle = reverseCycle[cycleRaw] || 'yearly';
        const rawExpiryField = getField(row, ['到期续卡日期', '到期/续卡日期', '到期日期']);
        const rawExpiryText = String(rawExpiryField || '').trim();
        const isLifetime =
          parsedCycle === 'lifetime' ||
          rawExpiryText === '长期有效' ||
          rawExpiryText === '永久有效' ||
          rawExpiryText === '免续卡';
        const billingCycle: MembershipBillingCycle = isLifetime ? 'lifetime' : parsedCycle;
        const feeRmb = Math.max(0, Number(getField(row, ['会费成本', '会费成本(元)', '会费'])) || 0);
        const autoRaw = String(getField(row, ['是否自动续费', '自动续费']) || '').trim().toLowerCase();
        const autoRenew = isLifetime
          ? false
          : autoRaw === '是' || autoRaw === 'true' || autoRaw === '1' || autoRaw === 'yes';
        const parsedDate = normalizeExcelDate(rawExpiryField);
        const expiryDate = isLifetime ? null : parsedDate || today;
        const remindBeforeDays = Math.max(
          1,
          Number(getField(row, ['提前提醒天数', '提醒天数'])) || 15
        );
        const appPath = String(
          getField(row, ['App内管理路径', 'App内续费/管理路径', '管理路径']) || ''
        ).trim();
        const corePerks = String(getField(row, ['核心权益摘要', '核心权益']) || '').trim();
        const notes = String(getField(row, ['备注']) || '').trim() || undefined;

        memberships.push({
          id: `mem-xlsx-${Date.now()}-${idx}`,
          name,
          platform,
          tierLevel,
          feeRmb,
          billingCycle,
          autoRenew,
          expiryDate,
          remindBeforeDays,
          appPath,
          corePerks,
          notes,
          updatedAt: today,
        });
      });
    } else if (isAssetSheet) {
      rows.forEach((row, idx) => {
        const name = String(getField(row, ['权益名称', '名称']) || '').trim();
        const channelName = String(getField(row, ['所属渠道', '渠道']) || '').trim();
        if (!name || !channelName) return;

        const channelTypeRaw = String(getField(row, ['渠道分类']) || '').trim();
        const channelType = reverseChannelType[channelTypeRaw] || 'platform';
        const appName = String(getField(row, ['所属App', 'App入口']) || `${channelName}App`).trim();
        const categoryRaw = String(getField(row, ['资产类型']) || '').trim();
        const category = reverseCategory[categoryRaw] || 'points';
        const majorGroupRaw = String(getField(row, ['权益大类']) || '').trim();
        const mappedGroup = reverseMajorGroup[majorGroupRaw];
        const isLegacyGroup =
          majorGroupRaw === 'lifestyle_service' || majorGroupRaw === '居家洗车与文娱权益';
        const majorGroup =
          !mappedGroup || isLegacyGroup
            ? inferMajorGroup(category, channelType, name)
            : mappedGroup;
        const balance = Math.max(0, Number(getField(row, ['当前余额', '余额'])) || 0);
        const unitLabel = String(getField(row, ['计量单位', '单位']) || '份').trim();
        const rmbPerUnit = Math.max(
          0,
          Number(getField(row, ['单价估值', '单价估值(元)'])) || 0
        );
        const appPath = String(
          getField(row, ['App内访问路径', '访问路径', '路径']) || `${appName} -> 权益中心`
        ).trim();
        const expiryDate = normalizeExcelDate(getField(row, ['到期日期', '有效期']));
        const notes = String(getField(row, ['备注']) || '').trim() || undefined;

        assets.push({
          id: `ast-xlsx-${Date.now()}-${idx}`,
          name,
          channelName,
          channelType,
          appName,
          category,
          majorGroup,
          unitLabel,
          balance,
          initialBalance: balance,
          rmbPerUnit,
          appPath,
          expiryDate,
          notes,
          updatedAt: today,
        });
      });
    }
  }

  return { assets, memberships };
}
