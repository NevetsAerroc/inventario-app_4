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
        document.getElementById('input-busqueda').value = producto.nombre;
        buscarYMostrar(producto.sku);
      }
    );
  }

  function startScanner() {
    document.getElementById('inv-scanner-wrap').classList.remove('hidden');
    document.getElementById('btn-start-inv-scanner').classList.add('hidden');
    scanner = new BarcodeScanner('reader-inventario', (codigo) => buscarYMostrar(codigo));
    scanner.start();
  }

  async function stopScanner() {
    if (scanner) await scanner.stop();
    document.getElementById('inv-scanner-wrap').classList.add('hidden');
    document.getElementById('btn-start-inv-scanner').classList.remove('hidden');
  }

  async function buscarYMostrar(codigoOtexto) {
    const data = await apiFetch(`/productos/buscar/${encodeURIComponent(codigoOtexto)}`);
    if (!data.ok) {
      beepError();
      showToast(data.error || 'No encontrado', 'error');
      renderFicha(null);
      return;
    }
    beepSuccess();
    productoActual = data.data;
    renderFicha(productoActual);
  }

  function renderFicha(p) {
    const el = document.getElementById('ficha-producto');
    if (!p) { el.innerHTML = ''; return; }

    el.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3 flash-ok">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-bold text-lg text-slate-800">${escapeHtml(p.nombre)}</p>
            <p class="text-xs text-slate-400">SKU ${escapeHtml(p.sku)} ${p.categoria ? '· ' + escapeHtml(p.categoria) : ''}</p>
          </div>
          <span class="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-500 flex items-center gap-1">
            ${p.codigo_barras ? '🔗 ' + escapeHtml(p.codigo_barras) : 'sin codigo'}
            <button id="btn-editar-codigo" class="text-slate-400 hover:text-slate-700" title="Editar codigo de barras">✏️</button>
          </span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-center">
          <div class="bg-slate-50 rounded-xl py-3">
            <p class="text-2xl font-extrabold ${p.stock > 0 ? 'text-slate-800' : 'text-rose-500'}" id="ficha-stock">${p.stock}</p>
            <p class="text-xs text-slate-400">unidades en stock</p>
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
  }

  async function editarCodigoBarras() {
    const actual = productoActual.codigo_barras || '';
    const nuevo = prompt('Codigo de barras para este producto:', actual);
    if (nuevo === null) return; // cancelado
    const limpio = nuevo.trim();
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

  return { render, onLeaveTab };
})();
