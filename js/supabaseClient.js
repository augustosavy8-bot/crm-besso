/* ============================================================================
   SUPABASE CLIENT
   Inicializa el cliente único de Supabase usando la lib cargada por CDN
   (window.supabase viene de @supabase/supabase-js@2).
   Expone window.sb para que lo use el resto de la app.
   ============================================================================ */

(function () {
  var cfg = window.CRM_CONFIG || {};

  // Validación temprana: si faltan credenciales avisamos con claridad.
  var faltan =
    !cfg.SB_URL ||
    !cfg.SB_ANON_KEY ||
    cfg.SB_URL.indexOf("TU-PROYECTO") !== -1 ||
    cfg.SB_ANON_KEY.indexOf("TU_ANON_KEY") !== -1;

  if (faltan) {
    console.error(
      "[CRM] Faltan credenciales de Supabase. Editá js/config.js con tu SB_URL y SB_ANON_KEY."
    );
    window.CRM_CONFIG_OK = false;
  } else {
    window.CRM_CONFIG_OK = true;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error("[CRM] No se cargó la librería de Supabase (CDN).");
    window.sb = null;
    return;
  }

  window.sb = window.supabase.createClient(
    cfg.SB_URL || "https://placeholder.supabase.co",
    cfg.SB_ANON_KEY || "placeholder",
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );
})();
