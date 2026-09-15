const ModuloDomicilios = {
  tabActiva: 'despachar', // 'despachar' | 'rutas' | 'cuadre' | 'auditoria'
  pedidosPendientes: [],
  domiciliarios: [],
  rutaSeleccionadaId: null,
  fechaFiltro: null, // null = aun no inicializado (se pone la fecha de hoy), '' = ver todos (todas las pestañas)
  rutasAuditoriaAbiertas: {},
  prodsAuditoriaAbiertos: {},
  subseccionAuditoria: 'rutas', // 'rutas' | 'domiciliarios' | 'pendientes' | 'novedades'
  filtroDomiciliarioAuditoria: '',
  filtroTextoAuditoria: '',
  vistaPendientesAuditoria: 'dia', // 'dia' | 'todos'
  auditoriaData: null,

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

    const esDomi = typeof Auth !== 'undefined' && Auth.isDomiciliario();
    const domiUser = (typeof Auth !== 'undefined' && Auth.getUser()) || null;
    if (esDomi) {
      this.tabActiva = 'rutas';
    }

    // La primera vez que se entra al modulo, filtramos por la fecha de hoy en todas las pestañas.
    if (this.fechaFiltro === null) {
      this.fechaFiltro = this.fechaHoyLocal();
    }

    container.innerHTML = `
      <div class="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h2 class="text-base font-bold flex items-center gap-2">
            ${esDomi ? '🛵' : '🚚'} <span>${esDomi ? `Mis Rutas Asignadas • ${escapeHtml(domiUser ? (domiUser.domiciliario_nombre || domiUser.nombre) : 'Domiciliario')}` : 'Domicilios & Liquidación'}</span>
          </h2>
          <div class="flex gap-2">
            ${!esDomi ? `
              <button onclick="ModuloDomicilios.abrirModalNuevoDomiciliario()" class="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium">
                + Domiciliario
              </button>
              <button onclick="abrirModalNuevoCliente('', () => showToast('Cliente guardado con éxito', 'success'))" class="px-2 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium">
                + Cliente
              </button>
              <button onclick="ModuloDomicilios.toggleFormularioNuevoPedido()" class="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium">
                + Crear Pedido
              </button>
            ` : ''}
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
              <div class="flex gap-1">
                <input id="dom-cliente" type="text" placeholder="Buscar o crear cliente..." autocomplete="off"
                       class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
                <button type="button" onclick="abrirModalNuevoCliente('', (c) => {
                  ModuloDomicilios.clienteSeleccionadoId = c.id;
                  document.getElementById('dom-cliente').value = c.nombre || '';
                  if (c.telefono) document.getElementById('dom-telefono').value = c.telefono;
                  if (c.direccion) document.getElementById('dom-direccion').value = c.direccion;
                  if (c.ciudad) document.getElementById('dom-municipio').value = c.ciudad;
                  showToast('Cliente creado y seleccionado', 'success');
                })" class="px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold" title="Agregar cliente nuevo">➕</button>
              </div>
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
        ${esDomi ? `
          <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-center flex items-center justify-between">
            <span class="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <span>🛵</span> <span>Tus Rutas Asignadas para Entrega</span>
            </span>
            <span class="text-[11px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">Solo En Curso</span>
          </div>
        ` : `
          <div class="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg text-center text-xs font-semibold">
            <button id="subtab-despachar" class="py-2 rounded-md bg-white text-slate-900 shadow-sm">1. Despachar</button>
            <button id="subtab-rutas" class="py-2 rounded-md text-slate-600">2. En Curso</button>
            <button id="subtab-cuadre" class="py-2 rounded-md text-slate-600">3. Cuadre</button>
            <button id="subtab-auditoria" class="py-2 rounded-md text-slate-600">4. Auditoría</button>
          </div>
        `}

        <div id="contenedor-subtab"></div>
      </div>
    `;

    this.bindEvents();
    this.initAutocompletes();
    await this.cargarInicial();
  },

  bindEvents() {
    const btnRefresh = document.getElementById('btn-refresh-dom');
    if (btnRefresh) btnRefresh.onclick = () => this.cargarTabActual();

    const btnDespachar = document.getElementById('subtab-despachar');
    if (btnDespachar) btnDespachar.onclick = () => this.cambiarSubTab('despachar');

    const btnRutas = document.getElementById('subtab-rutas');
    if (btnRutas) btnRutas.onclick = () => this.cambiarSubTab('rutas');

    const btnCuadre = document.getElementById('subtab-cuadre');
    if (btnCuadre) btnCuadre.onclick = () => this.cambiarSubTab('cuadre');

    const btnAuditoria = document.getElementById('subtab-auditoria');
    if (btnAuditoria) btnAuditoria.onclick = () => this.cambiarSubTab('auditoria');

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
          if (clienteNuevo.telefono) document.getElementById('dom-telefono').value = clienteNuevo.telefono;
          if (clienteNuevo.direccion) document.getElementById('dom-direccion').value = clienteNuevo.direccion;
          if (clienteNuevo.ciudad) document.getElementById('dom-municipio').value = clienteNuevo.ciudad;
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
    if (typeof Auth !== 'undefined' && Auth.isDomiciliario() && (tab === 'despachar' || tab === 'auditoria')) {
      showToast('Acceso restringido para domiciliarios', 'error');
      return;
    }
    this.tabActiva = tab;
    const btnD = document.getElementById('subtab-despachar');
    const btnR = document.getElementById('subtab-rutas');
    const btnC = document.getElementById('subtab-cuadre');
    const btnA = document.getElementById('subtab-auditoria');

    const activo = "py-2 rounded-md bg-white text-slate-900 shadow-sm font-bold";
    const inactivo = "py-2 rounded-md text-slate-600 font-normal";

    if (btnD) btnD.className = tab === 'despachar' ? activo : inactivo;
    if (btnR) btnR.className = tab === 'rutas' ? activo : inactivo;
    if (btnC) btnC.className = tab === 'cuadre' ? activo : inactivo;
    if (btnA) btnA.className = tab === 'auditoria' ? activo : inactivo;

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
    else if (this.tabActiva === 'auditoria') await this.renderTabAuditoria();
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
          <div class="bg-amber-50/80 border-2 border-amber-300 p-3 rounded-xl shadow-sm space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <span>🛵</span> <span>Asignar Domiciliario Encargado *</span>
              </label>
              <span class="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Obligatorio
              </span>
            </div>
            <select id="select-domiciliario" onchange="ModuloDomicilios.onSelectDomiciliarioChange(this)"
                    class="w-full text-xs p-2.5 border border-amber-400 rounded-lg bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-inner">
              <option value="" selected disabled>⚠️ -- Debes seleccionar el domiciliario para esta ruta --</option>
              ${this.domiciliarios.map(d => `<option value="${d.id}">🛵 ${escapeHtml(d.nombre)}${d.telefono ? ` (${escapeHtml(d.telefono)})` : ''}</option>`).join('')}
            </select>
            <p id="txt-aviso-domiciliario" class="text-[11px] text-amber-800 font-medium">
              ⚠️ Selecciona explícitamente el repartidor para evitar asignaciones automáticas equivocadas.
            </p>
          </div>

          <div class="border-t pt-2">
            <label class="block text-xs font-bold text-slate-800 mb-2">Pedidos Disponibles para Despacho (Empacados y Directos)</label>
            <div id="lista-check-pedidos" class="space-y-2 max-h-72 overflow-y-auto border p-2 rounded-md bg-slate-50">
              ${this.pedidosPendientes.length === 0 ? `<p class="text-xs text-slate-400 text-center py-3">No hay pedidos pendientes${this.fechaFiltro ? ' para la fecha seleccionada' : ''}</p>` : ''}
              ${this.pedidosPendientes.map(p => {
                const total = Number(p.total) || 0;
                const pagaCon = this.pagaConSugerido(total);      // ej. 37400 → 50000
                const devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - total)); // redondeado a $50
                const nombreCliente = p.cliente || p.cliente_nombre || 'Cliente General';
                const local = p.direccion || '';
                const municipio = p.municipio || '';
                const infoNegrita = [nombreCliente, local, municipio].filter(Boolean).join(' | ');
                return `
                <div class="bg-white p-2.5 rounded border space-y-1.5" data-pedido-card="${p.id}">
                  <label class="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="checkbox" value="${p.id}"
                           data-total="${total}"
                           data-paga-con="${pagaCon}"
                           data-devuelta="${devuelta}"
                           data-sin-devuelta="0"
                           class="chk-pedido mt-0.5"
                           onchange="ModuloDomicilios.calcularBaseEfectivo()">
                    <div class="flex-1 min-w-0">
                      <div class="flex justify-between gap-2">
                        <span class="font-bold text-slate-900">${infoNegrita}</span>
                        <span class="flex items-center gap-1 whitespace-nowrap">
                          <b id="total-txt-${p.id}" class="font-semibold text-emerald-600">$${total.toLocaleString('es-CO')}</b>
                          <button type="button" onclick="event.preventDefault(); ModuloDomicilios.abrirModalEditarPedido(${p.id})"
                                  class="px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold text-[10px]"
                                  title="Editar pedido y modificar sus productos">✏️</button>
                        </span>
                      </div>
                      <p class="text-slate-500">${p.codigo_pedido ? p.codigo_pedido : 'Pedido #' + p.id}</p>
                      ${p.observacion || p.observacion_liquidacion ? `<p class="text-[10px] text-amber-700 font-medium italic">Nota: ${p.observacion || p.observacion_liquidacion}</p>` : ''}
                    </div>
                  </label>

                  <!-- Botón destacado de edición de pedido (quitar o cambiar productos) -->
                  <div class="pl-5 pt-1 flex items-center justify-between border-t border-slate-100">
                    <span class="text-[10px] text-slate-400 font-medium">📦 ${p.estado || 'EMPACADO'}</span>
                    <button type="button" onclick="ModuloDomicilios.abrirModalEditarPedido(${p.id})"
                            class="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1 transition-colors"
                            title="Quitar o cambiar productos, ajustar cantidades o editar datos del pedido">
                      <span>✏️</span> <span>Modificar Pedido / Quitar Productos</span>
                    </button>
                  </div>

                  <!-- Edición del precio del pedido -->
                  <div id="precio-edit-${p.id}" class="hidden pl-5 flex flex-wrap items-center gap-1.5">
                    <span class="text-slate-600 font-medium">Nuevo valor del pedido $</span>
                    <input type="number" id="precio-input-${p.id}" min="0" step="500" value="${total}"
                           class="w-28 border border-sky-300 rounded px-1.5 py-0.5 text-[11px] font-bold" />
                    <button type="button" onclick="ModuloDomicilios.guardarPrecioPedido(${p.id})"
                            class="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">OK</button>
                    <button type="button" onclick="ModuloDomicilios.cancelarPrecioPedido(${p.id})"
                            class="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">✕</button>
                  </div>

                  <div class="pl-5 space-y-1 text-[11px]">
                    <div class="flex items-center justify-end">
                      <select class="sel-metodo-despacho border rounded px-1.5 py-0.5 bg-slate-50 text-[11px]"
                              data-id="${p.id}" onchange="ModuloDomicilios.cambiarMetodoDespacho(${p.id})">
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="TRANSFERENCIA">Transferencia</option>
                      </select>
                    </div>

                    <p id="pago-transfer-note-${p.id}" class="hidden text-sky-700">
                      Transferencia: no aplica devuelta.
                    </p>

                    <div id="pago-efectivo-box-${p.id}" class="space-y-1">
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
                      </div>

                      <!-- Opción: no dar devuelta (pago exacto o valores muy pequeños) -->
                      <label class="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                        <input type="checkbox" id="chk-sindev-${p.id}" class="chk-sin-devuelta"
                               onchange="ModuloDomicilios.toggleSinDevuelta(${p.id})">
                        Sin devuelta (pago exacto / valor muy pequeño)
                      </label>

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
              Por defecto paga con múltiplos de $50.000 y la devuelta se redondea a múltiplos de $50 (no hay monedas más pequeñas).
              Con el ✏️ junto al precio editas el valor del pedido; con el ✏️ junto a "Paga con" cambias con cuánto paga.
              Marca "Sin devuelta" si el valor es exacto o muy pequeño.
            </p>
          </div>

          <button id="btn-despachar-accion" onclick="ModuloDomicilios.despacharRuta()" class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow active:scale-[0.99] transition-all">
            🚚 Despachar Ruta
          </button>
        </div>
      `;
    } catch (err) {
      cont.innerHTML = `<p class="text-xs text-rose-500 text-center py-4">Error: ${err.message}</p>`;
    }
  },

  onSelectDomiciliarioChange(selectEl) {
    const btnDespacho = document.getElementById('btn-despachar-accion');
    const txtAviso = document.getElementById('txt-aviso-domiciliario');
    const domNombre = selectEl.options[selectEl.selectedIndex]?.text || '';
    if (selectEl.value) {
      if (btnDespacho) {
        btnDespacho.innerHTML = `🚚 Despachar Ruta a: <b class="underline ml-1">${escapeHtml(domNombre)}</b>`;
        btnDespacho.className = "w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow transition-all active:scale-[0.99]";
      }
      if (txtAviso) {
        txtAviso.innerHTML = `✅ Domiciliario asignado: <b class="text-emerald-900">${escapeHtml(domNombre)}</b>`;
        txtAviso.className = "text-[11px] text-emerald-800 font-semibold";
      }
    } else {
      if (btnDespacho) {
        btnDespacho.innerHTML = `🚚 Despachar Ruta`;
        btnDespacho.className = "w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow active:scale-[0.99] transition-all";
      }
      if (txtAviso) {
        txtAviso.innerHTML = `⚠️ Selecciona explícitamente el repartidor para evitar asignaciones automáticas equivocadas.`;
        txtAviso.className = "text-[11px] text-amber-800 font-medium";
      }
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

  /** Redondea la devuelta al múltiplo de $50 más cercano (no hay monedas más chicas en Colombia). */
  redondearDevuelta50(valor) {
    const v = Number(valor) || 0;
    if (v <= 0) return 0;
    return Math.round(v / 50) * 50;
  },

  /**
   * Redondea cualquier monto en EFECTIVO físico (a entregar en caja, a cobrar,
   * subtotales de municipio, arqueo) al múltiplo de $50 más cercano. No hay
   * forma de entregar valores con centavos o "sueltos" de $1-$49 en billetes,
   * así que el monto que realmente cambia de mano siempre se redondea.
   * Los valores EXACTOS (Total a cobrar, Despachado, precio del producto)
   * nunca se tocan: solo se redondea lo que se entrega/recibe en físico.
   */
  redondearCaja50(valor) {
    return this.redondearDevuelta50(valor);
  },

  devueltaPorPedido(totalPedido) {
    const t = Number(totalPedido) || 0;
    const pagaCon = this.pagaConSugerido(t);
    return this.redondearDevuelta50(Math.max(0, pagaCon - t));
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
    const devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - total));

    chk.dataset.pagaCon = String(pagaCon);
    chk.dataset.devuelta = String(devuelta);
    // Editar manualmente "paga con" desactiva la opción "sin devuelta".
    chk.dataset.sinDevuelta = '0';
    const chkSinDev = document.getElementById(`chk-sindev-${pedidoId}`);
    if (chkSinDev) chkSinDev.checked = false;

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

  /** Abre el campo para editar el precio (total) del pedido antes de despachar. */
  editarPrecioPedido(pedidoId) {
    const box = document.getElementById(`precio-edit-${pedidoId}`);
    if (box) {
      box.classList.remove('hidden');
      box.classList.add('flex');
    }
    const inp = document.getElementById(`precio-input-${pedidoId}`);
    if (inp) { inp.focus(); inp.select(); }
  },

  /** Guarda el nuevo precio del pedido y recalcula "paga con" / devuelta. */
  guardarPrecioPedido(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    if (!chk) return;

    let nuevoTotal = parseFloat(document.getElementById(`precio-input-${pedidoId}`)?.value);
    if (isNaN(nuevoTotal) || nuevoTotal <= 0) {
      return alert('Ingresa un valor válido para el pedido');
    }
    nuevoTotal = Math.round(nuevoTotal);
    chk.dataset.total = String(nuevoTotal);

    const fmt = (n) => `$${n.toLocaleString('es-CO')}`;
    const elTotal = document.getElementById(`total-txt-${pedidoId}`);
    if (elTotal) elTotal.innerText = fmt(nuevoTotal);

    const sinDev = chk.dataset.sinDevuelta === '1';
    let pagaCon, devuelta;
    if (sinDev) {
      pagaCon = nuevoTotal;
      devuelta = 0;
    } else {
      pagaCon = this.pagaConSugerido(nuevoTotal);
      devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - nuevoTotal));
    }
    chk.dataset.pagaCon = String(pagaCon);
    chk.dataset.devuelta = String(devuelta);

    const elPaga = document.getElementById(`paga-txt-${pedidoId}`);
    const elDev = document.getElementById(`dev-txt-${pedidoId}`);
    const elEnt = document.getElementById(`ent-txt-${pedidoId}`);
    if (elPaga) elPaga.innerText = fmt(pagaCon);
    if (elDev) elDev.innerText = fmt(devuelta);
    if (elEnt) elEnt.innerText = fmt(pagaCon);

    const inpPaga = document.getElementById(`paga-input-${pedidoId}`);
    if (inpPaga) inpPaga.value = String(pagaCon);

    document.getElementById(`precio-edit-${pedidoId}`)?.classList.add('hidden');
    document.getElementById(`precio-edit-${pedidoId}`)?.classList.remove('flex');

    this.calcularBaseEfectivo();
  },

  cancelarPrecioPedido(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    const actual = parseFloat(chk?.dataset?.total) || 0;
    const inp = document.getElementById(`precio-input-${pedidoId}`);
    if (inp) inp.value = String(actual);
    document.getElementById(`precio-edit-${pedidoId}`)?.classList.add('hidden');
    document.getElementById(`precio-edit-${pedidoId}`)?.classList.remove('flex');
  },

  /**
   * Modal interactivo para que la Central de Domicilios modifique un pedido antes de despachar:
   * permite quitar productos, cambiar cantidades, agregar nuevos productos desde el catálogo,
   * y ajustar datos de cliente/entrega. Ajusta el inventario de bodega en tiempo real.
   */
  async abrirModalEditarPedido(pedidoId) {
    const modalPrevio = document.getElementById('modal-editar-pedido-completo');
    if (modalPrevio) modalPrevio.remove();

    showToast('Cargando información del pedido...', 'info');
    const res = await apiFetch(`/pedidos/${pedidoId}`);
    if (!res || !res.ok || !res.data) {
      showToast(res?.error || 'No se pudo cargar el pedido solicitado', 'error');
      return;
    }

    const pedido = res.data;
    let itemsEdit = (pedido.items || []).map(it => ({
      id: it.id,
      producto_id: it.producto_id,
      sku: it.sku,
      nombre_producto: it.nombre_producto || it.nombre || 'Producto',
      cantidad: Number(it.cantidad_solicitada || it.cantidad_empacada || 1),
      precio: Number(it.precio || 0)
    }));

    let prodSeleccionadoParaAgregar = null;

    const modal = document.createElement('div');
    modal.id = 'modal-editar-pedido-completo';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 overflow-y-auto';

    const renderModalContenido = () => {
      const totalCalc = itemsEdit.reduce((acc, it) => acc + (it.precio * it.cantidad), 0);
      const totalUnidades = itemsEdit.reduce((acc, it) => acc + it.cantidad, 0);

      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
          <!-- Cabecera -->
          <div class="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center shrink-0">
            <div>
              <h3 class="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>✏️</span> Modificar Pedido: ${escapeHtml(pedido.codigo_pedido || '#' + pedido.id)}
              </h3>
              <p class="text-xs text-slate-300">Central de Domicilios · Quitar/cambiar productos, cantidades y entrega</p>
            </div>
            <button type="button" id="btn-cerrar-modal-edit" class="text-slate-400 hover:text-white text-xl font-bold p-1 leading-none">&times;</button>
          </div>

          <!-- Cuerpo con Scroll -->
          <div class="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            <!-- Datos de Entrega -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">📋 Datos de Entrega</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">Cliente</label>
                  <input type="text" id="medit-cliente" value="${escapeHtml(pedido.cliente || '')}"
                         class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium" />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">Teléfono</label>
                  <input type="text" id="medit-telefono" value="${escapeHtml(pedido.telefono || '')}"
                         class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">Dirección de Entrega</label>
                  <input type="text" id="medit-direccion" value="${escapeHtml(pedido.direccion || '')}"
                         class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">Municipio / Ciudad</label>
                  <input type="text" id="medit-municipio" value="${escapeHtml(pedido.municipio || '')}"
                         class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Observación</label>
                <input type="text" id="medit-observacion" value="${escapeHtml(pedido.observacion || '')}"
                       placeholder="Instrucciones para el repartidor"
                       class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
              </div>
            </div>

            <!-- Tabla de Ítems / Productos -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📦</span> Productos del Pedido (${itemsEdit.length} productos · ${totalUnidades} unds)
                </h4>
                <span class="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                  🔄 Stock se ajusta automáticamente
                </span>
              </div>

              <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table class="w-full text-left text-xs border-collapse">
                  <thead class="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th class="py-2 px-3">Producto / SKU</th>
                      <th class="py-2 px-2 text-center w-28">Cantidad</th>
                      <th class="py-2 px-2 text-right">Precio Unit.</th>
                      <th class="py-2 px-3 text-right">Subtotal</th>
                      <th class="py-2 px-2 text-center w-14">Acción</th>
                    </tr>
                  </thead>
                  <tbody id="medit-tbody-items" class="divide-y divide-slate-100">
                    ${itemsEdit.length === 0 ? `
                      <tr>
                        <td colspan="5" class="py-6 text-center text-rose-500 font-medium">
                          ⚠️ Has quitado todos los productos. Debes tener al menos uno para guardar.
                        </td>
                      </tr>
                    ` : itemsEdit.map((it, idx) => `
                      <tr class="hover:bg-slate-50 transition-colors">
                        <td class="py-2.5 px-3">
                          <p class="font-bold text-slate-900 leading-snug">${escapeHtml(it.nombre_producto)}</p>
                          <p class="text-[10px] text-slate-400 font-mono">SKU: ${escapeHtml(it.sku || 'N/A')}</p>
                        </td>
                        <td class="py-2.5 px-2 text-center">
                          <div class="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                            <button type="button" class="btn-medit-restar px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold" data-idx="${idx}">-</button>
                            <span class="px-2 py-1 font-bold text-xs text-slate-800 min-w-[26px] text-center">${it.cantidad}</span>
                            <button type="button" class="btn-medit-sumar px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold" data-idx="${idx}">+</button>
                          </div>
                        </td>
                        <td class="py-2.5 px-2 text-right font-medium text-slate-600">
                          $${Number(it.precio || 0).toLocaleString('es-CO')}
                        </td>
                        <td class="py-2.5 px-3 text-right font-bold text-slate-900">
                          $${(Number(it.precio || 0) * it.cantidad).toLocaleString('es-CO')}
                        </td>
                        <td class="py-2.5 px-2 text-center">
                          <button type="button" class="btn-medit-quitar p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded text-xs font-bold" data-idx="${idx}" title="Quitar este producto">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Buscador para Agregar Producto Adicional -->
            <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
              <span class="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <span>➕</span> ¿Necesitas agregar otro producto a este pedido?
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div class="sm:col-span-8 relative">
                  <label class="block text-[11px] font-medium text-slate-600 mb-0.5">Buscar en Catálogo</label>
                  <input type="text" id="medit-buscar-producto" placeholder="Escribe nombre o SKU del producto..."
                         class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white" autocomplete="off" />
                  <div id="medit-autocomplete-productos" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-40 max-h-48 overflow-y-auto"></div>
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-[11px] font-medium text-slate-600 mb-0.5">Cantidad</label>
                  <input type="number" id="medit-cantidad-agregar" min="1" value="1"
                         class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-bold text-center" />
                </div>
                <div class="sm:col-span-2">
                  <button type="button" id="btn-medit-agregar-item" class="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs disabled:opacity-40" disabled>
                    ➕ Agregar
                  </button>
                </div>
              </div>
              <div id="medit-producto-preview" class="hidden text-xs bg-white border border-emerald-300 rounded-lg p-2 font-medium text-slate-700"></div>
            </div>

            <!-- Total y Resumen de Cobro -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span class="text-xs text-slate-500 font-semibold block">Total Liquidado del Pedido:</span>
                <span class="text-xs text-slate-400">Calculado a partir de los productos en lista</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-600">Total $:</span>
                <input type="number" id="medit-total-final" min="0" step="500" value="${totalCalc}"
                       class="w-36 border-2 border-emerald-500 rounded-lg px-2.5 py-1 text-base font-extrabold text-emerald-700 text-right bg-white" />
              </div>
            </div>
          </div>

          <!-- Pie con Acciones -->
          <div class="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end gap-2.5 shrink-0">
            <button type="button" id="btn-cancelar-modal-edit" class="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50">
              Cancelar
            </button>
            <button type="button" id="btn-guardar-modal-edit" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md">
              <span>💾</span> Guardar Cambios en Pedido
            </button>
          </div>
        </div>
      `;

      // Enlazar eventos del modal
      document.getElementById('btn-cerrar-modal-edit')?.addEventListener('click', () => modal.remove());
      document.getElementById('btn-cancelar-modal-edit')?.addEventListener('click', () => modal.remove());

      // Eventos de botones sumar/restar/quitar
      modal.querySelectorAll('.btn-medit-sumar').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          itemsEdit[idx].cantidad += 1;
          renderModalContenido();
        });
      });

      modal.querySelectorAll('.btn-medit-restar').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          if (itemsEdit[idx].cantidad > 1) {
            itemsEdit[idx].cantidad -= 1;
            renderModalContenido();
          } else {
            if (confirm(`¿Quitar "${itemsEdit[idx].nombre_producto}" del pedido? Las unidades volverán al inventario.`)) {
              itemsEdit.splice(idx, 1);
              renderModalContenido();
            }
          }
        });
      });

      modal.querySelectorAll('.btn-medit-quitar').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          const prodNombre = itemsEdit[idx].nombre_producto;
          if (confirm(`¿Eliminar "${prodNombre}" del pedido? Se reintegrarán las unidades a bodega automáticamente.`)) {
            itemsEdit.splice(idx, 1);
            renderModalContenido();
          }
        });
      });

      // Autocomplete de productos para agregar más
      const inpBusqueda = document.getElementById('medit-buscar-producto');
      const dropBusqueda = document.getElementById('medit-autocomplete-productos');
      const btnAdd = document.getElementById('btn-medit-agregar-item');
      const boxPrev = document.getElementById('medit-producto-preview');

      if (inpBusqueda && dropBusqueda && typeof attachAutocompleteProductos === 'function') {
        attachAutocompleteProductos(inpBusqueda, dropBusqueda, (p) => {
          prodSeleccionadoParaAgregar = p;
          inpBusqueda.value = p.nombre;
          if (boxPrev) {
            boxPrev.classList.remove('hidden');
            boxPrev.innerHTML = `<b>${escapeHtml(p.nombre)}</b> · SKU: ${escapeHtml(p.sku)} · Precio: $${Number(p.precio || 0).toLocaleString('es-CO')} · Stock: ${p.stock}`;
          }
          if (btnAdd) btnAdd.disabled = false;
        });

        inpBusqueda.addEventListener('input', (e) => {
          if (prodSeleccionadoParaAgregar && e.target.value !== prodSeleccionadoParaAgregar.nombre) {
            prodSeleccionadoParaAgregar = null;
            if (boxPrev) boxPrev.classList.add('hidden');
            if (btnAdd) btnAdd.disabled = true;
          }
        });
      }

      if (btnAdd) {
        btnAdd.addEventListener('click', () => {
          if (!prodSeleccionadoParaAgregar) return;
          const cantInp = document.getElementById('medit-cantidad-agregar');
          const cant = Math.max(1, parseInt(cantInp?.value, 10) || 1);

          const exist = itemsEdit.find(i => (prodSeleccionadoParaAgregar.id && i.producto_id === prodSeleccionadoParaAgregar.id) || i.sku === prodSeleccionadoParaAgregar.sku);
          if (exist) {
            exist.cantidad += cant;
          } else {
            itemsEdit.push({
              producto_id: prodSeleccionadoParaAgregar.id || null,
              sku: prodSeleccionadoParaAgregar.sku || '',
              nombre_producto: prodSeleccionadoParaAgregar.nombre || 'Producto',
              cantidad: cant,
              precio: Number(prodSeleccionadoParaAgregar.precio || 0)
            });
          }

          prodSeleccionadoParaAgregar = null;
          renderModalContenido();
        });
      }

      // Guardar Cambios
      document.getElementById('btn-guardar-modal-edit')?.addEventListener('click', async () => {
        if (itemsEdit.length === 0) {
          alert('El pedido no puede quedar sin productos. Si deseas cancelarlo, utiliza la opción de anulación o deja al menos un producto.');
          return;
        }

        const nuevoCliente = document.getElementById('medit-cliente')?.value.trim();
        const nuevoTel = document.getElementById('medit-telefono')?.value.trim();
        const nuevaDir = document.getElementById('medit-direccion')?.value.trim();
        const nuevoMun = document.getElementById('medit-municipio')?.value.trim();
        const nuevaObs = document.getElementById('medit-observacion')?.value.trim();
        const totalFinal = parseFloat(document.getElementById('medit-total-final')?.value) || 0;

        const btnGuardar = document.getElementById('btn-guardar-modal-edit');
        if (btnGuardar) {
          btnGuardar.disabled = true;
          btnGuardar.innerHTML = '<span>⏳</span> Guardando...';
        }

        try {
          const resPut = await apiFetch(`/pedidos/${pedidoId}`, {
            method: 'PUT',
            body: JSON.stringify({
              cliente: nuevoCliente,
              telefono: nuevoTel,
              direccion: nuevaDir,
              municipio: nuevoMun,
              observacion: nuevaObs,
              total: totalFinal,
              items: itemsEdit.map(it => ({
                producto_id: it.producto_id,
                sku: it.sku,
                nombre_producto: it.nombre_producto,
                cantidad: it.cantidad,
                precio: it.precio
              }))
            })
          });

          if (!resPut || !resPut.ok) {
            alert(resPut?.error || 'No se pudo guardar la modificación del pedido');
            if (btnGuardar) {
              btnGuardar.disabled = false;
              btnGuardar.innerHTML = '<span>💾</span> Guardar Cambios en Pedido';
            }
            return;
          }

          showToast(`✅ Pedido ${pedido.codigo_pedido || '#' + pedidoId} actualizado con éxito.`, 'success');
          modal.remove();

          // Refrescar la vista de despachos
          if (typeof ModuloDomicilios.renderTabDespachar === 'function') {
            await ModuloDomicilios.renderTabDespachar();
          }
        } catch (err) {
          alert(err.message || 'Error de conexión');
          if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<span>💾</span> Guardar Cambios en Pedido';
          }
        }
      });
    };

    renderModalContenido();
    document.body.appendChild(modal);
  },

  /** Marca/desmarca "sin devuelta": pago exacto, sin cambio (valores pequeños o exactos). */
  toggleSinDevuelta(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    const chkSinDev = document.getElementById(`chk-sindev-${pedidoId}`);
    if (!chk || !chkSinDev) return;

    const total = parseFloat(chk.dataset.total) || 0;
    const fmt = (n) => `$${n.toLocaleString('es-CO')}`;
    const elPaga = document.getElementById(`paga-txt-${pedidoId}`);
    const elDev = document.getElementById(`dev-txt-${pedidoId}`);
    const elEnt = document.getElementById(`ent-txt-${pedidoId}`);
    const btnEditarPaga = document.querySelector(`#pago-view-${pedidoId} button[title="Cambiar con cuánto paga"]`);

    if (chkSinDev.checked) {
      chk.dataset.sinDevuelta = '1';
      chk.dataset.pagaCon = String(total);
      chk.dataset.devuelta = '0';
      if (btnEditarPaga) btnEditarPaga.classList.add('hidden');
    } else {
      chk.dataset.sinDevuelta = '0';
      const pagaCon = this.pagaConSugerido(total);
      const devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - total));
      chk.dataset.pagaCon = String(pagaCon);
      chk.dataset.devuelta = String(devuelta);
      if (btnEditarPaga) btnEditarPaga.classList.remove('hidden');
    }

    if (elPaga) elPaga.innerText = fmt(Number(chk.dataset.pagaCon));
    if (elDev) elDev.innerText = fmt(Number(chk.dataset.devuelta));
    if (elEnt) elEnt.innerText = fmt(Number(chk.dataset.pagaCon));

    this.calcularBaseEfectivo();
  },

  /** Cambia el método de pago de un pedido en Despachar: si es Transferencia, no aplica devuelta. */
  cambiarMetodoDespacho(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    const sel = document.querySelector(`.sel-metodo-despacho[data-id="${pedidoId}"]`);
    if (!chk || !sel) return;

    const metodo = sel.value;
    const total = parseFloat(chk.dataset.total) || 0;
    const boxEfectivo = document.getElementById(`pago-efectivo-box-${pedidoId}`);
    const notaTransfer = document.getElementById(`pago-transfer-note-${pedidoId}`);
    const fmt = (n) => `$${n.toLocaleString('es-CO')}`;

    if (metodo !== 'EFECTIVO') {
      // Transferencia: no hay efectivo de por medio, no se calcula ni se muestra devuelta.
      chk.dataset.pagaCon = String(total);
      chk.dataset.devuelta = '0';
      chk.dataset.sinDevuelta = '0';
      if (boxEfectivo) boxEfectivo.classList.add('hidden');
      if (notaTransfer) notaTransfer.classList.remove('hidden');
    } else {
      if (boxEfectivo) boxEfectivo.classList.remove('hidden');
      if (notaTransfer) notaTransfer.classList.add('hidden');

      const chkSinDev = document.getElementById(`chk-sindev-${pedidoId}`);
      const sinDev = chkSinDev?.checked;
      let pagaCon, devuelta;
      if (sinDev) {
        pagaCon = total;
        devuelta = 0;
      } else {
        pagaCon = this.pagaConSugerido(total);
        devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - total));
      }
      chk.dataset.pagaCon = String(pagaCon);
      chk.dataset.devuelta = String(devuelta);

      const elPaga = document.getElementById(`paga-txt-${pedidoId}`);
      const elDev = document.getElementById(`dev-txt-${pedidoId}`);
      const elEnt = document.getElementById(`ent-txt-${pedidoId}`);
      if (elPaga) elPaga.innerText = fmt(pagaCon);
      if (elDev) elDev.innerText = fmt(devuelta);
      if (elEnt) elEnt.innerText = fmt(pagaCon);
    }

    this.calcularBaseEfectivo();
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
      if (isNaN(devuelta)) devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - total));

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
    const selectDom = document.getElementById('select-domiciliario');
    const domId = selectDom ? selectDom.value : '';

    if (!domId || domId === '' || Number(domId) <= 0) {
      if (selectDom) {
        selectDom.focus();
        selectDom.scrollIntoView({ behavior: 'smooth', block: 'center' });
        selectDom.classList.add('ring-4', 'ring-rose-500', 'border-rose-500', 'bg-rose-50');
        setTimeout(() => {
          selectDom.classList.remove('ring-4', 'ring-rose-500', 'border-rose-500', 'bg-rose-50');
        }, 3500);
      }
      showToast('⚠️ Debes seleccionar obligatoriamente el domiciliario para esta ruta.', 'warning');
      return;
    }

    const chks = Array.from(document.querySelectorAll('.chk-pedido:checked'));
    if (!chks.length) {
      showToast('⚠️ Selecciona al menos un pedido para despachar.', 'warning');
      return;
    }

    const base = this.calcularBaseEfectivo(); // suma de devueltas (cambio a llevar)

    // Se manda el detalle de cada pedido (precio editado, paga con, devuelta
    // y método de pago) para que el servidor respete lo definido aquí.
    const pedidos = chks.map(chk => {
      const pid = parseInt(chk.value, 10);
      const sel = document.querySelector(`.sel-metodo-despacho[data-id="${pid}"]`);
      const metodo = sel ? sel.value : 'EFECTIVO';
      return {
        id: pid,
        metodoPago: metodo,
        total: parseFloat(chk.dataset.total) || 0,
        pagaCon: parseFloat(chk.dataset.pagaCon) || 0,
        devuelta: parseFloat(chk.dataset.devuelta) || 0
      };
    });

    try {
      const res = await apiFetch('/rutas/despachar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domiciliarioId: domId,
          pedidos,
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
                    ${(typeof Auth !== 'undefined' && Auth.isDomiciliario()) ? '🛵 Ver mis entregas y actualizar estado' : '📦 Gestionar entregas / Liquidar'}
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

      // ---- Totales por municipio ----

      function calcDevueltaPedido(p) {
        // La devuelta queda FIJA desde que se despachó (según lo que se puso
        // en la pestaña "Despachar"): si se despachó en Efectivo, aquí queda
        // ese valor aunque luego el cliente pague por transferencia; si se
        // despachó en Transferencia, ya quedó guardada en $0. No se recalcula
        // ni se cambia según el método actual — solo se lee lo guardado.
        const storedDev = Number(p.devuelta_calculada);
        return (!isNaN(storedDev) && storedDev > 0) ? storedDev : 0;
      }

      const statsPorMun = {};
      municipios.forEach(mun => {
        const lista = porMunicipio[mun];
        const todosEntregados = lista.every(p => p.estado_entrega === 'ENTREGADO');
        let devueltas = 0;
        let cobradoEfectivo = 0;

        lista.forEach(p => {
          const totalPedido = Number(p.total) || 0;
          const metodo = p.metodo_pago_final || 'EFECTIVO';
          const esTransfer = metodo === 'TRANSFERENCIA' || metodo === 'TRANSFERENCIA_PENDIENTE';
          const dev = calcDevueltaPedido(p);
          devueltas += dev;
          if (p.estado_entrega === 'ENTREGADO' && !esTransfer) {
            // Redondeado a $50: es el efectivo físico que realmente se entrega.
            cobradoEfectivo += this.redondearCaja50(totalPedido);
          }
        });

        // Completo → cobrado + devueltas; en curso → solo devueltas
        const subtotal = todosEntregados ? (cobradoEfectivo + devueltas) : devueltas;

        statsPorMun[mun] = {
          todosEntregados,
          devueltas,
          cobradoEfectivo,
          subtotal,
          numPedidos: lista.length,
          numEntregados: lista.filter(p => p.estado_entrega === 'ENTREGADO').length
        };
      });

      const entregados = (pedidos || []).filter(p => p.estado_entrega === 'ENTREGADO').length;
      const totalPedidos = (pedidos || []).length;

      cont.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <button onclick="ModuloDomicilios.cambiarSubTab('rutas')"
                    class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
              ← Volver a rutas
            </button>
            <span class="text-xs px-2 py-0.5 rounded font-semibold ${yaLiquidada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
              ${yaLiquidada ? 'Liquidada' : 'En calle'}
            </span>
          </div>
          <div class="bg-slate-100 p-2.5 rounded-md text-xs space-y-1">
            <div class="flex justify-between items-center">
              <span class="font-bold text-slate-800">Ruta #${ruta.id} - ${ruta.domiciliario_nombre}</span>
              ${!yaLiquidada && !(typeof Auth !== 'undefined' && Auth.isDomiciliario()) ? `
                <button onclick="ModuloDomicilios.imprimirTicketRuta80mm(ModuloDomicilios._cuadreRuta, ModuloDomicilios._cuadrePedidos)"
                        class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-medium flex items-center gap-1">
                  🖨️ 80mm
                </button>
              ` : ''}
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Base devueltas: $${(ruta.base_efectivo||0).toLocaleString()}</span>
              <span>Entregados: <b>${entregados}/${totalPedidos}</b></span>
            </div>
          </div>

          <div class="space-y-3" id="lista-municipios-cuadre">
            ${municipios.map((mun, munIdx) => {
              const lista = porMunicipio[mun];
              const st = statsPorMun[mun];
              const devueltasPendientesOtros = municipios.reduce((acc, m2) => {
                if (m2 === mun) return acc;
                const s2 = statsPorMun[m2];
                return acc + (s2.todosEntregados ? 0 : s2.devueltas);
              }, 0);

              const abiertoMun = this.municipiosAbiertos && this.municipiosAbiertos[munIdx];
              return `
              <div class="border rounded-lg overflow-hidden" data-municipio="${mun}">
                <div class="bg-indigo-50 px-3 py-2 border-b cursor-pointer select-none"
                     onclick="ModuloDomicilios.toggleMunicipioCuadre(${munIdx})">
                  <div class="flex justify-between items-start gap-2">
                    <div class="flex items-start gap-1.5">
                      <span id="mun-arrow-${munIdx}" class="text-indigo-700 text-xs mt-0.5 transition-transform">${abiertoMun ? '▾' : '▸'}</span>
                      <div>
                        <p class="text-xs font-bold text-indigo-900">📍 ${mun}</p>
                        <p class="text-[10px] text-indigo-700">
                          ${st.numEntregados}/${st.numPedidos} entregado(s)
                          ${st.todosEntregados
                            ? ' · <span class="text-emerald-700 font-semibold">Completo</span>'
                            : ' · <span class="text-amber-700 font-semibold">En curso</span>'}
                        </p>
                      </div>
                    </div>
                    <div class="text-right text-[10px]">
                      <p class="text-indigo-900 font-bold">
                        ${st.todosEntregados ? 'Subtotal' : 'Devueltas'}:
                        $${st.subtotal.toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                </div>
                <div class="p-2 space-y-2 bg-white ${abiertoMun ? '' : 'hidden'}" id="mun-body-${munIdx}">
                                      ${lista.map(p => {
                    const entregado = p.estado_entrega === 'ENTREGADO';
                    const totalPedido = Number(p.total) || 0;

                    // Original SOLO si vino de BD. Si no hay, no inventamos con el total actual
                    // (si no, al editar “Despachado” y la devuelta se mueven).
                    const tieneOriginal = Number(p.total_original) > 0;
                    const totalOriginal = tieneOriginal ? Number(p.total_original) : totalPedido;

                    const metodoActual = p.metodo_pago_final || 'EFECTIVO';
                    const motivoAjuste = (p.observacion || '').trim();

                    const esTransfer = metodoActual === 'TRANSFERENCIA'
                      || metodoActual === 'TRANSFERENCIA_PENDIENTE';

                    // Devuelta FIJA: es la que quedó guardada al despachar, sin
                    // importar el método actual. Si se despachó en Efectivo con
                    // devuelta, esa devuelta se debe aunque luego el cliente
                    // pague por transferencia (el domiciliario ya salió con ese
                    // cambio). Si se despachó en Transferencia, ya quedó en $0.
                    const storedDev = Number(p.devuelta_calculada);
                    const devueltaEntregada = (!isNaN(storedDev) && storedDev > 0) ? storedDev : 0;

                    // Efectivo: valor cobrado (editado) + devuelta que salió con el domiciliario
                    // Transferencia: solo la devuelta de la base (si se despachó con devuelta)
                    // Redondeado a $50: es lo que físicamente se puede entregar en billetes/monedas.
                    const aCaja = this.redondearCaja50(esTransfer
                      ? devueltaEntregada
                      : (totalPedido + devueltaEntregada));

                    const delta = tieneOriginal ? (totalPedido - totalOriginal) : 0;
                    const hayAjuste = tieneOriginal && delta !== 0;

                    const formulaTxt = hayAjuste
                      ? `$${totalOriginal.toLocaleString('es-CO')} ${delta > 0 ? '+' : ''}${delta.toLocaleString('es-CO')}${motivoAjuste ? ' [' + motivoAjuste.replace(/"/g, '') + ']' : ''} = $${totalPedido.toLocaleString('es-CO')}`
                      : `$${totalPedido.toLocaleString('es-CO')}`;
                    return `
                    <div class="border p-2.5 rounded-md space-y-2 ${entregado ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}"
                         id="item-pedido-${p.id}"
                         data-total-original="${tieneOriginal ? totalOriginal : ''}"
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

                      <div class="border-t border-slate-100 pt-1.5">
                        <button type="button" onclick="ModuloDomicilios.toggleProductosPedido(${p.id})"
                                class="text-[11px] text-sky-700 font-semibold hover:underline flex items-center justify-between w-full">
                          <span>🛒 Productos de la factura (${p.items?.length || 0})</span>
                          <span id="prod-arrow-${p.id}">${(this.productosPedidoAbiertos && this.productosPedidoAbiertos[p.id]) ? '▴' : '▾'}</span>
                        </button>
                        <div id="productos-pedido-${p.id}" class="${(this.productosPedidoAbiertos && this.productosPedidoAbiertos[p.id]) ? '' : 'hidden'} mt-1.5 space-y-1 bg-slate-50 p-2 rounded-lg text-[11px] text-slate-700 border border-slate-200/60">
                          ${(p.items && p.items.length > 0) ? p.items.map(item => `
                            <div class="flex justify-between items-center border-b border-slate-200/60 pb-1 last:border-b-0 last:pb-0">
                              <div>
                                <p class="font-medium text-slate-800">${item.nombre_producto || 'Producto'} <span class="text-[10px] text-slate-400 font-mono">(SKU ${item.sku || '—'})</span></p>
                              </div>
                              <div class="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                ×${item.cantidad_solicitada || item.cantidad_empacada || 1}
                              </div>
                            </div>
                          `).join('') : '<p class="text-[10px] text-slate-400 italic">No hay productos registrados en este pedido.</p>'}
                        </div>
                      </div>

                      ${entregado ? `
                      <!-- VISTA COLAPSADA (entregado) -->
                      <div id="resumen-${p.id}" class="text-[11px] space-y-1 ${(this.detallesAbiertos && this.detallesAbiertos[p.id]) ? 'hidden' : ''}">
                        <p class="text-slate-600">Despachado: <b>$${totalOriginal.toLocaleString('es-CO')}</b></p>
                        ${hayAjuste ? `
                        <p class="text-slate-600">
                          Ajuste: <b>${delta > 0 ? '+' : ''}${delta.toLocaleString('es-CO')}</b>
                          ${motivoAjuste ? `<span class="text-amber-800 italic"> — ${motivoAjuste.replace(/"/g,'')}</span>` : ''}
                        </p>
                        ` : ''}
                        <p class="text-slate-800">Total a cobrar: <b class="text-emerald-700">$${totalPedido.toLocaleString('es-CO')}</b></p>
                        <p class="text-amber-800">
                          Devuelta entregada: <b>$${devueltaEntregada.toLocaleString('es-CO')}</b>
                          <span class="text-[10px] text-slate-400">(fija al salir)</span>
                        </p>
                        <p class="text-emerald-800 font-semibold">
                          A entregar en caja: <b>$${aCaja.toLocaleString('es-CO')}</b>
                          <span class="text-[10px] font-normal text-slate-500">
                            ${esTransfer ? '(solo devuelta · transferencia)' : '(cobrado + devuelta)'}
                          </span>
                        </p>
                        <button type="button" onclick="ModuloDomicilios.toggleDetallePedido(${p.id})"
                                class="text-[10px] text-indigo-600 font-semibold mt-1">▶ Ver más detalles</button>
                      </div>
                      <div id="detalle-${p.id}" class="${(this.detallesAbiertos && this.detallesAbiertos[p.id]) ? '' : 'hidden'} space-y-2">
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
                                                   <p id="formula-txt-${p.id}" class="text-[10px] text-slate-600 mt-0.5 ${delta === 0 ? 'hidden' : ''}">
                            ${formulaTxt}
                          </p>
                          <p class="text-[10px] text-amber-800 mt-0.5 ${devueltaEntregada > 0 ? '' : 'hidden'}">
                            Devuelta al salir: <b>$${devueltaEntregada.toLocaleString('es-CO')}</b> (no cambia si ajustas el precio)
                          </p>
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
                          <div class="flex justify-between text-amber-900 ${devueltaEntregada > 0 ? '' : 'hidden'}">
                            <span>Devuelta entregada (base):</span>
                            <b id="dev-line-${p.id}">$${devueltaEntregada.toLocaleString('es-CO')}</b>
                          </div>
                          <div class="flex justify-between text-emerald-800">
                            <span>A entregar en caja:</span>
                            <b id="caja-line-${p.id}">$${aCaja.toLocaleString('es-CO')}</b>
                          </div>
                          <p class="text-[10px] text-slate-400" id="caja-hint-${p.id}">
                            ${esTransfer
                              ? (devueltaEntregada > 0
                                  ? 'Transferencia: el domiciliario regresa la devuelta que salió con él.'
                                  : 'Transferencia: sin devuelta (se despachó sin cambio).')
                              : 'Efectivo: en caja el valor cobrado del pedido.'}
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

                <div class="bg-slate-50 border-t px-3 py-2 text-[11px] space-y-1">
                  ${st.todosEntregados ? `
                  <div class="flex justify-between text-slate-700">
                    <span>Cobrado en efectivo (${mun}):</span>
                    <b>$${st.cobradoEfectivo.toLocaleString('es-CO')}</b>
                  </div>
                  <div class="flex justify-between text-amber-900">
                    <span>Devueltas de ${mun}:</span>
                    <b>$${st.devueltas.toLocaleString('es-CO')}</b>
                  </div>
                  <div class="flex justify-between text-emerald-800 font-bold border-t border-slate-200 pt-1">
                    <span>A entregar / guardar (${mun}):</span>
                    <b>$${st.subtotal.toLocaleString('es-CO')}</b>
                  </div>
                  ` : `
                  <div class="flex justify-between text-amber-900 font-semibold">
                    <span>Devueltas a llevar en ${mun}:</span>
                    <b>$${st.devueltas.toLocaleString('es-CO')}</b>
                  </div>
                  <p class="text-[10px] text-slate-400">Municipio en curso: solo devueltas (aún no se suma el cobro).</p>
                  `}
                  <div class="flex justify-between text-indigo-900 font-semibold border-t border-slate-200 pt-1">
                    <span>Devueltas pendientes (otros municipios):</span>
                    <b>$${devueltasPendientesOtros.toLocaleString('es-CO')}</b>
                  </div>
                  <p class="text-[10px] text-slate-400">
                    ${st.todosEntregados
                      ? `Terminaste ${mun}. Aparta $${st.subtotal.toLocaleString('es-CO')} y conserva $${devueltasPendientesOtros.toLocaleString('es-CO')} de cambio para el resto.`
                      : `Aún hay entregas en ${mun}. Cambio para otros municipios: $${devueltasPendientesOtros.toLocaleString('es-CO')}.`
                    }
                  </p>
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

          ${!yaLiquidada ? (
            (typeof Auth !== 'undefined' && Auth.isDomiciliario()) ? `
              <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                <p class="text-xs font-bold text-emerald-900 flex items-center justify-center gap-1">
                  <span>🛵</span> <span>Modo Repartidor de Calle</span>
                </p>
                <p class="text-[11px] text-emerald-800">
                  Puedes registrar las entregas, métodos y notas de cada cliente. El cierre final y cuadre de dinero en caja lo realiza la administración.
                </p>
              </div>
            ` : `
              <button onclick="ModuloDomicilios.cerrarYLiquidarRuta(${ruta.id})"
                class="w-full py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-md hover:bg-emerald-700">
                ✅ Cerrar y Liquidar Ruta Completa
              </button>
              <p class="text-[10px] text-center text-slate-400">Puedes ir marcando entregas y ajustando valores. Liquida solo al final.</p>
            `
          ) : `
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

      toggleMunicipioCuadre(idx) {
    this.municipiosAbiertos = this.municipiosAbiertos || {};
    const body = document.getElementById(`mun-body-${idx}`);
    const arrow = document.getElementById(`mun-arrow-${idx}`);
    if (!body) return;
    const abierto = !body.classList.contains('hidden');
    if (abierto) {
      body.classList.add('hidden');
      if (arrow) arrow.textContent = '▸';
      this.municipiosAbiertos[idx] = false;
    } else {
      body.classList.remove('hidden');
      if (arrow) arrow.textContent = '▾';
      this.municipiosAbiertos[idx] = true;
    }
  },

  toggleDetallePedido(pedidoId) {
    this.detallesAbiertos = this.detallesAbiertos || {};
    const det = document.getElementById(`detalle-${pedidoId}`);
    const res = document.getElementById(`resumen-${pedidoId}`);
    if (!det) return;
    const abierto = !det.classList.contains('hidden');
    if (abierto) {
      det.classList.add('hidden');
      if (res) res.classList.remove('hidden');
      this.detallesAbiertos[pedidoId] = false;
    } else {
      det.classList.remove('hidden');
      if (res) res.classList.add('hidden');
      this.detallesAbiertos[pedidoId] = true;
    }
  },

  toggleProductosPedido(pedidoId) {
    this.productosPedidoAbiertos = this.productosPedidoAbiertos || {};
    const box = document.getElementById(`productos-pedido-${pedidoId}`);
    const arrow = document.getElementById(`prod-arrow-${pedidoId}`);
    if (!box || !box.classList) return;
    const abierto = !box.classList.contains('hidden');
    if (abierto) {
      box.classList.add('hidden');
      if (arrow) arrow.textContent = '▾';
      this.productosPedidoAbiertos[pedidoId] = false;
    } else {
      box.classList.remove('hidden');
      if (arrow) arrow.textContent = '▴';
      this.productosPedidoAbiertos[pedidoId] = true;
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

    // Original: el del data attribute, o el total ACTUAL antes de ajustar
    let totalOriginal = parseFloat(card?.dataset?.totalOriginal);
    if (isNaN(totalOriginal) || totalOriginal <= 0) {
      totalOriginal = actual; // primera vez: congela el precio de ahora como “despachado”
      if (card) card.dataset.totalOriginal = String(totalOriginal);
    }

    // Devuelta: NO se toca
    let devueltaFija = parseFloat(card?.dataset?.devuelta);
    if (isNaN(devueltaFija) || devueltaFija < 0) {
      const BILLETE = 50000;
      const paga = Math.ceil(totalOriginal / BILLETE) * BILLETE;
      devueltaFija = Math.max(0, paga - totalOriginal);
      if (card) card.dataset.devuelta = String(devueltaFija);
      if (sel) sel.dataset.devuelta = String(devueltaFija);
    }

    const sp = document.getElementById(`signo-ajuste-${pedidoId}`);
    const signo = parseInt(sp?.dataset?.signo || '1', 10);
    const monto = parseFloat(document.getElementById(`monto-ajuste-${pedidoId}`)?.value);
    const motivo = (document.getElementById(`motivo-ajuste-${pedidoId}`)?.value || '').trim();

    if (isNaN(monto) || monto <= 0) return alert('Indica el monto del ajuste (ej. 20000)');
    if (!motivo) return alert('Escribe el motivo del cambio de precio');

    const ajuste = signo * monto;
    const nuevoTotal = Math.max(0, Math.round(actual + ajuste));
    const signoTxt = ajuste > 0 ? '+' : '';

    const prevObs = (document.getElementById(`motivo-txt-${pedidoId}`)?.textContent || '')
      .replace(/^📝\s*/, '').trim();
    const linea = `${signoTxt}${ajuste.toLocaleString('es-CO')}: ${motivo}`;
    const observacion = prevObs ? `${prevObs} | ${linea}` : linea;

    if (inpTotal) inpTotal.value = String(nuevoTotal);
    if (sel) {
      sel.dataset.total = String(nuevoTotal);
      sel.dataset.devuelta = String(devueltaFija); // se mantiene
    }

    const txt = document.getElementById(`total-txt-${pedidoId}`);
    if (txt) txt.innerText = `$${nuevoTotal.toLocaleString('es-CO')}`;

    const motivoEl = document.getElementById(`motivo-txt-${pedidoId}`);
    if (motivoEl) {
      motivoEl.textContent = '📝 ' + observacion;
      motivoEl.classList.remove('hidden');
    }

    const formulaEl = document.getElementById(`formula-txt-${pedidoId}`);
    if (formulaEl) {
      const d = nuevoTotal - totalOriginal;
      formulaEl.textContent =
        `$${totalOriginal.toLocaleString('es-CO')} ${d > 0 ? '+' : ''}${d.toLocaleString('es-CO')} [${motivo}] = $${nuevoTotal.toLocaleString('es-CO')}`;
      formulaEl.classList.remove('hidden');
    }

    // Caja = cobrado + devuelta fija (efectivo). Redondeado a $50: es lo que
    // físicamente se puede entregar en billetes/monedas.
    const elCaja = document.getElementById(`caja-line-${pedidoId}`);
    const metodo = sel?.value || 'EFECTIVO';
    const esTransfer = metodo === 'TRANSFERENCIA' || metodo === 'TRANSFERENCIA_PENDIENTE';
    const aCaja = this.redondearCaja50(esTransfer ? devueltaFija : (nuevoTotal + devueltaFija));
    if (elCaja) elCaja.innerText = `$${aCaja.toLocaleString('es-CO')}`;

    document.getElementById(`panel-ajuste-${pedidoId}`)?.classList.add('hidden');

    try {
      await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total: nuevoTotal,
          metodoPago: metodo,
          observacion,
          total_original: totalOriginal,
          // opcional: reforzar devuelta si el server la acepta
          // devuelta_calculada: devueltaFija
        })
      });
      this.recalcularArqueo();
      showToast(`Total: $${nuevoTotal.toLocaleString('es-CO')}`);
      // Refresca resumen colapsado con Despachado / Ajuste / observación
      await this.renderTabCuadre();
    } catch (e) {
      alert('No se pudo guardar el ajuste');
    }
  },

  _actualizarLineaCaja(pedidoId) {
    const sel = document.querySelector(`.sel-metodo[data-id="${pedidoId}"]`);
    const card = document.getElementById(`item-pedido-${pedidoId}`);
    const total = parseFloat(document.querySelector(`.inp-total[data-id="${pedidoId}"]`)?.value)
      || parseFloat(sel?.dataset?.total) || 0;
    const metodo = sel?.value || 'EFECTIVO';
    const esTransfer = metodo === 'TRANSFERENCIA' || metodo === 'TRANSFERENCIA_PENDIENTE';
    // La devuelta es FIJA: es la que quedó guardada en BD al momento del despacho
    // (devuelta_calculada). Si se despachó en efectivo, el domiciliario ya salió con
    // esa plata de cambio — se muestra aunque el cliente luego pague por transferencia.
    // Si se despachó en transferencia, devuelta_calculada ya quedó en $0.
    // NUNCA se recalcula aquí, solo se lee lo guardado.
    const devuelta = parseFloat(sel?.dataset?.devuelta) || parseFloat(card?.dataset?.devuelta) || 0;
    // Redondeado a $50: es lo que físicamente se puede entregar en billetes/monedas.
    const aCaja = this.redondearCaja50(esTransfer ? devuelta : (total + devuelta));

    const elCaja = document.getElementById(`caja-line-${pedidoId}`);
    const elHint = document.getElementById(`caja-hint-${pedidoId}`);
    const elDevLine = document.getElementById(`dev-line-${pedidoId}`);
    if (elCaja) elCaja.innerText = `$${aCaja.toLocaleString('es-CO')}`;
    if (elDevLine) {
      elDevLine.innerText = `$${devuelta.toLocaleString('es-CO')}`;
      elDevLine.closest('div')?.classList.toggle('hidden', !(devuelta > 0));
    }
    if (elHint) {
      elHint.textContent = esTransfer
        ? (devuelta > 0
            ? 'Transferencia: el domiciliario regresa la devuelta que salió con él.'
            : 'Transferencia: sin devuelta (se despachó sin cambio).')
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
        // Redondeado a $50: es el efectivo físico que realmente se entrega/recibe.
        totalEfectivoRecolectado += this.redondearCaja50(total);
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
  },

  // ==================================================================
  // MÓDULO DE AUDITORÍA, RUTAS DEL DÍA Y CARTERA PENDIENTE
  // ==================================================================

  toggleRutaAuditoria(rutaId) {
    this.rutasAuditoriaAbiertas[rutaId] = !this.rutasAuditoriaAbiertas[rutaId];
    this.renderTabAuditoria();
  },

  toggleAuditoriaProds(pedidoId) {
    this.prodsAuditoriaAbiertos[pedidoId] = !this.prodsAuditoriaAbiertos[pedidoId];
    this.renderTabAuditoria();
  },

  cambiarSubseccionAuditoria(sub) {
    this.subseccionAuditoria = sub;
    this.renderTabAuditoria();
  },

  onBuscarAuditoria(val) {
    this.filtroTextoAuditoria = (val || '').toLowerCase().trim();
    this.renderTabAuditoria();
  },

  setFiltroDomiciliarioAuditoria(dId) {
    this.filtroDomiciliarioAuditoria = dId ? String(dId) : '';
    this.renderTabAuditoria();
  },

  setVistaPendientesAuditoria(vista) {
    this.vistaPendientesAuditoria = vista;
    this.renderTabAuditoria();
  },

  fechaAyerLocal() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  async renderTabAuditoria() {
    const cont = document.getElementById('contenedor-subtab');
    if (!cont) return;

    cont.innerHTML = `
      <div class="flex flex-col items-center justify-center py-10 text-slate-400">
        <div class="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p class="text-xs">Cargando datos de auditoría...</p>
      </div>
    `;

    try {
      const fechaQuery = this.fechaFiltro ? `?fecha=${encodeURIComponent(this.fechaFiltro)}` : '';
      const res = await apiFetch(`/domicilios/auditoria${fechaQuery}`);
      if (!res || !res.ok) {
        throw new Error(res?.error || 'No se pudo cargar la auditoría');
      }

      this.auditoriaData = res;
      const { totales, rutas, resumenDomiciliarios, pagosPendientes, todosPagosPendientes, novedadesAjustes, fecha } = res;

      // Filtrado por buscador
      const q = this.filtroTextoAuditoria;
      const filtroDom = this.filtroDomiciliarioAuditoria;

      let rutasFiltradas = rutas || [];
      if (filtroDom) {
        rutasFiltradas = rutasFiltradas.filter(r => String(r.domiciliario_id) === filtroDom);
      }
      if (q) {
        rutasFiltradas = rutasFiltradas.filter(r => {
          const matchRuta = (r.domiciliario_nombre || '').toLowerCase().includes(q) || String(r.id).includes(q);
          const matchPedidos = r.pedidos?.some(p =>
            (p.codigo_pedido || '').toLowerCase().includes(q) ||
            (p.cliente || '').toLowerCase().includes(q) ||
            (p.telefono || '').toLowerCase().includes(q) ||
            (p.direccion || '').toLowerCase().includes(q)
          );
          return matchRuta || matchPedidos;
        });
      }

      // Lista de pagos pendientes a mostrar según el selector de vista
      const listaPendientes = (this.vistaPendientesAuditoria === 'todos' ? todosPagosPendientes : pagosPendientes) || [];
      const pendientesFiltrados = q
        ? listaPendientes.filter(p =>
            (p.codigo_pedido || '').toLowerCase().includes(q) ||
            (p.cliente || '').toLowerCase().includes(q) ||
            (p.telefono || '').toLowerCase().includes(q) ||
            (p.domiciliario_nombre || '').toLowerCase().includes(q)
          )
        : listaPendientes;

      const subActiva = this.subseccionAuditoria || 'rutas';
      const pillActiva = 'bg-indigo-600 text-white shadow-xs font-bold';
      const pillInactiva = 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium';

      cont.innerHTML = `
        <div class="space-y-4">
          <!-- CABECERA DE AUDITORÍA Y FILTRO DE FECHA -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <h3 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                📊 <span>Auditoría de Domicilios & Cierre</span>
              </h3>
              <p class="text-[11px] text-slate-500">
                ${fecha ? `Mostrando registros del día: <strong>${fecha}</strong>` : 'Mostrando histórico completo (sin filtro de fecha)'}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <button onclick="ModuloDomicilios.cambiarFecha(ModuloDomicilios.fechaHoyLocal())"
                class="px-2.5 py-1 text-xs rounded-lg font-semibold transition ${this.fechaFiltro === this.fechaHoyLocal() ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}">
                Hoy
              </button>
              <button onclick="ModuloDomicilios.cambiarFecha(ModuloDomicilios.fechaAyerLocal())"
                class="px-2.5 py-1 text-xs rounded-lg font-semibold transition ${this.fechaFiltro === this.fechaAyerLocal() ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}">
                Ayer
              </button>
              <button onclick="ModuloDomicilios.cambiarFecha('')"
                class="px-2.5 py-1 text-xs rounded-lg font-semibold transition ${!this.fechaFiltro ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}">
                Todos los días
              </button>
              <button onclick="ModuloDomicilios.imprimirAuditoria()"
                class="px-3 py-1 text-xs rounded-lg font-bold bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 shadow-xs flex items-center gap-1"
                title="Imprimir balance y auditoría en formato de impresora térmica de 80mm">
                🖨️ Imprimir (80mm)
              </button>
              <button onclick="ModuloDomicilios.renderTabAuditoria()"
                class="p-1.5 text-xs rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-100" title="Actualizar datos">
                🔄
              </button>
            </div>
          </div>

          <!-- TARJETAS DE CUADRE Y BALANCE FINANCIERO (KPIS) -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div class="flex items-center justify-between text-slate-500 mb-1">
                <span class="text-[11px] font-semibold uppercase">Total Facturado</span>
                <span class="text-sm">💰</span>
              </div>
              <p class="text-lg font-extrabold text-slate-900">
                $${(totales?.totalFacturado || 0).toLocaleString('es-CO')}
              </p>
              <p class="text-[10px] text-slate-500 mt-0.5">
                ${totales?.totalPedidos || 0} pedidos en ${totales?.rutasCount || 0} rutas
              </p>
            </div>

            <div class="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 shadow-xs">
              <div class="flex items-center justify-between text-emerald-700 mb-1">
                <span class="text-[11px] font-semibold uppercase">Efectivo Recibido</span>
                <span class="text-sm">💵</span>
              </div>
              <p class="text-lg font-extrabold text-emerald-900">
                $${(totales?.totalEfectivo || 0).toLocaleString('es-CO')}
              </p>
              <p class="text-[10px] text-emerald-700 mt-0.5">
                Dinero físico cobrado
              </p>
            </div>

            <div class="bg-sky-50/70 p-3 rounded-xl border border-sky-200 shadow-xs">
              <div class="flex items-center justify-between text-sky-700 mb-1">
                <span class="text-[11px] font-semibold uppercase">Transferencias</span>
                <span class="text-sm">📱</span>
              </div>
              <p class="text-lg font-extrabold text-sky-900">
                $${(totales?.totalTransferencia || 0).toLocaleString('es-CO')}
              </p>
              <p class="text-[10px] text-sky-700 mt-0.5">
                Bancolombia / Nequi / Daviplata
              </p>
            </div>

            <div class="bg-rose-50/70 p-3 rounded-xl border border-rose-200 shadow-xs">
              <div class="flex items-center justify-between text-rose-700 mb-1">
                <span class="text-[11px] font-semibold uppercase">Cartera Pendiente</span>
                <span class="text-sm">⏳</span>
              </div>
              <p class="text-lg font-extrabold text-rose-900">
                $${(totales?.totalPendiente || 0).toLocaleString('es-CO')}
              </p>
              <p class="text-[10px] text-rose-700 mt-0.5">
                ${pagosPendientes?.length || 0} pedidos por cobrar/verificar
              </p>
            </div>
          </div>

          <!-- SEGUNDA FILA DE KPIS: BASES Y AJUSTES -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span class="text-slate-600 font-medium">🛵 Bases de cambio entregadas:</span>
              <span class="font-bold text-slate-800">$${(totales?.totalBases || 0).toLocaleString('es-CO')}</span>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span class="text-slate-600 font-medium">⚖️ Novedades / Ajustes de precio:</span>
              <span class="font-bold ${(totales?.novedadesCount || 0) > 0 ? 'text-amber-700' : 'text-slate-800'}">
                ${totales?.novedadesCount || 0} ajustes registrados
              </span>
            </div>
          </div>

          <!-- NAVEGACIÓN DE SUBSECCIONES DE AUDITORÍA -->
          <div class="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
            <button onclick="ModuloDomicilios.cambiarSubseccionAuditoria('rutas')"
              class="px-3 py-1.5 text-xs rounded-lg transition ${subActiva === 'rutas' ? pillActiva : pillInactiva}">
              📋 Rutas Auditadas (${rutas?.length || 0})
            </button>
            <button onclick="ModuloDomicilios.cambiarSubseccionAuditoria('domiciliarios')"
              class="px-3 py-1.5 text-xs rounded-lg transition ${subActiva === 'domiciliarios' ? pillActiva : pillInactiva}">
              🛵 Por Domiciliario (${resumenDomiciliarios?.length || 0})
            </button>
            <button onclick="ModuloDomicilios.cambiarSubseccionAuditoria('pendientes')"
              class="px-3 py-1.5 text-xs rounded-lg transition ${subActiva === 'pendientes' ? pillActiva : pillInactiva}">
              ⏳ Cartera & Pendientes (${pagosPendientes?.length || 0})
            </button>
            <button onclick="ModuloDomicilios.cambiarSubseccionAuditoria('novedades')"
              class="px-3 py-1.5 text-xs rounded-lg transition ${subActiva === 'novedades' ? pillActiva : pillInactiva}">
              ⚖️ Ajustes de Precios (${novedadesAjustes?.length || 0})
            </button>
          </div>

          <!-- BUSCADOR RÁPIDO DE AUDITORÍA -->
          <div class="relative">
            <input type="text"
              placeholder="🔍 Buscar por cliente, teléfono, código de pedido o domiciliario..."
              value="${this.filtroTextoAuditoria || ''}"
              oninput="ModuloDomicilios.onBuscarAuditoria(this.value)"
              class="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs">
            ${this.filtroTextoAuditoria ? `
              <button onclick="ModuloDomicilios.onBuscarAuditoria('')" class="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600">
                ✕ Limpiar
              </button>
            ` : ''}
          </div>

          <!-- CONTENIDO SEGÚN LA SUBSECCIÓN SELECCIONADA -->
          <div id="contenedor-detalle-auditoria">
            ${this.renderSubseccionAuditoria({
              subActiva,
              rutas: rutasFiltradas,
              resumenDomiciliarios,
              pendientes: pendientesFiltrados,
              todosPendientesCount: todosPagosPendientes?.length || 0,
              diaPendientesCount: pagosPendientes?.length || 0,
              novedades: novedadesAjustes,
              filtroDom
            })}
          </div>
        </div>
      `;
    } catch (err) {
      cont.innerHTML = `
        <div class="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs space-y-2 text-center">
          <p class="font-bold">Error al cargar la información de auditoría:</p>
          <p>${err.message}</p>
          <button onclick="ModuloDomicilios.renderTabAuditoria()" class="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700">
            Reintentar
          </button>
        </div>
      `;
    }
  },

  renderSubseccionAuditoria({ subActiva, rutas, resumenDomiciliarios, pendientes, todosPendientesCount, diaPendientesCount, novedades, filtroDom }) {
    if (subActiva === 'rutas') {
      return this.renderSubseccionRutas(rutas, resumenDomiciliarios, filtroDom);
    } else if (subActiva === 'domiciliarios') {
      return this.renderSubseccionDomiciliarios(resumenDomiciliarios);
    } else if (subActiva === 'pendientes') {
      return this.renderSubseccionPendientes(pendientes, todosPendientesCount, diaPendientesCount);
    } else if (subActiva === 'novedades') {
      return this.renderSubseccionNovedades(novedades);
    }
    return '';
  },

  renderSubseccionRutas(rutas, domiciliarios, filtroDom) {
    if (!rutas || rutas.length === 0) {
      return `
        <div class="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
          <p class="text-2xl mb-1">🚚</p>
          <p class="font-semibold text-slate-700">No se encontraron rutas para los filtros seleccionados.</p>
          <p class="text-[11px] text-slate-400 mt-1">Prueba seleccionando otra fecha o limpiando la búsqueda.</p>
        </div>
      `;
    }

    return `
      <div class="space-y-3">
        <!-- FILTRO POR DOMICILIARIO -->
        <div class="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200">
          <label class="font-semibold text-slate-600">Filtrar por domiciliario:</label>
          <select onchange="ModuloDomicilios.setFiltroDomiciliarioAuditoria(this.value)"
                  class="border border-slate-300 rounded-md px-2 py-1 bg-white text-xs text-slate-800">
            <option value="">Todos los domiciliarios</option>
            ${domiciliarios.map(d => `
              <option value="${d.domiciliario_id}" ${filtroDom === String(d.domiciliario_id) ? 'selected' : ''}>
                ${d.nombre} (${d.rutas_count} rutas)
              </option>
            `).join('')}
          </select>
        </div>

        <!-- LISTA DE RUTAS CON BOTÓN DESPLEGABLE -->
        <div class="space-y-3">
          ${rutas.map(r => {
            const abierta = !!this.rutasAuditoriaAbiertas[r.id];
            const esLiquidada = r.estado === 'LIQUIDADA';
            const horaSalida = r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
            const horaCierre = r.fecha_liquidacion ? new Date(r.fecha_liquidacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

            return `
              <div class="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition">
                <!-- ENCABEZADO DE LA RUTA -->
                <div class="p-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                      #${r.id}
                    </span>
                    <div>
                      <h4 class="text-xs font-bold text-slate-900 flex items-center gap-2">
                        ${r.domiciliario_nombre || 'Sin asignar'}
                        ${esLiquidada
                          ? `<span class="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">✅ Liquidada</span>`
                          : `<span class="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">🚚 En calle</span>`}
                      </h4>
                      <p class="text-[10px] text-slate-500">
                        Salida: ${horaSalida}${horaCierre ? ` · Cierre: ${horaCierre}` : ''}
                      </p>
                    </div>
                  </div>

                  <!-- RESUMEN DE LA RUTA EN CHIPS -->
                  <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span class="px-2 py-0.5 bg-white border rounded text-slate-700">
                      📦 <strong>${r.pedidos?.length || 0}</strong> pedidos
                    </span>
                    <span class="px-2 py-0.5 bg-white border rounded text-slate-700">
                      💵 Recaudado: <strong>$${(r.total_recolectado || r.efectivo || 0).toLocaleString('es-CO')}</strong>
                    </span>
                    <span class="px-2 py-0.5 bg-white border rounded text-slate-700">
                      🛵 Base: <strong>$${(r.base_efectivo || 0).toLocaleString('es-CO')}</strong>
                    </span>
                  </div>
                </div>

                <!-- BOTÓN DESPLEGABLE DE DETALLES Y TICKET 80MM -->
                <div class="px-3.5 py-2 bg-white flex items-center justify-between border-b border-slate-100">
                  <span class="text-[11px] text-slate-500">
                    ${r.entregados || 0} entregados · ${r.no_entregados || 0} devueltos · ${r.pendiente > 0 ? `$${r.pendiente.toLocaleString('es-CO')} por cobrar` : 'Al día'}
                  </span>
                  <div class="flex items-center gap-1.5">
                    <button onclick="ModuloDomicilios.imprimirTicketRuta80mm(${r.id})"
                      class="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition"
                      title="Imprimir comprobante de esta ruta en formato térmico 80mm">
                      🖨️ Ticket 80mm
                    </button>
                    <button onclick="ModuloDomicilios.toggleRutaAuditoria(${r.id})"
                      class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1 transition">
                      <span>${abierta ? '▴ Ocultar' : '▾ Ver Pedidos (' + (r.pedidos?.length || 0) + ')'}</span>
                    </button>
                  </div>
                </div>

                <!-- CONTENIDO DESPLEGABLE DE LA RUTA -->
                ${abierta ? `
                  <div class="p-3.5 space-y-3 bg-slate-50/40">
                    <!-- BALANCE DE CAJA DE LA RUTA -->
                    <div class="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                      <p class="font-bold text-slate-800 text-[11px] uppercase tracking-wide">Cuadre de Efectivo de la Ruta</p>
                      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                        <div>
                          <span class="text-slate-500">Base entregada:</span>
                          <p class="font-semibold text-slate-800">$${(r.base_efectivo || 0).toLocaleString('es-CO')}</p>
                        </div>
                        <div>
                          <span class="text-slate-500">Efectivo cobrado:</span>
                          <p class="font-semibold text-emerald-700">+$${(r.efectivo || 0).toLocaleString('es-CO')}</p>
                        </div>
                        <div>
                          <span class="text-slate-500">Total a entregar:</span>
                          <p class="font-bold text-slate-900">$${((r.base_efectivo || 0) + (r.efectivo || 0)).toLocaleString('es-CO')}</p>
                        </div>
                        <div>
                          <span class="text-slate-500">Recibido en caja:</span>
                          <p class="font-bold ${esLiquidada ? 'text-indigo-700' : 'text-slate-500'}">
                            ${esLiquidada ? `$${(r.total_recolectado || 0).toLocaleString('es-CO')}` : 'Pendiente liquidar'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- LISTA DE PEDIDOS ASIGNADOS -->
                    <div class="space-y-2">
                      <p class="text-xs font-bold text-slate-700">Facturas y Pedidos (${r.pedidos?.length || 0}):</p>
                      ${r.pedidos.map(p => {
                        const prodsAbiertos = !!this.prodsAuditoriaAbiertos[p.id];
                        const celLimpio = (p.telefono || '').replace(/\D/g, '');
                        const waLink = celLimpio ? `https://wa.me/${celLimpio.startsWith('57') ? celLimpio : '57' + celLimpio}` : null;
                        const huboAjuste = p.total_original != null && Number(p.total_original) > 0 && Number(p.total_original) !== Number(p.total);

                        return `
                          <div class="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-2 shadow-2xs">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div>
                                <span class="font-mono font-bold text-indigo-700 text-xs mr-2">#${p.codigo_pedido || p.id}</span>
                                <span class="font-bold text-slate-900">${p.cliente || 'Cliente'}</span>
                                ${p.telefono ? `
                                  <span class="text-slate-500 ml-1">· 📞 ${p.telefono}</span>
                                  ${waLink ? `
                                    <a href="${waLink}" target="_blank" class="inline-block ml-1 text-emerald-600 hover:text-emerald-700 font-bold" title="Abrir WhatsApp">
                                      💬 WhatsApp
                                    </a>
                                  ` : ''}
                                ` : ''}
                              </div>

                              <div class="flex items-center gap-1.5">
                                ${p.estado_entrega === 'ENTREGADO'
                                  ? `<span class="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-bold">Entregado</span>`
                                  : (p.estado_entrega === 'NO_ENTREGADO'
                                      ? `<span class="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded font-bold">No entregado</span>`
                                      : `<span class="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-bold">Pendiente entrega</span>`)}

                                <span class="font-extrabold text-slate-900 text-sm">
                                  $${(p.total || 0).toLocaleString('es-CO')}
                                </span>
                              </div>
                            </div>

                            <div class="text-[11px] text-slate-600 flex flex-wrap justify-between items-center gap-2 pt-1 border-t border-slate-100">
                              <div>
                                📍 ${p.direccion || 'Sin dirección'}${p.municipio ? `, ${p.municipio}` : ''}
                              </div>
                              <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">
                                  💳 ${p.metodo_pago_final || 'Por definir'}
                                  ${p.comprobante_transf ? ` (#${p.comprobante_transf})` : ''}
                                </span>
                                ${huboAjuste ? `
                                  <span class="px-2 py-0.5 bg-amber-100 text-amber-800 font-semibold rounded text-[10px]">
                                    ⚠️ Ajustado de $${Number(p.total_original).toLocaleString('es-CO')}
                                  </span>
                                ` : ''}
                              </div>
                            </div>

                            ${p.observacion ? `
                              <div class="bg-slate-50 p-2 rounded text-[11px] text-slate-600 italic">
                                Nota: ${p.observacion}
                              </div>
                            ` : ''}

                            <!-- BOTÓN DESPLEGABLE DE PRODUCTOS DE LA FACTURA -->
                            <div class="pt-1">
                              <button onclick="ModuloDomicilios.toggleAuditoriaProds(${p.id})"
                                class="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                <span>🛒 ${prodsAbiertos ? 'Ocultar productos' : 'Ver productos de esta factura (' + (p.items?.length || 0) + ')'}</span>
                                <span>${prodsAbiertos ? '▴' : '▾'}</span>
                              </button>

                              ${prodsAbiertos ? `
                                <div class="mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                  ${p.items && p.items.length > 0 ? `
                                    <table class="w-full text-left text-[11px]">
                                      <thead>
                                        <tr class="border-b border-slate-200 text-slate-500">
                                          <th class="py-1">SKU</th>
                                          <th class="py-1">Producto</th>
                                          <th class="py-1 text-right">Cant.</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        ${p.items.map(it => `
                                          <tr class="border-b border-slate-100 text-slate-700">
                                            <td class="py-1 font-mono text-slate-500">${it.sku || '—'}</td>
                                            <td class="py-1 font-medium">${it.nombre_producto || 'Ítem'}</td>
                                            <td class="py-1 text-right font-bold">${it.cantidad_solicitada || 1}</td>
                                          </tr>
                                        `).join('')}
                                      </tbody>
                                    </table>
                                  ` : `
                                    <p class="text-[11px] text-slate-400 italic">No hay detalle de productos registrado para este pedido.</p>
                                  `}
                                </div>
                              ` : ''}
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  renderSubseccionDomiciliarios(domiciliarios) {
    if (!domiciliarios || domiciliarios.length === 0) {
      return `
        <div class="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
          <p class="text-2xl mb-1">🛵</p>
          <p class="font-semibold text-slate-700">No hay domiciliarios con rutas en la fecha seleccionada.</p>
        </div>
      `;
    }

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${domiciliarios.map(d => {
          const tasaEntrega = d.pedidos_totales > 0
            ? Math.round((d.pedidos_entregados / d.pedidos_totales) * 100)
            : 0;

          const celLimpio = (d.telefono || '').replace(/\D/g, '');
          const waLink = celLimpio ? `https://wa.me/${celLimpio.startsWith('57') ? celLimpio : '57' + celLimpio}` : null;

          return `
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                    🛵
                  </div>
                  <div>
                    <h4 class="font-bold text-sm text-slate-900">${d.nombre}</h4>
                    <p class="text-[11px] text-slate-500 flex items-center gap-2">
                      ${d.telefono ? `📞 ${d.telefono}` : 'Sin teléfono'}
                      ${waLink ? `
                        <a href="${waLink}" target="_blank" class="text-emerald-600 hover:text-emerald-700 font-bold">
                          💬 WhatsApp
                        </a>
                      ` : ''}
                    </p>
                  </div>
                </div>

                <span class="px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
                  ${d.rutas_count} ${d.rutas_count === 1 ? 'ruta' : 'rutas'}
                </span>
              </div>

              <!-- MÉTRICAS DE PEDIDOS Y EFECTIVIDAD -->
              <div class="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-center text-xs">
                <div>
                  <span class="text-slate-400 text-[10px] block">Pedidos</span>
                  <span class="font-bold text-slate-800">${d.pedidos_totales}</span>
                </div>
                <div>
                  <span class="text-slate-400 text-[10px] block">Entregados</span>
                  <span class="font-bold text-emerald-700">${d.pedidos_entregados}</span>
                </div>
                <div>
                  <span class="text-slate-400 text-[10px] block">Efectividad</span>
                  <span class="font-bold ${tasaEntrega >= 90 ? 'text-emerald-700' : 'text-amber-700'}">${tasaEntrega}%</span>
                </div>
              </div>

              <!-- DESGLOSE FINANCIERO -->
              <div class="space-y-1.5 text-xs border-t border-slate-100 pt-2 text-slate-700">
                <div class="flex justify-between">
                  <span>💵 Efectivo cobrado:</span>
                  <span class="font-semibold text-slate-900">$${d.total_efectivo.toLocaleString('es-CO')}</span>
                </div>
                <div class="flex justify-between">
                  <span>📱 Transferencias reportadas:</span>
                  <span class="font-semibold text-slate-900">$${d.total_transferencia.toLocaleString('es-CO')}</span>
                </div>
                <div class="flex justify-between">
                  <span>⏳ Pagos pendientes:</span>
                  <span class="font-semibold text-rose-600">$${d.total_pendiente.toLocaleString('es-CO')}</span>
                </div>
                <div class="flex justify-between">
                  <span>🛵 Bases entregadas:</span>
                  <span class="font-semibold text-slate-700">$${d.total_bases.toLocaleString('es-CO')}</span>
                </div>
                <div class="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                  <span>📥 Entregado a caja:</span>
                  <span class="text-indigo-700">$${d.total_recolectado.toLocaleString('es-CO')}</span>
                </div>
              </div>

              <button onclick="ModuloDomicilios.setFiltroDomiciliarioAuditoria(${d.domiciliario_id}); ModuloDomicilios.cambiarSubseccionAuditoria('rutas');"
                class="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition">
                🔍 Ver rutas de este domiciliario
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderSubseccionPendientes(pendientes, todosCount, diaCount) {
    const esVistaTodos = this.vistaPendientesAuditoria === 'todos';

    return `
      <div class="space-y-3">
        <!-- SELECTOR DE VISTA: DEL DÍA VS TODA LA CARTERA -->
        <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
          <span class="font-bold text-slate-700">Alcance de pagos pendientes:</span>
          <div class="flex items-center gap-1.5">
            <button onclick="ModuloDomicilios.setVistaPendientesAuditoria('dia')"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition ${!esVistaTodos ? 'bg-slate-900 text-white' : 'bg-white border text-slate-700'}">
              De la fecha seleccionada (${diaCount})
            </button>
            <button onclick="ModuloDomicilios.setVistaPendientesAuditoria('todos')"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition ${esVistaTodos ? 'bg-slate-900 text-white' : 'bg-white border text-slate-700'}">
              Toda la cartera histórica (${todosCount})
            </button>
          </div>
        </div>

        ${(!pendientes || pendientes.length === 0) ? `
          <div class="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
            <p class="text-2xl mb-1">🎉</p>
            <p class="font-semibold text-slate-700">No hay pagos pendientes en esta vista.</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Todas las facturas están al día o liquidadas.</p>
          </div>
        ` : `
          <div class="space-y-2.5">
            ${pendientes.map(p => {
              const celLimpio = (p.telefono || '').replace(/\D/g, '');
              const textoWa = encodeURIComponent(`Hola ${p.cliente || ''}, te saludamos de la tienda respecto a tu pedido #${p.codigo_pedido || p.id} por valor de $${Number(p.total || 0).toLocaleString('es-CO')}. ¿Nos confirmas por favor el soporte de pago? ¡Muchas gracias!`);
              const waLink = celLimpio ? `https://wa.me/${celLimpio.startsWith('57') ? celLimpio : '57' + celLimpio}?text=${textoWa}` : null;
              const fechaDisplay = p.fecha_pedido_ruta || (p.fecha_creacion ? p.fecha_creacion.slice(0, 10) : 'Sin fecha');

              return `
                <div class="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-xs space-y-2">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold text-indigo-700 text-xs">#${p.codigo_pedido || p.id}</span>
                        <span class="font-bold text-slate-900 text-sm">${p.cliente || 'Cliente'}</span>
                        <span class="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded font-semibold">
                          ${p.metodo_pago_final === 'TRANSFERENCIA_PENDIENTE' ? 'Transferencia por verificar' : (p.metodo_pago_final === 'CREDITO' ? 'Crédito cliente' : 'Pago pendiente')}
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-500 mt-0.5">
                        📅 Fecha: <strong>${fechaDisplay}</strong> · Domiciliario: <strong>${p.domiciliario_nombre || 'Sin asignar'}</strong> ${p.ruta_id ? `(Ruta #${p.ruta_id})` : ''}
                      </p>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="text-base font-extrabold text-rose-600">
                        $${Number(p.total || 0).toLocaleString('es-CO')}
                      </span>
                      <button onclick="ModuloDomicilios.abrirModalConfirmarPago(${p.id}, '${(p.cliente || '').replace(/'/g, "\\'")}', ${p.total || 0}, '${p.codigo_pedido || ''}')"
                        class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition">
                        ✅ Confirmar Pago
                      </button>
                    </div>
                  </div>

                  <div class="text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
                    <div>
                      📍 ${p.direccion || 'Sin dirección'}${p.municipio ? `, ${p.municipio}` : ''}
                      ${p.telefono ? ` · 📞 ${p.telefono}` : ''}
                    </div>
                    ${waLink ? `
                      <a href="${waLink}" target="_blank"
                        class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold flex items-center gap-1">
                        💬 Cobrar por WhatsApp
                      </a>
                    ` : ''}
                  </div>

                  ${p.observacion ? `
                    <div class="bg-amber-50/70 border border-amber-200/50 p-2 rounded text-[11px] text-amber-900 italic">
                      Observación: ${p.observacion}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  },

  renderSubseccionNovedades(novedades) {
    if (!novedades || novedades.length === 0) {
      return `
        <div class="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
          <p class="text-2xl mb-1">⚖️</p>
          <p class="font-semibold text-slate-700">No hay ajustes de precio registrados en la fecha seleccionada.</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Todos los pedidos se cobraron con el valor original despachado.</p>
        </div>
      `;
    }

    return `
      <div class="space-y-2.5">
        <p class="text-xs text-slate-600">
          Listado de pedidos donde el valor final cobrado fue diferente al valor originalmente despachado:
        </p>

        ${novedades.map(n => `
          <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span class="font-mono font-bold text-indigo-700 mr-1.5">#${n.codigo_pedido || n.pedido_id}</span>
                <span class="font-bold text-slate-900">${n.cliente || 'Cliente'}</span>
                <span class="text-slate-500 text-[11px] ml-1">· Domiciliario: ${n.domiciliario_nombre} (Ruta #${n.ruta_id})</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-slate-400 line-through text-[11px]">
                  $${n.total_original.toLocaleString('es-CO')}
                </span>
                <span class="font-extrabold text-slate-900 text-sm">
                  $${n.total_final.toLocaleString('es-CO')}
                </span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${n.diferencia < 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
                  ${n.diferencia < 0 ? `-$${Math.abs(n.diferencia).toLocaleString('es-CO')}` : `+$${n.diferencia.toLocaleString('es-CO')}`}
                </span>
              </div>
            </div>

            <div class="bg-slate-50 p-2 rounded text-[11px] text-slate-700">
              <strong>Motivo / Justificación:</strong> ${n.observacion || 'Sin justificación registrada'}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  abrirModalConfirmarPago(pedidoId, cliente, total, codigoPedido) {
    const modalExistente = document.getElementById('modal-confirmar-pago');
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-confirmar-pago';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-slate-200">
        <div class="flex justify-between items-start border-b pb-3">
          <div>
            <h3 class="text-sm font-bold text-slate-900">✅ Confirmar Pago de Cartera</h3>
            <p class="text-xs text-slate-500">Pedido #${codigoPedido || pedidoId} - ${cliente || 'Cliente'}</p>
          </div>
          <button onclick="ModuloDomicilios.cerrarModalConfirmarPago()" class="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex justify-between items-center">
          <span>Valor a Registrar / Cobrar:</span>
          <span class="text-base font-extrabold text-amber-950">$${Number(total || 0).toLocaleString('es-CO')}</span>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Medio de Pago Recibido:</label>
            <select id="modal-metodo-pago" class="w-full border rounded-lg p-2 bg-white text-slate-800 font-medium" onchange="ModuloDomicilios.onCambiarMetodoModal(this.value)">
              <option value="TRANSFERENCIA">📱 Transferencia (Bancolombia / Nequi / Daviplata)</option>
              <option value="EFECTIVO">💵 Efectivo</option>
            </select>
          </div>

          <div id="modal-campo-comprobante">
            <label class="block font-semibold text-slate-700 mb-1">Número de Comprobante / Aprobación:</label>
            <input type="text" id="modal-inp-comprobante" placeholder="Ej: NEQ-82910293 o últimos dígitos" class="w-full border rounded-lg p-2 font-mono">
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Nota / Observación de Auditoría (Opcional):</label>
            <input type="text" id="modal-inp-nota" placeholder="Ej: Confirmado en extracto bancario a las 4:00 PM" class="w-full border rounded-lg p-2">
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t">
          <button onclick="ModuloDomicilios.cerrarModalConfirmarPago()" class="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancelar
          </button>
          <button onclick="ModuloDomicilios.guardarConfirmarPago(${pedidoId})" class="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm">
            💾 Guardar y Liquidar Pago
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  onCambiarMetodoModal(val) {
    const campoComp = document.getElementById('modal-campo-comprobante');
    if (campoComp) {
      if (val === 'EFECTIVO') campoComp.classList.add('hidden');
      else campoComp.classList.remove('hidden');
    }
  },

  cerrarModalConfirmarPago() {
    const modal = document.getElementById('modal-confirmar-pago');
    if (modal) modal.remove();
  },

  async guardarConfirmarPago(pedidoId) {
    const metodo = document.getElementById('modal-metodo-pago')?.value || 'TRANSFERENCIA';
    const comprobante = document.getElementById('modal-inp-comprobante')?.value.trim() || '';
    const nota = document.getElementById('modal-inp-nota')?.value.trim() || '';

    if (metodo === 'TRANSFERENCIA' && !comprobante) {
      alert('Por favor ingresa el número de comprobante o referencia de la transferencia.');
      return;
    }

    try {
      const res = await apiFetch('/domicilios/confirmar-pago-pendiente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, metodoPago: metodo, comprobante, nota })
      });

      if (res && res.ok) {
        showToast('Pago confirmado y liquidado exitosamente', 'success');
        this.cerrarModalConfirmarPago();
        await this.renderTabAuditoria();
      } else {
        showToast(res.error || 'No se pudo registrar el pago', 'error');
      }
    } catch (e) {
      showToast('Error de conexión al registrar pago', 'error');
    }
  },

  imprimirAuditoria() {
    if (!this.auditoriaData) return;
    const { fecha, totales, resumenDomiciliarios, rutas, pagosPendientes, novedadesAjustes } = this.auditoriaData;
    const fechaTexto = fecha || this.fechaHoyLocal();
    const ahora = new Date();
    const horaFormateada = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const totalEfectivoCaja = (totales?.totalRecolectadoRutas || ((totales?.totalEfectivo || 0) + (totales?.totalBases || 0)));

    let filasDomiciliarios = '';
    (resumenDomiciliarios || []).forEach(d => {
      filasDomiciliarios += `
        <div style="margin-bottom: 5px;">
          <div class="bold">• ${escapeHtml(d.nombre).toUpperCase()}</div>
          <div style="padding-left: 6px; font-size: 9.5px; color: #111;">
            Rutas: ${d.rutas_count} | Ped: ${d.pedidos_totales} (Ent: ${d.pedidos_entregados})<br>
            Efec: $${d.total_efectivo.toLocaleString('es-CO')} | Transf: $${d.total_transferencia.toLocaleString('es-CO')}<br>
            Base: $${d.total_bases.toLocaleString('es-CO')} | Pend: $${d.total_pendiente.toLocaleString('es-CO')}<br>
            <b>A Caja: $${d.total_recolectado.toLocaleString('es-CO')}</b>
          </div>
        </div>
      `;
    });

    let filasRutas = '';
    (rutas || []).forEach(r => {
      const horaSal = r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      const horaCie = r.fecha_liquidacion ? new Date(r.fecha_liquidacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      filasRutas += `
        <div style="margin-bottom: 4px; font-size: 9.5px;">
          <div class="bold">Ruta #${r.id} - ${escapeHtml(r.domiciliario_nombre)} [${r.estado}]</div>
          <div>Sal: ${horaSal} | Cie: ${horaCie} | Ped: ${r.pedidos?.length || 0}</div>
          <div>Efec: $${(r.efectivo || 0).toLocaleString('es-CO')} | Transf: $${(r.transferencia || 0).toLocaleString('es-CO')}</div>
          <div>Base: $${(r.base_efectivo || 0).toLocaleString('es-CO')} | <b>A Caja: $${(r.total_recolectado || 0).toLocaleString('es-CO')}</b></div>
        </div>
      `;
    });

    let bloquePendientes = '';
    if (pagosPendientes && pagosPendientes.length > 0) {
      bloquePendientes = `
        <div class="divider-double"></div>
        <div class="bold text-center">CARTERA PENDIENTE (${pagosPendientes.length})</div>
        <div class="divider"></div>
        ${pagosPendientes.map(p => `
          <div style="font-size: 9px; margin-bottom: 3px;">
            <b>#${escapeHtml(p.codigo_pedido || String(p.id))}</b> ${escapeHtml(p.cliente || 'Cliente')}<br>
            Val: <b>$${Number(p.total || 0).toLocaleString('es-CO')}</b> | ${escapeHtml(p.metodo_pago_final || 'Pendiente')}
            ${p.domiciliario_nombre ? `<br>Dom: ${escapeHtml(p.domiciliario_nombre)}` : ''}
          </div>
        `).join('')}
      `;
    }

    let bloqueNovedades = '';
    if (novedadesAjustes && novedadesAjustes.length > 0) {
      bloqueNovedades = `
        <div class="divider-double"></div>
        <div class="bold text-center">AJUSTES DE PRECIO (${novedadesAjustes.length})</div>
        <div class="divider"></div>
        ${novedadesAjustes.map(n => `
          <div style="font-size: 9px; margin-bottom: 3px;">
            <b>#${escapeHtml(n.codigo_pedido || String(n.pedido_id))}</b> ${escapeHtml(n.cliente || '')}<br>
            Orig: $${n.total_original.toLocaleString('es-CO')} → Cobrado: <b>$${n.total_final.toLocaleString('es-CO')}</b><br>
            Dif: <b>${n.diferencia < 0 ? `-$${Math.abs(n.diferencia).toLocaleString('es-CO')}` : `+$${n.diferencia.toLocaleString('es-CO')}`}</b>
            ${n.observacion ? `<br><i>Motivo: ${escapeHtml(n.observacion)}</i>` : ''}
          </div>
        `).join('')}
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Auditoría Domicilios (80mm) - ${fechaTexto}</title>
        <style>
          @page {
            margin: 0;
            size: 80mm auto;
          }
          @media print {
            .no-print { display: none !important; }
            body {
              width: 72mm;
              margin: 0 auto;
              padding: 2mm 0;
            }
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm;
            margin: 0 auto;
            padding: 4mm 1mm;
            font-size: 11px;
            color: #000;
            line-height: 1.25;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .divider-double { border-top: 2px solid #000; margin: 5px 0; }
          .logo { max-width: 48mm; max-height: 20mm; margin: 0 auto 3px auto; display: block; }
          table { width: 100%; border-collapse: collapse; margin: 3px 0; font-size: 10px; }
          th, td { padding: 1.5px 0; vertical-align: top; }
          .btn-print {
            display: inline-block;
            padding: 8px 14px;
            background: #0f172a;
            color: #fff;
            font-weight: bold;
            font-size: 12px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
          }
          .firma-box {
            margin-top: 22px;
            text-align: center;
          }
          .firma-line {
            border-top: 1px dashed #000;
            width: 85%;
            margin: 0 auto 3px auto;
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: center; margin-bottom: 8px; padding: 6px; background: #f1f5f9; border-radius: 6px;">
          <button onclick="window.print()" class="btn-print">🖨️ Imprimir Ticket (80mm)</button>
          <div style="font-size: 10px; color: #475569; margin-top: 4px;">Formato optimizado para rollo térmico de 80mm</div>
        </div>

        <div class="text-center">
          <img src="/img/Logo.png" class="logo" alt="Logo" onerror="this.style.display='none';" />
          <div class="bold" style="font-size: 14px; margin-top: 2px;">JISPIPLAST</div>
          <div style="font-size: 10px;">Olga Inés Bueno Pineda</div>
          <div style="font-size: 10px;">Calle 13 #15-20</div>
        </div>

        <div class="divider-double"></div>
        <div class="text-center bold" style="font-size: 12px;">CIERRE & AUDITORÍA DOMICILIOS</div>
        <div class="divider"></div>

        <table>
          <tr>
            <td><b>Fecha auditada:</b></td>
            <td class="text-right"><b>${fechaTexto}</b></td>
          </tr>
          <tr>
            <td><b>Hora reporte:</b></td>
            <td class="text-right">${horaFormateada}</td>
          </tr>
          <tr>
            <td><b>Rutas cerradas:</b></td>
            <td class="text-right">${totales?.rutasCount || 0}</td>
          </tr>
          <tr>
            <td><b>Pedidos totales:</b></td>
            <td class="text-right">${totales?.totalPedidos || 0} (${totales?.totalEntregados || 0} entregados)</td>
          </tr>
        </table>

        <div class="divider-double"></div>
        <div class="bold text-center">BALANCE GENERAL</div>
        <div class="divider"></div>

        <table>
          <tr>
            <td>Total Facturado:</td>
            <td class="text-right bold">$${(totales?.totalFacturado || 0).toLocaleString('es-CO')}</td>
          </tr>
          <tr>
            <td>(+) Efectivo Cobrado:</td>
            <td class="text-right bold">$${(totales?.totalEfectivo || 0).toLocaleString('es-CO')}</td>
          </tr>
          <tr>
            <td>(+) Transferencias:</td>
            <td class="text-right">$${(totales?.totalTransferencia || 0).toLocaleString('es-CO')}</td>
          </tr>
          <tr>
            <td>(!) Cartera Pendiente:</td>
            <td class="text-right bold" style="color: #000;">$${(totales?.totalPendiente || 0).toLocaleString('es-CO')}</td>
          </tr>
          <tr>
            <td>Bases Entregadas:</td>
            <td class="text-right">$${(totales?.totalBases || 0).toLocaleString('es-CO')}</td>
          </tr>
        </table>

        <div class="divider"></div>
        <table>
          <tr style="font-size: 12px;">
            <td class="bold">TOTAL ENTRADA A CAJA:</td>
            <td class="text-right bold">$${totalEfectivoCaja.toLocaleString('es-CO')}</td>
          </tr>
          <tr>
            <td colspan="2" style="font-size: 8.5px; color: #333;">(Efectivo cobrado + Retorno de bases)</td>
          </tr>
        </table>

        <div class="divider-double"></div>
        <div class="bold text-center">POR DOMICILIARIO</div>
        <div class="divider"></div>
        ${filasDomiciliarios || '<div class="text-center" style="font-size: 9.5px;">Sin domiciliarios registrados</div>'}

        <div class="divider-double"></div>
        <div class="bold text-center">RUTAS REALIZADAS (${rutas?.length || 0})</div>
        <div class="divider"></div>
        ${filasRutas || '<div class="text-center" style="font-size: 9.5px;">Sin rutas registradas</div>'}

        ${bloquePendientes}
        ${bloqueNovedades}

        <div class="divider-double"></div>
        <div class="text-center bold" style="font-size: 9.5px; margin-top: 10px;">CONFORMIDAD DE CIERRE</div>

        <div class="firma-box">
          <div class="firma-line"></div>
          <div style="font-size: 9px;">ENTREGA (Domiciliarios)</div>
        </div>

        <div class="firma-box">
          <div class="firma-line"></div>
          <div style="font-size: 9px;">RECIBE (Caja / Auditoría)</div>
        </div>

        <div class="divider" style="margin-top: 14px;"></div>
        <div class="text-center bold" style="font-size: 8.5px; margin-top: 4px;">
          *** CIERRE AUDITADO ***<br>
          <span style="font-weight: normal;">Jispiplast Sistema de Domicilios</span>
        </div>
      </body>
      </html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch (err) {}
      }, 350);
    } else {
      let iframe = document.getElementById('iframe-impresion-auditoria');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'iframe-impresion-auditoria';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
      }
      const idoc = iframe.contentWindow.document;
      idoc.open();
      idoc.write(html);
      idoc.close();
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 350);
    }
  },

  imprimirTicketRuta80mm(rutaId) {
    const ruta = (this.auditoriaData?.rutas || []).find(r => r.id === rutaId);
    if (!ruta) {
      showToast('Ruta no encontrada para imprimir', 'error');
      return;
    }

    const ahora = new Date();
    const horaImpresion = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const horaSalida = ruta.fecha_creacion ? new Date(ruta.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    const horaCierre = ruta.fecha_liquidacion ? new Date(ruta.fecha_liquidacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pendiente';

    const totalCajaRuta = (ruta.total_recolectado || ((ruta.efectivo || 0) + (ruta.base_efectivo || 0)));

    let filasPedidos = '';
    (ruta.pedidos || []).forEach(p => {
      const estadoTxt = p.estado_entrega === 'ENTREGADO' ? 'ENTREGADO' : (p.estado_entrega === 'NO_ENTREGADO' ? 'DEVUELTO' : 'PENDIENTE');
      filasPedidos += `
        <div style="margin-bottom: 5px; border-bottom: 1px dotted #ccc; padding-bottom: 3px;">
          <div class="bold">#${escapeHtml(p.codigo_pedido || String(p.id))} - ${escapeHtml(p.cliente || 'Cliente')}</div>
          <div style="font-size: 9px; color: #222;">
            ${escapeHtml(p.direccion || 'Sin dirección')}<br>
            Estado: <b>${estadoTxt}</b> | Pago: <b>${escapeHtml(p.metodo_pago_final || 'Por liquidar')}</b>
            ${p.comprobante_transf ? ` (Comp: ${escapeHtml(p.comprobante_transf)})` : ''}
          </div>
          <div class="text-right bold" style="font-size: 10.5px;">
            $${Number(p.total || 0).toLocaleString('es-CO')}
          </div>
        </div>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket Ruta #${ruta.id} (80mm)</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          @media print {
            .no-print { display: none !important; }
            body { width: 72mm; margin: 0 auto; padding: 2mm 0; }
          }
          * { box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm;
            margin: 0 auto;
            padding: 4mm 1mm;
            font-size: 11px;
            color: #000;
            line-height: 1.25;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .divider-double { border-top: 2px solid #000; margin: 5px 0; }
          .logo { max-width: 48mm; max-height: 20mm; margin: 0 auto 3px auto; display: block; }
          table { width: 100%; border-collapse: collapse; margin: 3px 0; font-size: 10px; }
          th, td { padding: 1.5px 0; vertical-align: top; }
          .btn-print {
            display: inline-block;
            padding: 7px 12px;
            background: #0f172a;
            color: #fff;
            font-weight: bold;
            font-size: 11px;
            border-radius: 5px;
            border: none;
            cursor: pointer;
          }
          .firma-box { margin-top: 20px; text-align: center; }
          .firma-line { border-top: 1px dashed #000; width: 85%; margin: 0 auto 3px auto; }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: center; margin-bottom: 8px; padding: 6px; background: #f1f5f9; border-radius: 6px;">
          <button onclick="window.print()" class="btn-print">🖨️ Imprimir Ticket (80mm)</button>
          <div style="font-size: 9.5px; color: #475569; margin-top: 3px;">Comprobante de Ruta - Impresora Térmica 80mm</div>
        </div>

        <div class="text-center">
          <img src="/img/Logo.png" class="logo" alt="Logo" onerror="this.style.display='none';" />
          <div class="bold" style="font-size: 13px;">JISPIPLAST</div>
          <div style="font-size: 10px;">Comprobante de Ruta & Liquidación</div>
        </div>

        <div class="divider-double"></div>
        <div class="text-center bold" style="font-size: 13px;">RUTA #${ruta.id} - ${escapeHtml(ruta.domiciliario_nombre).toUpperCase()}</div>
        <div class="text-center" style="font-size: 9.5px; margin-top: 2px;">Estado: <b>${ruta.estado}</b></div>
        <div class="divider"></div>

        <table>
          <tr>
            <td><b>Salida:</b> ${horaSalida}</td>
            <td class="text-right"><b>Cierre:</b> ${horaCierre}</td>
          </tr>
          <tr>
            <td colspan="2"><b>Impresión:</b> ${horaImpresion}</td>
          </tr>
          <tr>
            <td><b>Pedidos:</b> ${ruta.pedidos?.length || 0}</td>
            <td class="text-right">Entr: ${ruta.entregados || 0} | Dev: ${ruta.no_entregados || 0}</td>
          </tr>
        </table>

        <div class="divider-double"></div>
        <div class="bold text-center">DETALLE DE PEDIDOS</div>
        <div class="divider"></div>
        ${filasPedidos || '<div class="text-center">Sin pedidos</div>'}

        <div class="divider-double"></div>
        <div class="bold text-center">CUADRE DE CAJA RUTA</div>
        <div class="divider"></div>

        <table>
          <tr>
            <td>Base Entregada:</td>
            <td class="text-right bold">$${(ruta.base_efectivo || 0).toLocaleString('es-CO')}</td>
          </tr>
          <tr>
            <td>(+) Efectivo Cobrado:</td>
            <td class="text-right bold">$${(ruta.efectivo || 0).toLocaleString('es-CO')}</td>
          </tr>
          <tr>
            <td>(+) Transferencias:</td>
            <td class="text-right">$${(ruta.transferencia || 0).toLocaleString('es-CO')}</td>
          </tr>
          <tr>
            <td>(!) Saldo Pendiente:</td>
            <td class="text-right bold">$${(ruta.pendiente || 0).toLocaleString('es-CO')}</td>
          </tr>
        </table>

        <div class="divider"></div>
        <table>
          <tr style="font-size: 12px;">
            <td class="bold">TOTAL A CAJA:</td>
            <td class="text-right bold">$${totalCajaRuta.toLocaleString('es-CO')}</td>
          </tr>
          <tr>
            <td colspan="2" style="font-size: 8.5px; color: #333;">(Base devuelta + Efectivo de entregas)</td>
          </tr>
        </table>

        <div class="firma-box">
          <div class="firma-line"></div>
          <div style="font-size: 9px;">${escapeHtml(ruta.domiciliario_nombre).toUpperCase()}<br>Domiciliario</div>
        </div>

        <div class="firma-box">
          <div class="firma-line"></div>
          <div style="font-size: 9px;">RECIBIDO EN CAJA<br>Auditor / Cajero</div>
        </div>

        <div class="divider" style="margin-top: 14px;"></div>
        <div class="text-center bold" style="font-size: 8.5px; margin-top: 4px;">
          *** LIQUIDACIÓN CONFORME ***
        </div>
      </body>
      </html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        try { w.focus(); w.print(); } catch (err) {}
      }, 350);
    } else {
      let iframe = document.getElementById('iframe-impresion-auditoria');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'iframe-impresion-auditoria';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
      }
      const idoc = iframe.contentWindow.document;
      idoc.open();
      idoc.write(html);
      idoc.close();
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 350);
    }
  }
};