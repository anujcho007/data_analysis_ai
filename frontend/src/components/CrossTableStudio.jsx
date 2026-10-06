import React, { useState, useEffect, useMemo } from 'react';
import { 
  Network, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Layers, 
  Sliders, 
  Database, 
  Sparkles, 
  ArrowRight, 
  Check, 
  Copy, 
  Table as TableIcon, 
  Info, 
  RefreshCw,
  Award,
  DollarSign,
  Activity,
  ArrowUpDown,
  ChevronDown
} from 'lucide-react';
import { fetchCrossTableAnalytics, fetchRelationships } from '../api/client';

export default function CrossTableStudio({ tables = [], setActiveTab }) {
  const [relationships, setRelationships] = useState([]);
  const [isLoadingRels, setIsLoadingRels] = useState(false);

  // Configuration State
  const [primaryTable, setPrimaryTable] = useState('');
  const [dimensionTable, setDimensionTable] = useState('');
  const [dimensionColumn, setDimensionColumn] = useState('');
  const [metricTable, setMetricTable] = useState('');
  const [metricColumn, setMetricColumn] = useState('');
  const [aggregation, setAggregation] = useState('SUM');
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'rankings' | 'donut' | 'area' | 'table'
  const [limit, setLimit] = useState(15);
  const [orderDirection, setOrderDirection] = useState('DESC');

  // Query Result State
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Color Palette
  const colors = [
    '#4f46e5', '#0284c7', '#059669', '#d97706', 
    '#e11d48', '#7c3aed', '#0d9488', '#ea580c',
    '#2563eb', '#16a34a', '#db2777', '#ca8a04'
  ];

  // Number / Currency Formatter
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (abs >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (abs >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return Number(num).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const isCurrencyMetric = useMemo(() => {
    const colLower = (metricColumn || '').toLowerCase();
    return ['sales', 'revenue', 'price', 'amount', 'total', 'cost', 'fee', 'charge', 'spend'].some(kw => colLower.includes(kw));
  }, [metricColumn]);

  const formatMetricVal = (val) => {
    return isCurrencyMetric ? `$${formatNumber(val)}` : formatNumber(val);
  };

  // 1. Fetch relationships on mount
  useEffect(() => {
    const loadRels = async () => {
      setIsLoadingRels(true);
      try {
        const rels = await fetchRelationships();
        setRelationships(rels || []);
      } catch (err) {
        console.error('Failed to load relationships:', err);
      } finally {
        setIsLoadingRels(false);
      }
    };
    loadRels();
  }, [tables]);

  // Table metadata lookup map
  const tableMetaMap = useMemo(() => {
    const map = {};
    tables.forEach(t => {
      let cols = [];
      try {
        cols = typeof t.schema_info === 'string' ? JSON.parse(t.schema_info) : (t.schema_info || []);
      } catch {
        cols = [];
      }
      map[t.table_name] = {
        ...t,
        columns: cols,
        numericCols: cols.filter(c => ['INTEGER', 'REAL'].includes(c.data_type?.toUpperCase()) && !c.name.toLowerCase().endsWith(('_id', '_key', 'id'))),
        categoricalCols: cols.filter(c => !c.name.toLowerCase().endsWith(('_id', '_key'))),
        dateCols: cols.filter(c => c.data_type === 'TIMESTAMP' || ['date', 'time', 'created', 'year'].some(kw => c.name.toLowerCase().includes(kw)))
      };
    });
    return map;
  }, [tables]);

  // Set default primary table (prefer Fact table)
  useEffect(() => {
    if (tables.length > 0 && !primaryTable) {
      const factTable = tables.find(t => t.table_type === 'fact');
      const defaultTbl = factTable ? factTable.table_name : tables[0].table_name;
      setPrimaryTable(defaultTbl);
    }
  }, [tables, primaryTable]);

  // Find tables connected to primaryTable
  const connectedTables = useMemo(() => {
    if (!primaryTable) return [];
    const connected = new Set();
    relationships.forEach(rel => {
      if (rel.source_table === primaryTable) connected.add(rel.target_table);
      if (rel.target_table === primaryTable) connected.add(rel.source_table);
    });
    // Also include primary table itself for self-joins/groupings
    return Array.from(connected);
  }, [primaryTable, relationships]);

  // Auto-select dimension table and columns when primaryTable changes
  useEffect(() => {
    if (!primaryTable) return;
    
    // Default metric table to primary table
    setMetricTable(primaryTable);

    // Pick first numeric col of primary table
    const pMeta = tableMetaMap[primaryTable];
    if (pMeta && pMeta.numericCols.length > 0) {
      setMetricColumn(pMeta.numericCols[0].name);
    } else if (pMeta && pMeta.columns.length > 0) {
      setMetricColumn(pMeta.columns[0].name);
    }

    // Default dimension table: prefer first connected table, else primaryTable
    const targetDimTbl = connectedTables.length > 0 ? connectedTables[0] : primaryTable;
    setDimensionTable(targetDimTbl);

    const dMeta = tableMetaMap[targetDimTbl];
    if (dMeta && dMeta.categoricalCols.length > 0) {
      // Pick a descriptive column like 'city', 'category', 'name', 'status'
      const priorityCols = dMeta.categoricalCols.filter(c => 
        ['city', 'category', 'status', 'name', 'type', 'channel', 'segment', 'cuisine'].some(kw => c.name.toLowerCase().includes(kw))
      );
      setDimensionColumn(priorityCols.length > 0 ? priorityCols[0].name : dMeta.categoricalCols[0].name);
    }
  }, [primaryTable, connectedTables, tableMetaMap]);

  // When dimensionTable changes, auto-select a sensible dimension column
  useEffect(() => {
    if (!dimensionTable) return;
    const dMeta = tableMetaMap[dimensionTable];
    if (dMeta && dMeta.categoricalCols.length > 0) {
      const alreadyValid = dMeta.categoricalCols.some(c => c.name === dimensionColumn);
      if (!alreadyValid) {
        const priorityCols = dMeta.categoricalCols.filter(c => 
          ['city', 'category', 'status', 'name', 'type', 'channel', 'segment', 'cuisine'].some(kw => c.name.toLowerCase().includes(kw))
        );
        setDimensionColumn(priorityCols.length > 0 ? priorityCols[0].name : dMeta.categoricalCols[0].name);
      }
    }
  }, [dimensionTable, tableMetaMap]);

  // Execute Cross Table Analytics
  const runCrossAnalytics = async () => {
    if (!primaryTable || !dimensionTable || !dimensionColumn) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCrossTableAnalytics({
        primary_table: primaryTable,
        dimension_table: dimensionTable,
        dimension_column: dimensionColumn,
        metric_table: metricTable || primaryTable,
        metric_column: metricColumn || null,
        aggregation: aggregation,
        order_direction: orderDirection,
        limit: Number(limit)
      });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to execute cross-table query');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger query when selection changes with debounce & validation
  useEffect(() => {
    if (!primaryTable || !dimensionTable || !dimensionColumn) return;

    // Validate that dimensionColumn belongs to dimensionTable
    const dCols = tableMetaMap[dimensionTable]?.columns?.map(c => c.name) || [];
    if (dCols.length > 0 && !dCols.includes(dimensionColumn)) return;

    // Validate metricColumn if specified and not '*'
    const mCols = tableMetaMap[metricTable || primaryTable]?.columns?.map(c => c.name) || [];
    if (metricColumn && metricColumn !== '*' && mCols.length > 0 && !mCols.includes(metricColumn)) return;

    const timer = setTimeout(() => {
      runCrossAnalytics();
    }, 200);

    return () => clearTimeout(timer);
  }, [primaryTable, dimensionTable, dimensionColumn, metricTable, metricColumn, aggregation, limit, orderDirection, tableMetaMap]);

  // Copy SQL
  const handleCopySql = () => {
    if (!result?.generated_sql) return;
    navigator.clipboard.writeText(result.generated_sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Max value calculation for bar scaling
  const maxChartVal = useMemo(() => {
    if (!result?.chart_data || result.chart_data.length === 0) return 1;
    return Math.max(...result.chart_data.map(d => d.value), 1);
  }, [result]);

  if (tables.length < 1) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <Database size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
        <h3>No Tables Available</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Upload datasets first to use Cross-Table Visualization.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)',
        border: '1px solid #c7d2fe',
        boxShadow: '0 4px 20px -2px rgba(79, 70, 229, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: '#e0e7ff',
              border: '1px solid #c7d2fe',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              color: '#4338ca',
              fontWeight: '700',
              marginBottom: '8px'
            }}>
              <Network size={14} color="#4f46e5" />
              <span>Relational Star Schema Cross-Analytics</span>
            </div>
            <h2 style={{ fontSize: '1.6rem', color: '#0f172a', margin: '0 0 6px 0' }}>
              Multi-Table Visual Analytics Studio
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, maxWidth: '720px' }}>
              Combine transactional metrics (Fact tables) with descriptive business dimensions (Dimension tables) via automated foreign key joins.
            </p>
          </div>

          {/* Quick Relationship Badge Counter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ffffff',
            padding: '8px 14px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            fontSize: '0.8125rem'
          }}>
            <Layers size={16} color="#4f46e5" />
            <span style={{ fontWeight: '700', color: '#0f172a' }}>{relationships.length}</span>
            <span style={{ color: '#64748b' }}>Detected Schema Link(s)</span>
          </div>
        </div>

        {/* Detected Relationships Breadcrumb Strip */}
        {relationships.length > 0 && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Available Joins:
            </span>
            {relationships.map((rel, idx) => (
              <div 
                key={idx} 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: '#334155'
                }}
              >
                <strong style={{ color: '#4f46e5' }}>{rel.source_table}</strong>
                <span style={{ color: '#94a3b8' }}>.{rel.source_column}</span>
                <span style={{ color: '#0284c7' }}>➔</span>
                <strong style={{ color: '#059669' }}>{rel.target_table}</strong>
                <span style={{ color: '#94a3b8' }}>.{rel.target_column}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visual Join & Column Builder Controls */}
      <div className="glass-panel" style={{
        padding: '22px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="#4f46e5" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Visual Cross-Table Join Builder
            </h3>
          </div>

          <button 
            className="btn btn-secondary" 
            onClick={runCrossAnalytics}
            disabled={isLoading}
            style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={isLoading ? 'spinner' : ''} />
            <span>{isLoading ? 'Recomputing...' : 'Re-Run Aggregation'}</span>
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          background: '#f8fafc',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          {/* 1. Base / Primary Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
              1. Base Fact Table
            </label>
            <select
              className="select-field"
              value={primaryTable}
              onChange={(e) => setPrimaryTable(e.target.value)}
              style={{ padding: '9px 12px', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', background: '#ffffff' }}
            >
              {tables.map(t => (
                <option key={t.table_name} value={t.table_name}>
                  {t.table_name} ({t.table_type === 'fact' ? '⚡ Fact Table' : '📖 Dimension'})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Linked Dimension Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
              2. Linked Dimension Table
            </label>
            <select
              className="select-field"
              value={dimensionTable}
              onChange={(e) => {
                const newDimTbl = e.target.value;
                setDimensionTable(newDimTbl);
                const dMeta = tableMetaMap[newDimTbl];
                if (dMeta && dMeta.categoricalCols && dMeta.categoricalCols.length > 0) {
                  const priorityCols = dMeta.categoricalCols.filter(c => 
                    ['city', 'category', 'status', 'name', 'type', 'channel', 'segment', 'cuisine', 'veg_or_non_veg'].some(kw => c.name.toLowerCase().includes(kw))
                  );
                  setDimensionColumn(priorityCols.length > 0 ? priorityCols[0].name : dMeta.categoricalCols[0].name);
                } else if (dMeta && dMeta.columns && dMeta.columns.length > 0) {
                  setDimensionColumn(dMeta.columns[0].name);
                }
              }}
              style={{ padding: '9px 12px', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', background: '#ffffff' }}
            >
              <optgroup label="Connected via Star Schema">
                {connectedTables.map(tName => (
                  <option key={tName} value={tName}>
                    🔗 {tName} {tName === primaryTable ? '(Same Table)' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All Warehouse Tables">
                {tables.filter(t => !connectedTables.includes(t.table_name)).map(t => (
                  <option key={t.table_name} value={t.table_name}>
                    {t.table_name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 3. Dimension Column (X-Axis Category) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
              3. Group By (X-Axis)
            </label>
            <select
              className="select-field"
              value={dimensionColumn}
              onChange={(e) => setDimensionColumn(e.target.value)}
              style={{ padding: '9px 12px', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', background: '#ffffff' }}
            >
              {tableMetaMap[dimensionTable]?.columns.map(c => (
                <option key={c.name} value={c.name}>
                  {dimensionTable}.{c.name} ({c.data_type})
                </option>
              )) || <option value="">No columns found</option>}
            </select>
          </div>

          {/* 4. Metric Column (Y-Axis) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
              4. Metric Measure (Y-Axis)
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                className="select-field"
                value={metricColumn}
                onChange={(e) => setMetricColumn(e.target.value)}
                style={{ flex: 1, padding: '9px 12px', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', background: '#ffffff' }}
              >
                <option value="*">COUNT(1) - Records Volume</option>
                {tableMetaMap[primaryTable]?.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {primaryTable}.{c.name}
                  </option>
                ))}
              </select>

              {/* Aggregation Function */}
              <select
                className="select-field"
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value)}
                style={{ width: '90px', padding: '9px 8px', fontSize: '0.85rem', fontWeight: '700', color: '#4f46e5', background: '#ffffff' }}
              >
                <option value="SUM">SUM</option>
                <option value="AVG">AVG</option>
                <option value="COUNT">COUNT</option>
                <option value="MAX">MAX</option>
                <option value="MIN">MIN</option>
              </select>
            </div>
          </div>
        </div>

        {/* Visual Controls Toolbar (Chart Type, Limit, Sort) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '6px'
        }}>
          {/* Chart Type Selector */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '600', color: '#64748b' }}>Chart Type:</span>
            {[
              { id: 'bar', label: 'Bar', icon: BarChart3 },
              { id: 'rankings', label: 'Leaderboard', icon: Award },
              { id: 'donut', label: 'Donut Share', icon: PieChart },
              { id: 'area', label: 'Trendline', icon: TrendingUp },
              { id: 'table', label: 'Table Data', icon: TableIcon }
            ].map(item => {
              const Icon = item.icon;
              const isActive = chartType === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setChartType(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    border: '1px solid',
                    borderColor: isActive ? '#4f46e5' : '#cbd5e1',
                    background: isActive ? '#e0e7ff' : '#ffffff',
                    color: isActive ? '#4338ca' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Limit & Sort */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Top Items:</span>
              <select
                className="select-field"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
              >
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
                <option value={25}>Top 25</option>
                <option value={50}>Top 50</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Order:</span>
              <select
                className="select-field"
                value={orderDirection}
                onChange={(e) => setOrderDirection(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
              >
                <option value="DESC">Highest First</option>
                <option value="ASC">Lowest First</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div style={{
          padding: '14px',
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          borderRadius: '12px',
          color: '#e11d48',
          fontSize: '0.85rem'
        }}>
          <strong>Query Error:</strong> {error}
        </div>
      )}

      {/* KPI Cards Row */}
      {result && result.kpis && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px'
        }}>
          {/* KPI 1: Total Aggregate */}
          <div className="glass-panel" style={{ padding: '16px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                Total {aggregation} ({metricColumn})
              </span>
              <DollarSign size={16} color="#4f46e5" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>
              {formatMetricVal(result.kpis.total_value)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '4px' }}>
              Across {result.kpis.item_count} {dimensionColumn} segment(s)
            </div>
          </div>

          {/* KPI 2: Mean per Segment */}
          <div className="glass-panel" style={{ padding: '16px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                Mean per {dimensionColumn}
              </span>
              <Activity size={16} color="#0284c7" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>
              {formatMetricVal(result.kpis.avg_value)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
              Average group metric weight
            </div>
          </div>

          {/* KPI 3: Leading Contributor */}
          <div className="glass-panel" style={{ padding: '16px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                Top Contributor
              </span>
              <Award size={16} color="#d97706" />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {result.kpis.top_item || 'None'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '4px' }}>
              {formatMetricVal(result.kpis.top_value)} ({result.kpis.top_share_pct}% share)
            </div>
          </div>

          {/* KPI 4: Total Records */}
          <div className="glass-panel" style={{ padding: '16px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                Joined Records Count
              </span>
              <Layers size={16} color="#059669" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>
              {result.kpis.total_count?.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
              Matched rows in query
            </div>
          </div>
        </div>
      )}

      {/* Main Chart Visualization Card */}
      <div className="glass-panel" style={{
        padding: '24px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        minHeight: '380px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
              {aggregation} of {primaryTable}.{metricColumn} by {dimensionTable}.{dimensionColumn}
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Visualizing {result?.chart_data?.length || 0} relational groups
              </span>
              {result && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: '#059669',
                  background: '#ecfdf5',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: '1px solid #a7f3d0'
                }}>
                  <Sparkles size={12} color="#059669" />
                  ⚡ {result.execution_time_ms} ms
                  {result.is_sampled && ` • Scaled from ${result.sample_size?.toLocaleString()} sample rows`}
                </span>
              )}
            </div>
          </div>

          {/* Quick Info Pill */}
          <div style={{
            fontSize: '0.75rem',
            padding: '4px 10px',
            background: '#f1f5f9',
            borderRadius: '9999px',
            color: '#475569',
            fontWeight: '600'
          }}>
            Join Type: {dimensionTable === primaryTable ? 'Single Table' : 'LEFT JOIN (Star Schema)'}
          </div>
        </div>

        {/* 1. Bar Chart */}
        {chartType === 'bar' && result?.chart_data?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px',
              height: '280px',
              padding: '20px 10px 40px 10px',
              borderBottom: '1px solid #e2e8f0',
              overflowX: 'auto'
            }}>
              {result.chart_data.map((item, idx) => {
                const heightPct = Math.max((item.value / maxChartVal) * 100, 4);
                const isHovered = hoveredIndex === idx;
                const barColor = colors[idx % colors.length];

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      flex: '1 0 50px',
                      maxWidth: '70px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div style={{
                        position: 'absolute',
                        bottom: `calc(${heightPct}% + 10px)`,
                        background: '#0f172a',
                        color: '#ffffff',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        whiteSpace: 'nowrap',
                        zIndex: 20,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        pointerEvents: 'none'
                      }}>
                        <div style={{ fontWeight: '700' }}>{item.label}</div>
                        <div>{formatMetricVal(item.value)} ({item.percentage}%)</div>
                        <div style={{ color: '#94a3b8' }}>{item.count} records</div>
                      </div>
                    )}

                    {/* Bar */}
                    <div style={{
                      width: '80%',
                      height: `${heightPct}%`,
                      background: isHovered 
                        ? `linear-gradient(180deg, ${barColor}, #1e1b4b)`
                        : `linear-gradient(180deg, ${barColor}, ${barColor}cc)`,
                      borderRadius: '6px 6px 0 0',
                      transition: 'all 0.2s',
                      transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                      boxShadow: isHovered ? `0 4px 14px ${barColor}66` : 'none'
                    }} />

                    {/* X-Axis Label */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-32px',
                      fontSize: '0.7rem',
                      color: isHovered ? '#4f46e5' : '#64748b',
                      fontWeight: isHovered ? '700' : '500',
                      textAlign: 'center',
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Leaderboard / Rankings Chart */}
        {chartType === 'rankings' && result?.chart_data?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {result.chart_data.map((item, idx) => {
              const widthPct = Math.max((item.value / maxChartVal) * 100, 2);
              const barColor = colors[idx % colors.length];

              return (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: idx % 2 === 0 ? '#f8fafc' : '#ffffff',
                    border: '1px solid #f1f5f9'
                  }}
                >
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: idx === 0 ? '#fef3c7' : (idx === 1 ? '#f1f5f9' : (idx === 2 ? '#ffedd5' : '#f8fafc')),
                    color: idx === 0 ? '#b45309' : (idx === 1 ? '#475569' : (idx === 2 ? '#c2410c' : '#94a3b8')),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    flexShrink: 0
                  }}>
                    {idx + 1}
                  </div>

                  <div style={{ width: '160px', fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </div>

                  <div style={{ flex: 1, height: '10px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      background: barColor,
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>

                  <div style={{ width: '110px', textAlign: 'right', fontSize: '0.85rem', fontWeight: '800', color: '#0f172a' }}>
                    {formatMetricVal(item.value)}
                  </div>

                  <div style={{ width: '55px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                    {item.percentage}%
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. Donut Share Chart */}
        {chartType === 'donut' && result?.chart_data?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '30px', padding: '20px 0' }}>
            <div style={{ position: 'relative', width: '220px', height: '220px' }}>
              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                {(() => {
                  let accumulatedPct = 0;
                  return result.chart_data.map((item, idx) => {
                    const strokeDasharray = `${item.percentage} ${100 - item.percentage}`;
                    const strokeDashoffset = -accumulatedPct;
                    accumulatedPct += item.percentage;
                    const strokeColor = colors[idx % colors.length];

                    return (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={strokeColor}
                        strokeWidth="18"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        pathLength="100"
                        style={{ transition: 'all 0.3s' }}
                      />
                    );
                  });
                })()}
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>TOTAL</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                  {formatMetricVal(result.kpis?.total_value || 0)}
                </span>
              </div>
            </div>

            {/* Legend Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', flex: 1, maxWidth: '440px' }}>
              {result.chart_data.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: colors[idx % colors.length], flexShrink: 0 }} />
                  <span style={{ fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {item.label}
                  </span>
                  <span style={{ fontWeight: '700', color: '#64748b' }}>{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Area / Trend Chart */}
        {chartType === 'area' && result?.chart_data?.length > 0 && (
          <div style={{ height: '260px', width: '100%', position: 'relative', marginTop: '10px' }}>
            <svg viewBox="0 0 500 200" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="crossAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area path */}
              {(() => {
                const count = result.chart_data.length;
                if (count < 2) return null;
                const points = result.chart_data.map((it, idx) => {
                  const x = (idx / (count - 1)) * 480 + 10;
                  const y = 180 - (it.value / maxChartVal) * 160;
                  return { x, y };
                });

                const dLine = points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
                const dArea = `${dLine} L ${points[points.length - 1].x} 190 L ${points[0].x} 190 Z`;

                return (
                  <>
                    <path d={dArea} fill="url(#crossAreaGradient)" />
                    <path d={dLine} fill="none" stroke="#4f46e5" strokeWidth="3" />
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        )}

        {/* 5. Data Table View */}
        {chartType === 'table' && result?.chart_data?.length > 0 && (
          <div className="data-table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{dimensionColumn}</th>
                  <th>{aggregation} ({metricColumn})</th>
                  <th>Share %</th>
                  <th>Row Count</th>
                </tr>
              </thead>
              <tbody>
                {result.chart_data.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: '600', color: '#0f172a' }}>{item.label}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{formatMetricVal(item.value)}</td>
                    <td>{item.percentage}%</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expandable Generated SQL & Relationship Inspector */}
      {result && result.generated_sql && (
        <div className="glass-panel" style={{
          padding: '16px 20px',
          background: '#0f172a',
          color: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Underlying Relational SQL Engine
              </span>
              <span style={{ fontSize: '0.7rem', background: '#1e293b', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}>
                Auto-Generated Join
              </span>
            </div>

            <button
              onClick={handleCopySql}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#e2e8f0',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              {copiedSql ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
            </button>
          </div>

          <pre style={{
            margin: 0,
            padding: '12px',
            background: '#090d16',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            color: '#38bdf8',
            overflowX: 'auto',
            lineHeight: 1.5
          }}>
            {result.generated_sql}
          </pre>
        </div>
      )}
    </div>
  );
}
