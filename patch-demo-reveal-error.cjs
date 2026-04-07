const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════
// 1. Add a global error catcher BEFORE React mounts in index.html
// ═══════════════════════════════════════════════════════════════════
let html = fs.readFileSync('index.html', 'utf8');

const ERROR_SCRIPT = `<script>
window.onerror = function(msg, src, line, col, err) {
  document.body.innerHTML = '<div style="padding:40px;font-family:monospace"><h2 style="color:red">JS Error</h2><pre style="background:#fef2f2;padding:16px;border-radius:8px;white-space:pre-wrap;font-size:12px">' + msg + '\\n' + (err && err.stack || '') + '\\nSource: ' + src + ':' + line + ':' + col + '</pre></div>';
};
window.addEventListener('unhandledrejection', function(e) {
  document.body.innerHTML = '<div style="padding:40px;font-family:monospace"><h2 style="color:red">Unhandled Promise</h2><pre style="background:#fef2f2;padding:16px;border-radius:8px;white-space:pre-wrap;font-size:12px">' + (e.reason && e.reason.stack || e.reason || 'unknown') + '</pre></div>';
});
</script>`;

if (!html.includes('window.onerror')) {
  html = html.replace('<div id="root">', ERROR_SCRIPT + '\n    <div id="root">');
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('✅ 1/1 Global error catcher added to index.html');
} else {
  console.log('⏭  Already exists');
}
