// ============================================================
// MODULO B: Control de Inventario y Busqueda Rapida
// ============================================================

const ModuloInventario = (() => {
  let scanner = null;
  let productoActual = null;

  function render() {
    const el = document.getElementById('view-inventario');
    el.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 class="font-bold text-slate-800">🔍 Buscar producto</h2>
        <div class="flex gap-2 relative">
          <input id="input-busqueda" type="text" placeholder="SKU, nombre o codigo..." autocomplete="off"
                 class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button id="btn-buscar" class="px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">Ir</button>
          <div id="autocomplete-busqueda" class="hidden absolute left-0 right-14 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"></div>
        </div>

        <div id="inv-scanner-wrap" class="hidden space-y-2">
          <div id="reader-inventario" class="rounded-xl overflow-hidden bg-black"></div>
          <button id="btn-stop-inv-scanner" class="w-full py-2 rounded-lg bg-slate-200 text-slate-700 font-medium text-sm">Cerrar camara</button>
        </div>
        <button id="btn-start-inv-scanner" class="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm">
          📷 Escanear codigo de barras
        </button>
      </div>

      <div id="ficha-producto"></div>

      <div class="bg-white rounded-2xl shadow-sm p-4">
        <h2 class="font-bold text-slate-800 mb-2">📋 Catalogo completo</h2>
        <div id="lista-inventario" class="divide-y divide-slate-100 max-h-80 overflow-y-auto"></div>
      </div>
      <!-- Selector de modalidad de ingreso -->
    `;

    bindEvents();
    cargarLista();
  }

  function bindEvents() {
    document.getElementById('btn-buscar').addEventListener('click', () => {
      const q = document.getElementById('input-busqueda').value.trim();
      if (q) buscarYMostrar(q);
    });
    document.getElementById('input-busqueda').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-buscar').click();
    });
    document.getElementById('btn-start-inv-scanner').addEventListener('click', startScanner);
    document.getElementById('btn-stop-inv-scanner').addEventListener('click', stopScanner);

        attachAutocompleteProductos(
      document.getElementById('input-busqueda'),
      document.getElementById('autocomplete-busqueda'),
      (producto) => {
        document.getElementById('input-busqueda').value = producto.sku;
        buscarYMostrar(producto.sku);
      }
      // SIN { soloConCodigo: true } → aquí se buscan TODOS
    );
  }

  function startScanner() {
    document.getElementById('inv-scanner-wrap').classList.remove('hidden');
    document.getElementById('btn-start-inv-scanner').classList.add('hidden');
    scanner = new BarcodeScanner('reader-inventario', (codigo) => {
      buscarDesdeEscaneo(codigo);
    });
    scanner.start();
  }

  async function stopScanner() {
    if (scanner) {
      try { await scanner.stop(); } catch (e) { /* ignore */ }
      scanner = null;
    }
    const wrap = document.getElementById('inv-scanner-wrap');
    const btn = document.getElementById('btn-start-inv-scanner');
    if (wrap) wrap.classList.add('hidden');
    if (btn) btn.classList.remove('hidden');
  }

  async function buscarDesdeEscaneo(codigo) {
    await stopScanner();
    const input = document.getElementById('input-busqueda');
    if (input) input.value = codigo;
    await buscarYMostrar(codigo);
  }

  async function buscarYMostrar(codigoOtexto) {
    const q = String(codigoOtexto || '').trim();
    if (!q) {
      showToast('Escribe o escanea un código / nombre', 'error');
      return;
    }

    const data = await apiFetch(`/productos/buscar/${encodeURIComponent(q)}`);
    if (!data.ok) {
      beepError();
      showToast(data.error || 'No encontrado', 'error');
      renderFicha(null);
      return;
    }
    beepSuccess();
    productoActual = data.data;
    const tipo = data.tipo_match || '';
    if (tipo === 'unidad') {
      showToast(`Encontrado por código de UNIDAD: ${productoActual.nombre}`, 'success');
    } else if (tipo === 'caja') {
      showToast(`Encontrado por código de CAJA: ${productoActual.nombre}`, 'success');
    }
    renderFicha(productoActual, tipo);
  }

  function renderFicha(p, tipoMatch = '') {
    const el = document.getElementById('ficha-producto');
    if (!p) { el.innerHTML = ''; return; }

    const upc = p.unidades_por_caja || 1;
    const cajas = upc > 1 ? Math.floor(p.stock / upc) : 0;
    const sueltas = upc > 1 ? p.stock % upc : p.stock;
    const desglose = upc > 1
      ? `<p class="text-[11px] text-slate-400 mt-0.5">${cajas} cajas + ${sueltas} sueltas (${upc} und/caja)</p>`
      : '';

    let badgeMatch = '';
    if (tipoMatch === 'unidad') badgeMatch = '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Código unidad</span>';
    else if (tipoMatch === 'caja') badgeMatch = '<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Código caja</span>';

    el.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3 flash-ok">
        <div class="flex justify-between items-start gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-bold text-lg text-slate-800 leading-tight">${escapeHtml(p.nombre)}</p>
              <button id="btn-editar-nombre" class="text-xs px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold flex items-center gap-1 shadow-sm">
                ✏️ Editar nombre
              </button>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              SKU ${escapeHtml(p.sku)}
              ${p.categoria ? '· ' + escapeHtml(p.categoria) : ''}
              ${p.subcategoria ? ' / ' + escapeHtml(p.subcategoria) : ''}
              ${p.ubicacion ? '· 📍 ' + escapeHtml(p.ubicacion) : ''}
            </p>
            ${badgeMatch ? `<div class="mt-1">${badgeMatch}</div>` : ''}
          </div>
        </div>

        <div class="text-xs text-slate-600 space-y-1.5 bg-slate-50 rounded-lg p-2.5">
          <p class="flex items-center justify-between">
            <span>🥄 Unidad: <b class="font-mono">${p.codigo_barras ? escapeHtml(p.codigo_barras) : '—'}</b></span>
            <button id="btn-editar-codigo" class="text-xs px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold" title="Editar código unidad">✏️ Editar</button>
          </p>
          <p class="flex items-center justify-between border-t border-slate-200/60 pt-1">
            <span>📦 Caja: <b class="font-mono">${p.codigo_caja ? escapeHtml(p.codigo_caja) : '—'}</b> <span class="text-slate-400">(${upc} und/caja)</span></span>
            <button id="btn-editar-upc" class="text-xs px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold" title="Editar unidades por caja">✏️ Und/Caja</button>
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 text-center">
          <div class="bg-slate-50 rounded-xl py-3">
            <p class="text-2xl font-extrabold ${p.stock > 0 ? 'text-slate-800' : 'text-rose-500'}" id="ficha-stock">${p.stock}</p>
            <p class="text-xs text-slate-400">unidades en stock</p>
            ${desglose}
          </div>
          <div class="bg-slate-50 rounded-xl py-3">
            <p class="text-2xl font-extrabold text-slate-800">$${formatMoney(p.precio)}</p>
            <p class="text-xs text-slate-400">precio</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <button id="btn-entrada" class="py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm">➕ Entrada</button>
          <button id="btn-salida" class="py-2.5 rounded-lg bg-rose-600 text-white font-semibold text-sm">➖ Salida</button>
        </div>
      </div>
    `;

    document.getElementById('btn-entrada').addEventListener('click', () => ajustarStock('entrada'));
    document.getElementById('btn-salida').addEventListener('click', () => ajustarStock('salida'));
    document.getElementById('btn-editar-codigo').addEventListener('click', editarCodigoBarras);
    document.getElementById('btn-editar-nombre').addEventListener('click', editarNombre);
    document.getElementById('btn-editar-upc').addEventListener('click', editarUnidadesPorCaja);
  }

  async function editarNombre() {
    if (!productoActual) return;
    const actual = productoActual.nombre || '';
    const nuevo = prompt(`Editar nombre del producto (${productoActual.sku}):`, actual);
    if (nuevo === null) return;
    const limpio = nuevo.trim();
    if (!limpio) { showToast('El nombre no puede estar vacío', 'error'); return; }
    if (limpio === actual) return;

    const data = await apiFetch(`/productos/${productoActual.id}`, {
      method: 'PUT',
      body: JSON.stringify({ nombre: limpio }),
    });

    if (data.ok) {
      showToast('Nombre actualizado con éxito', 'success');
      productoActual = data.data;
      renderFicha(productoActual);
      cargarLista();
    } else {
      showToast(data.error || 'Error al actualizar el nombre', 'error');
    }
  }

  async function editarUnidadesPorCaja() {
    if (!productoActual) return;
    const actual = productoActual.unidades_por_caja || 1;
    const nuevo = prompt(`Unidades individuales por caja para ${productoActual.nombre}:`, actual);
    if (nuevo === null) return;
    const cant = parseInt(nuevo, 10);
    if (!Number.isInteger(cant) || cant < 1) { showToast('Cantidad de unidades inválida (mínimo 1)', 'error'); return; }

    const data = await apiFetch(`/productos/${productoActual.id}`, {
      method: 'PUT',
      body: JSON.stringify({ unidades_por_caja: cant }),
    });

    if (data.ok) {
      showToast(`Unidades por caja actualizadas a ${cant} und`, 'success');
      productoActual = data.data;
      renderFicha(productoActual);
      cargarLista();
    } else {
      showToast(data.error || 'Error al actualizar unidades por caja', 'error');
    }
  }

  async function editarCodigoBarras() {
    const actual = productoActual.codigo_barras || '';
    const nuevo = prompt('Codigo de barras para este producto:', actual);
    if (nuevo === null) return;
    const limpio = (typeof normalizarCodigoBarras === 'function')
      ? normalizarCodigoBarras(nuevo)
      : nuevo.trim();
    if (!limpio) { showToast('El codigo no puede quedar vacio', 'error'); return; }
    if (limpio === actual) return;

    const data = await apiFetch(`/productos/${productoActual.id}/vincular-barcode`, {
      method: 'POST',
      body: JSON.stringify({ codigo_barras: limpio }),
    });

    if (data.ok) {
      showToast('Codigo de barras actualizado', 'success');
      productoActual = data.data;
      renderFicha(productoActual);
      cargarLista();
    } else {
      showToast(data.error, 'error');
    }
  }

  async function ajustarStock(tipo) {
    const cantidad = prompt(tipo === 'entrada' ? 'Unidades a ingresar:' : 'Unidades a retirar:', '1');
    if (cantidad === null) return;
    const cant = parseInt(cantidad, 10);
    if (!Number.isInteger(cant) || cant <= 0) { showToast('Cantidad invalida', 'error'); return; }

    const data = await apiFetch(`/productos/${productoActual.id}/ajustar-stock`, {
      method: 'POST',
      body: JSON.stringify({ tipo, cantidad: cant, motivo: `Ajuste manual (${tipo})` }),
    });

    if (data.ok) {
      showToast(`Stock actualizado: ${data.data.stock} unidades`, 'success');
      productoActual = data.data;
      renderFicha(productoActual);
      cargarLista();
    } else {
      showToast(data.error, 'error');
    }
  }

  async function cargarLista() {
    const data = await apiFetch('/productos');
    const lista = document.getElementById('lista-inventario');
    if (!data.ok) return;
    lista.innerHTML = data.data.map(p => `
      <button class="w-full text-left py-2 flex justify-between items-center text-sm item-catalogo" data-codigo="${escapeHtml(p.sku)}">
        <div>
          <p class="font-medium text-slate-800">${escapeHtml(p.nombre)}</p>
          <p class="text-xs text-slate-400">SKU ${escapeHtml(p.sku)}</p>
        </div>
        <span class="text-xs font-semibold ${p.stock > 0 ? 'text-slate-600' : 'text-rose-500'}">${p.stock} und</span>
      </button>
    `).join('') || `<p class="text-sm text-slate-400 py-4 text-center">Sin productos aun.</p>`;

    lista.querySelectorAll('.item-catalogo').forEach(btn => {
      btn.addEventListener('click', () => buscarYMostrar(btn.dataset.codigo));
    });
  }

  function onLeaveTab() {
    if (scanner && scanner.running) stopScanner();
  }

  function onEnterTab() {
    if (document.getElementById('lista-inventario')) cargarLista();
  }

  return { render, onLeaveTab, onEnterTab };
})();