/// ============================================================
// MODULO C: Checking / Empaque de Pedidos (Pick & Pack)
// ============================================================

const ModuloEmpaque = (() => {
  let scanner = null;
  let pedidoActual = null; // objeto completo con items (modo checking)
  let itemsManual = []; // items acumulados en el formulario de empaque directo
  let productoSeleccionado = null; // producto elegido en el autocompletado
  let clienteSeleccionadoId = null; // ID del cliente seleccionado
  let tabEmpaque = 'manual'; // 'manual' (empaque directo sin escaner) o 'checking' (con escaner)

  function render() {
    const el = document.getElementById('view-empaque');
    if (!el) return;
    el.innerHTML = `
      <!-- Sub-pestañas de Empaque -->
      <div class="flex gap-2 border-b border-slate-200 pb-2 mb-3">
        <button id="btn-tab-empaque-manual"
                class="px-4 py-2 rounded-xl text-sm font-bold transition-all ${tabEmpaque === 'manual' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          📦 Empaque Directo en Mano (Sin Escáner)
        </button>
        <button id="btn-tab-empaque-checking"
                class="px-4 py-2 rounded-xl text-sm font-bold transition-all ${tabEmpaque === 'checking' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          🔍 Checking con Escáner
        </button>
      </div>

      <!-- VISTA 1: Empaque Directo en Mano (Sin Escáner) -->
      <div id="panel-empaque-manual" class="${tabEmpaque === 'manual' ? 'space-y-4' : 'hidden'}">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 class="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>📦</span> Empaque de Pedido en Mano
              </h2>
              <p class="text-xs text-slate-500">
                Elige el cliente, agrega los productos que estás empacando y márcalo como empacado para la Central de Domicilios.
              </p>
            </div>
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              ⚡ Modo Rápido (Sin Escáner)
            </span>
          </div>

          <!-- Datos del Pedido y Cliente -->
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <!-- Código de Pedido (Solo lectura / Generado automáticamente) -->
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <span>🔒</span> Código de Pedido <span class="text-slate-400 font-normal text-[11px]">(No modificable)</span>
                </label>
                <div class="flex gap-1.5">
                  <input id="mp-codigo" type="text" placeholder="EMP-XXXX" autocomplete="off" readonly tabindex="-1" onkeydown="return false"
                         class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-100 font-mono font-bold text-slate-700 cursor-not-allowed select-all focus:outline-none focus:ring-0 shadow-inner" />
                  <button type="button" id="btn-regenerar-codigo" class="px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors" title="Generar nuevo consecutivo automático">🔄</button>
                </div>
              </div>

              <!-- Cliente con Autocomplete y botón nuevo -->
              <div class="md:col-span-2">
                <label class="block text-xs font-semibold text-slate-600 mb-1">Cliente *</label>
                <div class="relative">
                  <div class="flex gap-1.5">
                    <input id="mp-cliente" type="text" placeholder="Escribe el nombre o teléfono del cliente..." autocomplete="off"
                           class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500" />
                    <button type="button" id="btn-crear-cliente-empaque" class="px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs" title="Crear nuevo cliente">
                      <span>➕</span> Cliente
                    </button>
                  </div>
                  <div id="mp-autocomplete-cliente" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 max-h-60 overflow-y-auto"></div>
                </div>
              </div>
            </div>

            <!-- Datos de Entrega Adicionales (se llenan solos del cliente) -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">Teléfono</label>
                <input id="mp-telefono" type="text" placeholder="300 000 0000" autocomplete="off"
                       class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">Dirección de Entrega</label>
                <input id="mp-direccion" type="text" placeholder="Calle / Cra / Apto / Local" autocomplete="off"
                       class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">Municipio / Barrio</label>
                <input id="mp-municipio" type="text" placeholder="Ej: Medellín, Itagüí..." autocomplete="off"
                       class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">Observación / Nota para el Domiciliario (opcional)</label>
              <input id="mp-observacion" type="text" placeholder="Ej: Portería torre 2, timbre 401..." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
          </div>

          <!-- Buscador y Agregador de Productos para Empacar -->
          <div class="border border-emerald-200 bg-emerald-50/50 rounded-xl p-3.5 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <span>🔎</span> Empacar Productos (Buscador por Nombre o SKU)
              </span>
              <span class="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                🔒 Sin precios — Solo empacas unidades
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              <!-- Campo Buscador -->
              <div class="md:col-span-8 relative">
                <label class="block text-xs font-medium text-slate-600 mb-1">Buscar Producto</label>
                <input id="mp-buscar-producto" type="text" placeholder="Escribe el nombre del producto o SKU..." autocomplete="off"
                       class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500" />
                <div id="mp-autocomplete" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 max-h-64 overflow-y-auto"></div>
              </div>

              <!-- Cantidad a empacar -->
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-slate-600 mb-1">Cantidad</label>
                <div class="flex items-center">
                  <button type="button" id="btn-menos-cant" class="w-8 h-9 rounded-l-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-sm flex items-center justify-center">-</button>
                  <input id="mp-cantidad" type="number" min="1" value="1"
                         class="w-full h-9 border-y border-slate-300 text-center text-sm font-bold text-slate-800" />
                  <button type="button" id="btn-mas-cant" class="w-8 h-9 rounded-r-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-sm flex items-center justify-center">+</button>
                </div>
              </div>

              <!-- Botón Agregar -->
              <div class="md:col-span-2">
                <button id="btn-agregar-item-manual" class="w-full h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40 shadow-xs" disabled>
                  <span>➕</span> Agregar
                </button>
              </div>
            </div>

            <div id="mp-producto-seleccionado" class="hidden bg-white border border-emerald-300 rounded-lg p-2.5 text-xs text-slate-800 shadow-xs"></div>
          </div>

          <!-- Lista de Productos Empacados -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700">Productos Empacados en este Pedido:</span>
              <span id="mp-resumen-conteo" class="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                0 productos · 0 unidades
              </span>
            </div>

            <div id="mp-lista-items" class="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white max-h-72 overflow-y-auto">
              <p class="text-xs text-slate-400 text-center py-6">Aún no has agregado productos a este pedido.</p>
            </div>
          </div>

          <!-- Botón de Finalización -->
          <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <button id="btn-limpiar-form-manual" class="sm:w-1/3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">
              🧹 Limpiar Formulario
            </button>
            <button id="btn-guardar-pedido-manual" class="sm:w-2/3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md">
              <span class="text-lg">📦</span>
              <span>Marcar como EMPACADO y Enviar a Domicilios</span>
            </button>
          </div>
        </div>
      </div>

      <!-- VISTA 2: Checking con Escáner (Modo Clásico) -->
      <div id="panel-empaque-checking" class="${tabEmpaque === 'checking' ? 'space-y-3' : 'hidden'}">
        <div id="empaque-selector" class="bg-white rounded-2xl shadow-sm p-4 space-y-3 border border-slate-200">
          <h2 class="font-bold text-slate-800">🔍 Checking con Escáner de Código de Barras</h2>
          <p class="text-xs text-slate-500">Selecciona un pedido importado o pendiente para verificarlo con el lector.</p>

          <div class="flex gap-2">
            <select id="select-pedido" class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Cargando pedidos...</option>
            </select>
            <button id="btn-abrir-pedido" class="px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">Abrir</button>
          </div>

          <hr class="border-slate-100" />

          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-bold text-slate-700">👥 Base de Datos de Clientes</p>
              <button onclick="abrirModalNuevoCliente('', () => showToast('Cliente guardado con éxito', 'success'))"
                      class="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold">
                ➕ Agregar Cliente
              </button>
            </div>
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
      </div>
    `;

    bindEvents();
    if (tabEmpaque === 'manual') {
      generarCodigoEmpaqueAuto();
    } else {
      cargarPedidos();
    }
  }

  function cambiarTabEmpaque(tab) {
    tabEmpaque = tab;
    render();
  }

  function bindEvents() {
    // Alternador de pestañas
    const btnTabManual = document.getElementById('btn-tab-empaque-manual');
    const btnTabChecking = document.getElementById('btn-tab-empaque-checking');
    if (btnTabManual) btnTabManual.addEventListener('click', () => cambiarTabEmpaque('manual'));
    if (btnTabChecking) btnTabChecking.addEventListener('click', () => cambiarTabEmpaque('checking'));

    // Botón regenerar código
    const btnRegen = document.getElementById('btn-regenerar-codigo');
    if (btnRegen) btnRegen.addEventListener('click', () => generarCodigoEmpaqueAuto());

    // Botón crear cliente
    const btnCrearCliente = document.getElementById('btn-crear-cliente-empaque');
    if (btnCrearCliente) {
      btnCrearCliente.addEventListener('click', () => {
        abrirModalNuevoCliente('', (c) => {
          clienteSeleccionadoId = c.id;
          const inputCliente = document.getElementById('mp-cliente');
          if (inputCliente) inputCliente.value = c.nombre || '';
          const inpTel = document.getElementById('mp-telefono');
          if (inpTel && c.telefono) inpTel.value = c.telefono;
          const inpDir = document.getElementById('mp-direccion');
          if (inpDir && c.direccion) inpDir.value = c.direccion;
          const inpMun = document.getElementById('mp-municipio');
          if (inpMun && (c.ciudad || c.municipio)) inpMun.value = c.ciudad || c.municipio || '';
          showToast('Cliente creado y seleccionado', 'success');
        });
      });
    }

    // Botones de cantidad rápida
    const btnMenos = document.getElementById('btn-menos-cant');
    const btnMas = document.getElementById('btn-mas-cant');
    const inpCant = document.getElementById('mp-cantidad');
    if (btnMenos && inpCant) {
      btnMenos.addEventListener('click', () => {
        const val = Math.max(1, (parseInt(inpCant.value, 10) || 1) - 1);
        inpCant.value = val;
      });
    }
    if (btnMas && inpCant) {
      btnMas.addEventListener('click', () => {
        const val = (parseInt(inpCant.value, 10) || 1) + 1;
        inpCant.value = val;
      });
    }

    // Botones de formulario manual
    const btnAgregar = document.getElementById('btn-agregar-item-manual');
    if (btnAgregar) btnAgregar.addEventListener('click', agregarItemManual);

    const btnGuardar = document.getElementById('btn-guardar-pedido-manual');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarPedidoManual);

    const btnLimpiar = document.getElementById('btn-limpiar-form-manual');
    if (btnLimpiar) btnLimpiar.addEventListener('click', resetFormManual);

    // Permitir agregar con Enter en el input de cantidad
    if (inpCant) {
      inpCant.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          agregarItemManual();
        }
      });
    }

    // Autocomplete productos para empaque directo
    const inputBuscarProd = document.getElementById('mp-buscar-producto');
    const dropdownProd = document.getElementById('mp-autocomplete');
    if (inputBuscarProd && dropdownProd) {
      attachAutocompleteProductos(
        inputBuscarProd,
        dropdownProd,
        (producto) => {
          productoSeleccionado = producto;
          inputBuscarProd.value = producto.nombre;
          const box = document.getElementById('mp-producto-seleccionado');
          if (box) {
            box.classList.remove('hidden');
            box.innerHTML = `
              <div class="flex justify-between items-center">
                <span><b>${escapeHtml(producto.nombre)}</b> (SKU: ${escapeHtml(producto.sku)})</span>
                <span class="text-emerald-700 font-semibold">Stock: ${producto.stock}</span>
              </div>
            `;
          }
          if (btnAgregar) btnAgregar.disabled = false;
          if (inpCant) {
            inpCant.focus();
            inpCant.select();
          }
        }
      );

      inputBuscarProd.addEventListener('input', (e) => {
        if (productoSeleccionado && e.target.value !== productoSeleccionado.nombre) {
          productoSeleccionado = null;
          const box = document.getElementById('mp-producto-seleccionado');
          if (box) box.classList.add('hidden');
          if (btnAgregar) btnAgregar.disabled = true;
        }
      });
    }

    // Autocomplete clientes para empaque directo
    const inputCliente = document.getElementById('mp-cliente');
    const dropdownCliente = document.getElementById('mp-autocomplete-cliente');
    if (inputCliente && dropdownCliente) {
      attachAutocompleteClientes(
        inputCliente,
        dropdownCliente,
        (cliente) => {
          clienteSeleccionadoId = cliente.id;
          inputCliente.value = cliente.nombre || '';
          const inpTel = document.getElementById('mp-telefono');
          if (inpTel && cliente.telefono) inpTel.value = cliente.telefono;
          const inpDir = document.getElementById('mp-direccion');
          if (inpDir && cliente.direccion) inpDir.value = cliente.direccion;
          const inpMun = document.getElementById('mp-municipio');
          if (inpMun && (cliente.ciudad || cliente.municipio)) inpMun.value = cliente.ciudad || cliente.municipio || '';
          showToast(`Cliente "${cliente.nombre}" seleccionado`, 'info');
        },
        (clienteNuevo) => {
          clienteSeleccionadoId = clienteNuevo.id;
          inputCliente.value = clienteNuevo.nombre || '';
          const inpTel = document.getElementById('mp-telefono');
          if (inpTel && clienteNuevo.telefono) inpTel.value = clienteNuevo.telefono;
          const inpDir = document.getElementById('mp-direccion');
          if (inpDir && clienteNuevo.direccion) inpDir.value = clienteNuevo.direccion;
        }
      );
    }

    // Eventos para modo checking clásico
    const fileClientesMasivo = document.getElementById('file-clientes-masivo');
    if (fileClientesMasivo) {
      fileClientesMasivo.addEventListener('change', async (e) => {
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
    }

    const btnAbrirPedido = document.getElementById('btn-abrir-pedido');
    if (btnAbrirPedido) {
      btnAbrirPedido.addEventListener('click', () => {
        const id = document.getElementById('select-pedido')?.value;
        if (id) abrirPedido(id);
      });
    }

    const filePedidos = document.getElementById('file-pedidos');
    if (filePedidos) {
      filePedidos.addEventListener('change', handleUploadPedidos);
    }
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
          <img src="/img/Logo.png" class="logo" alt="Logo Jispiplast" onerror="this.style.display='none';" />
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

        ${(() => {
          const itemsFaltantes = (pedido.items || []).filter(it => it.es_faltante);
          if (itemsFaltantes.length === 0) return '';
          return `
            <div class="divider"></div>
            <div style="background: #fffbeb; border: 1px dashed #d97706; padding: 5px; margin: 4px 0;">
              <p class="bold text-center" style="color: #92400e; margin: 0 0 3px 0; font-size: 10px;">⚠️ PRODUCTOS FALTANTES (COMPRA/RECOLECCIÓN)</p>
              ${itemsFaltantes.map(it => `
                <div style="font-size: 9px; margin-bottom: 3px; border-bottom: 1px dotted #e5e7eb; padding-bottom: 2px;">
                  <b>• ${escapeHtml(it.nombre_producto || it.nombre)}</b> (Cant: ${it.cantidad_solicitada || 1})<br>
                  <span style="color: #78350f;">Nota: ${escapeHtml(it.nota_faltante || 'Sin nota')}</span>
                </div>
              `).join('')}
            </div>
          `;
        })()}

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
    return codigoGenerado;
  }

  function resetFormManual() {
    itemsManual = [];
    productoSeleccionado = null;
    clienteSeleccionadoId = null;

    const cliente = document.getElementById('mp-cliente');
    const telefono = document.getElementById('mp-telefono');
    const direccion = document.getElementById('mp-direccion');
    const municipio = document.getElementById('mp-municipio');
    const observacion = document.getElementById('mp-observacion');
    const buscar = document.getElementById('mp-buscar-producto');
    const cantidad = document.getElementById('mp-cantidad');

    if (cliente) cliente.value = '';
    if (telefono) telefono.value = '';
    if (direccion) direccion.value = '';
    if (municipio) municipio.value = '';
    if (observacion) observacion.value = '';
    if (buscar) buscar.value = '';
    if (cantidad) cantidad.value = 1;

    const box = document.getElementById('mp-producto-seleccionado');
    if (box) {
      box.classList.add('hidden');
      box.innerHTML = '';
    }

    const btnAgregar = document.getElementById('btn-agregar-item-manual');
    if (btnAgregar) btnAgregar.disabled = true;

    generarCodigoEmpaqueAuto();
    renderItemsManual();
  }

  function agregarItemManual() {
    if (!productoSeleccionado) return;
    const inpCant = document.getElementById('mp-cantidad');
    const cantidad = parseInt(inpCant?.value, 10) || 0;
    if (cantidad <= 0) {
      showToast('La cantidad debe ser mayor a 0', 'error');
      return;
    }

    const existente = itemsManual.find(i => (productoSeleccionado.id && i.producto_id === productoSeleccionado.id) || i.sku === productoSeleccionado.sku);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      itemsManual.push({
        producto_id: productoSeleccionado.id || null,
        sku: productoSeleccionado.sku || '',
        nombre: productoSeleccionado.nombre || 'Producto',
        cantidad
      });
    }

    productoSeleccionado = null;
    const inputBuscar = document.getElementById('mp-buscar-producto');
    if (inputBuscar) {
      inputBuscar.value = '';
      inputBuscar.focus();
    }
    if (inpCant) inpCant.value = 1;

    const box = document.getElementById('mp-producto-seleccionado');
    if (box) {
      box.classList.add('hidden');
      box.innerHTML = '';
    }

    const btnAgregar = document.getElementById('btn-agregar-item-manual');
    if (btnAgregar) btnAgregar.disabled = true;

    renderItemsManual();
    showToast('Producto agregado al empaque', 'info');
  }

  function renderItemsManual() {
    const cont = document.getElementById('mp-lista-items');
    const badgeResumen = document.getElementById('mp-resumen-conteo');
    if (!cont) return;

    const totalProductos = itemsManual.length;
    const totalUnidades = itemsManual.reduce((acc, it) => acc + Number(it.cantidad || 0), 0);

    if (badgeResumen) {
      badgeResumen.innerText = `${totalProductos} productos · ${totalUnidades} unidades`;
    }

    if (itemsManual.length === 0) {
      cont.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Aún no has agregado productos a este pedido.</p>`;
      return;
    }

    cont.innerHTML = itemsManual.map((it, idx) => `
      <div class="px-3 py-2.5 flex flex-col gap-1 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
        <div class="flex justify-between items-center">
          <div class="min-w-0 flex-1 pr-2">
            <p class="font-bold text-slate-800 truncate flex items-center gap-1.5">
              <span>${escapeHtml(it.nombre)}</span>
              ${it.es_faltante ? `<span class="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-bold border border-amber-300">⚠️ Faltante</span>` : ''}
            </p>
            <p class="text-xs text-slate-400 font-mono">SKU ${escapeHtml(it.sku || 'N/A')}</p>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button type="button" class="btn-restar-cant-manual px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs" data-idx="${idx}">-</button>
              <span class="px-2 py-1 font-extrabold text-xs text-slate-800 min-w-[28px] text-center">${it.cantidad}</span>
              <button type="button" class="btn-sumar-cant-manual px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs" data-idx="${idx}">+</button>
            </div>
            <button type="button" data-idx="${idx}" class="btn-toggle-faltante-manual text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${it.es_faltante ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
              ${it.es_faltante ? '⚠️ Faltante' : 'Marcar Faltante'}
            </button>
            <button type="button" data-idx="${idx}" class="btn-quitar-item-manual text-rose-500 hover:text-rose-700 text-xs font-semibold px-2 py-1 rounded hover:bg-rose-50" title="Quitar producto">✕</button>
          </div>
        </div>
        ${it.es_faltante ? `
          <div class="mt-1">
            <input type="text" class="input-nota-faltante w-full border border-amber-300 rounded-lg px-2.5 py-1 text-xs bg-amber-50/60 text-amber-900 placeholder-amber-700/60 focus:ring-1 focus:ring-amber-500" data-idx="${idx}" value="${escapeHtml(it.nota_faltante || '')}" placeholder="Nota para el domiciliario (Ej: Comprar en farmacia X / Recoger en otro punto)..." />
          </div>
        ` : ''}
      </div>
    `).join('');

    cont.querySelectorAll('.btn-sumar-cant-manual').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        itemsManual[idx].cantidad += 1;
        renderItemsManual();
      });
    });

    cont.querySelectorAll('.btn-restar-cant-manual').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        if (itemsManual[idx].cantidad > 1) {
          itemsManual[idx].cantidad -= 1;
        } else {
          itemsManual.splice(idx, 1);
        }
        renderItemsManual();
      });
    });

    cont.querySelectorAll('.btn-toggle-faltante-manual').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        itemsManual[idx].es_faltante = !itemsManual[idx].es_faltante;
        if (itemsManual[idx].es_faltante && !itemsManual[idx].nota_faltante) {
          itemsManual[idx].nota_faltante = '';
        }
        renderItemsManual();
      });
    });

    cont.querySelectorAll('.input-nota-faltante').forEach(input => {
      input.addEventListener('input', () => {
        const idx = Number(input.dataset.idx);
        itemsManual[idx].nota_faltante = input.value;
      });
    });

    cont.querySelectorAll('.btn-quitar-item-manual').forEach(btn => {
      btn.addEventListener('click', () => {
        itemsManual.splice(Number(btn.dataset.idx), 1);
        renderItemsManual();
      });
    });
  }

  async function guardarPedidoManual() {
    const inputCodigo = document.getElementById('mp-codigo');
    const inputCliente = document.getElementById('mp-cliente');
    const inputTel = document.getElementById('mp-telefono');
    const inputDir = document.getElementById('mp-direccion');
    const inputMun = document.getElementById('mp-municipio');
    const inputObs = document.getElementById('mp-observacion');

    let codigo_pedido = inputCodigo?.value.trim() || '';
    if (!codigo_pedido) {
      codigo_pedido = generarCodigoEmpaqueAuto();
    }

    const cliente = inputCliente?.value.trim() || '';
    if (!cliente) {
      showToast('Por favor escribe o selecciona un cliente para el pedido', 'error');
      inputCliente?.focus();
      return;
    }

    if (itemsManual.length === 0) {
      showToast('Debes empacar al menos un producto en este pedido', 'error');
      document.getElementById('mp-buscar-producto')?.focus();
      return;
    }

    const btnGuardar = document.getElementById('btn-guardar-pedido-manual');
    if (btnGuardar) {
      btnGuardar.disabled = true;
      btnGuardar.innerHTML = `<span>⏳</span> Guardando y enviando a Central de Domicilios...`;
    }

    try {
      const data = await apiFetch('/pedidos/manual', {
        method: 'POST',
        body: JSON.stringify({
          codigo_pedido,
          cliente_nombre: cliente,
          cliente_id: clienteSeleccionadoId,
          telefono: inputTel?.value.trim() || '',
          direccion: inputDir?.value.trim() || '',
          municipio: inputMun?.value.trim() || '',
          observacion: inputObs?.value.trim() || '',
          items: itemsManual.map(i => ({
            producto_id: i.producto_id,
            sku: i.sku,
            nombre: i.nombre,
            cantidad: i.cantidad,
            es_faltante: i.es_faltante ? 1 : 0,
            nota_faltante: i.nota_faltante || ''
          })),
          tipo_entrega: 'DOMICILIO'
        })
      });

      if (!data.ok) {
        showToast(data.error || 'Error al registrar el empaque del pedido', 'error');
        return;
      }

      showToast(`📦 ¡Pedido "${codigo_pedido}" empacado con éxito! Listo en Central de Domicilios para despacho.`, 'success');
      resetFormManual();

      // Si el usuario cambia a checking, actualizamos el listado
      if (tabEmpaque === 'checking') {
        cargarPedidos();
      }
    } catch (err) {
      showToast(err.message || 'Error de conexión', 'error');
    } finally {
      if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `
          <span class="text-lg">📦</span>
          <span>Marcar como EMPACADO y Enviar a Domicilios</span>
        `;
      }
    }
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
        <div class="py-2.5 flex flex-col gap-1 text-sm border-b border-slate-100 last:border-b-0 ${it.es_faltante ? 'bg-amber-50/50 px-2 rounded' : ''}">
          <div class="flex justify-between items-center">
            <div>
              <p class="font-medium text-slate-800 flex items-center gap-1.5">
                <span>${escapeHtml(it.nombre_producto)}</span>
                ${it.es_faltante ? `<span class="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-bold border border-amber-300">⚠️ Faltante</span>` : ''}
              </p>
              <p class="text-xs text-slate-400 font-mono">SKU ${escapeHtml(it.sku)} ${it.nota_faltante ? `· <span class="text-amber-800 font-semibold">${escapeHtml(it.nota_faltante)}</span>` : ''}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-xs ${it.es_faltante ? 'text-amber-800' : (it.verificado ? 'text-emerald-600' : 'text-slate-600')}">
                ${it.es_faltante ? 'Faltante' : `${it.cantidad_verificada || it.cantidad_empacada || 0}/${it.cantidad_solicitada}`}
              </span>
              ${!yaEmpacado ? `
                <button class="btn-toggle-faltante text-xs px-2 py-1 rounded font-semibold transition ${it.es_faltante ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-id="${it.id}" data-faltante="${it.es_faltante ? 1 : 0}" title="Marcar como faltante para compra/recolección">
                  ${it.es_faltante ? 'Quitar Faltante' : '⚠️ Marcar Faltante'}
                </button>
                <button class="btn-eliminar-item text-rose-500 hover:text-rose-700 font-bold px-1" data-id="${it.id}" title="Eliminar ítem">
                  🗑️
                </button>
              ` : ''}
            </div>
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

    cont.querySelectorAll('.btn-toggle-faltante').forEach(btn => {
      btn.onclick = async () => {
        const itemId = btn.dataset.id;
        const actualFaltante = Number(btn.dataset.faltante);
        const nuevoFaltante = actualFaltante ? 0 : 1;
        let nota = '';
        if (nuevoFaltante) {
          nota = prompt('Nota o instrucción para el domiciliario (Ej: Comprar en farmacia X / Recoger en otro punto):', '') || '';
        }

        const res = await apiFetch(`/pedidos/${pedidoActual.id}/items/${itemId}/faltante`, {
          method: 'POST',
          body: JSON.stringify({ es_faltante: nuevoFaltante, nota_faltante: nota })
        });
        if (res.ok) {
          showToast(res.mensaje, 'success');
          const refreshed = await apiFetch(`/pedidos/${pedidoActual.id}`);
          pedidoActual = refreshed.data;
          renderTrabajo();
        } else {
          showToast(res.error || 'Error al actualizar faltante', 'error');
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

  function mostrarModalFaltantesDespacho(pedido, onConfirm) {
    const faltantes = (pedido.items || []).filter(it => it.es_faltante);
    if (faltantes.length === 0) {
      onConfirm();
      return;
    }

    const existing = document.getElementById('modal-faltantes-despacho');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-faltantes-despacho';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-bold">⚠️</span>
            <div>
              <h3 class="text-base font-bold text-slate-900">Productos Faltantes en Despacho</h3>
              <p class="text-xs text-slate-500">El pedido ${escapeHtml(pedido.codigo_pedido)} tiene ítems pendientes de compra o recolección.</p>
            </div>
          </div>
          <button type="button" id="btn-cerrar-modal-faltantes-despacho" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold transition">✕</button>
        </div>

        <div class="py-4 space-y-3">
          <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950">
            <p class="font-semibold mb-2">Listado de ítems faltantes para este pedido:</p>
            <div class="max-h-60 overflow-y-auto space-y-2 pr-1">
              ${faltantes.map(it => `
                <div class="bg-white p-2.5 rounded-lg border border-amber-300 shadow-2xs space-y-1">
                  <div class="flex justify-between items-start">
                    <p class="font-bold text-slate-800">${escapeHtml(it.nombre_producto || it.nombre)}</p>
                    <span class="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-extrabold text-xs">Cant: ${it.cantidad_solicitada || 1}</span>
                  </div>
                  <p class="text-[11px] text-slate-500 font-mono">SKU: ${escapeHtml(it.sku || 'N/A')}</p>
                  ${it.nota_faltante ? `<p class="text-[11px] text-amber-900 bg-amber-50 p-1.5 rounded font-medium mt-1">📝 <b>Nota:</b> ${escapeHtml(it.nota_faltante)}</p>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          <p class="text-xs text-slate-600">Al continuar con el cierre y despacho, este listado se incluirá en el ticket POS y estará visible para el domiciliario.</p>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button type="button" id="btn-cancelar-faltantes" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancelar</button>
          <button type="button" id="btn-confirmar-faltantes-despacho" class="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition flex items-center gap-1.5">
            <span>✅ Confirmar Despacho e Imprimir</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-cerrar-modal-faltantes-despacho').onclick = () => modal.remove();
    modal.querySelector('#btn-cancelar-faltantes').onclick = () => modal.remove();
    modal.querySelector('#btn-confirmar-faltantes-despacho').onclick = () => {
      modal.remove();
      onConfirm();
    };
  }

  async function cerrarPedido() {
    if (!pedidoActual) return;
    const faltantes = (pedidoActual.items || []).filter(i => i.es_faltante);
    if (faltantes.length > 0) {
      mostrarModalFaltantesDespacho(pedidoActual, async () => {
        await ejecutarCierrePedido();
      });
    } else {
      if (!confirm('¿Cerrar el pedido y descontar el inventario? Esta accion no se puede deshacer.')) return;
      await ejecutarCierrePedido();
    }
  }

  async function ejecutarCierrePedido() {
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