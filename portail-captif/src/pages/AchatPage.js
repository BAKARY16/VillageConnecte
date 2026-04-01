import React, { useState } from 'react';
import { usePortal, PAYMENT_METHODS } from '../context/PortalContext';
import { Star, ShieldCheck, Send, MapPin, HandCoins, Lightbulb, Smartphone } from 'lucide-react'

export default function AchatPage({ onSuccess }) {
  const { initPayment, activateSession, addToast, remoteTarifs } = usePortal();
  const tarifs = remoteTarifs || [];

  // Multi-step: plan → method → phone → processing → confirm_code → done
  const [step, setStep] = useState('plan');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [telephone, setTelephone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [confirmStep, setConfirmStep] = useState('waiting'); // waiting | verifying | done

  const steps = ['plan', 'method', 'phone', 'processing', 'voucher'];
  const stepIndex = steps.indexOf(step);

  // ── STEP 1: Sélection du plan ─────────────────────────────────────────────
  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setStep('method');
  };

  // ── STEP 2: Sélection du moyen de paiement ───────────────────────────────
  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
    if (method.id === 'cash') {
      setStep('phone');  // even cash: ask phone for confirmation
    } else {
      setStep('phone');
    }
  };

  // ── STEP 3: Saisie du numéro ──────────────────────────────────────────────
  const validatePhone = () => {
    const digits = telephone.replace(/\D/g, '');
    if (selectedMethod?.id === 'cash') return true;
    if (digits.length < 8) { setPhoneError('Numéro invalide (minimum 8 chiffres)'); return false; }
    return true;
  };

  const handleSubmitPhone = async () => {
    if (!validatePhone()) return;
    setPhoneError('');
    setStep('processing');
    setLoading(true);

    const result = await initPayment({
      tarif: selectedPlan,
      methode: selectedMethod,
      telephone,
    });

    setLoading(false);

    if (result.ok) {
      setPaymentResult(result);
      setStep('voucher');
      addToast('Paiement confirmé ! Votre code est prêt.', 'success');
    } else {
      addToast(result.error, 'error');
      setStep('phone');
    }
  };

  // ── STEP 5: Activation depuis le voucher reçu ─────────────────────────────
  const handleActivateReceived = async () => {
    if (!paymentResult?.voucher) return;
    setConfirmStep('verifying');
    const result = await activateSession(paymentResult.voucher);
    if (result.ok) {
      setConfirmStep('done');
      addToast('Connexion activée ! Bon surf 🌐', 'success');
      setTimeout(() => onSuccess(result.session), 800);
    }
  };

  const stepLabels = ['Forfait', 'Paiement', 'Téléphone', 'Traitement', 'Code'];

  return (
    <div className="animate-fadeInUp">
      {/* Progress steps */}
      <div style={{ marginBottom: 6 }}>
        <div className="steps">
          {[0, 1, 2, 3, 4].map((i) => (
            <React.Fragment key={i}>
              <div className="step">
                <div className={`step-dot ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}`}>
                  {i < stepIndex ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg> : i + 1}
                </div>
              </div>
              {i < 4 && <div className={`step-line ${i < stepIndex ? 'done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
        <div className="steps-labels">
          {stepLabels.map((l, i) => (
            <div key={i} style={{ fontSize: '0.62rem', color: i === stepIndex ? 'var(--brand-primary)' : i < stepIndex ? 'var(--brand-success)' : 'var(--text-muted)', fontWeight: i === stepIndex ? 700 : 400, width: 60, textAlign: 'center' }}>
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* ── STEP 1: Choisir un forfait ─────────────────────────────────────── */}
      {step === 'plan' && (
        <div className="animate-fadeInUp">
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 5 }}>Choisissez votre forfait</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Forfaits charges depuis le backend en temps reel</div>
          </div>

          {tarifs.length === 0 && (
            <div className="info-box yellow" style={{ marginBottom: 16 }}>
              <span><ShieldCheck /></span>
              <span>Aucun forfait disponible pour le moment. Verifiez que l API backend et la base MySQL sont bien en ligne.</span>
            </div>
          )}

          <div className="plan-grid">
            {tarifs.map(plan => {
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`plan-card ${isSelected ? 'selected' : ''}`}
                  style={{
                    '--plan-color': plan.color,
                    '--plan-bg': `${plan.color}11`,
                    '--plan-glow': `${plan.color}22`,
                  }}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {plan.populaire &&
                    <span className="plan-badge" style={{display: 'flex', gap: '0.3rem'}} ><Star size={12} /> Populaire</span>}
                  <div className="plan-name">{plan.nom}</div>
                  <div className="plan-price" style={{ color: isSelected ? plan.color : undefined }}>{plan.prix}</div>
                  <span className="plan-currency">FCFA</span>
                  <div className="plan-duration" style={{ color: isSelected ? plan.color : undefined }}>{plan.duree}</div>
                  <div className="plan-speed">{plan.vitesse}</div>
                </div>
              );
            })}
          </div>

          {/* Value comparison */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginTop: 8 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Comparaison des forfaits</div>
            {tarifs.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                <span style={{ color: t.color, fontWeight: 600 }}>{t.nom}</span>
                <span style={{ color: 'var(--text-muted)' }}>{t.duree}</span>
                <span style={{ fontWeight: 700 }}>{t.prix} FCFA</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>= {t.dureeH ? (t.prix / (t.dureeH / 24)).toFixed(0) : '-'} FCFA/j</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Choisir le mode de paiement ───────────────────────────── */}
      {step === 'method' && selectedPlan && (
        <div className="animate-fadeInUp">
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 5 }}>Moyen de paiement</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Payer <strong style={{ color: 'var(--brand-secondary)' }}>{selectedPlan.prix} FCFA</strong> pour le forfait {selectedPlan.nom}
            </div>
          </div>

          <div className="payment-grid">
            {PAYMENT_METHODS.map(pm => {
              const isSelected = selectedMethod?.id === pm.id;
              return (
                <div
                  key={pm.id}
                  className={`payment-card ${isSelected ? 'selected' : ''} ${pm.id === 'cash' ? 'full-width' : ''}`}
                  style={{ '--pm-color': pm.color, '--pm-bg': pm.bg }}
                  onClick={() => handleSelectMethod(pm)}
                >
                  <div className="pm-icon" style={{fontSize: '1.4rem', borderRadius: 8}}>
                    {pm.logo ? (
                      <img src={pm.logo} alt={pm.nom} style={{ height: 32,border: 8, objectFit: 'contain', maxWidth: 48 }} />
                    ) : (
                      pm.emoji || pm.nom
                    )}
                  </div>
                  <div className="pm-info">
                    <div className="pm-name" style={{ color: isSelected ? pm.color : undefined }}>{pm.nom}</div>
                    <div className="pm-desc">{pm.desc}</div>
                  </div>
                  <div className="pm-check" style={isSelected ? { background: pm.color, borderColor: pm.color } : {}}>
                    {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="info-box yellow" style={{ marginBottom: 16 }}>
            <span>< ShieldCheck /></span>
            <span>Paiement 100% sécurisé via CinetPay. Votre code WiFi sera généré instantanément après confirmation.</span>
          </div>

          <button className="btn btn-ghost" onClick={() => setStep('plan')}>← Changer de forfait</button>
        </div>
      )}

      {/* ── STEP 3: Saisir le téléphone ────────────────────────────────────── */}
      {step === 'phone' && selectedPlan && selectedMethod && (
        <div className="animate-fadeInUp">
          {/* Recap */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>FORFAIT SÉLECTIONNÉ</div>
              <div style={{ fontWeight: 700, color: selectedPlan.color }}>{selectedPlan.nom} · {selectedPlan.duree}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>PAIEMENT VIA</div>
              <div style={{ fontWeight: 700 }}>{selectedMethod.emoji} {selectedMethod.nom}</div>
            </div>
          </div>

          {/* Amount */}
          <div className="amount-display">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Montant à payer</div>
            <div className="amount-value">{selectedPlan.prix}</div>
            <div className="amount-currency">Francs CFA (FCFA)</div>
          </div>

          {selectedMethod.id !== 'cash' ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>Votre numéro {selectedMethod.nom}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Un paiement de <strong>{selectedPlan.prix} FCFA</strong> sera initié sur ce numéro
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>{selectedMethod.emoji}</span> Numéro de téléphone
                </label>
                <div className="input-wrapper">
                  <span className="phone-prefix">🇨🇮 +225</span>
                  <input
                    className="form-input phone-input"
                    type="tel"
                    inputMode="numeric"
                    value={telephone}
                    onChange={e => {
                      setTelephone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setPhoneError('');
                    }}
                    placeholder="07 XX XX XX XX"
                    autoFocus
                    style={{ borderColor: phoneError ? 'var(--brand-danger)' : undefined }}
                  />
                </div>
                {phoneError && <div style={{ color: 'var(--brand-danger)', fontSize: '0.78rem', marginTop: 6 }}>⚠️ {phoneError}</div>}
              </div>

              {/* USSD hint */}
              {selectedMethod.ussd && (
                <div className="info-box blue" style={{ marginBottom: 16 }}>
                  <span><Smartphone /></span>
                  <span>
                    Assurez-vous que votre compte <strong>{selectedMethod.nom}</strong> est approvisionné.
                    {selectedMethod.ussd !== 'App Wave' && <> Code USSD : <strong>{selectedMethod.ussd}</strong></>}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Cash agent flow */
            <div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>Payer chez un agent local</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Rendez-vous chez un agent WiFi du village avec <strong>{selectedPlan.prix} FCFA</strong>. L'agent vous remettra un code d'accès.
                </div>
              </div>
              <div className="info-box green" style={{ marginBottom: 16 }}>
                <span><MapPin /></span>
                <span>Les agents sont disponibles au marché central, à la mairie et aux principales entrées du village.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Votre numéro (pour confirmation SMS)</label>
                <div className="input-wrapper">
                  <span className="phone-prefix">🇨🇮 +225</span>
                  <input className="form-input phone-input" type="tel" inputMode="numeric" value={telephone} onChange={e => setTelephone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="07 XX XX XX XX (optionnel)" />
                </div>
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleSubmitPhone} disabled={selectedMethod.id !== 'cash' && telephone.replace(/\D/g, '').length < 8}>
            {selectedMethod.id === 'cash' ? (
              <><HandCoins style={{marginRight: 4, marginBottom: -2}} size={18}/> Générer ma demande</>
            ) : (
              <><Send style={{marginRight: 6, marginBottom: -1}} size={16}/>Payer {selectedPlan.prix} FCFA via {selectedMethod.nom}</>
            )}
          </button>
          <button className="btn btn-ghost" onClick={() => setStep('method')} style={{ marginTop: 8 }}>← Changer de méthode</button>
        </div>
      )}

      {/* ── STEP 4: Traitement en cours ───────────────────────────────────── */}
      {step === 'processing' && (
        <div className="status-screen animate-fadeIn">
          <div className="status-icon-wrap loading">
            <div className="spinner"></div>
          </div>
          <div className="status-title">Traitement en cours...</div>
          <div className="status-subtitle">
            {selectedMethod?.id === 'cash'
              ? 'Génération de votre demande de paiement...'
              : `Initiation du paiement ${selectedMethod?.nom}. Veuillez confirmer sur votre téléphone si demandé.`}
          </div>
          {selectedMethod?.id !== 'cash' && (
            <div className="info-box yellow" style={{ maxWidth: 340 }}>
              <span>📳</span>
              <span>Vérifiez votre téléphone — vous pourriez recevoir une notification de confirmation de paiement.</span>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 5: Code reçu et activation ──────────────────────────────── */}
      {step === 'voucher' && paymentResult && (
        <div className="animate-scaleIn">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--brand-success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              ✓ Paiement confirmé
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>Votre code WiFi</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cliquez sur "Activer" pour vous connecter immédiatement</div>
          </div>

          <div className="voucher-display" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Code d'accès WiFi</div>
            <div className="voucher-code">{formatCodeDisplay(paymentResult.code)}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10 }}>
              Forfait {selectedPlan?.nom} · {selectedPlan?.duree} · {selectedPlan?.prix} FCFA
            </div>
          </div>

          {/* Details */}
          <div className="session-info" style={{ marginBottom: 16 }}>
            {[
              ['Référence paiement', paymentResult.ref],
              ['Moyen de paiement', `${selectedMethod?.emoji} ${selectedMethod?.nom}`],
              ['Montant payé', `${selectedPlan?.prix} FCFA`],
              ['Durée d\'accès', selectedPlan?.duree],
              ['Débit garanti', selectedPlan?.vitesse || paymentResult?.voucher?.vitesse || '-'],
            ].map(([k, v]) => (
              <div key={k} className="session-row">
                <span className="session-row-label">{k}</span>
                <span className="session-row-value" style={{ fontFamily: k === 'Référence paiement' ? 'JetBrains Mono, monospace' : undefined, fontSize: k === 'Référence paiement' ? '0.78rem' : undefined }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="info-box green" style={{ marginBottom: 16 }}>
            <span><Lightbulb /></span>
            <span>Notez votre code <strong>{paymentResult.code}</strong> — vous pourrez l'utiliser sur n'importe quelle borne WiFi du village.</span>
          </div>

          {confirmStep === 'waiting' && (
            <button className="btn btn-primary" onClick={handleActivateReceived}>
              <WifiIcon /> Activer ma connexion maintenant
            </button>
          )}
          {confirmStep === 'verifying' && (
            <button className="btn btn-primary" disabled>
              <SpinnerInline /> Activation en cours...
            </button>
          )}
          {confirmStep === 'done' && (
            <div className="status-screen" style={{ padding: '24px 0 0' }}>
              <div className="status-icon-wrap success" style={{ width: 56, height: 56 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand-success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--brand-success)' }}>Connexion activée !</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatCodeDisplay(code) {
  if (!code) return '';
  return code.replace(/(.{4})/g, '$1 ').trim();
}

const WifiIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>;
const SpinnerInline = () => <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>;
