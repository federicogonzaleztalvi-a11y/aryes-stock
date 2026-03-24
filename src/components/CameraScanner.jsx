import React, { useState, useRef, useEffect } from 'react';
import { T } from '../lib/ui.jsx';

const CameraScanner = ({ onDetected, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | error
  const [errorMsg, setErrorMsg] = useState("");
  const [lastScan, setLastScan] = useState("");
  const lastScanRef = useRef(""); // prevent duplicate fires

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        // Load ZXing dynamically from CDN
        if (!window.ZXing) {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.21.3/zxing.min.js";
            s.onload = resolve;
            s.onerror = () => reject(new Error("No se pudo cargar la librería de escaneo"));
            document.head.appendChild(s);
          });
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const hints = new Map();
        hints.set(2, [1, 2, 3, 4, 5, 6, 7, 8, 13, 14]); // all barcode formats

        const codeReader = new window.ZXing.BrowserMultiFormatReader(hints);
        readerRef.current = codeReader;
        setStatus("scanning");

        codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
          if (cancelled) return;
          if (result) {
            const text = result.getText();
            // Debounce — ignore same code within 2 seconds
            if (text === lastScanRef.current) return;
            lastScanRef.current = text;
            setLastScan(text);
            setTimeout(() => { lastScanRef.current = ""; }, 2000);
            onDetected(text);
          }
        });

      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          if (e.name === "NotAllowedError") setErrorMsg("Permiso de cámara denegado. Habilitá el acceso en la configuración del navegador.");
          else if (e.name === "NotFoundError") setErrorMsg("No se encontró cámara en este dispositivo.");
          else setErrorMsg(e.message || "Error al acceder a la cámara.");
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      readerRef.current?.reset?.();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 1100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(to bottom, rgba(0,0,0,.7), transparent)" }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 20, color: "#fff", fontWeight: 500 }}>Escaneando con cámara</div>
          <div style={{ fontFamily: T.sans, fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 2 }}>Apuntá al código de barras del producto</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 6, color: "#fff", padding: "8px 14px", cursor: "pointer", fontFamily: T.sans, fontSize: 12, fontWeight: 600 }}>Cerrar</button>
      </div>

      {/* Video */}
      <div style={{ position: "relative", width: "100%", maxWidth: 480, aspectRatio: "4/3" }}>
        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4, display: status === "error" ? "none" : "block" }}/>

        {/* Scan frame overlay */}
        {status === "scanning" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            {/* Dimmed corners */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)" }}/>
            {/* Clear scan zone */}
            <div style={{ position: "relative", width: "72%", height: "35%", zIndex: 1 }}>
              <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,.0)", background: "transparent" }}/>
              {/* Corner brackets */}
              {[["top:0,left:0","borderTop,borderLeft"],["top:0,right:0","borderTop,borderRight"],["bottom:0,left:0","borderBottom,borderLeft"],["bottom:0,right:0","borderBottom,borderRight"]].map(([pos, borders], i) => {
                const p = Object.fromEntries(pos.split(",").map(s => s.split(":")));
                const b = Object.fromEntries(borders.split(",").map(s => [s, `3px solid ${T.green}`]));
                return <div key={i} style={{ position: "absolute", width: 22, height: 22, ...p, ...b }}/>;
              })}
              {/* Scan line animation */}
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${T.green}, transparent)`, animation: "scanLine 2s ease-in-out infinite" }}/>
            </div>
          </div>
        )}

        {/* Starting overlay */}
        {status === "starting" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.7)", borderRadius: 4 }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${T.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
            <p style={{ fontFamily: T.sans, fontSize: 13, color: "#fff", marginTop: 14 }}>Iniciando cámara...</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📷</div>
            <p style={{ fontFamily: T.sans, fontSize: 14, color: "#fff", fontWeight: 600, marginBottom: 8 }}>No se pudo acceder a la cámara</p>
            <p style={{ fontFamily: T.sans, fontSize: 12, color: "rgba(255,255,255,.6)", lineHeight: 1.6 }}>{errorMsg}</p>
            <button onClick={onClose} style={{ marginTop: 20, background: T.green, border: "none", color: "#fff", padding: "10px 24px", borderRadius: 4, fontFamily: T.sans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Volver al scanner manual</button>
          </div>
        )}
      </div>

      {/* Last scan feedback */}
      {lastScan && (
        <div style={{ marginTop: 16, background: T.greenBg, border: `1px solid ${T.greenBd}`, borderRadius: 6, padding: "10px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: T.sans, fontSize: 12, color: T.green, fontWeight: 600 }}>Código detectado: {lastScan}</p>
        </div>
      )}

      <p style={{ fontFamily: T.sans, fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 20, textAlign: "center", padding: "0 24px" }}>
        Funciona con códigos EAN-8, EAN-13, UPC, QR y más · Usá cámara trasera para mejores resultados
      </p>

      <style>{`
        @keyframes scanLine { 0%,100%{top:0;opacity:0;} 10%{opacity:1;} 90%{opacity:1;} 50%{top:calc(100% - 2px);} }
        @keyframes spin { to{transform:rotate(360deg);} }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCANNER  (USB lector + Cámara del celular)

export default CameraScanner;
