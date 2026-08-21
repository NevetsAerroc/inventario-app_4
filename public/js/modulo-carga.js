// ============================================================
// MODULO A: Alta manual + Carga masiva (Excel) + Vinculo/Edicion de codigos
// ============================================================

const ModuloCarga = (() => {
  let scanner = null;
  let productoSeleccionado = null;
  let productosCache = [];
  let formularioAbierto = false;

  function render() {
    const el = document.getElementById('view-carga');
    el.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-slate-800 flex items-center gap-2">📦 Productos</h2>
          <button id="btn-toggle-form" class="text-sm font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white">
            ➕ Agregar producto
          </button>
        </div>
        <div id="form-agregar-wrap" class="hidden space-y-2 pt-2 border-t border-slate-100"></div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">📥 Carga masiva de productos</h2>
        <p class="text-sm text-slate-500">
          Columnas esperadas: <b>SKU, Nombre, Categoria, Subcategoria, Ubicacion, StockInicial, Precio,
          CodigoBarras, CodigoCaja, UnidadesPorCaja</b> (todas menos SKU/Nombre son opcionales).
        </p>
        <a id="link-descargar-plantilla" href="/api/productos/exportar" download
           class="block text-center text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-2">
          ⬇️ Descargar plantilla / catalogo actual (.xlsx)
        </a>
        <p class="text-xs text-slate-400 -mt-1">
          Este archivo trae tu inventario actual con todos sus datos. Edita lo que necesites en Excel
          (incluyendo codigos de barras) y vuelve a subirlo abajo: la base de datos se actualiza por SKU.
        </p>

        <label class="block">
          <input type="file" id="file-productos" accept=".xlsx,.xls,.csv" class="hidden" />
          <div class="w-full text-center border-2 border-dashed border-slate-300 rounded-xl py-6 cursor-pointer active:bg-slate-50">
            <span class="text-3xl block mb-1">📄</span>
            <span class="text-sm font-medium text-slate-600">Toca para elegir archivo y subir cambios</span>
          </div>
        </label>
        <div id="resumen-importacion"></div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">🔗 Vincular / editar codigo de barras</h2>
        <p class="text-sm text-slate-500">Elige cualquier producto (tenga o no codigo ya asignado) y escanea o escribe el nuevo codigo.</p>

        <select id="select-producto-codigo" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Cargando productos...</option>
        </select>
        <p id="codigo-actual-info" class="text-xs text-slate-400 hidden"></p>

        <div id="vinculo-scanner-wrap" class="hidden space-y-2">
          <div id="reader-carga" class="rounded-xl overflow-hidden bg-black"></div>
          <button id="btn-stop-vinculo" class="w-full py-2 rounded-lg bg-slate-200 text-slate-700 font-medium text-sm">Cerrar camara</button>
        </div>
        <button id="btn-start-vinculo" class="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm disabled:opacity-40" disabled>
          📷 Escanear codigo con la camara
        </button>

        <div class="flex items-center gap-2 text-xs text-slate-400">
          <div class="flex-1 h-px bg-slate-200"></div> o escribirlo manualmente <div class="flex-1 h-px bg-slate-200"></div>
        </div>
        <div class="flex gap-2">
          <input id="input-codigo-manual" type="text" placeholder="Ej: 7701234500019"
                 class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" disabled />
          <button id="btn-guardar-manual" class="px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-40" disabled>Guardar</button>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm p-4">
        <h2 class="font-bold text-slate-800 mb-2">📋 Catalogo (<span id="total-catalogo">0</span> productos)</h2>
        <div id="lista-catalogo" class="divide-y divide-slate-100 max-h-72 overflow-y-auto"></div>
      </div>
    `;

    bindEvents();
    cargarProductos();
    cargarCatalogo();
  }

  // --------------------------------------------------------------
  // Formulario "Agregar producto" (se abre/cierra con el boton)
  // --------------------------------------------------------------
  function renderFormulario() {
    const wrap = document.getElementById('form-agregar-wrap');
    wrap.innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        <input id="f-sku" type="text" placeholder="SKU *" class="border border-slate-300 rounded-lg px-3 py-2 text-sm col-span-1" />
        <input id="f-codigo" type="text" placeholder="Codigo de barras" class="border border-slate-300 rounded-lg px-3 py-2 text-sm col-span-1" />
      </div>
      <div class="relative">
        <input id="f-nombre" type="text" placeholder="Nombre del producto *" autocomplete="off" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div id="autocomplete-nombre" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"></div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input id="f-categoria" type="text" placeholder="Categoria" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input id="f-subcategoria" type="text" placeholder="Subcategoria" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <input id="f-ubicacion" type="text" placeholder="Ubicacion (ej: Bodega A - Estante 3)" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      <div class="grid grid-cols-2 gap-2">
        <input id="f-stock" type="number" min="0" placeholder="Stock inicial" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input id="f-precio" type="number" min="0" step="0.01" placeholder="Precio" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div id="form-agregar-error" class="text-xs text-rose-600 hidden"></div>
      <div class="grid grid-cols-2 gap-2 pt-1">
        <button id="btn-cancelar-form" class="py-2.5 rounded-lg bg-slate-200 text-slate-700 font-semibold text-sm">Cancelar</button>
        <button id="btn-guardar-producto" class="py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm">Guardar producto</button>
      </div>
    `;
    document.getElementById('btn-cancelar-form').addEventListener('click', () => toggleFormulario(false));
    document.getElementById('btn-guardar-producto').addEventListener('click', guardarProductoNuevo);

    attachAutocompleteProductos(
      document.getElementById('f-nombre'),
      document.getElementById('autocomplete-nombre'),
      (producto) => {
        // Es un producto NUEVO: al elegir una sugerencia solo copiamos datos
        // utiles (nombre, categoria, subcategoria, ubicacion, precio) para
        // agilizar el alta de variantes similares. SKU, stock y codigo de
        // barras se dejan intactos porque deben ser unicos para el nuevo item.
        document.getElementById('f-nombre').value = producto.nombre;
        document.getElementById('f-categoria').value = producto.categoria || '';
        document.getElementById('f-subcategoria').value = producto.subcategoria || '';
        document.getElementById('f-ubicacion').value = producto.ubicacion || '';
        if (!document.getElementById('f-precio').value) {
          document.getElementById('f-precio').value = producto.precio || '';
        }
        showToast(`Datos copiados de "${producto.nombre}" (SKU ${producto.sku}). Recuerda usar un SKU distinto.`, 'info');
      }
    );
  }

  function toggleFormulario(abrir) {
    formularioAbierto = abrir ?? !formularioAbierto;
    const wrap = document.getElementById('form-agregar-wrap');
    const btn = document.getElementById('btn-toggle-form');
    if (formularioAbierto) {
      renderFormulario();
      wrap.classList.remove('hidden');
      btn.textContent = '✖️ Cerrar';
    } else {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
      btn.textContent = '➕ Agregar producto';
    }
  }

  async function guardarProductoNuevo() {
    const errorEl = document.getElementById('form-agregar-error');
    errorEl.classList.add('hidden');

    const payload = {
      sku: document.getElementById('f-sku').value.trim(),
      nombre: document.getElementById('f-nombre').value.trim(),
      categoria: document.getElementById('f-categoria').value.trim(),
      subcategoria: document.getElementById('f-subcategoria').value.trim(),
      ubicacion: document.getElementById('f-ubicacion').value.trim(),
      stock: document.getElementById('f-stock').value || 0,
      precio: document.getElementById('f-precio').value || 0,
      codigo_barras: document.getElementById('f-codigo').value.trim(),
    };

    if (!payload.sku || !payload.nombre) {
      errorEl.textContent = 'SKU y Nombre son obligatorios.';
      errorEl.classList.remove('hidden');
      return;
    }

    const data = await apiFetch('/productos', { method: 'POST', body: JSON.stringify(payload) });
    if (!data.ok) {
      errorEl.textContent = data.error;
      errorEl.classList.remove('hidden');
      return;
    }

    showToast(`Producto "${data.data.nombre}" creado`, 'success');
    toggleFormulario(false);
    cargarProductos();
    cargarCatalogo();
  }

  function bindEvents() {
    document.getElementById('btn-toggle-form').addEventListener('click', () => toggleFormulario());
    document.getElementById('file-productos').addEventListener('change', handleUpload);

    document.getElementById('select-producto-codigo').addEventListener('change', (e) => {
      productoSeleccionado = e.target.value || null;
      const disabled = !productoSeleccionado;
      document.getElementById('btn-start-vinculo').disabled = disabled;
      document.getElementById('input-codigo-manual').disabled = disabled;
      document.getElementById('btn-guardar-manual').disabled = disabled;

      const infoEl = document.getElementById('codigo-actual-info');
      const producto = productosCache.find(p => String(p.id) === productoSeleccionado);
      if (producto) {
        infoEl.textContent = producto.codigo_barras
          ? `Codigo actual: ${producto.codigo_barras} (se reemplazara)`
          : 'Este producto aun no tiene codigo asignado.';
        infoEl.classList.remove('hidden');
      } else {
        infoEl.classList.add('hidden');
      }
    });

    document.getElementById('btn-start-vinculo').addEventListener('click', startVinculoScanner);
    document.getElementById('btn-stop-vinculo').addEventListener('click', stopVinculoScanner);
    document.getElementById('btn-guardar-manual').addEventListener('click', () => {
      const input = document.getElementById('input-codigo-manual');
      const codigo = input.value.trim();
      if (!codigo) { showToast('Escribe un codigo primero', 'error'); return; }
      guardarCodigo(codigo, input);
    });
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('archivo', file);

    const resumenEl = document.getElementById('resumen-importacion');
    resumenEl.innerHTML = `<p class="text-sm text-slate-500">Procesando archivo...</p>`;

    const data = await apiFetch('/productos/importar', { method: 'POST', body: formData });
    if (!data.ok) {
      resumenEl.innerHTML = `<p class="text-sm text-rose-600">${escapeHtml(data.error)}</p>`;
      showToast(data.error, 'error');
      return;
    }

    const { totalFilas, creados, actualizados, codigosAsignados, cajasAsignadas, errores } = data.resumen;
    resumenEl.innerHTML = `
      <div class="text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
        <p><b>${totalFilas}</b> filas &middot; <b class="text-emerald-700">${creados}</b> creados &middot; <b class="text-amber-700">${actualizados}</b> actualizados &middot; <b class="text-sky-700">${codigosAsignados || 0}</b> cod. unidad &middot; <b class="text-purple-700">${cajasAsignadas || 0}</b> cod. caja</p>
        ${errores.length ? `<p class="text-rose-600 text-xs">${errores.length} advertencia(s): ${errores.slice(0,3).map(escapeHtml).join(' · ')}${errores.length > 3 ? '…' : ''}</p>` : ''}
      </div>`;
    if (errores.length) console.warn('Advertencias de importacion:', errores);

    showToast('Importacion completada', 'success');
    e.target.value = '';
    cargarProductos();
    cargarCatalogo();
  }

  async function cargarProductos() {
    const data = await apiFetch('/productos');
    const select = document.getElementById('select-producto-codigo');
    if (!data.ok || data.data.length === 0) {
      productosCache = [];
      select.innerHTML = `<option value="">No hay productos cargados aun</option>`;
      return;
    }
    productosCache = data.data;
    select.innerHTML = `<option value="">Selecciona un producto...</option>` +
      data.data.map(p => `<option value="${p.id}">${p.codigo_barras ? '🔗' : '⚪'} ${escapeHtml(p.sku)} — ${escapeHtml(p.nombre)}</option>`).join('');
  }

  async function cargarCatalogo() {
    const data = await apiFetch('/productos');
    const lista = document.getElementById('lista-catalogo');
    const total = document.getElementById('total-catalogo');
    if (!data.ok) return;
    total.textContent = data.data.length;
    lista.innerHTML = data.data.slice(0, 50).map(p => `
      <div class="py-2 flex justify-between items-center text-sm">
        <div>
          <p class="font-medium text-slate-800">${escapeHtml(p.nombre)}</p>
          <p class="text-xs text-slate-400">
            SKU ${escapeHtml(p.sku)}
            ${p.categoria ? '· ' + escapeHtml(p.categoria) : ''}${p.subcategoria ? ' / ' + escapeHtml(p.subcategoria) : ''}
            ${p.ubicacion ? '· 📍 ' + escapeHtml(p.ubicacion) : ''}
            ${p.codigo_barras ? '· 🔗 ' + escapeHtml(p.codigo_barras) : '· <span class="text-amber-600">sin codigo</span>'}
          </p>
        </div>
        <span class="text-xs font-semibold ${p.stock > 0 ? 'text-slate-600' : 'text-rose-500'}">${p.stock} und</span>
      </div>
    `).join('') || `<p class="text-sm text-slate-400 py-4 text-center">Sin productos aun.</p>`;
  }

  function startVinculoScanner() {
    if (!productoSeleccionado) return;
    document.getElementById('vinculo-scanner-wrap').classList.remove('hidden');
    document.getElementById('btn-start-vinculo').classList.add('hidden');

    scanner = new BarcodeScanner('reader-carga', (codigo) => guardarCodigo(codigo));
    scanner.start();
  }

  async function stopVinculoScanner() {
    if (scanner) await scanner.stop();
    document.getElementById('vinculo-scanner-wrap').classList.add('hidden');
    document.getElementById('btn-start-vinculo').classList.remove('hidden');
  }

  async function guardarCodigo(codigo, inputManualEl = null) {
    if (!productoSeleccionado) return;
    const data = await apiFetch(`/productos/${productoSeleccionado}/vincular-barcode`, {
      method: 'POST',
      body: JSON.stringify({ codigo_barras: codigo }),
    });

    if (data.ok) {
      beepSuccess();
      showToast(`Guardado: ${data.data.nombre} → ${codigo}`, 'success');
      if (scanner && scanner.running) await stopVinculoScanner();
      if (inputManualEl) inputManualEl.value = '';
      productoSeleccionado = null;
      document.getElementById('select-producto-codigo').value = '';
      document.getElementById('btn-start-vinculo').disabled = true;
      document.getElementById('input-codigo-manual').disabled = true;
      document.getElementById('btn-guardar-manual').disabled = true;
      document.getElementById('codigo-actual-info').classList.add('hidden');
      cargarProductos();
      cargarCatalogo();
    } else {
      beepError();
      showToast(data.error, 'error');
    }
  }

  function onLeaveTab() {
    if (scanner && scanner.running) stopVinculoScanner();
  }

  return { render, onLeaveTab };
})();
