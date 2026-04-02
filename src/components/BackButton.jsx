// src/components/BackButton.jsx
// Breadcrumb contextual: "← Ventas  /  Nueva orden"
// UX: Shopify Admin pattern — siempre orientado, nunca invasivo

export default function BackButton({ onBack, parent, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      <button
        onClick={onBack}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "transparent",
          border: "1.5px solid #d1d5db",
          borderRadius: 8,
          padding: "5px 12px 5px 8px",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          transition: "background .12s, border-color .12s",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#f3f4f6";
          e.currentTarget.style.borderColor = "#9ca3af";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "#d1d5db";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {parent}
      </button>
      {current && (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 2L8 6L4 10" stroke="#d1d5db" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500, whiteSpace: "nowrap" }}>
            {current}
          </span>
        </>
      )}
    </div>
  );
}
