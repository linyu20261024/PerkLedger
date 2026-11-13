import React, { useMemo, useState } from 'react';
import { BenefitAsset, LedgerEntry } from '../types/benefits';
import {
  ASSET_CATEGORY_LABELS,
  buildDailyTrendSeries,
  formatCurrency,
  getAssetValueRmb,
} from '../utils/calculations';

interface TrendChartsProps {
  assets: BenefitAsset[];
  ledger: LedgerEntry[];
}

type TrendMetricMode = 'both' | 'asset' | 'saved' | 'flow';

export const TrendCharts: React.FC<TrendChartsProps> = ({ assets, ledger }) => {
  const [daysRange, setDaysRange] = useState<14 | 30 | 60>(30);
  const [metricMode, setMetricMode] = useState<TrendMetricMode>('both');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = useMemo(
    () => buildDailyTrendSeries(assets, ledger, daysRange),
    [assets, ledger, daysRange]
  );

  // Category allocation data
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { key: string; label: string; value: number; count: number; color: string }>();
    const palette: Record<string, string> = {
      prepaid: '#0F766E',
      points: '#2563EB',
      privilege: '#D97706',
      voucher: '#16A34A',
    };

    for (const key of ['prepaid', 'points', 'privilege', 'voucher'] as const) {
      map.set(key, {
        key,
        label: ASSET_CATEGORY_LABELS[key],
        value: 0,
        count: 0,
        color: palette[key],
      });
    }

    let total = 0;
    for (const a of assets) {
      const val = getAssetValueRmb(a);
      total += val;
      const item = map.get(a.category);
      if (item) {
        item.value += val;
        item.count += 1;
      }
    }

    return {
      total,
      items: Array.from(map.values()).sort((a, b) => b.value - a.value),
    };
  }, [assets]);

  // Top channels by asset value
  const channelTop = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) {
      map.set(a.channelName, (map.get(a.channelName) || 0) + getAssetValueRmb(a));
    }
    const list = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const maxVal = list[0]?.value || 1;
    return { list, maxVal };
  }, [assets]);

  // SVG Chart dimensions
  const W = 760;
  const H = 260;
  const PAD_L = 58;
  const PAD_R = 20;
  const PAD_T = 20;
  const PAD_B = 34;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const chartMath = useMemo(() => {
    if (series.length === 0) return null;

    if (metricMode === 'flow') {
      const maxFlow = Math.max(
        100,
        ...series.map((p) => Math.max(p.inflowRmb, p.consumptionRmb + p.expiryLossRmb))
      );
      const yMax = Math.ceil(maxFlow / 100) * 100;
      const barStep = plotW / series.length;
      const barW = Math.max(3, Math.min(12, barStep * 0.34));
      return { kind: 'flow' as const, yMax, yMin: 0, barStep, barW };
    }

    const values: number[] = [];
    for (const p of series) {
      if (metricMode === 'asset' || metricMode === 'both') values.push(p.totalAssetRmb);
      if (metricMode === 'saved' || metricMode === 'both') values.push(p.cumulativeSavedRmb);
    }
    const rawMax = Math.max(100, ...values);
    const rawMin = metricMode === 'asset' ? Math.max(0, Math.min(...values) * 0.85) : 0;
    const span = Math.max(100, rawMax - rawMin);
    const yMax = Math.ceil((rawMax + span * 0.08) / 100) * 100;
    const yMin = Math.floor(rawMin / 100) * 100;

    const getX = (idx: number) =>
      series.length === 1 ? PAD_L + plotW / 2 : PAD_L + (idx / (series.length - 1)) * plotW;
    const getY = (val: number) =>
      PAD_T + plotH - ((val - yMin) / Math.max(1, yMax - yMin)) * plotH;

    const assetPath = series
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.totalAssetRmb).toFixed(1)}`)
      .join(' ');
    const assetArea =
      `${assetPath} L ${getX(series.length - 1).toFixed(1)} ${(PAD_T + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(PAD_T + plotH).toFixed(1)} Z`;

    const savedPath = series
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.cumulativeSavedRmb).toFixed(1)}`)
      .join(' ');
    const savedArea =
      `${savedPath} L ${getX(series.length - 1).toFixed(1)} ${(PAD_T + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(PAD_T + plotH).toFixed(1)} Z`;

    return {
      kind: 'line' as const,
      yMax,
      yMin,
      getX,
      getY,
      assetPath,
      assetArea,
      savedPath,
      savedArea,
    };
  }, [series, metricMode, plotW, plotH]);

  const activePoint = hoverIndex !== null ? series[hoverIndex] : series[series.length - 1];

  const xTickIndices = useMemo(() => {
    if (series.length <= 7) return series.map((_, i) => i);
    const step = Math.ceil(series.length / 6);
    const indices: number[] = [];
    for (let i = 0; i < series.length; i += step) indices.push(i);
    if (indices[indices.length - 1] !== series.length - 1) {
      indices.push(series.length - 1);
    }
    return indices;
  }, [series]);

  const periodStats = useMemo(() => {
    if (series.length === 0) return { inflow: 0, consumed: 0, expired: 0, net: 0 };
    let inflow = 0;
    let consumed = 0;
    let expired = 0;
    for (const p of series) {
      inflow += p.inflowRmb;
      consumed += p.consumptionRmb;
      expired += p.expiryLossRmb;
    }
    return {
      inflow,
      consumed,
      expired,
      net: inflow - consumed - expired,
    };
  }, [series]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left 8 cols: Main Dynamic Trend Chart */}
      <section className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              资产估值与消长动态趋势
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              近 {daysRange} 天入账新增 {formatCurrency(periodStats.inflow)} · 核销消耗{' '}
              {formatCurrency(periodStats.consumed)} · 过期损耗 {formatCurrency(periodStats.expired)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric switcher */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'both', label: '双线对比' },
                  { id: 'asset', label: '资产总额' },
                  { id: 'saved', label: '累计省钱' },
                  { id: 'flow', label: '每日消长' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMetricMode(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    metricMode === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Range switcher */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
              {([14, 30, 60] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysRange(d)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    daysRange === d
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Readout Bar */}
        {activePoint && (
          <div className="flex flex-wrap items-center justify-between gap-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">日期</span>
                <span className="font-mono-num font-medium text-slate-900">{activePoint.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-0.5 bg-teal-700 inline-block" aria-hidden="true" />
                <span className="text-slate-500">权益总估值</span>
                <span className="font-mono-num font-semibold text-slate-900">
                  {formatCurrency(activePoint.totalAssetRmb)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-0.5 bg-emerald-600 inline-block" aria-hidden="true" />
                <span className="text-slate-500">累计优惠</span>
                <span className="font-mono-num font-semibold text-emerald-700">
                  {formatCurrency(activePoint.cumulativeSavedRmb)}
                </span>
              </div>
            </div>
            {(activePoint.inflowRmb > 0 || activePoint.consumptionRmb > 0 || activePoint.expiryLossRmb > 0) && (
              <div className="flex items-center gap-3 text-xs font-mono-num">
                {activePoint.inflowRmb > 0 && (
                  <span className="text-teal-700">当日入账 +{formatCurrency(activePoint.inflowRmb)}</span>
                )}
                {activePoint.consumptionRmb > 0 && (
                  <span className="text-slate-700">核销 -{formatCurrency(activePoint.consumptionRmb)}</span>
                )}
                {activePoint.expiryLossRmb > 0 && (
                  <span className="text-red-600">过期 -{formatCurrency(activePoint.expiryLossRmb)}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* SVG Chart Viewport */}
        <div className="relative w-full aspect-[760/260] min-h-[210px]">
          {chartMath && (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-full overflow-visible select-none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="gradAsset" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F766E" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#0F766E" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="gradSaved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16A34A" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#16A34A" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = PAD_T + plotH * (1 - t);
                const val = chartMath.yMin + (chartMath.yMax - chartMath.yMin) * t;
                return (
                  <g key={t}>
                    <line
                      x1={PAD_L}
                      y1={y}
                      x2={W - PAD_R}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray={t === 0 ? undefined : '3 3'}
                      strokeWidth="1"
                    />
                    <text
                      x={PAD_L - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px]"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      ¥{Math.round(val).toLocaleString('zh-CN')}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Labels */}
              {xTickIndices.map((idx) => {
                const p = series[idx];
                const x =
                  chartMath.kind === 'flow'
                    ? PAD_L + idx * chartMath.barStep + chartMath.barStep / 2
                    : PAD_L + (idx / Math.max(1, series.length - 1)) * plotW;
                return (
                  <text
                    key={p.date}
                    x={x}
                    y={H - 8}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {p.label}
                  </text>
                );
              })}

              {/* Flow Bar Chart Mode */}
              {chartMath.kind === 'flow' && (
                <g>
                  {series.map((p, idx) => {
                    const cx = PAD_L + idx * chartMath.barStep + chartMath.barStep / 2;
                    const inH = (p.inflowRmb / Math.max(1, chartMath.yMax)) * plotH;
                    const outH = (p.consumptionRmb / Math.max(1, chartMath.yMax)) * plotH;
                    const expH = (p.expiryLossRmb / Math.max(1, chartMath.yMax)) * plotH;
                    return (
                      <g key={p.date}>
                        {p.inflowRmb > 0 && (
                          <rect
                            x={cx - chartMath.barW - 1}
                            y={PAD_T + plotH - inH}
                            width={chartMath.barW}
                            height={Math.max(2, inH)}
                            rx={1.5}
                            fill="#0F766E"
                          />
                        )}
                        {p.consumptionRmb > 0 && (
                          <rect
                            x={cx + 1}
                            y={PAD_T + plotH - outH}
                            width={chartMath.barW}
                            height={Math.max(2, outH)}
                            rx={1.5}
                            fill="#334155"
                          />
                        )}
                        {p.expiryLossRmb > 0 && (
                          <rect
                            x={cx + 1}
                            y={PAD_T + plotH - outH - expH}
                            width={chartMath.barW}
                            height={Math.max(2, expH)}
                            rx={1.5}
                            fill="#DC2626"
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Area + Line Mode */}
              {chartMath.kind === 'line' && (
                <g>
                  {(metricMode === 'both' || metricMode === 'asset') && (
                    <>
                      <path d={chartMath.assetArea} fill="url(#gradAsset)" />
                      <path
                        d={chartMath.assetPath}
                        fill="none"
                        stroke="#0F766E"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                  {(metricMode === 'both' || metricMode === 'saved') && (
                    <>
                      <path d={chartMath.savedArea} fill="url(#gradSaved)" />
                      <path
                        d={chartMath.savedPath}
                        fill="none"
                        stroke="#16A34A"
                        strokeWidth="2"
                        strokeDasharray={metricMode === 'both' ? '5 3' : undefined}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </g>
              )}

              {/* Hover Crosshair & Active Markers */}
              {hoverIndex !== null && series[hoverIndex] && (
                <g>
                  {(() => {
                    const p = series[hoverIndex];
                    const x =
                      chartMath.kind === 'flow'
                        ? PAD_L + hoverIndex * chartMath.barStep + chartMath.barStep / 2
                        : PAD_L + (hoverIndex / Math.max(1, series.length - 1)) * plotW;
                    return (
                      <>
                        <line
                          x1={x}
                          y1={PAD_T}
                          x2={x}
                          y2={PAD_T + plotH}
                          stroke="#94A3B8"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        {chartMath.kind === 'line' && (
                          <>
                            {(metricMode === 'both' || metricMode === 'asset') && (
                              <circle
                                cx={x}
                                cy={chartMath.getY(p.totalAssetRmb)}
                                r="4"
                                fill="#0F766E"
                                stroke="#FFFFFF"
                                strokeWidth="2"
                              />
                            )}
                            {(metricMode === 'both' || metricMode === 'saved') && (
                              <circle
                                cx={x}
                                cy={chartMath.getY(p.cumulativeSavedRmb)}
                                r="4"
                                fill="#16A34A"
                                stroke="#FFFFFF"
                                strokeWidth="2"
                              />
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
                </g>
              )}

              {/* Invisible Hover Columns */}
              {series.map((p, idx) => {
                const step = plotW / series.length;
                return (
                  <rect
                    key={p.date}
                    x={PAD_L + idx * step}
                    y={PAD_T}
                    width={step}
                    height={plotH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                );
              })}
            </svg>
          )}
        </div>

        {/* Legend Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            {metricMode === 'flow' ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-teal-700 inline-block" />
                  获取入账
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-700 inline-block" />
                  核销消费
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
                  过期损耗
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-teal-700 inline-block" />
                  权益总估值曲线
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
                  累计节省优惠曲线
                </span>
              </>
            )}
          </div>
          <span>周期净消长: {periodStats.net >= 0 ? '+' : ''}{formatCurrency(periodStats.net)}</span>
        </div>
      </section>

      {/* Right 4 cols: Asset Structure & Channel Weight */}
      <section className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-5">
        <div>
          <div className="flex items-baseline justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">资产结构与渠道分布</h2>
            <span className="font-mono-num text-xs text-slate-500">
              合计 {formatCurrency(categoryBreakdown.total)}
            </span>
          </div>

          {/* Segmented Horizontal Proportion Bar */}
          <div className="mt-4 h-2.5 w-full rounded-full overflow-hidden bg-slate-100 flex">
            {categoryBreakdown.items.map((item) => {
              const pct =
                categoryBreakdown.total > 0 ? (item.value / categoryBreakdown.total) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={item.key}
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                  title={`${item.label}: ${formatCurrency(item.value)} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          {/* Category List */}
          <div className="mt-4 space-y-2.5">
            {categoryBreakdown.items.map((item) => {
              const pct =
                categoryBreakdown.total > 0 ? (item.value / categoryBreakdown.total) * 100 : 0;
              return (
                <div key={item.key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.label}</span>
                    <span className="text-slate-400">· {item.count}项</span>
                  </div>
                  <div className="font-mono-num flex items-center gap-2.5">
                    <span className="text-slate-400">{pct.toFixed(1)}%</span>
                    <span className="font-medium text-slate-900 w-20 text-right">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Channels */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">核心渠道资产沉淀排行</h3>
          {channelTop.list.length === 0 ? (
            <div className="py-4 text-xs text-slate-400">录入权益资产后自动生成渠道分布</div>
          ) : (
            <div className="space-y-2.5">
              {channelTop.list.map((ch) => {
                const widthPct = Math.max(4, (ch.value / channelTop.maxVal) * 100);
                return (
                  <div key={ch.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 truncate">{ch.name}</span>
                      <span className="font-mono-num font-medium text-slate-900">
                        {formatCurrency(ch.value)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-700/80 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
