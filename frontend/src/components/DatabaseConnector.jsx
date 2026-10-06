import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Zap, 
  Plus, 
  Trash2, 
  Layers, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  ExternalLink,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import { 
  fetchDatabaseConnections, 
  testDatabaseConnection, 
  saveDatabaseConnection, 
  deleteDatabaseConnection, 
  inspectDatabaseTables, 
  syncDatabaseTable 
} from '../api/client';

export default function DatabaseConnector({ onSyncSuccess }) {
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Active Connection Form State
  const [connForm, setConnForm] = useState({
    name: 'Production PostgreSQL',
    db_type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database_name: 'postgres',
    username: 'postgres',
    password: '',
    ssl_mode: 'prefer',
    sync_interval: 'manual'
  });

  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // Table Browser State
  const [remoteTables, setRemoteTables] = useState([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [syncingTable, setSyncingTable] = useState(null);

  // Presets
  const DB_PRESETS = [
    { label: 'PostgreSQL / Supabase', db_type: 'postgresql', port: 5432, defaultUser: 'postgres' },
    { label: 'MySQL / MariaDB', db_type: 'mysql', port: 3306, defaultUser: 'root' },
    { label: 'Local SQLite File', db_type: 'sqlite', port: null, defaultUser: '' }
  ];

  // Load saved connections
  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDatabaseConnections();
      setConnections(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch saved database connections');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handlePresetSelect = (preset) => {
    setConnForm(prev => ({
      ...prev,
      name: `${preset.label} Connection`,
      db_type: preset.db_type,
      port: preset.port,
      username: preset.defaultUser
    }));
    setTestResult(null);
    setRemoteTables([]);
  };

  // Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const res = await testDatabaseConnection(connForm);
      setTestResult(res);
      setSuccessMsg(`Connection verified! Latency: ${res.latency_ms}ms • Server: ${res.server_version}`);
      // Auto inspect tables if successful
      handleInspectTables();
    } catch (err) {
      setError(err.message || 'Database connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  // Inspect Remote Tables
  const handleInspectTables = async () => {
    setIsInspecting(true);
    try {
      const res = await inspectDatabaseTables(connForm);
      setRemoteTables(res.tables || []);
    } catch (err) {
      setError(err.message || 'Failed to inspect remote tables');
    } finally {
      setIsInspecting(false);
    }
  };

  // Save Connection
  const handleSaveConnection = async () => {
    try {
      const res = await saveDatabaseConnection(connForm);
      setSuccessMsg(`Saved connection '${connForm.name}' successfully!`);
      loadConnections();
    } catch (err) {
      setError(err.message || 'Failed to save database connection');
    }
  };

  // Delete Connection
  const handleDeleteConnection = async (id) => {
    try {
      await deleteDatabaseConnection(id);
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete connection');
    }
  };

  // Sync Table to Warehouse
  const handleSyncTable = async (tName) => {
    setSyncingTable(tName);
    setError(null);
    try {
      const res = await syncDatabaseTable({
        db_type: connForm.db_type,
        host: connForm.host,
        port: connForm.port,
        database_name: connForm.database_name,
        username: connForm.username,
        password: connForm.password,
        ssl_mode: connForm.ssl_mode,
        remote_table: tName,
        target_table: tName,
        limit_rows: 25000
      });

      setSuccessMsg(`Successfully synchronized '${tName}' (${res.row_count} rows, ${res.column_count} cols) into SQLite warehouse!`);
      if (onSyncSuccess) onSyncSuccess(res);
    } catch (err) {
      setError(err.message || `Failed to sync table ${tName}`);
    } finally {
      setSyncingTable(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Intro Header */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Database size={20} style={{ color: '#4f46e5' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Direct SQL Database Connectors
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Connect production databases (PostgreSQL, MySQL, Supabase, Neon) for live, automated warehouse synchronization.
          </p>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {DB_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePresetSelect(p)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                background: connForm.db_type === p.db_type ? '#4f46e5' : 'white',
                color: connForm.db_type === p.db_type ? 'white' : '#334155',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', fontSize: '0.9rem' }}>
          <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#166534', fontSize: '0.9rem' }}>
          <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Connection Parameters Form */}
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Connection Name *
            </label>
            <input
              type="text"
              value={connForm.name}
              onChange={(e) => setConnForm(prev => ({ ...prev, name: e.target.value }))}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Host / Server Address *
            </label>
            <input
              type="text"
              placeholder="e.g., db.example.com or localhost"
              value={connForm.host}
              onChange={(e) => setConnForm(prev => ({ ...prev, host: e.target.value }))}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Port
            </label>
            <input
              type="number"
              placeholder="5432"
              value={connForm.port || ''}
              onChange={(e) => setConnForm(prev => ({ ...prev, port: e.target.value ? Number(e.target.value) : null }))}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Database Name *
            </label>
            <input
              type="text"
              placeholder="e.g., production_db"
              value={connForm.database_name}
              onChange={(e) => setConnForm(prev => ({ ...prev, database_name: e.target.value }))}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Username
            </label>
            <input
              type="text"
              placeholder="postgres or root"
              value={connForm.username}
              onChange={(e) => setConnForm(prev => ({ ...prev, username: e.target.value }))}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={connForm.password}
              onChange={(e) => setConnForm(prev => ({ ...prev, password: e.target.value }))}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            style={{
              padding: '0.6rem 1.25rem',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: '#334155',
              cursor: isTesting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
            {isTesting ? 'Testing Latency...' : 'Test Connection'}
          </button>

          <button
            type="button"
            onClick={handleSaveConnection}
            style={{
              padding: '0.6rem 1.25rem',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.25)'
            }}
          >
            Save Connection
          </button>
        </div>
      </div>

      {/* Remote Table Browser & Sync (Visible when tables inspected) */}
      {remoteTables.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '1.5rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Remote Tables Discovered ({remoteTables.length} Tables)
              </h4>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Click "Sync to Warehouse" to clean, impute missing values, and ingest any table directly.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {remoteTables.map(t => (
              <div
                key={t.table_name}
                style={{
                  padding: '1rem 1.25rem',
                  background: '#f8fafc',
                  borderRadius: '0.75rem',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a', display: 'block', marginBottom: '2px' }}>
                    {t.table_name}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    ~{t.row_count?.toLocaleString()} rows • {t.column_count} columns
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSyncTable(t.table_name)}
                  disabled={syncingTable === t.table_name}
                  style={{
                    padding: '0.45rem 0.9rem',
                    background: syncingTable === t.table_name ? '#94a3b8' : '#0284c7',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: syncingTable === t.table_name ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={13} className={syncingTable === t.table_name ? 'animate-spin' : ''} />
                  {syncingTable === t.table_name ? 'Syncing...' : 'Sync to Warehouse'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Database Connections List */}
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
            Saved Enterprise Database Connections
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            {connections.length} Connections Stored
          </span>
        </div>

        {connections.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {connections.map(c => (
              <div
                key={c.id}
                style={{
                  padding: '1rem 1.25rem',
                  background: '#ffffff',
                  borderRadius: '0.75rem',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Server size={18} style={{ color: '#4f46e5' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.925rem', color: '#0f172a' }}>{c.name}</strong>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, background: '#f1f5f9', color: '#475569' }}>
                        {c.db_type.toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {c.host || 'local'}:{c.port || 5432}/{c.database_name} • Sync: {c.sync_interval}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setConnForm({
                        name: c.name,
                        db_type: c.db_type,
                        host: c.host || 'localhost',
                        port: c.port || 5432,
                        database_name: c.database_name,
                        username: c.username || '',
                        password: '',
                        ssl_mode: c.ssl_mode || 'prefer',
                        sync_interval: c.sync_interval || 'manual'
                      });
                      handleInspectTables();
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Browse Tables
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConnection(c.id)}
                    style={{
                      padding: '6px 8px',
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      color: '#b91c1c',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '0.75rem' }}>
            <Server size={24} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
            <span>No saved connections yet. Fill in the parameters above and click "Save Connection".</span>
          </div>
        )}
      </div>
    </div>
  );
}
