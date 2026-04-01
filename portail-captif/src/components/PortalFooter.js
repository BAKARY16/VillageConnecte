import React from 'react';
import {Globe} from 'lucide-react';

export default function PortalFooter() {
  return (
    <footer className="portal-footer">
      <p style={{ marginBottom: 6, color: 'var(--text-inverse)', alignItems: 'center', gap: 6 }}>
        <Globe size={14} /> Réseau WiFi communautaire · Dioradougou · Région de Man, Côte d'Ivoire
      </p>
      <p>
        <a style={{color: 'var(--text-inverse)'}}>Paiements sécurisés via</a>{' '}
        <a href="#" style={{ color: 'var(--brand-secondary)' }}>CinetPay</a>
        {' '}·{' '}
        <a href="#" style={{ color: 'var(--brand-primary)' }}>Aide & Support</a>
        {' '}·{' '}
        <a href="#" style={{ color: 'var(--text-inverse)'}}>FabLab UVCI</a>
      </p>
      <p style={{ marginTop: 8, fontSize: '0.67rem', color: 'var(--text-inverse)' }}>
        © 2026 Village Connecté — FabLab UVCI · Tous droits réservés
      </p>
    </footer>
  );
}
