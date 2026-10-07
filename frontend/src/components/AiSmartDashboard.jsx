import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Download, 
  Printer, 
  RefreshCw, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Layers, 
  Award, 
  CheckCircle2, 
  Lightbulb, 
  Bot, 
  Send, 
  Database,
  ArrowRight,
  FileDown,
  Info,
  Sliders,
  Calendar,
  Zap
} from 'lucide-react';
import { generateAiDashboard, downloadDashboardHtml, fetchCopilotPrompts } from '../api/client';

export default function AiSmartDashboard({ tables = [], setActiveTab }) {
  const [prompt, setPrompt] = useState('');
  const [focusTable, setFocusTable] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const loadingSteps = [
    'Scanning relational tables in warehouse...',
    'Analyzing numeric distributions & categorical concentrations...',
    'Detecting Star Schema links & cross-table metrics...',
    'Synthesizing executive briefing & KPIs...',
    'Generating interactive multi-chart visualizations...'
  ];

  // Dynamic data-driven prompt suggestions
  const [promptSuggestions, setPromptSuggestions] = useState([
    '🌟 Executive summary of all tables & key performance drivers',
    '💰 Metric trajectories, averages & distribution across categories',
    '🏆 Top performing entities, categories & leaderboards',
    '📅 Monthly volume velocity & temporal distribution'
  ]);

  // Load prompts dynamically according to uploaded tables & data distributions
  useEffect(() => {
    const loadDynamicSuggestions = async () => {
      try {
        const prompts = await fetchCopilotPrompts(focusTable || null);
        if (prompts && prompts.length > 0) {
          setPromptSuggestions(prompts.slice(0, 5));
        }
      } catch (err) {
        console.warn('Failed to load dashboard dynamic prompts:', err);
      }
    };
    if (tables.length > 0) {
      loadDynamicSuggestions();
    }
  }, [focusTable, tables.length]);

  // Initial auto-generation if tables exist and no dashboard is present yet
  useEffect(() => {
    if (tables.length > 0 && !dashboardData && !isGenerating) {
      handleGenerate();
    }
  }, [tables.length]);

  // Handle generation cycle
  const handleGenerate = async (customPrompt = prompt) => {
    if (tables.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
    }, 600);

    try {
      const data = await generateAiDashboard(customPrompt, focusTable || null);
      setDashboardData(data);
    } catch (err) {
      setError(err.message || 'Failed to generate AI Dashboard');
    } finally {
      clearInterval(stepInterval);
      setIsGenerating(false);
    }
  };

  // Download interactive HTML dashboard
  const handleDownload = async () => {
    if (!dashboardData) return;
    setIsDownloading(true);
    try {
      await downloadDashboardHtml(dashboardData);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Format numbers cleanly
  const formatCompact = (val) => {
    if (val === null || val === undefined) return '0';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (abs >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (abs >= 10_000) return (num / 1_000).toFixed(1) + 'K';
    if (Number.isInteger(num)) return num.toLocaleString();
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // Render icon based on KPI type
  const renderKpiIcon = (iconType) => {
    switch (iconType) {
      case 'dollar':
        return <DollarSign size={20} color="#059669" />;
      case 'activity':
        return <Activity size={20} color="#4f46e5" />;
      case 'trending-up':
        return <TrendingUp size={20} color="#0284c7" />;
      case 'layers':
        return <Layers size={20} color="#7c3aed" />;
      case 'award':
        return <Award size={20} color="#d97706" />;
      default:
        return <Activity size={20} color="#4f46e5" />;
    }
  };

  if (tables.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#e0e7ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <Sparkles size={32} color="#4f46e5" />
        </div>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Warehouse is Empty</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
          Upload your CSV datasets first. Once uploaded, DataForge AI will automatically analyze all columns, relationships, and metrics to synthesize an executive dashboard.
        </p>
        <button 
          className="btn btn-primary" 
          onClick={() => setActiveTab && setActiveTab('upload')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <span>Go to Upload & Clean</span>
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* AI Dashboard Generator Header & Input Bar */}
      <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
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
              <Sparkles size={13} color="#4f46e5" />
              <span>Autonomous AI Data Analyst</span>
            </div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              AI Executive Dashboard Studio
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              One-click autonomous intelligence: AI reads every ingested table, extracts KPIs, detects trends, and generates an interactive, exportable dashboard.
            </p>
          </div>

          {/* Quick Actions if dashboard is ready */}
          {dashboardData && !isGenerating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => window.print()}
                title="Print or save as PDF"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
              >
                <Printer size={15} />
                <span>Print / Save PDF</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={handleDownload}
                disabled={isDownloading}
                title="Download complete offline interactive HTML report"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontSize: '0.85rem',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                }}
              >
                <FileDown size={16} />
                <span>{isDownloading ? 'Preparing HTML...' : 'Download Dashboard (.html)'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Prompt Input Form */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
          style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div style={{ flex: '1 1 320px', position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Custom focus (e.g., 'Focus on revenue trends, top customers, and payment methods')..."
              style={{
                width: '100%',
                paddingLeft: '38px',
                height: '44px',
                fontSize: '0.9rem'
              }}
            />
            <Bot size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
          </div>

          <div style={{ width: '200px' }}>
            <select
              className="input-field"
              value={focusTable}
              onChange={(e) => setFocusTable(e.target.value)}
              style={{ width: '100%', height: '44px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              <option value="">All Warehouse Tables</option>
              {tables.map(t => (
                <option key={t.id} value={t.table_name}>Focus: {t.table_name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isGenerating}
            style={{ 
              height: '44px', 
              padding: '0 22px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={16} className="spinner" />
                <span>Analyzing Data...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Generate AI Dashboard</span>
              </>
            )}
          </button>
        </form>

        {/* Suggestion Chips */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            Suggested Prompts:
          </span>
          {promptSuggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPrompt(s);
                handleGenerate(s);
              }}
              style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '9999px',
                padding: '4px 12px',
                fontSize: '0.75rem',
                color: '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e0e7ff';
                e.currentTarget.style.borderColor = '#c7d2fe';
                e.currentTarget.style.color = '#4338ca';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.color = '#334155';
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Loading Progress State */}
        {isGenerating && (
          <div style={{
            marginTop: '20px',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(2, 132, 199, 0.05) 100%)',
            border: '1px solid #c7d2fe',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Zap size={18} className="spinner" />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1e1b4b' }}>
                AI Synthesizing Executive Dashboard
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4338ca', transition: 'all 0.3s' }}>
                {loadingSteps[loadingStep]}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.875rem'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Render Generated AI Dashboard */}
      {dashboardData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Executive Overview & Briefing Card */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                    {dashboardData.title}
                  </h3>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {dashboardData.provider || 'DataForge AI'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {dashboardData.subtitle}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
                >
                  <Download size={14} />
                  <span>Download .html</span>
                </button>
              </div>
            </div>

            {/* Narrative Paragraph */}
            <p style={{
              fontSize: '0.95rem',
              lineHeight: '1.65',
              color: '#334155',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px'
            }}>
              {dashboardData.executive_summary}
            </p>

            {/* Key Findings and Recommendations Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '20px'
            }}>
              {/* Key Findings */}
              {dashboardData.key_findings?.length > 0 && (
                <div>
                  <h4 style={{
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    fontWeight: '700',
                    marginBottom: '10px'
                  }}>
                    Key Analytical Takeaways
                  </h4>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dashboardData.key_findings.map((f, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: '#1e293b' }}>
                        <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strategic Recommendations */}
              {dashboardData.recommendations?.length > 0 && (
                <div>
                  <h4 style={{
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    fontWeight: '700',
                    marginBottom: '10px'
                  }}>
                    Recommended Business Actions
                  </h4>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dashboardData.recommendations.map((r, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: '#1e293b' }}>
                        <Lightbulb size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* KPI Cards Grid */}
          {dashboardData.kpis?.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px'
            }}>
              {dashboardData.kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '130px'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: idx === 0 
                      ? 'linear-gradient(90deg, #4f46e5, #0284c7)' 
                      : (idx === 1 ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #0284c7, #38bdf8)')
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {kpi.label}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {kpi.badge || 'KPI'}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.9rem', fontWeight: '800', letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {kpi.formatted_value || formatCompact(kpi.value)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span style={{
                      fontWeight: '700',
                      color: kpi.trend === 'up' ? '#059669' : (kpi.trend === 'down' ? '#e11d48' : '#64748b')
                    }}>
                      {kpi.trend === 'up' ? '↗' : (kpi.trend === 'down' ? '↘' : '→')}
                    </span>
                    <span>{kpi.subtitle}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI-Generated Multi-Chart Grid */}
          {dashboardData.charts?.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: '20px'
            }}>
              {dashboardData.charts.map((chart, cIdx) => (
                <div key={chart.id || cIdx} className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {chart.title}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {chart.description}
                    </p>
                  </div>

                  {/* Render based on chart_type */}
                  {chart.chart_type === 'area' || chart.chart_type === 'line' ? (
                    <AiAreaChart data={chart.data} color={chart.color || '#4f46e5'} />
                  ) : chart.chart_type === 'donut' ? (
                    <AiDonutList data={chart.data} palette={chart.color_palette} />
                  ) : (
                    <AiRankingsList data={chart.data} color={chart.color || '#0284c7'} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Subcomponent: Native SVG Area Chart with Gradient & Interactive Tooltips
function AiAreaChart({ data = [], color = '#4f46e5' }) {
  const [hovered, setHovered] = useState(null);

  if (!data || data.length === 0) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No chart data</div>;
  }

  const width = 500;
  const height = 220;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const usableW = width - padL - padR;
  const usableH = height - padT - padB;

  const vals = data.map(d => Number(d.value || 0));
  const maxVal = Math.max(...vals, 1);

  const points = data.map((d, i) => {
    const x = padL + (i / Math.max(data.length - 1, 1)) * usableW;
    const norm = Math.max(0, Number(d.value || 0)) / maxVal;
    const y = height - padB - norm * usableH;
    return { ...d, x, y };
  });

  const pathD = `M ${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${padL + usableW},${height - padB} L ${padL},${height - padB} Z`;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="aiAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Baseline Grid */}
        <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="#e2e8f0" strokeDasharray="3 3" />
        <line x1={padL} y1={padT} x2={width - padR} y2={padT} stroke="#f1f5f9" strokeDasharray="3 3" />

        {/* Area fill */}
        <path d={areaD} fill="url(#aiAreaGrad)" />

        {/* Line stroke */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive points */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={hovered?.idx === idx ? 6 : 4}
            fill="#ffffff"
            stroke={color}
            strokeWidth={hovered?.idx === idx ? 3 : 2}
            style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
            onMouseEnter={() => setHovered({ ...p, idx })}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        {/* X Axis Labels */}
        {points.map((p, idx) => {
          if (data.length > 8 && idx % Math.ceil(data.length / 5) !== 0 && idx !== data.length - 1) return null;
          return (
            <text
              key={idx}
              x={p.x}
              y={height - 15}
              textAnchor="middle"
              fontSize="10"
              fill="#94a3b8"
              fontWeight="600"
            >
              {p.label}
            </text>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          left: `${(hovered.x / width) * 100}%`,
          top: `${(hovered.y / height) * 100}%`,
          transform: 'translate(-50%, -120%)',
          background: '#0f172a',
          color: '#ffffff',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: '600',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          whiteSpace: 'nowrap',
          zIndex: 10
        }}>
          <div>{hovered.label}</div>
          <div style={{ color: '#818cf8' }}>{Number(hovered.value).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Donut / Distribution Breakdown
function AiDonutList({ data = [], palette = ["#4f46e5", "#0284c7", "#059669", "#d97706", "#e11d48", "#7c3aed"] }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((acc, curr) => acc + Number(curr.value || 0), 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '8px' }}>
      {data.slice(0, 6).map((item, idx) => {
        const val = Number(item.value || 0);
        const pct = item.percentage !== undefined ? item.percentage : Math.round((val / total) * 100);
        const color = palette[idx % palette.length];

        return (
          <div key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
                {item.label}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {val.toLocaleString()} ({pct}%)
              </span>
            </div>
            <div style={{ background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Subcomponent: Ranked Leaderboards List
function AiRankingsList({ data = [], color = '#0284c7' }) {
  if (!data || data.length === 0) return null;
  const vals = data.map(d => Number(d.value || 0));
  const maxV = Math.max(...vals, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '6px' }}>
      {data.slice(0, 8).map((item, idx) => {
        const val = Number(item.value || 0);
        const pct = Math.round((val / maxV) * 100);

        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem' }}>
            <span style={{ width: '22px', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              #{idx + 1}
            </span>
            <span style={{ width: '130px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.label}
            </span>
            <div style={{ flex: 1, background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ width: '70px', textAlign: 'right', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {val.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
