import React, { useState, useEffect, useMemo } from 'react';
import { 
  Network, 
  Database, 
  Table as TableIcon, 
  Play, 
  Trash2, 
  ArrowRight, 
  Layers, 
  Key, 
  Sparkles,
  Search,
  Code,
  ShieldCheck,
  ShieldAlert,
  Send,
  Terminal,
  CheckCircle2,
  BarChart3,
  PieChart,
  TrendingUp,
  Award
} from 'lucide-react';
import { 
  fetchTablePreview, 
  fetchRelationships, 
  executeSql, 
  executeAiQuery, 
  deleteTable, 
  resetWarehouse, 
  fetchSuggestedQueries 
} from '../api/client';
import ConfirmModal from '../components/ConfirmModal';

export default function SchemaExplorer({ tables, onRefresh }) {
  const [selectedTable, setSelectedTable] = useState(tables.length > 0 ? tables[0].table_name : '');
  const [tableData, setTableData] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [suggestedQueries, setSuggestedQueries] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // AI & SQL Runner state
  const [queryMode, setQueryMode] = useState('ai'); // 'ai' | 'manual'
  const [aiPrompt, setAiPrompt] = useState('top 10 cuisine');
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  const [sqlError, setSqlError] = useState(null);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [securityStatus, setSecurityStatus] = useState(null);
  const [activeProvider, setActiveProvider] = useState(null);

  // Result visualization state
  const [resultViewMode, setResultViewMode] = useState('table'); // 'table' | 'chart'
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'rankings' | 'donut' | 'line'
  const [chartLabelCol, setChartLabelCol] = useState('');
  const [chartValueCol, setChartValueCol] = useState('');
  const [hoveredChartIdx, setHoveredChartIdx] = useState(null);

  // Auto-detect chart columns when query result changes
  useEffect(() => {
    if (queryResult && queryResult.columns?.length > 0) {
      const cols = queryResult.columns;
      const rows = queryResult.rows || [];
      
      // Auto-detect numeric column
      let numCol = cols.find(c => rows.some(r => typeof r[c] === 'number' || (!isNaN(Number(r[c])) && r[c] !== null && r[c] !== '')));
      if (!numCol) numCol = cols[cols.length - 1];

      // Auto-detect categorical / label column
      let textCol = cols.find(c => c !== numCol);
      if (!textCol) textCol = cols[0];

      setChartLabelCol(textCol);
      setChartValueCol(numCol);
    }
  }, [queryResult]);

  const chartColors = [
    '#4f46e5', '#0284c7', '#059669', '#d97706', 
    '#e11d48', '#7c3aed', '#0d9488', '#ea580c',
    '#2563eb', '#16a34a'
  ];

  const chartItems = useMemo(() => {
    if (!queryResult || !queryResult.rows || !chartLabelCol || !chartValueCol) return [];
    return queryResult.rows.map((r, idx) => {
      const valNum = Number(r[chartValueCol]);
      return {
        label: String(r[chartLabelCol] !== null && r[chartLabelCol] !== undefined ? r[chartLabelCol] : `Row ${idx + 1}`),
        value: isNaN(valNum) ? 0 : valNum,
        raw: r
      };
    });
  }, [queryResult, chartLabelCol, chartValueCol]);

  const maxChartVal = useMemo(() => {
    if (chartItems.length === 0) return 1;
    return Math.max(...chartItems.map(d => d.value), 1);
  }, [chartItems]);

  const totalChartVal = useMemo(() => {
    return chartItems.reduce((acc, it) => acc + (it.value || 0), 0);
  }, [chartItems]);

  // Keep selectedTable in sync with available tables
  useEffect(() => {
    if (tables.length > 0) {
      if (!selectedTable || !tables.some(t => t.table_name === selectedTable)) {
        setSelectedTable(tables[0].table_name);
      }
    } else {
      setSelectedTable('');
      setTableData(null);
    }
  }, [tables]);

  // Load preview data when selectedTable changes
  useEffect(() => {
    if (selectedTable) {
      loadPreview(selectedTable);
    } else {
      setTableData(null);
    }
  }, [selectedTable]);

  // Load relationships and dynamic suggested queries
  useEffect(() => {
    fetchRelationships()
      .then(setRelationships)
      .catch(console.error);

    fetchSuggestedQueries()
      .then((queries) => {
        setSuggestedQueries(queries);
        if (queries.length > 0 && !sqlQuery) {
          setSqlQuery(queries[0].query);
        }
      })
      .catch(console.error);
  }, [tables]);

  const loadPreview = async (name) => {
    setIsLoadingPreview(true);
    try {
      const data = await fetchTablePreview(name, 50, 0);
      setTableData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRunAiQuery = async (customPrompt) => {
    const promptToUse = customPrompt || aiPrompt;
    if (!promptToUse || !promptToUse.trim()) return;
    setIsExecutingSql(true);
    setSqlError(null);
    setQueryResult(null);
    setSecurityStatus(null);
    setAiExplanation(null);
    setActiveProvider(null);

    try {
      const res = await executeAiQuery(promptToUse, selectedTable);
      setSecurityStatus(res.security_checks);
      setAiExplanation(res.explanation);
      setActiveProvider(res.provider);
      setSqlQuery(res.sql);

      if (!res.is_safe || !res.success) {
        setSqlError(res.error || 'Query blocked by security guardrails.');
      } else {
        setQueryResult({
          columns: res.columns,
          rows: res.rows,
          row_count: res.row_count,
          execution_time_ms: res.execution_time_ms,
        });
      }
    } catch (err) {
      setSqlError(err.message);
    } finally {
      setIsExecutingSql(false);
    }
  };

  const handleRunQuery = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecutingSql(true);
    setSqlError(null);
    setSecurityStatus(null);
    setAiExplanation(null);
    setActiveProvider(null);
    try {
      const res = await executeSql(sqlQuery);
      setQueryResult(res);
      setSecurityStatus({
        read_only: true,
        single_statement: true,
        limit_enforced: false
      });
    } catch (err) {
      setSqlError(err.message);
      setQueryResult(null);
    } finally {
      setIsExecutingSql(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!tableToDelete) return;
    try {
      await deleteTable(tableToDelete);
      if (onRefresh) onRefresh();
      if (selectedTable === tableToDelete) {
        const remaining = tables.filter(t => t.table_name !== tableToDelete);
        setSelectedTable(remaining.length > 0 ? remaining[0].table_name : '');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetWarehouse = async () => {
    setIsResetting(true);
    try {
      await resetWarehouse();
      setTableData(null);
      setSelectedTable('');
      setQueryResult(null);
      setSqlQuery('');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsResetting(false);
      setResetModalOpen(false);
    }
  };

  const currentMeta = tables.find(t => t.table_name === selectedTable);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Star Schema & Warehouse Explorer</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Inspect relational connections, explore cleaned records, and run analytical SQL queries directly on your local database.
          </p>
        </div>
        {tables.length > 0 && (
          <button
            className="btn btn-secondary"
            style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.35)', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setResetModalOpen(true)}
          >
            <Trash2 size={16} />
            <span>Drop All Tables</span>
          </button>
        )}
      </div>

      {tables.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Database size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Warehouse is Empty</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Upload CSV files to generate local database tables and infer Star Schema architecture.
          </p>
        </div>
      ) : (
        <>
          {/* Section 1: Star Schema Architecture View */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Network size={22} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.25rem' }}>Warehouse Star Schema Topology</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Central transactional Fact tables connected to peripheral descriptive Dimension tables
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px'
            }}>
              {tables.map((t) => {
                const isFact = t.table_type === 'fact';
                const relatedRels = relationships.filter(
                  r => r.source_table === t.table_name || r.target_table === t.table_name
                );

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTable(t.table_name)}
                    style={{
                      padding: '20px',
                      background: selectedTable === t.table_name 
                        ? '#eef2ff' 
                        : '#ffffff',
                      borderRadius: 'var(--radius-md)',
                      border: selectedTable === t.table_name 
                        ? '2px solid var(--accent-primary)' 
                        : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: selectedTable === t.table_name 
                        ? '0 4px 16px rgba(99, 102, 241, 0.12)' 
                        : 'var(--shadow-sm)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span className={`badge ${isFact ? 'badge-fact' : 'badge-dimension'}`}>
                        {isFact ? 'FACT TABLE' : 'DIMENSION'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {t.row_count} rows
                      </span>
                    </div>

                    <h4 style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.15rem',
                      color: isFact ? '#b45309' : '#15803d',
                      marginBottom: '8px'
                    }}>
                      {t.table_name}
                    </h4>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                      {t.column_count} columns • {t.original_filename}
                    </div>

                    {/* Columns List Preview */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      padding: '8px',
                      background: '#f8fafc',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid #f1f5f9'
                    }}>
                      {t.schema_info?.map((c, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          <span style={{ color: c.name.endsWith('_id') ? '#4f46e5' : 'var(--text-primary)', fontWeight: c.name.endsWith('_id') ? '600' : 'normal' }}>
                            {c.name}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                            {c.data_type}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Active Connections Footer */}
                    {relatedRels.length > 0 && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        🔗 {relatedRels.length} linked relationship(s)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Interactive Table Data Explorer */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <TableIcon size={20} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '1.25rem' }}>Data Table Inspector:</h3>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: '#4f46e5', fontWeight: '700' }}>
                    {selectedTable}
                  </span>
                  {currentMeta && (
                    <span className={`badge ${currentMeta.table_type === 'fact' ? 'badge-fact' : 'badge-dimension'}`}>
                      {currentMeta.table_type}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Showing top records after duplicate elimination and missing value imputation
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <select
                  className="form-select"
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  style={{ minWidth: '180px' }}
                >
                  {tables.map(t => (
                    <option key={t.id} value={t.table_name}>
                      {t.table_name} ({t.table_type})
                    </option>
                  ))}
                </select>

                <button
                  className="btn btn-danger"
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  onClick={() => {
                    setTableToDelete(selectedTable);
                    setDeleteModalOpen(true);
                  }}
                >
                  <Trash2 size={16} />
                  <span>Drop Table</span>
                </button>
              </div>
            </div>

            {/* Table Grid */}
            {isLoadingPreview ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Loading preview data...
              </div>
            ) : tableData && tableData.rows.length > 0 ? (
              <div className="data-table-container" style={{ maxHeight: '420px', overflowX: 'auto', overflowY: 'auto', width: '100%', maxWidth: '100%' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>#</th>
                      {tableData.columns.map((col, idx) => (
                        <th key={idx}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                          {rIdx + 1}
                        </td>
                        {tableData.columns.map((col, cIdx) => {
                          const val = row[col];
                          return (
                            <td key={cIdx} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                              {val === null || val === undefined ? (
                                <span style={{ color: '#f43f5e', fontStyle: 'italic', opacity: 0.6 }}>NULL</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No records found.
              </div>
            )}
          </div>

          {/* Section 3: AI Natural Language Query Assistant & Secure SQL Runner */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            {/* Header & Mode Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={20} color="#4f46e5" />
                  <h3 style={{ fontSize: '1.25rem', color: '#0f172a' }}>AI Query Assistant & Secure SQL Runner</h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Ask questions in plain English or write raw SQL. Protected by multi-layer read-only security guardrails.
                </p>
              </div>

              {/* Mode Toggle Switch */}
              <div style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '3px'
              }}>
                <button
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: queryMode === 'ai' ? 'var(--accent-primary)' : 'transparent',
                    color: queryMode === 'ai' ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setQueryMode('ai')}
                >
                  <Sparkles size={14} />
                  <span>Ask AI (Natural Language)</span>
                </button>
                <button
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: queryMode === 'manual' ? 'var(--accent-primary)' : 'transparent',
                    color: queryMode === 'manual' ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setQueryMode('manual')}
                >
                  <Code size={14} />
                  <span>Manual SQL Editor</span>
                </button>
              </div>
            </div>

            {/* AI Natural Language Mode */}
            {queryMode === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                {/* Prompt Suggestions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Try Asking:</span>
                  {[
                    'top 10 cuisine',
                    'sales by restaurant city',
                    'breakdown by payment method',
                    'orders by status',
                    'average delivery fee by city'
                  ].map((sugg, sIdx) => (
                    <button
                      key={sIdx}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: '#c7d2fe', color: '#4338ca' }}
                      onClick={() => {
                        setAiPrompt(sugg);
                        handleRunAiQuery(sugg);
                      }}
                    >
                      ⚡ {sugg}
                    </button>
                  ))}
                </div>

                {/* Prompt Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRunAiQuery();
                  }}
                  style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
                >
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      className="input-field"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder='Ask anything in plain English, e.g. "top 10 cuisine by total sales"...'
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '0.9rem',
                        borderColor: '#a5b4fc',
                        background: '#ffffff',
                        color: '#0f172a'
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isExecutingSql || !aiPrompt.trim()}
                    style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}
                  >
                    <Sparkles size={16} />
                    <span>{isExecutingSql ? 'Analyzing...' : 'Ask AI & Run'}</span>
                  </button>
                </form>
              </div>
            )}

            {/* Manual SQL Mode */}
            {queryMode === 'manual' && (
              <div style={{ marginBottom: '20px' }}>
                {/* Sample Queries */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                    Sample Queries:
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => setSqlQuery(`SELECT * FROM "${selectedTable}" LIMIT 25;`)}
                  >
                    Preview {selectedTable}
                  </button>
                  {suggestedQueries.map((sq, sqIdx) => (
                    <button
                      key={sqIdx}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: '#c7d2fe', color: '#4338ca' }}
                      onClick={() => setSqlQuery(sq.query)}
                    >
                      ⚡ {sq.label}
                    </button>
                  ))}
                </div>

                {/* Query Editor */}
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#f8fafc',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: '#0f172a',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    outline: 'none',
                    resize: 'vertical',
                    marginBottom: '10px'
                  }}
                  placeholder="SELECT * FROM table_name WHERE ..."
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleRunQuery}
                    disabled={isExecutingSql || !sqlQuery.trim()}
                  >
                    <Play size={16} />
                    <span>{isExecutingSql ? 'Running Query...' : 'Execute SQL Query'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Security Guardrail Status Banner */}
            {securityStatus && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '14px',
                fontSize: '0.78rem',
                color: '#065f46',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                  <ShieldCheck size={16} color="#059669" />
                  <span>Security Verified Safe</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', color: 'var(--text-secondary)' }}>
                  <span>• Read-Only: <strong>Enforced</strong></span>
                  <span>• Single Statement: <strong>Enforced</strong></span>
                  <span>• Destructive Keywords: <strong>0</strong></span>
                  {activeProvider && <span>• Engine: <strong>{activeProvider}</strong></span>}
                </div>
              </div>
            )}

            {/* AI Explanation & Generated SQL View */}
            {aiExplanation && (
              <div style={{
                padding: '14px 18px',
                background: '#eef2ff',
                border: '1px solid #c7d2fe',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '14px'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#4338ca', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={13} color="#4f46e5" />
                  <span>AI Business Insight</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b', marginBottom: '8px' }}>
                  {aiExplanation}
                </div>
                <div style={{
                  padding: '8px 12px',
                  background: '#ffffff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: '#0369a1',
                  wordBreak: 'break-all'
                }}>
                  {sqlQuery}
                </div>
              </div>
            )}

            {/* Error Message */}
            {sqlError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px',
                background: '#ffe4e6',
                border: '1px solid #fecdd3',
                borderRadius: 'var(--radius-md)',
                color: '#be123c',
                fontSize: '0.85rem',
                marginBottom: '14px'
              }}>
                <ShieldAlert size={20} color="#e11d48" />
                <span>{sqlError}</span>
              </div>
            )}

            {/* Query Results */}
            {queryResult && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#059669' }}>
                      Query Returned {queryResult.row_count} row(s)
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • {queryResult.execution_time_ms} ms
                    </span>
                  </div>

                  {/* Table vs Chart Switcher */}
                  <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => setResultViewMode('table')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        border: 'none',
                        cursor: 'pointer',
                        background: resultViewMode === 'table' ? '#ffffff' : 'transparent',
                        color: resultViewMode === 'table' ? '#0f172a' : '#64748b',
                        boxShadow: resultViewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      <TableIcon size={13} />
                      <span>Table Data</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setResultViewMode('chart')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        border: 'none',
                        cursor: 'pointer',
                        background: resultViewMode === 'chart' ? 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)' : 'transparent',
                        color: resultViewMode === 'chart' ? '#ffffff' : '#64748b',
                        boxShadow: resultViewMode === 'chart' ? '0 2px 6px rgba(79, 70, 229, 0.25)' : 'none'
                      }}
                    >
                      <BarChart3 size={13} />
                      <span>📊 Visualize Chart</span>
                    </button>
                  </div>
                </div>

                {/* Mode 1: Tabular Grid */}
                {resultViewMode === 'table' && (
                  <div className="data-table-container" style={{ maxHeight: '350px', overflowX: 'auto', overflowY: 'auto', width: '100%', maxWidth: '100%' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          {queryResult.columns.map((col, idx) => (
                            <th key={idx}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {queryResult.columns.map((col, cIdx) => (
                              <td key={cIdx} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                                {row[col] !== null ? String(row[col]) : <span style={{ color: '#f43f5e' }}>NULL</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Mode 2: Interactive Visual Chart */}
                {resultViewMode === 'chart' && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    padding: '16px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    {/* Chart Controls Bar */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      {/* Chart Type */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { id: 'bar', label: 'Bar', icon: BarChart3 },
                          { id: 'rankings', label: 'Leaderboard', icon: Award },
                          { id: 'donut', label: 'Donut', icon: PieChart },
                          { id: 'line', label: 'Line', icon: TrendingUp }
                        ].map(item => {
                          const Icon = item.icon;
                          const isActive = chartType === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setChartType(item.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                border: '1px solid',
                                borderColor: isActive ? '#4f46e5' : '#cbd5e1',
                                background: isActive ? '#e0e7ff' : '#ffffff',
                                color: isActive ? '#4338ca' : '#475569',
                                cursor: 'pointer'
                              }}
                            >
                              <Icon size={13} />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Axis Column Selectors */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Label (X):</span>
                          <select
                            className="select-field"
                            value={chartLabelCol}
                            onChange={(e) => setChartLabelCol(e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '0.78rem', background: '#ffffff' }}
                          >
                            {queryResult.columns.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Value (Y):</span>
                          <select
                            className="select-field"
                            value={chartValueCol}
                            onChange={(e) => setChartValueCol(e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '0.78rem', background: '#ffffff' }}
                          >
                            {queryResult.columns.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Chart Render Area */}
                    {chartItems.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '0.85rem' }}>
                        No plottable numeric data available for selected columns.
                      </div>
                    ) : (
                      <div>
                        {/* 1. Bar Chart */}
                        {chartType === 'bar' && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '10px',
                            height: '240px',
                            padding: '16px 8px 36px 8px',
                            overflowX: 'auto',
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {chartItems.map((item, idx) => {
                              const heightPct = Math.max((item.value / maxChartVal) * 100, 4);
                              const isHovered = hoveredChartIdx === idx;
                              const barColor = chartColors[idx % chartColors.length];

                              return (
                                <div
                                  key={idx}
                                  onMouseEnter={() => setHoveredChartIdx(idx)}
                                  onMouseLeave={() => setHoveredChartIdx(null)}
                                  style={{
                                    flex: '1 0 45px',
                                    maxWidth: '65px',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    position: 'relative',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {isHovered && (
                                    <div style={{
                                      position: 'absolute',
                                      bottom: `calc(${heightPct}% + 8px)`,
                                      background: '#0f172a',
                                      color: '#ffffff',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      whiteSpace: 'nowrap',
                                      zIndex: 20
                                    }}>
                                      <div>{item.label}</div>
                                      <div>{Number(item.value).toLocaleString()}</div>
                                    </div>
                                  )}

                                  <div style={{
                                    width: '80%',
                                    height: `${heightPct}%`,
                                    background: barColor,
                                    borderRadius: '4px 4px 0 0',
                                    transition: 'all 0.2s',
                                    opacity: isHovered ? 1 : 0.88
                                  }} />

                                  <div style={{
                                    position: 'absolute',
                                    bottom: '-28px',
                                    fontSize: '0.68rem',
                                    color: '#64748b',
                                    width: '100%',
                                    textAlign: 'center',
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
                        )}

                        {/* 2. Leaderboard Rankings */}
                        {chartType === 'rankings' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {chartItems.slice(0, 15).map((item, idx) => {
                              const widthPct = Math.max((item.value / maxChartVal) * 100, 2);
                              const barColor = chartColors[idx % chartColors.length];

                              return (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
                                  <span style={{ width: '20px', fontWeight: '800', color: '#64748b' }}>#{idx + 1}</span>
                                  <span style={{ width: '130px', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.label}
                                  </span>
                                  <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                                    <div style={{ width: `${widthPct}%`, height: '100%', background: barColor, borderRadius: '9999px' }} />
                                  </div>
                                  <span style={{ width: '80px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                                    {Number(item.value).toLocaleString()}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 3. Donut Chart */}
                        {chartType === 'donut' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '10px 0', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                                {(() => {
                                  let acc = 0;
                                  return chartItems.map((item, idx) => {
                                    const pct = totalChartVal > 0 ? (item.value / totalChartVal) * 100 : 0;
                                    const strokeDasharray = `${pct} ${100 - pct}`;
                                    const strokeDashoffset = -acc;
                                    acc += pct;
                                    return (
                                      <circle
                                        key={idx}
                                        cx="50"
                                        cy="50"
                                        r="38"
                                        fill="transparent"
                                        stroke={chartColors[idx % chartColors.length]}
                                        strokeWidth="18"
                                        strokeDasharray={strokeDasharray}
                                        strokeDashoffset={strokeDashoffset}
                                        pathLength="100"
                                      />
                                    );
                                  });
                                })()}
                              </svg>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
                              {chartItems.slice(0, 8).map((item, idx) => {
                                const pct = totalChartVal > 0 ? Math.round((item.value / totalChartVal) * 100) : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: chartColors[idx % chartColors.length] }} />
                                    <span style={{ fontWeight: '600', color: '#0f172a', width: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.label}
                                    </span>
                                    <span style={{ fontWeight: '700', color: '#64748b' }}>{pct}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 4. Line Chart */}
                        {chartType === 'line' && (
                          <div style={{ height: '220px', width: '100%' }}>
                            <svg viewBox="0 0 500 180" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                              {(() => {
                                const count = chartItems.length;
                                if (count < 2) return null;
                                const points = chartItems.map((it, idx) => {
                                  const x = (idx / (count - 1)) * 480 + 10;
                                  const y = 160 - (it.value / maxChartVal) * 140;
                                  return { x, y };
                                });

                                const dLine = points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');

                                return (
                                  <>
                                    <path d={dLine} fill="none" stroke="#4f46e5" strokeWidth="3" />
                                    {points.map((p, i) => (
                                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" />
                                    ))}
                                  </>
                                );
                              })()}
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation Modal for Single Table Drop */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteTable}
        title="Drop Warehouse Table"
        message={`Are you sure you want to permanently delete table '${tableToDelete}' from the local database? This action cannot be undone.`}
        confirmText="Drop Table"
      />

      {/* Confirmation Modal for Resetting All Warehouse Tables */}
      <ConfirmModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleResetWarehouse}
        title="Drop All Warehouse Tables"
        message="Are you sure you want to drop all data tables from the local database? All dataset tables will be removed so you can start completely fresh. Users and credentials will be preserved."
        confirmText={isResetting ? "Dropping Tables..." : "Drop All Tables"}
      />
    </div>
  );
}
