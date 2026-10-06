import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  Sparkles, 
  BrainCircuit, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sliders, 
  RefreshCw, 
  Download, 
  Layers, 
  Calendar, 
  DollarSign, 
  BarChart2, 
  HelpCircle,
  Lightbulb,
  Target,
  Zap,
  ChevronRight,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import { fetchPredictiveCandidates, generateForecast, exportPowerPointDeck } from '../api/client';
import DigitalTwinSimulator from '../components/DigitalTwinSimulator';

export default function PredictiveStudio({ tables = [] }) {
  const [selectedTable, setSelectedTable] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [horizon, setHorizon] = useState(30);
  const [studioMode, setStudioMode] = useState('forecast'); // 'forecast' | 'simulator'

  const [isLoading, setIsLoading] = useState(false);
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forecastResult, setForecastResult] = useState(null);

  // Interactive What-If Simulation State
  const [simulatedLift, setSimulatedLift] = useState(0); // -20% to +40%
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [activeTab, setActiveTab] = useState('forecast'); // 'forecast' | 'underperformers' | 'recommendations'

  // Default table selection
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].table_name);
    }
  }, [tables, selectedTable]);

  // Load candidate columns whenever selectedTable changes
  useEffect(() => {
    if (!selectedTable) return;
    const loadCandidates = async () => {
      setIsCandidatesLoading(true);
      setError(null);
      try {
        const res = await fetchPredictiveCandidates(selectedTable);
        setCandidates(res.candidates);
        setSelectedDate(res.candidates.recommended_date || '');
        setSelectedMetric(res.candidates.recommended_metric || '');
        setSelectedItem(res.candidates.recommended_item || '');
      } catch (err) {
        setError(err.message || 'Failed to auto-detect table columns');
      } finally {
        setIsCandidatesLoading(false);
      }
    };
    loadCandidates();
  }, [selectedTable]);

  // Auto-run forecast when candidates are detected
  useEffect(() => {
    if (selectedTable && selectedMetric) {
      handleRunForecast();
    }
  }, [selectedTable, selectedMetric, horizon]);

  const handleRunForecast = async () => {
    if (!selectedTable || !selectedMetric) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await generateForecast({
        table_name: selectedTable,
        date_column: selectedDate || null,
        metric_column: selectedMetric || null,
        item_column: selectedItem || null,
        horizon_periods: horizon
      });
      setForecastResult(res);
      setSimulatedLift(0);
    } catch (err) {
      setError(err.message || 'Failed to generate predictive model');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const abs = Math.abs(num);
    if (abs >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (abs >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return Number(num).toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  const formatCurrency = (num) => {
    return '$' + formatNumber(num);
  };

  // Combine historical and forecasted data with optional simulated lift
  const chartData = useMemo(() => {
    if (!forecastResult) return { points: [], minVal: 0, maxVal: 100 };

    const hist = (forecastResult.historical_data || []).map((p, idx) => ({
      ...p,
      type: 'historical',
      displayVal: p.actual,
      fittedVal: p.fitted,
      index: idx
    }));

    const liftMultiplier = 1 + (simulatedLift / 100);

    const fore = (forecastResult.forecast_data || []).map((p, idx) => {
      const adjustedForecast = p.forecast * liftMultiplier;
      const adjustedUpper = p.upper_bound * liftMultiplier;
      const adjustedLower = Math.max(0, p.lower_bound * liftMultiplier);
      return {
        ...p,
        type: 'forecast',
        forecast: adjustedForecast,
        upper_bound: adjustedUpper,
        lower_bound: adjustedLower,
        displayVal: adjustedForecast,
        index: hist.length + idx
      };
    });

    const all = [...hist, ...fore];
    if (all.length === 0) return { points: [], minVal: 0, maxVal: 100 };

    const vals = all.map(p => p.displayVal).concat(fore.map(p => p.upper_bound));
    const minVal = Math.max(0, Math.min(...vals) * 0.85);
    const maxVal = Math.max(...vals) * 1.15 || 100;

    return { points: all, minVal, maxVal, histCount: hist.length, foreCount: fore.length };
  }, [forecastResult, simulatedLift]);

  // Forecast Horizon metrics
  const horizonStats = useMemo(() => {
    if (!forecastResult || !chartData.points.length) return null;
    const forePoints = chartData.points.filter(p => p.type === 'forecast');
    if (!forePoints.length) return null;

    const totalProjected = forePoints.reduce((acc, p) => acc + (p.forecast || 0), 0);
    const avgDailyProjected = totalProjected / forePoints.length;
    const endTrend = forePoints[forePoints.length - 1].forecast;
    const startTrend = chartData.points[Math.max(0, chartData.histCount - 1)]?.displayVal || 1;
    const projectedGrowthPct = (((endTrend - startTrend) / (startTrend + 1e-6)) * 100).toFixed(1);

    return {
      totalProjected,
      avgDailyProjected,
      projectedGrowthPct,
      confidenceBandWidth: (forePoints[0].upper_bound - forePoints[0].lower_bound) || 0
    };
  }, [forecastResult, chartData]);

  // Export Executive Strategy HTML Report
  const handleExportStrategyReport = () => {
    if (!forecastResult) return;
    const model = forecastResult.model_summary;
    const underperformers = forecastResult.underperforming_items || [];
    const recommendations = forecastResult.client_recommendations || [];

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>DataForge AI - Predictive Executive Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
          .card { background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #334155; }
          h1 { color: #38bdf8; margin-top: 0; }
          h2 { color: #818cf8; border-bottom: 1px solid #334155; padding-bottom: 10px; }
          .kpi-row { display: flex; gap: 20px; margin-bottom: 24px; }
          .kpi { flex: 1; background: #0f172a; padding: 18px; border-radius: 8px; border-left: 4px solid #38bdf8; }
          .kpi-val { font-size: 24px; font-weight: bold; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { text-align: left; padding: 12px; border-bottom: 1px solid #334155; }
          th { background: #0f172a; color: #94a3b8; }
          .rec-box { background: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 14px; border-left: 4px solid #10b981; }
          .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #38bdf8; color: #0f172a; }
        </style>
      </head>
      <body>
        <h1>📊 DataForge AI: Predictive Client Strategy Report</h1>
        <p>Target Dataset: <strong>${forecastResult.table_name}</strong> | Target Metric: <strong>${forecastResult.selected_columns.metric_column}</strong> | Date Generated: <strong>${new Date().toLocaleDateString()}</strong></p>
        
        <div class="kpi-row">
          <div class="kpi">
            <div>30-Day Trend Direction</div>
            <div class="kpi-val" style="color: #10b981;">${model.trend_direction} (${model.growth_rate_pct}%)</div>
          </div>
          <div class="kpi">
            <div>Model Accuracy (R²)</div>
            <div class="kpi-val">${model.r2_score} (MAPE: ${model.mape}%)</div>
          </div>
          <div class="kpi">
            <div>Underperforming Items Identified</div>
            <div class="kpi-val" style="color: #f59e0b;">${underperformers.length} Items</div>
          </div>
        </div>

        <div class="card">
          <h2>🎯 Data Scientist Prescriptive Recommendations</h2>
          ${recommendations.map(r => `
            <div class="rec-box">
              <span class="tag">${r.priority}</span> <strong>${r.title}</strong>
              <p style="color: #94a3b8; margin: 8px 0;"><strong>Diagnostic:</strong> ${r.diagnostic_finding}</p>
              <p style="color: #e2e8f0; margin: 8px 0;"><strong>Action Plan:</strong> ${r.action_plan}</p>
              <p style="color: #10b981; margin: 8px 0;"><strong>Expected Lift:</strong> ${r.projected_lift} (Opportunity: ${r.estimated_recovery})</p>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <h2>⚠️ Low-Performing Items & Opportunity Diagnostics</h2>
          <table>
            <thead>
              <tr><th>Item Name</th><th>Total ${forecastResult.selected_columns.metric_column}</th><th>Market Share</th><th>Revenue Opportunity Gap</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${underperformers.map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td>$${item.total_metric?.toLocaleString()}</td>
                  <td>${item.market_share_pct}%</td>
                  <td style="color: #f59e0b;">$${item.revenue_gap?.toLocaleString()}</td>
                  <td><span style="color: ${item.badge_color}; font-weight: bold;">${item.severity}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DataForge_Predictive_Report_${forecastResult.table_name}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const handleExportPptx = async () => {
    if (!forecastResult) return;
    setIsExportingPptx(true);
    try {
      await exportPowerPointDeck({
        table_name: forecastResult.table_name,
        metric_name: forecastResult.selected_columns?.metric_column || 'Metric',
        model_summary: forecastResult.model_summary,
        top_performing_items: forecastResult.top_performing_items,
        underperforming_items: forecastResult.underperforming_items,
        client_recommendations: forecastResult.client_recommendations,
        historical_points: forecastResult.historical_data,
        forecast_points: forecastResult.forecast_data
      });
    } catch (err) {
      setError(err.message || 'Failed to generate PowerPoint deck');
    } finally {
      setIsExportingPptx(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        borderRadius: '1.25rem',
        padding: '2.25rem',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          position: 'absolute',
          top: '-80px',
          right: '-60px',
          width: '320px',
          height: '320px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.05) 70%, transparent 100%)',
          borderRadius: '50%',
          filter: 'blur(30px)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '780px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(99, 102, 241, 0.25)', border: '1px solid rgba(165, 180, 252, 0.3)', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, color: '#c7d2fe', marginBottom: '1rem', backdropFilter: 'blur(8px)' }}>
              <BrainCircuit size={15} style={{ color: '#818cf8' }} />
              AutoML & Time-Series Data Science Engine
            </div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', fontWeight: 800, margin: '0 0 0.75rem 0', letterSpacing: '-0.025em', background: 'linear-gradient(to right, #ffffff, #e0e7ff, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AI Predictive Studio & Optimization
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>
              Anticipate future demand trends with 95% confidence intervals, isolate low-performing items dragging down margins, and implement empirical data science strategies to optimize client performance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportPptx}
              disabled={!forecastResult || isExportingPptx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.75rem 1.25rem',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                border: 'none',
                borderRadius: '0.75rem',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: forecastResult ? 'pointer' : 'not-allowed',
                opacity: forecastResult ? 1 : 0.5,
                boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              <Download size={16} />
              {isExportingPptx ? 'Generating Slides...' : 'Download PPTX Deck'}
            </button>

            <button
              onClick={handleExportStrategyReport}
              disabled={!forecastResult}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.75rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '0.75rem',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: forecastResult ? 'pointer' : 'not-allowed',
                opacity: forecastResult ? 1 : 0.5,
                transition: 'all 0.2s',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => forecastResult && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)')}
              onMouseLeave={(e) => forecastResult && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
            >
              <Download size={16} />
              Export Executive HTML
            </button>
          </div>
        </div>
      </div>

      {/* Control Configuration Bar */}
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.25rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          {/* Table Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Dataset Table
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                style={{
                  padding: '0.55rem 2rem 0.55rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  background: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  minWidth: '180px',
                  cursor: 'pointer'
                }}
              >
                {tables.map(t => (
                  <option key={t.table_name} value={t.table_name}>
                    {t.table_name} ({t.row_count} rows)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metric Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Forecast Metric
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              disabled={isCandidatesLoading || !candidates?.candidate_metrics?.length}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                background: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#1e293b',
                minWidth: '160px',
                cursor: 'pointer'
              }}
            >
              {(candidates?.candidate_metrics || []).map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Timeline / Date Column
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                background: 'white',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1e293b',
                minWidth: '160px',
                cursor: 'pointer'
              }}
            >
              <option value="">Auto Sequential</option>
              {(candidates?.candidate_dates || []).map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Item / Product Grouping Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Item / Entity Diagnostic
            </label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                background: 'white',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1e293b',
                minWidth: '160px',
                cursor: 'pointer'
              }}
            >
              {(candidates?.candidate_items || []).map(it => (
                <option key={it} value={it}>
                  {it}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Forecast Horizon Selector & Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Forecast Horizon
            </label>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              {[30, 60, 90].map(p => (
                <button
                  key={p}
                  onClick={() => setHorizon(p)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    background: horizon === p ? '#4f46e5' : 'transparent',
                    color: horizon === p ? 'white' : '#64748b',
                    transition: 'all 0.15s'
                  }}
                >
                  +{p}d
                </button>
              ))}
            </div>
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button
              onClick={handleRunForecast}
              disabled={isLoading || !selectedTable || !selectedMetric}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? 'Fitting Model...' : 'Run Forecast'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#991b1b',
          fontSize: '0.9rem'
        }}>
          <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Studio Mode Selector */}
      <div style={{
        display: 'flex',
        background: '#f1f5f9',
        padding: '4px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        width: 'fit-content',
        gap: '6px'
      }}>
        <button
          onClick={() => setStudioMode('forecast')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '9px',
            border: 'none',
            background: studioMode === 'forecast' ? '#ffffff' : 'transparent',
            color: studioMode === 'forecast' ? '#4f46e5' : '#64748b',
            fontWeight: '700',
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: studioMode === 'forecast' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.15s'
          }}
        >
          <TrendingUp size={16} />
          <span>AutoML Forecasting & Diagnostics</span>
        </button>
        <button
          onClick={() => setStudioMode('simulator')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '9px',
            border: 'none',
            background: studioMode === 'simulator' ? '#ffffff' : 'transparent',
            color: studioMode === 'simulator' ? '#4f46e5' : '#64748b',
            fontWeight: '700',
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: studioMode === 'simulator' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.15s'
          }}
        >
          <Sliders size={16} />
          <span>Digital Twin Monte Carlo Simulator</span>
          <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
            PRO
          </span>
        </button>
      </div>

      {/* Simulator Mode View */}
      {studioMode === 'simulator' && (
        <DigitalTwinSimulator
          selectedTable={selectedTable}
          selectedMetric={selectedMetric}
          candidates={candidates}
        />
      )}

      {/* Forecast Mode View */}
      {studioMode === 'forecast' && (
        <>
          {/* KPI Highlights Bar */}
          {forecastResult && horizonStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {/* Card 1: Growth Trajectory */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Forecast Trajectory</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: Number(horizonStats.projectedGrowthPct) >= 0 ? '#dcfce7' : '#fee2e2',
                color: Number(horizonStats.projectedGrowthPct) >= 0 ? '#15803d' : '#b91c1c'
              }}>
                {Number(horizonStats.projectedGrowthPct) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {horizonStats.projectedGrowthPct}%
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
              {forecastResult.model_summary.trend_direction}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Based on historical momentum & polynomial curve fit
            </div>
          </div>

          {/* Card 2: Horizon Total */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>+{horizon}-Day Cumulative Forecast</span>
              <DollarSign size={16} style={{ color: '#4f46e5' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4f46e5', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
              {formatNumber(horizonStats.totalProjected)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Avg ~{formatNumber(horizonStats.avgDailyProjected)} per period
            </div>
          </div>

          {/* Card 3: Model Accuracy */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Statistical Model Fit</span>
              <ShieldCheck size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
              R² = {forecastResult.model_summary.r2_score}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              MAPE Error: <strong style={{ color: '#10b981' }}>{forecastResult.model_summary.mape}%</strong> (High Reliability)
            </div>
          </div>

          {/* Card 4: Opportunity Gap */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Lagging Items Opportunity</span>
              <Target size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
              {formatNumber(forecastResult.item_diagnostic_summary?.total_revenue_opportunity || 0)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {forecastResult.underperforming_items?.length || 0} lagging items flagged for intervention
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Forecast Visualizer Card */}
      {forecastResult && (
        <div style={{
          background: 'white',
          borderRadius: '1.25rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-md)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {/* Chart Header & Interactive Slider */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={20} style={{ color: '#4f46e5' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Dynamic Forecast Curve & 95% Confidence Corridor
                </h2>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Solid indigo curve: historical values. Neon cyan dashed: projected horizon (+{horizon} steps). Shaded: 95% confidence bounds.
              </p>
            </div>

            {/* What-If Simulation Slider */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '0.75rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sliders size={16} style={{ color: '#6366f1' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                  What-If Lift Simulation:
                </span>
              </div>
              <input
                type="range"
                min="-20"
                max="40"
                step="5"
                value={simulatedLift}
                onChange={(e) => setSimulatedLift(Number(e.target.value))}
                style={{ width: '130px', accentColor: '#4f46e5', cursor: 'pointer' }}
              />
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: simulatedLift > 0 ? '#10b981' : simulatedLift < 0 ? '#ef4444' : '#64748b',
                minWidth: '45px'
              }}>
                {simulatedLift > 0 ? `+${simulatedLift}%` : `${simulatedLift}%`}
              </span>
              {simulatedLift !== 0 && (
                <button
                  onClick={() => setSimulatedLift(0)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.75rem',
                    color: '#6366f1',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* SVG Animated Forecast Chart Canvas */}
          <div style={{ width: '100%', height: '360px', position: 'relative', background: '#0b0f19', borderRadius: '1rem', padding: '1.5rem', overflow: 'hidden', border: '1px solid #1e293b' }}>
            {/* Background Grid Pattern */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none'
            }} />

            {/* SVG Render */}
            <svg
              viewBox="0 0 1000 300"
              preserveAspectRatio="none"
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                {/* Confidence Corridor Gradient */}
                <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.03" />
                </linearGradient>

                {/* Line Glow Filter */}
                <filter id="glowForecast" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Render Chart Paths if Points Exist */}
              {(() => {
                const { points, minVal, maxVal, histCount } = chartData;
                if (!points.length) return null;

                const getX = (i) => (i / (points.length - 1)) * 960 + 20;
                const getY = (val) => 280 - ((val - minVal) / (maxVal - minVal || 1)) * 250;

                // 1. Shaded Confidence Corridor (Forecast range only)
                const forePoints = points.filter(p => p.type === 'forecast');
                if (forePoints.length > 0) {
                  const upperPath = forePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.index)} ${getY(p.upper_bound)}`).join(' ');
                  const lowerPath = forePoints.slice().reverse().map((p) => `L ${getX(p.index)} ${getY(p.lower_bound)}`).join(' ');
                  const corridorD = `${upperPath} ${lowerPath} Z`;

                  return (
                    <g>
                      <path d={corridorD} fill="url(#confidenceGradient)" />
                      {/* Vertical separator line at forecast boundary */}
                      <line
                        x1={getX(histCount - 1)}
                        y1="15"
                        x2={getX(histCount - 1)}
                        y2="285"
                        stroke="#64748b"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                      />
                      <text
                        x={getX(histCount - 1) + 8}
                        y="30"
                        fill="#38bdf8"
                        fontSize="10"
                        fontWeight="700"
                        letterSpacing="0.05em"
                      >
                        FORECAST STARTS
                      </text>
                    </g>
                  );
                }
                return null;
              })()}

              {/* 2. Historical Actuals Line */}
              {(() => {
                const { points, minVal, maxVal, histCount } = chartData;
                if (!points.length) return null;

                const getX = (i) => (i / (points.length - 1)) * 960 + 20;
                const getY = (val) => 280 - ((val - minVal) / (maxVal - minVal || 1)) * 250;

                const histPoints = points.slice(0, histCount);
                if (histPoints.length < 2) return null;

                const histD = histPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.displayVal)}`).join(' ');

                return (
                  <path
                    d={histD}
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })()}

              {/* 3. Future Forecast Projection Line (Dashed & Glowing) */}
              {(() => {
                const { points, minVal, maxVal, histCount } = chartData;
                if (!points.length) return null;

                const getX = (i) => (i / (points.length - 1)) * 960 + 20;
                const getY = (val) => 280 - ((val - minVal) / (maxVal - minVal || 1)) * 250;

                // Bridge historical end point with first forecast point
                const forePoints = points.slice(Math.max(0, histCount - 1));
                if (forePoints.length < 2) return null;

                const foreD = forePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.index)} ${getY(p.displayVal)}`).join(' ');

                return (
                  <path
                    d={foreD}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3.5"
                    strokeDasharray="6,4"
                    strokeLinecap="round"
                    filter="url(#glowForecast)"
                  />
                );
              })()}

              {/* 4. Interactive Hover Points */}
              {(() => {
                const { points, minVal, maxVal } = chartData;
                const getX = (i) => (i / (points.length - 1)) * 960 + 20;
                const getY = (val) => 280 - ((val - minVal) / (maxVal - minVal || 1)) * 250;

                return points.map((p, i) => (
                  <circle
                    key={i}
                    cx={getX(i)}
                    cy={getY(p.displayVal)}
                    r={hoveredPoint?.index === i ? 6 : 2.5}
                    fill={p.type === 'forecast' ? '#38bdf8' : '#a5b4fc'}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                    style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ));
              })()}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && (
              <div style={{
                position: 'absolute',
                top: '20px',
                right: '25px',
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid #334155',
                borderRadius: '0.625rem',
                padding: '10px 16px',
                color: 'white',
                fontSize: '0.85rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                zIndex: 10,
                pointerEvents: 'none'
              }}>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '4px' }}>
                  {hoveredPoint.date} • <strong style={{ color: hoveredPoint.type === 'forecast' ? '#38bdf8' : '#818cf8' }}>{hoveredPoint.type.toUpperCase()}</strong>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: hoveredPoint.type === 'forecast' ? '#38bdf8' : '#ffffff' }}>
                  Value: {formatNumber(hoveredPoint.displayVal)}
                </div>
                {hoveredPoint.type === 'forecast' && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    95% Band: [{formatNumber(hoveredPoint.lower_bound)} — {formatNumber(hoveredPoint.upper_bound)}]
                  </div>
                )}
              </div>
            )}

            {/* Legend Overlay */}
            <div style={{
              position: 'absolute',
              bottom: '15px',
              left: '20px',
              display: 'flex',
              gap: '1.25rem',
              alignItems: 'center',
              fontSize: '0.75rem',
              color: '#94a3b8',
              background: 'rgba(15, 23, 42, 0.75)',
              padding: '6px 14px',
              borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', background: '#818cf8', borderRadius: '2px' }} />
                <span>Historical Actuals</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', background: '#38bdf8', borderRadius: '2px', borderTop: '1px dashed #38bdf8' }} />
                <span>Projected Trend ({horizon}d)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '8px', background: 'rgba(56, 189, 248, 0.3)', borderRadius: '2px' }} />
                <span>95% Confidence Interval</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-Column Diagnostic & Client Recommendations Section */}
      {forecastResult && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
          
          {/* Column 1: Low-Performing Items Diagnostic */}
          <div style={{
            background: 'white',
            borderRadius: '1.25rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Low-Performing Items Diagnostic
                  </h3>
                </div>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Items trapped in lagging demand or low market share needing client action.
                </p>
              </div>

              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '9999px',
                background: '#fee2e2',
                color: '#b91c1c'
              }}>
                {forecastResult.underperforming_items?.length || 0} Lagging Items
              </span>
            </div>

            {/* Items Table / Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
              {(forecastResult.underperforming_items || []).slice(0, 8).map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '0.75rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
                >
                  <div style={{ maxWidth: '65%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: item.badge_color
                      }} />
                      <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                        {item.name}
                      </strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Share: <strong>{item.market_share_pct}%</strong> • Transactions: <strong>{item.volume_count}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                      ${formatNumber(item.total_metric)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                      -${formatNumber(item.revenue_gap)} Gap
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Data Scientist Client Prescriptive Recommendations */}
          <div style={{
            background: 'white',
            borderRadius: '1.25rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} style={{ color: '#4f46e5' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Prescriptive Action Suggestions for Client
                  </h3>
                </div>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Actionable, empirical recommendations to boost low-performing items into top revenue drivers.
                </p>
              </div>

              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '9999px',
                background: '#e0e7ff',
                color: '#4338ca'
              }}>
                Strategic Roadmap
              </span>
            </div>

            {/* Recommendation Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', overflowY: 'auto' }}>
              {(forecastResult.client_recommendations || []).map((rec, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1.25rem',
                    background: '#ffffff',
                    borderRadius: '0.875rem',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${rec.priority_level === 1 ? '#ef4444' : rec.priority_level === 2 ? '#f59e0b' : '#4f46e5'}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: rec.priority_level === 1 ? '#fee2e2' : rec.priority_level === 2 ? '#fef3c7' : '#e0e7ff',
                      color: rec.priority_level === 1 ? '#b91c1c' : rec.priority_level === 2 ? '#b45309' : '#4338ca',
                      textTransform: 'uppercase'
                    }}>
                      {rec.priority}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>
                      {rec.projected_lift}
                    </span>
                  </div>

                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                    {rec.title}
                  </strong>

                  <p style={{ margin: 0, fontSize: '0.825rem', color: '#475569', lineHeight: 1.5 }}>
                    {rec.action_plan}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem', color: '#64748b' }}>
                    <span>Target: <strong>{rec.target_item}</strong></span>
                    <span style={{ color: '#059669', fontWeight: 700 }}>
                      Recovery: {rec.estimated_recovery}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
