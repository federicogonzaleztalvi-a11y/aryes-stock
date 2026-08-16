import React, { useState, useRef } from 'react';

var G = '#059669';
var FOREST = '#3f5344';
var GRAY = '#6b6b66';
var ACCEPTED = '.jpg,.jpeg,.png,.webp,.heic,.heif';
var MAX_SIZE = 5 * 1024 * 1024; // 5MB
var SB_URL = import.meta.env.VITE_SUPABASE_URL;
var SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sube un Blob/File al bucket product-images y devuelve la URL pública. Lo usan tanto
// la subida normal como el "Aplicar" del recorte de fondo (que sube un PNG nuevo).
async function uploadBlob(blob, ext, orgId) {
  var filename = (orgId || 'default') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  var res = await fetch(SB_URL + '/storage/v1/object/product-images/' + filename, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SB_KEY, // bucket público: anon key alcanza para upload
      'apikey': SB_KEY,
      'Content-Type': blob.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: blob,
  });
  if (!res.ok) {
    var errText = await res.text();
    console.error('[ImageUpload] Upload error:', errText);
    throw new Error('upload-failed');
  }
  return SB_URL + '/storage/v1/object/public/product-images/' + filename;
}

export default function ImageUpload({ value, onChange, orgId }) {
  var [uploading, setUploading] = useState(false);
  var [error, setError] = useState('');
  var [dragOver, setDragOver] = useState(false);
  var fileRef = useRef(null);

  // Estado del recorte de fondo (opción manual con preview, estilo Shopify):
  // idle → processing (corre el modelo) → preview (muestra antes/después) → aplicar/descartar.
  var [bgPhase, setBgPhase] = useState('idle');   // 'idle' | 'processing' | 'preview' | 'error'
  var [bgMsg, setBgMsg] = useState('');           // texto de progreso
  var [bgCutUrl, setBgCutUrl] = useState('');     // blob URL del resultado recortado (preview)
  var bgBlobRef = useRef(null);                    // el Blob PNG recortado, para subirlo al aplicar

  async function uploadFile(file) {
    if (!file) return;
    setError('');

    var validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      setError('Formato no soportado. Usa JPG, PNG, WebP o HEIC.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('La imagen no puede superar 5MB.');
      return;
    }

    setUploading(true);
    try {
      var ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'heif') ext = 'heic';
      var publicUrl = await uploadBlob(file, ext, orgId);
      onChange(publicUrl);
    } catch (e) {
      console.error('[ImageUpload] Error:', e);
      setError('Error al subir. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    var file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileSelect(e) {
    var file = e.target.files[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }

  function removeImage() {
    resetBg();
    onChange('');
  }

  // --- Recorte de fondo (lazy: el modelo ~6MB se carga on-demand, sólo si lo usan) ---
  function resetBg() {
    if (bgCutUrl) { try { URL.revokeObjectURL(bgCutUrl); } catch (e) {} }
    bgBlobRef.current = null;
    setBgCutUrl('');
    setBgPhase('idle');
    setBgMsg('');
  }

  async function quitarFondo() {
    if (!value) return;
    setBgPhase('processing');
    setBgMsg('Cargando el recortador…');
    try {
      var mod = await import('@imgly/background-removal');
      var blob = await mod.removeBackground(value, {
        progress: function (key, cur, tot) {
          if (key && key.indexOf('fetch') === 0) {
            var pct = tot ? Math.round((cur / tot) * 100) : 0;
            setBgMsg('Descargando modelo… ' + pct + '%');
          } else {
            setBgMsg('Recortando la imagen…');
          }
        },
      });
      bgBlobRef.current = blob;
      var url = URL.createObjectURL(blob);
      setBgCutUrl(url);
      setBgPhase('preview');
    } catch (e) {
      console.error('[ImageUpload] removeBackground error:', e);
      setBgMsg('No se pudo recortar esta foto. Suele pasar con fotos en ángulo o con varios objetos. Probá con una foto de frente.');
      setBgPhase('error');
    }
  }

  async function aplicarRecorte() {
    if (!bgBlobRef.current) return;
    setBgPhase('processing');
    setBgMsg('Guardando la versión recortada…');
    try {
      var newUrl = await uploadBlob(bgBlobRef.current, 'png', orgId);
      onChange(newUrl);
      resetBg();
    } catch (e) {
      console.error('[ImageUpload] apply error:', e);
      setBgMsg('No se pudo guardar la versión recortada. Intentá de nuevo.');
      setBgPhase('error');
    }
  }

  // Panel de preview antes/después del recorte (sólo cuando bgPhase === 'preview').
  function renderBgPreview() {
    var tile = function (label, src, bg) {
      return React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: 10, fontWeight: 700, letterSpacing: .4, textTransform: 'uppercase', color: GRAY, marginBottom: 5 } }, label),
        React.createElement('div', {
          style: {
            height: 120, borderRadius: 10, border: '1px solid #e8e6df', background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 8,
          }
        }, React.createElement('img', { src: src, alt: label, style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } }))
      );
    };
    return React.createElement('div', {
      style: { marginTop: 12, padding: 14, border: '1px solid #e8e6df', borderRadius: 12, background: '#fafaf8' }
    },
      React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: '#3a3a38', marginBottom: 10 } }, 'Revisá el recorte antes de aplicarlo'),
      React.createElement('div', { style: { display: 'flex', gap: 10 } },
        tile('Actual', value, '#fbf8f1'),
        tile('Recortada', bgCutUrl, '#fff')
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 12 } },
        React.createElement('button', {
          onClick: aplicarRecorte,
          style: { background: G, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
        }, 'Aplicar recorte'),
        React.createElement('button', {
          onClick: resetBg,
          style: { background: '#fff', color: '#4a4a48', border: '1px solid #e2e2de', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
        }, 'Descartar')
      ),
      React.createElement('div', { style: { fontSize: 11, color: GRAY, marginTop: 8, lineHeight: 1.4 } },
        'Si el recorte comió parte del producto, descartá y dejá la foto original.')
    );
  }

  // Guía de captura (A): 3 reglas simples, la palanca real de calidad de foto.
  function renderGuia() {
    var reglas = ['Producto de frente (no en ángulo)', 'Fondo claro y liso', 'Que llene el cuadro'];
    return React.createElement('div', { style: { marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 } },
      reglas.map(function (r, i) {
        return React.createElement('span', {
          key: i,
          style: {
            fontSize: 10.5, fontWeight: 600, color: FOREST, background: FOREST + '12',
            borderRadius: 20, padding: '3px 9px', letterSpacing: .1,
          }
        }, r);
      })
    );
  }

  // Con imagen: preview + acciones (Cambiar foto / Quitar fondo) + preview de recorte.
  if (value) {
    var procesando = bgPhase === 'processing';
    return React.createElement('div', null,
      React.createElement('div', { style: { display: 'flex', gap: 10, alignItems: 'flex-start' } },
        React.createElement('div', { style: { position: 'relative', flexShrink: 0 } },
          React.createElement('img', {
            src: value, alt: 'Producto',
            style: { width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e2de' },
            onError: function (e) { e.target.style.display = 'none'; }
          }),
          React.createElement('button', {
            onClick: removeImage, title: 'Quitar imagen',
            style: {
              position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
              background: '#dc2626', color: '#fff', border: '2px solid #fff', fontSize: 10,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, lineHeight: 1, padding: 0
            }
          }, '\u00D7')
        ),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            React.createElement('button', {
              onClick: function () { fileRef.current && fileRef.current.click(); },
              disabled: procesando,
              style: {
                background: '#f9f9f7', border: '1px solid #e2e2de', borderRadius: 8,
                padding: '6px 12px', fontSize: 11, cursor: procesando ? 'default' : 'pointer',
                color: '#4a4a48', fontWeight: 600, opacity: procesando ? .6 : 1
              }
            }, 'Cambiar foto'),
            React.createElement('button', {
              onClick: quitarFondo,
              disabled: procesando || bgPhase === 'preview',
              style: {
                background: '#fff', border: '1px solid ' + FOREST + '55', borderRadius: 8,
                padding: '6px 12px', fontSize: 11, cursor: (procesando || bgPhase === 'preview') ? 'default' : 'pointer',
                color: FOREST, fontWeight: 700, opacity: (procesando || bgPhase === 'preview') ? .6 : 1
              }
            }, 'Quitar fondo')
          ),
          procesando && React.createElement('div', { style: { fontSize: 11, color: FOREST, fontWeight: 600 } }, bgMsg || 'Procesando…'),
          bgPhase === 'error' && React.createElement('div', { style: { fontSize: 11, color: '#b45309', fontWeight: 500, lineHeight: 1.4, maxWidth: 260 } }, bgMsg)
        )
      ),
      bgPhase === 'preview' && renderBgPreview(),
      React.createElement('input', {
        ref: fileRef, type: 'file', accept: ACCEPTED,
        onChange: handleFileSelect,
        style: { display: 'none' }
      })
    );
  }

  // Sin imagen: zona de subida + guía de captura.
  return React.createElement('div', null,
    React.createElement('div', {
      onClick: function () { if (!uploading) fileRef.current && fileRef.current.click(); },
      onDragOver: function (e) { e.preventDefault(); setDragOver(true); },
      onDragLeave: function () { setDragOver(false); },
      onDrop: handleDrop,
      style: {
        border: '2px dashed ' + (dragOver ? G : '#d4d4d0'),
        borderRadius: 10, padding: '20px 16px', textAlign: 'center',
        cursor: uploading ? 'wait' : 'pointer',
        background: dragOver ? '#f0fdf4' : '#fafaf8',
        transition: 'all 0.15s'
      }
    },
      uploading
        ? React.createElement('div', { style: { fontSize: 12, color: G, fontWeight: 600 } }, '\u23F3 Subiendo imagen...')
        : React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 22, marginBottom: 4 } }, '\u{1F4F7}'),
            React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: '#4a4a48' } }, 'Arrastra una foto o toca para elegir'),
            React.createElement('div', { style: { fontSize: 10, color: '#9a9a98', marginTop: 4 } }, 'JPG, PNG, WebP, HEIC \u00B7 Max 5MB')
          )
    ),
    error && React.createElement('div', {
      style: { fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 500 }
    }, error),
    !uploading && renderGuia(),
    React.createElement('input', {
      ref: fileRef, type: 'file', accept: ACCEPTED,
      onChange: handleFileSelect,
      style: { display: 'none' }
    })
  );
}
