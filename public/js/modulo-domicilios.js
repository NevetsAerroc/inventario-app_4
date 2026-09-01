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
                const devuelta = this.calcularDevueltaPedido(total);
                return `
                <div class="bg-white p-2.5 rounded border space-y-1.5">
                  <label class="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="checkbox" value="${p.id}" data-total="${total}" data-devuelta="${devuelta}"
                           class="chk-pedido mt-0.5" onchange="ModuloDomicilios.calcularBaseEfectivo()">
                    <div class="flex-1 min-w-0">
                      <div class="flex justify-between gap-2">
                        <span class="font-bold text-slate-900">${p.codigo_pedido ? p.codigo_pedido : 'Pedido #' + p.id}</span>
                        <span class="font-semibold text-emerald-600 whitespace-nowrap">$${total.toLocaleString()}</span>
                      </div>
                                          <p class="text-slate-500">${p.cliente || p.cliente_nombre || 'Cliente General'} | ${p.direccion || 'Sin Dirección'}</p>
                      ${p.observacion || p.observacion_liquidacion ? `<p class="text-[10px] text-amber-700 font-medium italic">Nota: ${p.observacion || p.observacion_liquidacion}</p>` : ''}
                    </div>
                  </label>

                  <div class="flex items-center justify-between gap-2 pl-5 text-[11px]">
                    <span class="text-amber-800 font-medium">Devuelta sugerida: <b>$${devuelta.toLocaleString()}</b></span>
                    <select class="sel-metodo-despacho border rounded px-1.5 py-0.5 bg-slate-50 text-[11px]"
                            data-id="${p.id}" onchange="ModuloDomicilios.calcularBaseEfectivo()">
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                    </select>
                  </div>
                </div>
              `}).join('')}
            </div>
          </div>

                    <div class="bg-amber-50 p-3 rounded-md border border-amber-200 text-xs space-y-2">
            <div class="flex justify-between items-center font-semibold text-amber-900">
              <span>Base de devueltas (sugerida):</span>
              <span id="txt-base-efectivo">$0</span>
            </div>
            <p class="text-[10px] text-amber-700">
              Por defecto: billetes de $50.000 (devuelta = redondeo hacia arriba − total del pedido).
            </p>

            <!-- Vista normal (solo lectura) -->
            <div id="box-base-readonly" class="flex items-center gap-2">
              <span class="text-[10px] text-amber-800">Base a entregar:</span>
              <span id="txt-base-readonly" class="flex-1 font-bold text-amber-950">$0</span>
              <button type="button" onclick="ModuloDomicilios.activarEdicionBase()"
                      class="px-2 py-1 rounded-md bg-white border border-amber-300 text-[10px] font-bold text-amber-900 hover:bg-amber-100">
                ✏️ Editar
              </button>
            </div>

            <!-- Vista edición (oculta al inicio) -->
            <div id="box-base-edit" class="hidden space-y-1.5">
              <div class="flex items-center gap-2">
                <label class="text-[10px] text-amber-800 whitespace-nowrap">Base manual:</label>
                <input type="number" id="input-base-efectivo" step="1000" min="0" value="0"
                       class="flex-1 border border-amber-300 rounded-md px-2 py-1 text-xs font-bold text-amber-950 bg-white" />
              </div>
              <div class="flex gap-2">
                <button type="button" onclick="ModuloDomicilios.guardarBaseManual()"
                        class="flex-1 px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                  Guardar
                </button>
                <button type="button" onclick="ModuloDomicilios.recalcularBaseSugerida()"
                        class="flex-1 px-2 py-1 rounded-md bg-white border border-amber-300 text-[10px] font-bold text-amber-900">
                  Volver a sugerida
                </button>
              </div>
            </div>
            <p class="text-[10px] text-slate-500">Si darás otra devuelta, pulsa Editar y cambia el valor antes de despachar.</p>
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

  /**
   * Devuelta por pedido con billetes de $50.000 hacia arriba.
   * Ej: $35.000 → paga $50.000 → devuelta $15.000
   * Múltiplo exacto de 50.000 → devuelta $0
   */
  devueltaPorPedido(totalPedido) {
    const BILLETE = 50000;
    const t = Number(totalPedido) || 0;
    if (t <= 0) return 0;
    const pagado = Math.ceil(t / BILLETE) * BILLETE;
    return Math.max(0, pagado - t);
  },

  calcularBaseEfectivo() {
    const checkboxes = document.querySelectorAll('.chk-pedido:checked');
    let totalBaseDevueltas = 0;

    checkboxes.forEach(chk => {
      const totalPedido = parseFloat(chk.dataset.total) || 0;
      totalBaseDevueltas += this.devueltaPorPedido(totalPedido);
    });

    const el = document.getElementById('txt-base-efectivo');
    if (el) el.innerText = `$${totalBaseDevueltas.toLocaleString('es-CO')}`;

    // Si no hay edición manual, sincroniza textos e input
    if (!this._baseManual) {
      const txtRO = document.getElementById('txt-base-readonly');
      if (txtRO) txtRO.innerText = `$${totalBaseDevueltas.toLocaleString('es-CO')}`;
      const inp = document.getElementById('input-base-efectivo');
      if (inp) inp.value = String(totalBaseDevueltas);
    }
    return totalBaseDevueltas;
  },

  activarEdicionBase() {
    const boxRO = document.getElementById('box-base-readonly');
    const boxEd = document.getElementById('box-base-edit');
    if (boxRO) boxRO.classList.add('hidden');
    if (boxEd) boxEd.classList.remove('hidden');
    const inp = document.getElementById('input-base-efectivo');
    if (inp) {
      // precarga la sugerida si está vacío
      if (!inp.value || inp.value === '0') {
        inp.value = String(this.calcularBaseEfectivo());
      }
      inp.focus();
      inp.select();
    }
  },

  guardarBaseManual() {
    const inp = document.getElementById('input-base-efectivo');
    const val = parseFloat(inp?.value);
    if (isNaN(val) || val < 0) {
      return alert('Ingresa un valor de base válido (≥ 0)');
    }
    this._baseManual = true;
    const txtRO = document.getElementById('txt-base-readonly');
    if (txtRO) txtRO.innerText = `$${val.toLocaleString('es-CO')}`;
    const el = document.getElementById('txt-base-efectivo');
    if (el) el.innerText = `$${val.toLocaleString('es-CO')} (editada)`;

    document.getElementById('box-base-edit')?.classList.add('hidden');
    document.getElementById('box-base-readonly')?.classList.remove('hidden');
  },

  recalcularBaseSugerida() {
    this._baseManual = false;
    const sugerida = this.calcularBaseEfectivo();
    const inp = document.getElementById('input-base-efectivo');
    if (inp) inp.value = String(sugerida);
    const txtRO = document.getElementById('txt-base-readonly');
    if (txtRO) txtRO.innerText = `$${sugerida.toLocaleString('es-CO')}`;
    const el = document.getElementById('txt-base-efectivo');
    if (el) el.innerText = `$${sugerida.toLocaleString('es-CO')}`;

    document.getElementById('box-base-edit')?.classList.add('hidden');
    document.getElementById('box-base-readonly')?.classList.remove('hidden');
  },

  async despacharRuta() {
    const domId = document.getElementById('select-domiciliario')?.value;
    const chks = Array.from(document.querySelectorAll('.chk-pedido:checked'))
      .map(c => parseInt(c.value, 10));

    if (!chks.length) return alert('Selecciona al menos un pedido');

    const sugerida = this.calcularBaseEfectivo();
    let base = sugerida;

    // Si el usuario guardó una base manual, úsala
    if (this._baseManual) {
      const inp = document.getElementById('input-base-efectivo');
      const editado = parseFloat(inp?.value);
      if (!isNaN(editado) && editado >= 0) base = editado;
    }

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
        this._baseManual = false;
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
                    return `
                    <div class="border p-2.5 rounded-md space-y-2 ${entregado ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}" id="item-pedido-${p.id}">
                      <div class="flex justify-between items-start gap-2">
                        <div class="min-w-0">
                          <p class="font-bold text-xs text-slate-900">${p.codigo_pedido || ('Pedido #' + p.id)}</p>
                          <p class="text-[10px] text-slate-500">${p.cliente || 'Cliente'} · ${p.direccion || ''}</p>
                        </div>
                        ${entregado
                          ? `<span class="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold">Entregado</span>`
                          : `<span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Pendiente</span>`}
                      </div>

                      <div class="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label class="block text-[10px] text-slate-500">Valor a cobrar ($)</label>
                          <input type="number" step="50" min="0"
                            class="inp-total w-full p-1 border rounded font-bold text-emerald-700"
                            data-id="${p.id}" value="${p.total || 0}"
                            ${yaLiquidada ? 'readonly' : ''}
                            onchange="ModuloDomicilios.guardarCambioPedido(${p.id})">
                        </div>
                        <div>
                          <label class="block text-[10px] text-slate-500">Método de pago</label>
                                              <select class="sel-metodo w-full p-1 border rounded bg-slate-50"
                            data-id="${p.id}" data-total="${totalPedido}"
                            onchange="ModuloDomicilios.recalcularArqueo()">
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia (ya hecha)</option>
                      <option value="TRANSFERENCIA_PENDIENTE">Transferencia pendiente</option>
                    </select>
                        </div>
                      </div>
                      <div class="box-comprobante hidden" id="box-comp-${p.id}">
                    <label class="block text-[10px] text-slate-500"># Comprobante (opcional si está pendiente)</label>
                    <input type="text" class="inp-comp w-full p-1 border rounded"
                           placeholder="Ej: 981231 o vacío si pendiente" data-id="${p.id}">
                  </div>


                      <div class="box-comprobante ${p.metodo_pago_final === 'TRANSFERENCIA' ? '' : 'hidden'}" id="box-comp-${p.id}">
                        <label class="block text-[10px] text-slate-500"># Comprobante</label>
                        <input type="text" class="inp-comp w-full p-1 border rounded text-xs"
                          data-id="${p.id}" value="${p.comprobante_transf || ''}"
                          ${yaLiquidada ? 'readonly' : ''}
                          onchange="ModuloDomicilios.guardarCambioPedido(${p.id})"
                          placeholder="Número de transferencia">
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

    async guardarCambioPedido(pedidoId) {
    const inpTotal = document.querySelector(`.inp-total[data-id="${pedidoId}"]`);
    const sel = document.querySelector(`.sel-metodo[data-id="${pedidoId}"]`);
    const inpComp = document.querySelector(`.inp-comp[data-id="${pedidoId}"]`);
    const boxComp = document.getElementById(`box-comp-${pedidoId}`);

    const total = parseFloat(inpTotal?.value) || 0;
    const metodoPago = sel?.value || 'EFECTIVO';
    const comprobante = inpComp?.value?.trim() || '';

    if (boxComp) {
      if (metodoPago === 'TRANSFERENCIA') boxComp.classList.remove('hidden');
      else boxComp.classList.add('hidden');
    }

    // Actualizar data-total del select para el arqueo
    if (sel) sel.dataset.total = total;

    try {
      await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total, metodoPago, comprobante })
      });
      this.recalcularArqueo();
    } catch (e) {
      console.error(e);
    }
  },

  async confirmarEntrega(pedidoId, entregado) {
    const estadoEntrega = entregado ? 'ENTREGADO' : 'PENDIENTE';
    try {
      const res = await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoEntrega })
      });
      if (res && res.ok) {
        showToast(entregado ? 'Pedido marcado como entregado' : 'Pedido vuelto a pendiente');
        await this.renderTabCuadre(); // refresca la lista
      } else {
        alert(res.error || 'No se pudo actualizar');
      }
    } catch (e) {
      alert('Error al confirmar entrega');
    }
  },

    recalcularArqueo() {
    let totalEfectivoRecolectado = 0;
    const selects = document.querySelectorAll('.sel-metodo');

    selects.forEach(sel => {
      const pid = sel.dataset.id;
      const total = parseFloat(sel.dataset.total) || 0;
      const boxComp = document.getElementById(`box-comp-${pid}`);
      const esTransfer = sel.value === 'TRANSFERENCIA' || sel.value === 'TRANSFERENCIA_PENDIENTE';

      if (esTransfer) {
        if (boxComp) boxComp.classList.remove('hidden');
        // No suma a efectivo recolectado
      } else {
        if (boxComp) boxComp.classList.add('hidden');
        totalEfectivoRecolectado += total;
      }
    });

    const elBase = document.getElementById('arq-base');
    const baseRuta = parseFloat(elBase?.dataset?.valor) ||
      parseFloat(document.getElementById('arq-resumen')?.dataset?.base) || 0;
    const totalEntregar = totalEfectivoRecolectado + baseRuta;

    const elEfectivo = document.getElementById('arq-efectivo');
    const elTotal = document.getElementById('arq-total');

    if (elEfectivo) elEfectivo.innerText = `$${totalEfectivoRecolectado.toLocaleString('es-CO')}`;
    if (elTotal) {
      elTotal.innerText = `$${totalEntregar.toLocaleString('es-CO')}`;
      elTotal.dataset.valor = String(totalEntregar);
    }
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