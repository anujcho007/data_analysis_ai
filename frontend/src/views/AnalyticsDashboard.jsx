import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Layers, 
  DollarSign, 
  Activity, 
  RefreshCw, 
  Database, 
  Sparkles, 
  Sliders,
  ChevronRight,
  Info,
  SlidersHorizontal,
  CircleDot,
  Network
} from 'lucide-react';
import { fetchTableAnalytics } from '../api/client';
import AiSmartDashboard from '../components/AiSmartDashboard';
import CrossTableStudio from '../components/CrossTableStudio';

export default function AnalyticsDashboard({ tables = [], setActiveTab }) {
  const [dashboardMode, setDashboardMode] = useState('cross'); // 'cross' | 'ai' | 'studio'
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Visualization Selection State
  // Chart types: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'histogram' | 'rankings' | 'scatter'
  const [chartType, setChartType] = useState('bar');
  const [activeValueType, setActiveValueType] = useState('value'); // 'value' | 'count'
  const [dataDimension, setDataDimension] = useState('category'); // 'category' | 'timeline'
  const [hoveredItem, setHoveredItem] = useState(null);

  // Palette for chart items
  const colors = [
    '#4f46e5', '#0284c7', '#059669', '#d97706', 
    '#e11d48', '#7c3aed', '#0d9488', '#ea580c',
    '#2563eb', '#16a34a', '#db2777', '#ca8a04'
  ];

  // Number formatters
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (abs >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (abs >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return Number(num).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatCurrency = (num) => {
    return '$' + formatNumber(num);
  };

  // Sync default table
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].table_name);
    }
  }, [tables, selectedTable]);

  // Load analytics whenever table or selectors change
  const loadAnalytics = async () => {
    if (!selectedTable) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTableAnalytics(
        selectedTable,
        selectedMetric || null,
        selectedCategory || null,
        selectedDate || null
      );
      setAnalyticsData(data);
      if (!selectedMetric && data.selected_metric) setSelectedMetric(data.selected_metric);
      if (!selectedCategory && data.selected_category) setSelectedCategory(data.selected_category);
      if (!selectedDate && data.selected_date) setSelectedDate(data.selected_date);
    } catch (err) {
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTable) {
      loadAnalytics();
    }
  }, [selectedTable, selectedMetric, selectedCategory, selectedDate]);

  // Selected table metadata
  const currentTableMeta = tables.find(t => t.table_name === selectedTable);

  // Prepare standard dataset items based on selected dimension (Category vs Timeline)
  const chartItems = useMemo(() => {
    if (!analyticsData) return [];

    if (dataDimension === 'timeline' && analyticsData.time_series?.length > 0) {
      return analyticsData.time_series.map((ts, idx) => ({
        id: `ts-${idx}`,
        label: ts.period,
        value: ts.value,
        count: ts.count,
        color: colors[idx % colors.length]
      }));
    }

    // Default: Category breakdown or rankings
    const targetBreakdown = analyticsData.categorical_breakdowns?.find(b => b.column === analyticsData.selected_category) 
      || analyticsData.categorical_breakdowns?.[0];

    if (targetBreakdown && targetBreakdown.data?.length > 0) {
      return targetBreakdown.data.map((item, idx) => ({
        id: `cat-${idx}`,
        label: item.label,
        value: item.value || (analyticsData.rankings?.find(r => r.name === item.label)?.total_value) || item.count,
        count: item.count,
        percentage: item.percentage || 0,
        color: colors[idx % colors.length]
      }));
    }

    if (analyticsData.rankings?.length > 0) {
      return analyticsData.rankings.map((r, idx) => ({
        id: `rank-${idx}`,
        label: r.name,
        value: r.total_value,
        count: r.count,
        percentage: 0,
        color: colors[idx % colors.length]
      }));
    }

    return [];
  }, [analyticsData, dataDimension]);

  // Fallback histogram calculation if backend histogram is empty
  const histogramItems = useMemo(() => {
    if (analyticsData?.histogram && analyticsData.histogram.length > 0) {
      return analyticsData.histogram;
    }
    return [];
  }, [analyticsData]);

  // Max value for scaling
  const maxVal = useMemo(() => {
    if (chartItems.length === 0) return 1;
    const vals = chartItems.map(d => activeValueType === 'value' ? d.value : d.count);
    return Math.max(...vals, 1);
  }, [chartItems, activeValueType]);

  // Total for percentage calculations in Pie / Donut
  const totalSum = useMemo(() => {
    if (chartItems.length === 0) return 1;
    return chartItems.reduce((acc, curr) => acc + (activeValueType === 'value' ? curr.value : curr.count), 0) || 1;
  }, [chartItems, activeValueType]);

  // --- SVG Path Builders ---

  // 1. Line & Area Coordinates
  const linePoints = useMemo(() => {
    if (chartItems.length === 0) return [];
    const width = 800;
    const height = 280;
    const padL = 60;
    const padR = 40;
    const padT = 30;
    const padB = 55;
    const usableW = width - padL - padR;
    const usableH = height - padT - padB;

    return chartItems.map((item, idx) => {
      const val = activeValueType === 'value' ? item.value : item.count;
      const x = padL + (idx / Math.max(chartItems.length - 1, 1)) * usableW;
      const normalized = Math.max(0, val) / maxVal;
      const y = height - padB - normalized * usableH;
      return { ...item, x, y, displayVal: val };
    });
  }, [chartItems, activeValueType, maxVal]);

  const lineSvgPath = useMemo(() => {
    if (linePoints.length === 0) return '';
    return linePoints.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      return `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [linePoints]);

  const areaSvgPath = useMemo(() => {
    if (linePoints.length === 0) return '';
    const firstX = linePoints[0].x;
    const lastX = linePoints[linePoints.length - 1].x;
    const bottomY = 280 - 55;
    return `${lineSvgPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [lineSvgPath, linePoints]);

  // 2. Pie & Donut Arc Slices
  const pieSlices = useMemo(() => {
    if (chartItems.length === 0) return [];
    const cx = 200;
    const cy = 180;
    const outerRadius = 140;
    const innerRadius = chartType === 'donut' ? 82 : 0;

    let startAngle = -Math.PI / 2; // Start at 12 o'clock

    return chartItems.slice(0, 10).map((item, idx) => {
      const val = activeValueType === 'value' ? item.value : item.count;
      const sliceAngle = (val / totalSum) * (2 * Math.PI);
      const endAngle = startAngle + sliceAngle;

      const x1 = cx + outerRadius * Math.cos(startAngle);
      const y1 = cy + outerRadius * Math.sin(startAngle);
      const x2 = cx + outerRadius * Math.cos(endAngle);
      const y2 = cy + outerRadius * Math.sin(endAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      let pathD = '';

      if (innerRadius > 0) {
        const x3 = cx + innerRadius * Math.cos(endAngle);
        const y3 = cy + innerRadius * Math.sin(endAngle);
        const x4 = cx + innerRadius * Math.cos(startAngle);
        const y4 = cy + innerRadius * Math.sin(startAngle);
        pathD = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
      } else {
        pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }

      const percent = ((val / totalSum) * 100).toFixed(1);
      const sliceData = {
        ...item,
        displayVal: val,
        percentage: percent,
        pathD,
        startAngle,
        endAngle,
        midAngle: startAngle + sliceAngle / 2
      };

      startAngle = endAngle;
      return sliceData;
    });
  }, [chartItems, activeValueType, totalSum, chartType]);

  if (tables.length === 0) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <Database size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>No Data Ingested Yet</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 20px' }}>
          Upload your CSV datasets first to clean and populate the warehouse. Your analytical charts will appear here automatically.
        </p>
        <button className="btn btn-primary" onClick={() => setActiveTab('upload')}>
          <span>Upload Datasets</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* View Mode Toggle: AI Executive Dashboard vs Custom Chart Studio */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          display: 'inline-flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => setDashboardMode('cross')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: dashboardMode === 'cross' ? 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' : 'transparent',
              color: dashboardMode === 'cross' ? '#ffffff' : '#64748b',
              boxShadow: dashboardMode === 'cross' ? '0 2px 8px rgba(5, 150, 105, 0.25)' : 'none'
            }}
          >
            <Network size={16} />
            <span>🔗 Star Schema Multi-Table Studio</span>
          </button>

          <button
            onClick={() => setDashboardMode('ai')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: dashboardMode === 'ai' ? 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)' : 'transparent',
              color: dashboardMode === 'ai' ? '#ffffff' : '#64748b',
              boxShadow: dashboardMode === 'ai' ? '0 2px 8px rgba(79, 70, 229, 0.25)' : 'none'
            }}
          >
            <Sparkles size={16} />
            <span>✨ AI Smart Dashboard</span>
          </button>

          <button
            onClick={() => setDashboardMode('studio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: dashboardMode === 'studio' ? '#ffffff' : 'transparent',
              color: dashboardMode === 'studio' ? '#0f172a' : '#64748b',
              boxShadow: dashboardMode === 'studio' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <Sliders size={16} />
            <span>📊 Single Table Studio</span>
          </button>
        </div>
      </div>

      {dashboardMode === 'ai' && (
        <AiSmartDashboard tables={tables} setActiveTab={setActiveTab} />
      )}

      {dashboardMode === 'cross' && (
        <CrossTableStudio tables={tables} setActiveTab={setActiveTab} />
      )}

      {dashboardMode === 'studio' && (
        <>
          {/* Header & Controls Panel */}
          <div className="glass-panel" style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)'
          }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
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
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              <Sparkles size={13} color="#4f46e5" />
              <span>Multi-Dimensional BI Analytics Studio</span>
            </div>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '4px', color: '#0f172a' }}>
              Interactive Data Visualization Studio
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Select from Bar Graphs, Pie/Donut Charts, Histograms, Trend Lines, Area Charts, and Ranked Leaderboards.
            </p>
          </div>

          <button 
            className="btn btn-secondary" 
            onClick={loadAnalytics}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={15} className={isLoading ? 'spinner' : ''} />
            <span>{isLoading ? 'Computing...' : 'Refresh Insights'}</span>
          </button>
        </div>

        {/* Dynamic Selectors Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)'
        }}>
          {/* Table Selector */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              Active Warehouse Table
            </label>
            <select
              className="input-field"
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value);
                setSelectedMetric('');
                setSelectedCategory('');
                setSelectedDate('');
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            >
              {tables.map(t => (
                <option key={t.id} value={t.table_name}>
                  {t.table_name} ({t.row_count.toLocaleString()} rows)
                </option>
              ))}
            </select>
          </div>

          {/* Metric Selector */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              Numerical Metric (Y-Axis / Measure)
            </label>
            <select
              className="input-field"
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              disabled={!analyticsData?.available_numeric_cols?.length}
              style={{ width: '100%', cursor: 'pointer' }}
            >
              {analyticsData?.available_numeric_cols?.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          {/* Category Breakdown Selector */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              Categorical Dimension (Group By)
            </label>
            <select
              className="input-field"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={!analyticsData?.available_categorical_cols?.length}
              style={{ width: '100%', cursor: 'pointer' }}
            >
              {analyticsData?.available_categorical_cols?.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          {analyticsData?.available_date_cols?.length > 0 && (
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                Timeline Dimension
              </label>
              <select
                className="input-field"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: '100%', cursor: 'pointer' }}
              >
                {analyticsData.available_date_cols.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sampling Notice if > 200,000 rows */}
        {analyticsData?.is_sampled && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: '#e0f2fe',
            border: '1px solid #bae6fd',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: '#0369a1'
          }}>
            <Activity size={14} />
            <span>
              <strong>High-Velocity Engine:</strong> Rapid statistical sample of {analyticsData.sampled_records.toLocaleString()} rows computed instantly from {analyticsData.total_rows.toLocaleString()} total warehouse records.
            </span>
          </div>
        )}
      </div>

      {/* KPI Stats Ribbon */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '18px'
      }}>
        {/* Total Metric Sum */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
              TOTAL {analyticsData?.selected_metric?.toUpperCase() || 'VOLUME'}
            </span>
            <div style={{ padding: '6px', background: '#e0e7ff', borderRadius: '8px' }}>
              <DollarSign size={18} color="#4f46e5" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {formatNumber(analyticsData?.metric_stats?.sum)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Aggregate total across dataset
          </div>
        </div>

        {/* Average Value */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
              AVERAGE PER RECORD
            </span>
            <div style={{ padding: '6px', background: '#e0f2fe', borderRadius: '8px' }}>
              <TrendingUp size={18} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: '#0284c7' }}>
            {formatNumber(analyticsData?.metric_stats?.avg)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Mean value across dataset
          </div>
        </div>

        {/* Total Records */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
              TOTAL RECORDS
            </span>
            <div style={{ padding: '6px', background: '#dcfce7', borderRadius: '8px' }}>
              <Layers size={18} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: '#059669' }}>
            {analyticsData?.total_rows?.toLocaleString() || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {analyticsData?.total_columns} columns in {currentTableMeta?.table_type || 'fact'} table
          </div>
        </div>

        {/* Peak Single Value */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #d97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
              PEAK SINGLE VALUE
            </span>
            <div style={{ padding: '6px', background: '#fef3c7', borderRadius: '8px' }}>
              <Activity size={18} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: '#d97706' }}>
            {formatNumber(analyticsData?.metric_stats?.max)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Min value: {formatNumber(analyticsData?.metric_stats?.min)}
          </div>
        </div>
      </div>

      {/* Primary Chart Viewport with Interactive Chart Switcher */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Chart Selector Tabs Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px'
        }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {chartType === 'bar' && <BarChart3 size={20} color="#4f46e5" />}
              {chartType === 'line' && <TrendingUp size={20} color="#4f46e5" />}
              {chartType === 'area' && <Layers size={20} color="#4f46e5" />}
              {chartType === 'pie' && <PieChart size={20} color="#0284c7" />}
              {chartType === 'donut' && <PieChart size={20} color="#0284c7" />}
              {chartType === 'histogram' && <Activity size={20} color="#059669" />}
              {chartType === 'rankings' && <SlidersHorizontal size={20} color="#d97706" />}
              {chartType === 'scatter' && <CircleDot size={20} color="#7c3aed" />}
              <span>
                {chartType === 'bar' && 'Vertical Bar Graph'}
                {chartType === 'line' && 'Line Trend Graph'}
                {chartType === 'area' && 'Filled Area Trend Graph'}
                {chartType === 'pie' && 'Solid Pie Chart'}
                {chartType === 'donut' && 'Interactive Donut Chart'}
                {chartType === 'histogram' && `Histogram Frequency Distribution (${analyticsData?.selected_metric})`}
                {chartType === 'rankings' && 'Leaderboard Ranked Contribution'}
                {chartType === 'scatter' && 'Scatter & Bubble Distribution'}
              </span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {chartType === 'histogram' 
                ? `10-bin frequency distribution of '${analyticsData?.selected_metric}' across all table records`
                : `Grouped by ${dataDimension === 'timeline' ? analyticsData?.selected_date || 'Timeline' : analyticsData?.selected_category || 'Category'} (${activeValueType === 'value' ? 'Summed Metric' : 'Record Count'})`
              }
            </p>
          </div>

          {/* Interactive Chart Type Picker Pill */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '4px'
          }}>
            {[
              { id: 'bar', label: 'Bar Graph', icon: BarChart3 },
              { id: 'line', label: 'Line Graph', icon: TrendingUp },
              { id: 'area', label: 'Area Chart', icon: Layers },
              { id: 'donut', label: 'Donut Chart', icon: PieChart },
              { id: 'pie', label: 'Pie Chart', icon: PieChart },
              { id: 'histogram', label: 'Histogram', icon: Activity },
              { id: 'rankings', label: 'Leaderboard', icon: SlidersHorizontal },
              { id: 'scatter', label: 'Scatter', icon: CircleDot }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = chartType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setChartType(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#4f46e5' : 'var(--text-secondary)',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: '0.8rem',
                    boxShadow: isActive ? '0 2px 6px rgba(15, 23, 42, 0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} color={isActive ? '#4f46e5' : 'currentColor'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart Modifier Toolbar (Dimension & Value Switcher) */}
        {chartType !== 'histogram' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#f8fafc',
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Dimension Selection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                X-Axis Dimension:
              </span>
              <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
                <button
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: dataDimension === 'category' ? '#ffffff' : 'transparent',
                    color: dataDimension === 'category' ? '#0f172a' : 'var(--text-secondary)',
                    fontWeight: dataDimension === 'category' ? '600' : '400',
                    cursor: 'pointer'
                  }}
                  onClick={() => setDataDimension('category')}
                >
                  Category ({analyticsData?.selected_category || 'Category'})
                </button>
                {analyticsData?.time_series?.length > 0 && (
                  <button
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: dataDimension === 'timeline' ? '#ffffff' : 'transparent',
                      color: dataDimension === 'timeline' ? '#0f172a' : 'var(--text-secondary)',
                      fontWeight: dataDimension === 'timeline' ? '600' : '400',
                      cursor: 'pointer'
                    }}
                    onClick={() => setDataDimension('timeline')}
                  >
                    Timeline ({analyticsData?.selected_date || 'Date'})
                  </button>
                )}
              </div>
            </div>

            {/* Value vs Count Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Y-Axis Metric:
              </span>
              <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
                <button
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: activeValueType === 'value' ? 'var(--accent-primary)' : 'transparent',
                    color: activeValueType === 'value' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: activeValueType === 'value' ? '600' : '400',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveValueType('value')}
                >
                  Summed ({analyticsData?.selected_metric || 'Metric'})
                </button>
                <button
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: activeValueType === 'count' ? 'var(--accent-primary)' : 'transparent',
                    color: activeValueType === 'count' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: activeValueType === 'count' ? '600' : '400',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveValueType('count')}
                >
                  Record Count
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- VIEW 1: VERTICAL BAR GRAPH -------------------- */}
        {chartType === 'bar' && (
          <div style={{ width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 800 290" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.75" />
                </linearGradient>
                <linearGradient id="barGradHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="1" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => (
                <g key={idx}>
                  <line 
                    x1="60" 
                    y1={30 + p * 190} 
                    x2="760" 
                    y2={30 + p * 190} 
                    stroke="rgba(0, 0, 0, 0.06)" 
                    strokeDasharray="4 4" 
                  />
                  <text 
                    x="50" 
                    y={34 + p * 190} 
                    fontSize="10" 
                    fill="#94a3b8" 
                    textAnchor="end"
                    fontFamily="var(--font-mono)"
                  >
                    {formatNumber(maxVal * (1 - p))}
                  </text>
                </g>
              ))}

              {/* Bars */}
              {chartItems.slice(0, 12).map((item, idx) => {
                const totalBars = Math.min(chartItems.length, 12);
                const slotWidth = 700 / totalBars;
                const barWidth = Math.min(slotWidth * 0.65, 46);
                const val = activeValueType === 'value' ? item.value : item.count;
                const barHeight = Math.max(4, (val / maxVal) * 190);
                const x = 60 + idx * slotWidth + (slotWidth - barWidth) / 2;
                const y = 220 - barHeight;
                const isHovered = hoveredItem?.label === item.label;

                return (
                  <g 
                    key={idx} 
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Bar Rectangle with Rounded Top */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="6"
                      ry="6"
                      fill={isHovered ? "url(#barGradHover)" : "url(#barGrad)"}
                      filter={isHovered ? "drop-shadow(0 4px 8px rgba(79, 70, 229, 0.35))" : "none"}
                      style={{ transition: 'all 0.15s ease' }}
                    />

                    {/* Value on top of bar */}
                    <text
                      x={x + barWidth / 2}
                      y={y - 6}
                      fontSize="10"
                      fill={isHovered ? "#4f46e5" : "#64748b"}
                      fontWeight={isHovered ? "700" : "500"}
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                    >
                      {formatNumber(val)}
                    </text>

                    {/* X-Axis Category Label */}
                    <text
                      x={x + barWidth / 2}
                      y="242"
                      fontSize="11"
                      fill={isHovered ? "#0f172a" : "#475569"}
                      fontWeight={isHovered ? "700" : "500"}
                      textAnchor="middle"
                      transform={`rotate(-20, ${x + barWidth / 2}, 242)`}
                    >
                      {item.label && item.label.length > 11 ? item.label.slice(0, 10) + '…' : item.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredItem && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '20px',
                background: '#ffffff',
                border: '1px solid #c7d2fe',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px',
                boxShadow: 'var(--shadow-lg)',
                pointerEvents: 'none',
                zIndex: 10
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hoveredItem.label}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#4f46e5', fontFamily: 'var(--font-mono)' }}>
                  {activeValueType === 'value' ? formatNumber(hoveredItem.value) : hoveredItem.count.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {hoveredItem.count?.toLocaleString()} records ({hoveredItem.percentage || ((hoveredItem.value / totalSum) * 100).toFixed(1)}%)
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------- VIEW 2 & 3: LINE & AREA TREND GRAPH -------------------- */}
        {(chartType === 'line' || chartType === 'area') && (
          <div style={{ width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 800 280" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              <defs>
                <linearGradient id="areaGradientPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                </linearGradient>
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#4f46e5" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => (
                <g key={idx}>
                  <line 
                    x1="60" 
                    y1={30 + p * 195} 
                    x2="760" 
                    y2={30 + p * 195} 
                    stroke="rgba(0, 0, 0, 0.06)" 
                    strokeDasharray="4 4" 
                  />
                  <text 
                    x="50" 
                    y={34 + p * 195} 
                    fontSize="10" 
                    fill="#94a3b8" 
                    textAnchor="end"
                    fontFamily="var(--font-mono)"
                  >
                    {formatNumber(maxVal * (1 - p))}
                  </text>
                </g>
              ))}

              {/* Area fill (if area chart selected) */}
              {chartType === 'area' && areaSvgPath && (
                <path d={areaSvgPath} fill="url(#areaGradientPrimary)" />
              )}

              {/* Trend Line Path */}
              {lineSvgPath && (
                <path 
                  d={lineSvgPath} 
                  fill="none" 
                  stroke="#4f46e5" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  filter="url(#lineGlow)" 
                />
              )}

              {/* Data Point Markers */}
              {linePoints.map((pt, idx) => {
                const isHovered = hoveredItem?.label === pt.label;
                return (
                  <g 
                    key={idx}
                    onMouseEnter={() => setHoveredItem(pt)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 7 : 4}
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth={isHovered ? "3.5" : "2.5"}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    <text
                      x={pt.x}
                      y="245"
                      fontSize="10"
                      fill={isHovered ? "#0f172a" : "#64748b"}
                      fontWeight={isHovered ? "700" : "500"}
                      textAnchor="middle"
                    >
                      {pt.label && pt.label.length > 9 ? pt.label.slice(0, 8) + '…' : pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredItem && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '20px',
                background: '#ffffff',
                border: '1px solid #c7d2fe',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px',
                boxShadow: 'var(--shadow-lg)',
                pointerEvents: 'none',
                zIndex: 10
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hoveredItem.label}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#4f46e5', fontFamily: 'var(--font-mono)' }}>
                  {activeValueType === 'value' ? formatNumber(hoveredItem.displayVal) : hoveredItem.count.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {hoveredItem.count?.toLocaleString()} records
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------- VIEW 4 & 5: DONUT & PIE CHART -------------------- */}
        {(chartType === 'donut' || chartType === 'pie') && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1fr) 1fr',
            gap: '28px',
            alignItems: 'center'
          }}>
            {/* SVG Pie / Donut Geometry */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <svg viewBox="0 0 400 360" style={{ width: '100%', maxWidth: '360px', height: 'auto', overflow: 'visible' }}>
                <defs>
                  <filter id="sliceShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
                  </filter>
                </defs>

                <g transform="translate(0, 0)">
                  {pieSlices.map((slice, idx) => {
                    const isHovered = hoveredItem?.label === slice.label;
                    return (
                      <path
                        key={idx}
                        d={slice.pathD}
                        fill={slice.color}
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        filter={isHovered ? "url(#sliceShadow)" : "none"}
                        style={{
                          cursor: 'pointer',
                          transformOrigin: '200px 180px',
                          transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={() => setHoveredItem(slice)}
                        onMouseLeave={() => setHoveredItem(null)}
                      />
                    );
                  })}
                </g>

                {/* Donut Cutout Center Display */}
                {chartType === 'donut' && (
                  <g pointerEvents="none">
                    <circle cx="200" cy="180" r="78" fill="#ffffff" />
                    <text x="200" y="170" fontSize="11" fill="#64748b" textAnchor="middle" fontWeight="500">
                      {hoveredItem ? hoveredItem.label : 'TOTAL VOLUME'}
                    </text>
                    <text x="200" y="195" fontSize="18" fill="#0f172a" textAnchor="middle" fontWeight="800" fontFamily="var(--font-mono)">
                      {hoveredItem 
                        ? (activeValueType === 'value' ? formatNumber(hoveredItem.value) : hoveredItem.count.toLocaleString()) 
                        : formatNumber(totalSum)
                      }
                    </text>
                    {hoveredItem && (
                      <text x="200" y="214" fontSize="11" fill="#4f46e5" textAnchor="middle" fontWeight="700">
                        {hoveredItem.percentage}% Share
                      </text>
                    )}
                  </g>
                )}
              </svg>
            </div>

            {/* Interactive Legend List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                Distribution Breakdown ({pieSlices.length} Entities)
              </div>
              {pieSlices.map((slice, idx) => {
                const isHovered = hoveredItem?.label === slice.label;
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredItem(slice)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: isHovered ? '#e0e7ff' : '#f8fafc',
                      border: `1px solid ${isHovered ? '#c7d2fe' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: slice.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: isHovered ? '700' : '500', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {slice.label}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#0f172a' }}>
                        {slice.percentage}%
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        ({formatNumber(slice.displayVal)})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* -------------------- VIEW 6: HISTOGRAM FREQUENCY DISTRIBUTION -------------------- */}
        {chartType === 'histogram' && (
          <div style={{ width: '100%', position: 'relative' }}>
            {histogramItems.length > 0 ? (
              <>
                <svg viewBox="0 0 800 290" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="histoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.65" />
                    </linearGradient>
                    <linearGradient id="histoGradHover" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#047857" stopOpacity="1" />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  {(() => {
                    const maxHistoCount = Math.max(...histogramItems.map(h => h.count), 1);
                    return [0, 0.25, 0.5, 0.75, 1].map((p, idx) => (
                      <g key={idx}>
                        <line 
                          x1="60" 
                          y1={30 + p * 190} 
                          x2="760" 
                          y2={30 + p * 190} 
                          stroke="rgba(0, 0, 0, 0.06)" 
                          strokeDasharray="4 4" 
                        />
                        <text 
                          x="50" 
                          y={34 + p * 190} 
                          fontSize="10" 
                          fill="#94a3b8" 
                          textAnchor="end"
                          fontFamily="var(--font-mono)"
                        >
                          {formatNumber(maxHistoCount * (1 - p))}
                        </text>
                      </g>
                    ));
                  })()}

                  {/* Frequency Bins */}
                  {(() => {
                    const maxHistoCount = Math.max(...histogramItems.map(h => h.count), 1);
                    const totalBins = histogramItems.length;
                    const slotWidth = 700 / totalBins;
                    const binWidth = slotWidth - 6;

                    return histogramItems.map((bin, idx) => {
                      const binHeight = Math.max(4, (bin.count / maxHistoCount) * 190);
                      const x = 60 + idx * slotWidth + 3;
                      const y = 220 - binHeight;
                      const isHovered = hoveredItem?.bin_index === bin.bin_index;

                      return (
                        <g 
                          key={idx}
                          onMouseEnter={() => setHoveredItem(bin)}
                          onMouseLeave={() => setHoveredItem(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Frequency Column */}
                          <rect
                            x={x}
                            y={y}
                            width={binWidth}
                            height={binHeight}
                            rx="4"
                            ry="4"
                            fill={isHovered ? "url(#histoGradHover)" : "url(#histoGrad)"}
                            filter={isHovered ? "drop-shadow(0 4px 8px rgba(5, 150, 105, 0.35))" : "none"}
                            style={{ transition: 'all 0.15s ease' }}
                          />

                          {/* Bin Count Label on Top */}
                          <text
                            x={x + binWidth / 2}
                            y={y - 6}
                            fontSize="10"
                            fill={isHovered ? "#047857" : "#64748b"}
                            fontWeight={isHovered ? "700" : "600"}
                            textAnchor="middle"
                            fontFamily="var(--font-mono)"
                          >
                            {bin.count.toLocaleString()}
                          </text>

                          {/* X-Axis Range Label */}
                          <text
                            x={x + binWidth / 2}
                            y="244"
                            fontSize="10"
                            fill={isHovered ? "#0f172a" : "#475569"}
                            fontWeight={isHovered ? "700" : "500"}
                            textAnchor="middle"
                            transform={`rotate(-25, ${x + binWidth / 2}, 244)`}
                          >
                            {bin.bin_label}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* Mean Reference Marker */}
                  {(() => {
                    const avgVal = analyticsData?.metric_stats?.avg;
                    const minVal = analyticsData?.metric_stats?.min;
                    const maxVal = analyticsData?.metric_stats?.max;
                    if (avgVal !== undefined && maxVal > minVal) {
                      const normalized = (avgVal - minVal) / (maxVal - minVal);
                      const meanX = 60 + normalized * 700;
                      return (
                        <g>
                          <line
                            x1={meanX}
                            y1="25"
                            x2={meanX}
                            y2="220"
                            stroke="#e11d48"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                          <rect x={meanX - 35} y="10" width="70" height="18" rx="4" fill="#ffe4e6" stroke="#f43f5e" strokeWidth="1" />
                          <text x={meanX} y="22" fontSize="9" fill="#e11d48" fontWeight="700" textAnchor="middle">
                            Mean: {formatNumber(avgVal)}
                          </text>
                        </g>
                      );
                    }
                    return null;
                  })()}
                </svg>

                {/* Hover Tooltip Overlay for Histogram */}
                {hoveredItem && hoveredItem.bin_label && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '20px',
                    background: '#ffffff',
                    border: '1px solid #a7f3d0',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 14px',
                    boxShadow: 'var(--shadow-lg)',
                    pointerEvents: 'none',
                    zIndex: 10
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Value Interval:</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: '#059669', fontFamily: 'var(--font-mono)' }}>
                      {hoveredItem.bin_label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <strong>{hoveredItem.count.toLocaleString()}</strong> records (
                      {analyticsData?.total_rows ? ((hoveredItem.count / analyticsData.total_rows) * 100).toFixed(1) : 0}% of total)
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                No numerical metric available to compute frequency histogram. Please select a numerical metric above.
              </div>
            )}
          </div>
        )}

        {/* -------------------- VIEW 7: LEADERBOARD / HORIZONTAL RANKINGS -------------------- */}
        {chartType === 'rankings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {analyticsData?.rankings?.length > 0 ? (
              analyticsData.rankings.map((rankItem, idx) => {
                const maxRankingVal = analyticsData.rankings[0].total_value || 1;
                const barWidth = Math.max(6, Math.round((rankItem.total_value / maxRankingVal) * 100));
                const color = colors[idx % colors.length];

                return (
                  <div key={idx} style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr 150px',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.15s ease'
                  }}>
                    {/* Rank Number & Entity Label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <span style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: idx < 3 ? '#e0e7ff' : '#f1f5f9',
                        color: idx < 3 ? '#4338ca' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        flexShrink: 0
                      }}>
                        #{idx + 1}
                      </span>
                      <span style={{
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {rankItem.name}
                      </span>
                    </div>

                    {/* Horizontal Bar */}
                    <div style={{ width: '100%', height: '14px', background: '#e2e8f0', borderRadius: '7px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${barWidth}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${color} 0%, #0284c7 100%)`,
                        borderRadius: '7px',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>

                    {/* Values */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {formatNumber(rankItem.total_value)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Avg: {formatNumber(rankItem.avg_value)} ({rankItem.count.toLocaleString()} rows)
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                No categorical ranking records found.
              </div>
            )}
          </div>
        )}

        {/* -------------------- VIEW 8: SCATTER / BUBBLE PLOT -------------------- */}
        {chartType === 'scatter' && (
          <div style={{ width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 800 280" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => (
                <g key={idx}>
                  <line 
                    x1="60" 
                    y1={30 + p * 190} 
                    x2="760" 
                    y2={30 + p * 190} 
                    stroke="rgba(0, 0, 0, 0.06)" 
                    strokeDasharray="4 4" 
                  />
                  <text 
                    x="50" 
                    y={34 + p * 190} 
                    fontSize="10" 
                    fill="#94a3b8" 
                    textAnchor="end"
                    fontFamily="var(--font-mono)"
                  >
                    {formatNumber(maxVal * (1 - p))}
                  </text>
                </g>
              ))}

              {/* Scatter Bubbles */}
              {chartItems.slice(0, 16).map((item, idx) => {
                const totalItems = Math.min(chartItems.length, 16);
                const x = 70 + (idx / Math.max(totalItems - 1, 1)) * 680;
                const val = activeValueType === 'value' ? item.value : item.count;
                const y = 220 - (val / maxVal) * 190;
                const r = Math.max(8, Math.min(22, 6 + (item.count / (maxVal || 1)) * 16));
                const isHovered = hoveredItem?.label === item.label;

                return (
                  <g 
                    key={idx}
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? r + 5 : r}
                      fill={colors[idx % colors.length]}
                      fillOpacity={isHovered ? 0.9 : 0.65}
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    <text
                      x={x}
                      y="245"
                      fontSize="10"
                      fill={isHovered ? "#0f172a" : "#64748b"}
                      fontWeight={isHovered ? "700" : "500"}
                      textAnchor="middle"
                    >
                      {item.label && item.label.length > 9 ? item.label.slice(0, 8) + '…' : item.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredItem && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '20px',
                background: '#ffffff',
                border: '1px solid #c7d2fe',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px',
                boxShadow: 'var(--shadow-lg)',
                pointerEvents: 'none',
                zIndex: 10
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hoveredItem.label}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>
                  {formatNumber(hoveredItem.value)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {hoveredItem.count?.toLocaleString()} records
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Additional Categorical Cards Grid */}
      {analyticsData?.categorical_breakdowns?.length > 1 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {analyticsData.categorical_breakdowns.slice(1).map((breakdown, bIdx) => (
            <div key={bIdx} className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Layers size={16} color="#818cf8" />
                <h4 style={{ fontSize: '1rem' }}>{breakdown.column.replace(/_/g, ' ').toUpperCase()}</h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {breakdown.data.slice(0, 5).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {formatNumber(item.count)} ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
