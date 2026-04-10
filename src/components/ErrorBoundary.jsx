import React from 'react';

/**
 * ErrorBoundary — aísla fallos de tabs individuales.
 * Si una tab crashea, el resto de la app sigue funcionando.
 * El usuario ve un mensaje de error con opción de reintentar.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log silencioso — en producción esto iría a Sentry/observability
    console.error('[ErrorBoundary]', error, info?.componentStack?.split('\n')?.[1]?.trim());
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { label = 'módulo' } = this.props;
    const msg = this.state.error?.message || 'Error desconocido';

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 24px', gap: 16,
        color: '#6b7280', textAlign: 'center',
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>
          Error al cargar {label}
        </div>
        <div style={{ fontSize: 13, color: '#9ca3af', maxWidth: 360 }}>
          {msg}
        </div>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{
            marginTop: 8, padding: '8px 20px', borderRadius: 8,
            background: '#059669', color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }
}

/**
 * withErrorBoundary — HOC para wrappear cualquier componente.
 * Uso: const SafeTab = withErrorBoundary(MyTab, 'Mi Tab');
 */
export function withErrorBoundary(Component, label) {
  return function WrappedWithBoundary(props) {
    return (
      <ErrorBoundary label={label}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
