// patch-demo-sentry-fallback.cjs
// The Sentry.ErrorBoundary fallback renders <RootErrorBoundary><div/></RootErrorBoundary>
// But RootErrorBoundary used as a static fallback doesn't receive the error from Sentry.
// Result: any error = empty <div/> = white screen.
// Fix: use Sentry.ErrorBoundary fallback as a render function that shows the error.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'main.jsx');
let src = fs.readFileSync(FILE, 'utf8');
let changes = 0;

// Fix Sentry.ErrorBoundary fallback to show actual errors
const OLD = `  <Sentry.ErrorBoundary fallback={<RootErrorBoundary><div/></RootErrorBoundary>}>`;
const NEW = `  <Sentry.ErrorBoundary fallback={({error}) => (
    <div style={{position:'fixed',inset:0,background:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,fontFamily:'monospace',zIndex:99999}}>
      <h2 style={{color:'#dc2626',marginBottom:16,fontSize:18}}>Error de aplicación</h2>
      <pre style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:16,fontSize:12,maxWidth:'90vw',overflowX:'auto',whiteSpace:'pre-wrap',wordBreak:'break-all',color:'#7f1d1d'}}>{String(error?.stack||error?.message||error||'Unknown error')}</pre>
      <button onClick={()=>{localStorage.clear();window.location.href='/';}} style={{marginTop:20,background:'#dc2626',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',cursor:'pointer',fontSize:14}}>Volver al inicio</button>
    </div>
  )}>`;

if (src.includes(OLD)) {
  src = src.replace(OLD, NEW);
  changes++;
  console.log('✅ 1/1 Sentry fallback now shows actual error');
} else {
  console.log('❌ 1/1 Sentry fallback anchor not found');
  // Try alternate
  if (src.includes('Sentry.ErrorBoundary fallback')) {
    console.log('   Found Sentry.ErrorBoundary but different format');
  }
}

if (changes > 0) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`
══════════════════════════════════════════════
✅ Sentry fallback fix applied!

  Before: Sentry caught errors → rendered empty <div/> → white screen
  After:  Sentry caught errors → shows error message on screen

  This will REVEAL the actual error causing the white screen.
  Deploy and check — you'll see the real error message.
══════════════════════════════════════════════`);
}
