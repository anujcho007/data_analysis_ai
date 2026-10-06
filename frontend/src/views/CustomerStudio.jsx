import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  Award, 
  TrendingUp, 
  Sparkles, 
  RefreshCw, 
  Calendar, 
  DollarSign, 
  Clock, 
  ArrowUpRight, 
  Download, 
  Search, 
  ChevronRight, 
  Filter, 
  Layers, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  Sliders,
  HelpCircle
} from 'lucide-react';
import { fetchCustomerCandidates, fetchRFMAnalysis, fetchCohortRetention } from '../api/client';

export default function CustomerStudio({ tables = [] }) {
  // Table & Column State
  const [selectedTable, setSelectedTable] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [customerCol, setCustomerCol] = useState('');
  const [dateCol, setDateCol] = useState('');
  const [monetaryCol, setMonetaryCol] = useState('');
  const [sampleLimit, setSampleLimit] = useState(100000);

  // Studio Mode: 'rfm' | 'cohorts' | 'customers'
  const [activeMode, setActiveMode] = useState('rfm');

  // Analysis Results State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rfmData, setRfmData] = useState(null);
  const [cohortData, setCohortData] = useState(null);

  // Profile Filtering State
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-select initial table
  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTable) {
      // Prefer table named 'orders' or fact tables
      const orderTable = tables.find(t => t.table_name.toLowerCase().includes('order'));
      const factTable = tables.find(t => t.table_type === 'fact');
      const target = orderTable || factTable || tables[0];
      setSelectedTable(target.table_name);
    }
  }, [tables, selectedTable]);

  // Load column candidates when table changes
  useEffect(() => {
    if (!selectedTable) return;

    let isMounted = true;
    const loadCandidates = async () => {
      try {
        const res = await fetchCustomerCandidates(selectedTable);
        if (!isMounted) return;
        setCandidates(res);
        if (res.detected) {
          setCustomerCol(res.detected.customer_column || '');
          setDateCol(res.detected.date_column || '');
          setMonetaryCol(res.detected.monetary_column || '');
        }
      } catch (err) {
        console.warn('Failed to load candidate columns:', err);
      }
    };
    loadCandidates();
    return () => { isMounted = false; };
  }, [selectedTable]);

  // Auto-run analysis when columns are resolved
  useEffect(() => {
    if (selectedTable && customerCol && dateCol && monetaryCol && !rfmData) {
      runAnalysis();
    }
  }, [selectedTable, customerCol, dateCol, monetaryCol]);

  const runAnalysis = async () => {
    if (!selectedTable || !customerCol || !dateCol || !monetaryCol) {
      setError('Please select a valid table, customer ID column, date column, and revenue column.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [rfmRes, cohortRes] = await Promise.all([
        fetchRFMAnalysis({
          table_name: selectedTable,
          customer_column: customerCol,
          date_column: dateCol,
          monetary_column: monetaryCol,
          sample_limit: sampleLimit
        }),
        fetchCohortRetention({
          table_name: selectedTable,
          customer_column: customerCol,
          date_column: dateCol,
          sample_limit: sampleLimit
        }).catch(err => {
          console.warn('Cohort analysis notice:', err);
          return null;
        })
      ]);

      setRfmData(rfmRes);
      setCohortData(cohortRes);
    } catch (err) {
      console.error('Customer 360 Analysis Error:', err);
      setError(err.message || 'Analysis failed to execute.');
    } finally {
      setIsLoading(false);
    }
  };

  // Export filtered customer list to CSV
  const handleExportCSV = () => {
    if (!rfmData || !rfmData.customer_profiles) return;
    const profiles = filteredProfiles;
    if (profiles.length === 0) return;

    const headers = ['Customer ID', 'Segment', 'RFM Score', 'Recency (Days)', 'Order Count', 'Total Spend', 'Avg Order Value', 'Last Active'];
    const rows = profiles.map(p => [
      p.customer_id,
      p.segment,
      p.rfm_score,
      p.recency_days,
      p.frequency,
      p.total_spend,
      p.avg_order_value,
      p.last_active
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customer_360_${selectedSegmentFilter.toLowerCase()}_segment.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter profiles based on segment and search
  const filteredProfiles = (rfmData?.customer_profiles || []).filter(p => {
    const matchesSegment = selectedSegmentFilter === 'ALL' || p.segment === selectedSegmentFilter;
    const matchesSearch = !searchQuery.trim() || p.customer_id.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesSegment && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* Top Header Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        padding: '24px 28px',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px -4px rgba(13, 148, 136, 0.35)',
            color: '#ffffff',
            flexShrink: 0
          }}>
            <UserCheck size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Customer 360 & Growth Intelligence
              </h1>
              <span style={{
                background: '#ccfbf1',
                color: '#0f766e',
                fontSize: '0.72rem',
                fontWeight: '700',
                padding: '3px 10px',
                borderRadius: '9999px',
                border: '1px solid #99f6e4'
              }}>
                RFM & Retention Engine
              </span>
            </div>
            <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0 0' }}>
              Automated behavioral customer segmentation, cohort retention heatmaps, and high-value audience export
            </p>
          </div>
        </div>

        {/* View Switcher Pills */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '12px',
          gap: '4px'
        }}>
          <button
            onClick={() => setActiveMode('rfm')}
            style={{
              padding: '8px 16px',
              borderRadius: '9px',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeMode === 'rfm' ? '#ffffff' : 'transparent',
              color: activeMode === 'rfm' ? '#0f172a' : '#64748b',
              boxShadow: activeMode === 'rfm' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            🎯 RFM Behavioral Segments
          </button>
          <button
            onClick={() => setActiveMode('cohorts')}
            style={{
              padding: '8px 16px',
              borderRadius: '9px',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeMode === 'cohorts' ? '#ffffff' : 'transparent',
              color: activeMode === 'cohorts' ? '#0f172a' : '#64748b',
              boxShadow: activeMode === 'cohorts' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            🗓️ Cohort Retention Heatmap
          </button>
          <button
            onClick={() => setActiveMode('customers')}
            style={{
              padding: '8px 16px',
              borderRadius: '9px',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeMode === 'customers' ? '#ffffff' : 'transparent',
              color: activeMode === 'customers' ? '#0f172a' : '#64748b',
              boxShadow: activeMode === 'customers' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            👥 Audience Directory
          </button>
        </div>
      </div>

      {/* Dataset & Column Controls Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '18px 24px',
        boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Table Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '170px' }}>
          <label style={{ fontSize: '0.74rem', fontWeight: '700', color: '#475569' }}>
            Transactions Table
          </label>
          <select
            value={selectedTable}
            onChange={(e) => {
              setSelectedTable(e.target.value);
              setRfmData(null);
            }}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.84rem',
              fontWeight: '600',
              color: '#0f172a',
              background: '#f8fafc',
              outline: 'none'
            }}
          >
            {tables.map(t => (
              <option key={t.table_name} value={t.table_name}>
                {t.table_name} ({t.row_count?.toLocaleString()} rows)
              </option>
            ))}
          </select>
        </div>

        {/* Customer Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '0.74rem', fontWeight: '700', color: '#475569' }}>
            Customer ID Column
          </label>
          <select
            value={customerCol}
            onChange={(e) => setCustomerCol(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.84rem',
              fontWeight: '600',
              color: '#0f172a',
              background: '#f8fafc',
              outline: 'none'
            }}
          >
            {(candidates?.available_columns || []).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Date Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '0.74rem', fontWeight: '700', color: '#475569' }}>
            Purchase Date Column
          </label>
          <select
            value={dateCol}
            onChange={(e) => setDateCol(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.84rem',
              fontWeight: '600',
              color: '#0f172a',
              background: '#f8fafc',
              outline: 'none'
            }}
          >
            {(candidates?.available_columns || []).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Monetary Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '0.74rem', fontWeight: '700', color: '#475569' }}>
            Spend / Revenue Column
          </label>
          <select
            value={monetaryCol}
            onChange={(e) => setMonetaryCol(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.84rem',
              fontWeight: '600',
              color: '#0f172a',
              background: '#f8fafc',
              outline: 'none'
            }}
          >
            {(candidates?.available_columns || []).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Run Button */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
          <button
            onClick={runAnalysis}
            disabled={isLoading}
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px -2px rgba(13, 148, 136, 0.35)',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={15} className={isLoading ? 'spinner' : ''} />
            <span>{isLoading ? 'Computing Segments...' : 'Recalculate RFM'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '14px',
          padding: '14px 20px',
          color: '#b91c1c',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertTriangle size={20} />
          <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>{error}</span>
        </div>
      )}

      {/* KPI Stat Cards Banner */}
      {rfmData && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          {/* Total Unique Customers */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Unique Customer Base
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
              {rfmData.total_customers?.toLocaleString()}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: '600' }}>
              Snapshot as of {rfmData.snapshot_date}
            </span>
          </div>

          {/* Repeat Purchase Rate */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Repeat Customer Rate
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0284c7' }}>
              {rfmData.repeat_purchase_rate_pct}%
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {rfmData.repeat_customer_count?.toLocaleString()} repeat buyers (&gt;1 order)
            </span>
          </div>

          {/* Average Customer Lifetime Spend */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Avg Customer Spend (LTV)
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0d9488' }}>
              ${rfmData.avg_customer_value?.toLocaleString()}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Total analyzed spend: ${rfmData.total_revenue?.toLocaleString()}
            </span>
          </div>

          {/* Top Segment Revenue Contribution */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Top Revenue Driver
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: rfmData.segments?.[0]?.color || '#0f172a' }}>
              {rfmData.segments?.[0]?.segment || 'Champions'}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Drives {rfmData.segments?.[0]?.revenue_share_pct}% of total revenue
            </span>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 1: RFM BEHAVIORAL SEGMENTS                                 */}
      {/* ============================================================== */}
      {activeMode === 'rfm' && rfmData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section Heading & Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Strategic Customer Segments (RFM Model)
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
                Classified by Recency (days since purchase), Frequency (order count), and Monetary spend quintiles
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b' }}>
              Click any segment card to inspect filtered customer profiles
            </span>
          </div>

          {/* Segment Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '18px'
          }}>
            {(rfmData.segments || []).map((seg) => (
              <div
                key={seg.segment}
                onClick={() => {
                  setSelectedSegmentFilter(seg.segment);
                  setActiveMode('customers');
                }}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  padding: '22px',
                  boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderTop: `4px solid ${seg.color}`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px -4px rgba(15, 23, 42, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px -2px rgba(15, 23, 42, 0.04)';
                }}
              >
                {/* Card Top: Segment Name & Customer Share Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: seg.color
                    }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                      {seg.segment}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '3px 9px',
                    borderRadius: '9999px',
                    background: `${seg.color}18`,
                    color: seg.color
                  }}>
                    {seg.customer_share_pct}% of users
                  </span>
                </div>

                {/* Revenue Share Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Revenue Contribution:</span>
                    <span style={{ fontWeight: '800', color: '#0f172a' }}>
                      ${seg.revenue.toLocaleString()} ({seg.revenue_share_pct}%)
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: '#f1f5f9',
                    borderRadius: '9999px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(100, seg.revenue_share_pct)}%`,
                      height: '100%',
                      background: seg.color,
                      borderRadius: '9999px'
                    }} />
                  </div>
                </div>

                {/* Behavioral Averages */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  background: '#f8fafc',
                  padding: '10px',
                  borderRadius: '10px',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Avg Recency</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>{seg.avg_recency_days}d</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Avg Orders</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>{seg.avg_frequency}x</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Avg Spend</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>${seg.avg_monetary}</div>
                  </div>
                </div>

                {/* Strategic Action Recommendation */}
                <div style={{
                  fontSize: '0.78rem',
                  color: '#475569',
                  lineHeight: '1.4',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <Zap size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Playbook:</strong> {seg.recommendation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 2: COHORT RETENTION HEATMAP                                */}
      {/* ============================================================== */}
      {activeMode === 'cohorts' && cohortData && (
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '24px 28px',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Monthly Cohort Retention Matrix
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
              Tracks customer return rate (%) month-over-month from initial acquisition cohort (Month 0 to Month 12)
            </p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#334155' }}>Acquisition Cohort</th>
                  <th style={{ padding: '12px', fontWeight: '700', color: '#334155' }}>Initial Users</th>
                  {(cohortData.periods || []).map((p, i) => (
                    <th key={i} style={{ padding: '12px', fontWeight: '700', color: '#334155' }}>
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cohortData.cohorts || []).map((c, rIdx) => (
                  <tr key={c.cohort} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#0f172a' }}>
                      {c.cohort}
                    </td>
                    <td style={{ padding: '12px', fontWeight: '600', color: '#475569' }}>
                      {c.cohort_size.toLocaleString()}
                    </td>
                    {c.retention.map((val, cIdx) => {
                      if (val === null || val === undefined) {
                        return <td key={cIdx} style={{ padding: '10px', color: '#cbd5e1' }}>—</td>;
                      }

                      // Dynamic heatmap color intensity
                      let bg = '#f8fafc';
                      let textColor = '#475569';
                      if (val >= 80) { bg = '#1e1b4b'; textColor = '#ffffff'; }
                      else if (val >= 50) { bg = '#312e81'; textColor = '#ffffff'; }
                      else if (val >= 30) { bg = '#4338ca'; textColor = '#ffffff'; }
                      else if (val >= 20) { bg = '#6366f1'; textColor = '#ffffff'; }
                      else if (val >= 10) { bg = '#a5b4fc'; textColor = '#1e1b4b'; }
                      else if (val > 0) { bg = '#e0e7ff'; textColor = '#3730a3'; }

                      return (
                        <td
                          key={cIdx}
                          style={{
                            padding: '10px',
                            background: bg,
                            color: textColor,
                            fontWeight: '700',
                            transition: 'all 0.15s'
                          }}
                        >
                          {val}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            fontSize: '0.8rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontWeight: '700' }}>Retention Intensity:</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ width: '16px', height: '16px', background: '#e0e7ff', borderRadius: '4px' }} /> &lt;10%
              <span style={{ width: '16px', height: '16px', background: '#a5b4fc', borderRadius: '4px', marginLeft: '8px' }} /> 10-20%
              <span style={{ width: '16px', height: '16px', background: '#6366f1', borderRadius: '4px', marginLeft: '8px' }} /> 20-30%
              <span style={{ width: '16px', height: '16px', background: '#4338ca', borderRadius: '4px', marginLeft: '8px' }} /> 30-50%
              <span style={{ width: '16px', height: '16px', background: '#312e81', borderRadius: '4px', marginLeft: '8px' }} /> &gt;50%
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 3: CUSTOMER AUDIENCE DIRECTORY & EXPORT                    */}
      {/* ============================================================== */}
      {activeMode === 'customers' && rfmData && (
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '24px 28px',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Controls: Search, Segment Filter & CSV Export */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Search Box */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '7px 12px'
              }}>
                <Search size={16} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search customer ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.84rem',
                    color: '#0f172a',
                    width: '180px'
                  }}
                />
              </div>

              {/* Segment Dropdown Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="#64748b" />
                <select
                  value={selectedSegmentFilter}
                  onChange={(e) => setSelectedSegmentFilter(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    color: '#0f172a',
                    background: '#f8fafc',
                    outline: 'none'
                  }}
                >
                  <option value="ALL">All Segments ({rfmData.customer_profiles?.length || 0})</option>
                  {(rfmData.segments || []).map(s => (
                    <option key={s.segment} value={s.segment}>{s.segment} ({s.customer_count})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '10px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.25)',
                transition: 'all 0.2s'
              }}
            >
              <Download size={15} />
              <span>Export Audience List to CSV</span>
            </button>
          </div>

          {/* Customer Records Table */}
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>Customer ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>Segment Badge</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>RFM Score</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>Recency</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>Orders</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>Total Spend</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>Avg Order Value</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                      No customers matched the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((p) => (
                    <tr key={p.customer_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>
                        {p.customer_id}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: '700',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          background: `${p.color}18`,
                          color: p.color
                        }}>
                          {p.segment}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#475569' }}>
                        {p.rfm_score}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {p.recency_days} days ago
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>
                        {p.frequency}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '800', color: '#0d9488' }}>
                        ${p.total_spend?.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        ${p.avg_order_value?.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {p.last_active}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
