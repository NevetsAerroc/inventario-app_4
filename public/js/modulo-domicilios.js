const ModuloDomicilios = {
  tabActiva: 'despachar', // 'despachar' | 'rutas' | 'cuadre'
  pedidosPendientes: [],
  domiciliarios: [],
  rutaSeleccionadaId: null,
  fechaFiltro: null, // null = aun no inicializado (se pone la fecha de hoy), '' = ver todos (todas las pestañas)

  // Variables para creación de pedidos e ítems
  itemsManual: [],
  productoSeleccionado: null,
  clienteSeleccionadoId: null,
    _baseManual: false,

  onEnterTab() {
    if (!document.getElementById('contenedor-subtab')) return;
    const formAbierto = document.getElementById('form-nuevo-pedido-domicilio');
    if (formAbierto && !formAbierto.classList.contains('hidden')) return;
    if (document.querySelector('.chk-pedido:checked')) return;
    this.cargarTabActual();
  },

  async render() {
    const container = document.getElementById('view-domicilios');
    if (!container) return;

    // La primera vez que se entra al modulo, filtramos por la fecha de hoy en todas las pestañas.
    if (this.fechaFiltro === null) {
      this.fechaFiltro = this.fechaHoyLocal();
    }

    container.innerHTML = `
      <div class="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h2 class="text-base font-bold flex items-center gap-2">
            🚚 <span>Domicilios & Liquidación</span>
          </h2>
          <div class="flex gap-2">
            <button onclick="ModuloDomicilios.abrirModalNuevoDomiciliario()" class="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium">
              + Domiciliario
            </button>
            <button onclick="ModuloDomicilios.toggleFormularioNuevoPedido()" class="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium">
              + Crear Pedido
            </button>
            <button id="btn-refresh-dom" class="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium">
              🔄
            </button>
          </div>
        </div>

        <!-- FILTRO DE FECHA GLOBAL: aplica a Despachar, En Curso y Cuadre -->
        <div class="flex items-center justify-between gap-2 -mt-2">
          <label class="text-xs font-semibold text-slate-600">📅 Ver pedidos y rutas del día:</label>
          <div class="flex items-center gap-1">
            <input type="date" id="input-fecha-dom" value="${this.fechaFiltro || ''}"
                   class="text-[11px] border rounded-md px-1.5 py-1 bg-white"
                   onchange="ModuloDomicilios.cambiarFecha(this.value)">
            <button id="btn-fecha-hoy" onclick="ModuloDomicilios.cambiarFecha(ModuloDomicilios.fechaHoyLocal())"
                    class="text-[10px] px-2 py-1 rounded-md font-semibold ${this.fechaFiltro === this.fechaHoyLocal() ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}">
              Hoy
            </button>
            <button id="btn-fecha-todos" onclick="ModuloDomicilios.cambiarFecha('')"
                    class="text-[10px] px-2 py-1 rounded-md font-semibold ${!this.fechaFiltro ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}">
              Todos
            </button>
          </div>
        </div>

        <!-- FORMULARIO INTEGRADO (ESTILO EMPAQUE) -->
        <div id="form-nuevo-pedido-domicilio" class="hidden space-y-3 border border-slate-200 rounded-xl p-3 bg-slate-50">
          <p class="text-xs font-bold text-slate-800">📦 Crear Nuevo Pedido de Domicilio</p>

          <div class="grid grid-cols-2 gap-2">
            <!-- CÓDIGO GENERADO AUTOMÁTICAMENTE -->
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Código Pedido</label>
              <input id="dom-codigo" type="text" placeholder="EMP-XXXXXX" readonly
                     class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-slate-100 font-semibold text-slate-700 cursor-not-allowed" />
            </div>
            
            <!-- BÚSQUEDA Y CREACIÓN DE CLIENTES (AUTOCOMPLETE) -->
            <div class="relative">
              <label class="block text-[10px] text-slate-500 mb-0.5">Cliente</label>
              <input id="dom-cliente" type="text" placeholder="Buscar o crear cliente..." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
              <div id="dom-autocomplete-cliente" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto"></div>
            </div>
          </div>

                    <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Municipio *</label>
              <input id="dom-municipio" type="text" placeholder="Ej: Pereira, Dosquebradas..." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Teléfono</label>
              <input id="dom-telefono" type="text" placeholder="Teléfono" autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
            </div>
          </div>

          <div>
            <label class="block text-[10px] text-slate-500 mb-0.5">Dirección de Entrega *</label>
            <input id="dom-direccion" type="text" placeholder="Ej: Calle 10 # 15-20" autocomplete="off"
                   class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
          </div>

          <hr class="border-slate-200 my-1" />

          <!-- SECCIÓN AGREGAR PRODUCTOS (OPCIONAL) -->
          <div>
            <p class="text-[11px] font-semibold text-slate-600 mb-1">Agregar Productos (Opcional)</p>
            <div class="relative mb-2">
              <input id="dom-buscar-producto" type="text" placeholder="Buscar producto por nombre o SKU..." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
              <div id="dom-autocomplete-producto" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto"></div>
            </div>
            <div id="dom-producto-seleccionado" class="hidden bg-white border border-slate-200 rounded-lg p-2 text-xs mb-2"></div>

            <div class="flex gap-2">
              <input id="dom-cantidad-prod" type="number" min="1" value="1" placeholder="Cant."
                     class="w-20 border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
              <button id="btn-add-item-dom" type="button" class="flex-1 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold disabled:opacity-40" disabled>
                + Agregar producto
              </button>
            </div>
          </div>

          <div id="dom-lista-items" class="divide-y divide-slate-200 max-h-36 overflow-y-auto bg-white rounded-lg border px-2"></div>

          <!-- TOTAL Y OBSERVACIONES -->
          <div class="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Valor Total del Pedido ($) *</label>
              <input id="dom-total" type="number" step="50" min="0" placeholder="0" autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white font-bold text-emerald-700" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Observaciones / Notas</label>
              <input id="dom-observaciones" type="text" placeholder="Devueltas de $50k, etc." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
            </div>
          </div>

          <div class="flex gap-2 pt-2">
            <button onclick="ModuloDomicilios.toggleFormularioNuevoPedido(false)" class="flex-1 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold text-xs">
              Cancelar
            </button>
            <button onclick="ModuloDomicilios.guardarPedidoManualInline()" class="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs">
              Guardar Pedido
            </button>
          </div>
        </div>

        <!-- NAVEGACIÓN DE PESTAÑAS INTERNAS -->
        <div class="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg text-center text-xs font-semibold">
          <button id="subtab-despachar" class="py-2 rounded-md bg-white text-slate-900 shadow-sm">1. Despachar</button>
          <button id="subtab-rutas" class="py-2 rounded-md text-slate-600">2. En Curso</button>
          <button id="subtab-cuadre" class="py-2 rounded-md text-slate-600">3. Cuadre</button>
        </div>

        <div id="contenedor-subtab"></div>
      </div>
    `;

    this.bindEvents();
    this.initAutocompletes();
    await this.cargarInicial();
  },

  bindEvents() {
    document.getElementById('btn-refresh-dom').onclick = () => this.cargarTabActual();
    document.getElementById('subtab-despachar').onclick = () => this.cambiarSubTab('despachar');
    document.getElementById('subtab-rutas').onclick = () => this.cambiarSubTab('rutas');
    document.getElementById('subtab-cuadre').onclick = () => this.cambiarSubTab('cuadre');

    document.getElementById('btn-add-item-dom')?.addEventListener('click', () => this.agregarItemManual());

    document.getElementById('dom-buscar-producto')?.addEventListener('input', (e) => {
      if (this.productoSeleccionado && e.target.value !== this.productoSeleccionado.nombre) {
        this.productoSeleccionado = null;
        document.getElementById('dom-producto-seleccionado')?.classList.add('hidden');
        document.getElementById('btn-add-item-dom').disabled = true;
      }
    });
  },

  initAutocompletes() {
    if (typeof attachAutocompleteClientes === 'function') {
      attachAutocompleteClientes(
        document.getElementById('dom-cliente'),
        document.getElementById('dom-autocomplete-cliente'),
        (cliente) => {
          this.clienteSeleccionadoId = cliente.id;
          document.getElementById('dom-cliente').value = cliente.nombre || cliente.cliente || '';
          if (cliente.telefono) document.getElementById('dom-telefono').value = cliente.telefono;
          if (cliente.direccion) document.getElementById('dom-direccion').value = cliente.direccion;
          if (cliente.ciudad) document.getElementById('dom-municipio').value = cliente.ciudad;
        },
        (clienteNuevo) => {
          this.clienteSeleccionadoId = clienteNuevo.id;
          document.getElementById('dom-cliente').value = clienteNuevo.nombre || clienteNuevo.cliente || '';
        }
      );
    }

    if (typeof attachAutocompleteProductos === 'function') {
      attachAutocompleteProductos(
        document.getElementById('dom-buscar-producto'),
        document.getElementById('dom-autocomplete-producto'),
        (prod) => {
          this.productoSeleccionado = prod;
          document.getElementById('dom-buscar-producto').value = prod.nombre;
          const box = document.getElementById('dom-producto-seleccionado');
          box.classList.remove('hidden');
          box.innerHTML = `<b>${escapeHtml(prod.nombre)}</b> — SKU ${escapeHtml(prod.sku)}`;
          document.getElementById('btn-add-item-dom').disabled = false;
        }
      );
    }
  },

  generarCodigoPedidoAuto() {
    const ahora = new Date();
    const aa = String(ahora.getFullYear()).slice(-2);
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    const hh = String(ahora.getHours()).padStart(2, '0');
    const mi = String(ahora.getMinutes()).padStart(2, '0');
    const ss = String(ahora.getSeconds()).padStart(2, '0');

    const codigo = `EMP-${aa}${mm}${dd}-${hh}${mi}${ss}`;
    const el = document.getElementById('dom-codigo');
    if (el) el.value = codigo;
  },

  toggleFormularioNuevoPedido(mostrar = null) {
    const form = document.getElementById('form-nuevo-pedido-domicilio');
    if (!form) return;

    const visibilidad = mostrar !== null ? mostrar : form.classList.contains('hidden');
    if (visibilidad) {
      this.resetFormulario();
      this.generarCodigoPedidoAuto();
      form.classList.remove('hidden');
      document.getElementById('dom-cliente')?.focus();
    } else {
      form.classList.add('hidden');
      this.resetFormulario();
    }
  },

  resetFormulario() {
    this.itemsManual = [];
    this.productoSeleccionado = null;
    this.clienteSeleccionadoId = null;

        ['dom-codigo', 'dom-cliente', 'dom-telefono', 'dom-direccion', 'dom-municipio', 'dom-total', 'dom-observaciones', 'dom-buscar-producto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const box = document.getElementById('dom-producto-seleccionado');
    if (box) box.classList.add('hidden');

    const btn = document.getElementById('btn-add-item-dom');
    if (btn) btn.disabled = true;

    this.renderItemsManual();
  },

  agregarItemManual() {
    if (!this.productoSeleccionado) return;
    const cantidad = parseInt(document.getElementById('dom-cantidad-prod').value, 10) || 0;
    if (cantidad <= 0) return alert('La cantidad debe ser mayor a 0');

    const existente = this.itemsManual.find(i => i.sku === this.productoSeleccionado.sku);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      this.itemsManual.push({
        sku: this.productoSeleccionado.sku,
        nombre: this.productoSeleccionado.nombre,
        cantidad
      });
    }

    this.productoSeleccionado = null;
    document.getElementById('dom-buscar-producto').value = '';
    document.getElementById('dom-cantidad-prod').value = '1';
    document.getElementById('dom-producto-seleccionado').classList.add('hidden');
    document.getElementById('btn-add-item-dom').disabled = true;

    this.renderItemsManual();
  },

  renderItemsManual() {
    const cont = document.getElementById('dom-lista-items');
    if (!cont) return;

    if (this.itemsManual.length === 0) {
      cont.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-2">Sin productos agregados (Opcional)</p>`;
      return;
    }

    cont.innerHTML = this.itemsManual.map((it, idx) => `
      <div class="py-1.5 flex justify-between items-center text-xs">
        <div>
          <p class="font-medium text-slate-800">${escapeHtml(it.nombre)}</p>
          <p class="text-[10px] text-slate-400">SKU ${escapeHtml(it.sku)}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-700">x${it.cantidad}</span>
          <button onclick="ModuloDomicilios.quitarItemManual(${idx})" class="text-rose-500 font-bold px-1">✕</button>
        </div>
      </div>
    `).join('');
  },

  quitarItemManual(index) {
    this.itemsManual.splice(index, 1);
    this.renderItemsManual();
  },

    async guardarPedidoManualInline() {
    const codigo_pedido = document.getElementById('dom-codigo')?.value.trim();
    const cliente_nombre = document.getElementById('dom-cliente')?.value.trim() || 'Cliente General';
    const municipio = document.getElementById('dom-municipio')?.value.trim();
    const direccion = document.getElementById('dom-direccion')?.value.trim();
    const telefono = document.getElementById('dom-telefono')?.value.trim() || '';
    const totalRaw = document.getElementById('dom-total')?.value.trim();
    const observacion = document.getElementById('dom-observaciones')?.value.trim() || '';

    if (!municipio) return alert('El municipio es obligatorio');
    if (!direccion) return alert('La dirección de entrega es obligatoria');

    const total = parseFloat(totalRaw);
    if (isNaN(total) || total <= 0) {
      return alert('Ingresa un valor total válido mayor a 0');
    }

    try {
      const res = await apiFetch('/pedidos/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_pedido,
          cliente_nombre,
          cliente_id: this.clienteSeleccionadoId,
          municipio,
          direccion,
          telefono,
          total,
          observacion,
          items: this.itemsManual,
          tipo_entrega: 'DOMICILIO'
        })
      });

      if (res && res.ok) {
        showToast(`Pedido #${res.pedidoId} creado exitosamente`);
        this.toggleFormularioNuevoPedido(false);
        await this.cargarTabActual();
      } else {
        alert((res && res.error) || 'Error al guardar el pedido');
      }
    } catch (e) {
      alert('Error al guardar el pedido manual');
    }
  },

  async abrirModalNuevoDomiciliario() {
    const nombre = prompt('Nombre del nuevo domiciliario:');
    if (!nombre || !nombre.trim()) return;

    const telefono = prompt('Teléfono (opcional):') || '';

    try {
      const res = await apiFetch('/domiciliarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim() })
      });

      if (res && res.ok) {
        showToast('Domiciliario creado con éxito');
        await this.cargarInicial();
      } else {
        alert((res && res.error) || 'Error al crear repartidor');
      }
    } catch (e) {
      alert('Error al conectar con el servidor');
    }
  },

  cambiarSubTab(tab) {
    this.tabActiva = tab;
    const btnD = document.getElementById('subtab-despachar');
    const btnR = document.getElementById('subtab-rutas');
    const btnC = document.getElementById('subtab-cuadre');

    const activo = "py-2 rounded-md bg-white text-slate-900 shadow-sm font-bold";
    const inactivo = "py-2 rounded-md text-slate-600 font-normal";

    btnD.className = tab === 'despachar' ? activo : inactivo;
    btnR.className = tab === 'rutas' ? activo : inactivo;
    btnC.className = tab === 'cuadre' ? activo : inactivo;

    this.cargarTabActual();
  },

  async cargarInicial() {
    try {
      const res = await apiFetch('/domiciliarios');
      this.domiciliarios = res.domiciliarios || [];
      if (this.domiciliarios.length === 0) {
        await apiFetch('/domiciliarios', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ nombre: 'Domiciliario Principal' })
        });
        const res2 = await apiFetch('/domiciliarios');
        this.domiciliarios = res2.domiciliarios || [];
      }
    } catch(e) {}
    await this.cargarTabActual();
  },

  async cargarTabActual() {
    if (this.tabActiva === 'despachar') await this.renderTabDespachar();
    else if (this.tabActiva === 'rutas') await this.renderTabRutas();
    else if (this.tabActiva === 'cuadre') await this.renderTabCuadre();
  },

    async renderTabDespachar() {
    const cont = document.getElementById('contenedor-subtab');
    cont.innerHTML = `<p class="text-center text-xs text-slate-400 py-4">Cargando pedidos disponibles...</p>`;

    try {
      const qs = this.fechaFiltro ? `?fecha=${encodeURIComponent(this.fechaFiltro)}` : '';
      const res = await apiFetch('/domicilios/pendientes' + qs);
      if (!res.ok) throw new Error(res.error || 'Error al cargar pedidos');
      this.pedidosPendientes = res.pedidos || [];

      cont.innerHTML = `
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Seleccionar Domiciliario</label>
            <select id="select-domiciliario" class="w-full text-xs p-2 border rounded-md bg-white">
              ${this.domiciliarios.map(d => `<option value="${d.id}">${d.nombre}</option>`).join('')}
            </select>
          </div>

          <div class="border-t pt-2">
            <label class="block text-xs font-bold text-slate-800 mb-2">Pedidos Disponibles para Despacho (Empacados y Directos)</label>
            <div id="lista-check-pedidos" class="space-y-2 max-h-72 overflow-y-auto border p-2 rounded-md bg-slate-50">
              ${this.pedidosPendientes.length === 0 ? `<p class="text-xs text-slate-400 text-center py-3">No hay pedidos pendientes${this.fechaFiltro ? ' para la fecha seleccionada' : ''}</p>` : ''}
              ${this.pedidosPendientes.map(p => {
                const total = Number(p.total) || 0;
                const pagaCon = this.pagaConSugerido(total);      // ej. 37400 → 50000
                const devuelta = Math.max(0, pagaCon - total);    // 12600
                return `
                <div class="bg-white p-2.5 rounded border space-y-1.5" data-pedido-card="${p.id}">
                  <label class="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="checkbox" value="${p.id}"
                           data-total="${total}"
                           data-paga-con="${pagaCon}"
                           data-devuelta="${devuelta}"
                           class="chk-pedido mt-0.5"
                           onchange="ModuloDomicilios.calcularBaseEfectivo()">
                    <div class="flex-1 min-w-0">
                      <div class="flex justify-between gap-2">
                        <span class="font-bold text-slate-900">${p.codigo_pedido ? p.codigo_pedido : 'Pedido #' + p.id}</span>
                        <span class="font-semibold text-emerald-600 whitespace-nowrap">$${total.toLocaleString('es-CO')}</span>
                      </div>
                      <p class="text-slate-500">${p.cliente || p.cliente_nombre || 'Cliente General'} | ${p.direccion || 'Sin Dirección'}</p>
                      ${p.observacion || p.observacion_liquidacion ? `<p class="text-[10px] text-amber-700 font-medium italic">Nota: ${p.observacion || p.observacion_liquidacion}</p>` : ''}
                    </div>
                  </label>

                  <div class="pl-5 space-y-1 text-[11px]">
                    <!-- Lectura -->
                    <div id="pago-view-${p.id}" class="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span class="text-slate-600">
                        Paga con:
                        <b id="paga-txt-${p.id}" class="text-slate-900">$${pagaCon.toLocaleString('es-CO')}</b>
                      </span>
                      <button type="button" onclick="ModuloDomicilios.editarPagaCon(${p.id})"
                              class="px-1.5 py-0.5 rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
                              title="Cambiar con cuánto paga">✏️</button>
                      <span class="text-amber-800">
                        Devuelta:
                        <b id="dev-txt-${p.id}">$${devuelta.toLocaleString('es-CO')}</b>
                      </span>
                      <span class="text-emerald-800 font-semibold">
                        A entregar:
                        <b id="ent-txt-${p.id}">$${pagaCon.toLocaleString('es-CO')}</b>
                      </span>
                      <select class="sel-metodo-despacho border rounded px-1.5 py-0.5 bg-slate-50 text-[11px] ml-auto"
                              data-id="${p.id}" onchange="ModuloDomicilios.calcularBaseEfectivo()">
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="TRANSFERENCIA">Transferencia</option>
                      </select>
                    </div>

                    <!-- Edición: solo "paga con" -->
                    <div id="pago-edit-${p.id}" class="hidden flex flex-wrap items-center gap-1.5">
                      <span class="text-slate-600 font-medium">Cliente paga con $</span>
                      <input type="number" id="paga-input-${p.id}" min="0" step="1000" value="${pagaCon}"
                             class="w-28 border border-amber-300 rounded px-1.5 py-0.5 text-[11px] font-bold" />
                      <button type="button" onclick="ModuloDomicilios.guardarPagaCon(${p.id})"
                              class="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">OK</button>
                      <button type="button" onclick="ModuloDomicilios.cancelarPagaCon(${p.id})"
                              class="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">✕</button>
                      <button type="button" onclick="ModuloDomicilios.restaurarPagaConSugerido(${p.id})"
                              class="px-2 py-0.5 rounded border border-amber-300 text-amber-900 text-[10px] font-bold">$50.000</button>
                    </div>
                  </div>
                </div>
              `}).join('')}
            </div>
          </div>

          <!-- Resumen simple (sin editar la base a mano) -->
          <div class="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs space-y-1.5">
            <div class="flex justify-between text-slate-600">
              <span>Base de cambio (suma de devueltas):</span>
              <b id="txt-base-cambio" class="text-amber-900">$0</b>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Total a entregar (lo que pagan):</span>
              <b id="txt-total-entregar" class="text-emerald-800">$0</b>
            </div>
            <p class="text-[10px] text-slate-400">
              Por defecto paga con múltiplos de $50.000. Con el ✏️ cambias “paga con”; la devuelta se calcula sola.
            </p>
          </div>

          <button onclick="ModuloDomicilios.despacharRuta()" class="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-md hover:bg-slate-800">
            🚚 Despachar Ruta
          </button>
        </div>
      `;
    } catch (err) {
      cont.innerHTML = `<p class="text-xs text-rose-500 text-center py-4">Error: ${err.message}</p>`;
    }
  },

  // Fecha de hoy en horario LOCAL del dispositivo (no UTC), formato YYYY-MM-DD,
  // para que el filtro por defecto coincida con "hoy" para quien usa la app.
  fechaHoyLocal() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  cambiarFecha(valor) {
    this.fechaFiltro = valor || ''; // '' = ver todos, sin filtrar por fecha

    // Refresca el input y el resaltado de los botones "Hoy"/"Todos" sin
    // volver a dibujar todo el encabezado (evita perder el estado del formulario abierto).
    const input = document.getElementById('input-fecha-dom');
    if (input) input.value = this.fechaFiltro;

    const activo = 'text-[10px] px-2 py-1 rounded-md font-semibold bg-slate-900 text-white';
    const inactivo = 'text-[10px] px-2 py-1 rounded-md font-semibold bg-slate-100 text-slate-600';
    const btnHoy = document.getElementById('btn-fecha-hoy');
    const btnTodos = document.getElementById('btn-fecha-todos');
    if (btnHoy) btnHoy.className = this.fechaFiltro === this.fechaHoyLocal() ? activo : inactivo;
    if (btnTodos) btnTodos.className = !this.fechaFiltro ? activo : inactivo;

    this.cargarTabActual(); // refresca la pestaña que este activa (Despachar, En Curso o Cuadre)
  },

    /** Múltiplo de $50.000 hacia arriba (si es exacto, paga igual al total). */
  pagaConSugerido(totalPedido) {
    const BILLETE = 50000;
    const t = Number(totalPedido) || 0;
    if (t <= 0) return 0;
    return Math.ceil(t / BILLETE) * BILLETE;
  },

  devueltaPorPedido(totalPedido) {
    const t = Number(totalPedido) || 0;
    return Math.max(0, this.pagaConSugerido(t) - t);
  },

  editarPagaCon(pedidoId) {
    document.getElementById(`pago-view-${pedidoId}`)?.classList.add('hidden');
    const box = document.getElementById(`pago-edit-${pedidoId}`);
    if (box) {
      box.classList.remove('hidden');
      box.classList.add('flex');
    }
    const inp = document.getElementById(`paga-input-${pedidoId}`);
    if (inp) { inp.focus(); inp.select(); }
  },

  guardarPagaCon(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    if (!chk) return;

    const total = parseFloat(chk.dataset.total) || 0;
    let pagaCon = parseFloat(document.getElementById(`paga-input-${pedidoId}`)?.value);

    if (isNaN(pagaCon) || pagaCon < 0) {
      return alert('Ingresa con cuánto paga el cliente (ej. 40000 o 100000)');
    }
    if (pagaCon < total) {
      return alert(`"Paga con" no puede ser menor al total del pedido ($${total.toLocaleString('es-CO')})`);
    }
    pagaCon = Math.round(pagaCon);
    const devuelta = Math.max(0, pagaCon - total);

    chk.dataset.pagaCon = String(pagaCon);
    chk.dataset.devuelta = String(devuelta);

    const fmt = (n) => `$${n.toLocaleString('es-CO')}`;
    const elPaga = document.getElementById(`paga-txt-${pedidoId}`);
    const elDev = document.getElementById(`dev-txt-${pedidoId}`);
    const elEnt = document.getElementById(`ent-txt-${pedidoId}`);
    if (elPaga) elPaga.innerText = fmt(pagaCon);
    if (elDev) elDev.innerText = fmt(devuelta);
    if (elEnt) elEnt.innerText = fmt(pagaCon);

    document.getElementById(`pago-edit-${pedidoId}`)?.classList.add('hidden');
    document.getElementById(`pago-edit-${pedidoId}`)?.classList.remove('flex');
    document.getElementById(`pago-view-${pedidoId}`)?.classList.remove('hidden');

    this.calcularBaseEfectivo();
  },

  cancelarPagaCon(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    const actual = parseFloat(chk?.dataset?.pagaCon) || 0;
    const inp = document.getElementById(`paga-input-${pedidoId}`);
    if (inp) inp.value = String(actual);

    document.getElementById(`pago-edit-${pedidoId}`)?.classList.add('hidden');
    document.getElementById(`pago-edit-${pedidoId}`)?.classList.remove('flex');
    document.getElementById(`pago-view-${pedidoId}`)?.classList.remove('hidden');
  },

  restaurarPagaConSugerido(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    if (!chk) return;
    const total = parseFloat(chk.dataset.total) || 0;
    const pagaCon = this.pagaConSugerido(total);
    const inp = document.getElementById(`paga-input-${pedidoId}`);
    if (inp) inp.value = String(pagaCon);
    this.guardarPagaCon(pedidoId);
  },

  /**
   * Solo pedidos marcados en Efectivo.
   * Base de cambio = suma de devueltas.
   * Total a entregar = suma de "paga con".
   */
  calcularBaseEfectivo() {
    const checkboxes = document.querySelectorAll('.chk-pedido:checked');
    let baseCambio = 0;
    let totalEntregar = 0;

    checkboxes.forEach(chk => {
      const pid = chk.value;
      const sel = document.querySelector(`.sel-metodo-despacho[data-id="${pid}"]`);
      const metodo = sel ? sel.value : 'EFECTIVO';
      if (metodo !== 'EFECTIVO') return;

      const total = parseFloat(chk.dataset.total) || 0;
      let pagaCon = parseFloat(chk.dataset.pagaCon);
      if (isNaN(pagaCon)) pagaCon = this.pagaConSugerido(total);
      let devuelta = parseFloat(chk.dataset.devuelta);
      if (isNaN(devuelta)) devuelta = Math.max(0, pagaCon - total);

      baseCambio += devuelta;
      totalEntregar += pagaCon;
    });

    const elBase = document.getElementById('txt-base-cambio');
    const elEnt = document.getElementById('txt-total-entregar');
    if (elBase) elBase.innerText = `$${baseCambio.toLocaleString('es-CO')}`;
    if (elEnt) elEnt.innerText = `$${totalEntregar.toLocaleString('es-CO')}`;

    return baseCambio; // se usa como baseEfectivo al despachar
  },

  async despacharRuta() {
    const domId = document.getElementById('select-domiciliario')?.value;
    const chks = Array.from(document.querySelectorAll('.chk-pedido:checked'))
      .map(c => parseInt(c.value, 10));

    if (!chks.length) return alert('Selecciona al menos un pedido');

    const base = this.calcularBaseEfectivo(); // suma de devueltas (cambio a llevar)

    try {
      const res = await apiFetch('/rutas/despachar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domiciliarioId: domId,
          pedidoIds: chks,
          baseEfectivo: base
        })
      });

      if (res && res.ok) {
        showToast('Ruta despachada exitosamente');
        this.cambiarSubTab('rutas');
      } else {
        alert((res && res.error) || 'No se pudo despachar');
      }
    } catch (e) {
      alert('Error al despachar ruta');
    }
  },

    async renderTabRutas() {
    const cont = document.getElementById('contenedor-subtab');
    cont.innerHTML = `<p class="text-center text-xs text-slate-400 py-4">Cargando rutas...</p>`;

    try {
      const qsLiquidadas = this.fechaFiltro ? `&fecha=${encodeURIComponent(this.fechaFiltro)}` : '';
      const [resActivas, resLiquidadas] = await Promise.all([
        apiFetch('/rutas?estado=EN_RUTA'), // las rutas activas se ven siempre, sin importar la fecha
        apiFetch('/rutas?estado=LIQUIDADA' + qsLiquidadas)
      ]);

      const activas = resActivas.rutas || [];
      const liquidadas = resLiquidadas.rutas || [];

      cont.innerHTML = `
        <div class="space-y-4">
          <div>
            <p class="text-xs font-bold text-slate-800 mb-2">🚚 Rutas en calle</p>
            ${activas.length === 0
              ? `<p class="text-center text-xs text-slate-400 py-4">No hay rutas activas.</p>`
              : activas.map(r => `
                <div class="border p-3 rounded-lg bg-slate-50 space-y-2 mb-2">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-sm text-slate-900">Ruta #${r.id} - ${r.domiciliario_nombre}</span>
                    <span class="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">En calle</span>
                  </div>
                  <div class="text-xs text-slate-600 flex justify-between">
                    <span>Pedidos: <strong>${r.cantidad_pedidos}</strong></span>
                    <span>Total: <strong>$${(r.total_dinero||0).toLocaleString()}</strong></span>
                  </div>
                  <button onclick="ModuloDomicilios.seleccionarRutaCuadre(${r.id})"
                    class="w-full py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700">
                    📦 Gestionar entregas / Liquidar
                  </button>
                </div>
              `).join('')}
          </div>

          <div>
            <p class="text-xs font-bold text-slate-800 mb-2">✅ Rutas liquidadas</p>
            ${liquidadas.length === 0
              ? `<p class="text-center text-xs text-slate-400 py-3">Aún no hay rutas liquidadas${this.fechaFiltro ? ' para la fecha seleccionada' : ''}.</p>`
              : liquidadas.slice(0, 15).map(r => `
                <div class="border p-3 rounded-lg bg-white space-y-1 mb-2 opacity-90">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-sm text-slate-800">Ruta #${r.id} - ${r.domiciliario_nombre}</span>
                    <span class="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">Liquidada</span>
                  </div>
                  <div class="text-xs text-slate-600 flex justify-between">
                    <span>Pedidos: <strong>${r.cantidad_pedidos}</strong></span>
                    <span>Recolectado: <strong>$${(r.total_recolectado||r.total_dinero||0).toLocaleString()}</strong></span>
                  </div>
                  <button onclick="ModuloDomicilios.seleccionarRutaCuadre(${r.id})"
                    class="w-full py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded">
                    👁️ Ver detalle
                  </button>
                </div>
              `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      cont.innerHTML = `<p class="text-xs text-rose-500 text-center py-4">Error: ${err.message}</p>`;
    }
  },

  seleccionarRutaCuadre(rutaId) {
    this.rutaSeleccionadaId = rutaId;
    this.cambiarSubTab('cuadre');
  },

    async renderTabCuadre() {
    const cont = document.getElementById('contenedor-subtab');

    if (!this.rutaSeleccionadaId) {
      cont.innerHTML = `<p class="text-center text-xs text-slate-400 py-6">Selecciona una ruta desde "En Curso".</p>`;
      return;
    }

    cont.innerHTML = `<p class="text-center text-xs text-slate-400 py-4">Cargando pedidos de la ruta...</p>`;

    try {
      const res = await apiFetch(`/rutas/${this.rutaSeleccionadaId}`);
      if (!res.ok) throw new Error(res.error || 'Error al cargar ruta');

      const { ruta, pedidos } = res;
      this._cuadrePedidos = pedidos || [];
      this._cuadreRuta = ruta;
      const yaLiquidada = ruta.estado === 'LIQUIDADA';

      // Agrupar por municipio
      const porMunicipio = {};
      (pedidos || []).forEach(p => {
        const mun = (p.municipio || 'Sin municipio').trim() || 'Sin municipio';
        if (!porMunicipio[mun]) porMunicipio[mun] = [];
        porMunicipio[mun].push(p);
      });
      const municipios = Object.keys(porMunicipio);

      const entregados = (pedidos || []).filter(p => p.estado_entrega === 'ENTREGADO').length;
      const totalPedidos = (pedidos || []).length;

      cont.innerHTML = `
        <div class="space-y-4">
          <div class="bg-slate-100 p-2.5 rounded-md text-xs space-y-1">
            <div class="flex justify-between items-center">
              <span class="font-bold text-slate-800">Ruta #${ruta.id} - ${ruta.domiciliario_nombre}</span>
              <span class="text-xs px-2 py-0.5 rounded font-semibold ${yaLiquidada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                ${yaLiquidada ? 'Liquidada' : 'En calle'}
              </span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Base devueltas: $${(ruta.base_efectivo||0).toLocaleString()}</span>
              <span>Entregados: <b>${entregados}/${totalPedidos}</b></span>
            </div>
          </div>

          <div class="space-y-3" id="lista-municipios-cuadre">
            ${municipios.map(mun => {
              const lista = porMunicipio[mun];
              return `
              <div class="border rounded-lg overflow-hidden" data-municipio="${mun}">
                <div class="bg-indigo-50 px-3 py-2 border-b">
                  <p class="text-xs font-bold text-indigo-900">📍 ${mun}</p>
                  <p class="text-[10px] text-indigo-700">${lista.length} pedido(s)</p>
                </div>
                <div class="p-2 space-y-2 bg-white">
                                      ${lista.map(p => {
                    const entregado = p.estado_entrega === 'ENTREGADO';
                                        const totalPedido = Number(p.total) || 0;
                    const totalOriginal = Number(p.total_original) > 0
                      ? Number(p.total_original)
                      : totalPedido;
                    const metodoActual = p.metodo_pago_final || 'EFECTIVO';
                    const motivoAjuste = (p.observacion || '').trim();

                    const BILLETE = 50000;
                    const pagaCon = totalOriginal > 0
                      ? Math.ceil(totalOriginal / BILLETE) * BILLETE
                      : 0;
                    const devueltaCalculada = Math.max(0, pagaCon - totalOriginal);

                    // Solo usa el valor guardado si es > 0.
                    // Si en BD quedó 0 (default), calcula con múltiplos de 50.000.
                    const storedDev = Number(p.devuelta_calculada);
                    const devueltaEntregada =
                      (!isNaN(storedDev) && storedDev > 0)
                        ? storedDev
                        : devueltaCalculada;

                    const esTransfer = metodoActual === 'TRANSFERENCIA'
                      || metodoActual === 'TRANSFERENCIA_PENDIENTE';
                    const aCaja = esTransfer ? devueltaEntregada : totalPedido;
                    const delta = totalPedido - totalOriginal;
                    const formulaTxt = delta === 0
                      ? `$${totalPedido.toLocaleString('es-CO')}`
                      : `$${totalOriginal.toLocaleString('es-CO')} ${delta > 0 ? '+' : ''}${delta.toLocaleString('es-CO')}${motivoAjuste ? ' [' + motivoAjuste.replace(/"/g, '') + ']' : ''} = $${totalPedido.toLocaleString('es-CO')}`;

                    return `
                    <div class="border p-2.5 rounded-md space-y-2 ${entregado ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}"
                         id="item-pedido-${p.id}"
                         data-total-original="${totalOriginal}"
                         data-devuelta="${devueltaEntregada}">

                      <!-- Encabezado siempre visible -->
                      <div class="flex justify-between items-start gap-2">
                        <div class="min-w-0">
                          <p class="font-bold text-xs text-slate-900">${p.codigo_pedido || ('Pedido #' + p.id)}</p>
                          <p class="text-[10px] text-slate-500">${p.cliente || 'Cliente'} · ${p.direccion || ''}</p>
                        </div>
                        ${entregado
                          ? `<span class="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold">Entregado</span>`
                          : `<span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Pendiente</span>`}
                      </div>

                      ${entregado ? `
                      <!-- VISTA COLAPSADA (entregado) -->
                      <div id="resumen-${p.id}" class="text-[11px] space-y-0.5">
                        <p class="text-slate-700"><span class="text-slate-500">Valor:</span> <b>${formulaTxt}</b></p>
                        <p class="text-amber-800">Devuelta entregada: <b>$${devueltaEntregada.toLocaleString('es-CO')}</b></p>
                        <p class="text-emerald-800 font-semibold">A entregar en caja: <b>$${aCaja.toLocaleString('es-CO')}</b>
                          ${esTransfer ? '<span class="text-[10px] font-normal text-slate-500">(solo devuelta · transferencia)</span>' : ''}
                        </p>
                        <button type="button" onclick="ModuloDomicilios.toggleDetallePedido(${p.id})"
                                class="text-[10px] text-indigo-600 font-semibold mt-1">▶ Ver más detalles</button>
                      </div>
                      <div id="detalle-${p.id}" class="hidden space-y-2">
                      ` : `<div id="detalle-${p.id}" class="space-y-2">`}

                        <!-- Valor + botones + / − -->
                        <div class="text-xs">
                          <label class="block text-[10px] text-slate-500 mb-0.5">Valor a cobrar ($)</label>
                          <div class="flex items-center gap-1">
                            <span id="total-txt-${p.id}" class="flex-1 p-1.5 border rounded font-bold text-emerald-700 bg-slate-50 text-sm">
                              $${totalPedido.toLocaleString('es-CO')}
                            </span>
                            <input type="hidden" class="inp-total" data-id="${p.id}" value="${totalPedido}">
                            ${!yaLiquidada ? `
                            <button type="button" onclick="ModuloDomicilios.abrirAjuste(${p.id}, 1)"
                                    class="w-8 h-8 rounded-md bg-emerald-600 text-white font-bold text-sm">+</button>
                            <button type="button" onclick="ModuloDomicilios.abrirAjuste(${p.id}, -1)"
                                    class="w-8 h-8 rounded-md bg-rose-500 text-white font-bold text-sm">−</button>
                            ` : ''}
                          </div>
                          ${delta !== 0 ? `<p class="text-[10px] text-slate-600 mt-0.5">${formulaTxt}</p>` : ''}
                          ${motivoAjuste ? `<p class="text-[10px] text-amber-800 italic mt-0.5" id="motivo-txt-${p.id}">📝 ${motivoAjuste.replace(/</g,'')}</p>` : `<p class="hidden text-[10px] text-amber-800 italic mt-0.5" id="motivo-txt-${p.id}"></p>`}

                          <!-- Panel ajuste -->
                          <div id="panel-ajuste-${p.id}" class="hidden mt-1.5 p-2 rounded border border-amber-200 bg-amber-50 space-y-1.5">
                            <p class="text-[10px] font-medium text-amber-900">
                              Ajuste: <span id="signo-ajuste-${p.id}">+</span>
                              <input type="number" id="monto-ajuste-${p.id}" min="0" step="100" placeholder="2500"
                                     class="w-24 border border-amber-300 rounded px-1.5 py-0.5 text-xs font-bold ml-1" />
                            </p>
                            <textarea id="motivo-ajuste-${p.id}" rows="2"
                              placeholder="Motivo: faltó producto / cliente devolvió vasos..."
                              class="w-full border border-amber-300 rounded px-2 py-1 text-[11px]"></textarea>
                            <div class="flex gap-1">
                              <button type="button" onclick="ModuloDomicilios.guardarAjuste(${p.id})"
                                      class="flex-1 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold">Guardar</button>
                              <button type="button" onclick="ModuloDomicilios.cancelarAjuste(${p.id})"
                                      class="px-2 py-1 rounded bg-slate-200 text-[10px] font-bold">✕</button>
                            </div>
                          </div>
                        </div>

                        <!-- Método de pago -->
                        <div class="text-xs">
                          <label class="block text-[10px] text-slate-500">Método de pago</label>
                          <select class="sel-metodo w-full p-1.5 border rounded bg-slate-50"
                            data-id="${p.id}"
                            data-total="${totalPedido}"
                            data-devuelta="${devueltaEntregada}"
                            ${yaLiquidada ? 'disabled' : ''}
                            onchange="ModuloDomicilios.guardarCambioPedido(${p.id})">
                            <option value="EFECTIVO" ${metodoActual === 'EFECTIVO' ? 'selected' : ''}>Efectivo</option>
                            <option value="TRANSFERENCIA" ${metodoActual === 'TRANSFERENCIA' ? 'selected' : ''}>Transferencia (ya hecha)</option>
                            <option value="TRANSFERENCIA_PENDIENTE" ${metodoActual === 'TRANSFERENCIA_PENDIENTE' ? 'selected' : ''}>Transferencia pendiente</option>
                          </select>
                        </div>

                        <!-- Comprobante SOLO si transferencia ya hecha (no pendiente) -->
                        <div class="box-comprobante ${metodoActual === 'TRANSFERENCIA' ? '' : 'hidden'}" id="box-comp-${p.id}">
                          <label class="block text-[10px] text-slate-500"># Comprobante</label>
                          <input type="text" class="inp-comp w-full p-1 border rounded text-xs"
                            data-id="${p.id}" value="${p.comprobante_transf || ''}"
                            ${yaLiquidada ? 'readonly' : ''}
                            onchange="ModuloDomicilios.guardarCambioPedido(${p.id})"
                            placeholder="Número de transferencia">
                        </div>

                        <!-- Cifras de caja / devuelta -->
                        <div class="bg-slate-50 border rounded p-2 text-[11px] space-y-0.5">
                          <div class="flex justify-between text-amber-900">
                            <span>Devuelta entregada (base):</span>
                            <b id="dev-line-${p.id}">$${devueltaEntregada.toLocaleString('es-CO')}</b>
                          </div>
                          <div class="flex justify-between text-emerald-800">
                            <span>A entregar en caja:</span>
                            <b id="caja-line-${p.id}">$${aCaja.toLocaleString('es-CO')}</b>
                          </div>
                          <p class="text-[10px] text-slate-400" id="caja-hint-${p.id}">
                            ${esTransfer ? 'Transferencia: en caja solo regresa la devuelta de la base.' : 'Efectivo: en caja el valor cobrado del pedido.'}
                          </p>
                        </div>

                        ${!yaLiquidada ? `
                        <div class="flex gap-2">
                          <button type="button"
                            onclick="ModuloDomicilios.confirmarEntrega(${p.id}, true)"
                            class="flex-1 py-1.5 rounded text-[11px] font-semibold ${entregado ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}">
                            ${entregado ? '✓ Entregado' : '✓ Marcar entregado'}
                          </button>
                          <button type="button"
                            onclick="ModuloDomicilios.confirmarEntrega(${p.id}, false)"
                            class="px-2 py-1.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-700">
                            ↩ Pendiente
                          </button>
                        </div>
                        ` : ''}

                      ${entregado ? `
                        <button type="button" onclick="ModuloDomicilios.toggleDetallePedido(${p.id})"
                                class="text-[10px] text-indigo-600 font-semibold">▼ Ocultar detalles</button>
                      </div>` : `</div>`}
                    </div>
                  `}).join('')}
                </div>
              </div>
            `}).join('')}
          </div>

          <div class="bg-slate-900 text-white p-3 rounded-lg text-xs space-y-1.5">
            <div class="flex justify-between text-slate-300">
              <span>(+) Efectivo recolectado:</span>
              <span id="arq-efectivo" class="font-semibold">$0</span>
            </div>
            <div class="flex justify-between text-slate-300">
              <span>(+) Base devueltas:</span>
              <span id="arq-base" data-valor="${Number(ruta.base_efectivo||0)}" class="font-semibold">$${(ruta.base_efectivo||0).toLocaleString()}</span>
            </div>
            <div class="flex justify-between font-bold text-emerald-400 border-t border-slate-700 pt-1 text-sm">
              <span>(=) Total a entregar en caja:</span>
              <span id="arq-total" data-valor="0">$0</span>
            </div>
          </div>

          ${!yaLiquidada ? `
          <button onclick="ModuloDomicilios.cerrarYLiquidarRuta(${ruta.id})"
            class="w-full py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-md hover:bg-emerald-700">
            ✅ Cerrar y Liquidar Ruta Completa
          </button>
          <p class="text-[10px] text-center text-slate-400">Puedes ir marcando entregas y ajustando valores. Liquida solo al final.</p>
          ` : `
          <p class="text-xs text-center text-emerald-700 font-semibold py-2">Esta ruta ya fue liquidada.</p>
          `}
        </div>
      `;

      this.recalcularArqueo();
    } catch (err) {
      cont.innerHTML = `<p class="text-xs text-rose-500 text-center py-4">Error: ${err.message}</p>`;
    }
  },

  abrirEdicionTotal(pedidoId) {
  const box = document.getElementById(`edit-total-${pedidoId}`);
  if (box) box.classList.remove('hidden');
  const inp = document.getElementById(`ajuste-input-${pedidoId}`);
  if (inp) { inp.value = ''; inp.focus(); }
},

cancelarEdicionTotal(pedidoId) {
  document.getElementById(`edit-total-${pedidoId}`)?.classList.add('hidden');
},

async guardarAjusteTotal(pedidoId) {
  const inpTotal = document.querySelector(`.inp-total[data-id="${pedidoId}"]`);
  const sel = document.querySelector(`.sel-metodo[data-id="${pedidoId}"]`);
  const actual = parseFloat(inpTotal?.value) || 0;

  const rawAjuste = (document.getElementById(`ajuste-input-${pedidoId}`)?.value || '').trim();
  const motivo = (document.getElementById(`motivo-input-${pedidoId}`)?.value || '').trim();

  if (!rawAjuste) return alert('Indica el ajuste. Ej: -2300 o 1500');
  const ajuste = parseFloat(rawAjuste);
  if (isNaN(ajuste) || ajuste === 0) return alert('Ajuste inválido. Usa + o − (ej. -2300)');

  if (!motivo) return alert('Escribe el motivo del cambio (ej. cliente devolvió vasos)');

  const nuevoTotal = Math.max(0, Math.round(actual + ajuste));
  const signo = ajuste > 0 ? '+' : '';
  const textoMotivo = `Ajuste ${signo}${ajuste.toLocaleString('es-CO')}: ${motivo}`;

  if (inpTotal) inpTotal.value = String(nuevoTotal);
  if (sel) sel.dataset.total = String(nuevoTotal);

  const txt = document.getElementById(`total-txt-${pedidoId}`);
  if (txt) txt.innerText = `$${nuevoTotal.toLocaleString('es-CO')}`;

  const motivoEl = document.getElementById(`motivo-txt-${pedidoId}`);
  if (motivoEl) {
    motivoEl.textContent = '📝 ' + textoMotivo;
    motivoEl.classList.remove('hidden');
    motivoEl.className = 'text-[10px] text-amber-800 mt-0.5 italic';
  }

  document.getElementById(`edit-total-${pedidoId}`)?.classList.add('hidden');

  try {
    const metodoPago = sel?.value || 'EFECTIVO';
    const inpComp = document.querySelector(`.inp-comp[data-id="${pedidoId}"]`);
    const comprobante = inpComp?.value?.trim() || '';

    await apiFetch(`/rutas/pedido/${pedidoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total: nuevoTotal,
        metodoPago,
        comprobante,
        observacion: textoMotivo
      })
    });
    this.recalcularArqueo();
    showToast(`Total actualizado: $${nuevoTotal.toLocaleString('es-CO')}`);
  } catch (e) {
    alert('No se pudo guardar el ajuste');
  }
},

      toggleDetallePedido(pedidoId) {
    const det = document.getElementById(`detalle-${pedidoId}`);
    const res = document.getElementById(`resumen-${pedidoId}`);
    if (!det) return;
    const abierto = !det.classList.contains('hidden');
    if (abierto) {
      det.classList.add('hidden');
      if (res) res.classList.remove('hidden');
    } else {
      det.classList.remove('hidden');
      // el resumen puede quedarse visible arriba; opcional ocultarlo:
      // if (res) res.classList.add('hidden');
    }
  },

  abrirAjuste(pedidoId, signo) {
    // signo: 1 = sumar, -1 = restar
    const panel = document.getElementById(`panel-ajuste-${pedidoId}`);
    const sp = document.getElementById(`signo-ajuste-${pedidoId}`);
    if (panel) panel.classList.remove('hidden');
    if (sp) {
      sp.textContent = signo >= 0 ? '+' : '−';
      sp.dataset.signo = String(signo >= 0 ? 1 : -1);
    }
    const inp = document.getElementById(`monto-ajuste-${pedidoId}`);
    if (inp) { inp.value = ''; inp.focus(); }
    const mot = document.getElementById(`motivo-ajuste-${pedidoId}`);
    if (mot) mot.value = '';
  },

  cancelarAjuste(pedidoId) {
    document.getElementById(`panel-ajuste-${pedidoId}`)?.classList.add('hidden');
  },

  async guardarAjuste(pedidoId) {
    const inpTotal = document.querySelector(`.inp-total[data-id="${pedidoId}"]`);
    const sel = document.querySelector(`.sel-metodo[data-id="${pedidoId}"]`);
    const card = document.getElementById(`item-pedido-${pedidoId}`);
    const actual = parseFloat(inpTotal?.value) || 0;
    const totalOriginal = parseFloat(card?.dataset?.totalOriginal) || actual;

    const sp = document.getElementById(`signo-ajuste-${pedidoId}`);
    const signo = parseInt(sp?.dataset?.signo || '1', 10);
    const monto = parseFloat(document.getElementById(`monto-ajuste-${pedidoId}`)?.value);
    const motivo = (document.getElementById(`motivo-ajuste-${pedidoId}`)?.value || '').trim();

    if (isNaN(monto) || monto <= 0) return alert('Indica el monto del ajuste (ej. 2500)');
    if (!motivo) return alert('Escribe el motivo (ej. cliente devolvió vasos)');

    const ajuste = signo * monto;
    const nuevoTotal = Math.max(0, Math.round(actual + ajuste));
    const signoTxt = ajuste > 0 ? '+' : '';
    // Acumula motivos sin borrar los anteriores
    const prevObs = (document.getElementById(`motivo-txt-${pedidoId}`)?.textContent || '')
      .replace(/^📝\s*/, '').trim();
    const linea = `${signoTxt}${ajuste.toLocaleString('es-CO')}: ${motivo}`;
    const observacion = prevObs ? `${prevObs} | ${linea}` : linea;

    if (inpTotal) inpTotal.value = String(nuevoTotal);
    if (sel) sel.dataset.total = String(nuevoTotal);

    const txt = document.getElementById(`total-txt-${pedidoId}`);
    if (txt) txt.innerText = `$${nuevoTotal.toLocaleString('es-CO')}`;

    const motivoEl = document.getElementById(`motivo-txt-${pedidoId}`);
    if (motivoEl) {
      motivoEl.textContent = '📝 ' + observacion;
      motivoEl.classList.remove('hidden');
    }

    document.getElementById(`panel-ajuste-${pedidoId}`)?.classList.add('hidden');

    // Actualiza línea "a caja" en pantalla
    this._actualizarLineaCaja(pedidoId);

    try {
      const metodoPago = sel?.value || 'EFECTIVO';
      // No tocar comprobante ni borrar observación previa en servidor
      await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total: nuevoTotal,
          metodoPago,
          observacion,
          total_original: totalOriginal
        })
      });
      this.recalcularArqueo();
      showToast(`Total: $${nuevoTotal.toLocaleString('es-CO')}`);
    } catch (e) {
      alert('No se pudo guardar el ajuste');
    }
  },

  _actualizarLineaCaja(pedidoId) {
    const sel = document.querySelector(`.sel-metodo[data-id="${pedidoId}"]`);
    const card = document.getElementById(`item-pedido-${pedidoId}`);
    const total = parseFloat(document.querySelector(`.inp-total[data-id="${pedidoId}"]`)?.value)
      || parseFloat(sel?.dataset?.total) || 0;
    const devuelta = parseFloat(sel?.dataset?.devuelta)
      || parseFloat(card?.dataset?.devuelta) || 0;
    const metodo = sel?.value || 'EFECTIVO';
    const esTransfer = metodo === 'TRANSFERENCIA' || metodo === 'TRANSFERENCIA_PENDIENTE';
    const aCaja = esTransfer ? devuelta : total;

    const elCaja = document.getElementById(`caja-line-${pedidoId}`);
    const elHint = document.getElementById(`caja-hint-${pedidoId}`);
    if (elCaja) elCaja.innerText = `$${aCaja.toLocaleString('es-CO')}`;
    if (elHint) {
      elHint.textContent = esTransfer
        ? 'Transferencia: en caja solo regresa la devuelta de la base.'
        : 'Efectivo: en caja el valor cobrado del pedido.';
    }
  },

  async guardarCambioPedido(pedidoId) {
    const inpTotal = document.querySelector(`.inp-total[data-id="${pedidoId}"]`);
    const sel = document.querySelector(`.sel-metodo[data-id="${pedidoId}"]`);
    const inpComp = document.querySelector(`.inp-comp[data-id="${pedidoId}"]`);
    const boxComp = document.getElementById(`box-comp-${pedidoId}`);

    let total = parseFloat(inpTotal?.value);
    if (isNaN(total)) total = parseFloat(sel?.dataset?.total) || 0;

    const metodoPago = sel?.value || 'EFECTIVO';
    const comprobante = inpComp?.value?.trim() || '';

    // Comprobante solo si transferencia YA hecha (no pendiente)
    if (boxComp) {
      if (metodoPago === 'TRANSFERENCIA') boxComp.classList.remove('hidden');
      else boxComp.classList.add('hidden');
    }

    if (sel) sel.dataset.total = String(total);
    this._actualizarLineaCaja(pedidoId);

    try {
      // NO enviamos observacion aquí → no se borra en el servidor
      const body = { total, metodoPago };
      if (metodoPago === 'TRANSFERENCIA') body.comprobante = comprobante;
      // TRANSFERENCIA_PENDIENTE: sin exigir ni pisar comprobante

      await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      this.recalcularArqueo();
    } catch (e) {
      console.error(e);
    }
  },

  async confirmarEntrega(pedidoId, entregado) {
    const estadoEntrega = entregado ? 'ENTREGADO' : 'PENDIENTE';
    try {
      // Guarda método/total actuales antes de refrescar
      await this.guardarCambioPedido(pedidoId);

      const res = await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoEntrega })
      });
      if (res && res.ok) {
        showToast(entregado ? 'Pedido marcado como entregado' : 'Pedido vuelto a pendiente');
        await this.renderTabCuadre();
      } else {
        alert(res.error || 'No se pudo actualizar');
      }
    } catch (e) {
      alert('Error al confirmar entrega');
    }
  },

  recalcularArqueo() {
    let totalEfectivoRecolectado = 0;
    let totalDevueltasTransfer = 0;
    const selects = document.querySelectorAll('.sel-metodo');

    selects.forEach(sel => {
      const total = parseFloat(sel.dataset.total) || 0;
      const devuelta = parseFloat(sel.dataset.devuelta) || 0;
      const pid = sel.dataset.id;
      const boxComp = document.getElementById(`box-comp-${pid}`);
      const esTransfer = sel.value === 'TRANSFERENCIA' || sel.value === 'TRANSFERENCIA_PENDIENTE';

      if (esTransfer) {
        // Solo muestra comprobante si es transferencia YA hecha
        if (boxComp) {
          if (sel.value === 'TRANSFERENCIA') boxComp.classList.remove('hidden');
          else boxComp.classList.add('hidden');
        }
        totalDevueltasTransfer += devuelta;
      } else {
        if (boxComp) boxComp.classList.add('hidden');
        totalEfectivoRecolectado += total;
      }
    });

    const elBase = document.getElementById('arq-base');
    const baseRuta = parseFloat(elBase?.dataset?.valor) || 0;

    // Efectivo de pedidos + devueltas de transferencias (vuelven a caja)
    // Nota: la base completa ya está en baseRuta; aquí mostramos cobrado en efectivo.
    const totalEntregar = totalEfectivoRecolectado + baseRuta;

    const elEfectivo = document.getElementById('arq-efectivo');
    const elTotal = document.getElementById('arq-total');
    if (elEfectivo) elEfectivo.innerText = `$${totalEfectivoRecolectado.toLocaleString('es-CO')}`;
    if (elTotal) {
      elTotal.innerText = `$${totalEntregar.toLocaleString('es-CO')}`;
      elTotal.dataset.valor = String(totalEntregar);
    }
    return totalEntregar;
  },

  async cerrarYLiquidarRuta(rutaId) {
    const selects = document.querySelectorAll('.sel-metodo');
    const pedidosLiquidacion = [];

        for (const sel of selects) {
      const pid = parseInt(sel.dataset.id, 10);
      const metodo = sel.value;
      const inpComp = document.querySelector(`.inp-comp[data-id="${pid}"]`);
      const comp = inpComp ? inpComp.value.trim() : '';

      // Solo obliga comprobante si la transferencia YA se hizo
      if (metodo === 'TRANSFERENCIA' && !comp) {
        return alert(`Debes ingresar el número de comprobante para el pedido #${pid}, o elige "Transferencia pendiente".`);
      }
      // TRANSFERENCIA_PENDIENTE: se permite sin comprobante

      pedidosLiquidacion.push({ id: pid, metodoPago: metodo, comprobante: comp });
    }

    const totalEfectivoEntregado = this.recalcularArqueo();

    try {
      const res = await apiFetch('/rutas/liquidar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ rutaId, pedidosLiquidacion, totalEfectivoEntregado })
      });

      if (res && res.ok) {
        showToast('Ruta liquidada exitosamente', 'success');
        this.rutaSeleccionadaId = null;
        this.cambiarSubTab('rutas');
      } else {
        showToast(res.error || 'No se pudo liquidar la ruta', 'error');
      }
    } catch (e) {
      showToast('Error al liquidar la ruta', 'error');
    }
  }
};