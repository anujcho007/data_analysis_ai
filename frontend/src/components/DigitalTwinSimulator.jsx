import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Play, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  PieChart, 
  Sparkles, 
  Layers, 
  RefreshCw,
  Lightbulb,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { runDigitalTwinSimulation } from '../api/client';

export default function DigitalTwinSimulator({ selectedTable, selectedMetric, candidates }) {
  const [params, setParams] = useState({
    price_change_pct: 5.0,
    price_elasticity: -1.2,
    marketing_multiplier: 1.25,
    cost_inflation_pct: 2.0,
    churn_rate_pct: 1.0,
    horizon_days: 60,
    mc_iterations: 100
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [simResult, setSimResult] = useState(null);

  const handleSimulate = async () => {
    if (!selectedTable || !selectedMetric) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await runDigitalTwinSimulation({
        table_name: selectedTable,
        metric_column: selectedMetric,
        date_column: candidates?.recommended_date || null,
        price_change_pct: parseFloat(params.price_change_pct),
        price_elasticity: parseFloat(params.price_elasticity),
        marketing_multiplier: parseFloat(params.marketing_multiplier),
        cost_inflation_pct: parseFloat(params.cost_inflation_pct),
        churn_rate_pct: parseFloat(params.churn_rate_pct),
        horizon_days: parseInt(params.horizon_days, 10),
        mc_iterations: parseInt(params.mc_iterations, 10)
      });
      setSimResult(res);
    } catch (err) {
      setError(err.message || 'Simulation execution failed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTable && selectedMetric) {
      handleSimulate();
    }
  }, [selectedTable, selectedMetric]);

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '$0.00';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '+';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    return `${sign}$${abs.toFixed(2)}`;
  };

  // Trajectory SVG calculations
  const trajectories = simResult?.trajectories || [];
  const maxVal = trajectories.length 
    ? Math.max(...trajectories.map(t => Math.max(t.baseline, t.simulated, t.p90_optimistic || 0))) * 1.15 
    : 100;
  const minVal = 0;

  const getSvgX = (day, total) => 40 + ((day - 1) / Math.max(1, total - 1)) * 880;
  const getSvgY = (v) => 240 - ((v - minVal) / Math.max(1, maxVal - minVal)) * 200;

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '20px',
      border: '1px solid #e2e8f0',
      padding: '24px',
      boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Simulator Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#e0e7ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sliders size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
              Digital Twin Economic Simulator (Monte Carlo)
            </h3>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Simulate price elasticity, ad spend scaling, cost inflation, and churn risk with 100 stochastic probabilistic paths.
          </p>
        </div>

        <button
          onClick={handleSimulate}
          disabled={isLoading || !selectedTable || !selectedMetric}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '0.875rem'
          }}
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>{isLoading ? 'Running Monte Carlo...' : 'Run Simulation'}</span>
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          fontSize: '0.85rem',
          fontWeight: '600'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Levers Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        padding: '18px',
        background: '#f8fafc',
        borderRadius: '14px',
        border: '1px solid #e2e8f0'
      }}>
        {/* Lever 1: Price Change % */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569' }}>Price Adjustment</span>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: params.price_change_pct >= 0 ? '#10b981' : '#ef4444' }}>
              {params.price_change_pct > 0 ? `+${params.price_change_pct}%` : `${params.price_change_pct}%`}
            </span>
          </div>
          <input
            type="range"
            min="-30"
            max="30"
            step="1"
            value={params.price_change_pct}
            onChange={(e) => setParams(prev => ({ ...prev, price_change_pct: parseFloat(e.target.value) }))}
            style={{ width: '100%', accentColor: '#4f46e5' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
            <span>-30% Discount</span>
            <span>+30% Premium</span>
          </div>
        </div>

        {/* Lever 2: Price Elasticity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569' }}>Price Elasticity</span>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#4f46e5' }}>
              {params.price_elasticity.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="-2.5"
            max="-0.5"
            step="0.1"
            value={params.price_elasticity}
            onChange={(e) => setParams(prev => ({ ...prev, price_elasticity: parseFloat(e.target.value) }))}
            style={{ width: '100%', accentColor: '#4f46e5' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
            <span>-2.5 (Highly Elastic)</span>
            <span>-0.5 (Inelastic)</span>
          </div>
        </div>

        {/* Lever 3: Marketing Budget Multiplier */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569' }}>Marketing Budget</span>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#4f46e5' }}>
              {params.marketing_multiplier.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.05"
            value={params.marketing_multiplier}
            onChange={(e) => setParams(prev => ({ ...prev, marketing_multiplier: parseFloat(e.target.value) }))}
            style={{ width: '100%', accentColor: '#4f46e5' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
            <span>0.5x Cut</span>
            <span>2.5x Aggressive</span>
          </div>
        </div>

        {/* Lever 4: Cost Inflation % */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569' }}>COGS / Cost Inflation</span>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: params.cost_inflation_pct > 0 ? '#ea580c' : '#10b981' }}>
              +{params.cost_inflation_pct}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="25"
            step="1"
            value={params.cost_inflation_pct}
            onChange={(e) => setParams(prev => ({ ...prev, cost_inflation_pct: parseFloat(e.target.value) }))}
            style={{ width: '100%', accentColor: '#4f46e5' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
            <span>0% Stable</span>
            <span>+25% Severe</span>
          </div>
        </div>

        {/* Lever 5: Churn Drag */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Friction Churn</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: params.churn_rate_pct > 0 ? '#dc2626' : '#10b981' }}>
              +{params.churn_rate_pct}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            step="0.5"
            value={params.churn_rate_pct}
            onChange={(e) => setParams(prev => ({ ...prev, churn_rate_pct: parseFloat(e.target.value) }))}
            style={{ width: '100%', accentColor: '#4f46e5' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
            <span>0% Loyal</span>
            <span>+15% Attrition</span>
          </div>
        </div>

        {/* Lever 6: Horizon Days */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Horizon Projection</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4338ca' }}>
              {params.horizon_days} Days
            </span>
          </div>
          <select
            value={params.horizon_days}
            onChange={(e) => setParams(prev => ({ ...prev, horizon_days: parseInt(e.target.value, 10) }))}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <option value="30">30 Days (Tactical)</option>
            <option value="60">60 Days (Quarterly Mid)</option>
            <option value="90">90 Days (Full Quarter)</option>
            <option value="180">180 Days (Half-Year Strategic)</option>
          </select>
        </div>
      </div>

      {/* Simulation Scorecards */}
      {simResult?.scorecard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Card 1: Revenue Impact */}
          <div style={{
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            background: simResult.scorecard.projected_revenue_delta >= 0 ? '#f0fdf4' : '#fef2f2',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Projected Revenue Impact
            </div>
            <div style={{
              fontSize: '1.6rem',
              fontWeight: '900',
              color: simResult.scorecard.projected_revenue_delta >= 0 ? '#15803d' : '#b91c1c',
              marginTop: '4px'
            }}>
              {formatCurrency(simResult.scorecard.projected_revenue_delta)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', fontWeight: '600' }}>
              Shift: {simResult.scorecard.projected_revenue_delta_pct > 0 ? `+${simResult.scorecard.projected_revenue_delta_pct}%` : `${simResult.scorecard.projected_revenue_delta_pct}%`}
            </div>
          </div>

          {/* Card 2: Net Profit Impact */}
          <div style={{
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            background: simResult.scorecard.projected_profit_delta >= 0 ? '#f0fdf4' : '#fef2f2',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Projected Profit Impact
            </div>
            <div style={{
              fontSize: '1.6rem',
              fontWeight: '900',
              color: simResult.scorecard.projected_profit_delta >= 0 ? '#15803d' : '#b91c1c',
              marginTop: '4px'
            }}>
              {formatCurrency(simResult.scorecard.projected_profit_delta)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', fontWeight: '600' }}>
              Shift: {simResult.scorecard.projected_profit_delta_pct > 0 ? `+${simResult.scorecard.projected_profit_delta_pct}%` : `${simResult.scorecard.projected_profit_delta_pct}%`}
            </div>
          </div>

          {/* Card 3: Simulated Gross Margin */}
          <div style={{
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Simulated Gross Margin
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0f172a', marginTop: '4px' }}>
              {simResult.scorecard.simulated_gross_margin_pct}%
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
              Baseline: {simResult.scorecard.baseline_gross_margin_pct}%
            </div>
          </div>

          {/* Card 4: Volume Shift */}
          <div style={{
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Unit Volume Sensitivity
            </div>
            <div style={{
              fontSize: '1.6rem',
              fontWeight: '900',
              color: simResult.scorecard.volume_shift_pct >= 0 ? '#4f46e5' : '#ea580c',
              marginTop: '4px'
            }}>
              {simResult.scorecard.volume_shift_pct > 0 ? `+${simResult.scorecard.volume_shift_pct}%` : `${simResult.scorecard.volume_shift_pct}%`}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
              Combined demand effect
            </div>
          </div>
        </div>
      )}

      {/* Elasticity Verdict Banner */}
      {simResult?.scorecard?.elasticity_verdict && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          background: '#eef2ff',
          border: '1px solid #c7d2fe',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Sparkles size={20} color="#4f46e5" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem', color: '#312e81', fontWeight: '600' }}>
            <strong>Executive Verdict: </strong> {simResult.scorecard.elasticity_verdict}
          </div>
        </div>
      )}

      {/* Monte Carlo Trajectory SVG Chart */}
      {trajectories.length > 0 && (
        <div style={{
          background: '#0f172a',
          borderRadius: '16px',
          padding: '24px',
          color: '#ffffff'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '800', letterSpacing: '-0.01em' }}>
              Monte Carlo Probabilistic Trajectory (P10 - P90 Stochastic Envelope)
            </span>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '2px', background: '#94a3b8', borderTop: '2px dashed #94a3b8' }} />
                <span style={{ color: '#94a3b8' }}>Baseline</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', background: '#38bdf8' }} />
                <span style={{ color: '#38bdf8' }}>Simulated P50</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '8px', background: 'rgba(56, 189, 248, 0.25)', borderRadius: '2px' }} />
                <span style={{ color: '#bae6fd' }}>Monte Carlo 80% Corridor</span>
              </div>
            </div>
          </div>

          <svg viewBox="0 0 960 260" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <defs>
              <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => (
              <line
                key={idx}
                x1="40"
                y1={240 - frac * 200}
                x2="920"
                y2={240 - frac * 200}
                stroke="#1e293b"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            ))}

            {/* P10 - P90 Confidence Band */}
            {(() => {
              const upperPath = trajectories.map((t, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(t.day, trajectories.length)} ${getSvgY(t.p90_optimistic || t.simulated)}`).join(' ');
              const lowerPath = [...trajectories].reverse().map((t) => `L ${getSvgX(t.day, trajectories.length)} ${getSvgY(t.p10_pessimistic || t.simulated)}`).join(' ');
              return (
                <path
                  d={`${upperPath} ${lowerPath} Z`}
                  fill="rgba(56, 189, 248, 0.16)"
                />
              );
            })()}

            {/* Baseline Path */}
            <path
              d={trajectories.map((t, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(t.day, trajectories.length)} ${getSvgY(t.baseline)}`).join(' ')}
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeDasharray="5,4"
            />

            {/* Simulated Expected Path */}
            <path
              d={trajectories.map((t, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(t.day, trajectories.length)} ${getSvgY(t.simulated)}`).join(' ')}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {/* Strategic Scenario Recommendations */}
      {simResult?.recommendations && simResult.recommendations.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
            Prescriptive Scenario Recommendations
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {simResult.recommendations.map((rec, rIdx) => (
              <div
                key={rIdx}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: rec.priority === 'SUCCESS' ? '#f0fdf4' : rec.priority === 'HIGH' ? '#fef2f2' : '#fffbeb',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a' }}>
                    {rec.title}
                  </span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: rec.priority === 'SUCCESS' ? '#bbf7d0' : rec.priority === 'HIGH' ? '#fecaca' : '#fef08a',
                    color: rec.priority === 'SUCCESS' ? '#166534' : rec.priority === 'HIGH' ? '#991b1b' : '#854d0e'
                  }}>
                    {rec.priority}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                  {rec.advice}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
