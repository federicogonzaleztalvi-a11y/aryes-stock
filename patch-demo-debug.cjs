const fs = require('fs');
const src = fs.readFileSync('src/main.jsx', 'utf8');

const anchor = `  if (showDemoSelector && !demoMode) {`;
const fix = `  console.log('[ROOT DEBUG]', { demoMode, effectiveSession: !!effectiveSession, orgStatus, showDemoSelector, session: !!session });
  if (showDemoSelector && !demoMode) {`;

if (src.includes('[ROOT DEBUG]')) {
  console.log('⏭  Debug log already exists');
} else if (src.includes(anchor)) {
  fs.writeFileSync('src/main.jsx', src.replace(anchor, fix));
  console.log('✅ Debug log added');
} else {
  console.log('❌ Anchor not found');
}
