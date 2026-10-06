import React from 'react';
import { ChevronLeft, Layers, Compass } from 'lucide-react';

export default function FloatingNavTrigger({ isVisible, onToggle, activeTabTitle }) {
  if (isVisible) return null;

  return (
    <button
      onClick={onToggle}
      className="floating-nav-trigger"
      style={{
        position: 'fixed',
        right: '0',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 8900,
        background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        borderRight: 'none',
        borderRadius: '14px 0 0 14px',
        padding: '12px 10px 12px 8px',
        boxShadow: '-4px 8px 24px -2px rgba(79, 70, 229, 0.45)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-50%) translateX(-4px)';
        e.currentTarget.style.boxShadow = '-6px 10px 30px rgba(79, 70, 229, 0.6)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(-50%)';
        e.currentTarget.style.boxShadow = '-4px 8px 24px -2px rgba(79, 70, 229, 0.45)';
      }}
      title="Show Navigation Tabs (Ctrl+B)"
    >
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        background: 'rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <ChevronLeft size={16} color="#ffffff" />
      </div>

      <span style={{
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        fontSize: '0.72rem',
        fontWeight: '800',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#e0e7ff',
        padding: '4px 0'
      }}>
        Tabs
      </span>

      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#22c55e',
        boxShadow: '0 0 6px #22c55e'
      }} />
    </button>
  );
}
