/* ============================================================================
   CONSULTAS — bandeja de consultas que llegan desde la web pública
   Tabla "consultas" (compartida): nombre, telefono, mensaje, auto, leida,
   created_at. Visible para Dueño y Vendedores (RLS permite a authenticated).
   Acciones: marcar leída, WhatsApp, convertir en lead.
   Expone window.Consultas.render(container) y window.Consultas.actualizarContador().
   ============================================================================ */

window.Consultas = (function () {

  var _consultas = [];
  var _container = null;
  // Ids convertidas a lead en esta sesión (para mostrar "gestionada").
  var _convertidas = {};

  async function render(container) {
    _container = container;
    container.innerHTML = window.UI.loading("Cargando consultas…");

    try {
      _consultas = await window.Data.Consultas.listar();
    } catch (e) {
      container.innerHTML = window.UI.errorState(e.message);
      return;
    }

    pintar(_consultas);
    actualizarContador(); // por si cambió algo

    window.UI.enableSearch(function (q) {
      var t = q.trim().toLowerCase();
      var f = _consultas.filter(function (c) {
        return ((c.nombre || "") + " " + (c.telefono || "") + " " + (c.auto || "") + " " + (c.mensaje || ""))
          .toLowerCase().indexOf(t) !== -1;
      });
      pintarLista(f);
    });
  }

  function pintar(consultas) {
    var noLeidas = consultas.filter(function (c) { return !c.leida; }).length;
    _container.innerHTML =
      '<div class="section-head">' +
        '<div class="cons-resumen">' +
          (noLeidas
            ? '<span class="badge badge-azul">' + noLeidas + ' sin leer</span>'
            : '<span class="badge badge-gris">Todo al día</span>') +
        '</div>' +
      '</div>' +
      '<div id="cons-lista"></div>';
    pintarLista(consultas);
  }

  function pintarLista(consultas) {
    var cont = document.getElementById("cons-lista");
    if (!cont) return;

    if (!consultas.length) {
      cont.innerHTML = window.UI.emptyState("No hay consultas nuevas", "Cuando alguien escriba desde la web, va a aparecer acá.");
      return;
    }

    cont.innerHTML = '<div class="cons-grid">' + consultas.map(tarjeta).join("") + '</div>';

    // Delegación de acciones.
    cont.querySelectorAll("[data-leida]").forEach(function (b) {
      b.addEventListener("click", function () { marcarLeida(b.getAttribute("data-leida")); });
    });
    cont.querySelectorAll("[data-lead]").forEach(function (b) {
      b.addEventListener("click", function () { convertirEnLead(b.getAttribute("data-lead")); });
    });
    cont.querySelectorAll("[data-borrar]").forEach(function (b) {
      b.addEventListener("click", function () { confirmarBorrar(b.getAttribute("data-borrar")); });
    });
  }

  function tarjeta(c) {
    var telWa = (c.telefono || "").replace(/[^0-9]/g, "");
    var waLink = telWa ? "https://wa.me/" + telWa : null;
    var convertida = !!_convertidas[c.id];

    var estado = convertida
      ? '<span class="badge badge-verde">Convertida en lead</span>'
      : (c.leida ? '<span class="badge badge-gris">Leída</span>'
                 : '<span class="badge badge-azul">Nueva</span>');

    var acciones = '';
    if (!c.leida && !convertida) {
      acciones += '<button class="btn btn-sec btn-sm" data-leida="' + c.id + '">Marcar como leída</button>';
    }
    if (waLink) {
      acciones += '<a class="btn wa-btn btn-sm" href="' + waLink + '" target="_blank" rel="noopener">WhatsApp</a>';
    }
    if (!convertida) {
      acciones += '<button class="btn btn-sm" data-lead="' + c.id + '">Convertir en lead</button>';
    } else {
      acciones += '<span class="cons-gestionada">✓ Gestionada</span>';
    }
    // Solo el dueño puede borrar consultas (la RLS también lo restringe).
    if (window.Auth.esDueno()) {
      acciones += '<button class="btn btn-danger btn-sm" data-borrar="' + c.id + '">Borrar</button>';
    }

    return '<div class="cons-card' + (c.leida || convertida ? '' : ' nueva') + '">' +
      '<div class="cons-head">' +
        '<div class="cons-nombre">' + window.UI.esc(c.nombre || "Sin nombre") + '</div>' +
        estado +
      '</div>' +
      '<div class="cons-meta">' +
        '<span class="cons-tel">' + window.UI.esc(c.telefono || "—") + '</span>' +
        (c.auto ? '<span class="cons-auto">Interés: ' + window.UI.esc(c.auto) + '</span>' : '') +
        '<span class="cons-fecha">' + window.UI.fmtDate(c.created_at) + '</span>' +
      '</div>' +
      (c.mensaje ? '<div class="cons-msg">' + window.UI.esc(c.mensaje) + '</div>' : '') +
      '<div class="cons-actions">' + acciones + '</div>' +
      '</div>';
  }

  /* ----------------------------- acciones ----------------------------- */
  async function marcarLeida(id) {
    try {
      await window.Data.Consultas.marcarLeida(id);
      var c = _consultas.find(function (x) { return String(x.id) === String(id); });
      if (c) c.leida = true;
      pintar(_consultas);
      actualizarContador();
      window.UI.toast("Consulta marcada como leída", "ok");
    } catch (e) {
      window.UI.toast("Error: " + e.message, "err");
    }
  }

  async function convertirEnLead(id) {
    var c = _consultas.find(function (x) { return String(x.id) === String(id); });
    if (!c) return;
    try {
      // 1) Crear el lead asignado al usuario actual.
      await window.Data.Leads.crear({
        nombre: c.nombre || "",
        telefono: c.telefono || "",
        auto: c.auto || "",
        estado: "nuevo",
        vendedor_id: window.Auth.estado.user.id
      });
      // 2) Marcar la consulta como leída/gestionada.
      try {
        await window.Data.Consultas.marcarLeida(id);
        c.leida = true;
      } catch (e2) {
        // El lead ya se creó; avisamos pero no rompemos.
        window.UI.toast("Lead creado, pero no se pudo marcar la consulta como leída", "info");
      }
      _convertidas[id] = true;
      pintar(_consultas);
      actualizarContador();
      window.UI.toast("Consulta convertida en lead", "ok");
    } catch (e) {
      window.UI.toast("Error al convertir: " + e.message, "err");
    }
  }

  function confirmarBorrar(id) {
    var c = _consultas.find(function (x) { return String(x.id) === String(id); });
    var nombre = (c && c.nombre) ? c.nombre : "esta consulta";
    var body =
      '<p style="margin-bottom:20px">¿Seguro que querés borrar la consulta de <strong>' +
        window.UI.esc(nombre) + '</strong>? Esta acción no se puede deshacer.</p>' +
      '<div class="form-actions">' +
        '<button class="btn btn-sec" id="del-cancel">Cancelar</button>' +
        '<button class="btn btn-danger" id="del-ok">Borrar</button>' +
      '</div>';
    window.UI.openModal("Borrar consulta", body);
    document.getElementById("del-cancel").addEventListener("click", window.UI.closeModal);
    document.getElementById("del-ok").addEventListener("click", async function () {
      var btn = this; btn.disabled = true; btn.textContent = "Borrando…";
      try {
        await window.Data.Consultas.eliminar(id);
        _consultas = _consultas.filter(function (x) { return String(x.id) !== String(id); });
        delete _convertidas[id];
        window.UI.closeModal();
        pintar(_consultas);
        actualizarContador();
        window.UI.toast("Consulta borrada", "ok");
      } catch (e) {
        btn.disabled = false; btn.textContent = "Borrar";
        window.UI.toast("Error: " + e.message, "err");
      }
    });
  }

  /* ----------------------- contador del menú lateral ----------------------- */
  async function actualizarContador() {
    var badge = document.getElementById("consultas-badge");
    if (!badge) return;
    try {
      var n = await window.Data.Consultas.contarNoLeidas();
      if (n > 0) {
        badge.textContent = n > 99 ? "99+" : String(n);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    } catch (e) {
      // No rompemos la UI por el contador.
      badge.hidden = true;
    }
  }

  return { render: render, actualizarContador: actualizarContador };
})();
