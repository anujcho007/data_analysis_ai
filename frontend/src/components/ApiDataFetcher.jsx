import React, { useState } from 'react';
import { 
  Globe, 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Database, 
  Settings2, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  FileText, 
  Sliders,
  Zap,
  Table as TableIcon
} from 'lucide-react';
import { fetchApiData } from '../api/client';

const SAMPLE_APIS = [
  {
    name: 'E-Commerce Products',
    desc: '100 products with prices, ratings, and categories',
    url: 'https://dummyjson.com/products',
    table: 'products_api',
    auth: 'None'
  },
  {
    name: 'User Accounts',
    desc: 'Customer demographics, company info, and addresses',
    url: 'https://jsonplaceholder.typicode.com/users',
    table: 'users_api',
    auth: 'None'
  },
  {
    name: 'Crypto Market Coins',
    desc: 'Real-time crypto asset market prices and volumes',
    url: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1',
    table: 'crypto_markets',
    auth: 'None'
  },
  {
    name: 'Online Posts & Engagement',
    desc: 'Content metrics, reactions, tags, and user interactions',
    url: 'https://dummyjson.com/posts',
    table: 'posts_api',
    auth: 'None'
  }
];

export default function ApiDataFetcher({ onIngestionComplete, setActiveTab }) {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [authScheme, setAuthScheme] = useState('Bearer'); // 'Bearer' | 'ApiKey' | 'Custom' | 'None'
  const [headerName, setHeaderName] = useState('Authorization');
  const [tableName, setTableName] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Cleaning Settings
  const [showSettings, setShowSettings] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [fillNulls, setFillNulls] = useState(true);
  const [numericStrategy, setNumericStrategy] = useState('median');
  const [categoricalStrategy, setCategoricalStrategy] = useState('mode');
  const [standardizeColumns, setStandardizeColumns] = useState(true);
  const [standardizeDates, setStandardizeDates] = useState(true);

  // Ingestion State
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [statusStep, setStatusStep] = useState('');

  const handleSelectSample = (sample) => {
    setApiUrl(sample.url);
    setTableName(sample.table);
    setAuthScheme(sample.auth);
    setApiKey('');
    setError(null);
    setResult(null);
  };

  const handleAuthSchemeChange = (scheme) => {
    setAuthScheme(scheme);
    if (scheme === 'Bearer') {
      setHeaderName('Authorization');
    } else if (scheme === 'ApiKey') {
      setHeaderName('X-API-Key');
    } else if (scheme === 'None') {
      setHeaderName('');
      setApiKey('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!apiUrl.trim()) {
      setError('Please provide a valid API endpoint URL.');
      return;
    }

    setIsFetching(true);
    setError(null);
    setResult(null);
    setStatusStep('Connecting to REST API endpoint...');

    const timer1 = setTimeout(() => setStatusStep('Parsing & normalizing JSON structure...'), 800);
    const timer2 = setTimeout(() => setStatusStep('Vectorized deduplication & null imputation...'), 1600);
    const timer3 = setTimeout(() => setStatusStep('Ingesting into SQLite Warehouse & indexing...'), 2400);

    try {
      const payload = {
        url: apiUrl.trim(),
        api_key: apiKey.trim() || null,
        header_name: headerName.trim() || 'Authorization',
        auth_scheme: authScheme,
        table_name: tableName.trim() || null,
        clear_existing: clearExisting,
        drop_duplicates: dropDuplicates,
        fill_nulls: fillNulls,
        numeric_strategy: numericStrategy,
        categorical_strategy: categoricalStrategy,
        standardize_columns: standardizeColumns,
        standardize_dates: standardizeDates
      };

      const data = await fetchApiData(payload);
      setResult(data);
      if (onIngestionComplete) {
        onIngestionComplete();
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch data from API.');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsFetching(false);
      setStatusStep('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Configuration Card */}
      <div className="glass-panel" style={{ padding: '28px', background: '#ffffff', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Globe size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
              REST API Live Ingestion Engine
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Connect directly to any HTTP REST API endpoint. The system normalizes arbitrary JSON responses into tabular DataFrames, cleans and imputes missing fields, and integrates the data directly into your analytical Star Schema warehouse.
            </p>
          </div>
        </div>

        {/* Quick Sample Presets */}
        <div style={{ marginTop: '16px', marginBottom: '24px', padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            ⚡ Instant Test Datasets (1-Click Presets):
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SAMPLE_APIS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSample(s)}
                style={{
                  background: '#ffffff',
                  border: apiUrl === s.url ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  color: apiUrl === s.url ? '#4f46e5' : '#334155',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s'
                }}
              >
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ingestion Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* API URL Endpoint */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
              API Endpoint URL <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="url"
                required
                className="input-field"
                placeholder="https://api.example.com/v1/orders"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                style={{ width: '100%', height: '44px', paddingLeft: '38px', fontSize: '0.9rem' }}
              />
              <Globe size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Accepts JSON arrays or wrapper objects (e.g. <code>{`{ "data": [...] }`}</code>) and CSV streams.
            </span>
          </div>

          {/* Authentication Section */}
          <div style={{
            padding: '16px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={16} color="#4f46e5" />
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>
                Authentication & Headers
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              {/* Auth Scheme */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Auth Method
                </label>
                <select
                  className="input-field"
                  value={authScheme}
                  onChange={(e) => handleAuthSchemeChange(e.target.value)}
                  style={{ width: '100%', height: '40px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  <option value="Bearer">Authorization: Bearer &lt;Token&gt;</option>
                  <option value="ApiKey">X-API-Key: &lt;Key&gt;</option>
                  <option value="Custom">Custom Header</option>
                  <option value="None">No Auth (Public API)</option>
                </select>
              </div>

              {/* Header Name (if Custom) */}
              {authScheme === 'Custom' && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Custom Header Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. x-api-token or apiKey"
                    value={headerName}
                    onChange={(e) => setHeaderName(e.target.value)}
                    style={{ width: '100%', height: '40px', fontSize: '0.85rem' }}
                  />
                </div>
              )}

              {/* API Key Input */}
              {authScheme !== 'None' && (
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    API Key / Secret Token
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showKey ? 'text' : 'password'}
                      className="input-field"
                      placeholder="Paste your API key or bearer token..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      style={{ width: '100%', height: '40px', paddingRight: '38px', fontSize: '0.85rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table Name & Clear Warehouse */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                Warehouse Table Name (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. api_orders (auto-derived if empty)"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                style={{ width: '100%', height: '42px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '22px' }}>
              <input
                type="checkbox"
                id="apiClearWarehouse"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="apiClearWarehouse" style={{ fontSize: '0.85rem', color: '#334155', cursor: 'pointer', fontWeight: '600' }}>
                Reset & clear previous tables before ingesting
              </label>
            </div>
          </div>

          {/* Collapsible Advanced Cleaning Settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              <Settings2 size={15} />
              <span>{showSettings ? 'Hide' : 'Configure'} Automated Cleaning Rules</span>
            </button>

            {showSettings && (
              <div style={{
                marginTop: '12px',
                padding: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px'
              }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Numeric Null Repair Strategy
                  </label>
                  <select
                    className="input-field"
                    value={numericStrategy}
                    onChange={(e) => setNumericStrategy(e.target.value)}
                    style={{ width: '100%', height: '36px', fontSize: '0.8rem' }}
                  >
                    <option value="median">Median (Outlier-Robust)</option>
                    <option value="mean">Mean (Average)</option>
                    <option value="zero">Zero (0)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Categorical Null Repair Strategy
                  </label>
                  <select
                    className="input-field"
                    value={categoricalStrategy}
                    onChange={(e) => setCategoricalStrategy(e.target.value)}
                    style={{ width: '100%', height: '36px', fontSize: '0.8rem' }}
                  >
                    <option value="mode">Mode (Most Frequent)</option>
                    <option value="unknown">"Unknown" Placeholder</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={dropDuplicates}
                      onChange={(e) => setDropDuplicates(e.target.checked)}
                    />
                    Automated Deduplication
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={standardizeColumns}
                      onChange={(e) => setStandardizeColumns(e.target.checked)}
                    />
                    Standardize to snake_case
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-md)',
              color: '#991b1b',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
            {isFetching && (
              <span style={{ fontSize: '0.85rem', color: '#4f46e5', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={15} className="spinner" />
                <span>{statusStep || 'Processing API request...'}</span>
              </span>
            )}

            <button
              type="submit"
              disabled={isFetching}
              className="btn btn-primary"
              style={{
                height: '46px',
                padding: '0 28px',
                fontSize: '0.9rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.28)'
              }}
            >
              {isFetching ? (
                <>
                  <RefreshCw size={16} className="spinner" />
                  <span>Fetching & Ingesting...</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Fetch & Ingest into Warehouse</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Success Ingestion Result Card */}
      {result && (
        <div className="glass-panel" style={{
          padding: '24px',
          background: '#ffffff',
          border: '1.5px solid #86efac',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 6px 20px rgba(16, 185, 129, 0.1)',
          animation: 'slideUp 0.3s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#15803d'
              }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h4 style={{ fontSize: '1.2rem', color: '#0f172a', marginBottom: '2px' }}>
                  API Ingestion & Cleaning Complete!
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Table <strong>"{result.table_name}"</strong> successfully created inside SQLite warehouse.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => setActiveTab && setActiveTab('analytics')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
              >
                <Sparkles size={15} />
                <span>View in AI Dashboard</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setActiveTab && setActiveTab('schema')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
              >
                <TableIcon size={15} />
                <span>Explore Schema & SQL</span>
              </button>
            </div>
          </div>

          {/* Metrics summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block' }}>Total Ingested Rows</span>
              <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>{result.row_count?.toLocaleString()}</span>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block' }}>Cleaned Columns</span>
              <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>{result.column_count}</span>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block' }}>Duplicates Purged</span>
              <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#059669' }}>
                {result.cleaning_summary?.duplicates_removed || 0}
              </span>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block' }}>Null Values Repaired</span>
              <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0284c7' }}>
                {result.cleaning_summary?.null_values_filled || 0}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
