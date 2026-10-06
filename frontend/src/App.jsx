import React, { useState, useEffect, Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './views/Dashboard';
import UploadView from './views/UploadView';
import LoginView from './views/LoginView';
import RightNavDock from './components/RightNavDock';
import FloatingNavTrigger from './components/FloatingNavTrigger';

// Lazy-loaded heavy analytical studios & drawers
const AnalyticsDashboard = lazy(() => import('./views/AnalyticsDashboard'));
const PredictiveStudio = lazy(() => import('./views/PredictiveStudio'));
const AlertsCenter = lazy(() => import('./views/AlertsCenter'));
const SchemaExplorer = lazy(() => import('./views/SchemaExplorer'));
const UserManagement = lazy(() => import('./views/UserManagement'));
const CopilotDrawer = lazy(() => import('./components/CopilotDrawer'));
const WorkspaceModal = lazy(() => import('./components/WorkspaceModal'));
const DatabaseConnector = lazy(() => import('./components/DatabaseConnector'));
const CustomerStudio = lazy(() => import('./views/CustomerStudio'));

function StudioLoadingFallback({ label = "Loading Studio..." }) {
  return (
    <div style={{
      minHeight: '380px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(8px)',
      borderRadius: '20px',
      border: '1px solid #e2e8f0',
      padding: '40px',
      boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.35)',
        animation: 'pulse 1.5s infinite'
      }}>
        <Loader2 size={22} color="#ffffff" className="spinner" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Preparing analytical engines & visualizations...
        </div>
      </div>
    </div>
  );
}
import { 
  fetchStats, 
  fetchTables, 
  fetchRelationships, 
  fetchCurrentUser, 
  logoutUser, 
  getStoredToken 
} from './api/client';
import { Sparkles, CheckCircle2, Loader2, ArrowRight, X } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [isTabsVisible, setIsTabsVisible] = useState(() => {
    const saved = localStorage.getItem('dataforge_right_tabs_visible');
    return saved !== null ? saved === 'true' : true;
  });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  // Responsive breakpoint listener (desktop vs mobile/tablet)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth <= 1200);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleTabsVisible = () => {
    setIsTabsVisible(prev => {
      const next = !prev;
      localStorage.setItem('dataforge_right_tabs_visible', String(next));
      return next;
    });
  };
  const [stats, setStats] = useState({
    total_tables: 0,
    total_rows: 0,
    fact_tables_count: 0,
    dimension_tables_count: 0,
    total_duplicates_removed: 0,
    total_nulls_filled: 0,
    total_users: 0
  });
  const [tables, setTables] = useState([]);
  const [relationships, setRelationships] = useState([]);

  // Background Upload Persistence & Progress State
  const [uploadStatus, setUploadStatus] = useState({
    isUploading: false,
    completedFiles: 0,
    totalFiles: 0,
    statusText: ''
  });
  const [uploadToast, setUploadToast] = useState(null);

  // Auto-dismiss upload completion notification after 8 seconds
  useEffect(() => {
    if (uploadToast) {
      const timer = setTimeout(() => {
        setUploadToast(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [uploadToast]);

  // Verify authentication on startup
  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        setIsAuthChecking(false);
        return;
      }

      try {
        const user = await fetchCurrentUser();
        setCurrentUser(user);
        await loadAllData();
      } catch (err) {
        console.warn('Session verification failed:', err);
        setCurrentUser(null);
      } finally {
        setIsAuthChecking(false);
      }
    };

    checkAuth();
  }, []);

  const loadAllData = async () => {
    try {
      const [statsData, tablesData, relsData] = await Promise.all([
        fetchStats().catch(() => ({})),
        fetchTables().catch(() => []),
        fetchRelationships().catch(() => [])
      ]);
      setStats(statsData || {});
      setTables(tablesData || []);
      setRelationships(relsData || []);
    } catch (err) {
      console.error('Error loading warehouse data:', err);
    }
  };

  const handleUploadComplete = async () => {
    await loadAllData();
    setUploadToast({
      message: 'All datasets successfully cleaned & ingested into warehouse!',
      id: Date.now()
    });
  };

  const handleLoginSuccess = async (user) => {
    setCurrentUser(user);
    if (user.role !== 'admin' && activeTab === 'users') {
      setActiveTab('dashboard');
    }
    await loadAllData();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Calls backend /api/auth/logout which drops all user tables from SQLite
      await logoutUser();
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      setCurrentUser(null);
      setTables([]);
      setRelationships([]);
      setStats({
        total_tables: 0,
        total_rows: 0,
        fact_tables_count: 0,
        dimension_tables_count: 0,
        total_duplicates_removed: 0,
        total_nulls_filled: 0,
        total_users: 0
      });
      setActiveTab('dashboard');
      setIsLoggingOut(false);
    }
  };

  // Show splash loader while checking JWT token validity
  if (isAuthChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        gap: '16px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '14px',
          background: 'var(--gradient-brand)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-glow)',
          animation: 'pulse 1.5s infinite'
        }}>
          <Sparkles size={26} color="#ffffff" />
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
          Verifying security credentials...
        </div>
      </div>
    );
  }

  // If user is not authenticated, render LoginView
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Logout Overlay Indicator */}
      {isLoggingOut && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#e11d48',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Dropping warehouse tables & cleaning session...
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Next login will start with a fresh, empty dashboard.
          </div>
        </div>
      )}

      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        stats={stats} 
        currentUser={currentUser}
        onLogout={handleLogout}
        uploadStatus={uploadStatus}
        onToggleCopilot={() => setIsCopilotOpen(prev => !prev)}
        isCopilotOpen={isCopilotOpen}
        onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
        isTabsVisible={isTabsVisible}
        onToggleTabs={toggleTabsVisible}
        isMobile={isMobileScreen}
        onOpenMobileTabs={() => setIsMobileNavOpen(true)}
      />

      <div className="app-workspace-container">
        <main className="app-main-content" style={{ position: 'relative', zIndex: 1 }}>
          {activeTab === 'dashboard' && (
            <Dashboard 
              stats={stats} 
              tables={tables} 
              relationships={relationships} 
              setActiveTab={setActiveTab}
              onRefresh={loadAllData} 
            />
          )}

          {activeTab === 'analytics' && (
            <Suspense fallback={<StudioLoadingFallback label="Loading BI Analytics Studio..." />}>
              <AnalyticsDashboard 
                tables={tables} 
                setActiveTab={setActiveTab} 
              />
            </Suspense>
          )}

          {activeTab === 'predictive' && (
            <Suspense fallback={<StudioLoadingFallback label="Loading Predictive Intelligence & Digital Twin..." />}>
              <PredictiveStudio 
                tables={tables} 
              />
            </Suspense>
          )}

          {activeTab === 'customers' && (
            <Suspense fallback={<StudioLoadingFallback label="Loading Customer 360 & Growth Studio..." />}>
              <CustomerStudio 
                tables={tables} 
              />
            </Suspense>
          )}

          {activeTab === 'alerts' && (
            <Suspense fallback={<StudioLoadingFallback label="Loading Anomaly Watchdog & Alerts Center..." />}>
              <AlertsCenter 
                tables={tables} 
              />
            </Suspense>
          )}

          {activeTab === 'connectors' && (
            <Suspense fallback={<StudioLoadingFallback label="Loading Live Database Connectors..." />}>
              <div style={{
                background: '#ffffff',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)'
              }}>
                <DatabaseConnector onSyncSuccess={handleUploadComplete} />
              </div>
            </Suspense>
          )}

          {/* Persistent Background UploadView: Never unmounted so uploads, chunk streams, and cleaning continue uninterrupted */}
          <div style={{ display: activeTab === 'upload' ? 'block' : 'none' }}>
            <UploadView 
              onUploadComplete={handleUploadComplete} 
              onUploadStateChange={setUploadStatus}
              setActiveTab={setActiveTab} 
            />
          </div>

          {activeTab === 'schema' && (
            <Suspense fallback={<StudioLoadingFallback label="Loading Star Schema Explorer & SQL Studio..." />}>
              <SchemaExplorer 
                tables={tables} 
                onRefresh={loadAllData} 
              />
            </Suspense>
          )}

          {/* User Management is only accessible to admins */}
          {activeTab === 'users' && currentUser?.role === 'admin' && (
            <Suspense fallback={<StudioLoadingFallback label="Loading User Management Console..." />}>
              <UserManagement 
                onUserChange={loadAllData} 
              />
            </Suspense>
          )}

          {activeTab === 'users' && currentUser?.role !== 'admin' && (
            <Dashboard 
              stats={stats} 
              tables={tables} 
              relationships={relationships} 
              setActiveTab={setActiveTab}
              onRefresh={loadAllData} 
            />
          )}
        </main>

        {/* Desktop Right Navigation Dock */}
        {!isMobileScreen && (
          <RightNavDock
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            uploadStatus={uploadStatus}
            isVisible={isTabsVisible}
            onToggleVisible={toggleTabsVisible}
            isMobile={false}
            onToggleCopilot={() => setIsCopilotOpen(prev => !prev)}
          />
        )}
      </div>

      {/* Mobile Drawer Right Navigation Dock */}
      {isMobileScreen && (
        <RightNavDock
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          uploadStatus={uploadStatus}
          isVisible={isMobileNavOpen}
          onToggleVisible={() => setIsMobileNavOpen(false)}
          isMobile={true}
          onCloseMobile={() => setIsMobileNavOpen(false)}
          onToggleCopilot={() => setIsCopilotOpen(prev => !prev)}
        />
      )}

      {/* Floating Trigger to easily restore tabs when hidden */}
      {!isMobileScreen && (
        <FloatingNavTrigger
          isVisible={isTabsVisible}
          onToggle={toggleTabsVisible}
        />
      )}

      {/* Floating Conversational AI Copilot Drawer */}
      <Suspense fallback={null}>
        {isCopilotOpen && (
          <CopilotDrawer
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
          />
        )}
      </Suspense>

      {/* Multi-Tenant Workspace & Team Portal */}
      <Suspense fallback={null}>
        {isWorkspaceModalOpen && (
          <WorkspaceModal
            isOpen={isWorkspaceModalOpen}
            onClose={() => setIsWorkspaceModalOpen(false)}
            activeWorkspace={activeWorkspace}
            onWorkspaceChanged={(ws) => {
              setActiveWorkspace(ws);
              loadAllData();
            }}
          />
        )}
      </Suspense>

      {/* Floating Background Upload Progress Pill (visible when user shifts to other tabs) */}
      {uploadStatus.isUploading && activeTab !== 'upload' && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#ffffff',
          border: '1.5px solid #818cf8',
          borderRadius: '16px',
          padding: '14px 20px',
          boxShadow: '0 14px 36px -4px rgba(79, 70, 229, 0.28)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          zIndex: 9000,
          animation: 'slideUp 0.3s ease',
          maxWidth: '440px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#e0e7ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Loader2 size={20} color="#4f46e5" className="spinner" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0f172a' }}>
                Background Ingestion
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#4f46e5' }}>
                {uploadStatus.progressPct || 0}%
              </span>
            </div>
            
            {/* Mini Progress Bar */}
            <div style={{
              width: '100%',
              height: '5px',
              background: '#f1f5f9',
              borderRadius: '9999px',
              overflow: 'hidden',
              marginTop: '4px',
              marginBottom: '4px'
            }}>
              <div style={{
                width: `${uploadStatus.progressPct || 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4f46e5, #06b6d4, #10b981)',
                borderRadius: '9999px',
                transition: 'width 0.25s ease'
              }} />
            </div>

            <span style={{
              fontSize: '0.72rem',
              color: '#64748b',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {uploadStatus.stageStatusText || uploadStatus.statusText || 'Cleaning and transforming datasets...'}
            </span>
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '7px 13px', fontSize: '0.75rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
            onClick={() => setActiveTab('upload')}
          >
            <span>View Progress</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Upload Completion Toast Notification (visible when user is on another tab) */}
      {uploadToast && activeTab !== 'upload' && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#ffffff',
          border: '1px solid #a7f3d0',
          borderRadius: '16px',
          padding: '12px 18px',
          boxShadow: '0 12px 32px -4px rgba(5, 150, 105, 0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 9000,
          animation: 'slideUp 0.3s ease'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>
              Upload Completed!
            </span>
            <span style={{ fontSize: '0.75rem', color: '#059669' }}>
              New tables are ready for analysis
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              onClick={() => {
                setUploadToast(null);
                setActiveTab('analytics');
              }}
            >
              Analyze Data
            </button>
            <button
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', fontSize: '1rem', lineHeight: 1 }}
              onClick={() => setUploadToast(null)}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.8125rem',
        marginTop: 'auto',
        background: '#ffffff',
        boxShadow: '0 -1px 3px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            DataForge AI • Automated Data Cleaning, Deduplication, and Star Schema Engine
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Backend: FastAPI + Pandas</span>
            <span>Database: SQLite Warehouse</span>
            <span>Authenticated as: <strong>{currentUser.username}</strong> ({currentUser.role})</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

