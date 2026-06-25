/* ============================================================================
   AUTH — login, sesión, logout y lectura del rol del perfil
   Expone window.Auth con estado y helpers.
   ============================================================================ */

window.Auth = (function () {
  // Estado de sesión accesible para toda la app.
  var estado = {
    user: null,      // objeto user de auth
    perfil: null,    // { id, nombre, rol }
    rol: null        // 'dueño' | 'vendedor'
  };

  function esDueno() {
    return estado.rol === "dueño";
  }

  // Traduce errores de Supabase a mensajes claros en español.
  function traducirError(error) {
    if (!error) return "Ocurrió un error inesperado.";
    var m = (error.message || "").toLowerCase();
    if (m.indexOf("invalid login") !== -1) return "Email o contraseña incorrectos.";
    if (m.indexOf("email not confirmed") !== -1) return "Tenés que confirmar tu email antes de ingresar.";
    if (m.indexOf("failed to fetch") !== -1 || m.indexOf("network") !== -1)
      return "Sin conexión con el servidor. Revisá tu internet y las credenciales en config.js.";
    return error.message || "No se pudo iniciar sesión.";
  }

  // Lee (o crea fallback) el perfil del usuario logueado.
  async function cargarPerfil() {
    if (!estado.user) return null;
    var res = await window.sb
      .from("perfiles")
      .select("id, nombre, rol")
      .eq("id", estado.user.id)
      .maybeSingle();

    if (res.error) {
      console.warn("[CRM] No se pudo leer el perfil:", res.error.message);
    }
    var perfil = res.data;
    // Fallback defensivo si el trigger todavía no creó el perfil.
    if (!perfil) {
      perfil = {
        id: estado.user.id,
        nombre: estado.user.email,
        rol: "vendedor"
      };
    }
    estado.perfil = perfil;
    estado.rol = perfil.rol;
    return perfil;
  }

  // Verifica si ya hay sesión activa (al abrir la app).
  async function verificarSesion() {
    if (!window.sb) return false;
    var res = await window.sb.auth.getSession();
    var session = res.data ? res.data.session : null;
    if (session && session.user) {
      estado.user = session.user;
      await cargarPerfil();
      return true;
    }
    return false;
  }

  // Login con email + contraseña.
  async function login(email, password) {
    var res = await window.sb.auth.signInWithPassword({
      email: email,
      password: password
    });
    if (res.error) {
      throw new Error(traducirError(res.error));
    }
    estado.user = res.data.user;
    await cargarPerfil();
    return estado.perfil;
  }

  // Cierre de sesión.
  async function logout() {
    await window.sb.auth.signOut();
    estado.user = null;
    estado.perfil = null;
    estado.rol = null;
  }

  return {
    estado: estado,
    esDueno: esDueno,
    verificarSesion: verificarSesion,
    cargarPerfil: cargarPerfil,
    login: login,
    logout: logout
  };
})();
