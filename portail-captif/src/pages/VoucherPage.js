import React, { useState, useRef } from 'react';
import { usePortal } from '../context/PortalContext';
import { SunMoon, Calendar, CalendarDays } from 'lucide-react'

const EXAMPLE_CODES = [];

export default function VoucherPage({ onSuccess }) {
  const { validateVoucher, activateSession, addToast, portalMeta } = usePortal();
  const [code, setCode] = useState('');
  const [step, setStep] = useState('input');   // input | validating | confirm | activating | done
  const [voucher, setVoucher] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef();

  const handleCodeChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(val);
    setError('');
  };

  const handleValidate = async () => {
    if (code.length < 6) { setError('Le code doit contenir au moins 6 caractères.'); return; }
    setStep('validating');
    setError('');
    const result = await validateVoucher(code);
    if (!result.ok) {
      setError(result.error);
      setStep('input');
      return;
    }
    setVoucher(result.voucher);
    setStep('confirm');
  };

  const handleActivate = async () => {
    setStep('activating');
    const result = await activateSession(voucher);
    if (result.ok) {
      addToast('Connexion réussie !', 'success');
      setStep('done');
      setTimeout(() => onSuccess(result.session), 500);
    } else {
      setError('Erreur lors de l\'activation. Réessayez.');
      setStep('confirm');
    }
  };

  const typeConfig = {
    journalier: { color: '#7a2a7a', bg: 'rgba(85, 16, 77, 0.10)', icon: <SunMoon  />, label: '24 heures' },
    hebdomadaire: { color: '#6366F1', bg: 'rgba(99,102,241,0.1)', icon: <Calendar />, label: '7 jours' },
    mensuel: { color: '#F5A623', bg: 'rgba(245,166,35,0.1)', icon: <CalendarDays />, label: '30 jours' },
  };

  return (
    <div className="animate-fadeInUp">
      {/* Info réseau */}
      <div className="network-card animate-fadeInUp">
        <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <WifiIcon />
        </div>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 3 }}>
            Réseau WiFi Dioradougou
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Débit garanti : <strong style={{ color: 'var(--brand-primary)' }}>{portalMeta?.debitReferenceMbps || 0} Mbps</strong> · Borne {portalMeta?.borne?.id || '-'} · {portalMeta?.totalBornes || 0} points WiFi
          </div>
        </div>
      </div>

      {/* ÉTAPE 1 : Saisie du code */}
      {(step === 'input' || step === 'validating') && (
        <div className="animate-fadeInUp">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 6 }}>Entrez votre code voucher</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Saisissez le code reçu auprès d'un agent ou par SMS
            </div>
          </div>

          <div className="form-group">
            <div className="input-wrapper">
              <input
                ref={inputRef}
                className="form-input voucher-input"
                type="text"
                value={formatCode(code)}
                onChange={handleCodeChange}
                placeholder="XXXX XXXX"
                maxLength={9}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                style={{
                  borderColor: error ? 'var(--brand-danger)' : code.length === 8 ? 'var(--brand-primary)' : undefined,
                  boxShadow: code.length === 8 ? '0 0 0 3px rgba(0,200,150,0.12)' : undefined,
                }}
              />
            </div>
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--brand-danger)', fontSize: '0.8rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                {error}
              </div>
            )}
          </div>

          {/* Code progress indicator */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 20 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} style={{
                width: 24, height: 4,
                borderRadius: 99,
                background: i < code.length ? 'var(--brand-primary)' : 'var(--border-default)',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleValidate}
            disabled={code.length < 6 || step === 'validating'}
          >
            {step === 'validating' ? (
              <>
                <SpinnerInline /> Vérification en cours...
              </>
            ) : (
              <>
                <CheckIcon /> Valider mon code
              </>
            )}
          </button>

          {/* Hints */}
          {/* <div style={{ marginTop: 20 }}>
            <div className="info-box blue">
              <InfoIcon />
              <span>Codes de démonstration : <strong>ABC12345</strong>, <strong>TEST2026</strong>, <strong>DEMO9999</strong></span>
            </div>
          </div> */}

          {/* Quick fill demo */}
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {EXAMPLE_CODES.map(c => (
              <button
                key={c}
                onClick={() => { setCode(c); setError(''); }}
                style={{
                  fontSize: '0.7rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '4px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 6,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.target.style.borderColor = 'var(--brand-primary)'}
                onMouseLeave={e => e.target.style.borderColor = 'var(--border-default)'}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ÉTAPE 2 : Confirmation */}
      {(step === 'confirm' || step === 'activating') && voucher && (() => {
        const cfg = typeConfig[voucher.type] || typeConfig.journalier;
        return (
          <div className="animate-scaleIn">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>Confirmer l'activation</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Vérifiez les détails avant de vous connecter</div>
            </div>

            {/* Voucher card */}
            <div style={{
              background: `linear-gradient(${cfg.bg})`,
              border: `1.5px solid ${cfg.color}44`,
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              marginBottom: 20,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 12, right: 12, fontSize: '2rem', opacity: 1 }}>{cfg.icon}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Pass {voucher.type}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.4rem', fontWeight: 900, color: cfg.color, letterSpacing: '0.10em', marginBottom: 16 }}>
                {formatCode(voucher.code)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Durée', voucher.dureeLabel || cfg.label],
                  ['Débit', '5 Mbps'],
                  ['Prix payé', `${voucher.prix} FCFA`],
                  ['Connexions', 'Illimitées'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-box green" style={{ marginBottom: 16 }}>
              <CheckCircleIcon />
              <span>Ce code est valide et prêt à être utilisé. Votre accès démarrera immédiatement après activation.</span>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleActivate}
              disabled={step === 'activating'}
            >
              {step === 'activating' ? (
                <><SpinnerInline /> Connexion en cours...</>
              ) : (
                <><WifiIcon2 /> Activer et me connecter</>
              )}
            </button>

            <button
              className="btn btn-ghost"
              style={{ marginTop: 8 }}
              onClick={() => { setStep('input'); setVoucher(null); setError(''); }}
              disabled={step === 'activating'}
            >
              ← Modifier le code
            </button>
          </div>
        );
      })()}

      {/* ÉTAPE 3 : Succès */}
      {step === 'done' && (
        <div className="status-screen animate-scaleIn">
          <div className="status-icon-wrap success">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--brand-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'checkPop 0.4s ease 0.1s both' }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="status-title" style={{ color: 'var(--brand-success)' }}>Connexion réussie !</div>
          <div className="status-subtitle">Vous êtes maintenant connecté au réseau WiFi Village Connecté. Profitez d'Internet !</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-success">✓ Actif</span>
            <span className="badge badge-green">5 Mbps</span>
          </div>
          <div className="spinner" style={{ borderTopColor: 'var(--brand-primary)', width: 24, height: 24, borderWidth: 2 }}></div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Redirection vers votre tableau de bord...</div>
        </div>
      )}
    </div>
  );
}

// Format "ABC12345" → "ABC1 2345"
function formatCode(code) {
  if (!code) return '';
  const c = code.replace(/\s/g, '');
  if (c.length <= 4) return c;
  return c.slice(0, 4) + ' ' + c.slice(4);
}

// Icons
const WifiIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>;
const WifiIcon2 = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>;
const CheckIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>;
const CheckCircleIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /><circle cx="12" cy="12" r="10" /></svg>;
const InfoIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const SpinnerInline = () => <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>;
