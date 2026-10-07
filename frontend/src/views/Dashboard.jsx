import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Layers, 
  Trash2, 
  Sparkles, 
  Users, 
  ArrowUpRight, 
  UploadCloud, 
  Network,
  CheckCircle2,
  Table as TableIcon,
  BarChart3,
  Bot
} from 'lucide-react';
import StatCard from '../components/StatCard';
import { fetchCopilotPrompts } from '../api/client';

export default function Dashboard({ 
  stats, 
  tables, 
  relationships, 
  setActiveTab, 
  onRefresh, 
  onOpenCopilotWithPrompt 
}) {
  const [dashboardPrompts, setDashboardPrompts] = useState([]);

  useEffect(() => {
    if (tables && tables.length > 0) {
      fetchCopilotPrompts()
        .then((prompts) => {
          if (prompts && prompts.length > 0) {
            setDashboardPrompts(prompts);
          }
        })
        .catch(console.error);
    }
  }, [tables]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Hero Welcome Banner */}
      <div className="glass-panel" style={{
        padding: 'clamp(22px, 3.5vw, 36px)',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #ffffff 0%, #eef2ff 50%, #f0fdf4 100%)',
        border: '1px solid #c7d2fe',
        boxShadow: '0 8px 30px -4px rgba(99, 102, 241, 0.12)'
      }}>
        {/* Glow Accent */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '720px', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            background: '#e0e7ff',
            border: '1px solid #c7d2fe',
            borderRadius: '9999px',
            fontSize: '0.8125rem',
            color: '#4338ca',
            fontWeight: '600',
            marginBottom: '16px'
          }}>
            <Sparkles size={14} color="#4f46e5" />
            <span>Autonomous Data Pipeline & Local Warehouse</span>
          </div>

          <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.4rem)', lineHeight: 1.2, marginBottom: '12px', color: '#0f172a' }}>
            Transform Raw CSVs into a{' '}
            <span style={{
              background: 'var(--gradient-brand)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Structured Star Schema
            </span>
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.875rem, 1.5vw, 1rem)', lineHeight: 1.6, marginBottom: '24px' }}>
            Upload multiple CSV files, automatically eliminate duplicate entries, impute missing values, 
            standardize schemas, and store everything in your local analytical database ready for querying.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setActiveTab('upload')}>
              <UploadCloud size={18} />
              <span>Upload CSV Files</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setActiveTab('analytics')}>
              <BarChart3 size={18} color="#0284c7" />
              <span>BI Analytics Dashboard</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setActiveTab('schema')}>
              <Network size={18} color="#4f46e5" />
              <span>Explore Star Schema</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Data-Driven AI Suggested Queries Banner */}
      {dashboardPrompts.length > 0 && (
        <div className="glass-panel" style={{
          padding: '16px 22px',
          background: 'linear-gradient(135deg, rgba(238, 242, 255, 0.95) 0%, rgba(240, 249, 255, 0.95) 100%)',
          border: '1.5px solid #c7d2fe',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 16px -2px rgba(79, 70, 229, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}>
                <Sparkles size={15} />
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: '800', color: '#1e1b4b' }}>
                AI Suggested Prompts for Current Data:
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#4338ca', fontWeight: '700' }}>
              Click any prompt to launch instant Copilot analysis
            </span>
          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            paddingBottom: '2px'
          }}>
            {dashboardPrompts.slice(0, 6).map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (onOpenCopilotWithPrompt) {
                    onOpenCopilotWithPrompt(prompt);
                  } else {
                    setActiveTab('schema');
                  }
                }}
                style={{
                  background: '#ffffff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  color: '#334155',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(79, 70, 229, 0.05)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#4f46e5';
                  e.currentTarget.style.background = '#eef2ff';
                  e.currentTarget.style.color = '#4338ca';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#c7d2fe';
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#334155';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>⚡</span>
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px'
      }}>
        <StatCard
          title="Warehouse Tables"
          value={stats.total_tables || 0}
          subtitle={`${stats.fact_tables_count || 0} Facts, ${stats.dimension_tables_count || 0} Dimensions`}
          icon={Database}
          accentColor="#6366f1"
          badge="SQLite"
        />
        <StatCard
          title="Cleaned Records"
          value={stats.total_rows?.toLocaleString() || 0}
          subtitle="Rows stored in local warehouse"
          icon={Layers}
          accentColor="#06b6d4"
          badge="Live"
        />
        <StatCard
          title="Duplicates Removed"
          value={stats.total_duplicates_removed?.toLocaleString() || 0}
          subtitle="Redundant rows purged"
          icon={Trash2}
          accentColor="#f43f5e"
        />
        <StatCard
          title="Missing Values Repaired"
          value={stats.total_nulls_filled?.toLocaleString() || 0}
          subtitle="Imputed using median / mode"
          icon={CheckCircle2}
          accentColor="#10b981"
        />
        <StatCard
          title="Active Users"
          value={stats.total_users || 0}
          subtitle="System administrators & analysts"
          icon={Users}
          accentColor="#a855f7"
        />
      </div>

      {/* Star Schema Relationship Preview & Recent Tables */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '24px'
      }}>
        {/* Warehouse Tables Directory */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Stored Warehouse Tables</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Cleaned tables stored locally in SQLite with classified analytical roles
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => setActiveTab('schema')}>
              <span>View Data Explorer</span>
              <ArrowUpRight size={16} />
            </button>
          </div>

          {tables.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)'
            }}>
              <TableIcon size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No Datasets Uploaded Yet</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '18px' }}>
                Upload multiple CSV files to clean, standardize, and build your local database warehouse.
              </p>
              <button className="btn btn-primary" onClick={() => setActiveTab('upload')}>
                <UploadCloud size={16} />
                <span>Upload First CSV</span>
              </button>
            </div>
          ) : (
            <div className="data-table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Table Name</th>
                    <th>Source File</th>
                    <th>Role</th>
                    <th>Rows</th>
                    <th>Columns</th>
                    <th>Cleaned Metrics</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: '600', fontFamily: 'var(--font-mono)', color: '#4f46e5' }}>
                        {t.table_name}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.original_filename}</td>
                      <td>
                        <span className={`badge ${t.table_type === 'fact' ? 'badge-fact' : 'badge-dimension'}`}>
                          {t.table_type}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{t.row_count.toLocaleString()}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{t.column_count}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: '600' }}>
                            -{t.cleaning_summary?.duplicates_removed || 0} dups
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '600' }}>
                            +{t.cleaning_summary?.null_values_filled || 0} imputed
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                          onClick={() => setActiveTab('schema')}
                        >
                          Explore Data
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inferred Relationships Card */}
        {relationships.length > 0 && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>
              Connected Star Schema Relationships
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Foreign key connections automatically mapped between transactional Fact tables and descriptive Dimensions
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {relationships.map((rel, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-fact">Fact</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#b45309' }}>
                      {rel.source_table}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({rel.source_column})</span>
                  </div>

                  <span style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>➔</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-dimension">Dimension</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#15803d' }}>
                      {rel.target_table}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({rel.target_column})</span>
                  </div>

                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    {rel.relationship_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
