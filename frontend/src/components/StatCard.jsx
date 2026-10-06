import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, accentColor = '#6366f1', badge }) {
  return (
    <div className="glass-panel" style={{
      padding: 'clamp(16px, 2vw, 24px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      position: 'relative',
      overflow: 'hidden',
      minWidth: 0,
      boxSizing: 'border-box'
    }}>
      {/* Decorative top accent line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        {Icon && (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: `${accentColor}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
            border: `1px solid ${accentColor}30`,
            flexShrink: 0
          }}>
            <Icon size={16} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
        <div style={{
          fontSize: 'clamp(1.35rem, 2vw, 1.9rem)',
          fontWeight: '800',
          fontFamily: 'var(--font-heading)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {value}
        </div>
        {badge && (
          <span style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '6px',
            background: `${accentColor}20`,
            color: accentColor,
            fontWeight: '600'
          }}>
            {badge}
          </span>
        )}
      </div>

      {subtitle && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
