const fs = require('fs');
let src = fs.readFileSync('src/main.jsx', 'utf8');
let changes = 0;

// Add ErrorBoundary class before Root function
const ROOT_ANCHOR = `// ── Root: owns auth state, renders Login OR App ───────────────────`;

const ERROR_BOUNDARY = `// ── ErrorBoundary: catches render crashes ─────────────────────────
class DemoErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[DemoErrorBoundary] CAUGHT:', error?.message, error?.stack);
    console.error('[DemoErrorBoundary] Component stack:', info?.componentStack);
    this.setState({ info });
  }
  render() {
    if (this.state.error) {
      return React.createElement('div', { style: { padding: 40, fontFamily: 'monospace' } },
        React.createElement('h2', { style: { color: 'red' } }, 'Demo render error'),
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', fontSize: 12, background: '#f5f5f5', padding: 16, borderRadius: 8, maxHeight: 400, overflow: 'auto' } },
          this.state.error?.message + '\\n\\n' + (this.state.error?.stack || '') + '\\n\\nComponent:\\n' + (this.state.info?.componentStack || '')
        ),
        React.createElement('button', { onClick: () => { this.setState({ error: null, info: null }); window.location.href = '/'; }, style: { marginTop: 16, padding: '8px 20px', background: '#1a8a3c', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' } }, 'Volver al inicio')
      );
    }
    return this.props.children;
  }
}

`;

if (!src.includes('DemoErrorBoundary')) {
  src = src.replace(ROOT_ANCHOR, ERROR_BOUNDARY + ROOT_ANCHOR);
  changes++;
  console.log('✅ 1/2 ErrorBoundary added');
} else {
  console.log('⏭  1/2 ErrorBoundary already exists');
}

// Wrap AppProvider render in ErrorBoundary
const OLD_RENDER = `      <AppProvider session={effectiveSession}`;
const NEW_RENDER = `      <DemoErrorBoundary>
      <AppProvider session={effectiveSession}`;

if (src.includes(OLD_RENDER) && !src.includes('<DemoErrorBoundary>')) {
  src = src.replace(OLD_RENDER, NEW_RENDER);
  changes++;
  console.log('✅ 2/3 Wrapped AppProvider in ErrorBoundary');
} else {
  console.log('⏭  2/3 Already wrapped');
}

// Close ErrorBoundary after AppProvider closing
const OLD_CLOSE = `      </AppProvider>`;
const NEW_CLOSE = `      </AppProvider>
      </DemoErrorBoundary>`;

if (src.includes(OLD_CLOSE) && !src.includes('</DemoErrorBoundary>')) {
  src = src.replace(OLD_CLOSE, NEW_CLOSE);
  changes++;
  console.log('✅ 3/3 Closed ErrorBoundary');
} else {
  console.log('⏭  3/3 Already closed');
}

if (changes > 0) {
  fs.writeFileSync('src/main.jsx', src, 'utf8');
  console.log('\n✅ ErrorBoundary deployed — will show exact crash on screen');
} else {
  console.log('\n⚠️  No changes');
}
