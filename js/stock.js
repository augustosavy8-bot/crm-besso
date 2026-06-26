/* ============================================================================
   STOCK — gestión de autos
   El dueño puede agregar/editar/borrar (modal). El vendedor solo ve.
   Expone window.Stock.render(container).
   ============================================================================ */

window.Stock = (function () {

  var _autos = [];      // cache local para búsqueda/filtro
  var _container = null;

  // Estado de fotos del formulario abierto. Cada item:
  //   { tipo:'existente', url }                       -> ya está en Storage
  //   { tipo:'nueva', dataUrl, bytes, nombreArchivo } -> comprimida, falta subir
  // El item en índice 0 es la foto PRINCIPAL.
  var _fotos = [];

  var MAX_ANCHO = 1200;       // px
  var CALIDAD = 0.72;         // JPEG
  var LIMITE_BYTES = 250 * 1024;

  var ESTADO_BADGE = {
    disponible: "badge-verde",
    reservado:  "badge-ambar",
    vendido:    "badge-gris"
  };

  async function render(container) {
    _container = container;
    container.innerHTML = window.UI.loading("Cargando stock…");

    try {
      _autos = await window.Data.Autos.listar();
    } catch (e) {
      container.innerHTML = window.UI.errorState(e.message);
      return;
    }

    pintar(_autos);
    window.UI.enableSearch(function (q) {
      var t = q.trim().toLowerCase();
      var f = _autos.filter(function (a) {
        return (a.marca + " " + a.modelo + " " + (a.version || "") + " " + (a.anio || ""))
          .toLowerCase().indexOf(t) !== -1;
      });
      pintarTabla(f);
    });
  }

  function pintar(autos) {
    var esDueno = window.Auth.esDueno();
    var html = '<div class="section-head">' +
      '<div></div>' +
      (esDueno
        ? '<button class="btn" id="btn-nuevo-auto">+ Agregar auto</button>'
        : '') +
      '</div>' +
      '<div id="stock-tabla-wrap"></div>';
    _container.innerHTML = html;

    pintarTabla(autos);

    if (esDueno) {
      document.getElementById("btn-nuevo-auto")
        .addEventListener("click", function () { abrirForm(null); });
    }
  }

  function pintarTabla(autos) {
    var wrap = document.getElementById("stock-tabla-wrap");
    if (!wrap) return;
    var esDueno = window.Auth.esDueno();

    if (!autos.length) {
      wrap.innerHTML = window.UI.emptyState("No hay autos cargados", "Agregá el primer vehículo al stock.");
      return;
    }

    var rows = autos.map(function (a) {
      var nombre = window.UI.esc((a.marca || "") + " " + (a.modelo || ""));
      var sub = window.UI.esc([a.version, a.anio].filter(Boolean).join(" · "));
      var km = a.km ? window.UI.esc(String(a.km)) : "—";
      var precio = a.precio ? "$ " + window.UI.esc(String(a.precio)) : "—";
      var badge = ESTADO_BADGE[a.estado] || "badge-gris";

      // Miniatura de la foto principal (primera del array) o placeholder.
      var fotos = Array.isArray(a.fotos) ? a.fotos : [];
      var thumb = fotos.length
        ? '<div class="tbl-thumb" style="background-image:url(\'' +
            window.UI.esc(thumbUrl(fotos[0])) + '\')"></div>'
        : '<div class="tbl-thumb tbl-thumb-empty">Sin foto</div>';

      var acciones = esDueno
        ? '<div class="row-actions">' +
            '<button class="btn btn-sec btn-sm" data-edit="' + a.id + '">Editar</button>' +
            '<button class="btn btn-danger btn-sm" data-del="' + a.id + '">Borrar</button>' +
          '</div>'
        : '<span class="tbl-auto-sub">Solo lectura</span>';

      return '<tr>' +
        '<td>' + thumb + '</td>' +
        '<td><div class="tbl-auto-nombre">' + nombre + '</div>' +
          (sub ? '<div class="tbl-auto-sub">' + sub + '</div>' : '') + '</td>' +
        '<td>' + km + '</td>' +
        '<td class="tbl-precio">' + precio + '</td>' +
        '<td><span class="badge ' + badge + '">' + window.UI.esc(a.estado) + '</span></td>' +
        '<td>' + acciones + '</td>' +
        '</tr>';
    }).join("");

    wrap.innerHTML =
      '<div class="table-wrap"><table class="tbl"><thead><tr>' +
      '<th>Foto</th><th>Vehículo</th><th>Km</th><th>Precio</th><th>Estado</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    if (esDueno) {
      wrap.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () {
          var auto = _autos.find(function (x) { return String(x.id) === b.getAttribute("data-edit"); });
          abrirForm(auto);
        });
      });
      wrap.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          var auto = _autos.find(function (x) { return String(x.id) === b.getAttribute("data-del"); });
          confirmarBorrar(auto);
        });
      });
    }
  }

  /* ----------------------------- FORM (modal) ----------------------------- */
  function abrirForm(auto) {
    var esEdicion = !!auto;
    auto = auto || {};

    // Sembrar el estado de fotos con las que ya tiene el auto.
    _fotos = (Array.isArray(auto.fotos) ? auto.fotos : []).map(function (url) {
      return { tipo: "existente", url: url };
    });

    var body =
      '<form id="form-auto" novalidate>' +
        '<div class="form-grid">' +
          fg("marca", "Marca *", "text", auto.marca) +
          fg("modelo", "Modelo *", "text", auto.modelo) +
          fg("version", "Versión", "text", auto.version) +
          fg("anio", "Año", "number", auto.anio) +
          fgSelectKV("tipo", "Tipo (web)", [["usado", "Usado"], ["nuevo", "0km"]], auto.tipo || "usado") +
          fg("km", "Kilómetros", "text", auto.km) +
          fg("precio", "Precio", "text", auto.precio) +
          fgSelect("combustible", "Combustible", ["Nafta", "Diesel", "GNC", "Híbrido", "Eléctrico"], auto.combustible || "Nafta") +
          fgSelect("transmision", "Transmisión", ["Automático", "Manual", "CVT", "DSG"], auto.transmision || "Automático") +
          fgSelectKV("seccion", "Sección (web)", [["", "Sin destacar — catálogo general"], ["primer_auto", "Tu Primer Auto"], ["multimarca", "Multimarca"], ["toyota", "Toyota"], ["suv", "SUV"], ["pickup", "Pick-Up"], ["0km", "0km"], ["motos", "Motos"], ["seleccionado", "Seleccionados"]], auto.seccion || "") +
          fgSelect("estado", "Estado (interno CRM)", ["disponible", "reservado", "vendido"], auto.estado || "disponible") +
          fgTextarea("descripcion", "Descripción", auto.descripcion) +
          // ---- Bloque de fotos ----
          '<div class="fg full">' +
            '<label>Fotos del vehículo</label>' +
            '<div class="fotos-zona" id="fotos-zona">' +
              '<input type="file" id="fotos-input" accept="image/*" multiple />' +
              '<div class="fotos-zona-ico">📷</div>' +
              '<div class="fotos-zona-txt">Tocá para elegir fotos</div>' +
              '<div class="fotos-zona-sub">Se comprimen en tu dispositivo antes de subir. La primera es la principal.</div>' +
            '</div>' +
            '<div class="fotos-grid" id="fotos-grid"></div>' +
          '</div>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn btn-sec" id="auto-cancel">Cancelar</button>' +
          '<button type="submit" class="btn" id="auto-save">' + (esEdicion ? "Guardar cambios" : "Agregar auto") + '</button>' +
        '</div>' +
      '</form>';

    window.UI.openModal(esEdicion ? "Editar auto" : "Agregar auto", body, true);

    document.getElementById("auto-cancel").addEventListener("click", window.UI.closeModal);

    // ---- Fotos: input + delegación de quitar/principal ----
    var inputFotos = document.getElementById("fotos-input");
    inputFotos.addEventListener("change", async function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = "";
      await procesarArchivos(files);
    });

    document.getElementById("fotos-grid").addEventListener("click", function (ev) {
      var quitar = ev.target.closest("[data-quitar]");
      var princ = ev.target.closest("[data-principal]");
      if (quitar) {
        var i = parseInt(quitar.getAttribute("data-quitar"), 10);
        _fotos.splice(i, 1);
        pintarFotos();
      } else if (princ) {
        var j = parseInt(princ.getAttribute("data-principal"), 10);
        if (j > 0) {
          var it = _fotos.splice(j, 1)[0];
          _fotos.unshift(it);
          pintarFotos();
          window.UI.toast("Foto principal actualizada", "info");
        }
      }
    });

    pintarFotos();

    document.getElementById("form-auto").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var f = ev.target;
      // Validación.
      var ok = true;
      ok = window.UI.validarRequerido(f.marca) && ok;
      ok = window.UI.validarRequerido(f.modelo) && ok;
      if (!ok) return;

      var btn = document.getElementById("auto-save");
      btn.disabled = true;

      // 1) Subir las fotos nuevas; conservar las existentes. Si alguna falla,
      //    avisamos pero seguimos con el resto (no rompe el guardado).
      var urls = [];
      var fallidas = 0;
      for (var i = 0; i < _fotos.length; i++) {
        var item = _fotos[i];
        if (item.tipo === "existente") {
          urls.push(item.url);
          continue;
        }
        btn.textContent = "Subiendo foto " + (i + 1) + "/" + _fotos.length + "…";
        try {
          var nombreBase = (f.marca.value + "-" + f.modelo.value).trim();
          var url = await window.Data.Storage.subirFoto(item.dataUrl, nombreBase);
          urls.push(url);
        } catch (e) {
          fallidas++;
          window.UI.toast("No se pudo subir una foto: " + e.message, "err");
        }
      }
      if (fallidas) window.UI.toast(fallidas + " foto(s) no se subieron", "err");

      // 2) Guardar el auto con el array final de URLs.
      var datos = {
        marca: f.marca.value.trim(),
        modelo: f.modelo.value.trim(),
        version: f.version.value.trim(),
        anio: f.anio.value ? parseInt(f.anio.value, 10) : null,
        tipo: f.tipo.value,                  // 'usado' | 'nuevo'  ← filtro/badge de la web
        km: f.km.value.trim(),               // texto ("45.000 km"), nunca NULL
        precio: f.precio.value.trim(),       // texto ("24.500.000"), nunca NULL
        combustible: f.combustible.value,
        transmision: f.transmision.value,
        estado: f.estado.value,              // interno CRM (la web oculta 'vendido')
        seccion: normSeccion(f.seccion.value), // '' | primer_auto | multimarca | toyota | suv | pickup | 0km | motos | seleccionado (normalizado)
        descripcion: f.descripcion.value.trim(),
        fotos: urls
      };

      btn.textContent = "Guardando…";
      try {
        if (esEdicion) {
          await window.Data.Autos.actualizar(auto.id, datos);
          window.UI.toast("Auto actualizado", "ok");
        } else {
          await window.Data.Autos.crear(datos);
          window.UI.toast("Auto agregado", "ok");
        }
        window.UI.closeModal();
        render(_container);
      } catch (e) {
        btn.disabled = false; btn.textContent = "Guardar";
        window.UI.toast("Error: " + e.message, "err");
      }
    });
  }

  /* ---- Fotos: procesamiento, compresión y render del grid ---- */
  async function procesarArchivos(files) {
    var imagenes = files.filter(function (f) { return /^image\//.test(f.type); });
    if (!imagenes.length) {
      if (files.length) window.UI.toast("Elegí archivos de imagen", "info");
      return;
    }
    for (var i = 0; i < imagenes.length; i++) {
      try {
        var r = await comprimirImagen(imagenes[i]);
        _fotos.push({
          tipo: "nueva",
          dataUrl: r.dataUrl,
          bytes: r.bytes,
          nombreArchivo: imagenes[i].name
        });
        pintarFotos();
      } catch (e) {
        window.UI.toast("No se pudo procesar " + imagenes[i].name, "err");
      }
    }
  }

  function pintarFotos() {
    var grid = document.getElementById("fotos-grid");
    if (!grid) return;
    if (!_fotos.length) {
      grid.innerHTML = "";
      return;
    }
    grid.innerHTML = _fotos.map(function (it, i) {
      var src = it.tipo === "nueva" ? it.dataUrl : thumbUrl(it.url, 300);
      var peso = it.tipo === "nueva"
        ? '<span class="foto-peso">' + (Math.round(it.bytes / 1024)) + " KB</span>"
        : '<span class="foto-peso foto-peso-ok">guardada</span>';
      var badgePrincipal = i === 0
        ? '<span class="foto-badge-principal">★ Principal</span>'
        : '<button type="button" class="foto-set-principal" data-principal="' + i + '">Hacer principal</button>';
      return '<div class="foto-thumb' + (i === 0 ? " es-principal" : "") + '">' +
        '<img src="' + src + '" alt="" />' +
        '<button type="button" class="foto-quitar" data-quitar="' + i + '" title="Quitar">✕</button>' +
        '<div class="foto-thumb-foot">' + badgePrincipal + peso + '</div>' +
        '</div>';
    }).join("");
  }

  // Compresión en el navegador con canvas.
  // Redimensiona a máx MAX_ANCHO de ancho y baja calidad hasta entrar en LIMITE_BYTES.
  function comprimirImagen(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("No se pudo leer el archivo")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("Imagen inválida")); };
        img.onload = function () {
          try {
            var escala = Math.min(1, MAX_ANCHO / img.width);
            var w = Math.round(img.width * escala);
            var h = Math.round(img.height * escala);
            var canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            var ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h); // fondo blanco por si la imagen tiene transparencia
            ctx.drawImage(img, 0, 0, w, h);

            var q = CALIDAD;
            var dataUrl = canvas.toDataURL("image/jpeg", q);
            // Recomprimir bajando calidad hasta entrar en el límite (sin pasarse de feo).
            while (dataUrlBytes(dataUrl) > LIMITE_BYTES && q > 0.4) {
              q = Math.round((q - 0.08) * 100) / 100;
              dataUrl = canvas.toDataURL("image/jpeg", q);
            }
            resolve({ dataUrl: dataUrl, bytes: dataUrlBytes(dataUrl) });
          } catch (e) { reject(e); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Estima el tamaño en bytes de un dataURL base64.
  function dataUrlBytes(dataUrl) {
    var base64 = (dataUrl.split(",")[1] || "");
    var padding = base64.endsWith("==") ? 2 : (base64.endsWith("=") ? 1 : 0);
    return Math.floor(base64.length * 3 / 4) - padding;
  }

  // Aplica el transform de imágenes de Supabase para miniaturas (igual que la web).
  function thumbUrl(url, w) {
    if (url && url.indexOf("supabase.co/storage/v1/object/public/") !== -1) {
      return url + "?width=" + (w || 200) + "&quality=70";
    }
    return url;
  }

  function confirmarBorrar(auto) {
    var nombre = (auto.marca || "") + " " + (auto.modelo || "");
    var body =
      '<p style="margin-bottom:20px">¿Seguro que querés borrar <strong>' +
        window.UI.esc(nombre) + '</strong>? Esta acción no se puede deshacer.</p>' +
      '<div class="form-actions">' +
        '<button class="btn btn-sec" id="del-cancel">Cancelar</button>' +
        '<button class="btn btn-danger" id="del-ok">Borrar</button>' +
      '</div>';
    window.UI.openModal("Borrar auto", body);
    document.getElementById("del-cancel").addEventListener("click", window.UI.closeModal);
    document.getElementById("del-ok").addEventListener("click", async function () {
      var btn = this; btn.disabled = true; btn.textContent = "Borrando…";
      try {
        await window.Data.Autos.eliminar(auto.id);
        window.UI.toast("Auto borrado", "ok");
        window.UI.closeModal();
        render(_container);
      } catch (e) {
        btn.disabled = false; btn.textContent = "Borrar";
        window.UI.toast("Error: " + e.message, "err");
      }
    });
  }

  /* ----------------------------- helpers de form ----------------------------- */
  function fg(name, label, type, val) {
    return '<div class="fg"><label>' + label + '</label>' +
      '<input name="' + name + '" type="' + type + '" value="' + (val != null ? window.UI.esc(String(val)) : "") + '" />' +
      '<div class="err-msg" hidden></div></div>';
  }
  function fgTextarea(name, label, val) {
    return '<div class="fg full"><label>' + label + '</label>' +
      '<textarea name="' + name + '" rows="3">' + (val ? window.UI.esc(val) : "") + '</textarea>' +
      '<div class="err-msg" hidden></div></div>';
  }
  function fgSelect(name, label, opts, sel) {
    var o = opts.map(function (op) {
      return '<option value="' + op + '"' + (op === sel ? " selected" : "") + '>' + op + '</option>';
    }).join("");
    return '<div class="fg"><label>' + label + '</label><select name="' + name + '">' + o + '</select></div>';
  }
  // Normaliza el valor de "sección" a la KEY exacta que la web usa para filtrar
  // las secciones (primer_auto, multimarca, toyota, suv, pickup, 0km, motos,
  // seleccionado). Blinda contra datos sucios: mayúsculas, espacios o el texto
  // visible de la opción ("Pick-Up", "0 km", "MI PRIMER AUTO", etc.).
  function normSeccion(v) {
    var k = String(v == null ? "" : v).trim().toLowerCase().replace(/\s+/g, "_");
    var mapa = {
      "primer_auto": "primer_auto", "mi_primer_auto": "primer_auto", "tu_primer_auto": "primer_auto",
      "multimarca": "multimarca", "multimarcas": "multimarca",
      "toyota": "toyota",
      "suv": "suv", "suvs": "suv",
      "pickup": "pickup", "pick-up": "pickup", "pick_up": "pickup",
      "0km": "0km", "0_km": "0km", "0-km": "0km", "okm": "0km",
      "motos": "motos", "moto": "motos",
      "seleccionado": "seleccionado", "seleccionados": "seleccionado",
      "sin_destacar": "", "": ""
    };
    return Object.prototype.hasOwnProperty.call(mapa, k) ? mapa[k] : "";
  }

  // Igual que fgSelect pero con pares [value, label] (cuando el valor difiere del texto).
  function fgSelectKV(name, label, pairs, sel) {
    var o = pairs.map(function (p) {
      return '<option value="' + window.UI.esc(p[0]) + '"' + (p[0] === sel ? " selected" : "") + '>' + window.UI.esc(p[1]) + '</option>';
    }).join("");
    return '<div class="fg"><label>' + label + '</label><select name="' + name + '">' + o + '</select></div>';
  }

  return { render: render };
})();
