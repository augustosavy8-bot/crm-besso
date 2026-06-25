/* ============================================================================
   CONFIG — Credenciales públicas de Supabase
   ----------------------------------------------------------------------------
   Pegá acá la URL y la ANON key de tu proyecto de Supabase.
   Las encontrás en: Supabase → Project Settings → API.

   ⚠️ SOLO va la ANON (public) key. NUNCA pongas la service_role key acá:
      este archivo se sirve al navegador y sería un agujero de seguridad.
      La seguridad real la dan las políticas RLS (ver sql/schema.sql).
   ============================================================================ */

window.CRM_CONFIG = {
  SB_URL:      "https://inkbbfzdrzrnqjjjlquw.supabase.co",
  SB_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlua2JiZnpkcnpybnFqampscXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTg1NzAsImV4cCI6MjA5Nzk3NDU3MH0.A1oJAON35xVnIlCy7Wcoq7eb4KaUAiRkcKBbtg0k4vM"
};
