import React, { useState, useRef } from 'react';

var G = '#1a8a3c';
var ACCEPTED = '.jpg,.jpeg,.png,.webp,.heic,.heif';
var MAX_SIZE = 5 * 1024 * 1024; // 5MB
var SB_URL = import.meta.env.VITE_SUPABASE_URL;
var SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function ImageUpload({ value, onChange, orgId }) {
  var [uploading, setUploading] = useState(false);
  var [error, setError] = useState('');
  var [dragOver, setDragOver] = useState(false);
  var fileRef = useRef(null);

  function getSessionToken() {
    try { return JSON.parse(localStorage.getItem('aryes-session') || '{}').access_token || SB_KEY; }
    catch { return SB_KEY; }
  }

  async function uploadFile(file) {
    if (!file) return;
    setError('');

    // Validate type
    var validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      setError('Formato no soportado. Usa JPG, PNG, WebP o HEIC.');
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      setError('La imagen no puede superar 5MB.');
      return;
    }

    setUploading(true);
    try {
      // Generate unique filename
      var ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'heif') ext = 'heic';
      var filename = (orgId || 'default') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

      var token = getSessionToken();
      var res = await fetch(SB_URL + '/storage/v1/object/product-images/' + filename, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'apikey': SB_KEY,
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: file,
      });

      if (!res.ok) {
        var errText = await res.text();
        console.error('[ImageUpload] Upload error:', errText);
        setError('Error al subir. Intenta de nuevo.');
        return;
      }

      // Build public URL
      var publicUrl = SB_URL + '/storage/v1/object/public/product-images/' + filename;
      onChange(publicUrl);
    } catch (e) {
      console.error('[ImageUpload] Error:', e);
      setError('Error de conexion. Intenta de nuevo.');
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
    onChange('');
  }

  // If there's already an image, show preview with remove button
  if (value) {
    return React.createElement('div', { style: { display: 'flex', gap: 10, alignItems: 'flex-start' } },
      React.createElement('div', { style: { position: 'relative', flexShrink: 0 } },
        React.createElement('img', {
          src: value, alt: 'Producto',
          style: { width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e2de' },
          onError: function(e) { e.target.style.display = 'none'; }
        }),
        React.createElement('button', {
          onClick: removeImage,
          style: {
            position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
            background: '#dc2626', color: '#fff', border: '2px solid #fff', fontSize: 10,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, lineHeight: 1, padding: 0
          }
        }, '\u00D7')
      ),
      React.createElement('button', {
        onClick: function() { fileRef.current && fileRef.current.click(); },
        style: {
          background: '#f9f9f7', border: '1px solid #e2e2de', borderRadius: 8,
          padding: '6px 12px', fontSize: 11, cursor: 'pointer', color: '#4a4a48', fontWeight: 600
        }
      }, 'Cambiar foto'),
      React.createElement('input', {
        ref: fileRef, type: 'file', accept: ACCEPTED,
        onChange: handleFileSelect,
        style: { display: 'none' }
      })
    );
  }

  // Upload zone
  return React.createElement('div', null,
    React.createElement('div', {
      onClick: function() { if (!uploading) fileRef.current && fileRef.current.click(); },
      onDragOver: function(e) { e.preventDefault(); setDragOver(true); },
      onDragLeave: function() { setDragOver(false); },
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
    React.createElement('input', {
      ref: fileRef, type: 'file', accept: ACCEPTED,
      onChange: handleFileSelect,
      style: { display: 'none' }
    })
  );
}
