// Centralized Suspense fallback for all lazy-loaded tabs.
// Replaces 26 copies of the inline div spinner in App.jsx.
const TabLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    color: '#888',
    fontSize: 14,
  }}>
    Cargando...
  </div>
);

export default TabLoader;
