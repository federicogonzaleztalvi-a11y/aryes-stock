// Aryes Stock — shared module constants

export const SB_URL = 'https://mrotnqybqvmvlexncvno.supabase.co';

export const SKEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI';

export const LS = {
  get(key, def) {
    try {
      const raw = localStorage.getItem(key);
      if(raw===null||raw===undefined) return def;
      try { return JSON.parse(raw); } catch(e) { return raw; }
    } catch(e) { return def; }
  },
  set(key, value) {
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, str);
      sbWrite(key, value); // async, non-blocking
    } catch(e) {}
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      fetch(SB_URL+'/rest/v1/aryes_data?key=eq.'+encodeURIComponent(key), {
        method: 'DELETE', headers: SB_HEADERS
      }).catch(()=>{});
    } catch(e) {}
  }
};
