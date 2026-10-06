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
  Target
} from 'lucide-react';
import { fetchCampaignCandidates, fetchCampaignAnalytics } from '../api/client';

// Helper to format currency and compact numbers
function formatCompact(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (abs >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return Number(num).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ==========================================
// SVG Sparkline Component
// ==========================================
function SvgSparkline({ points = [], color = '#4f46e5', height = 34 }) {
  if (!points || points.length < 2) {
    return <div style={{ height: `${height}px`, background: '#f1f5f9', borderRadius: '4px' }} />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 140;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylineStr = coords.join(' ');
  const areaPath = `M 0,${height} L ${coords.join(' L ')} L ${width},${height} Z`;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylineStr}
      />
    </svg>
  );
}

// ==========================================
// SVG Donut Chart with Slices & Legend
// ==========================================
function SvgDonutChart({ data = [], title = "", tooltipDesc = "Channel distribution" }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const total = useMemo(() => data.reduce((sum, d) => sum + (d.value || 0), 0), [data]);

  const size = 150;
  const center = size / 2;
  const radius = 56;
  const strokeWidth = 26;

  // Compute SVG arc stroke-dasharray and offsets
  let cumulativeAngle = 0;
  const circumference = 2 * Math.PI * radius;

  const slices = data.map((d, idx) => {
    const pct = total > 0 ? (d.value / total) : 0;
    const strokeDash = `${(pct * circumference).toFixed(2)} ${(circumference * (1 - pct)).toFixed(2)}`;
    const strokeOffset = (-cumulativeAngle * circumference).toFixed(2);
    cumulativeAngle += pct;
    return { ...d, strokeDash, strokeOffset, rawPct: (pct * 100).toFixed(1) };
  });

  return (
    <div className="glass-panel" style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '16px',
      boxShadow: '0 4px 18px -2px rgba(15, 23, 42, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          {title}
        </h4>
        <div title={tooltipDesc} style={{ cursor: 'pointer', color: '#94a3b8' }}>
          <Info size={13} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '10px', flex: 1 }}>
        {/* SVG Circle Canvas */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
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
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0f172a' }}>
              {hoveredIdx !== null ? `${slices[hoveredIdx]?.rawPct}%` : '100%'}
            </span>
          </div>
        </div>

        {/* Legend with percentages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '110px' }}>
          {data.map((item, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.45,
                transition: 'opacity 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                <span style={{ color: '#475569', fontWeight: '600' }}>{item.channel}</span>
              </div>
              <span style={{ color: '#0f172a', fontWeight: '800' }}>
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
// Horizontal Grouped Bar Chart: Clicks & CTR
// ==========================================
function SvgHorizontalBarChart({ data = [], title = "" }) {
  const maxClicks = useMemo(() => Math.max(...data.map(d => d.clicks || 1), 1), [data]);

  return (
    <div className="glass-panel" style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '16px',
      boxShadow: '0 4px 18px -2px rgba(15, 23, 42, 0.04)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          {title}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', fontWeight: '600' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#0369a1' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#0284c7' }} />
            CTR
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#0284c7' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#38bdf8' }} />
            Clicks
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
        {data.map((item, idx) => {
          const barWidthPct = Math.min(100, (item.clicks / maxClicks) * 88);
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ fontWeight: '700', color: '#334155' }}>{item.channel}</span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontWeight: '800', color: '#0369a1' }}>{item.ctr_pct}%</span>
                  <span style={{ fontWeight: '600', color: '#64748b' }}>{item.clicks_formatted}</span>
                </div>
              </div>
              <div style={{
                width: '100%',
                height: '16px',
                background: '#f1f5f9',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${barWidthPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
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
// Area Trend Chart: Impressions Over Time
// ==========================================
function SvgAreaTrendChart({ data = [], title = "" }) {
  const [activeSeason, setActiveSeason] = useState('All');
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const filteredData = useMemo(() => {
    if (activeSeason === 'All') return data;
    return data.filter(d => d.season === activeSeason);
  }, [data, activeSeason]);

  const height = 140;
  const width = 520;
  const paddingX = 40;
  const paddingY = 24;

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

  return (
    <div className="glass-panel" style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '16px',
      boxShadow: '0 4px 18px -2px rgba(15, 23, 42, 0.04)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          {title}
        </h4>
        {/* Season Selector Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['All', 'Spring', 'Summer', 'Fall'].map(s => (
            <button
              key={s}
              onClick={() => setActiveSeason(s)}
              style={{
                padding: '3px 9px',
                borderRadius: '9999px',
                fontSize: '0.72rem',
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

      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="areaTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e2e8f0" />

          {/* Area Fill & Curve */}
          {areaPath && <path d={areaPath} fill="url(#areaTrendGrad)" />}
          {polylineStr && (
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylineStr}
            />
          )}

          {/* Data Points */}
          {points.map((p, idx) => (
            <g key={idx} onMouseEnter={() => setHoveredPoint(p)} onMouseLeave={() => setHoveredPoint(null)}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredPoint?.month === p.month ? 5.5 : 3.5}
                fill="#ffffff"
                stroke="#10b981"
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
              />
              <text
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
                fontWeight="600"
              >
                {p.month}
              </text>
            </g>
          ))}
        </svg>

        {hoveredPoint && (
          <div style={{
            position: 'absolute',
            top: `${hoveredPoint.y - 30}px`,
            left: `${hoveredPoint.x}px`,
            transform: 'translateX(-50%)',
            background: '#0f172a',
            color: '#ffffff',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: '700',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap'
          }}>
            {hoveredPoint.month}: {formatCompact(hoveredPoint.impressions)} Impr
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Dual-Axis Chart: Day of Week (Volume vs CTR)
// ==========================================
function SvgDualAxisChart({ data = [], title = "" }) {
  const height = 150;
  const width = 520;
  const paddingX = 40;
  const paddingY = 24;

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
    <div className="glass-panel" style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '16px',
      boxShadow: '0 4px 18px -2px rgba(15, 23, 42, 0.04)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          {title}
        </h4>
        <div style={{ display: 'flex', gap: '14px', fontSize: '0.74rem', fontWeight: '700' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            Impressions
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#0369a1' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} />
            CTR
          </span>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Baseline Grid */}
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e2e8f0" />
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#f1f5f9" strokeDasharray="3 3" />

          {/* Line 1: Impressions (Green) */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={lineImprStr}
          />

          {/* Line 2: CTR (Cyan / Blue) */}
          <polyline
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={lineCtrStr}
          />

          {/* CTR Data Markers & Percentage Badges */}
          {pointsCtr.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="3.5" fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fontSize="9"
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
                {p.day.slice(0, 3)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ==========================================
// Main Campaign Studio View
// ==========================================
export default function CampaignStudio({ tables = [] }) {
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'impressions' | 'cost_revenue'
  const [selectedTable, setSelectedTable] = useState('benchmark_demo');
  const [channelFilter, setChannelFilter] = useState('All');
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [startDate, setStartDate] = useState('2023-03-01');
  const [endDate, setEndDate] = useState('2023-11-30');

  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [colMapping, setColMapping] = useState({
    channel_col: '',
    campaign_col: '',
    date_col: '',
    impressions_col: '',
    clicks_col: '',
    cost_col: '',
    conversions_col: '',
    profit_col: ''
  });

  const [analytics, setAnalytics] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial candidate tables from warehouse
  useEffect(() => {
    const loadCandidates = async () => {
      try {
        const res = await fetchCampaignCandidates();
        if (res?.warehouse_candidates) {
          setCandidates(res.warehouse_candidates);
        }
      } catch (err) {
        console.warn('Candidate fetch error:', err);
      }
    };
    loadCandidates();
  }, [tables.length]);

  // Merge backend candidate metadata with any client tables
  const displayTables = useMemo(() => {
    const map = new Map();
    candidates.forEach(c => map.set(c.table_name, c));
    tables.forEach(t => {
      if (!map.has(t.table_name)) {
        map.set(t.table_name, {
          table_name: t.table_name,
          row_count: t.row_count || 0,
          is_campaign_ready: false,
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

  // Load analytics when filters or selection changes
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

      // Auto-sync table date range if using a warehouse dataset and default 2023 dates were preset
      if (selectedTable !== 'benchmark_demo' && data?.filters?.min_date && data?.filters?.max_date) {
        if (!startDate || startDate === '2023-03-01') {
          setStartDate(data.filters.min_date);
        }
        if (!endDate || endDate === '2023-11-30') {
          setEndDate(data.filters.max_date);
        }
      }

      // Sync active mapping state if returned
      if (data?.active_mapping && selectedTable !== 'benchmark_demo') {
        setColMapping(prev => ({
          channel_col: data.active_mapping.channel_col || prev.channel_col || '',
          campaign_col: data.active_mapping.campaign_col || prev.campaign_col || '',
          date_col: data.active_mapping.date_col || prev.date_col || '',
          impressions_col: data.active_mapping.impressions_col || prev.impressions_col || '',
          clicks_col: data.active_mapping.clicks_col || prev.clicks_col || '',
          cost_col: data.active_mapping.cost_col || prev.cost_col || '',
          conversions_col: data.active_mapping.conversions_col || prev.conversions_col || '',
          profit_col: data.active_mapping.profit_col || prev.profit_col || ''
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate campaign analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedTable, channelFilter, campaignFilter, startDate, endDate]);

  const handleTableChange = (newTableName) => {
    setSelectedTable(newTableName);
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
        channel_col: cols.channel_col || (meta?.available_columns?.find(c => !c.startsWith('col_') && !c.endsWith('_id')) || ''),
        campaign_col: cols.campaign_col || (meta?.available_columns?.find(c => c.includes('name') || c.includes('item') || c.includes('title')) || ''),
        date_col: cols.date_col || (meta?.available_columns?.find(c => c.includes('date') || c.includes('time')) || ''),
        impressions_col: cols.impressions_col || '',
        clicks_col: cols.clicks_col || '',
        cost_col: cols.cost_col || '',
        conversions_col: cols.conversions_col || '',
        profit_col: cols.profit_col || ''
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

  const kpis = analytics?.kpis;
  const donuts = analytics?.donuts;

  // Available column options for current table
  const colOptions = activeTableMeta?.available_columns || (analytics?.filters ? Object.keys(analytics?.filters) : []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ======================================================== */}
      {/* 1. Header & Filter Bar                                   */}
      {/* ======================================================== */}
      <div className="glass-panel" style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        padding: '16px 24px',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        {/* Title & Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #e11d48, #f43f5e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(225, 29, 72, 0.28)'
          }}>
            <Megaphone size={19} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Marketing Campaign Analysis
              </h1>
              <span title="Multi-channel advertising attribution and ROI intelligence" style={{ cursor: 'pointer', color: '#94a3b8' }}>
                <Info size={16} />
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>
              Executive Power BI Studio • Cross-Channel ROI & Funnel Attribution
            </span>
          </div>
        </div>

        {/* Tab Segment Controls */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'impressions', label: 'Impressions & CTR' },
            { id: 'cost_revenue', label: 'Ads Cost & Revenue' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: activeSubTab === tab.id ? '#1e293b' : 'transparent',
                color: activeSubTab === tab.id ? '#ffffff' : '#64748b',
                transition: 'all 0.15s ease',
                boxShadow: activeSubTab === tab.id ? '0 2px 8px rgba(30, 41, 59, 0.2)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Data Source Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#475569' }}>
            <span style={{ fontWeight: '700' }}>Source:</span>
            <select
              value={selectedTable}
              onChange={(e) => handleTableChange(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.76rem',
                background: '#ffffff',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '240px'
              }}
            >
              <option value="benchmark_demo">🌟 Benchmark Campaign Demo</option>
              {displayTables.length > 0 && (
                <optgroup label="Local SQLite Warehouse Tables">
                  {displayTables.map(c => (
                    <option key={c.table_name} value={c.table_name}>
                      📁 {c.table_name} ({c.row_count ? c.row_count.toLocaleString() : '—'} rows){c.is_campaign_ready ? ' ✨' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Column Mapping Toggle Button (For warehouse tables) */}
          {selectedTable !== 'benchmark_demo' && (
            <button
              onClick={() => setIsMappingOpen(prev => !prev)}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: '700',
                border: isMappingOpen ? '1px solid #818cf8' : '1px solid #cbd5e1',
                background: isMappingOpen ? '#e0e7ff' : '#f8fafc',
                color: isMappingOpen ? '#4338ca' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Configure which table columns represent channels, metrics, and dates"
            >
              <Target size={13} />
              <span>{isMappingOpen ? 'Hide Columns' : 'Map Columns'}</span>
            </button>
          )}

          {/* Date Range Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: '#475569' }}>
            <span style={{ fontWeight: '700' }}>Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '5px 8px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.75rem',
                outline: 'none'
              }}
            />
            <span>-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '5px 8px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.75rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Channel Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: '#475569' }}>
            <span style={{ fontWeight: '700' }}>Channel:</span>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.76rem',
                background: '#ffffff',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '130px'
              }}
            >
              {analytics?.filters?.channels?.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              )) || <option value="All">All</option>}
            </select>
          </div>

          {/* Campaign Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: '#475569' }}>
            <span style={{ fontWeight: '700' }}>Campaign:</span>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.76rem',
                background: '#ffffff',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '140px'
              }}
            >
              {analytics?.filters?.campaigns?.map(cp => (
                <option key={cp} value={cp}>{cp}</option>
              )) || <option value="All">All</option>}
            </select>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetFilters}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: '8px'
            }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Warehouse Status Banner (When reading from DB)           */}
      {/* ======================================================== */}
      {selectedTable !== 'benchmark_demo' && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '10px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '0.78rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981'
            }} />
            <span style={{ fontWeight: '700', color: '#0f172a' }}>
              Connected to Warehouse Table:
            </span>
            <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
              {selectedTable}
            </code>
            {activeTableMeta?.row_count ? (
              <span style={{ color: '#64748b' }}>({activeTableMeta.row_count.toLocaleString()} rows)</span>
            ) : null}
            <span style={{ color: '#94a3b8' }}>•</span>
            <span style={{ color: '#475569' }}>
              Channel: <strong style={{ color: '#4f46e5' }}>{colMapping.channel_col || 'auto'}</strong>
            </span>
            <span style={{ color: '#94a3b8' }}>•</span>
            <span style={{ color: '#475569' }}>
              Metric / Cost: <strong style={{ color: '#0284c7' }}>{colMapping.cost_col || colMapping.profit_col || 'auto'}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsMappingOpen(prev => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#4f46e5',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.78rem'
              }}
            >
              {isMappingOpen ? 'Close Column Mapper' : 'Change Column Mapping ⚙️'}
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
                fontSize: '0.78rem'
              }}
            >
              Switch back to Demo Preset
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Expandable Column Mapping Bar                            */}
      {/* ======================================================== */}
      {isMappingOpen && selectedTable !== 'benchmark_demo' && (
        <div className="glass-panel" style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #c7d2fe',
          padding: '16px 20px',
          boxShadow: '0 4px 18px -2px rgba(99, 102, 241, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={16} color="#4f46e5" />
              <span style={{ fontSize: '0.86rem', fontWeight: '800', color: '#1e293b' }}>
                Column Mapping Configuration for "{selectedTable}"
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Map your table's columns to marketing & business dimensions
            </span>
          </div>

          {/* Dropdown Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '12px'
          }}>
            {/* Channel / Dimension */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>
                Channel / Category (Breakdown)
              </label>
              <select
                value={colMapping.channel_col}
                onChange={(e) => setColMapping(prev => ({ ...prev, channel_col: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#f8fafc' }}
              >
                <option value="">(Auto-detect)</option>
                {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Campaign / Entity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>
                Campaign / Item Name
              </label>
              <select
                value={colMapping.campaign_col}
                onChange={(e) => setColMapping(prev => ({ ...prev, campaign_col: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#f8fafc' }}
              >
                <option value="">(Auto-detect)</option>
                {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Date Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>
                Date / Timestamp
              </label>
              <select
                value={colMapping.date_col}
                onChange={(e) => setColMapping(prev => ({ ...prev, date_col: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#f8fafc' }}
              >
                <option value="">(Auto-detect or Sequential)</option>
                {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Impressions / Volume */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>
                Impressions / Volume / Qty
              </label>
              <select
                value={colMapping.impressions_col}
                onChange={(e) => setColMapping(prev => ({ ...prev, impressions_col: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#f8fafc' }}
              >
                <option value="">(Auto-detect / Derived)</option>
                {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Clicks / Engagement */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>
                Clicks / Engagement / Rating
              </label>
              <select
                value={colMapping.clicks_col}
                onChange={(e) => setColMapping(prev => ({ ...prev, clicks_col: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#f8fafc' }}
              >
                <option value="">(Auto-detect / Derived)</option>
                {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Cost / Spend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>
                Cost / Price / Spend ($)
              </label>
              <select
                value={colMapping.cost_col}
                onChange={(e) => setColMapping(prev => ({ ...prev, cost_col: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#f8fafc' }}
              >
                <option value="">(Auto-detect / Derived)</option>
                {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Conversions / Orders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>
                Conversions / Orders (Count)
              </label>
              <select
                value={colMapping.conversions_col}
                onChange={(e) => setColMapping(prev => ({ ...prev, conversions_col: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#f8fafc' }}
              >
                <option value="">(Auto-detect / Derived)</option>
                {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Profit / Revenue */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>
                Profit / Revenue / Total ($)
              </label>
              <select
                value={colMapping.profit_col}
                onChange={(e) => setColMapping(prev => ({ ...prev, profit_col: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#f8fafc' }}
              >
                <option value="">(Auto-detect / Derived)</option>
                {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              onClick={() => setIsMappingOpen(false)}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '8px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleApplyMapping}
              style={{
                padding: '6px 18px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
              }}
            >
              <Sparkles size={13} />
              <span>Apply Mappings & Recalculate</span>
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
          borderRadius: '14px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          color: '#be123c',
          fontSize: '0.84rem'
        }}>
          <div>
            <strong>Unable to calculate analytics:</strong> {error}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsMappingOpen(true)}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #f43f5e',
                color: '#e11d48',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Adjust Columns
            </button>
            <button
              onClick={() => handleTableChange('benchmark_demo')}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                background: '#e11d48',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Load Demo Benchmark
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. Main Executive Grid Canvas                            */}
      {/* ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(230px, 270px) 1fr',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* ======================================================== */}
        {/* Left Column: 5 KPI Cards with Sparklines & Deltas        */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* KPI 1: Impressions */}
          <div className="glass-panel" style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Impressions</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {kpis?.impressions?.formatted || '14.65M'}
              </div>
              <SvgSparkline points={kpis?.impressions?.sparkline} color="#0284c7" />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: (kpis?.impressions?.compare_pct || -3.92) >= 0 ? '#10b981' : '#e11d48',
              fontWeight: '700',
              marginTop: '6px'
            }}>
              <span>Compare to last month:</span>
              <span>{(kpis?.impressions?.compare_pct || -3.92) >= 0 ? '+' : ''}{kpis?.impressions?.compare_pct || -3.92}%</span>
            </div>
          </div>

          {/* KPI 2: Clicks */}
          <div className="glass-panel" style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Clicks</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {kpis?.clicks?.formatted || '181.59K'}
              </div>
              <SvgSparkline points={kpis?.clicks?.sparkline} color="#4f46e5" />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: '#475569',
              fontWeight: '700',
              marginTop: '6px'
            }}>
              <span>Clicks through rate:</span>
              <span style={{ color: '#0284c7', fontWeight: '800' }}>{kpis?.clicks?.ctr_pct || '1.24'}%</span>
            </div>
          </div>

          {/* KPI 3: Conversions */}
          <div className="glass-panel" style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Conversions</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {kpis?.conversions?.formatted || '40K'}
              </div>
              <SvgSparkline points={kpis?.conversions?.sparkline} color="#10b981" />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: (kpis?.conversions?.compare_pct || 3.39) >= 0 ? '#10b981' : '#e11d48',
              fontWeight: '700',
              marginTop: '6px'
            }}>
              <span>Compare to last month:</span>
              <span>{(kpis?.conversions?.compare_pct || 3.39) >= 0 ? '+' : ''}{kpis?.conversions?.compare_pct || 3.39}%</span>
            </div>
          </div>

          {/* KPI 4: Cost */}
          <div className="glass-panel" style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Cost</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {kpis?.cost?.formatted || '$163.25K'}
              </div>
              <SvgSparkline points={kpis?.cost?.sparkline} color="#d97706" />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: '#475569',
              fontWeight: '700',
              marginTop: '6px'
            }}>
              <span>Cost per conversion:</span>
              <span style={{ color: '#0f172a', fontWeight: '800' }}>{kpis?.cost?.cost_per_conv || '$4.06'}</span>
            </div>
          </div>

          {/* KPI 5: Profits */}
          <div className="glass-panel" style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Profits</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {kpis?.profit?.formatted || '$1.57M'}
              </div>
              <SvgSparkline points={kpis?.profit?.sparkline} color="#059669" />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: '#475569',
              fontWeight: '700',
              marginTop: '6px'
            }}>
              <span>Profit per conversion:</span>
              <span style={{ color: '#059669', fontWeight: '800' }}>{kpis?.profit?.profit_per_conv || '$9.61'}</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Right Section: Multi-Chart Visualization Matrix          */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Row: 3 Visualizations (Donut, Bars, Donut) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            <SvgDonutChart
              title="Impressions by Channel, Device and Ad"
              data={donuts?.impressions_by_channel || [
                { channel: 'Facebook', percentage: 37.14, value: 5440000, color: '#3b82f6' },
                { channel: 'Instagram', percentage: 33.05, value: 4840000, color: '#f97316' },
                { channel: 'Pinterest', percentage: 29.81, value: 4370000, color: '#ef4444' }
              ]}
            />
            <SvgHorizontalBarChart
              title="Clicks and CTR by Channel, Device and Ad"
              data={analytics?.bar_clicks_ctr || [
                { channel: 'Instagram', clicks: 68610, clicks_formatted: '68.61K', ctr_pct: 1.42, color: '#f97316' },
                { channel: 'Facebook', clicks: 69970, clicks_formatted: '69.97K', ctr_pct: 1.29, color: '#3b82f6' },
                { channel: 'Pinterest', clicks: 43010, clicks_formatted: '43.01K', ctr_pct: 0.99, color: '#ef4444' }
              ]}
            />
            <SvgDonutChart
              title="Conversion by Channel, Device and Ad"
              data={donuts?.conversions_by_channel || [
                { channel: 'Instagram', percentage: 38.73, value: 15490, color: '#f97316' },
                { channel: 'Facebook', percentage: 32.62, value: 13050, color: '#3b82f6' },
                { channel: 'Pinterest', percentage: 28.64, value: 11460, color: '#ef4444' }
              ]}
            />
          </div>

          {/* Middle Row: Area Chart + Ads Spending Donut */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.8fr 1fr',
            gap: '16px'
          }}>
            <SvgAreaTrendChart
              title="Impressions trend overtime"
              data={analytics?.trend_over_time || []}
            />
            <SvgDonutChart
              title="Ads Spending by Channel, Device and Ad"
              data={donuts?.spending_by_channel || [
                { channel: 'Facebook', percentage: 43.87, value: 71600, color: '#3b82f6' },
                { channel: 'Instagram', percentage: 38.83, value: 63400, color: '#f97316' },
                { channel: 'Pinterest', percentage: 17.30, value: 28250, color: '#ef4444' }
              ]}
            />
          </div>

          {/* Bottom Row: Dual-Axis Line Chart + Profit Donut */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.8fr 1fr',
            gap: '16px'
          }}>
            <SvgDualAxisChart
              title="Impressions and CTR by day of week"
              data={analytics?.day_of_week || []}
            />
            <SvgDonutChart
              title="Profit by Channel, Device and Ad"
              data={donuts?.profit_by_channel || [
                { channel: 'Instagram', percentage: 39.62, value: 622000, color: '#f97316' },
                { channel: 'Pinterest', percentage: 38.67, value: 607000, color: '#ef4444' },
                { channel: 'Facebook', percentage: 21.72, value: 341000, color: '#3b82f6' }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
