import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MousePointerClick,
  Eye,
  Award,
  RefreshCw,
  RotateCcw,
  Calendar,
  Filter,
  Info,
  Layers,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Target,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Percent,
  Database,
  SlidersHorizontal
} from 'lucide-react';
import { fetchCampaignCandidates, fetchCampaignAnalytics } from '../api/client';

// ==========================================
// Helper to format currency and compact numbers
// ==========================================
function formatCompact(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (abs >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return Number(num).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ==========================================
// Responsive SVG Sparkline Component
// ==========================================
function SvgSparkline({ points = [], color = '#4f46e5', height = 30 }) {
  if (!points || points.length < 2) {
    return <div style={{ width: '80px', height: `${height}px`, background: '#f8fafc', borderRadius: '4px' }} />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const vbWidth = 100;
  const vbHeight = 32;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * vbWidth;
    const y = vbHeight - ((val - min) / range) * (vbHeight - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylineStr = coords.join(' ');
  const areaPath = `M 0,${vbHeight} L ${coords.join(' L ')} L ${vbWidth},${vbHeight} Z`;
  const gradId = `spark-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      viewBox={`0 0 ${vbWidth} ${vbHeight}`}
      preserveAspectRatio="none"
      style={{
        width: '100%',
        maxWidth: '90px',
        height: `${height}px`,
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylineStr}
      />
    </svg>
  );
}

// ==========================================
// Responsive SVG Donut Chart with Slices & Legend
// ==========================================
function SvgDonutChart({ data = [], title = "", tooltipDesc = "Distribution breakdown", iconColor = "#3b82f6" }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Consolidate beyond top 5 items into "Other" to keep donut and legend clean
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (data.length <= 5) return data;
    const top5 = data.slice(0, 4);
    const rest = data.slice(4);
    const otherVal = rest.reduce((sum, d) => sum + (d.value || 0), 0);
    const otherPct = Number(rest.reduce((sum, d) => sum + Number(d.percentage || 0), 0).toFixed(1));
    return [
      ...top5,
      { channel: `Other (${rest.length})`, percentage: otherPct, value: otherVal, color: '#94a3b8' }
    ];
  }, [data]);

  const total = useMemo(() => processedData.reduce((sum, d) => sum + (d.value || 0), 0), [processedData]);

  const size = 136;
  const center = size / 2;
  const radius = 50;
  const strokeWidth = 22;

  let cumulativeAngle = 0;
  const circumference = 2 * Math.PI * radius;

  const slices = processedData.map((d) => {
    const pct = total > 0 ? (d.value / total) : 0;
    const strokeDash = `${(pct * circumference).toFixed(2)} ${(circumference * (1 - pct)).toFixed(2)}`;
    const strokeOffset = (-cumulativeAngle * circumference).toFixed(2);
    cumulativeAngle += pct;
    return { ...d, strokeDash, strokeOffset, rawPct: (pct * 100).toFixed(1) };
  });

  return (
    <div className="campaign-chart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h4 style={{
          fontSize: '0.84rem',
          fontWeight: '700',
          color: '#1e293b',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }} title={title}>
          {title}
        </h4>
        <div title={tooltipDesc} style={{ cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}>
          <Info size={13} />
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        flex: 1
      }}>
        {/* SVG Circle Canvas */}
        <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />
            {slices.map((slice, idx) => (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={hoveredIdx === idx ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDash}
                strokeDashoffset={slice.strokeOffset}
                style={{
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))}
          </svg>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0f172a' }}>
              {hoveredIdx !== null ? `${slices[hoveredIdx]?.rawPct}%` : '100%'}
            </span>
          </div>
        </div>

        {/* Legend with percentages */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          minWidth: '100px',
          maxWidth: '160px',
          maxHeight: '130px',
          overflowY: 'auto',
          flex: 1
        }}>
          {processedData.map((item, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                fontSize: '0.74rem',
                cursor: 'pointer',
                opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.45,
                transition: 'opacity 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span
                  style={{
                    color: '#475569',
                    fontWeight: '600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '85px'
                  }}
                  title={item.channel}
                >
                  {item.channel}
                </span>
              </div>
              <span style={{ color: '#0f172a', fontWeight: '800', flexShrink: 0 }}>
                {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Responsive Horizontal Grouped Bar Chart
// ==========================================
function SvgHorizontalBarChart({ data = [], title = "", metricLabel = "Volume", subLabel = "Share %" }) {
  const [showAll, setShowAll] = useState(false);
  const maxClicks = useMemo(() => Math.max(...data.map(d => d.clicks || 1), 1), [data]);

  const displayData = useMemo(() => {
    if (showAll || data.length <= 5) return data;
    return data.slice(0, 5);
  }, [data, showAll]);

  return (
    <div className="campaign-chart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h4 style={{
          fontSize: '0.84rem',
          fontWeight: '700',
          color: '#1e293b',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }} title={title}>
          {title}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', fontWeight: '600' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#0369a1' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#0284c7' }} />
              {subLabel}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#0284c7' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#38bdf8' }} />
              {metricLabel}
            </span>
          </div>
          {data.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.68rem',
                fontWeight: '700',
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              {showAll ? 'Top 5' : `+${data.length - 5}`}
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        flex: 1,
        justifyContent: 'center',
        maxHeight: '230px',
        overflowY: 'auto'
      }}>
        {displayData.map((item, idx) => {
          const barWidthPct = Math.min(100, Math.max(8, (item.clicks / maxClicks) * 90));
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span
                  style={{
                    fontWeight: '700',
                    color: '#334155',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '120px'
                  }}
                  title={item.channel}
                >
                  {item.channel}
                </span>
                <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                  <span style={{ fontWeight: '800', color: '#0369a1' }}>{item.ctr_pct}%</span>
                  <span style={{ fontWeight: '600', color: '#64748b' }}>{item.clicks_formatted}</span>
                </div>
              </div>
              <div style={{
                width: '100%',
                height: '14px',
                background: '#f1f5f9',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${barWidthPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// Responsive Area Trend Chart: Over Time
// ==========================================
function SvgAreaTrendChart({ data = [], title = "", metricLabel = "Volume" }) {
  const [activeSeason, setActiveSeason] = useState('All');
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const filteredData = useMemo(() => {
    if (activeSeason === 'All') return data;
    return data.filter(d => d.season === activeSeason);
  }, [data, activeSeason]);

  const height = 140;
  const width = 540;
  const paddingX = 36;
  const paddingY = 22;

  const imprValues = filteredData.map(d => d.impressions || 0);
  const minImpr = imprValues.length > 0 ? Math.min(...imprValues) * 0.9 : 30000;
  const maxImpr = imprValues.length > 0 ? Math.max(...imprValues) * 1.1 : 70000;
  const range = maxImpr - minImpr || 1;

  const points = filteredData.map((d, idx) => {
    const x = paddingX + (idx / Math.max(1, filteredData.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((d.impressions - minImpr) / range) * (height - 2 * paddingY);
    return { ...d, x, y };
  });

  const polylineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = points.length > 0
    ? `M ${points[0].x},${height - paddingY} L ${polylineStr} L ${points[points.length - 1].x},${height - paddingY} Z`
    : '';

  const labelStep = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="campaign-chart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
        <h4 style={{ fontSize: '0.84rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          {title}
        </h4>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['All', 'Spring', 'Summer', 'Fall'].map(s => (
            <button
              key={s}
              onClick={() => setActiveSeason(s)}
              style={{
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '0.7rem',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: activeSeason === s ? '#10b981' : '#f1f5f9',
                color: activeSeason === s ? '#ffffff' : '#64748b',
                transition: 'all 0.15s'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="areaTrendGradV2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e2e8f0" />

          {/* Area Fill & Curve */}
          {areaPath && <path d={areaPath} fill="url(#areaTrendGradV2)" />}
          {polylineStr && (
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylineStr}
            />
          )}

          {/* Data Points */}
          {points.map((p, idx) => {
            const showLabel = idx % labelStep === 0 || idx === points.length - 1;
            return (
              <g key={idx} onMouseEnter={() => setHoveredPoint(p)} onMouseLeave={() => setHoveredPoint(null)}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredPoint?.month === p.month ? 5 : 3}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth="2"
                  style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                />
                {showLabel && (
                  <text
                    x={p.x}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill="#64748b"
                    fontWeight="600"
                  >
                    {p.month}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hoveredPoint && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(15, 23, 42, 0.92)',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: '700',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            {hoveredPoint.month}: {formatCompact(hoveredPoint.impressions)} {metricLabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Responsive Dual-Axis Chart: Day of Week
// ==========================================
function SvgDualAxisChart({ data = [], title = "", primaryLabel = "Volume", secondaryLabel = "Share %" }) {
  const height = 145;
  const width = 540;
  const paddingX = 36;
  const paddingY = 22;

  const imprVals = data.map(d => d.impressions || 1);
  const ctrVals = data.map(d => d.ctr_pct || 1);

  const minImpr = Math.min(...imprVals) * 0.98;
  const maxImpr = Math.max(...imprVals) * 1.02;
  const rangeImpr = maxImpr - minImpr || 1;

  const minCtr = Math.min(...ctrVals) * 0.98;
  const maxCtr = Math.max(...ctrVals) * 1.02;
  const rangeCtr = maxCtr - minCtr || 1;

  const pointsImpr = data.map((d, idx) => {
    const x = paddingX + (idx / Math.max(1, data.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((d.impressions - minImpr) / rangeImpr) * (height - 2 * paddingY);
    return { ...d, x, y };
  });

  const pointsCtr = data.map((d, idx) => {
    const x = paddingX + (idx / Math.max(1, data.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((d.ctr_pct - minCtr) / rangeCtr) * (height - 2 * paddingY);
    return { ...d, x, y };
  });

  const lineImprStr = pointsImpr.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const lineCtrStr = pointsCtr.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="campaign-chart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h4 style={{ fontSize: '0.84rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          {title}
        </h4>
        <div style={{ display: 'flex', gap: '10px', fontSize: '0.72rem', fontWeight: '700' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
            {primaryLabel}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0369a1' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0284c7' }} />
            {secondaryLabel}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e2e8f0" />
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#f1f5f9" strokeDasharray="3 3" />

          {/* Line 1: Primary Volume (Green) */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={lineImprStr}
          />

          {/* Line 2: Rate / Secondary (Cyan / Blue) */}
          <polyline
            fill="none"
            stroke="#0284c7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={lineCtrStr}
          />

          {/* Markers & Labels */}
          {pointsCtr.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="3" fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
              <text
                x={p.x}
                y={p.y - 6}
                textAnchor="middle"
                fontSize="8.5"
                fill="#0f172a"
                fontWeight="800"
              >
                {p.ctr_pct}%
              </text>
              <text
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                fontSize="8.5"
                fill="#64748b"
                fontWeight="600"
              >
                {p.day ? p.day.slice(0, 3) : ''}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ==========================================
// Main Dynamic Campaign / Analytics Studio View
// ==========================================
export default function CampaignStudio({ tables = [] }) {
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'impressions' | 'cost_revenue'
  const [selectedTable, setSelectedTable] = useState('benchmark_demo');
  const [hasUserSelected, setHasUserSelected] = useState(false);
  const [channelFilter, setChannelFilter] = useState('All');
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [colMapping, setColMapping] = useState({
    channel_col: '',
    campaign_col: '',
    date_col: '',
    impressions_col: '',
    clicks_col: '',
    cost_col: '',
    conversions_col: '',
    profit_col: '',
    status_col: ''
  });

  const [analytics, setAnalytics] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load candidate tables from warehouse
  useEffect(() => {
    const loadCandidates = async () => {
      try {
        const res = await fetchCampaignCandidates();
        if (res?.warehouse_candidates) {
          setCandidates(res.warehouse_candidates);
          // If user hasn't explicitly selected a table, auto-select first warehouse table!
          if (!hasUserSelected && res.warehouse_candidates.length > 0) {
            const firstTable = res.warehouse_candidates[0].table_name;
            setSelectedTable(firstTable);
          }
        }
      } catch (err) {
        console.warn('Candidate fetch error:', err);
      }
    };
    loadCandidates();
  }, [tables.length]);

  // Merge candidate metadata with tables
  const displayTables = useMemo(() => {
    const map = new Map();
    candidates.forEach(c => map.set(c.table_name, c));
    tables.forEach(t => {
      if (!map.has(t.table_name)) {
        map.set(t.table_name, {
          table_name: t.table_name,
          row_count: t.row_count || 0,
          is_campaign_ready: false,
          domain_type: 'general',
          domain_title: 'Custom Table',
          available_columns: [],
          columns: {}
        });
      }
    });
    return Array.from(map.values());
  }, [candidates, tables]);

  const activeTableMeta = useMemo(() => {
    return displayTables.find(c => c.table_name === selectedTable);
  }, [displayTables, selectedTable]);

  // Load analytics when selection or filters change
  const loadAnalytics = async (customMap = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeMap = customMap || (selectedTable !== 'benchmark_demo' ? colMapping : null);
      const payload = {
        table_name: selectedTable,
        channel: channelFilter,
        campaign: campaignFilter,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        col_mapping: activeMap && Object.values(activeMap).some(Boolean) ? activeMap : undefined
      };
      const data = await fetchCampaignAnalytics(payload);
      setAnalytics(data);

      if (selectedTable !== 'benchmark_demo' && data?.filters?.min_date && data?.filters?.max_date) {
        if (!startDate) {
          setStartDate(data.filters.min_date);
        }
        if (!endDate) {
          setEndDate(data.filters.max_date);
        }
      } else if (selectedTable === 'benchmark_demo') {
        if (!startDate) setStartDate('2023-03-01');
        if (!endDate) setEndDate('2023-11-30');
      }

      if (data?.active_mapping && selectedTable !== 'benchmark_demo') {
        setColMapping(prev => ({
          channel_col: data.active_mapping.channel_col || prev.channel_col || '',
          campaign_col: data.active_mapping.campaign_col || prev.campaign_col || '',
          date_col: data.active_mapping.date_col || prev.date_col || '',
          impressions_col: data.active_mapping.impressions_col || prev.impressions_col || '',
          clicks_col: data.active_mapping.clicks_col || prev.clicks_col || '',
          cost_col: data.active_mapping.cost_col || prev.cost_col || '',
          conversions_col: data.active_mapping.conversions_col || prev.conversions_col || '',
          profit_col: data.active_mapping.profit_col || prev.profit_col || '',
          status_col: data.active_mapping.status_col || prev.status_col || ''
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate studio analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedTable, channelFilter, campaignFilter, startDate, endDate]);

  const handleTableChange = (newTableName) => {
    setSelectedTable(newTableName);
    setHasUserSelected(true);
    setError(null);
    setChannelFilter('All');
    setCampaignFilter('All');

    if (newTableName === 'benchmark_demo') {
      setStartDate('2023-03-01');
      setEndDate('2023-11-30');
      setIsMappingOpen(false);
    } else {
      const meta = displayTables.find(c => c.table_name === newTableName);
      const cols = meta?.columns || {};
      const newMap = {
        channel_col: cols.channel_col || '',
        campaign_col: cols.campaign_col || '',
        date_col: cols.date_col || '',
        impressions_col: cols.impressions_col || '',
        clicks_col: cols.clicks_col || '',
        cost_col: cols.cost_col || '',
        conversions_col: cols.conversions_col || '',
        profit_col: cols.profit_col || '',
        status_col: cols.status_col || ''
      };
      setColMapping(newMap);
      setStartDate('');
      setEndDate('');
    }
  };

  const handleApplyMapping = () => {
    loadAnalytics(colMapping);
  };

  const handleResetFilters = () => {
    setChannelFilter('All');
    setCampaignFilter('All');
    if (selectedTable === 'benchmark_demo') {
      setStartDate('2023-03-01');
      setEndDate('2023-11-30');
    } else if (analytics?.filters?.min_date && analytics?.filters?.max_date) {
      setStartDate(analytics.filters.min_date);
      setEndDate(analytics.filters.max_date);
    }
  };

  const domainMeta = analytics?.domain_meta || {
    id: 'marketing',
    title: 'Marketing Campaign Analysis',
    subtitle: 'Multi-Channel Attribution • Funnel Analytics & ROI Studio',
    dim_name: 'Channel / Platform',
    sub_dim_name: 'Campaign / Creative',
    date_name: 'Campaign Date',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'impressions', label: 'Impressions & CTR' },
      { id: 'cost_revenue', label: 'Ads Cost & Revenue' }
    ],
    chart_labels: {
      donut_dim: 'Impressions by Channel',
      donut_cost: 'Ads Spending Share',
      donut_profit: 'Profit Share by Channel',
      donut_conv: 'Conversions by Channel',
      bar_ranking: 'Clicks & CTR by Channel',
      timeline: 'Impressions Trend Over Time',
      day_of_week: 'Impressions & CTR by Day of Week',
      table_attribution: 'Channel Engagement & Traffic Attribution Matrix',
      table_financial: 'Unit Economics & Financial Efficiency Matrix',
    }
  };

  const kpis = analytics?.kpis;
  const donuts = analytics?.donuts;
  const barClicksCtr = analytics?.bar_clicks_ctr || [];
  const trendOverTime = analytics?.trend_over_time || [];
  const dayOfWeek = analytics?.day_of_week || [];

  const colOptions = activeTableMeta?.available_columns || (analytics?.filters ? Object.keys(analytics?.filters) : []);

  const topChannelByCtr = useMemo(() => {
    if (!barClicksCtr || barClicksCtr.length === 0) return null;
    return [...barClicksCtr].sort((a, b) => (b.ctr_pct || 0) - (a.ctr_pct || 0))[0];
  }, [barClicksCtr]);

  const totalCostNum = kpis?.cost?.value || 0;
  const totalProfitNum = kpis?.profit?.value || 0;
  const blendedRoas = totalCostNum > 0 ? ((totalProfitNum + totalCostNum) / totalCostNum).toFixed(1) + 'x' : '10.6x';

  const studioTitle = selectedTable === 'benchmark_demo'
    ? 'Marketing Campaign Analysis'
    : (domainMeta.title || 'Dynamic Analytics Studio');

  const studioSubtitle = selectedTable === 'benchmark_demo'
    ? 'Multi-Channel Attribution • Funnel Analytics & ROI Studio'
    : (domainMeta.subtitle || 'Executive Domain Intelligence & Performance Studio');

  const navTabs = domainMeta.tabs || [
    { id: 'overview', label: 'Overview' },
    { id: 'impressions', label: 'Volume & Deep Dive' },
    { id: 'cost_revenue', label: 'Financials & Outcomes' }
  ];

  return (
    <div className="campaign-studio-container" id="campaign-studio-root">
      {/* ======================================================== */}
      {/* 1. Header & Dynamic Domain Navigation                    */}
      {/* ======================================================== */}
      <div className="campaign-header-bar">
        {/* Title & Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: selectedTable === 'benchmark_demo' 
              ? 'linear-gradient(135deg, #e11d48, #f43f5e)' 
              : 'linear-gradient(135deg, #4f46e5, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.28)',
            flexShrink: 0
          }}>
            {selectedTable === 'benchmark_demo' ? <Megaphone size={19} /> : <Activity size={19} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                {studioTitle}
              </h1>
              <span title={`Domain: ${domainMeta.id || 'Custom Data'}`} style={{ cursor: 'pointer', color: '#94a3b8' }}>
                <Info size={15} />
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>
              {studioSubtitle}
            </span>
          </div>
        </div>

        {/* Dynamic Tab Segment Controls */}
        <div className="campaign-tabs-nav">
          {navTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`campaign-tab-btn ${activeSubTab === tab.id ? 'active' : ''}`}
              id={`tab-btn-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {/* Data Source Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#475569' }}>
            <span style={{ fontWeight: '700' }}>Source:</span>
            <select
              value={selectedTable}
              onChange={(e) => handleTableChange(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.75rem',
                background: '#ffffff',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '240px'
              }}
              id="campaign-source-select"
            >
              {displayTables.length > 0 && (
                <optgroup label="Warehouse Tables (Your Data)">
                  {displayTables.map(c => (
                    <option key={c.table_name} value={c.table_name}>
                      📁 {c.table_name} ({c.row_count ? c.row_count.toLocaleString() : '—'} rows) • {c.domain_title || 'Table'}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Sample Demonstrations">
                <option value="benchmark_demo">🌟 Marketing Benchmark Demo (Preset)</option>
              </optgroup>
            </select>
          </div>

          {/* Column Mapping Toggle Button */}
          {selectedTable !== 'benchmark_demo' && (
            <button
              onClick={() => setIsMappingOpen(prev => !prev)}
              style={{
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: '700',
                border: isMappingOpen ? '1px solid #818cf8' : '1px solid #cbd5e1',
                background: isMappingOpen ? '#e0e7ff' : '#f8fafc',
                color: isMappingOpen ? '#4338ca' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Customize Columns & Metrics"
              id="campaign-toggle-mapping-btn"
            >
              <SlidersHorizontal size={13} />
              <span>{isMappingOpen ? 'Close Mapper' : 'Customize Columns ⚙️'}</span>
            </button>
          )}

          {/* Date Range Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: '#475569' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '4px 6px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.72rem',
                outline: 'none',
                maxWidth: '120px'
              }}
            />
            <span>-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '4px 6px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.72rem',
                outline: 'none',
                maxWidth: '120px'
              }}
            />
          </div>

          {/* Dimension Dropdown Filter */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
              background: '#ffffff',
              fontWeight: '600',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '130px'
            }}
            id="campaign-channel-filter"
          >
            {analytics?.filters?.channels?.map(ch => (
              <option key={ch} value={ch}>{ch}</option>
            )) || <option value="All">All</option>}
          </select>

          {/* Reset Button */}
          <button
            onClick={handleResetFilters}
            className="btn btn-secondary"
            style={{
              padding: '5px 10px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '8px'
            }}
            id="campaign-reset-filters-btn"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Active Table Status & Domain Banner                      */}
      {/* ======================================================== */}
      {selectedTable !== 'benchmark_demo' && (
        <div style={{
          background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '8px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          fontSize: '0.76rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981'
            }} />
            <span style={{ fontWeight: '700', color: '#0f172a' }}>Active Table:</span>
            <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: '800', color: '#1e293b' }}>
              {selectedTable}
            </code>
            {activeTableMeta?.row_count ? (
              <span style={{ color: '#64748b' }}>({activeTableMeta.row_count.toLocaleString()} rows)</span>
            ) : null}
            <span style={{
              background: '#e0e7ff',
              color: '#4338ca',
              padding: '1px 7px',
              borderRadius: '9999px',
              fontSize: '0.71rem',
              fontWeight: '700'
            }}>
              {domainMeta.title}
            </span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ color: '#475569' }}>
              Group By: <strong style={{ color: '#4f46e5' }}>{colMapping.channel_col || 'auto'}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ color: '#475569' }}>
              Primary Metric: <strong style={{ color: '#0284c7' }}>{colMapping.impressions_col || 'auto'}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsMappingOpen(prev => !prev)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '3px 9px',
                borderRadius: '6px',
                color: '#4f46e5',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.74rem'
              }}
            >
              {isMappingOpen ? 'Hide Column Mapper' : 'Change Columns ⚙️'}
            </button>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <button
              onClick={() => handleTableChange('benchmark_demo')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.74rem'
              }}
            >
              Demo Benchmark
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Expandable Column Mapping Configuration                  */}
      {/* ======================================================== */}
      {isMappingOpen && selectedTable !== 'benchmark_demo' && (
        <div className="campaign-chart-card" style={{ border: '1px solid #c7d2fe', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={16} color="#4f46e5" />
              <span style={{ fontSize: '0.86rem', fontWeight: '800', color: '#1e293b' }}>
                Column Mapping Configuration for "{selectedTable}"
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                background: '#e0e7ff',
                color: '#4338ca',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: '700'
              }}>
                Domain: {domainMeta.title}
              </span>
            </div>
          </div>
          <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0 0 12px 0' }}>
            Select how your dataset columns map to dashboard dimensions and metrics. The entire interface, charts, and KPI cards adapt automatically.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            {[
              { 
                key: 'channel_col', 
                label: `Category / Dimension (${domainMeta.dim_name || 'Group By'})`,
                desc: 'Main category for donut distributions and filters'
              },
              { 
                key: 'campaign_col', 
                label: `Sub-Entity (${domainMeta.sub_dim_name || 'Item Name'})`,
                desc: 'Secondary entity for bar chart ranking'
              },
              { 
                key: 'date_col', 
                label: `Date / Timestamp (${domainMeta.date_name || 'Date'})`,
                desc: 'For monthly trends and day of week dynamics'
              },
              { 
                key: 'impressions_col', 
                label: `Primary Metric (${kpis?.impressions?.title || 'Volume'})`,
                desc: 'Main quantitative or volume metric'
              },
              { 
                key: 'clicks_col', 
                label: `Secondary Metric (${kpis?.clicks?.title || 'Output'})`,
                desc: 'Secondary quantitative metric / throughput'
              },
              { 
                key: 'cost_col', 
                label: `Tertiary / Cost Metric (${kpis?.cost?.title || 'Cost/Units'})`,
                desc: 'Cost, pages, or unit price metric'
              },
              { 
                key: 'status_col', 
                label: `Status / Outcome Column (${kpis?.profit?.title || 'Status'})`,
                desc: 'For calculating success and completion rates'
              },
              { 
                key: 'profit_col', 
                label: 'Profit / Margin / Value Metric',
                desc: 'Gross margin, net profit, or outcome value'
              }
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '0.71rem', fontWeight: '700', color: '#334155' }} title={f.desc}>
                  {f.label}
                </label>
                <select
                  value={colMapping[f.key] || ''}
                  onChange={(e) => setColMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.74rem',
                    background: '#f8fafc',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                >
                  <option value="">(Auto-detect)</option>
                  {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>{f.desc}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
            <button
              onClick={() => handleTableChange(selectedTable)}
              className="btn btn-secondary"
              style={{ padding: '5px 12px', fontSize: '0.74rem', borderRadius: '6px' }}
            >
              Reset to Recommended
            </button>
            <button
              onClick={handleApplyMapping}
              style={{
                padding: '5px 18px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
              }}
              id="apply-campaign-mappings-btn"
            >
              <Sparkles size={13} />
              <span>Apply Mappings</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Error Alert Display                                      */}
      {/* ======================================================== */}
      {error && (
        <div style={{
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          borderRadius: '12px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          color: '#be123c',
          fontSize: '0.8rem'
        }}>
          <div>
            <strong>Notice:</strong> {error}
          </div>
          <button
            onClick={() => handleTableChange('benchmark_demo')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: '#e11d48',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.72rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Load Benchmark Demo
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SUB-TAB VIEW 1: OVERVIEW                              */}
      {/* ======================================================== */}
      {activeSubTab === 'overview' && (
        <div className="campaign-main-layout" id="view-overview-content">
          {/* Left Column: 5 Dynamic Responsive KPI Cards */}
          <div className="campaign-kpi-column">
            {/* KPI 1: Primary Volume */}
            <div className="campaign-kpi-card">
              <div style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.impressions?.title || 'Total Volume'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{
                  fontSize: 'clamp(1.3rem, 2.2vw, 1.65rem)',
                  fontWeight: '800',
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={kpis?.impressions?.formatted || '0'}>
                  {kpis?.impressions?.formatted || '0'}
                </div>
                <SvgSparkline points={kpis?.impressions?.sparkline} color="#0284c7" />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.71rem',
                color: (kpis?.impressions?.compare_pct || 0) >= 0 ? '#10b981' : '#e11d48',
                fontWeight: '700'
              }}>
                <span>{kpis?.impressions?.subtitle || 'Compare to last period:'}</span>
                <span>{(kpis?.impressions?.compare_pct || 0) >= 0 ? '+' : ''}{kpis?.impressions?.compare_pct || 0}%</span>
              </div>
            </div>

            {/* KPI 2: Primary Value / Throughput */}
            <div className="campaign-kpi-card">
              <div style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.clicks?.title || 'Primary Metric'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{
                  fontSize: 'clamp(1.3rem, 2.2vw, 1.65rem)',
                  fontWeight: '800',
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={kpis?.clicks?.formatted || '0'}>
                  {kpis?.clicks?.formatted || '0'}
                </div>
                <SvgSparkline points={kpis?.clicks?.sparkline} color="#4f46e5" />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.71rem',
                color: '#475569',
                fontWeight: '700'
              }}>
                <span>{kpis?.clicks?.subtitle || 'Metric Rate:'}</span>
                {kpis?.clicks?.ctr_pct ? (
                  <span style={{ color: '#0284c7', fontWeight: '800' }}>{kpis.clicks.ctr_pct}%</span>
                ) : null}
              </div>
            </div>

            {/* KPI 3: Secondary Output / Conversions */}
            <div className="campaign-kpi-card">
              <div style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.conversions?.title || 'Secondary Metric'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{
                  fontSize: 'clamp(1.3rem, 2.2vw, 1.65rem)',
                  fontWeight: '800',
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={kpis?.conversions?.formatted || '0'}>
                  {kpis?.conversions?.formatted || '0'}
                </div>
                <SvgSparkline points={kpis?.conversions?.sparkline} color="#10b981" />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.71rem',
                color: (kpis?.conversions?.compare_pct || 0) >= 0 ? '#10b981' : '#e11d48',
                fontWeight: '700'
              }}>
                <span>{kpis?.conversions?.subtitle || 'Compare to last period:'}</span>
                <span>{(kpis?.conversions?.compare_pct || 0) >= 0 ? '+' : ''}{kpis?.conversions?.compare_pct || 0}%</span>
              </div>
            </div>

            {/* KPI 4: Tertiary / Cost / Pages */}
            <div className="campaign-kpi-card">
              <div style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.cost?.title || 'Cost / Tertiary'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{
                  fontSize: 'clamp(1.3rem, 2.2vw, 1.65rem)',
                  fontWeight: '800',
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={kpis?.cost?.formatted || '0'}>
                  {kpis?.cost?.formatted || '0'}
                </div>
                <SvgSparkline points={kpis?.cost?.sparkline} color="#d97706" />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.71rem',
                color: '#475569',
                fontWeight: '700'
              }}>
                <span>{kpis?.cost?.cost_per_conv || kpis?.cost?.subtitle || 'Unit Metric'}</span>
              </div>
            </div>

            {/* KPI 5: Outcome / Status / Profit */}
            <div className="campaign-kpi-card">
              <div style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.profit?.title || 'Status / Outcome'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{
                  fontSize: 'clamp(1.3rem, 2.2vw, 1.65rem)',
                  fontWeight: '800',
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={kpis?.profit?.formatted || '0'}>
                  {kpis?.profit?.formatted || '0'}
                </div>
                <SvgSparkline points={kpis?.profit?.sparkline} color="#059669" />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.71rem',
                color: '#475569',
                fontWeight: '700'
              }}>
                <span style={{ color: '#059669', fontWeight: '800' }}>
                  {kpis?.profit?.profit_per_conv || kpis?.profit?.subtitle || 'Outcome Metric'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Section: Multi-Chart Dynamic Visualization Matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Row: 3 Visualizations */}
            <div className="campaign-grid-3col">
              <SvgDonutChart
                title={domainMeta.chart_labels?.donut_dim || "Distribution by Dimension"}
                data={donuts?.impressions_by_channel || []}
              />
              <SvgHorizontalBarChart
                title={domainMeta.chart_labels?.bar_ranking || "Top Ranking by Category"}
                data={barClicksCtr}
                metricLabel={kpis?.conversions?.title || "Output"}
                subLabel="Share %"
              />
              <SvgDonutChart
                title={domainMeta.chart_labels?.donut_conv || "Secondary Distribution"}
                data={donuts?.conversions_by_channel || []}
              />
            </div>

            {/* Middle Row: Area Chart + Cost / Resource Donut */}
            <div className="campaign-grid-split">
              <SvgAreaTrendChart
                title={domainMeta.chart_labels?.timeline || "Trajectory Over Time"}
                data={trendOverTime}
                metricLabel={kpis?.impressions?.title || "Volume"}
              />
              <SvgDonutChart
                title={domainMeta.chart_labels?.donut_cost || "Unit & Resource Share"}
                data={donuts?.spending_by_channel || []}
              />
            </div>

            {/* Bottom Row: Dual-Axis Line Chart + Status / Outcome Donut */}
            <div className="campaign-grid-split">
              <SvgDualAxisChart
                title={domainMeta.chart_labels?.day_of_week || "Day of Week Dynamics"}
                data={dayOfWeek}
                primaryLabel={kpis?.impressions?.title || "Volume"}
                secondaryLabel="Activity %"
              />
              <SvgDonutChart
                title={domainMeta.chart_labels?.donut_profit || "Status & Outcome Share"}
                data={donuts?.profit_by_channel || []}
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. SUB-TAB VIEW 2: VOLUME & THROUGHPUT DEEP DIVE         */}
      {/* ======================================================== */}
      {activeSubTab === 'impressions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} id="view-impressions-content">
          {/* Top 4 Engagement KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px'
          }}>
            <div className="campaign-kpi-card">
              <span style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.impressions?.title || 'Total Volume'}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>
                {kpis?.impressions?.formatted || '0'}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: '700' }}>
                {kpis?.impressions?.subtitle || 'Aggregate Volume'}
              </span>
            </div>

            <div className="campaign-kpi-card">
              <span style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.clicks?.title || 'Primary Metric'}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#4f46e5' }}>
                {kpis?.clicks?.formatted || '0'}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: '700' }}>
                {kpis?.clicks?.subtitle || 'Throughput Volume'}
              </span>
            </div>

            <div className="campaign-kpi-card">
              <span style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.conversions?.title || 'Secondary Metric'}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#10b981' }}>
                {kpis?.conversions?.formatted || '0'}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700' }}>
                {kpis?.conversions?.subtitle || 'Output Metric'}
              </span>
            </div>

            <div className="campaign-kpi-card">
              <span style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                Highest Share Entity
              </span>
              <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#f97316', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {topChannelByCtr ? topChannelByCtr.channel : '—'}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>
                Volume Share: {topChannelByCtr ? `${topChannelByCtr.ctr_pct}%` : '0%'}
              </span>
            </div>
          </div>

          {/* Two-Column Chart Layout */}
          <div className="campaign-grid-split">
            <SvgAreaTrendChart
              title={domainMeta.chart_labels?.timeline || "Trajectory Over Time"}
              data={trendOverTime}
              metricLabel={kpis?.impressions?.title || "Volume"}
            />
            <SvgDonutChart
              title={domainMeta.chart_labels?.donut_dim || "Category Distribution"}
              data={donuts?.impressions_by_channel || []}
            />
          </div>

          <div className="campaign-grid-split">
            <SvgDualAxisChart
              title={domainMeta.chart_labels?.day_of_week || "Day of Week Dynamics"}
              data={dayOfWeek}
              primaryLabel={kpis?.impressions?.title || "Volume"}
              secondaryLabel="Share %"
            />
            <SvgHorizontalBarChart
              title={domainMeta.chart_labels?.bar_ranking || "Top Ranking by Category"}
              data={barClicksCtr}
              metricLabel={kpis?.conversions?.title || "Output"}
              subLabel="Share %"
            />
          </div>

          {/* Detailed Attribution Table */}
          <div className="campaign-chart-card">
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>
              {domainMeta.chart_labels?.table_attribution || "Category & Entity Volume Matrix"}
            </h4>
            <div className="campaign-table-container">
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th>{domainMeta.dim_name || "Category / Entity"}</th>
                    <th>{kpis?.conversions?.title || "Volume / Output"}</th>
                    <th>Share %</th>
                    <th>Volume Share</th>
                    <th>Status Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {barClicksCtr.map((item, idx) => {
                    const rating = item.ctr_pct >= 20 ? '🔥 High Volume' : item.ctr_pct >= 5 ? '⭐ Active' : '⚡ Moderate';
                    const ratingColor = item.ctr_pct >= 20 ? '#10b981' : item.ctr_pct >= 5 ? '#0284c7' : '#f59e0b';
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color || '#3b82f6' }} />
                          {item.channel}
                        </td>
                        <td>{item.clicks_formatted}</td>
                        <td style={{ fontWeight: '800', color: '#0f172a' }}>{item.ctr_pct}%</td>
                        <td>{item.clicks ? `${Math.round((item.clicks / (kpis?.conversions?.value || kpis?.clicks?.value || 1)) * 100)}%` : '—'}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            background: `${ratingColor}15`,
                            color: ratingColor
                          }}>
                            {rating}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. SUB-TAB VIEW 3: FINANCIALS & UNIT ECONOMICS           */}
      {/* ======================================================== */}
      {activeSubTab === 'cost_revenue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} id="view-cost-revenue-content">
          {/* Top 4 Performance & Financial KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px'
          }}>
            <div className="campaign-kpi-card">
              <span style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.cost?.title || 'Cost / Resource'}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#d97706' }}>
                {kpis?.cost?.formatted || '0'}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: '700' }}>
                {kpis?.cost?.cost_per_conv || kpis?.cost?.subtitle || 'Resource Metric'}
              </span>
            </div>

            <div className="campaign-kpi-card">
              <span style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.profit?.title || 'Outcome / Status'}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#059669' }}>
                {kpis?.profit?.formatted || '0'}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '700' }}>
                {kpis?.profit?.profit_per_conv || kpis?.profit?.subtitle || 'Outcome Metric'}
              </span>
            </div>

            <div className="campaign-kpi-card">
              <span style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {selectedTable === 'benchmark_demo' ? 'Blended ROAS Multiplier' : 'Efficiency Multiplier'}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#4f46e5' }}>
                {selectedTable === 'benchmark_demo' ? blendedRoas : '1.0x'}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: '700' }}>
                {selectedTable === 'benchmark_demo' ? 'Return On Ad Spend' : 'Operational Efficiency'}
              </span>
            </div>

            <div className="campaign-kpi-card">
              <span style={{ fontSize: '0.73rem', fontWeight: '700', color: '#64748b' }}>
                {kpis?.conversions?.title || 'Secondary Units'}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0284c7' }}>
                {kpis?.conversions?.formatted || '0'}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700' }}>
                {kpis?.conversions?.compare_pct >= 0 ? '+' : ''}{kpis?.conversions?.compare_pct || 0}% vs Prior Period
              </span>
            </div>
          </div>

          {/* Two-Column Financial Chart Layout */}
          <div className="campaign-grid-split">
            <SvgDonutChart
              title={domainMeta.chart_labels?.donut_cost || "Resource / Cost Allocation"}
              data={donuts?.spending_by_channel || []}
              tooltipDesc="Total resource distribution"
            />
            <SvgDonutChart
              title={domainMeta.chart_labels?.donut_profit || "Outcome / Status Share"}
              data={donuts?.profit_by_channel || []}
              tooltipDesc="Net outcomes and status share"
            />
          </div>

          {/* Performance & Financial Matrix Table */}
          <div className="campaign-chart-card">
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>
              {domainMeta.chart_labels?.table_financial || "Resource Efficiency & Matrix"}
            </h4>
            <div className="campaign-table-container">
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th>{domainMeta.dim_name || "Category / Entity"}</th>
                    <th>Resource Share</th>
                    <th>Outcome Share</th>
                    <th>Primary Value</th>
                    <th>Secondary Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(donuts?.spending_by_channel || []).map((spendItem, idx) => {
                    const profitItem = (donuts?.profit_by_channel || []).find(p => p.channel === spendItem.channel) || {};
                    const spendShare = spendItem.percentage || 0;
                    const profitShare = profitItem.percentage || 0;
                    const isHighlyProfitable = profitShare >= spendShare;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: spendItem.color || '#3b82f6' }} />
                          {spendItem.channel}
                        </td>
                        <td>{spendItem.percentage}%</td>
                        <td style={{ fontWeight: '800', color: '#059669' }}>{profitItem.percentage || '—'}%</td>
                        <td>{formatCompact(spendItem.value)}</td>
                        <td>{formatCompact(profitItem.value)}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            background: isHighlyProfitable ? '#dcfce7' : '#fef3c7',
                            color: isHighlyProfitable ? '#15803d' : '#b45309'
                          }}>
                            {isHighlyProfitable ? '🚀 High Yield' : '⚡ Active'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
