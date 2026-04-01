import React from 'react';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, variant = 'danger' }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: variant === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: variant === 'danger' ? 'var(--brand-danger)' : 'var(--brand-warning)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <span className="modal-title">{title}</span>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onCancel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Annuler</button>
          <button
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-warning'}`}
            onClick={() => { onConfirm(); }}
            style={{ background: variant === 'danger' ? 'var(--brand-danger)' : 'var(--brand-warning)', color: 'white' }}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
