/* ============================================================================
   APP — router, navegación, modales, toasts, helpers de UI e init.
   Es el último script en cargar: cablea todo lo anterior.
   ============================================================================ */

/* ----------------------------------------------------------------------------
   UI: helpers compartidos por todas las vistas (window.UI)
   ---------------------------------------------------------------------------- */
window.UI = (function () {

  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtMoney(n) {
    if (n == null || isNaN(n)) return "—";
    try {
      return "USD " + Number(n).toLocaleString("es-AR");
    } catch (e) { return "USD " + n; }
  }

  function fmtNum(n) {
    if (n == null || isNaN(n)) return "—";
    try { return Number(n).toLocaleString("es-AR"); } catch (e) { return String(n); }
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var f = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    var h = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    return f + " " + h;
  }

  /* ---- estados de pantalla ---- */
  function loading(msg) {
    return '<div class="state"><div class="spinner"></div><div>' + esc(msg || "Cargando…") + '</div></div>';
  }
  function emptyState(title, sub) {
    return '<div class="state"><div class="state-title">' + esc(title) + '</div>' +
      (sub ? '<div>' + esc(sub) + '</div>' : '') + '</div>';
  }
  function errorState(msg) {
    return '<div class="state"><div class="state-title state-error">No se pudo cargar</div>' +
      '<div>' + esc(msg) + '</div></div>';
  }

  /* ---- toasts ---- */
  function toast(msg, tipo) {
    var cont = document.getElementById("toasts");
    var el = document.createElement("div");
    el.className = "toast toast-" + (tipo || "info");
    el.textContent = msg;
    cont.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 300);
    }, 3200);
  }

  /* ---- modal ---- */
  function openModal(title, bodyHtml, wide) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = bodyHtml;
    var modal = document.querySelector("#modal-overlay .modal");
    modal.classList.toggle("modal-wide", !!wide);
    document.getElementById("modal-overlay").hidden = false;
    // foco al primer input
    var first = document.querySelector("#modal-body input, #modal-body textarea, #modal-body select");
    if (first) setTimeout(function () { first.focus(); }, 50);
  }
  function closeModal() {
    document.getElementById("modal-overlay").hidden = true;
    document.getElementById("modal-body").innerHTML = "";
  }

  /* ---- búsqueda (topbar) ---- */
  function enableSearch(handler) {
    var input = document.getElementById("search-input");
    input.hidden = false;
    input.value = "";
    input.oninput = function () { handler(input.value); };
  }
  function disableSearch() {
    var input = document.getElementById("search-input");
    input.hidden = true;
    input.value = "";
    input.oninput = null;
  }

  /* ---- validación de formularios ---- */
  function validarRequerido(inputEl) {
    var fg = inputEl.closest(".fg");
    var msg = fg ? fg.querySelector(".err-msg") : null;
    if (!inputEl.value.trim()) {
      if (fg) fg.classList.add("invalid");
      if (msg) { msg.textContent = "Este campo es obligatorio"; msg.hidden = false; }
      inputEl.addEventListener("input", function limpiar() {
        if (fg) fg.classList.remove("invalid");
        if (msg) msg.hidden = true;
        inputEl.removeEventListener("input", limpiar);
      });
      return false;
    }
    if (fg) fg.classList.remove("invalid");
    if (msg) msg.hidden = true;
    return true;
  }

  return {
    esc: esc, fmtMoney: fmtMoney, fmtNum: fmtNum, fmtDate: fmtDate,
    loading: loading, emptyState: emptyState, errorState: errorState,
    toast: toast, openModal: openModal, closeModal: closeModal,
    enableSearch: enableSearch, disableSearch: disableSearch,
    validarRequerido: validarRequerido
  };
})();

/* ----------------------------------------------------------------------------
   ROUTER + APP
   ---------------------------------------------------------------------------- */
