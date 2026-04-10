// src/pages/UpgradePage.jsx — Shown when trial expires or subscription is inactive
// Redirects to Stripe Checkout when user clicks upgrade

import { useState } from 'react';

const G = '#059669';
const F = { sans: "'Inter',system-ui,sans-serif" };

const PLANS = [
  {
    id:    'starter',
    name:  'Starter',
    price: '$79',
    desc:  'Para distribuidoras chicas que empiezan',
    features: ['Hasta 3 usuarios', 'Stock y ventas', 'Rutas básicas', 'Soporte por email'],
  },
  {
    id:    'pro',
    name:  'Pro',
    price: '$149',
    desc:  'Todo lo que necesitás para operar',
    popular: true,
    features: ['Usuarios ilimitados', 'Portal B2B para clientes', 'Rutas con IA', 'Facturación DGI', 'Soporte prioritario'],
  },
];

export default function UpgradePage({ session, reason = 'trial_expired' }) {
  const [loading, setLoading] = useState(null);
  const [err, setErr] = useState('');

  const handleUpgrade = async (planId) => {
    setLoading(planId);
    setErr('');
    try {
      // MercadoPago — cambiar a /api/stripe cuando tengas LLC en Delaware
      const r = await fetch('/api/payments', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  'Bearer ' + session?.access_token,
        },
        body: JSON.stringify({ plan: planId, org_id: session?.orgId }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error || 'Error al iniciar el pago'); setLoading(null); return; }
      window.location.href = data.url;
    } catch {
      setErr('Error de conexion. Intentá de nuevo.');
      setLoading(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <img src="/pazque-logo.png" alt="Logo" style={{ height: 40, objectFit: 'contain', marginBottom: 20 }} onError={e => e.target.style.display = 'none'} />
        {reason === 'canceled' ? (
          <>
            <h1 style={{ fontFamily: F.sans, fontSize: 26, fontWeight: 700, color: '#1a1a18', marginBottom: 8 }}>
              Tu cuenta fue cancelada
            </h1>
            <p style={{ fontFamily: F.sans, fontSize: 15, color: '#6a6a68', maxWidth: 420 }}>
              Tus datos están guardados. Reactivá tu suscripción para volver a acceder.
            </p>
          </>
        ) : reason === 'trial_expired' ? (
          <>
            <h1 style={{ fontFamily: F.sans, fontSize: 26, fontWeight: 700, color: '#1a1a18', marginBottom: 8 }}>
              Tu periodo de prueba venció
            </h1>
            <p style={{ fontFamily: F.sans, fontSize: 15, color: '#6a6a68', maxWidth: 420 }}>
              Tus datos están seguros. Elegí un plan para seguir usando Pazque sin interrupciones.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: F.sans, fontSize: 26, fontWeight: 700, color: '#1a1a18', marginBottom: 8 }}>
              Elegí tu plan
            </h1>
            <p style={{ fontFamily: F.sans, fontSize: 15, color: '#6a6a68' }}>
              Sin contratos. Cancelá cuando quieras.
            </p>
          </>
        )}
      </div>

      {/* Plans */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700, width: '100%' }}>
        {PLANS.map(plan => (
          <div key={plan.id} style={{
            background: '#fff',
            border: plan.popular ? '2px solid '+G : '1px solid #e2e2de',
            borderRadius: 12,
            padding: '28px 32px',
            flex: '1 1 280px',
            maxWidth: 320,
            position: 'relative',
            boxShadow: plan.popular ? '0 8px 32px rgba(58,125,30,.12)' : '0 2px 8px rgba(0,0,0,.04)',
          }}>
            {plan.popular && (
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: G, color: '#fff', fontFamily: F.sans, fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, letterSpacing: '0.08em' }}>
                MAS POPULAR
              </div>
            )}
            <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: G, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{plan.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
              <span style={{ fontFamily: F.sans, fontSize: 36, fontWeight: 800, color: '#1a1a18' }}>{plan.price}</span>
              <span style={{ fontFamily: F.sans, fontSize: 13, color: '#6a6a68' }}>/mes</span>
            </div>
            <p style={{ fontFamily: F.sans, fontSize: 13, color: '#6a6a68', marginBottom: 20 }}>{plan.desc}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: 8 }}>
              {plan.features.map(f => (
                <li key={f} style={{ fontFamily: F.sans, fontSize: 13, color: '#2a2a28', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: G, fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade(plan.id)}
              disabled={!!loading}
              style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: 8,
                background: plan.popular ? G : '#1a1a18',
                color: '#fff', fontFamily: F.sans, fontSize: 14, fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading && loading !== plan.id ? 0.5 : 1,
              }}>
              {loading === plan.id ? 'Redirigiendo...' : 'Suscribirme →'}
            </button>
          </div>
        ))}
      </div>

      {err && (
        <p style={{ marginTop: 20, fontFamily: F.sans, fontSize: 13, color: '#dc2626' }}>{err}</p>
      )}

      <p style={{ marginTop: 32, fontFamily: F.sans, fontSize: 12, color: '#9a9a98', textAlign: 'center' }}>
        Pago seguro con MercadoPago · Cancelá cuando quieras · Soporte en {' '}
        <a href="mailto:hola@aryes.com" style={{ color: G }}>hola@aryes.com</a>
      </p>
    </div>
  );
}
