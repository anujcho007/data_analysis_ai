import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  UploadCloud, 
  Users, 
  LayoutDashboard, 
  Network, 
  Sparkles, 
  Server, 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  LogOut, 
  ShieldCheck, 
  UserCheck, 
  Building2, 
  ChevronDown, 
  Plus, 
  Check, 
  Layers, 
  X,
  Menu,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { fetchWorkspaces, createWorkspace } from '../api/client';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  stats, 
  currentUser, 
  onLogout, 
  uploadStatus, 
  onToggleCopilot, 
  isCopilotOpen, 
  onOpenWorkspaceModal,
  isTabsVisible = true,
  onToggleTabs,
  isMobile = false,
  onOpenMobileTabs
}) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [isWsOpen, setIsWsOpen] = useState(false);
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [isWsSubmitting, setIsWsSubmitting] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsWsOpen(false);
        setIsCreatingWs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch workspaces on mount
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        const list = await fetchWorkspaces();
        if (list && list.length > 0) {
          setWorkspaces(list);
          const savedId = localStorage.getItem('dataforge_active_workspace_id');
          const matched = list.find(w => String(w.id) === String(savedId));
          setActiveWorkspace(matched || list[0]);
        }
      } catch (err) {
        console.warn('Failed to load workspaces:', err);
      }
    };
    loadWorkspaces();
  }, []);

  const handleSelectWorkspace = (ws) => {
    setActiveWorkspace(ws);
    localStorage.setItem('dataforge_active_workspace_id', ws.id);
    setIsWsOpen(false);
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setIsWsSubmitting(true);
    try {
      const created = await createWorkspace({ name: newWsName.trim(), description: 'Enterprise Multi-Tenant Workspace' });
      setWorkspaces(prev => [...prev, created]);
      setActiveWorkspace(created);
      localStorage.setItem('dataforge_active_workspace_id', created.id);
      setNewWsName('');
      setIsCreatingWs(false);
      setIsWsOpen(false);
    } catch (err) {
      alert(`Failed to create workspace: ${err.message}`);
    } finally {
      setIsWsSubmitting(false);
    }
  };

  const TAB_METADATA = {
    dashboard: { label: 'Overview', icon: LayoutDashboard, color: '#4f46e5' },
    analytics: { label: 'BI Analytics', icon: BarChart3, color: '#0284c7' },
    predictive: { label: 'AI Predictive Studio', icon: TrendingUp, color: '#7c3aed' },
    customers: { label: 'Customer 360 & RFM', icon: UserCheck, color: '#0d9488' },
    alerts: { label: 'Watchdog Alerts', icon: ShieldAlert, color: '#e11d48' },
    connectors: { label: 'Live Connectors', icon: Server, color: '#059669' },
    upload: { label: 'Upload & Clean', icon: UploadCloud, color: '#d97706' },
    schema: { label: 'Star Schema & Explorer', icon: Network, color: '#4f46e5' },
    users: { label: 'User Management', icon: Users, color: '#9333ea' },
  };

  const activeMeta = TAB_METADATA[activeTab] || TAB_METADATA.dashboard;
  const ActiveIcon = activeMeta.icon;

  const isAdmin = currentUser?.role === 'admin';
  const displayName = currentUser?.full_name || currentUser?.username || 'User';
  const roleTitle = isAdmin ? 'Administrator' : 'Data Analyst';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="app-navbar" style={{
      position: 'sticky',
      top: 0,
      zIndex: 900,
      background: 'rgba(255, 255, 255, 0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-color)',
      boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
      padding: '0 1.25rem',
      transition: 'all 0.2s ease'
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        height: '66px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        {/* Left Section: Brand & Workspace Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div 
            onClick={() => setActiveTab('dashboard')} 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
              flexShrink: 0
            }}>
              <Sparkles size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{
                fontSize: '1.18rem',
                fontWeight: '800',
                fontFamily: 'var(--font-heading)',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.1
              }}>
                DataForge AI
              </div>
              <div className="nav-brand-subtitle" style={{
                fontSize: '0.66rem',
                color: 'var(--text-muted)',
                fontWeight: '700',
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}>
                Smart Warehouse
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="nav-divider" style={{ width: '1px', height: '24px', background: '#e2e8f0' }} />

          {/* Workspace Switcher */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setIsWsOpen(!isWsOpen)}
              className="workspace-switcher-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '5px 10px',
                background: isWsOpen ? '#eef2ff' : '#f8fafc',
                border: isWsOpen ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                color: '#1e293b'
              }}
              title="Switch Workspace / Multi-Tenancy"
            >
              <Building2 size={14} color="#4f46e5" />
              <span style={{ fontSize: '0.78rem', fontWeight: '700', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeWorkspace?.name || 'Workspace'}
              </span>
              <span className="ws-tag-badge" style={{
                fontSize: '0.6rem',
                fontWeight: '700',
                padding: '1px 5px',
                borderRadius: '4px',
                background: '#e0e7ff',
                color: '#4338ca',
                letterSpacing: '0.04em'
              }}>
                PRO
              </span>
              <ChevronDown size={12} color="#64748b" style={{ transform: isWsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {/* Dropdown Menu */}
            {isWsOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: '280px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.04)',
                padding: '8px',
                zIndex: 1000,
                animation: 'slideUp 0.15s ease'
              }}>
                <div style={{ padding: '8px 10px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tenancy Workspaces
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>
                    {workspaces.length} active
                  </span>
                </div>

                {/* Workspace list */}
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {workspaces.map(ws => {
                    const isSelected = activeWorkspace?.id === ws.id;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => handleSelectWorkspace(ws)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: isSelected ? '#f5f3ff' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: isSelected ? '#4f46e5' : '#e2e8f0',
                            color: isSelected ? '#ffffff' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '700'
                          }}>
                            {ws.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: isSelected ? '#4338ca' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ws.name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              {ws.member_count || 1} seat • {ws.slug}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check size={14} color="#4f46e5" />}
                      </button>
                    );
                  })}
                </div>

                <div style={{ margin: '6px 0', borderTop: '1px solid #f1f5f9' }} />

                {/* Manage Workspaces & Teams Portal */}
                <button
                  onClick={() => {
                    setIsWsOpen(false);
                    if (onOpenWorkspaceModal) onOpenWorkspaceModal();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #c7d2fe',
                    background: '#eef2ff',
                    color: '#4338ca',
                    fontSize: '0.76rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginBottom: '6px'
                  }}
                >
                  <Users size={14} />
                  <span>Manage Workspaces & Teams</span>
                </button>

                {/* Create New Workspace trigger / form */}
                {!isCreatingWs ? (
                  <button
                    onClick={() => setIsCreatingWs(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px dashed #cbd5e1',
                      background: '#f8fafc',
                      color: '#4f46e5',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={14} />
                    <span>Create New Workspace</span>
                  </button>
                ) : (
                  <form onSubmit={handleCreateWorkspace} style={{ padding: '6px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                      Workspace Organization Name:
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Retail HQ or APAC Division"
                      value={newWsName}
                      onChange={(e) => setNewWsName(e.target.value)}
                      autoFocus
                      required
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '0.78rem',
                        borderRadius: '6px',
                        border: '1px solid #c7d2fe',
                        outline: 'none',
                        marginBottom: '8px'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="submit"
                        disabled={isWsSubmitting || !newWsName.trim()}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          background: '#4f46e5',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        {isWsSubmitting ? 'Creating...' : 'Create'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsCreatingWs(false); setNewWsName(''); }}
                        style={{
                          padding: '5px 8px',
                          background: '#f1f5f9',
                          color: '#64748b',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center: Active View Breadcrumb Indicator */}
        <div className="nav-center-breadcrumb" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '9999px',
          fontSize: '0.8rem',
          fontWeight: '700',
          color: '#1e293b'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '6px',
            background: `${activeMeta.color}18`,
            color: activeMeta.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ActiveIcon size={13} />
          </div>
          <span style={{ color: activeMeta.color }}>{activeMeta.label}</span>
          {uploadStatus?.isUploading && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 7px',
              background: '#e0e7ff',
              color: '#4338ca',
              borderRadius: '9999px',
              fontSize: '0.67rem',
              fontWeight: '700'
            }}>
              <span className="spinner" style={{ width: '8px', height: '8px', border: '1.5px solid #4338ca', borderTopColor: 'transparent', borderRadius: '50%' }} />
              <span>{uploadStatus?.progressPct || 0}%</span>
            </span>
          )}
        </div>

        {/* Right Section: Copilot, Online Status, User Profile, Logout & Tabs Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Status pill (Hidden on narrow mobile screens) */}
          <div className="nav-status-pill" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 9px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '9999px',
            fontSize: '0.72rem',
            color: '#059669',
            fontWeight: '700'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px #10b981'
            }} />
            <span>Online</span>
          </div>

          {/* Conversational AI Copilot Launcher */}
          <button
            onClick={onToggleCopilot}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: isCopilotOpen 
                ? '#3730a3' 
                : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9px',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px -2px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            title="Open Conversational AI Copilot (Natural Language SQL & Analytics)"
          >
            <Sparkles size={14} color="#fbbf24" />
            <span className="copilot-btn-text">Ask Copilot</span>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 6px #22c55e'
            }} />
          </button>

          {/* User Profile Card */}
          <div className="nav-user-card" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            background: '#ffffff',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: isAdmin 
                ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
                : 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#ffffff',
              flexShrink: 0
            }}>
              {initial}
            </div>
            <div className="nav-user-details" style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {currentUser?.username || 'user'}
              </div>
              <div style={{ 
                fontSize: '0.66rem', 
                color: isAdmin ? '#7c3aed' : '#0284c7', 
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}>
                {isAdmin ? <ShieldCheck size={10} /> : <UserCheck size={10} />}
                <span>{roleTitle}</span>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Log Out & Drop Session Tables"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #fecdd3',
              background: '#fff1f2',
              color: '#e11d48',
              fontSize: '0.78rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ffe4e6';
              e.currentTarget.style.borderColor = '#fda4af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff1f2';
              e.currentTarget.style.borderColor = '#fecdd3';
            }}
          >
            <LogOut size={14} color="#e11d48" />
            <span className="logout-btn-text">Log Out</span>
          </button>

          {/* Right Tabs Toggle Button (Desktop & Tablet) */}
          <button
            onClick={onToggleTabs}
            className="nav-tabs-toggle-desktop"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '9px',
              border: isTabsVisible ? '1px solid #cbd5e1' : 'none',
              background: isTabsVisible 
                ? '#f8fafc' 
                : 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
              color: isTabsVisible ? '#475569' : '#ffffff',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: isTabsVisible ? 'none' : '0 4px 14px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap'
            }}
            title={isTabsVisible ? "Hide right tabs to expand workspace (Ctrl+B)" : "Show right navigation tabs (Ctrl+B)"}
          >
            <Layers size={14} />
            <span>{isTabsVisible ? 'Hide Tabs ❯' : '❮ Show Tabs'}</span>
          </button>

          {/* Mobile Drawer Hamburger Button */}
          <button
            onClick={onOpenMobileTabs}
            className="nav-tabs-toggle-mobile"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
            }}
            title="Open Navigation Menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
