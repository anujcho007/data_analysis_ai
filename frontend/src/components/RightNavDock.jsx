import React, { useEffect } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  Server, 
  UploadCloud, 
  Network, 
  Users, 
  UserCheck,
  ChevronRight, 
  Sparkles, 
  ChevronLeft,
  X,
  Compass,
  ArrowRight,
  Megaphone
} from 'lucide-react';

export default function RightNavDock({
  activeTab,
  setActiveTab,
  currentUser,
  uploadStatus,
  isVisible,
  onToggleVisible,
  isMobile,
  onCloseMobile,
  onToggleCopilot
}) {
  const isAdmin = currentUser?.role === 'admin';

  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Overview', 
      desc: 'KPIs & table directory', 
      icon: LayoutDashboard,
      badge: null,
      color: '#4f46e5'
    },
    { 
      id: 'analytics', 
      label: 'BI Analytics', 
      desc: 'Charts, aggregations & SQL', 
      icon: BarChart3,
      badge: 'BI',
      color: '#0284c7'
    },
    { 
      id: 'predictive', 
      label: 'AI Predictive Studio', 
      desc: 'AutoML & Digital Twin', 
      icon: TrendingUp,
      badge: 'Twin AI',
      color: '#7c3aed'
    },
    { 
      id: 'customers', 
      label: 'Customer 360 & RFM', 
      desc: 'RFM cohorts & retention', 
      icon: UserCheck,
      badge: 'Growth',
      color: '#0d9488'
    },
    { 
      id: 'campaigns', 
      label: 'Campaign Studio', 
      desc: 'Marketing attribution & Power BI', 
      icon: Megaphone,
      badge: 'Attribution',
      color: '#e11d48'
    },
    { 
      id: 'alerts', 
      label: 'Watchdog Alerts', 
      desc: 'Automated anomaly detection', 
      icon: ShieldAlert,
      badge: null,
      color: '#e11d48'
    },
    { 
      id: 'connectors', 
      label: 'Live Connectors', 
      desc: 'PostgreSQL, MySQL, SQLite', 
      icon: Server,
      badge: 'Phase 2',
      color: '#059669'
    },
    { 
      id: 'upload', 
      label: 'Upload & Clean', 
      desc: 'Autonomous CSV ingestion', 
      icon: UploadCloud,
      badge: null,
      color: '#d97706'
    },
    { 
      id: 'schema', 
      label: 'Star Schema & SQL', 
      desc: 'Relationships & data explorer', 
      icon: Network,
      badge: null,
      color: '#4f46e5'
    },
  ];

  if (isAdmin) {
    navItems.push({
      id: 'users',
      label: 'User Management',
      desc: 'Enterprise roles & RBAC',
      icon: Users,
      badge: 'Admin',
      color: '#9333ea'
    });
  }

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle tabs
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggleVisible();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleVisible]);

  // Handle Tab Click
  const handleItemClick = (id) => {
    setActiveTab(id);
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  // If mobile drawer
  if (isMobile) {
    if (!isVisible) return null;

    return (
      <div 
        className="mobile-nav-backdrop" 
        onClick={onCloseMobile}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease'
        }}
      >
        <div 
          className="mobile-nav-drawer"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '85%',
            maxWidth: '340px',
            height: '100%',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            overflowY: 'auto'
          }}
        >
          {/* Drawer Header */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--gradient-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow)'
              }}>
                <Compass size={20} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: '800', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
                  Navigation Tabs
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {navItems.length} Workspace Views
                </div>
              </div>
            </div>

            <button
              onClick={onCloseMobile}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
              title="Close Navigation Drawer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Items */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isUploadingTab = item.id === 'upload' && uploadStatus?.isUploading;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: isActive ? '1px solid #c7d2fe' : '1px solid transparent',
                    background: isActive ? 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 4px 14px rgba(79, 70, 229, 0.12)' : '0 1px 3px rgba(15, 23, 42, 0.03)'
                  }}
                >
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: isActive ? item.color : '#f1f5f9',
                    color: isActive ? '#ffffff' : item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? `0 4px 12px ${item.color}40` : 'none'
                  }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: isActive ? '700' : '600',
                      color: isActive ? '#4338ca' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>{item.label}</span>
                      {item.badge && (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: '700',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: isActive ? '#c7d2fe' : '#f1f5f9',
                          color: isActive ? '#3730a3' : '#64748b'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.desc}
                    </div>
                  </div>
                  {isUploadingTab && (
                    <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  )}
                  {isActive && <ChevronRight size={16} color="#4f46e5" />}
                </button>
              );
            })}
          </div>

          {/* Drawer Footer with Copilot */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: '#ffffff' }}>
            <button
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                if (onToggleCopilot) onToggleCopilot();
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: '700',
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(79, 70, 229, 0.35)'
              }}
            >
              <Sparkles size={16} color="#fbbf24" />
              <span>Ask AI Copilot</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop Dock Layout
  return (
    <aside 
      className={`right-nav-dock ${isVisible ? 'is-visible' : 'is-hidden'}`}
      style={{
        width: isVisible ? '280px' : '0px',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        display: isVisible ? 'block' : 'none',
        transition: 'width 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      <div style={{
        width: '280px',
        padding: '0 0 24px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Navigation Dock Glass Card */}
        <div className="glass-panel" style={{
          padding: '14px',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border-color)',
          borderRadius: '18px',
          boxShadow: '0 8px 30px -4px rgba(15, 23, 42, 0.08)'
        }}>
          {/* Dock Header with Tab Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 6px 12px 6px',
            borderBottom: '1px solid #f1f5f9',
            marginBottom: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
              }}>
                <Compass size={14} color="#ffffff" />
              </div>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: '800',
                color: '#1e293b',
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}>
                Workspace Tabs
              </span>
            </div>

            {/* User Right to Hide Tabs button */}
            <button
              onClick={onToggleVisible}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: '0.72rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eef2ff';
                e.currentTarget.style.color = '#4338ca';
                e.currentTarget.style.borderColor = '#c7d2fe';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
              title="Hide navigation tabs to expand workspace (Ctrl+B)"
            >
              <span>Hide</span>
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Tab Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isUploadingTab = item.id === 'upload' && uploadStatus?.isUploading;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 10px',
                    borderRadius: '10px',
                    border: isActive ? '1px solid #c7d2fe' : '1px solid transparent',
                    background: isActive 
                      ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)' 
                      : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.18s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  {/* Left Active Glow Bar */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: '15%',
                      bottom: '15%',
                      width: '3px',
                      borderRadius: '0 4px 4px 0',
                      background: item.color,
                      boxShadow: `0 0 8px ${item.color}`
                    }} />
                  )}

                  {/* Icon Box */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: isActive ? item.color : '#f1f5f9',
                    color: isActive ? '#ffffff' : item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isActive ? `0 3px 10px ${item.color}35` : 'none'
                  }}>
                    <Icon size={16} />
                  </div>

                  {/* Label & Description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      lineHeight: 1.2
                    }}>
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: isActive ? '700' : '600',
                        color: isActive ? '#312e81' : '#1e293b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: '700',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: isActive ? '#e0e7ff' : '#f1f5f9',
                          color: isActive ? '#4338ca' : '#64748b'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.68rem',
                      color: isActive ? '#6366f1' : 'var(--text-muted)',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {item.desc}
                    </div>
                  </div>

                  {/* Live Upload Progress Indicator */}
                  {isUploadingTab && (
                    <span className="spinner" style={{ width: '12px', height: '12px', border: '1.5px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* AI Copilot Quick Assist Banner */}
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            borderRadius: '12px',
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Sparkles size={14} color="#fbbf24" />
              <span style={{ fontSize: '0.78rem', fontWeight: '800', letterSpacing: '0.02em' }}>
                AI Data Copilot
              </span>
            </div>
            <p style={{ fontSize: '0.69rem', color: '#c7d2fe', lineHeight: 1.4, marginBottom: '10px' }}>
              Ask questions in natural language. Auto-generates SQL queries and analytics.
            </p>
            <button
              onClick={onToggleCopilot}
              style={{
                width: '100%',
                padding: '6px 10px',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
            >
              <span>Launch Copilot</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Keyboard tip */}
          <div style={{
            marginTop: '10px',
            textAlign: 'center',
            fontSize: '0.67rem',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}>
            <span>Tip: Press</span>
            <kbd style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              padding: '1px 5px',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              color: '#475569'
            }}>Ctrl+B</kbd>
            <span>to hide tabs</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
