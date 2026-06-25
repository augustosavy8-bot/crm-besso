/* ============================================================================
   USUARIOS / EQUIPO — solo dueño
   Lista al equipo con rol y rendimiento (leads ganados / totales).
   El dueño puede cambiar el rol de cada usuario.
   Expone window.Usuarios.render(container).
   ============================================================================ */

window.Usuarios = (function () {

  var _container = null;

  async function render(container) {
    _container = container;

    // Guard de seguridad en el frontend (la real está en RLS).
    if (!window.Auth.esDueno()) {
      container.innerHTML = window.UI.emptyState(
        "Acceso restringido",
        "Solo el dueño puede ver la gestión del equipo."
      );
      return;
    }

    container.innerHTML = window.UI.loading("Cargando equipo…");

    var perfiles, leads;
    try {
      perfiles = await window.Data.Perfiles.listar();
      leads = await window.Data.Leads.listar();
    } catch (e) {
      container.innerHTML = window.UI.errorState(e.message);
      return;
    }

    // Rendimiento por usuario.
    var stats = {};
    perfiles.forEach(function (p) { stats[p.id] = { total: 0, ganados: 0 }; });
    leads.forEach(function (l) {
      if (!l.vendedor_id || !stats[l.vendedor_id]) return;
      stats[l.vendedor_id].total++;
      if (l.estado === "ganado") stats[l.vendedor_id].ganados++;
    });

    var html = '<div class="team-grid">';
    perfiles.forEach(function (p) {
      var ini = (p.nombre || "?").charAt(0).toUpperCase();
      var st = stats[p.id] || { total: 0, ganados: 0 };
      var soyYo = p.id === window.Auth.estado.user.id;
      html += '<div class="team-card">' +
        '<div class="team-top">' +
          '<div class="team-avatar">' + window.UI.esc(ini) + '</div>' +
          '<div>' +
            '<div class="team-name">' + window.UI.esc(p.nombre || "—") +
              (soyYo ? ' <span class="badge badge-azul">vos</span>' : '') + '</div>' +
            '<select class="rol-select" data-id="' + p.id + '"' + (soyYo ? ' disabled title="No podés cambiar tu propio rol"' : '') + '>' +
              '<option value="vendedor"' + (p.rol === "vendedor" ? " selected" : "") + '>Vendedor</option>' +
              '<option value="dueño"' + (p.rol === "dueño" ? " selected" : "") + '>Dueño</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="team-stats">' +
          '<div><div class="team-stat-val">' + st.total + '</div><div class="team-stat-lbl">Clientes</div></div>' +
          '<div><div class="team-stat-val">' + st.ganados + '</div><div class="team-stat-lbl">Ventas</div></div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll(".rol-select").forEach(function (sel) {
      sel.addEventListener("change", async function () {
        var id = sel.getAttribute("data-id");
        var rol = sel.value;
        sel.disabled = true;
        try {
          await window.Data.Perfiles.cambiarRol(id, rol);
          window.UI.toast("Rol actualizado", "ok");
        } catch (e) {
          window.UI.toast("Error: " + e.message, "err");
        } finally {
          sel.disabled = false;
        }
      });
    });
  }

  return { render: render };
})();
