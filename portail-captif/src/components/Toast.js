import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { usePortal } from '../context/PortalContext';

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

const TITLES = {
  success: 'Operation reussie',
  error: 'Attention',
  warning: 'Avertissement',
  info: 'Information',
};

export default function ToastContainer() {
  const { toasts, removeToast } = usePortal();
  const current = toasts[0];

  useEffect(() => {
    if (!current) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') removeToast(current.id);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, removeToast]);

  if (!current) return null;

  const Icon = ICONS[current.type] || ICONS.info;
  const title = TITLES[current.type] || TITLES.info;
  const dialogId = `dialog-${current.id}`;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={() => removeToast(current.id)}>
      <div
        className={`dialog-card ${current.type}`}
        role="dialog"
        aria-modal="true"
        aria-live="assertive"
        aria-labelledby={dialogId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div className="dialog-title-wrap">
            <span className={`dialog-icon ${current.type}`}>
              <Icon size={20} strokeWidth={2.25} />
            </span>
            <h3 id={dialogId} className="dialog-title">{title}</h3>
          </div>
          <button
            onClick={() => removeToast(current.id)}
            className="dialog-close"
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        <p className="dialog-message">{current.message}</p>

        <div className="dialog-actions">
          <button onClick={() => removeToast(current.id)} className="btn btn-primary dialog-btn">
            Compris
          </button>
        </div>
      </div>
    </div>
  );
}