(function () {

  var VISTAS = {
    dashboard: { titulo: "Panel",    render: function (c) { return window.Dashboard.render(c); },   buscar: false },
    stock:     { titulo: "Stock",    render: function (c) { return window.Stock.render(c); },       buscar: true  },
    leads:     { titulo: "Clientes", render: function (c) { return window.Leads_View.render(c); },  buscar: true  },
    consultas: { titulo: "Consultas",render: function (c) { return window.Consultas.render(c); },   buscar: true  },
    usuarios:  { titulo: "Equipo",   render: function (c) { return window.Usuarios.render(c); },    buscar: false }
  };

  var vistaActual = null;

  // Panel simple: solo estas vistas se pueden abrir. El resto (dashboard, leads,
  // usuarios) queda desactivado sin borrar su código. Reactivar = agregar la key acá.
  var VISTAS_HABILITADAS = ["stock", "consultas"];

  function navegar(vista) {
    if (!VISTAS[vista] || VISTAS_HABILITADAS.indexOf(vista) === -1) vista = "stock";

    vistaActual = vista;
    var def = VISTAS[vista];

    document.getElementById("view-title").textContent = def.titulo;

    // marcar nav activo
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === vista);
    });

    // búsqueda
    if (def.buscar) {
      // la propia vista llamará enableSearch con su handler
    } else {
      window.UI.disableSearch();
    }

    cerrarSidebarMobile();

    var cont = document.getElementById("view-container");
    Promise.resolve(def.render(cont)).catch(function (e) {
      cont.innerHTML = window.UI.errorState(e.message || "Error inesperado");
    });
  }

  /* ---- sidebar mobile ---- */
  function abrirSidebarMobile() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebar-backdrop").classList.add("show");
  }
  function cerrarSidebarMobile() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-backdrop").classList.remove("show");
  }

  /* ---- aplicar rol a la UI ---- */
  function aplicarRol() {
    var p = window.Auth.estado.perfil || {};
    document.getElementById("user-name").textContent = p.nombre || "Usuario";
    document.getElementById("user-rol").textContent = p.rol || "—";
    document.getElementById("user-avatar").textContent = (p.nombre || "?").charAt(0).toUpperCase();

    var esDueno = window.Auth.esDueno();
    document.querySelectorAll(".nav-solo-dueno").forEach(function (el) {
      el.hidden = !esDueno;
    });
  }

  function mostrarApp() {
    document.getElementById("login-screen").hidden = true;
    document.getElementById("app").hidden = false;
    aplicarRol();
    navegar("stock");
    // Contador de consultas no leídas en el menú lateral.
    try {
      if (window.Consultas && window.Consultas.actualizarContador) {
        window.Consultas.actualizarContador();
      }
    } catch (e) { console.warn("[CRM] contador consultas:", e.message); }
  }

  function mostrarLogin() {
    document.getElementById("app").hidden = true;
    document.getElementById("login-screen").hidden = false;
  }

  /* ---- login form ---- */
  function cablearLogin() {
    var form = document.getElementById("login-form");
    var errBox = document.getElementById("login-error");
    var btn = document.getElementById("login-btn");

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      errBox.hidden = true;
      var email = document.getElementById("login-email").value.trim();
      var pass = document.getElementById("login-pass").value;

      if (!email || !pass) {
        errBox.textContent = "Completá email y contraseña.";
        errBox.hidden = false;
        return;
      }
      if (!window.CRM_CONFIG_OK) {
        errBox.textContent = "Faltan las credenciales de Supabase en js/config.js.";
        errBox.hidden = false;
        return;
      }

      btn.disabled = true; btn.textContent = "Ingresando…";
      try {
        await window.Auth.login(email, pass);
        mostrarApp();
      } catch (e) {
        errBox.textContent = e.message;
        errBox.hidden = false;
      } finally {
        btn.disabled = false; btn.textContent = "Ingresar";
      }
    });
  }

  /* ---- listeners globales ---- */
  function cablearGlobal() {
    // nav
    document.getElementById("nav").addEventListener("click", function (ev) {
      var btn = ev.target.closest(".nav-item");
      if (btn) navegar(btn.getAttribute("data-view"));
    });

    // logout
    document.getElementById("logout-btn").addEventListener("click", async function () {
      await window.Auth.logout();
      mostrarLogin();
    });

    // hamburguesa
    document.getElementById("hamburger").addEventListener("click", abrirSidebarMobile);
    document.getElementById("sidebar-backdrop").addEventListener("click", cerrarSidebarMobile);

    // modal: cerrar
    document.getElementById("modal-close").addEventListener("click", window.UI.closeModal);
    document.getElementById("modal-overlay").addEventListener("click", function (ev) {
      if (ev.target.id === "modal-overlay") window.UI.closeModal();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") window.UI.closeModal();
    });
  }

  /* ---- init ---- */
  async function init() {
    cablearLogin();
    cablearGlobal();

    if (!window.sb) {
      var errBox = document.getElementById("login-error");
      errBox.textContent = "No se pudo inicializar Supabase. Revisá la conexión y js/config.js.";
      errBox.hidden = false;
      return;
    }

    // ¿Sesión existente? Entrar directo.
    try {
      var hay = await window.Auth.verificarSesion();
      if (hay) { mostrarApp(); return; }
    } catch (e) {
      console.warn("[CRM] Error verificando sesión:", e.message);
    }
    mostrarLogin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
