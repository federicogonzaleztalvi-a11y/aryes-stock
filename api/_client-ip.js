// api/_client-ip.js — IP real del cliente, resistente a spoofing.
// ----------------------------------------------------------------------------
// PROBLEMA: usar `x-forwarded-for.split(',')[0]` toma el valor MÁS A LA IZQUIERDA,
// que lo controla el cliente. Un atacante manda `X-Forwarded-For: 1.2.3.4` y
// Vercel le APPENDEA la IP real a la derecha → "1.2.3.4, <IP real>". Tomando el
// primero, cada request parece venir de una IP distinta → el rate-limit por IP
// (OTP, etc.) se puede saltear rotando ese valor. Fuerza bruta sin freno.
//
// SOLUCIÓN: confiar sólo en headers que setea la infra de Vercel y el cliente no
// puede falsificar:
//   1) x-real-ip            → IP única que pone el edge de Vercel (no spoofable).
//   2) x-vercel-forwarded-for → idem, específico de Vercel.
//   3) x-forwarded-for ÚLTIMO valor → el que appendeó Vercel (el real), no el
//      primero (que es el que inyecta el atacante).
// ----------------------------------------------------------------------------
export function getClientIp(req) {
  const h = req.headers || {};
  const real = h['x-real-ip'];
  if (real && String(real).trim()) return String(real).trim();

  const vercel = h['x-vercel-forwarded-for'];
  if (vercel && String(vercel).trim()) return String(vercel).split(',').pop().trim();

  const xff = h['x-forwarded-for'];
  if (xff && String(xff).trim()) {
    // ÚLTIMO valor = el que appendeó la infra (la IP real), no el primero (spoofable).
    return String(xff).split(',').pop().trim();
  }
  return 'unknown';
}
