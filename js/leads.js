/* ============================================================================
   LEADS — pipeline kanban + ficha de cliente
   El vendedor solo ve sus leads (RLS). El dueño ve todos.
   Expone window.Leads_View.render(container).
   ============================================================================ */

window.Leads_View = (function () {

  var COLUMNAS = [
    { key: "nuevo",       label: "Nuevo",        cls: "" },
    { key: "contactado",  label: "Contactado",   cls: "" },
    { key: "negociacion", label: "Negociación",  cls: "" },
    { key: "ganado",      label: "Ganado",       cls: "col-ganado" },
    { key: "perdido",     label: "Perdido",      cls: "col-perdido" }
  ];

  var _leads = [];
  var _container = null;

  async function render(container) {
    _container = container;
    container.innerHTML = window.UI.loading("Cargando clientes…");

    try {
      _leads = await window.Data.Leads.listar();
    } catch (e) {
      container.innerHTML = window.UI.errorState(e.message);
      return;
    }

    pintar(_leads);

    window.UI.enableSearch(function (q) {
      var t = q.trim().toLowerCase();
      var f = _leads.filter(function (l) {
        return ((l.nombre || "") + " " + (l.telefono || "") + " " + (l.auto || ""))
          .toLowerCase().indexOf(t) !== -1;
      });
      pintarKanban(f);
    });
  }

  function pintar(leads) {
    _container.innerHTML =
      '<div class="section-head">' +
        '<div></div>' +
        '<button class="btn" id="btn-nuevo-lead">+ Nuevo cliente</button>' +
      '</div>' +
      '<div id="kanban-wrap"></div>';

    pintarKanban(leads);

    document.getElementById("btn-nuevo-lead")
      .addEventListener("click", function () { abrirForm(null); });
  }

  function pintarKanban(leads) {
    var wrap = document.getElementById("kanban-wrap");
    if (!wrap) return;

    var html = '<div class="kanban">';
    COLUMNAS.forEach(function (col) {
      var items = leads.filter(function (l) { return l.estado === col.key; });
      html += '<div class="kcol ' + col.cls + '">' +
        '<div class="kcol-head">' +
          '<span class="kcol-title">' + col.label + '</span>' +
          '<span class="kcol-count">' + items.length + '</span>' +
        '</div><div class="kcards">';

      if (!items.length) {
        html += '<div class="kcol-empty">—</div>';
      } else {
        items.forEach(function (l) {
          var vend = (l.vendedor && l.vendedor.nombre) ? l.vendedor.nombre : "";
          html += '<div class="kcard" data-lead="' + l.id + '">' +
            '<div class="kcard-nombre">' + window.UI.esc(l.nombre || "Sin nombre") + '</div>' +
            (l.auto ? '<div class="kcard-auto">' + window.UI.esc(l.auto) + '</div>' : '') +
            '<div class="kcard-foot">' +
              '<span class="kcard-tel">' + window.UI.esc(l.telefono || "—") + '</span>' +
              (vend ? '<span class="kcard-vend">' + window.UI.esc(vend) + '</span>' : '') +
            '</div></div>';
        });
      }
      html += '</div></div>';
    });
    html += '</div>';
    wrap.innerHTML = html;

    wrap.querySelectorAll(".kcard").forEach(function (card) {
      card.addEventListener("click", function () {
        var lead = _leads.find(function (x) { return String(x.id) === card.getAttribute("data-lead"); });
        abrirFicha(lead);
      });
    });
  }

  /* ----------------------------- FICHA (modal) ----------------------------- */
  async function abrirFicha(lead) {
    var telWa = (lead.telefono || "").replace(/[^0-9]/g, "");
    var waLink = telWa ? "https://wa.me/" + telWa : null;

    var etapasHtml = COLUMNAS.map(function (c) {
      return '<button class="etapa-btn' + (c.key === lead.estado ? " active" : "") +
        '" data-etapa="' + c.key + '">' + c.label + '</button>';
    }).join("");

    var vend = (lead.vendedor && lead.vendedor.nombre) ? lead.vendedor.nombre : "Sin asignar";

    var body =
      '<div class="ficha-block">' +
        '<div class="ficha-row" style="justify-content:space-between;align-items:flex-start">' +
          '<div>' +
            '<div class="ficha-label">Teléfono</div>' +
            '<div style="font-weight:600">' + window.UI.esc(lead.telefono || "—") + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="ficha-label">Vendedor</div>' +
            '<div style="font-weight:600">' + window.UI.esc(vend) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ficha-block">' +
        '<div class="ficha-label">Auto de interés</div>' +
        '<div style="font-weight:600">' + window.UI.esc(lead.auto || "—") + '</div>' +
      '</div>' +

      '<div class="ficha-block">' +
        '<div class="ficha-label">Etapa</div>' +
        '<div class="etapas" id="ficha-etapas">' + etapasHtml + '</div>' +
      '</div>' +

      '<div class="ficha-block">' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          (waLink ? '<a class="btn wa-btn" href="' + waLink + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
          '<button class="btn btn-sec" id="ficha-editar">Editar datos</button>' +
          '<button class="btn btn-danger" id="ficha-borrar">Borrar</button>' +
        '</div>' +
      '</div>' +

      '<div class="ficha-block">' +
        '<div class="ficha-label">Notas de seguimiento</div>' +
        '<div class="nota-add">' +
          '<textarea id="nota-texto" placeholder="Agregar nota…" rows="2"></textarea>' +
          '<button class="btn" id="nota-add-btn">Agregar</button>' +
        '</div>' +
        '<div class="notas-list" id="notas-list"><div class="state" style="padding:20px"><div class="spinner"></div></div></div>' +
      '</div>';

    window.UI.openModal(lead.nombre || "Cliente", body, true);

    // Cambiar etapa
    document.querySelectorAll("#ficha-etapas .etapa-btn").forEach(function (b) {
      b.addEventListener("click", async function () {
        var nueva = b.getAttribute("data-etapa");
        if (nueva === lead.estado) return;
        try {
          var actualizado = await window.Data.Leads.actualizar(lead.id, { estado: nueva });
          lead.estado = nueva;
          // refrescar UI de botones
          document.querySelectorAll("#ficha-etapas .etapa-btn").forEach(function (x) {
            x.classList.toggle("active", x.getAttribute("data-etapa") === nueva);
          });
          // actualizar cache y kanban detrás
          var idx = _leads.findIndex(function (x) { return x.id === lead.id; });
          if (idx !== -1) _leads[idx] = actualizado;
          pintarKanban(_leads);
          window.UI.toast("Etapa actualizada", "ok");
        } catch (e) {
          window.UI.toast("Error: " + e.message, "err");
        }
      });
    });

    document.getElementById("ficha-editar").addEventListener("click", function () {
      abrirForm(lead);
    });
    document.getElementById("ficha-borrar").addEventListener("click", function () {
      confirmarBorrar(lead);
    });

    // Notas
    document.getElementById("nota-add-btn").addEventListener("click", function () {
      agregarNota(lead);
    });
    cargarNotas(lead.id);
  }

  async function cargarNotas(leadId) {
    var cont = document.getElementById("notas-list");
    if (!cont) return;
    try {
      var notas = await window.Data.Notas.listarPorLead(leadId);
      if (!cont) return;
      if (!notas.length) {
        cont.innerHTML = '<div style="color:var(--txt-suave);font-size:13px;padding:8px 0">Sin notas todavía.</div>';
        return;
      }
      cont.innerHTML = notas.map(function (n) {
        var autor = (n.autor && n.autor.nombre) ? n.autor.nombre : "—";
        return '<div class="nota">' +
          '<div class="nota-texto">' + window.UI.esc(n.texto) + '</div>' +
          '<div class="nota-meta"><span>' + window.UI.esc(autor) + '</span>' +
          '<span>' + window.UI.fmtDate(n.created_at) + '</span></div>' +
          '</div>';
      }).join("");
    } catch (e) {
      cont.innerHTML = '<div class="state-error" style="font-size:13px">' + window.UI.esc(e.message) + '</div>';
    }
  }

  async function agregarNota(lead) {
    var ta = document.getElementById("nota-texto");
    var texto = ta.value.trim();
    if (!texto) { window.UI.toast("Escribí una nota primero", "info"); return; }
    var btn = document.getElementById("nota-add-btn");
    btn.disabled = true;
    try {
      await window.Data.Notas.crear({
        lead_id: lead.id,
        texto: texto,
        autor_id: window.Auth.estado.user.id
      });
      ta.value = "";
      cargarNotas(lead.id);
      window.UI.toast("Nota agregada", "ok");
    } catch (e) {
      window.UI.toast("Error: " + e.message, "err");
    } finally {
      btn.disabled = false;
    }
  }

  /* ----------------------------- FORM (modal) ----------------------------- */
  function abrirForm(lead) {
    var esEdicion = !!lead;
    lead = lead || {};
    var body =
      '<form id="form-lead" novalidate>' +
        '<div class="form-grid">' +
          '<div class="fg"><label>Nombre *</label>' +
            '<input name="nombre" type="text" value="' + (lead.nombre ? window.UI.esc(lead.nombre) : "") + '" />' +
            '<div class="err-msg" hidden></div></div>' +
          '<div class="fg"><label>Teléfono</label>' +
            '<input name="telefono" type="tel" value="' + (lead.telefono ? window.UI.esc(lead.telefono) : "") + '" placeholder="549..." />' +
            '<div class="err-msg" hidden></div></div>' +
          '<div class="fg full"><label>Auto de interés</label>' +
            '<input name="auto" type="text" value="' + (lead.auto ? window.UI.esc(lead.auto) : "") + '" /></div>' +
          (esEdicion ? '' :
            '<div class="fg full"><label>Etapa inicial</label><select name="estado">' +
              COLUMNAS.map(function (c) { return '<option value="' + c.key + '">' + c.label + '</option>'; }).join("") +
            '</select></div>') +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn btn-sec" id="lead-cancel">Cancelar</button>' +
          '<button type="submit" class="btn" id="lead-save">' + (esEdicion ? "Guardar cambios" : "Crear cliente") + '</button>' +
        '</div>' +
      '</form>';

    window.UI.openModal(esEdicion ? "Editar cliente" : "Nuevo cliente", body);

    document.getElementById("lead-cancel").addEventListener("click", window.UI.closeModal);

    document.getElementById("form-lead").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var f = ev.target;
      if (!window.UI.validarRequerido(f.nombre)) return;

      var datos = {
        nombre: f.nombre.value.trim(),
        telefono: f.telefono.value.trim(),
        auto: f.auto.value.trim()
      };
      if (!esEdicion) {
        datos.estado = f.estado.value;
        // Asignar el lead al usuario actual (RLS exige vendedor_id = auth.uid()
        // salvo que sea dueño; asignarlo a uno mismo siempre es válido).
        datos.vendedor_id = window.Auth.estado.user.id;
      }

      var btn = document.getElementById("lead-save");
      btn.disabled = true; btn.textContent = "Guardando…";
      try {
        if (esEdicion) {
          await window.Data.Leads.actualizar(lead.id, datos);
          window.UI.toast("Cliente actualizado", "ok");
        } else {
          await window.Data.Leads.crear(datos);
          window.UI.toast("Cliente creado", "ok");
        }
        window.UI.closeModal();
        render(_container);
      } catch (e) {
        btn.disabled = false; btn.textContent = "Guardar";
        window.UI.toast("Error: " + e.message, "err");
      }
    });
  }

  function confirmarBorrar(lead) {
    var body =
      '<p style="margin-bottom:20px">¿Borrar el cliente <strong>' +
        window.UI.esc(lead.nombre || "") + '</strong> y todas sus notas?</p>' +
      '<div class="form-actions">' +
        '<button class="btn btn-sec" id="del-cancel">Cancelar</button>' +
        '<button class="btn btn-danger" id="del-ok">Borrar</button>' +
      '</div>';
    window.UI.openModal("Borrar cliente", body);
    document.getElementById("del-cancel").addEventListener("click", window.UI.closeModal);
    document.getElementById("del-ok").addEventListener("click", async function () {
      var btn = this; btn.disabled = true; btn.textContent = "Borrando…";
      try {
        await window.Data.Leads.eliminar(lead.id);
        window.UI.toast("Cliente borrado", "ok");
        window.UI.closeModal();
        render(_container);
      } catch (e) {
        btn.disabled = false; btn.textContent = "Borrar";
        window.UI.toast("Error: " + e.message, "err");
      }
    });
  }

  return { render: render };
})();
