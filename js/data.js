/* ============================================================================
   DATA — helpers CRUD contra Supabase
   Todas las consultas quedan filtradas automáticamente por las políticas RLS
   (ver sql/schema.sql). El frontend NO debe confiar solo en ocultar botones.
   Expone window.Data.
   ============================================================================ */

window.Data = (function () {

  function sb() { return window.sb; }

  // Normaliza una respuesta de Supabase: devuelve data o lanza error.
  function check(res) {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  /* ---------------------------- AUTOS ---------------------------- */
  var Autos = {
    async listar() {
      return check(
        await sb().from("autos").select("*").order("created_at", { ascending: false })
      );
    },
    async crear(auto) {
      return check(
        await sb().from("autos").insert(auto).select().single()
      );
    },
    async actualizar(id, cambios) {
      return check(
        await sb().from("autos").update(cambios).eq("id", id).select().single()
      );
    },
    async eliminar(id) {
      return check(await sb().from("autos").delete().eq("id", id));
    }
  };

  /* ---------------------------- LEADS ---------------------------- */
  var Leads = {
    // RLS filtra: el vendedor solo recibe los suyos; el dueño, todos.
    async listar() {
      return check(
        await sb()
          .from("leads")
          .select("*, vendedor:perfiles(id, nombre)")
          .order("created_at", { ascending: false })
      );
    },
    async crear(lead) {
      return check(
        await sb().from("leads").insert(lead).select("*, vendedor:perfiles(id, nombre)").single()
      );
    },
    async actualizar(id, cambios) {
      return check(
        await sb().from("leads").update(cambios).eq("id", id)
          .select("*, vendedor:perfiles(id, nombre)").single()
      );
    },
    async eliminar(id) {
      return check(await sb().from("leads").delete().eq("id", id));
    }
  };

  /* ---------------------------- NOTAS ---------------------------- */
  var Notas = {
    async listarPorLead(leadId) {
      return check(
        await sb()
          .from("lead_notas")
          .select("*, autor:perfiles(id, nombre)")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
      );
    },
    async crear(nota) {
      return check(
        await sb().from("lead_notas").insert(nota)
          .select("*, autor:perfiles(id, nombre)").single()
      );
    },
    async eliminar(id) {
      return check(await sb().from("lead_notas").delete().eq("id", id));
    }
  };

  /* --------------------------- PERFILES -------------------------- */
  var Perfiles = {
    // Solo el dueño obtiene la lista completa (RLS). El vendedor recibe el suyo.
    async listar() {
      return check(
        await sb().from("perfiles").select("*").order("created_at", { ascending: true })
      );
    },
    async cambiarRol(id, rol) {
      return check(
        await sb().from("perfiles").update({ rol: rol }).eq("id", id).select().single()
      );
    },
    async actualizarNombre(id, nombre) {
      return check(
        await sb().from("perfiles").update({ nombre: nombre }).eq("id", id).select().single()
      );
    }
  };

  /* --------------------------- CONSULTAS ------------------------- */
  // Consultas que llegan desde la web pública (tabla compartida "consultas").
  // La RLS permite leer/escribir a usuarios autenticados; el cliente supabase-js
  // ya adjunta el access_token de la sesión actual en cada request.
  var Consultas = {
    async listar() {
      return check(
        await sb().from("consultas").select("*").order("created_at", { ascending: false })
      );
    },
    async marcarLeida(id) {
      return check(
        await sb().from("consultas").update({ leida: true }).eq("id", id).select().single()
      );
    },
    async contarNoLeidas() {
      var res = await sb()
        .from("consultas")
        .select("id", { count: "exact", head: true })
        .eq("leida", false);
      if (res.error) throw new Error(res.error.message);
      return res.count || 0;
    },
    // Borrar una consulta. La RLS solo lo permite al dueño (ver schema.sql).
    async eliminar(id) {
      return check(await sb().from("consultas").delete().eq("id", id));
    }
  };

  /* --------------------------- STORAGE (fotos) --------------------------- */
  // Sube imágenes al bucket "autos" (el mismo que usa la web pública) y
  // devuelve la URL pública. Usa el access_token de la sesión actual como
  // Authorization (apikey = anon), tal como exige Supabase Storage.
  var Storage = {
    BUCKET: "autos",

    // Convierte un dataURL (jpeg) en Blob.
    async _dataUrlToBlob(dataUrl) {
      var res = await fetch(dataUrl);
      return res.blob();
    },

    // Sube una foto comprimida y devuelve su URL pública.
    async subirFoto(dataUrl, nombreBase) {
      var cfg = window.CRM_CONFIG || {};
      var sesion = await sb().auth.getSession();
      var token = (sesion.data && sesion.data.session)
        ? sesion.data.session.access_token
        : cfg.SB_ANON_KEY;

      var slug = (nombreBase || "auto")
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
        .slice(0, 32) || "auto";

      var nombre = slug + "-" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8) + ".jpg";

      var blob = await this._dataUrlToBlob(dataUrl);

      var up = await fetch(
        cfg.SB_URL + "/storage/v1/object/" + this.BUCKET + "/" + nombre,
        {
          method: "POST",
          headers: {
            "apikey": cfg.SB_ANON_KEY,
            "Authorization": "Bearer " + token,
            "Content-Type": "image/jpeg",
            "Cache-Control": "3600",
            "x-upsert": "true"
          },
          body: blob
        }
      );

      if (!up.ok) {
        var detalle = "";
        try { detalle = (await up.json()).message || ""; } catch (e) {}
        throw new Error("No se pudo subir la foto (" + up.status + ") " + detalle);
      }

      return cfg.SB_URL + "/storage/v1/object/public/" + this.BUCKET + "/" + nombre;
    }
  };

  return {
    Autos: Autos, Leads: Leads, Notas: Notas, Perfiles: Perfiles,
    Consultas: Consultas, Storage: Storage
  };
})();
