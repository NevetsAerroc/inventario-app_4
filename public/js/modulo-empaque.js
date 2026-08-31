/// ============================================================
// MODULO C: Checking / Empaque de Pedidos (Pick & Pack)
// ============================================================

const ModuloEmpaque = (() => {
  let scanner = null;
  let pedidoActual = null; // objeto completo con items
  let itemsManual = []; // items acumulados en el formulario de creacion manual
  let productoSeleccionado = null; // producto elegido en el autocompletado, pendiente de agregar
  let clienteSeleccionadoId = null; // ID del cliente seleccionado desde el autocompletado

  function render() {
    const el = document.getElementById('view-empaque');
    el.innerHTML = `
      <div id="empaque-selector" class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 class="font-bold text-slate-800">✅ Checking / Empaque de pedidos</h2>

        <div class="flex gap-2">
          <select id="select-pedido" class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Cargando pedidos...</option>
          </select>
          <button id="btn-abrir-pedido" class="px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">Abrir</button>
        </div>

        <hr class="border-slate-100" />

        <button id="btn-mostrar-form-manual" class="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm">
          ➕ Crear pedido manual
        </button>

        <div id="form-pedido-manual" class="hidden space-y-3 border border-slate-200 rounded-xl p-3">
          <div class="grid grid-cols-2 gap-2">
            <input id="mp-codigo" type="text" placeholder="Codigo de pedido *" autocomplete="off" readonly
                   class="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-100 font-semibold text-slate-700 cursor-not-allowed" />
            
            <div class="relative col-span-1">
              <input id="mp-cliente" type="text" placeholder="Buscar o crear cliente..." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <div id="mp-autocomplete-cliente" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto"></div>
            </div>
          </div>

          <hr class="border-slate-100" />
          <p class="text-xs font-semibold text-slate-500">Agregar items</p>

          <div class="relative">
            <input id="mp-buscar-producto" type="text" placeholder="Buscar producto por nombre o SKU..." autocomplete="off"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <div id="mp-autocomplete" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"></div>
          </div>
          <div id="mp-producto-seleccionado" class="hidden bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm"></div>

          <div class="flex gap-2">
            <input id="mp-cantidad" type="number" min="1" value="1" placeholder="Cantidad"
                   class="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <button id="btn-agregar-item-manual" class="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-40" disabled>
              Agregar item
            </button>
          </div>

          <div id="mp-lista-items" class="divide-y divide-slate-100"></div>

          <div class="flex gap-2 pt-1">
            <button id="btn-cancelar-form-manual" class="flex-1 py-2.5 rounded-lg bg-slate-200 text-slate-700 font-semibold text-sm">Cancelar</button>
            <button id="btn-guardar-pedido-manual" class="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm">Guardar pedido</button>
          </div>
        </div>

        <hr class="border-slate-100" />

        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
          <p class="text-xs font-bold text-slate-700">👥 Base de Datos de Clientes</p>
          <div class="grid grid-cols-2 gap-2">
            <a href="/api/clientes/exportar" download
               class="block text-center text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg py-2 hover:bg-slate-100">
              ⬇️ Descargar BD Clientes (.xlsx)
            </a>
            <label class="block">
              <input type="file" id="file-clientes-masivo" accept=".xlsx,.xls,.csv" class="hidden" />
              <div class="w-full text-center text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-lg py-2 cursor-pointer hover:bg-emerald-200">
                📄 Subir cambios masivos
              </div>
            </label>
          </div>
        </div>

        <hr class="border-slate-100" />

        <p class="text-sm text-slate-500">O sube una lista de empaque (.xlsx/.csv) con columnas: <b>CodigoPedido, Cliente, SKU, Cantidad</b>.</p>
        <a href="/plantillas/plantilla_pedido.xlsx" download
           class="block text-center text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-2">
          ⬇️ Descargar plantilla de pedidos (.xlsx)
        </a>
        <label class="block">
          <input type="file" id="file-pedidos" accept=".xlsx,.xls,.csv" class="hidden" />
          <div class="w-full text-center border-2 border-dashed border-slate-300 rounded-xl py-4 cursor-pointer active:bg-slate-50">
            <span class="text-2xl block mb-1">📄</span>
            <span class="text-sm font-medium text-slate-600">Toca para importar pedidos</span>
          </div>
        </label>
        <div id="resumen-importacion-pedidos"></div>
      </div>

      <div id="empaque-trabajo" class="hidden space-y-4"></div>
    `;

    bindEvents();
    cargarPedidos();
  }

  function bindEvents() {
    document.getElementById('file-clientes-masivo').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('archivo', file);

      showToast('Procesando base de datos de clientes...', 'info');

      const res = await apiFetch('/clientes/importar', { method: 'POST', body: formData });

      if (res.ok) {
        showToast(`Clientes actualizados: ${res.resumen.actualizados} · Creados: ${res.resumen.creados}`, 'success');
      } else {
        showToast(res.error || 'Error al importar los clientes', 'error');
      }
      e.target.value = '';
    });

    document.getElementById('btn-abrir-pedido').addEventListener('click', () => {
      const id = document.getElementById('select-pedido').value;
      if (id) abrirPedido(id);
    });
    document.getElementById('file-pedidos').addEventListener('change', handleUploadPedidos);

    document.getElementById('btn-mostrar-form-manual').addEventListener('click', () => {
      resetFormManual();
      generarCodigoEmpaqueAuto();
      document.getElementById('form-pedido-manual').classList.remove('hidden');
      document.getElementById('btn-mostrar-form-manual').classList.add('hidden');
    });
    document.getElementById('btn-cancelar-form-manual').addEventListener('click', () => {
      document.getElementById('form-pedido-manual').classList.add('hidden');
      document.getElementById('btn-mostrar-form-manual').classList.remove('hidden');
      resetFormManual();
    });
    document.getElementById('btn-agregar-item-manual').addEventListener('click', agregarItemManual);
    document.getElementById('btn-guardar-pedido-manual').addEventListener('click', guardarPedidoManual);

    attachAutocompleteProductos(
      document.getElementById('mp-buscar-producto'),
      document.getElementById('mp-autocomplete'),
      (producto) => {
        productoSeleccionado = producto;
        document.getElementById('mp-buscar-producto').value = producto.nombre;
        const box = document.getElementById('mp-producto-seleccionado');
        box.classList.remove('hidden');
        box.innerHTML = `<b>${escapeHtml(producto.nombre)}</b> — SKU ${escapeHtml(producto.sku)} · stock disponible: ${producto.stock}`;
        document.getElementById('btn-agregar-item-manual').disabled = false;
        document.getElementById('mp-cantidad').focus();
      }
    );

    attachAutocompleteClientes(
      document.getElementById('mp-cliente'),
      document.getElementById('mp-autocomplete-cliente'),
      (cliente) => {
        clienteSeleccionadoId = cliente.id;
        document.getElementById('mp-cliente').value = `${cliente.nombre}${cliente.empresa ? ' (' + cliente.empresa + ')' : ''}`;
        showToast(`Cliente "${cliente.nombre}" seleccionado`, 'info');
      },
      (clienteNuevo) => {
        clienteSeleccionadoId = clienteNuevo.id;
        document.getElementById('mp-cliente').value = `${clienteNuevo.nombre}${clienteNuevo.empresa ? ' (' + clienteNuevo.empresa + ')' : ''}`;
      }
    );

    document.getElementById('mp-buscar-producto').addEventListener('input', (e) => {
      if (productoSeleccionado && e.target.value !== productoSeleccionado.nombre) {
        productoSeleccionado = null;
        document.getElementById('mp-producto-seleccionado').classList.add('hidden');
        document.getElementById('btn-agregar-item-manual').disabled = true;
      }
    });
  }

  function imprimirFacturaPOS(pedido) {
    let iframe = document.getElementById('iframe-impresion-pos');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'iframe-impresion-pos';
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();

    const fechaFormateada = new Date().toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    let totalFactura = 0;
    const filasItems = (pedido.items || []).map(it => {
      const precioUnitario = Number(it.precio || it.precio_unitario || 0);
      const cantidad = Number(it.cantidad_solicitada || it.cantidad || 0);
      const subtotal = precioUnitario * cantidad;
      totalFactura += subtotal;

      return `
        <tr>
          <td style="text-align: left; padding: 3px 0; vertical-align: top;">
            ${escapeHtml(it.nombre_producto || it.nombre)}
            <br><small style="font-size: 8px; color: #444;">SKU: ${escapeHtml(it.sku)}</small>
          </td>
          <td style="text-align: center; vertical-align: top; padding: 3px 0;">${cantidad}</td>
          <td style="text-align: right; vertical-align: top; padding: 3px 0;">$${formatMoney(precioUnitario)}</td>
          <td style="text-align: right; vertical-align: top; padding: 3px 0;">$${formatMoney(subtotal)}</td>
        </tr>
      `;
    }).join('');

    const clienteNombre = pedido.cliente || (pedido.cliente_info ? pedido.cliente_info.nombre : 'Consumidor Final');
    const clienteDireccion = pedido.direccion || (pedido.cliente_info ? pedido.cliente_info.direccion : '') || 'No especificada';
    const clienteTelefono = pedido.telefono || (pedido.cliente_info ? pedido.cliente_info.telefono : '') || 'N/A';
    const formaPago = pedido.forma_pago || 'Efectivo';

    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Factura POS - ${escapeHtml(pedido.codigo_pedido)}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm;
            margin: 0 auto;
            padding: 4mm 0;
            font-size: 11px;
            color: #000;
            line-height: 1.2;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .logo { max-width: 55mm; max-height: 25mm; margin: 0 auto 4px auto; display: block; }
          table { width: 100%; border-collapse: collapse; margin: 4px 0; }
          th { border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <img src="/img/logo.png" class="logo" alt="Logo Jispiplast" onerror="this.style.display='none';" />
          <p class="bold" style="font-size: 15px; margin: 0;">Jispiplast</p>
          <p style="margin: 2px 0;">Olga Inés Bueno Pineda</p>
          <p style="margin: 2px 0;">Calle 13 #15-20</p>
        </div>

        <div class="divider"></div>

        <p style="margin: 2px 0;"><b>Fecha:</b> ${fechaFormateada}</p>
        <p style="margin: 2px 0;"><b>Pedido N°:</b> ${escapeHtml(pedido.codigo_pedido)}</p>
        <p style="margin: 2px 0;"><b>Cliente:</b> ${escapeHtml(clienteNombre)}</p>
        <p style="margin: 2px 0;"><b>Teléfono:</b> ${escapeHtml(clienteTelefono)}</p>
        <p style="margin: 2px 0;"><b>Dirección:</b> ${escapeHtml(clienteDireccion)}</p>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th style="text-align: left;">DESCRIPCIÓN</th>
              <th style="text-align: center; width: 22px;">CANT</th>
              <th style="text-align: right; width: 45px;">VR.UNI</th>
              <th style="text-align: right; width: 50px;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${filasItems}
          </tbody>
        </table>

        <div class="divider"></div>

        <table style="margin-top: 4px;">
          <tr>
            <td class="bold" style="font-size: 12px;">VALOR A PAGAR:</td>
            <td class="text-right bold" style="font-size: 13px;">$${formatMoney(totalFactura)}</td>
          </tr>
          <tr>
            <td style="padding-top: 3px;">Forma de Pago:</td>
            <td class="text-right" style="padding-top: 3px;">${escapeHtml(formaPago)}</td>
          </tr>
        </table>

        <div class="divider"></div>

        <div class="text-center bold" style="margin-top: 8px;">
          <p style="margin: 0;">*** ¡GRACIAS POR SU COMPRA! ***</p>
          <p style="font-size: 9px; font-weight: normal; margin-top: 4px;">Pedido verificado y empacado correctamente.</p>
        </div>
      </body>
      </html>
    `);

    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  }

  function generarCodigoEmpaqueAuto() {
    const ahora = new Date();
    
    const aa = String(ahora.getFullYear()).slice(-2);
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    const hh = String(ahora.getHours()).padStart(2, '0');
    const mi = String(ahora.getMinutes()).padStart(2, '0');
    const ss = String(ahora.getSeconds()).padStart(2, '0');

    const codigoGenerado = `EMP-${aa}${mm}${dd}-${hh}${mi}${ss}`;
    const inputCodigo = document.getElementById('mp-codigo');

    if (inputCodigo) {
      inputCodigo.value = codigoGenerado;
      inputCodigo.readOnly = true;
    }
  }

  function resetFormManual() {
    itemsManual = [];
    productoSeleccionado = null;
    clienteSeleccionadoId = null;
    const codigo = document.getElementById('mp-codigo');
    const cliente = document.getElementById('mp-cliente');
    const buscar = document.getElementById('mp-buscar-producto');
    const cantidad = document.getElementById('mp-cantidad');
    if (codigo) codigo.value = '';
    if (cliente) cliente.value = '';
    if (buscar) buscar.value = '';
    if (cantidad) cantidad.value = 1;
    const box = document.getElementById('mp-producto-seleccionado');
    if (box) box.classList.add('hidden');
    const btnAgregar = document.getElementById('btn-agregar-item-manual');
    if (btnAgregar) btnAgregar.disabled = true;
    renderItemsManual();
  }

  function agregarItemManual() {
    if (!productoSeleccionado) return;
    const cantidad = parseInt(document.getElementById('mp-cantidad').value, 10) || 0;
    if (cantidad <= 0) { showToast('La cantidad debe ser mayor a 0', 'error'); return; }

    const existente = itemsManual.find(i => i.sku === productoSeleccionado.sku);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      itemsManual.push({ sku: productoSeleccionado.sku, nombre: productoSeleccionado.nombre, cantidad });
    }

    productoSeleccionado = null;
    document.getElementById('mp-buscar-producto').value = '';
    document.getElementById('mp-cantidad').value = 1;
    document.getElementById('mp-producto-seleccionado').classList.add('hidden');
    document.getElementById('btn-agregar-item-manual').disabled = true;
    document.getElementById('mp-buscar-producto').focus();

    renderItemsManual();
  }

  function renderItemsManual() {
    const cont = document.getElementById('mp-lista-items');
    if (!cont) return;
    if (itemsManual.length === 0) {
      cont.innerHTML = `<p class="text-xs text-slate-400 text-center py-2">Aun no has agregado items.</p>`;
      return;
    }
    cont.innerHTML = itemsManual.map((it, idx) => `
      <div class="py-2 flex justify-between items-center text-sm">
        <div>
          <p class="font-medium text-slate-800">${escapeHtml(it.nombre)}</p>
          <p class="text-xs text-slate-400">SKU ${escapeHtml(it.sku)}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-600">x${it.cantidad}</span>
          <button data-idx="${idx}" class="btn-quitar-item-manual text-rose-500 text-xs font-semibold px-2">✕</button>
        </div>
      </div>
    `).join('');
    cont.querySelectorAll('.btn-quitar-item-manual').forEach(btn => {
      btn.addEventListener('click', () => {
        itemsManual.splice(Number(btn.dataset.idx), 1);
        renderItemsManual();
      });
    });
  }

  async function guardarPedidoManual() {
    const codigo_pedido = document.getElementById('mp-codigo').value.trim();
    const cliente = document.getElementById('mp-cliente').value.trim();

    if (!codigo_pedido) { showToast('El codigo de pedido es obligatorio', 'error'); return; }
    if (itemsManual.length === 0) { showToast('Agrega al menos un item al pedido', 'error'); return; }

    const data = await apiFetch('/pedidos', {
      method: 'POST',
      body: JSON.stringify({
        codigo_pedido,
        cliente,
        cliente_id: clienteSeleccionadoId,
        items: itemsManual.map(i => ({ sku: i.sku, cantidad: i.cantidad }))
      })
    });

    if (!data.ok) { showToast(data.error, 'error'); return; }

    showToast(`Pedido "${codigo_pedido}" creado`, 'success');
    document.getElementById('form-pedido-manual').classList.add('hidden');
    document.getElementById('btn-mostrar-form-manual').classList.remove('hidden');
    resetFormManual();
    cargarPedidos();
  }

  async function cargarPedidos() {
    const data = await apiFetch('/pedidos');
    const select = document.getElementById('select-pedido');
    if (!data.ok || data.data.length === 0) {
      select.innerHTML = `<option value="">Sin pedidos cargados</option>`;
      return;
    }
    select.innerHTML = data.data.map(p => {
      const estadoIcono = p.estado === 'EMPACADO' ? '✅' : (p.estado === 'EN_PROCESO' ? '🟡' : '⚪');
      return `<option value="${p.id}">${estadoIcono} ${escapeHtml(p.codigo_pedido)} (${p.items_verificados}/${p.total_items})</option>`;
    }).join('');
  }

  async function handleUploadPedidos(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('archivo', file);

    const resumenEl = document.getElementById('resumen-importacion-pedidos');
    resumenEl.innerHTML = `<p class="text-sm text-slate-500">Procesando...</p>`;

    const data = await apiFetch('/pedidos/importar', { method: 'POST', body: formData });
    if (!data.ok) {
      resumenEl.innerHTML = `<p class="text-sm text-rose-600">${escapeHtml(data.error)}</p>`;
      showToast(data.error, 'error');
      return;
    }
    resumenEl.innerHTML = `<p class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
      ${data.resumen.pedidosCreados} pedido(s) nuevo(s) creado(s) de ${data.resumen.pedidosDetectados} detectado(s).</p>`;
    showToast('Pedidos importados', 'success');
    e.target.value = '';
    cargarPedidos();
  }

  async function abrirPedido(id) {
    const data = await apiFetch(`/pedidos/${id}`);
    if (!data.ok) { showToast(data.error, 'error'); return; }
    pedidoActual = data.data;

    document.getElementById('empaque-selector').classList.add('hidden');
    document.getElementById('empaque-trabajo').classList.remove('hidden');
    renderTrabajo();
  }

  function renderTrabajo() {
    const el = document.getElementById('empaque-trabajo');
    const total = pedidoActual.items ? pedidoActual.items.length : 0;
    const verificados = pedidoActual.items ? pedidoActual.items.filter(i => i.verificado).length : 0;
    const completado = total > 0 && verificados === total;
    const yaEmpacado = pedidoActual.estado === 'EMPACADO';

    el.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div class="flex justify-between items-center">
          <div>
            <p class="font-bold text-slate-800">${escapeHtml(pedidoActual.codigo_pedido)}</p>
            <p class="text-xs text-slate-400">${escapeHtml(pedidoActual.cliente || 'Sin cliente')} · Estado: <b>${pedidoActual.estado}</b></p>
          </div>
          <button id="btn-cambiar-pedido" class="text-xs text-slate-500 underline">Cambiar pedido</button>
        </div>

        <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div class="bg-emerald-500 h-3 transition-all" style="width:${total ? (verificados/total*100) : 0}%"></div>
        </div>
        <p class="text-xs text-slate-500 text-center">${verificados} / ${total} items verificados</p>

        ${yaEmpacado ? `
          <div class="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3 text-center font-semibold">
            📦 Pedido EMPACADO y cerrado
          </div>
          <button id="btn-reimprimir-pos" class="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold text-center hover:bg-emerald-700 shadow-sm">
            🖨️ Imprimir Factura POS
          </button>
          <div class="grid grid-cols-2 gap-2">
            <a href="/api/pedidos/${pedidoActual.id}/exportar?formato=json" class="py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold text-center" download>⬇️ Exportar JSON</a>
            <a href="/api/pedidos/${pedidoActual.id}/exportar?formato=csv" class="py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-semibold text-center" download>⬇️ Exportar CSV</a>
          </div>
        ` : `
          <div id="empaque-scanner-wrap" class="hidden space-y-2">
            <div id="reader-empaque" class="rounded-xl overflow-hidden bg-black"></div>
            <button id="btn-stop-empaque-scanner" class="w-full py-2 rounded-lg bg-slate-200 text-slate-700 font-medium text-sm">Cerrar camara</button>
          </div>
          <button id="btn-start-empaque-scanner" class="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm">
            📷 Activar camara de empaque
          </button>
          <button id="btn-cerrar-pedido" class="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm disabled:opacity-40" ${completado ? '' : 'disabled'}>
            ${completado ? '🔒 Cerrar pedido y descontar inventario' : `Faltan ${total - verificados} item(s) por completar`}
          </button>
        `}
      </div>

      <div class="bg-white rounded-2xl shadow-sm p-4">
        <h3 class="font-bold text-slate-800 mb-2">Lista de empaque</h3>
        <div id="lista-items-pedido" class="divide-y divide-slate-100"></div>
      </div>
    `;

    renderListaItems();

    document.getElementById('btn-cambiar-pedido').addEventListener('click', volverASelector);
    
    if (yaEmpacado) {
      document.getElementById('btn-reimprimir-pos')?.addEventListener('click', () => {
        imprimirFacturaPOS(pedidoActual);
      });
    } else {
      document.getElementById('btn-start-empaque-scanner').addEventListener('click', startScanner);
      document.getElementById('btn-cerrar-pedido').addEventListener('click', cerrarPedido);
    }
  }

  function renderListaItems() {
    const cont = document.getElementById('lista-items-pedido');
    const yaEmpacado = pedidoActual.estado === 'EMPACADO';

    if (!pedidoActual.items || pedidoActual.items.length === 0) {
      cont.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">Sin ítems en este pedido.</p>';
    } else {
      cont.innerHTML = pedidoActual.items.map(it => `
        <div class="py-2.5 flex justify-between items-center text-sm border-b border-slate-100 last:border-b-0">
          <div>
            <p class="font-medium text-slate-800">${escapeHtml(it.nombre_producto)}</p>
            <p class="text-xs text-slate-400">SKU ${escapeHtml(it.sku)}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-bold ${it.verificado ? 'text-emerald-600' : 'text-slate-600'}">
              ${it.cantidad_verificada || 0}/${it.cantidad_solicitada}
            </span>
            ${!yaEmpacado ? `
              <button class="btn-eliminar-item text-rose-500 hover:text-rose-700 font-bold px-1" data-id="${it.id}">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      `).join('');
    }

    let edicionWrap = document.getElementById('wrap-agregar-item-edicion');
    if (!edicionWrap) {
      edicionWrap = document.createElement('div');
      edicionWrap.id = 'wrap-agregar-item-edicion';
      cont.parentNode.appendChild(edicionWrap);
    }

    if (!yaEmpacado) {
      edicionWrap.innerHTML = `
        <div class="mt-4 pt-3 border-t border-slate-100 space-y-2">
          <p class="text-xs font-semibold text-slate-500">➕ Agregar producto a este pedido</p>
          <div class="relative">
            <input id="mp-edit-buscar-prod" type="text" placeholder="Buscar producto a agregar..." autocomplete="off"
                   class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
            <div id="mp-edit-autocomplete" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto"></div>
          </div>
        </div>
      `;
      bindEventsEdicionItems();
    } else {
      edicionWrap.innerHTML = '';
    }

    cont.querySelectorAll('.btn-eliminar-item').forEach(btn => {
      btn.onclick = async () => {
        const itemId = btn.dataset.id;
        if (!confirm('¿Quitar este producto de la lista?')) return;

        const res = await apiFetch(`/pedidos/${pedidoActual.id}/items/${itemId}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Producto eliminado del pedido', 'info');
          const refreshed = await apiFetch(`/pedidos/${pedidoActual.id}`);
          pedidoActual = refreshed.data;
          renderTrabajo();
        } else {
          showToast(res.error, 'error');
        }
      };
    });
  }

  function bindEventsEdicionItems() {
    const inputBusqueda = document.getElementById('mp-edit-buscar-prod');
    const dropdown = document.getElementById('mp-edit-autocomplete');
    if (!inputBusqueda || !dropdown) return;

    attachAutocompleteProductos(inputBusqueda, dropdown, async (prod) => {
      const cantStr = prompt(`Cantidad a agregar de "${prod.nombre}":`, '1');
      const cant = Number(cantStr);
      if (!cant || cant <= 0) return;

      const res = await apiFetch(`/pedidos/${pedidoActual.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ producto_id: prod.id, cantidad: cant })
      });

      if (res.ok) {
        showToast(`"${prod.nombre}" agregado al pedido`, 'success');
        const refreshed = await apiFetch(`/pedidos/${pedidoActual.id}`);
        pedidoActual = refreshed.data;
        renderTrabajo();
      } else {
        showToast(res.error, 'error');
      }
    });
  }

  function startScanner() {
    document.getElementById('empaque-scanner-wrap').classList.remove('hidden');
    document.getElementById('btn-start-empaque-scanner').classList.add('hidden');
    scanner = new BarcodeScanner('reader-empaque', onCodigoEscaneado, { cooldownMs: 1500 });
    scanner.start();
    document.getElementById('btn-stop-empaque-scanner').addEventListener('click', stopScanner);
  }

  async function stopScanner() {
    if (scanner) await scanner.stop();
    const wrap = document.getElementById('empaque-scanner-wrap');
    const btn = document.getElementById('btn-start-empaque-scanner');
    if (wrap) wrap.classList.add('hidden');
    if (btn) btn.classList.remove('hidden');
  }

  async function onCodigoEscaneado(codigo) {
    const limpio = (typeof normalizarCodigoBarras === 'function')
      ? normalizarCodigoBarras(codigo)
      : String(codigo || '').trim();

    const data = await apiFetch(`/pedidos/${pedidoActual.id}/escanear`, {
      method: 'POST',
      body: JSON.stringify({ codigo_barras: limpio }),
    });

    const readerDiv = document.getElementById('reader-empaque');

    if (data.resultado === 'OK') {
      beepSuccess();
      if (readerDiv) { readerDiv.classList.add('flash-ok'); setTimeout(() => readerDiv.classList.remove('flash-ok'), 500); }
      showToast(data.mensaje, 'success');
    } else {
      beepError();
      if (readerDiv) { readerDiv.classList.add('flash-error'); setTimeout(() => readerDiv.classList.remove('flash-error'), 600); }
      showToast(data.mensaje || 'Codigo no valido para este pedido', 'error');
    }

    const refreshed = await apiFetch(`/pedidos/${pedidoActual.id}`);
    if (refreshed.ok) {
      pedidoActual = refreshed.data;
      renderTrabajo();
    }
  }

  function actualizarProgresoUI() {
    const total = pedidoActual.items ? pedidoActual.items.length : 0;
    const verificados = pedidoActual.items ? pedidoActual.items.filter(i => i.verificado).length : 0;
    const completado = total > 0 && verificados === total;

    const barra = document.querySelector('#empaque-trabajo .bg-emerald-500');
    if (barra) barra.style.width = `${total ? (verificados/total*100) : 0}%`;
    const texto = document.querySelector('#empaque-trabajo .text-xs.text-slate-500.text-center');
    if (texto) texto.textContent = `${verificados} / ${total} items verificados`;

    const btnCerrar = document.getElementById('btn-cerrar-pedido');
    if (btnCerrar) {
      btnCerrar.disabled = !completado;
      btnCerrar.textContent = completado ? '🔒 Cerrar pedido y descontar inventario' : `Faltan ${total - verificados} item(s) por completar`;
    }
  }

  async function cerrarPedido() {
    if (!confirm('¿Cerrar el pedido y descontar el inventario? Esta accion no se puede deshacer.')) return;
    
    const data = await apiFetch(`/pedidos/${pedidoActual.id}/cerrar`, { method: 'POST' });
    if (!data.ok) { showToast(data.error, 'error'); return; }

    showToast('Pedido EMPACADO. Inventario actualizado.', 'success');
    await stopScanner();

    const refreshed = await apiFetch(`/pedidos/${pedidoActual.id}`);
    pedidoActual = refreshed.data;

    imprimirFacturaPOS(pedidoActual);

    renderTrabajo();
    cargarPedidos();
  }

  async function volverASelector() {
    await stopScanner();
    pedidoActual = null;
    document.getElementById('empaque-selector').classList.remove('hidden');
    document.getElementById('empaque-trabajo').classList.add('hidden');
    cargarPedidos();
  }

  function onLeaveTab() {
    if (scanner && scanner.running) stopScanner();
  }

  function onEnterTab() {
    if (!pedidoActual) cargarPedidos();
  }

  return { render, onLeaveTab, onEnterTab };
})();