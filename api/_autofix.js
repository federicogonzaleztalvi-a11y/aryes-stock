// api/_autofix.js — Torre de Control · peldaño 2: ante un error en prod, crea un
// Issue de GitHub con todo el contexto y le pone el label `auto-fix`. Ese label
// dispara la Claude Code Action (.github/workflows/auto-fix.yml), que lee el
// issue, propone un fix en una rama nueva y ABRE UN PR. El PR NUNCA se mergea
// solo: lo aprobás vos (peldaño 1 de autonomía = proponer solo, actuar con
// consecuencia = con aprobación humana).
//
// SEGURIDAD DE DISEÑO (mismo criterio que _alert.js, por qué no empeora nada):
//   • Apagado por defecto: sólo corre si AUTOFIX_ENABLED === 'true'. Así nada
//     dispara al agente hasta que vos actives la GitHub App + el secret + el flag.
//   • Fire-and-forget vía waitUntil (ver _log.js): nunca bloquea ni rompe el
//     request que originó el error.
//   • Nunca usa `log.*` adentro → imposible loop "crear issue genera error que
//     genera otro issue". Sólo console.* directo.
//   • Dedup: antes de crear, busca un issue ABIERTO con la misma firma. Un error
//     repetido NO te llena de tickets ni de PRs (además del throttle en _log).
//   • Sólo crea issues (contents/issues), jamás mergea ni deploya. El gate real
//     de que un fix llegue a Eric es: CI (tests+build) + Preview Deploy + tu clic.
// ----------------------------------------------------------------------------

const IS_PROD  = (process.env.VERCEL_ENV || process.env.NODE_ENV) === 'production';
const ENABLED  = process.env.AUTOFIX_ENABLED === 'true';
const GH_TOKEN = process.env.GH_AUTOFIX_TOKEN || '';
// owner/repo del repositorio destino. Default al repo de Pazque.
const GH_REPO  = process.env.GH_AUTOFIX_REPO || 'federicogonzaleztalvi-a11y/aryes-stock';
const LABEL    = 'auto-fix';

// Firma corta y estable del error, para dedup y para el título del issue.
function _sig(entry) {
  return (entry.service || '?') + ' — ' + (entry.msg || '?');
}

const GH_HEADERS = () => ({
  Authorization: 'Bearer ' + GH_TOKEN,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
});

// ¿Ya hay un issue ABIERTO para esta misma firma? Evita duplicar tickets/PRs.
// Busca por un marcador oculto en el cuerpo (más robusto que matchear el título).
async function _yaExiste(marker) {
  const q = encodeURIComponent(`repo:${GH_REPO} is:issue is:open in:body "${marker}"`);
  const r = await fetch(`https://api.github.com/search/issues?q=${q}`, { headers: GH_HEADERS() });
  if (!r.ok) return false;             // ante la duda no bloqueamos: mejor un dup que perder el aviso
  const data = await r.json();
  return (data.total_count || 0) > 0;
}

// Punto de entrada llamado por _log.js. DEVUELVE la promesa (para waitUntil) o null.
export function maybeFileIssue(entry) {
  try {
    if (!IS_PROD || !ENABLED || !GH_TOKEN) return null;
    return _crear(entry).catch(() => {});   // nunca propaga error
  } catch { return null; }
}

async function _crear(entry) {
  const { ts, level, service, msg, ...extra } = entry;
  const sig = _sig(entry);
  const marker = `autofix-sig:${sig}`;      // marcador oculto para el dedup

  if (await _yaExiste(marker)) return;      // ya hay un ticket abierto para esto

  const detalle = Object.keys(extra).length
    ? '```json\n' + JSON.stringify(extra, null, 2).slice(0, 2000) + '\n```'
    : '_(sin detalle adicional)_';

  const body = [
    `**Error detectado en producción por la Torre de Control.**`,
    ``,
    `- **Módulo:** \`${service || '?'}\``,
    `- **Nivel:** ${String(level || 'error').toUpperCase()}`,
    `- **Mensaje:** ${msg || '(sin mensaje)'}`,
    `- **Momento:** ${ts || new Date().toISOString()}`,
    ``,
    `**Detalle:**`,
    detalle,
    ``,
    `---`,
    `### Instrucciones para el agente`,
    `Proponé un fix mínimo y seguro para este error. No cambies comportamiento`,
    `que no esté relacionado. Agregá o ajustá tests si aplica. Abrí un Pull`,
    `Request para revisión humana — **no mergees**. Explicá en el PR, en lenguaje`,
    `claro, qué se rompía y qué cambia tu fix.`,
    ``,
    `<!-- ${marker} -->`,             // marcador de dedup (no visible al leer)
  ].join('\n');

  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/issues`, {
    method: 'POST',
    headers: GH_HEADERS(),
    body: JSON.stringify({
      title: `[auto-fix] ${sig}`.slice(0, 120),
      body,
      labels: [LABEL],
    }),
  });
  if (!r.ok) {
    console.error('[autofix] no se pudo crear el issue:', r.status, (await r.text()).slice(0, 300));
  }
}
