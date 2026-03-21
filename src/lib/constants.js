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

export const ALERT_CFG = {
  order_now:  {label:"Pedir YA",     dot:T.danger,  bg:T.dangerBg,bd:T.dangerBd,txt:T.danger, pri:3},
  order_soon: {label:"Pedir pronto", dot:T.warning, bg:T.warnBg,  bd:T.warnBd,  txt:T.warning,pri:2},
  watch:      {label:"Vigilar",      dot:T.watch,   bg:T.watchBg, bd:T.watchBd, txt:T.watch,  pri:1},
  ok:         {label:"Normal",       dot:T.ok,      bg:T.okBg,    bd:T.okBd,    txt:T.ok,     pri:0},
};

export const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];
