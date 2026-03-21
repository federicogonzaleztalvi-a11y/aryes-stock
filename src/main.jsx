import React from 'react'
import ReactDOM from 'react-dom/client'
import AryesApp from './App.jsx'

class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('[ARYES ROOT ERROR]', e, info); }
  render() {
    if (this.state.error) {
      return React.createElement('div', {
        style: {
          position: 'fixed', inset: 0, background: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 32, fontFamily: 'monospace',
          zIndex: 99999
        }
      },
        React.createElement('h2', { style: { color: '#dc2626', marginBottom: 16, fontSize: 18 } }, '⛔ Error en AryesApp'),
        React.createElement('pre', {
          style: {
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: 16, fontSize: 13, maxWidth: '90vw', overflowX: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#7f1d1d'
          }
        }, String(this.state.error?.stack || this.state.error?.message || this.state.error)),
        React.createElement('button', {
          onClick: () => { localStorage.clear(); window.location.reload(); },
          style: {
            marginTop: 20, background: '#dc2626', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 14
          }
        }, 'Limpiar cache y recargar')
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(RootErrorBoundary, null,
    React.createElement(AryesApp)
  )
)
