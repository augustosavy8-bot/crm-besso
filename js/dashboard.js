/* ============================================================================
   DASHBOARD — panel con métricas, gráfico de barras (ventas por vendedor)
   y embudo por etapa. Usa window.UI (definido en app.js) para formato.
   Expone window.Dashboard.render(container).
   ============================================================================ */

window.Dashboard = (function () {

  var ETAPAS = [
    { key: "nuevo",       label: "Nuevos" },
    { key: "contactado",  label: "Contactados" },
    { key: "negociacion", label: "En negociación" },
    { key: "ganado",      label: "Ganados" },
    { key: "perdido",     label: "Perdidos" }
  ];

  function esMismoMes(fechaIso) {
    if (!fechaIso) return false;
    var d = new Date(fechaIso);
    var hoy = new Date();
    return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  }

  async function render(container) {
    container.innerHTML = window.UI.loading("Cargando panel…");

    var autos, leads;
    try {
      autos = await window.Data.Autos.listar();
      leads = await window.Data.Leads.listar();
    } catch (e) {
      container.innerHTML = window.UI.errorState(e.message);
      return;
    }

    // ----- Métricas -----
    var disponibles = autos.filter(function (a) { return a.estado === "disponible"; }).length;
    var sinContactar = leads.filter(function (l) { return l.estado === "nuevo"; }).length;
    var enNegociacion = leads.filter(function (l) { return l.estado === "negociacion"; }).length;
    var vendidosMes = leads.filter(function (l) {
      return l.estado === "ganado" && esMismoMes(l.created_at);
    }).length;

    // ----- Ventas por vendedor (leads ganados) -----
    var porVendedor = {};
    leads.forEach(function (l) {
      if (l.estado !== "ganado") return;
      var nombre = (l.vendedor && l.vendedor.nombre) ? l.vendedor.nombre : "Sin asignar";
      porVendedor[nombre] = (porVendedor[nombre] || 0) + 1;
    });
    var ventas = Object.keys(porVendedor).map(function (n) {
      return { nombre: n, total: porVendedor[n] };
    }).sort(function (a, b) { return b.total - a.total; });
    var maxVenta = ventas.reduce(function (m, v) { return Math.max(m, v.total); }, 0) || 1;

    // ----- Embudo -----
    var embudo = ETAPAS.map(function (et) {
      return {
        label: et.label,
        key: et.key,
        count: leads.filter(function (l) { return l.estado === et.key; }).length
      };
    });
    var maxEmbudo = embudo.reduce(function (m, e) { return Math.max(m, e.count); }, 0) || 1;

    // ----- Render -----
    var html = "";

    html += '<div class="metrics-grid">';
    html += metric("Autos disponibles", disponibles, "de " + autos.length + " en stock", "");
    html += metric("Leads sin contactar", sinContactar, "esperando primer contacto", "m-ambar");
    html += metric("En negociación", enNegociacion, "oportunidades activas", "m-navy");
    html += metric("Vendidos del mes", vendidosMes, "cierres este mes", "m-verde");
    html += '</div>';

    html += '<div class="dash-cols">';

    // Panel ventas por vendedor
    html += '<div class="panel"><div class="panel-title">Ventas por vendedor</div>';
    if (ventas.length === 0) {
      html += '<div class="state" style="padding:30px"><div>Todavía no hay ventas registradas.</div></div>';
    } else {
      html += '<div class="bars">';
      ventas.forEach(function (v) {
        var pct = Math.round((v.total / maxVenta) * 100);
        html += '<div class="bar-row">' +
          '<div class="bar-name">' + window.UI.esc(v.nombre) + '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="bar-val">' + v.total + '</div>' +
          '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // Panel embudo
    html += '<div class="panel"><div class="panel-title">Embudo de ventas</div>';
    html += '<div class="funnel">';
    embudo.forEach(function (e) {
      var pct = Math.round((e.count / maxEmbudo) * 100);
      var minW = Math.max(pct, 22);
      html += '<div class="funnel-row">' +
        '<div class="funnel-bar" style="flex:0 0 ' + minW + '%">' +
          '<span>' + e.label + '</span>' +
          '<span class="funnel-count">' + e.count + '</span>' +
        '</div></div>';
    });
    html += '</div></div>';

    html += '</div>'; // dash-cols

    container.innerHTML = html;
  }

  function metric(label, value, sub, cls) {
    return '<div class="metric ' + cls + '">' +
      '<div class="metric-label">' + label + '</div>' +
      '<div class="metric-value">' + value + '</div>' +
      '<div class="metric-sub">' + sub + '</div>' +
      '</div>';
  }

  return { render: render };
})();
