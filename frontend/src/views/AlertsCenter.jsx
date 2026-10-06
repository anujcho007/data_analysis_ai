import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Send, 
  Plus, 
  RefreshCw, 
  Sliders, 
  Activity, 
  Zap, 
  Clock, 
  ExternalLink,
  HelpCircle,
  X
} from 'lucide-react';
import { 
  fetchAlertRules, 
  createAlertRule, 
  deleteAlertRule, 
  testAlertDispatch, 
  fetchAlertHistory, 
  scanTableAnomalies 
} from '../api/client';

export default function AlertsCenter({ tables = [] }) {
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [liveScan, setLiveScan] = useState(null);

  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  // Create Rule Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    table_name: '',
    metric_column: '',
    condition: 'drop_pct',
    threshold_value: 25.0,
    channel: 'slack',
    target_url: ''
  });

  // Default table selection
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].table_name);
    }
  }, [tables, selectedTable]);

  // Load rules and incident history
  const loadData = async () => {
    setIsLoadingRules(true);
    setError(null);
    try {
      const [rulesData, historyData] = await Promise.all([
        fetchAlertRules(),
        fetchAlertHistory()
      ]);
      setRules(rulesData || []);
      setHistory(historyData || []);
    } catch (err) {
      setError(err.message || 'Failed to load alert rules and history');
    } finally {
      setIsLoadingRules(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Run live anomaly scan on selected table
  const handleRunScan = async (tbl) => {
    const targetTbl = tbl || selectedTable;
    if (!targetTbl) return;
    setIsScanning(true);
    try {
      const scanData = await scanTableAnomalies(targetTbl);
      setLiveScan(scanData);
    } catch (err) {
      setError(err.message || `Failed to scan anomalies for ${targetTbl}`);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (selectedTable) {
      handleRunScan(selectedTable);
    }
  }, [selectedTable]);

  // Handle Delete Rule
  const handleDeleteRule = async (ruleId) => {
    try {
      await deleteAlertRule(ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (err) {
      setError(err.message || 'Failed to delete alert rule');
    }
  };

  // Handle Create Rule Submit
  const handleCreateRuleSubmit = async (e) => {
    e.preventDefault();
    if (!newRule.name || !newRule.table_name || !newRule.metric_column) {
      setError('Please fill in all required rule fields.');
      return;
    }
    try {
      const created = await createAlertRule(newRule);
      setRules(prev => [created, ...prev]);
      setShowCreateModal(false);
      setNewRule({
        name: '',
        table_name: selectedTable,
        metric_column: '',
        condition: 'drop_pct',
        threshold_value: 25.0,
        channel: 'slack',
        target_url: ''
      });
    } catch (err) {
      setError(err.message || 'Failed to create alert rule');
    }
  };

  // Handle Test Webhook
  const handleTestWebhook = async (rule) => {
    setIsTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await testAlertDispatch({
        table_name: rule.table_name,
        metric_name: rule.metric_column,
        channel: rule.channel,
        target_url: rule.target_url || 'https://httpbin.org/post',
        severity: 'WARNING',
        message: `Manual test ping from DataForge AI Watchdog for rule '${rule.name}'`
      });
      setTestResult({ success: true, message: `Dispatched test payload successfully to ${rule.channel.toUpperCase()}` });
      loadData();
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Webhook dispatch failed' });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #31102f 50%, #0f172a 100%)',
        borderRadius: '1.25rem',
        padding: '2.25rem',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '780px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(252, 165, 165, 0.3)', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, color: '#fca5a5', marginBottom: '1rem', backdropFilter: 'blur(8px)' }}>
              <ShieldAlert size={15} style={{ color: '#ef4444' }} />
              Active Anomaly Watchdog & Webhook Dispatcher
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0 0 0.75rem 0', letterSpacing: '-0.025em', background: 'linear-gradient(to right, #ffffff, #ffe4e6, #f43f5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Proactive Alerting & Revenue Sentinel
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>
              Autonomous 24/7 monitoring of sudden statistical drops, demand crashes, and volume anomalies. Configured with automated webhook alerts to Slack, Microsoft Teams, and executive channels.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => {
                setNewRule(prev => ({ ...prev, table_name: selectedTable }));
                setShowCreateModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.75rem 1.25rem',
                background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                border: 'none',
                borderRadius: '0.75rem',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={16} />
              New Alert Rule
            </button>
          </div>
        </div>
      </div>

      {/* Notifications / Errors */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', fontSize: '0.9rem' }}>
          <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {testResult && (
        <div style={{ background: testResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`, borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '10px', color: testResult.success ? '#166534' : '#991b1b', fontSize: '0.9rem' }}>
          {testResult.success ? <CheckCircle2 size={18} style={{ color: '#16a34a' }} /> : <AlertTriangle size={18} style={{ color: '#dc2626' }} />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Real-Time Live Anomaly Radar Card */}
      <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} style={{ color: '#e11d48' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Real-Time Anomaly Scanner Radar
              </h2>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.825rem', color: '#64748b' }}>
              Evaluating rolling Z-Score deviations and crash momentum on active warehouse tables.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                background: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#1e293b',
                cursor: 'pointer'
              }}
            >
              {tables.map(t => (
                <option key={t.table_name} value={t.table_name}>
                  {t.table_name} ({t.row_count} rows)
                </option>
              ))}
            </select>

            <button
              onClick={() => handleRunScan(selectedTable)}
              disabled={isScanning || !selectedTable}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.5rem 1rem',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: '#334155',
                cursor: isScanning ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
              {isScanning ? 'Scanning...' : 'Scan Now'}
            </button>
          </div>
        </div>

        {/* Live Anomaly Findings Table */}
        {liveScan && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Baseline Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Analyzed Metric</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{liveScan.metric_analyzed}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Expected Mean</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>${liveScan.dataset_baseline?.mean?.toLocaleString()}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Std Deviation (σ)</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>±${liveScan.dataset_baseline?.std?.toLocaleString()}</div>
              </div>
              <div style={{ background: liveScan.total_anomalies > 0 ? '#fef2f2' : '#f0fdf4', padding: '12px 16px', borderRadius: '8px', border: `1px solid ${liveScan.total_anomalies > 0 ? '#fecaca' : '#bbf7d0'}` }}>
                <span style={{ fontSize: '0.75rem', color: liveScan.total_anomalies > 0 ? '#991b1b' : '#166534', fontWeight: 600 }}>Anomalies Detected</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: liveScan.total_anomalies > 0 ? '#dc2626' : '#16a34a' }}>
                  {liveScan.total_anomalies} Anomaly Events
                </div>
              </div>
            </div>

            {/* List of Outliers */}
            {liveScan.anomalies.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                {liveScan.anomalies.map((anom, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1rem',
                      background: anom.severity === 'CRITICAL' ? '#fff1f2' : '#fffbeb',
                      borderRadius: '0.75rem',
                      border: `1px solid ${anom.severity === 'CRITICAL' ? '#fecdd3' : '#fde68a'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: anom.severity === 'CRITICAL' ? '#e11d48' : '#d97706',
                          color: 'white',
                          textTransform: 'uppercase'
                        }}>
                          {anom.severity}
                        </span>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{anom.type}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>• {anom.timestamp}</span>
                      </div>
                      <div style={{ fontSize: '0.825rem', color: '#475569' }}>
                        {anom.description}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: anom.severity === 'CRITICAL' ? '#e11d48' : '#b45309' }}>
                        ${anom.value?.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        Z-Score: {anom.z_score}σ
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#16a34a', background: '#f0fdf4', borderRadius: '0.75rem' }}>
                <CheckCircle2 size={28} style={{ margin: '0 auto 8px' }} />
                <strong style={{ display: 'block', fontSize: '1rem' }}>Clean Statistical Distribution</strong>
                <span style={{ fontSize: '0.85rem' }}>All metrics in {selectedTable} fall comfortably within normal 2.5σ bounds.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two-Column: Alert Rules Manager & Incident History */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem' }}>
        
        {/* Watchdog Rules Panel */}
        <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Configured Watchdog Rules
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Active triggers monitoring anomaly thresholds and target webhooks.
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#e0e7ff', color: '#4338ca' }}>
              {rules.length} Rules Active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto' }}>
            {rules.length > 0 ? (
              rules.map(rule => (
                <div
                  key={rule.id}
                  style={{
                    padding: '1.25rem',
                    background: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.925rem', color: '#0f172a' }}>{rule.name}</strong>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px', fontWeight: 700, color: '#475569' }}>
                        {rule.channel.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                      Table: <strong>{rule.table_name}</strong> • Metric: <strong>{rule.metric_column}</strong> • Condition: <strong>{rule.condition} ({rule.threshold_value}%)</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleTestWebhook(rule)}
                      disabled={isTestingWebhook}
                      title="Test Webhook Dispatch"
                      style={{
                        padding: '6px 10px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Send size={12} />
                      Test
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      title="Delete Rule"
                      style={{
                        padding: '6px 8px',
                        background: '#fee2e2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#b91c1c'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '0.75rem' }}>
                <Bell size={24} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                <span>No alert rules configured yet. Click "New Alert Rule" above to create one.</span>
              </div>
            )}
          </div>
        </div>

        {/* Incident Dispatch History Panel */}
        <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Watchdog Incident Log & Audit Trail
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Historical log of dispatched alerts and delivery statuses.
              </p>
            </div>
            <Clock size={16} style={{ color: '#64748b' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto' }}>
            {history.length > 0 ? (
              history.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '0.75rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        background: item.status === 'DELIVERED' ? '#dcfce7' : '#fee2e2',
                        color: item.status === 'DELIVERED' ? '#15803d' : '#b91c1c'
                      }}>
                        {item.status}
                      </span>
                      <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>{item.table_name} • {item.metric_name}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {item.message}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '0.75rem' }}>
                <CheckCircle2 size={24} style={{ margin: '0 auto 8px', color: '#10b981' }} />
                <span>No incidents logged yet. Your datasets are healthy.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Create Alert Rule Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} style={{ color: '#e11d48' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Create Watchdog Alert Rule
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRuleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Rule Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Critical Revenue Crash Alert"
                  value={newRule.name}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Dataset Table *
                  </label>
                  <select
                    value={newRule.table_name}
                    onChange={(e) => setNewRule(prev => ({ ...prev, table_name: e.target.value }))}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  >
                    {tables.map(t => (
                      <option key={t.table_name} value={t.table_name}>{t.table_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Metric Column *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., price, sales, quantity"
                    value={newRule.metric_column}
                    onChange={(e) => setNewRule(prev => ({ ...prev, metric_column: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Condition Trigger *
                  </label>
                  <select
                    value={newRule.condition}
                    onChange={(e) => setNewRule(prev => ({ ...prev, condition: e.target.value }))}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  >
                    <option value="drop_pct">Drop Below Baseline (%)</option>
                    <option value="spike_pct">Spike Above Baseline (%)</option>
                    <option value="z_score">Statistical Outlier (Z-Score &gt; 2.5σ)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Threshold Value *
                  </label>
                  <input
                    type="number"
                    value={newRule.threshold_value}
                    onChange={(e) => setNewRule(prev => ({ ...prev, threshold_value: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Target Webhook URL (Slack, MS Teams, Zapier)
                </label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={newRule.target_url}
                  onChange={(e) => setNewRule(prev => ({ ...prev, target_url: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '0.6rem 1.25rem', background: '#f1f5f9', border: 'none', borderRadius: '0.5rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.6rem 1.5rem', background: '#e11d48', border: 'none', borderRadius: '0.5rem', fontWeight: 700, color: 'white', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.3)' }}
                >
                  Save Alert Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
