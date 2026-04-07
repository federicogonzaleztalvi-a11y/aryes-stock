const fs = require('fs');

let src = fs.readFileSync('src/main.jsx', 'utf8');
let changes = 0;

// ═══════════════════════════════════════════════════════════════════
// Replace the broken Sentry.ErrorBoundary with just RootErrorBoundary
// The Sentry fallback function syntax may not be supported and could
// be the reason React fails to mount entirely
// ═══════════════════════════════════════════════════════════════════

const OLD_SENTRY = `  <Sentry.ErrorBoundary fallback={({error}) => (
    <div style={{position:'fixed',inset:0,background:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,fontFamily:'monospace',zIndex:99999}}>
      <h2 style={{color:'#dc2626',marginBottom:16,fontSize:18}}>Error de aplicación</h2>
      <pre style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:16,fontSize:12,maxWidth:'90vw',overflowX:'auto',whiteSpace:'pre-wrap',wordBreak:'break-all',color:'#7f1d1d'}}>{String(error?.stack||error?.message||error||'Unknown error')}</pre>
      <button onClick={()=>{localStorage.clear();window.location.href='/';}} style={{marginTop:20,background:'#dc2626',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',cursor:'pointer',fontSize:14}}>Volver al inicio</button>
    </div>
  )}>
  <RootErrorBoundary>`;

const NEW_SENTRY = `  <RootErrorBoundary>`;

if (src.includes(OLD_SENTRY)) {
  src = src.replace(OLD_SENTRY, NEW_SENTRY);
  changes++;
  console.log('✅ 1/2 Removed broken Sentry.ErrorBoundary wrapper');
} else {
  console.log('❌ 1/2 Sentry anchor not found exactly');
  // Try to find it loosely
  if (src.includes('Sentry.ErrorBoundary')) {
    console.log('   Found Sentry.ErrorBoundary but format differs');
  }
}

// Also remove the closing tags
const OLD_CLOSE = `  </RootErrorBoundary>

  </Sentry.ErrorBoundary>`;
const NEW_CLOSE = `  </RootErrorBoundary>`;

if (src.includes(OLD_CLOSE)) {
  src = src.replace(OLD_CLOSE, NEW_CLOSE);
  changes++;
  console.log('✅ 2/2 Removed Sentry.ErrorBoundary closing tag');
} else {
  console.log('❌ 2/2 Sentry closing anchor not found');
}

if (changes > 0) {
  fs.writeFileSync('src/main.jsx', src, 'utf8');
  console.log('\n✅ Sentry.ErrorBoundary removed — RootErrorBoundary will show errors');
} else {
  console.log('\n⚠️  No changes — trying manual approach');
  // Show what we have so we can fix manually
  const idx = src.indexOf('Sentry.ErrorBoundary');
  if (idx > -1) console.log('Found at:', src.substring(idx-20, idx+100));
}
