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
  vistaConfirmadosAuditoria: 'dia', // 'dia' | 'todos'
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
          <div class="flex gap-2 items-center">
            ${!esDomi ? `
              <button onclick="ModuloDomicilios.abrirModalNuevoDomiciliario()" class="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium">
                + Domiciliario
              </button>
              <button onclick="abrirModalNuevoCliente('', () => showToast('Cliente guardado con éxito', 'success'))" class="px-2 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium">
                + Cliente
              </button>
              <button id="btn-crear-pedido-domicilios" onclick="ModuloDomicilios.abrirModalCrearPedido()" class="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors">
                + Crear Pedido
              </button>
            ` : ''}
            <button id="btn-modulo-canasta" onclick="ModuloDomicilios.abrirModalCanastaFaltantes()"
                    title="Canasta de Faltantes (Alistamiento previo a despacho)"
                    class="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition active:scale-95">
              <span>🧺</span>
              <span id="badge-modulo-canasta" class="hidden text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-950 font-mono">0</span>
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

  abrirModalCrearPedido() {
    let modal = document.getElementById('modal-crear-pedido-domicilio');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-crear-pedido-domicilio';
      modal.className = 'fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4';
      document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');
    modal.innerHTML = `
      <div class="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <!-- HEADER MODAL -->
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div class="flex items-center gap-2">
            <span class="text-xl">📦</span>
            <div>
              <h3 class="text-sm font-bold text-slate-800">Crear Nuevo Pedido de Domicilio</h3>
              <p class="text-[11px] text-slate-500">Ingresa los datos del cliente y entrega. Los productos son opcionales.</p>
            </div>
          </div>
          <button onclick="ModuloDomicilios.cerrarModalCrearPedido()" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- CUERPO SCROLLABLE -->
        <div class="p-5 overflow-y-auto space-y-4">
          <!-- FILA 1: CÓDIGO Y CLIENTE -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Código de Pedido</label>
              <input id="dom-codigo" type="text" placeholder="EMP-XXXXXX" readonly
                     class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-100 font-semibold text-slate-700 cursor-not-allowed" />
            </div>

            <div class="relative">
              <label class="block text-xs font-semibold text-slate-700 mb-1">Cliente</label>
              <div class="flex gap-1.5">
                <input id="dom-cliente" type="text" placeholder="Buscar o escribir cliente..." autocomplete="off"
                       class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                <button type="button" onclick="abrirModalNuevoCliente('', (c) => {
                  ModuloDomicilios.clienteSeleccionadoId = c.id;
                  document.getElementById('dom-cliente').value = c.nombre || '';
                  if (c.empresa) document.getElementById('dom-empresa').value = c.empresa;
                  if (c.telefono) document.getElementById('dom-telefono').value = c.telefono;
                  if (c.direccion) document.getElementById('dom-direccion').value = c.direccion;
                  if (c.ciudad) document.getElementById('dom-municipio').value = c.ciudad;
                  showToast('Cliente creado y seleccionado', 'success');
                })" class="px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors" title="Crear cliente nuevo">➕</button>
              </div>
              <div id="dom-autocomplete-cliente" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto"></div>
            </div>
          </div>

          <!-- FILA 2: EMPRESA Y TELÉFONO -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Empresa</label>
              <input id="dom-empresa" type="text" placeholder="Ej: Distribuidora, Empresa o Negocio..." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
              <input id="dom-telefono" type="text" placeholder="Ej: 3101234567" autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>

          <!-- FILA 3: MUNICIPIO Y DIRECCIÓN DE ENTREGA -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Municipio / Ciudad *</label>
              <input id="dom-municipio" type="text" placeholder="Ej: Pereira, Dosquebradas..." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Dirección de Entrega *</label>
              <input id="dom-direccion" type="text" placeholder="Ej: Calle 10 # 15-20, Apto 201" autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>

          <!-- SECCIÓN DE PRODUCTOS OPCIONALES -->
          <div class="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700">Productos del Pedido</span>
              <span class="text-[10px] font-semibold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">Opcional</span>
            </div>

            <div class="relative">
              <input id="dom-buscar-producto" type="text" placeholder="Buscar producto por nombre o SKU..." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              <div id="dom-autocomplete-producto" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto"></div>
            </div>

            <div id="dom-producto-seleccionado" class="hidden bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-2 text-xs"></div>

            <div class="flex gap-2">
              <input id="dom-cantidad-prod" type="number" min="1" value="1" placeholder="Cant."
                     class="w-20 border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white text-center font-semibold" />
              <button id="btn-add-item-dom" type="button" class="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold disabled:opacity-40 transition-colors" disabled>
                + Agregar Producto
              </button>
            </div>

            <div id="dom-lista-items" class="divide-y divide-slate-100 max-h-36 overflow-y-auto bg-white rounded-lg border border-slate-200 px-3 py-1"></div>
          </div>

          <!-- VALOR TOTAL Y OBSERVACIONES -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Valor Total del Pedido ($) *</label>
              <input id="dom-total" type="number" step="50" min="0" placeholder="0" autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-bold text-emerald-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Observaciones / Notas</label>
              <input id="dom-observaciones" type="text" placeholder="Devueltas de $50k, timbre no sirve..." autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
        </div>

        <!-- FOOTER ACCIONES -->
        <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onclick="ModuloDomicilios.cerrarModalCrearPedido()" class="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors">
            Cancelar
          </button>
          <button type="button" onclick="ModuloDomicilios.guardarPedidoManualInline()" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors">
            Guardar Pedido
          </button>
        </div>
      </div>
    `;

    this.resetFormulario();
    this.generarCodigoPedidoAuto();
    this.initModalEventListeners();
    setTimeout(() => document.getElementById('dom-cliente')?.focus(), 100);
  },

  cerrarModalCrearPedido() {
    const modal = document.getElementById('modal-crear-pedido-domicilio');
    if (modal) {
      modal.classList.add('hidden');
      modal.innerHTML = '';
    }
    this.resetFormulario();
  },

  initModalEventListeners() {
    document.getElementById('btn-add-item-dom')?.addEventListener('click', () => this.agregarItemManual());

    document.getElementById('dom-buscar-producto')?.addEventListener('input', (e) => {
      if (this.productoSeleccionado && e.target.value !== this.productoSeleccionado.nombre) {
        this.productoSeleccionado = null;
        document.getElementById('dom-producto-seleccionado')?.classList.add('hidden');
        const btn = document.getElementById('btn-add-item-dom');
        if (btn) btn.disabled = true;
      }
    });

    if (typeof attachAutocompleteClientes === 'function') {
      attachAutocompleteClientes(
        document.getElementById('dom-cliente'),
        document.getElementById('dom-autocomplete-cliente'),
        (cliente) => {
          this.clienteSeleccionadoId = cliente.id;
          const cliInput = document.getElementById('dom-cliente');
          if (cliInput) cliInput.value = cliente.nombre || cliente.cliente || '';
          if (cliente.empresa) {
            const e = document.getElementById('dom-empresa');
            if (e) e.value = cliente.empresa;
          }
          if (cliente.telefono) {
            const t = document.getElementById('dom-telefono');
            if (t) t.value = cliente.telefono;
          }
          if (cliente.direccion) {
            const d = document.getElementById('dom-direccion');
            if (d) d.value = cliente.direccion;
          }
          if (cliente.ciudad) {
            const m = document.getElementById('dom-municipio');
            if (m) m.value = cliente.ciudad;
          }
        },
        (clienteNuevo) => {
          this.clienteSeleccionadoId = clienteNuevo.id;
          const cliInput = document.getElementById('dom-cliente');
          if (cliInput) cliInput.value = clienteNuevo.nombre || clienteNuevo.cliente || '';
          if (clienteNuevo.empresa) {
            const e = document.getElementById('dom-empresa');
            if (e) e.value = clienteNuevo.empresa;
          }
          if (clienteNuevo.telefono) {
            const t = document.getElementById('dom-telefono');
            if (t) t.value = clienteNuevo.telefono;
          }
          if (clienteNuevo.direccion) {
            const d = document.getElementById('dom-direccion');
            if (d) d.value = clienteNuevo.direccion;
          }
          if (clienteNuevo.ciudad) {
            const m = document.getElementById('dom-municipio');
            if (m) m.value = clienteNuevo.ciudad;
          }
        }
      );
    }

    if (typeof attachAutocompleteProductos === 'function') {
      attachAutocompleteProductos(
        document.getElementById('dom-buscar-producto'),
        document.getElementById('dom-autocomplete-producto'),
        (prod) => {
          this.productoSeleccionado = prod;
          const inp = document.getElementById('dom-buscar-producto');
          if (inp) inp.value = prod.nombre;
          const box = document.getElementById('dom-producto-seleccionado');
          if (box) {
            box.classList.remove('hidden');
            box.innerHTML = `<b>${escapeHtml(prod.nombre)}</b> — SKU ${escapeHtml(prod.sku)}`;
          }
          const btn = document.getElementById('btn-add-item-dom');
          if (btn) btn.disabled = false;
        }
      );
    }
  },

  toggleFormularioNuevoPedido(mostrar = null) {
    if (mostrar === false) {
      this.cerrarModalCrearPedido();
    } else {
      this.abrirModalCrearPedido();
    }
  },

  resetFormulario() {
    this.itemsManual = [];
    this.productoSeleccionado = null;
    this.clienteSeleccionadoId = null;

    ['dom-codigo', 'dom-cliente', 'dom-empresa', 'dom-telefono', 'dom-direccion', 'dom-municipio', 'dom-total', 'dom-observaciones', 'dom-buscar-producto'].forEach(id => {
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
    const inpProd = document.getElementById('dom-buscar-producto');
    if (inpProd) inpProd.value = '';
    const inpCant = document.getElementById('dom-cantidad-prod');
    if (inpCant) inpCant.value = '1';
    const boxProd = document.getElementById('dom-producto-seleccionado');
    if (boxProd) boxProd.classList.add('hidden');
    const btnAdd = document.getElementById('btn-add-item-dom');
    if (btnAdd) btnAdd.disabled = true;

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
    const empresa = document.getElementById('dom-empresa')?.value.trim() || '';
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
          empresa,
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
        showToast(`✅ Pedido #${res.pedidoId} creado exitosamente`, 'success');
        this.cerrarModalCrearPedido();
        if (this.tabActiva !== 'despachar') {
          await this.cambiarSubTab('despachar');
        } else {
          await this.renderTabDespachar();
        }
      } else {
        alert((res && res.error) || 'Error al guardar el pedido');
      }
    } catch (e) {
      alert('Error al guardar el pedido manual');
    }
  },

  abrirModalNuevoDomiciliario() {
    let modalDomi = document.getElementById('modal-crear-domiciliario-modulo');
    if (!modalDomi) {
      modalDomi = document.createElement('div');
      modalDomi.id = 'modal-crear-domiciliario-modulo';
      modalDomi.className = 'fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4';
      document.body.appendChild(modalDomi);
    }

    modalDomi.classList.remove('hidden');
    modalDomi.innerHTML = `
      <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div class="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-lg">🛵</div>
            <div>
              <h3 class="font-bold text-sm sm:text-base leading-tight">Nuevo Domiciliario / Repartidor</h3>
              <p class="text-[11px] text-emerald-100">Registra un domiciliario para asignarle rutas de entrega</p>
            </div>
          </div>
          <button type="button" onclick="document.getElementById('modal-crear-domiciliario-modulo').classList.add('hidden')"
                  class="text-emerald-200 hover:text-white p-1 rounded-lg text-lg">✕</button>
        </div>

        <form id="form-nuevo-domi-modulo" onsubmit="event.preventDefault(); ModuloDomicilios.confirmarCrearNuevoDomiciliario();" class="p-5 space-y-4">
          <div id="error-crear-domi-modulo" class="hidden text-xs bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg font-medium"></div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Nombre Completo del Repartidor *</label>
            <input id="input-nombre-domi-modulo" type="text" required placeholder="Ej: Juan Camilo Osorio"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 font-medium" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp de Contacto</label>
            <input id="input-tel-domi-modulo" type="tel" placeholder="Ej: 310 987 6543"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 font-medium" />
          </div>

          <div class="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button type="button" onclick="document.getElementById('modal-crear-domiciliario-modulo').classList.add('hidden')"
                    class="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition">
              Cancelar
            </button>
            <button type="submit" id="btn-submit-domi-modulo"
                    class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5">
              <span>✓ Registrar Domiciliario</span>
            </button>
          </div>
        </form>
      </div>
    `;

    setTimeout(() => {
      const inp = document.getElementById('input-nombre-domi-modulo');
      if (inp) inp.focus();
    }, 50);
  },

  async confirmarCrearNuevoDomiciliario() {
    const errorEl = document.getElementById('error-crear-domi-modulo');
    const btnSubmit = document.getElementById('btn-submit-domi-modulo');
    if (errorEl) errorEl.classList.add('hidden');

    const inpNombre = document.getElementById('input-nombre-domi-modulo');
    const inpTel = document.getElementById('input-tel-domi-modulo');
    const nombre = inpNombre ? inpNombre.value.trim() : '';
    const telefono = inpTel ? inpTel.value.trim() : '';

    if (!nombre) {
      if (errorEl) {
        errorEl.textContent = 'El nombre del repartidor es obligatorio';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>⏳ Guardando...</span>';
      }

      const res = await apiFetch('/domiciliarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono })
      });

      if (res && res.ok) {
        showToast('Domiciliario creado con éxito', 'success');
        const modal = document.getElementById('modal-crear-domiciliario-modulo');
        if (modal) modal.classList.add('hidden');
        await this.cargarInicial();
      } else {
        if (errorEl) {
          errorEl.textContent = (res && res.error) || 'Error al crear repartidor';
          errorEl.classList.remove('hidden');
        } else {
          showToast((res && res.error) || 'Error al crear repartidor', 'error');
        }
      }
    } catch (e) {
      if (errorEl) {
        errorEl.textContent = 'Error al conectar con el servidor';
        errorEl.classList.remove('hidden');
      } else {
        showToast('Error de conexión', 'error');
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>✓ Registrar Domiciliario</span>';
      }
    }
  },

  cambiarSubTab(tab) {
    if (typeof Auth !== 'undefined' && Auth.isDomiciliario() && (tab === 'despachar' || tab === 'auditoria')) {
      showToast('Acceso restringido para domiciliarios', 'error');
      return;
    }
    this.tabActiva = tab;
    this.subTabActual = tab;
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

  /** Componente visual reutilizable para mostrar el método de pago claramente en las tarjetas de pedidos */
  renderTarjetaMetodoPago(p) {
    const metodo = p.metodo_pago_final || 'EFECTIVO';
    const montoAbono = Number(p.monto_abono) || 0;
    const totalPedido = Number(p.total) || 0;
    const saldoPendiente = (p.saldo_pendiente !== undefined && p.saldo_pendiente !== null && Number(p.saldo_pendiente) >= 0)
      ? Number(p.saldo_pendiente)
      : Math.max(0, totalPedido - montoAbono);
    const metodoAbono = p.metodo_abono || 'EFECTIVO';
    const tipoSaldo = p.tipo_saldo || 'CREDITO';
    const comprobante = (p.comprobante_transf || '').trim();

    let badgeHtml = '';
    if (metodo === 'YA_PAGO') {
      badgeHtml = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-sky-100 text-sky-900 border border-sky-300 shadow-2xs">
          <span>✅</span> <span>Ya pagó (Cobro $0)</span>
        </span>
      `;
    } else if (montoAbono > 0) {
      badgeHtml = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
          <span>💵</span> <span>Abono: $${montoAbono.toLocaleString('es-CO')} (${metodoAbono === 'EFECTIVO' ? 'Efectivo' : 'Transf.'})</span>
        </span>
      `;
    } else if (metodo === 'TRANSFERENCIA') {
      badgeHtml = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-indigo-100 text-indigo-950 border border-indigo-300 shadow-2xs">
          <span>🏦</span> <span>Transferencia</span>
        </span>
      `;
    } else if (metodo === 'TRANSFERENCIA_PENDIENTE') {
      badgeHtml = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
          <span>⏳</span> <span>Transferencia Pendiente</span>
        </span>
      `;
    } else {
      badgeHtml = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
          <span>💵</span> <span>Efectivo contraentrega</span>
        </span>
      `;
    }

    return `
      <div class="py-1.5 px-2.5 rounded-lg bg-slate-50/90 border border-slate-200/90 space-y-1">
        <div class="flex flex-wrap items-center justify-between gap-1">
          <span class="text-[11px] font-extrabold text-slate-700 uppercase tracking-tight">Método de pago:</span>
          <div>${badgeHtml}</div>
        </div>
        ${comprobante ? `
          <div class="flex items-center justify-between text-[10px] text-slate-600 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
            <span>Comprobante:</span>
            <b class="text-indigo-900">#${escapeHtml(comprobante)}</b>
          </div>
        ` : ''}
        ${montoAbono > 0 ? `
          <div class="flex items-center justify-between text-[10px] text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
            <span class="font-medium">Saldo pendiente (deuda):</span>
            <b class="font-mono font-bold">$${saldoPendiente.toLocaleString('es-CO')} (${tipoSaldo === 'TRANSFERENCIA_PENDIENTE' ? 'Transf. Pend.' : 'Crédito'})</b>
          </div>
        ` : ''}
      </div>
    `;
  },

  /** Badge ultra-compacto que muestra exclusivamente el método de pago sin etiquetas innecesarias */
  badgeMetodoPagoCompacto(p) {
    const metodo = p.metodo_pago_final || 'EFECTIVO';
    const montoAbono = Number(p.monto_abono) || 0;
    const comprobante = (p.comprobante_transf || '').trim();

    if (metodo === 'YA_PAGO') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 shrink-0">✅ Ya pagó</span>`;
    }
    if (montoAbono > 0) {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300 shrink-0">💵 Abono $${montoAbono.toLocaleString('es-CO')}</span>`;
    }
    if (metodo === 'TRANSFERENCIA') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-950 border border-indigo-300 shrink-0" title="${comprobante ? 'Comprobante #' + escapeHtml(comprobante) : 'Transferencia'}">🏦 Transferencia${comprobante ? ` #${escapeHtml(comprobante)}` : ''}</span>`;
    }
    if (metodo === 'TRANSFERENCIA_PENDIENTE') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300 shrink-0">⏳ Transf. Pendiente</span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 shrink-0">💵 Efectivo</span>`;
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
    if (!cont) return;
    cont.innerHTML = `<p class="text-center text-xs text-slate-400 py-4">Cargando pedidos disponibles...</p>`;

    try {
      // En la pestaña 1 (Despachar) consultamos todos los pedidos pendientes por asignar a ruta
      // para asegurar que ningún pedido empacado ni recién creado se oculte.
      const res = await apiFetch('/domicilios/pendientes');
      if (!res.ok) throw new Error(res.error || 'Error al cargar pedidos');
      this.pedidosPendientes = res.pedidos || [];

      // Conteo general de faltantes en pedidos listos para despacho
      const totalFaltantesGeneral = this.pedidosPendientes.reduce((acc, p) => acc + (p.total_faltantes || 0), 0);
      const faltantesAlistadosGeneral = this.pedidosPendientes.reduce((acc, p) => acc + (p.faltantes_alistados || 0), 0);
      const faltantesPendientesGeneral = totalFaltantesGeneral - faltantesAlistadosGeneral;

      const contActual = document.getElementById('contenedor-subtab');
      if (!contActual) return;

      contActual.innerHTML = `
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

          <!-- Canasta de Faltantes (Solo logo 🧺 y badge) -->
          <div class="flex items-center justify-between p-2 px-3 rounded-xl ${totalFaltantesGeneral > 0 ? (faltantesPendientesGeneral > 0 ? 'bg-amber-50 border border-amber-300' : 'bg-emerald-50 border border-emerald-300') : 'bg-slate-50 border border-slate-200'} shadow-2xs">
            <div class="flex items-center gap-2">
              <button type="button" onclick="ModuloDomicilios.abrirModalCanastaFaltantes()"
                      class="w-8 h-8 rounded-lg ${faltantesPendientesGeneral > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse' : 'bg-slate-900 hover:bg-slate-800 text-white'} flex items-center justify-center text-base shadow-xs transition cursor-pointer active:scale-95"
                      title="Canasta de Faltantes">
                🧺
              </button>
              <div class="flex items-center gap-1.5 text-xs">
                <span class="font-extrabold text-slate-800">Canasta:</span>
                <span class="text-[11px] font-black px-2 py-0.2 rounded-full ${faltantesPendientesGeneral > 0 ? 'bg-amber-200 text-amber-950 border border-amber-300' : 'bg-emerald-200 text-emerald-950 border border-emerald-300'}">
                  ${faltantesPendientesGeneral > 0 ? `${faltantesPendientesGeneral} pendiente(s)` : `${totalFaltantesGeneral > 0 ? 'Todo alistado' : '0 faltantes'}`}
                </span>
              </div>
            </div>
            <button type="button" onclick="ModuloDomicilios.abrirModalCanastaFaltantes()"
                    class="p-1.5 px-2.5 text-xs font-bold ${faltantesPendientesGeneral > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'} rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer">
              <span>🧺</span>
              <span class="hidden sm:inline">Alistar Faltantes</span>
            </button>
          </div>

          <div class="border-t pt-2">
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-bold text-slate-800">Pedidos Disponibles para Despacho (Empacados y Directos)</label>
              ${this.pedidosPendientes.length > 0 ? `<span class="text-[11px] font-semibold text-slate-500">${this.pedidosPendientes.length} pedido(s)</span>` : ''}
            </div>
            <div id="lista-check-pedidos" class="max-h-[60vh] overflow-y-auto border border-slate-200 p-2.5 rounded-xl bg-slate-50">
              ${this.pedidosPendientes.length === 0 ? `<p class="text-xs text-slate-400 text-center py-6">No hay pedidos pendientes para despachar</p>` : ''}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              ${this.pedidosPendientes.map(p => {
                const total = Number(p.total) || 0;
                const totalCobroEfectivo = this.redondearCaja50(total);
                const pagaCon = this.pagaConSugerido(totalCobroEfectivo > 0 ? totalCobroEfectivo : total); // ej. 37400 → 50000
                const devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - totalCobroEfectivo)); // redondeado a $50
                const nombreCliente = p.cliente || p.cliente_nombre || 'Cliente General';
                const empresa = (p.empresa || '').trim();
                const direccion = (p.direccion || '').trim();
                const municipio = (p.municipio || '').trim();
                const telefono = (p.telefono || '').trim();
                const direccionCompleta = [direccion, municipio].filter(Boolean).join(', ');

                const totalFalt = Number(p.total_faltantes || 0);
                const alistFalt = Number(p.faltantes_alistados || 0);
                const pendFalt = Number(p.faltantes_pendientes || 0);

                return `
                <div class="relative bg-white p-2.5 rounded-xl border ${totalFalt > 0 && pendFalt > 0 ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'} shadow-2xs space-y-2 hover:border-slate-300 transition-colors" data-pedido-card="${p.id}">
                  <!-- Botón lápiz en la esquina superior derecha -->
                  <button type="button" onclick="event.stopPropagation(); ModuloDomicilios.abrirModalEditarPedido(${p.id})"
                          class="absolute top-2 right-2 p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md border border-transparent hover:border-amber-200 transition-colors"
                          title="Modificar pedido y productos">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>

                  <label class="flex items-start gap-2 text-xs cursor-pointer pr-6">
                    <input type="checkbox" value="${p.id}"
                           data-total="${total}"
                           data-paga-con="${pagaCon}"
                           data-devuelta="${devuelta}"
                           data-sin-devuelta="0"
                           data-faltantes-pendientes="${pendFalt}"
                           class="chk-pedido mt-0.5 accent-indigo-600 w-4 h-4 rounded shrink-0"
                           onchange="ModuloDomicilios.calcularBaseEfectivo()">
                    <div class="flex-1 min-w-0 space-y-1">
                      <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span class="text-xs font-extrabold text-slate-900">${escapeHtml(nombreCliente)}</span>
                        ${empresa ? `<span class="bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded border border-indigo-200 text-[10px]" title="Empresa">🏢 ${escapeHtml(empresa)}</span>` : ''}
                        ${telefono ? `<span class="bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]" title="Teléfono">📞 ${escapeHtml(telefono)}</span>` : ''}
                      </div>
                      ${direccionCompleta ? `<p class="text-[11px] text-slate-600 truncate" title="${escapeHtml(direccionCompleta)}">📍 ${escapeHtml(direccionCompleta)}</p>` : ''}
                      <div class="flex items-center justify-between gap-2 pt-0.5">
                        <span class="text-slate-400 text-[10px] font-mono">${p.codigo_pedido ? p.codigo_pedido : 'Pedido #' + p.id}</span>
                        <!-- Campo Total más pequeño con formato de miles -->
                        <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
                          <span class="text-[11px] font-bold text-slate-700">Total $</span>
                          <input type="text" id="precio-directo-${p.id}"
                                 value="${total > 0 ? total.toLocaleString('es-CO') : '0'}"
                                 class="w-20 px-1.5 py-0.5 text-xs font-black text-emerald-700 bg-white border border-emerald-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none text-right font-mono"
                                 title="Escribe o modifica directamente aquí el precio del pedido"
                                 onfocus="this.select()"
                                 oninput="ModuloDomicilios.onTotalDirectoInput(${p.id}, this)"
                                 onchange="ModuloDomicilios.onTotalDirectoChange(${p.id}, this)"
                                 onblur="ModuloDomicilios.onTotalDirectoBlur(${p.id}, this)" />
                        </div>
                      </div>
                      ${p.observacion || p.observacion_liquidacion ? `<p class="text-[10px] text-amber-700 italic truncate">Nota: ${escapeHtml(p.observacion || p.observacion_liquidacion)}</p>` : ''}

                      <!-- Indicador de Canasta de Faltantes por Pedido -->
                      ${totalFalt > 0 ? `
                        <div class="pt-1" onclick="event.stopPropagation()">
                          ${pendFalt > 0 ? `
                            <div class="bg-amber-50 border border-amber-300 rounded-lg p-1.5 flex items-center justify-between gap-1.5 text-[10px]">
                              <div class="text-amber-950 font-bold truncate flex items-center gap-1">
                                <span>🧺</span>
                                <span>Canasta: <b>${alistFalt}/${totalFalt}</b> alistados (${pendFalt} pend.)</span>
                              </div>
                              <button type="button" onclick="ModuloDomicilios.abrirModalCanastaFaltantes(${p.id})"
                                      class="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded shadow-2xs shrink-0 cursor-pointer"
                                      title="Alistar faltantes de este pedido en la canasta">
                                Alistar
                              </button>
                            </div>
                          ` : `
                            <div class="bg-emerald-50 border border-emerald-300 rounded-lg p-1.5 flex items-center justify-between gap-1.5 text-[10px]">
                              <div class="text-emerald-950 font-bold truncate flex items-center gap-1">
                                <span>✅ 🧺</span>
                                <span>Canasta: <b>${totalFalt}/${totalFalt}</b> listos</span>
                              </div>
                              <button type="button" onclick="ModuloDomicilios.abrirModalCanastaFaltantes(${p.id})"
                                      class="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-2xs shrink-0 cursor-pointer"
                                      title="Ver estado de la canasta para este pedido">
                                Ver
                              </button>
                            </div>
                          `}
                        </div>
                      ` : ''}
                    </div>
                  </label>

                  <!-- Opciones inferiores de pago compactas -->
                  <div class="pl-6 pt-1.5 border-t border-slate-100 space-y-1.5 text-xs">
                    <div class="flex items-center justify-between gap-2">
                      <!-- Opción Ya pagó con chulo -->
                      <label class="inline-flex items-center gap-1.5 cursor-pointer font-bold text-emerald-800 select-none text-[11px]">
                        <input type="checkbox" id="chk-yapago-${p.id}" class="chk-ya-pago rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                               onchange="ModuloDomicilios.toggleYaPago(${p.id})">
                        <span>Ya pagó</span>
                      </label>

                      <!-- Selección Efectivo o Transferencia -->
                      <select id="sel-metodo-${p.id}" class="sel-metodo-despacho border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 text-[11px] font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500"
                              data-id="${p.id}" onchange="ModuloDomicilios.cambiarMetodoDespacho(${p.id})">
                        <option value="EFECTIVO">💵 Efectivo</option>
                        <option value="TRANSFERENCIA">🏦 Transferencia</option>
                      </select>
                    </div>

                    <div class="flex items-center justify-between gap-2">
                      <!-- Opción Sin devuelta -->
                      <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 select-none text-[11px]" id="lbl-sindev-${p.id}">
                        <input type="checkbox" id="chk-sindev-${p.id}" class="chk-sin-devuelta rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                               onchange="ModuloDomicilios.toggleSinDevuelta(${p.id})">
                        <span>Sin devuelta</span>
                      </label>

                      <!-- Devuelta con lápiz antes para editar si pagan con 50.000, 60.000, 100.000, etc. -->
                      <div id="dev-info-${p.id}" class="flex items-center gap-1 text-[11px] text-slate-600 font-mono">
                        <button type="button" onclick="event.stopPropagation(); ModuloDomicilios.toggleEditarDevuelta(${p.id})"
                                class="p-0.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                title="Editar con cuánto paga el cliente (ej: $50.000, $60.000, $100.000)">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <span>Devuelta:</span>
                        <b id="dev-txt-${p.id}" class="text-amber-800 font-bold">$${devuelta.toLocaleString('es-CO')}</b>
                      </div>
                    </div>

                    <!-- Panel desplegable para editar con cuánto paga el cliente -->
                    <div id="pago-edit-${p.id}" class="hidden flex-col gap-1.5 bg-amber-50/90 p-2 rounded-lg border border-amber-200" onclick="event.stopPropagation()">
                      <div class="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-700">
                        <span>Paga con:</span>
                        <div class="flex items-center gap-1">
                          <input type="text" id="paga-input-${p.id}"
                                 value="${pagaCon > 0 ? pagaCon.toLocaleString('es-CO') : ''}"
                                 placeholder="Monto"
                                 class="w-24 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-800 bg-white border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 focus:outline-none text-right"
                                 onfocus="this.select()"
                                 oninput="ModuloDomicilios.onPagaInputFormat(this)"
                                 onkeydown="if(event.key==='Enter') ModuloDomicilios.guardarPagaCon(${p.id})" />
                          <button type="button" onclick="ModuloDomicilios.guardarPagaCon(${p.id})"
                                  class="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold">OK</button>
                          <button type="button" onclick="ModuloDomicilios.cancelarPagaCon(${p.id})"
                                  class="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-bold">✕</button>
                        </div>
                      </div>
                    </div>

                    <!-- Valor a Entregar -->
                    <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span class="text-[11px] font-semibold text-slate-600">Valor a Entregar:</span>
                      <b id="ent-txt-${p.id}" class="text-emerald-800 font-mono font-bold text-xs">$${pagaCon.toLocaleString('es-CO')}</b>
                    </div>
                  </div>
                </div>
              `}).join('')}
              </div>
            </div>
          </div>

          <!-- Resumen simple (sin editar la base a mano) -->
          <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 shadow-2xs">
            <div class="flex justify-between text-slate-600">
              <span class="font-medium">Base de cambio (suma de devueltas):</span>
              <b id="txt-base-cambio" class="text-amber-900 font-mono text-sm">$0</b>
            </div>
            <div class="flex justify-between text-slate-600">
              <span class="font-medium">Total a entregar (lo que pagan):</span>
              <b id="txt-total-entregar" class="text-emerald-800 font-mono text-sm">$0</b>
            </div>
          </div>

          <!-- Botones de Acción para Despacho -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button id="btn-despachar-accion" onclick="ModuloDomicilios.despacharRuta()" class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow active:scale-[0.99] transition-all flex items-center justify-center gap-1.5">
              <span>🚚</span> <span>Despachar Ruta</span>
            </button>
            <button id="btn-agregar-ruta-accion" onclick="ModuloDomicilios.abrirModalAgregarARutaEnCurso()" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow active:scale-[0.99] transition-all flex items-center justify-center gap-1.5" title="Agregar pedidos seleccionados a una ruta ya despachada en curso">
              <span>➕</span> <span>Agregar Pedido a Ruta</span>
            </button>
          </div>
        </div>
      `;
    } catch (err) {
      const contActual = document.getElementById('contenedor-subtab');
      if (contActual) {
        contActual.innerHTML = `<p class="text-xs text-rose-500 text-center py-4">Error: ${err.message}</p>`;
      }
    }
  },

  onSelectDomiciliarioChange(selectEl) {
    const btnDespacho = document.getElementById('btn-despachar-accion');
    const txtAviso = document.getElementById('txt-aviso-domiciliario');
    const domNombre = selectEl.options[selectEl.selectedIndex]?.text || '';
    if (selectEl.value) {
      if (btnDespacho) {
        btnDespacho.innerHTML = `🚚 Despachar Ruta a: <b class="underline ml-1">${escapeHtml(domNombre)}</b>`;
        btnDespacho.className = "w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow transition-all active:scale-[0.99] flex items-center justify-center gap-1.5";
      }
      if (txtAviso) {
        txtAviso.innerHTML = `✅ Domiciliario asignado: <b class="text-emerald-900">${escapeHtml(domNombre)}</b>`;
        txtAviso.className = "text-[11px] text-emerald-800 font-semibold";
      }
    } else {
      if (btnDespacho) {
        btnDespacho.innerHTML = `<span>🚚</span> <span>Despachar Ruta</span>`;
        btnDespacho.className = "w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow active:scale-[0.99] transition-all flex items-center justify-center gap-1.5";
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

  // Formatea la fecha y hora en que se despachó la ruta
  formatearFechaDespacho(fechaStr) {
    if (!fechaStr) return '';
    try {
      const normalized = (typeof fechaStr === 'string' && fechaStr.includes(' ') && !fechaStr.includes('T'))
        ? fechaStr.replace(' ', 'T')
        : fechaStr;
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return String(fechaStr).slice(0, 10);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      let hora = d.getHours();
      const min = String(d.getMinutes()).padStart(2, '0');
      const ampm = hora >= 12 ? 'PM' : 'AM';
      hora = hora % 12;
      if (hora === 0) hora = 12;
      return `${dia}/${mes}/${anio} ${hora}:${min} ${ampm}`;
    } catch (e) {
      return (fechaStr || '').slice(0, 10);
    }
  },

  formatearFechaCorta(fechaStr) {
    if (!fechaStr) return '';
    try {
      const normalized = (typeof fechaStr === 'string' && fechaStr.includes(' ') && !fechaStr.includes('T'))
        ? fechaStr.replace(' ', 'T')
        : fechaStr;
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return String(fechaStr).slice(0, 10);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}/${mes}/${anio}`;
    } catch (e) {
      return (fechaStr || '').slice(0, 10);
    }
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

  toggleEditarDevuelta(pedidoId) {
    const box = document.getElementById(`pago-edit-${pedidoId}`);
    if (!box) return;
    const isHidden = box.classList.contains('hidden');
    if (isHidden) {
      box.classList.remove('hidden');
      box.classList.add('flex');
      const inp = document.getElementById(`paga-input-${pedidoId}`);
      if (inp) {
        const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
        const cur = chk ? parseInt(chk.dataset.pagaCon, 10) || 0 : 0;
        inp.value = cur > 0 ? cur.toLocaleString('es-CO') : '';
        inp.focus();
        inp.select();
      }
    } else {
      box.classList.add('hidden');
      box.classList.remove('flex');
    }
  },

  onPagaInputFormat(inputEl) {
    if (!inputEl) return;
    const raw = inputEl.value.replace(/\D/g, '');
    const num = raw ? parseInt(raw, 10) : 0;
    inputEl.value = num > 0 ? num.toLocaleString('es-CO') : '';
  },

  fijarPagaCon(pedidoId, monto) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    if (!chk) return;
    const total = parseFloat(chk.dataset.total) || 0;
    const inp = document.getElementById(`paga-input-${pedidoId}`);
    if (inp) inp.value = monto.toLocaleString('es-CO');
    if (monto < total) {
      showToast(`⚠️ $${monto.toLocaleString('es-CO')} es menor al total del pedido ($${total.toLocaleString('es-CO')})`, 'warning');
      return;
    }
    this.aplicarPagaCon(pedidoId, monto);
  },

  aplicarPagaCon(pedidoId, pagaCon) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    if (!chk) return;

    const total = parseFloat(chk.dataset.total) || 0;
    pagaCon = Math.round(pagaCon);
    const devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - total));

    chk.dataset.pagaCon = String(pagaCon);
    chk.dataset.devuelta = String(devuelta);
    chk.dataset.sinDevuelta = '0';
    const chkSinDev = document.getElementById(`chk-sindev-${pedidoId}`);
    if (chkSinDev) chkSinDev.checked = false;

    const fmt = (n) => `$${n.toLocaleString('es-CO')}`;
    const elDev = document.getElementById(`dev-txt-${pedidoId}`);
    const elEnt = document.getElementById(`ent-txt-${pedidoId}`);
    if (elDev) elDev.innerText = fmt(devuelta);
    if (elEnt) elEnt.innerText = fmt(pagaCon);

    const box = document.getElementById(`pago-edit-${pedidoId}`);
    if (box) {
      box.classList.add('hidden');
      box.classList.remove('flex');
    }

    this.calcularBaseEfectivo();
  },

  guardarPagaCon(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    if (!chk) return;

    const total = parseFloat(chk.dataset.total) || 0;
    const rawVal = (document.getElementById(`paga-input-${pedidoId}`)?.value || '').replace(/\D/g, '');
    let pagaCon = rawVal ? parseInt(rawVal, 10) : 0;

    if (!pagaCon || pagaCon <= 0) {
      showToast('⚠️ Ingresa un monto válido con el que paga el cliente', 'warning');
      return;
    }
    if (pagaCon < total) {
      showToast(`⚠️ "Paga con" no puede ser menor al total del pedido ($${total.toLocaleString('es-CO')})`, 'warning');
      return;
    }

    this.aplicarPagaCon(pedidoId, pagaCon);
  },

  cancelarPagaCon(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    const actual = parseFloat(chk?.dataset?.pagaCon) || 0;
    const inp = document.getElementById(`paga-input-${pedidoId}`);
    if (inp) inp.value = actual > 0 ? actual.toLocaleString('es-CO') : '';

    const box = document.getElementById(`pago-edit-${pedidoId}`);
    if (box) {
      box.classList.add('hidden');
      box.classList.remove('flex');
    }
  },

  restaurarPagaConSugerido(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    if (!chk) return;
    const total = parseFloat(chk.dataset.total) || 0;
    const pagaCon = this.pagaConSugerido(total);
    this.aplicarPagaCon(pedidoId, pagaCon);
  },

  _totalDebounceTimers: {},

  onTotalDirectoInput(pedidoId, inputEl) {
    if (!inputEl) return;
    const raw = inputEl.value.replace(/\D/g, '');
    const num = raw ? parseInt(raw, 10) : 0;
    inputEl.value = num > 0 ? num.toLocaleString('es-CO') : '';
    this.actualizarTotalDirecto(pedidoId, num, false);

    if (this._totalDebounceTimers[pedidoId]) {
      clearTimeout(this._totalDebounceTimers[pedidoId]);
    }
    this._totalDebounceTimers[pedidoId] = setTimeout(() => {
      this.guardarTotalDirectoEnBD(pedidoId, num);
    }, 600);
  },

  onTotalDirectoChange(pedidoId, inputEl) {
    if (!inputEl) return;
    if (this._totalDebounceTimers[pedidoId]) {
      clearTimeout(this._totalDebounceTimers[pedidoId]);
    }
    const raw = inputEl.value.replace(/\D/g, '');
    const num = raw ? parseInt(raw, 10) : 0;
    inputEl.value = num > 0 ? num.toLocaleString('es-CO') : '0';
    this.actualizarTotalDirecto(pedidoId, num, true);
  },

  onTotalDirectoBlur(pedidoId, inputEl) {
    this.onTotalDirectoChange(pedidoId, inputEl);
  },

  async guardarTotalDirectoEnBD(pedidoId, total) {
    try {
      const ped = this.pedidosPendientes.find(x => x.id === pedidoId);
      if (ped) ped.total = total;

      await apiFetch(`/pedidos/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total })
      });
    } catch (err) {
      console.error('Error al guardar total de pedido:', err);
    }
  },

  /**
   * Actualiza el valor total del pedido directamente desde la tarjeta de despacho sin necesidad de abrir modales.
   * Recalcula en tiempo real el 'paga con', la devuelta y la base de efectivo de la ruta.
   * Si guardarEnBD es true, persiste el cambio en SQLite mediante la API.
   */
  actualizarTotalDirecto(pedidoId, val, guardarEnBD = false) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    if (!chk) return;

    let nuevoTotal = parseFloat(val);
    if (isNaN(nuevoTotal) || nuevoTotal < 0) nuevoTotal = 0;
    nuevoTotal = Math.round(nuevoTotal);
    chk.dataset.total = String(nuevoTotal);

    const ped = this.pedidosPendientes.find(x => x.id === pedidoId);
    if (ped) ped.total = nuevoTotal;

    if (guardarEnBD) {
      this.guardarTotalDirectoEnBD(pedidoId, nuevoTotal);
    }

    const fmt = (n) => `$${n.toLocaleString('es-CO')}`;
    const chkYaPago = document.getElementById(`chk-yapago-${pedidoId}`);
    const sel = document.querySelector(`.sel-metodo-despacho[data-id="${pedidoId}"]`);
    const esYaPago = chkYaPago ? chkYaPago.checked : false;
    const metodo = esYaPago ? 'YA_PAGO' : (sel ? sel.value : 'EFECTIVO');

    let pagaCon = 0;
    let devuelta = 0;

    if (metodo === 'YA_PAGO') {
      pagaCon = 0;
      devuelta = 0;
    } else if (metodo === 'TRANSFERENCIA') {
      pagaCon = 0;
      devuelta = 0;
    } else {
      const chkSinDev = document.getElementById(`chk-sindev-${pedidoId}`);
      const sinDev = chkSinDev ? chkSinDev.checked : false;
      const totalRedondeado50 = this.redondearCaja50(nuevoTotal);
      if (sinDev) {
        pagaCon = totalRedondeado50;
        devuelta = 0;
      } else {
        pagaCon = this.pagaConSugerido(totalRedondeado50 > 0 ? totalRedondeado50 : nuevoTotal);
        devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - (totalRedondeado50 > 0 ? totalRedondeado50 : nuevoTotal)));
      }
    }

    chk.dataset.pagaCon = String(pagaCon);
    chk.dataset.devuelta = String(devuelta);

    const elDev = document.getElementById(`dev-txt-${pedidoId}`);
    if (elDev) elDev.innerText = fmt(devuelta);

    const elEnt = document.getElementById(`ent-txt-${pedidoId}`);
    if (elEnt) elEnt.innerText = fmt(pagaCon);

    this.calcularBaseEfectivo();
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
    
    this.actualizarTotalDirecto(pedidoId, nuevoTotal, true);

    const inpDirecto = document.getElementById(`precio-directo-${pedidoId}`);
    if (inpDirecto) inpDirecto.value = nuevoTotal.toLocaleString('es-CO');

    document.getElementById(`precio-edit-${pedidoId}`)?.classList.add('hidden');
    document.getElementById(`precio-edit-${pedidoId}`)?.classList.remove('flex');
  },

  cancelarPrecioPedido(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    const actual = parseFloat(chk?.dataset?.total) || 0;
    const inp = document.getElementById(`precio-input-${pedidoId}`);
    if (inp) inp.value = String(actual);
    document.getElementById(`precio-edit-${pedidoId}`)?.classList.add('hidden');
    document.getElementById(`precio-edit-${pedidoId}`)?.classList.remove('flex');
  },

  /** Cierra de forma segura e inmediata el modal de edición de pedidos. */
  cerrarModalEditarPedido() {
    const modalPrevio = document.getElementById('modal-editar-pedido-completo');
    if (modalPrevio) modalPrevio.remove();
  },

  /**
   * Modal interactivo para que la Central de Domicilios modifique un pedido antes de despachar:
   * permite quitar productos, cambiar cantidades, agregar nuevos productos desde el catálogo,
   * y ajustar datos de cliente/entrega. Ajusta el inventario de bodega en tiempo real.
   */
  async abrirModalEditarPedido(pedidoId) {
    this.cerrarModalEditarPedido();

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

    // Mantener el total existente del pedido como valor inicial
    const itemsSumaInicial = itemsEdit.reduce((acc, it) => acc + (it.precio * it.cantidad), 0);
    let totalManualUsuario = (pedido.total !== undefined && pedido.total !== null && !isNaN(Number(pedido.total)) && Number(pedido.total) > 0)
      ? Number(pedido.total)
      : itemsSumaInicial;

    let prodSeleccionadoParaAgregar = null;

    const modal = document.createElement('div');
    modal.id = 'modal-editar-pedido-completo';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 overflow-y-auto';
    modal.onclick = (e) => {
      if (e.target === modal) ModuloDomicilios.cerrarModalEditarPedido();
    };

    // Añadir al DOM de inmediato para que los selectores y eventos funcionen
    document.body.appendChild(modal);

    const renderModalContenido = () => {
      const inputExistente = modal.querySelector('#medit-total-final');
      if (inputExistente && !isNaN(parseFloat(inputExistente.value))) {
        totalManualUsuario = parseFloat(inputExistente.value);
      }

      const totalCalc = itemsEdit.reduce((acc, it) => acc + (it.precio * it.cantidad), 0);
      const totalUnidades = itemsEdit.reduce((acc, it) => acc + it.cantidad, 0);
      const valorTotalInput = (totalManualUsuario !== null && !isNaN(totalManualUsuario))
        ? totalManualUsuario
        : (totalCalc > 0 ? totalCalc : (Number(pedido.total) || 0));

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
            <button type="button" id="btn-cerrar-modal-edit" onclick="ModuloDomicilios.cerrarModalEditarPedido()"
                    class="text-slate-400 hover:text-white text-2xl font-bold p-1 leading-none hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Cerrar">&times;</button>
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
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">Empresa</label>
                  <input type="text" id="medit-empresa" value="${escapeHtml(pedido.empresa || '')}"
                         placeholder="Ej: Distribuidora, Empresa..."
                         class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
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
                <span class="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-medium">
                  ${itemsEdit.length > 0 ? '🔄 Stock se ajusta automáticamente' : 'Opcional'}
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
                        <td colspan="5" class="py-5 px-3 text-center text-slate-400 font-normal">
                          <span>📦</span> No hay productos específicos agregados al pedido (opcional). Puedes ingresar el total directamente en la casilla inferior.
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
                            <button type="button" class="btn-medit-restar px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold cursor-pointer" data-idx="${idx}">-</button>
                            <span class="px-2 py-1 font-bold text-xs text-slate-800 min-w-[26px] text-center">${it.cantidad}</span>
                            <button type="button" class="btn-medit-sumar px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold cursor-pointer" data-idx="${idx}">+</button>
                          </div>
                        </td>
                        <td class="py-2.5 px-2 text-right font-medium text-slate-600">
                          $${Number(it.precio || 0).toLocaleString('es-CO')}
                        </td>
                        <td class="py-2.5 px-3 text-right font-bold text-slate-900">
                          $${(Number(it.precio || 0) * it.cantidad).toLocaleString('es-CO')}
                        </td>
                        <td class="py-2.5 px-2 text-center">
                          <button type="button" class="btn-medit-quitar p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded text-xs font-bold cursor-pointer" data-idx="${idx}" title="Quitar este producto">
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
                  <button type="button" id="btn-medit-agregar-item" class="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs disabled:opacity-40 cursor-pointer" disabled>
                    ➕ Agregar
                  </button>
                </div>
              </div>
              <div id="medit-producto-preview" class="hidden text-xs bg-white border border-emerald-300 rounded-lg p-2 font-medium text-slate-700"></div>
            </div>

            <!-- Total y Resumen de Cobro -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span class="text-xs text-slate-700 font-bold block">Total Liquidado del Pedido:</span>
                <span class="text-[11px] text-slate-500">Valor total del pedido (ajustable manualmente o según productos)</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-600">Total $:</span>
                <input type="number" id="medit-total-final" min="0" step="500" value="${valorTotalInput}"
                       class="w-36 border-2 border-emerald-500 rounded-lg px-2.5 py-1 text-base font-extrabold text-emerald-700 text-right bg-white" />
              </div>
            </div>
          </div>

          <!-- Pie con Acciones -->
          <div class="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end gap-2.5 shrink-0">
            <button type="button" id="btn-cancelar-modal-edit" onclick="ModuloDomicilios.cerrarModalEditarPedido()"
                    class="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer">
              Cancelar
            </button>
            <button type="button" id="btn-guardar-modal-edit"
                    class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer">
              <span>💾</span> Guardar Cambios en Pedido
            </button>
          </div>
        </div>
      `;

      // Eventos de botones cerrar y cancelar
      modal.querySelector('#btn-cerrar-modal-edit')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ModuloDomicilios.cerrarModalEditarPedido();
      });

      modal.querySelector('#btn-cancelar-modal-edit')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ModuloDomicilios.cerrarModalEditarPedido();
      });

      // Evento de cambio en el total final manual
      modal.querySelector('#medit-total-final')?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          totalManualUsuario = val;
        }
      });

      // Eventos de botones sumar/restar/quitar
      modal.querySelectorAll('.btn-medit-sumar').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          itemsEdit[idx].cantidad += 1;
          totalManualUsuario = itemsEdit.reduce((acc, it) => acc + (it.precio * it.cantidad), 0);
          renderModalContenido();
        });
      });

      modal.querySelectorAll('.btn-medit-restar').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          if (itemsEdit[idx].cantidad > 1) {
            itemsEdit[idx].cantidad -= 1;
            totalManualUsuario = itemsEdit.reduce((acc, it) => acc + (it.precio * it.cantidad), 0);
            renderModalContenido();
          } else {
            if (confirm(`¿Quitar "${itemsEdit[idx].nombre_producto}" del pedido? Las unidades volverán al inventario.`)) {
              itemsEdit.splice(idx, 1);
              totalManualUsuario = itemsEdit.length > 0 ? itemsEdit.reduce((acc, it) => acc + (it.precio * it.cantidad), 0) : (Number(pedido.total) || 0);
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
            totalManualUsuario = itemsEdit.length > 0 ? itemsEdit.reduce((acc, it) => acc + (it.precio * it.cantidad), 0) : (Number(pedido.total) || 0);
            renderModalContenido();
          }
        });
      });

      // Autocomplete de productos para agregar más
      const inpBusqueda = modal.querySelector('#medit-buscar-producto');
      const dropBusqueda = modal.querySelector('#medit-autocomplete-productos');
      const btnAdd = modal.querySelector('#btn-medit-agregar-item');
      const boxPrev = modal.querySelector('#medit-producto-preview');

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
          const cantInp = modal.querySelector('#medit-cantidad-agregar');
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

          totalManualUsuario = itemsEdit.reduce((acc, it) => acc + (it.precio * it.cantidad), 0);
          prodSeleccionadoParaAgregar = null;
          renderModalContenido();
        });
      }

      // Guardar Cambios
      modal.querySelector('#btn-guardar-modal-edit')?.addEventListener('click', async () => {
        const nuevoCliente = modal.querySelector('#medit-cliente')?.value.trim();
        const nuevoEmpresa = modal.querySelector('#medit-empresa')?.value.trim();
        const nuevoTel = modal.querySelector('#medit-telefono')?.value.trim();
        const nuevaDir = modal.querySelector('#medit-direccion')?.value.trim();
        const nuevoMun = modal.querySelector('#medit-municipio')?.value.trim();
        const nuevaObs = modal.querySelector('#medit-observacion')?.value.trim();
        const totalFinal = parseFloat(modal.querySelector('#medit-total-final')?.value) || 0;

        const btnGuardar = modal.querySelector('#btn-guardar-modal-edit');
        if (btnGuardar) {
          btnGuardar.disabled = true;
          btnGuardar.innerHTML = '<span>⏳</span> Guardando...';
        }

        try {
          const resPut = await apiFetch(`/pedidos/${pedidoId}`, {
            method: 'PUT',
            body: JSON.stringify({
              cliente: nuevoCliente,
              empresa: nuevoEmpresa,
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
          ModuloDomicilios.cerrarModalEditarPedido();

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
  },

  /** Marca/desmarca "sin devuelta": pago exacto, sin cambio. */
  toggleSinDevuelta(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    const chkSinDev = document.getElementById(`chk-sindev-${pedidoId}`);
    const devInfo = document.getElementById(`dev-info-${pedidoId}`);
    if (!chk || !chkSinDev) return;

    chk.dataset.sinDevuelta = chkSinDev.checked ? '1' : '0';

    if (devInfo) {
      const boxEdit = document.getElementById(`pago-edit-${pedidoId}`);
      if (chkSinDev.checked) {
        devInfo.classList.add('hidden');
        if (boxEdit) { boxEdit.classList.add('hidden'); boxEdit.classList.remove('flex'); }
      } else {
        const sel = document.querySelector(`.sel-metodo-despacho[data-id="${pedidoId}"]`);
        const chkYaPago = document.getElementById(`chk-yapago-${pedidoId}`);
        if ((!chkYaPago || !chkYaPago.checked) && (!sel || sel.value === 'EFECTIVO')) {
          devInfo.classList.remove('hidden');
        }
      }
    }

    this.actualizarTotalDirecto(pedidoId, chk.dataset.total || 0, false);
  },

  /** Marca o desmarca que el cliente ya pagó previamente (cobro $0 y sin devuelta). */
  toggleYaPago(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    const sel = document.querySelector(`.sel-metodo-despacho[data-id="${pedidoId}"]`);
    const chkYaPago = document.getElementById(`chk-yapago-${pedidoId}`);
    const chkSinDev = document.getElementById(`chk-sindev-${pedidoId}`);
    const lblSinDev = document.getElementById(`lbl-sindev-${pedidoId}`);
    const devInfo = document.getElementById(`dev-info-${pedidoId}`);
    if (!chk) return;

    const esYaPago = chkYaPago ? chkYaPago.checked : false;
    chk.dataset.yaPago = esYaPago ? '1' : '0';

    if (sel) {
      sel.disabled = esYaPago;
      if (esYaPago) {
        sel.classList.add('opacity-40', 'cursor-not-allowed');
      } else {
        sel.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }
    if (chkSinDev) {
      chkSinDev.disabled = esYaPago;
    }
    if (lblSinDev) {
      if (esYaPago) {
        lblSinDev.classList.add('opacity-40', 'pointer-events-none');
      } else {
        lblSinDev.classList.remove('opacity-40', 'pointer-events-none');
      }
    }
    if (devInfo) {
      const boxEdit = document.getElementById(`pago-edit-${pedidoId}`);
      if (esYaPago) {
        devInfo.classList.add('hidden');
        if (boxEdit) { boxEdit.classList.add('hidden'); boxEdit.classList.remove('flex'); }
      } else if (sel && sel.value === 'EFECTIVO' && (!chkSinDev || !chkSinDev.checked)) {
        devInfo.classList.remove('hidden');
      }
    }

    this.actualizarTotalDirecto(pedidoId, chk.dataset.total || 0, false);
  },

  /** Cambia el método de pago de un pedido en Despachar: si es Transferencia, no aplica devuelta. */
  cambiarMetodoDespacho(pedidoId) {
    const chk = document.querySelector(`.chk-pedido[value="${pedidoId}"]`);
    const sel = document.querySelector(`.sel-metodo-despacho[data-id="${pedidoId}"]`);
    const chkSinDev = document.getElementById(`chk-sindev-${pedidoId}`);
    const lblSinDev = document.getElementById(`lbl-sindev-${pedidoId}`);
    const devInfo = document.getElementById(`dev-info-${pedidoId}`);
    if (!chk || !sel) return;

    const esTransferencia = sel.value === 'TRANSFERENCIA';

    if (chkSinDev) {
      chkSinDev.disabled = esTransferencia;
    }
    if (lblSinDev) {
      if (esTransferencia) {
        lblSinDev.classList.add('opacity-40', 'pointer-events-none');
      } else {
        lblSinDev.classList.remove('opacity-40', 'pointer-events-none');
      }
    }
    if (devInfo) {
      const boxEdit = document.getElementById(`pago-edit-${pedidoId}`);
      if (esTransferencia || (chkSinDev && chkSinDev.checked)) {
        devInfo.classList.add('hidden');
        if (boxEdit) { boxEdit.classList.add('hidden'); boxEdit.classList.remove('flex'); }
      } else {
        devInfo.classList.remove('hidden');
      }
    }

    this.actualizarTotalDirecto(pedidoId, chk.dataset.total || 0, false);
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
      const totalRedondeado50 = this.redondearCaja50(total);
      let pagaCon = parseFloat(chk.dataset.pagaCon);
      if (isNaN(pagaCon)) pagaCon = this.pagaConSugerido(totalRedondeado50 > 0 ? totalRedondeado50 : total);
      let devuelta = parseFloat(chk.dataset.devuelta);
      if (isNaN(devuelta)) devuelta = this.redondearDevuelta50(Math.max(0, pagaCon - (totalRedondeado50 > 0 ? totalRedondeado50 : total)));

      baseCambio += this.redondearDevuelta50(devuelta);
      totalEntregar += this.redondearCaja50(pagaCon);
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
      const chkYaPago = document.getElementById(`chk-yapago-${pid}`);
      const sel = document.querySelector(`.sel-metodo-despacho[data-id="${pid}"]`);
      let metodo = sel ? sel.value : 'EFECTIVO';
      if (chkYaPago && chkYaPago.checked) {
        metodo = 'YA_PAGO';
      }
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

  /**
   * CANASTA DE FALTANTES:
   * Abre la ventana modal para gestionar y confirmar el alistamiento de productos faltantes antes de despachar.
   * Permite buscar, filtrar por pendientes/alistados, y registrar quién alistó cada producto en la canasta.
   */
  async abrirModalCanastaFaltantes(pedidoIdFiltro = null) {
    this.cerrarModalCanastaFaltantes();

    const estadoCanasta = {
      items: [],
      stats: { total: 0, alistados: 0, pendientes: 0 },
      filtroTab: 'todos', // 'todos' | 'pendientes' | 'alistados'
      filtroPedidoId: pedidoIdFiltro,
      busqueda: '',
      cargando: true
    };

    const modal = document.createElement('div');
    modal.id = 'modal-canasta-faltantes';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 overflow-y-auto';
    modal.onclick = (e) => {
      if (e.target === modal) ModuloDomicilios.cerrarModalCanastaFaltantes();
    };

    document.body.appendChild(modal);

    const recargarDatos = async () => {
      try {
        estadoCanasta.cargando = true;
        this.renderModalCanastaFaltantesContenido(modal, estadoCanasta, recargarDatos);
        
        let url = '/domicilios/faltantes';
        if (estadoCanasta.filtroPedidoId) {
          url += `?pedido_id=${estadoCanasta.filtroPedidoId}`;
        }
        const res = await apiFetch(url);
        if (res && res.ok) {
          estadoCanasta.items = res.faltantes || [];
          estadoCanasta.stats = res.stats || {
            total: estadoCanasta.items.length,
            alistados: estadoCanasta.items.filter(it => it.alistado).length,
            pendientes: estadoCanasta.items.filter(it => !it.alistado).length
          };
        } else {
          showToast(res?.error || 'Error al cargar faltantes', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Error de conexión con la canasta', 'error');
      } finally {
        estadoCanasta.cargando = false;
        this.renderModalCanastaFaltantesContenido(modal, estadoCanasta, recargarDatos);
      }
    };

    await recargarDatos();
    this.actualizarBadgesCanasta();
  },

  /**
   * Actualiza los badges numéricos de la Canasta de Faltantes en el Header global,
   * la navegación inferior y el módulo de Domicilios.
   */
  async actualizarBadgesCanasta() {
    try {
      const res = await apiFetch('/domicilios/faltantes');
      const pendientes = (res && res.ok && res.stats) ? Number(res.stats.pendientes || 0) : 0;
      
      const badgeHeader = document.getElementById('badge-global-canasta-header');
      if (badgeHeader) {
        badgeHeader.textContent = pendientes;
        badgeHeader.classList.toggle('hidden', pendientes <= 0);
      }

      const badgeNav = document.getElementById('badge-nav-canasta');
      if (badgeNav) {
        badgeNav.textContent = pendientes;
        badgeNav.classList.toggle('hidden', pendientes <= 0);
      }

      const badgeModulo = document.getElementById('badge-modulo-canasta');
      if (badgeModulo) {
        badgeModulo.textContent = pendientes;
        badgeModulo.classList.toggle('hidden', pendientes <= 0);
      }
    } catch (e) {
      // Silencioso
    }
  },

  cerrarModalCanastaFaltantes() {
    const modalPrevio = document.getElementById('modal-canasta-faltantes');
    if (modalPrevio) modalPrevio.remove();

    this.actualizarBadgesCanasta();

    // Si estamos en la pestaña de Despachar y el contenedor está en pantalla, refrescar la lista
    if (this.tabActiva === 'despachar' && document.getElementById('contenedor-subtab')) {
      this.renderTabDespachar();
    }
  },

  renderModalCanastaFaltantesContenido(modal, estado, recargarDatos) {
    if (!modal) return;

    const { items, stats, filtroTab, filtroPedidoId, busqueda, cargando } = estado;

    // Filtrar items según pestaña y búsqueda
    let itemsFiltrados = [...items];
    if (filtroTab === 'pendientes') {
      itemsFiltrados = itemsFiltrados.filter(it => !it.alistado);
    } else if (filtroTab === 'alistados') {
      itemsFiltrados = itemsFiltrados.filter(it => Boolean(it.alistado));
    }

    if (busqueda && busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      itemsFiltrados = itemsFiltrados.filter(it => {
        const prod = (it.nombre_producto || it.nombre || '').toLowerCase();
        const sku = (it.sku || '').toLowerCase();
        const cli = (it.cliente_nombre || it.cliente || '').toLowerCase();
        const cod = (it.codigo_pedido || '').toLowerCase();
        const mun = (it.municipio || '').toLowerCase();
        const nota = (it.nota_faltante || '').toLowerCase();
        const alistador = (it.usuario_alistado_nombre || '').toLowerCase();
        return prod.includes(q) || sku.includes(q) || cli.includes(q) || cod.includes(q) || mun.includes(q) || nota.includes(q) || alistador.includes(q);
      });
    }

    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150">
        <!-- Cabecera -->
        <div class="px-5 py-4 bg-amber-950 text-white flex justify-between items-center shrink-0 border-b border-amber-900">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-800/80 border border-amber-700 flex items-center justify-center text-xl shadow-inner">
              🧺
            </div>
            <div>
              <h3 class="font-black text-base sm:text-lg flex items-center gap-2">
                Canasta de Faltantes
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-800 text-amber-200 border border-amber-700">
                  Alistamiento previo a despacho
                </span>
              </h3>
              <p class="text-xs text-amber-200/80">Verificación y confirmación de productos faltantes preparados en bodega</p>
            </div>
          </div>
          <button type="button" onclick="ModuloDomicilios.cerrarModalCanastaFaltantes()"
                  class="text-amber-300 hover:text-white text-2xl font-bold p-1 leading-none hover:bg-amber-900 rounded-lg transition-colors cursor-pointer"
                  title="Cerrar">&times;</button>
        </div>

        <!-- Barra de métricas y filtro rápido -->
        <div class="bg-amber-50/60 p-4 border-b border-amber-200/80 space-y-3 shrink-0">
          <div class="flex flex-wrap items-center justify-between gap-2.5">
            <!-- Métricas -->
            <div class="flex items-center gap-2">
              <div class="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs">
                <span class="text-slate-500 font-medium">Total faltantes:</span>
                <b class="text-slate-800 font-extrabold ml-1">${stats.total}</b>
              </div>
              <div class="px-3 py-1.5 bg-amber-100/80 border border-amber-300 rounded-xl shadow-2xs text-xs">
                <span class="text-amber-800 font-medium">⏳ Pendientes:</span>
                <b class="text-amber-950 font-extrabold ml-1">${stats.pendientes}</b>
              </div>
              <div class="px-3 py-1.5 bg-emerald-100/80 border border-emerald-300 rounded-xl shadow-2xs text-xs">
                <span class="text-emerald-800 font-medium">✅ Alistados:</span>
                <b class="text-emerald-950 font-extrabold ml-1">${stats.alistados}</b>
              </div>
            </div>

            <!-- Filtro de pedido específico activo -->
            ${filtroPedidoId ? `
              <div class="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1 rounded-lg text-xs font-semibold">
                <span>Filtrando pedido #${filtroPedidoId}</span>
                <button type="button" id="btn-quitar-filtro-pedido" class="text-indigo-600 hover:text-indigo-950 font-bold px-1 rounded hover:bg-indigo-100 cursor-pointer" title="Quitar filtro de pedido">✕ Ver todos</button>
              </div>
            ` : ''}
          </div>

          <!-- Buscador y Tabs de Estado -->
          <div class="flex flex-col sm:flex-row items-center gap-2.5">
            <!-- Buscador -->
            <div class="relative flex-1 w-full">
              <input type="text" id="inp-buscar-canasta"
                     value="${escapeHtml(busqueda)}"
                     placeholder="Buscar por producto, SKU, cliente, nota..."
                     class="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
              <span class="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
            </div>

            <!-- Tabs de filtro -->
            <div class="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs w-full sm:w-auto shrink-0 justify-center">
              <button type="button" class="btn-filtro-canasta px-3 py-1 text-xs font-bold rounded-lg transition-colors ${filtroTab === 'todos' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}" data-tab="todos">
                Todos (${stats.total})
              </button>
              <button type="button" class="btn-filtro-canasta px-3 py-1 text-xs font-bold rounded-lg transition-colors ${filtroTab === 'pendientes' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}" data-tab="pendientes">
                ⏳ Pendientes (${stats.pendientes})
              </button>
              <button type="button" class="btn-filtro-canasta px-3 py-1 text-xs font-bold rounded-lg transition-colors ${filtroTab === 'alistados' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}" data-tab="alistados">
                ✅ Alistados (${stats.alistados})
              </button>
            </div>
          </div>
        </div>

        <!-- Lista de faltantes -->
        <div class="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
          ${cargando ? `
            <div class="text-center py-12 space-y-2">
              <div class="inline-block animate-spin text-2xl">⏳</div>
              <p class="text-xs font-semibold text-slate-500">Cargando canasta de faltantes...</p>
            </div>
          ` : itemsFiltrados.length === 0 ? `
            <div class="text-center py-12 px-4 space-y-2 bg-white border border-slate-200 rounded-2xl">
              <span class="text-4xl">🧺</span>
              <p class="text-sm font-bold text-slate-800">No hay productos en esta vista de la canasta</p>
              <p class="text-xs text-slate-500 max-w-sm mx-auto">
                ${busqueda ? 'No se encontraron faltantes con ese criterio de búsqueda.' : 'No hay productos faltantes pendientes de alistar.'}
              </p>
            </div>
          ` : `
            <div class="space-y-2.5">
              ${itemsFiltrados.map((it) => {
                const esAlistado = Boolean(it.alistado);
                const cant = Number(it.cantidad_solicitada || it.cantidad_empacada || it.cantidad || 1);
                const nombreProd = it.nombre_producto || it.nombre || 'Producto';
                const nombreCliente = it.cliente_nombre || it.cliente || 'Cliente';
                const fechaAlistadoFmt = it.fecha_alistado ? new Date(it.fecha_alistado).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '';

                return `
                  <div class="bg-white p-3.5 rounded-2xl border ${esAlistado ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/20'} shadow-2xs space-y-2.5 transition hover:shadow-xs">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <!-- Producto y cantidad -->
                      <div class="flex items-start gap-2.5 min-w-0">
                        <div class="w-9 h-9 rounded-xl ${esAlistado ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-900 border border-amber-300'} flex items-center justify-center font-black text-sm shrink-0">
                          ${cant}x
                        </div>
                        <div class="min-w-0">
                          <h4 class="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                            ${escapeHtml(nombreProd)}
                          </h4>
                          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 pt-0.5">
                            <span class="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded">SKU: ${escapeHtml(it.sku || 'N/A')}</span>
                            <span>·</span>
                            <span class="font-semibold text-slate-700">Pedido: <b>${escapeHtml(it.codigo_pedido || '#' + it.pedido_id)}</b></span>
                            <span>·</span>
                            <span class="text-slate-600">Cliente: <b>${escapeHtml(nombreCliente)}</b></span>
                            ${it.municipio ? `<span>· 📍 ${escapeHtml(it.municipio)}</span>` : ''}
                          </div>
                        </div>
                      </div>

                      <!-- Botón de acción / Estado -->
                      <div class="shrink-0 w-full sm:w-auto flex items-center justify-end">
                        ${esAlistado ? `
                          <div class="flex items-center gap-2">
                            <span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-extrabold flex items-center gap-1 shadow-2xs">
                              <span>✅</span> <span>Listo en Canasta</span>
                            </span>
                            <button type="button" onclick="ModuloDomicilios.toggleAlistadoFaltante(${it.id}, false, ${Boolean(filtroPedidoId)})"
                                    class="text-[11px] text-slate-500 hover:text-rose-600 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Desmarcar y regresar a pendiente">
                              ↩ Desmarcar
                            </button>
                          </div>
                        ` : `
                          <button type="button" onclick="ModuloDomicilios.toggleAlistadoFaltante(${it.id}, true, ${Boolean(filtroPedidoId)})"
                                  class="w-full sm:w-auto px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                            <span>🧺</span>
                            <span>Confirmar Alistado en Canasta</span>
                          </button>
                        `}
                      </div>
                    </div>

                    <!-- Nota del faltante (si existe) -->
                    ${it.nota_faltante ? `
                      <div class="p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-1.5">
                        <span class="shrink-0 text-amber-700">📝</span>
                        <div class="min-w-0 flex-1">
                          <span class="font-bold">Instrucción / Nota:</span>
                          <span class="italic text-amber-900 ml-1">${escapeHtml(it.nota_faltante)}</span>
                        </div>
                      </div>
                    ` : ''}

                    <!-- Registro de auditoría del alistado (quién lo alistó y cuándo) -->
                    ${esAlistado ? `
                      <div class="pt-1.5 border-t border-emerald-100 flex flex-wrap items-center justify-between text-[11px] text-emerald-900">
                        <span class="flex items-center gap-1 font-medium">
                          <span>👤</span>
                          <span>Alistado por: <b>${escapeHtml(it.usuario_alistado_nombre || 'Operador')}</b></span>
                        </span>
                        ${fechaAlistadoFmt ? `<span class="text-[10px] text-emerald-700 font-mono">📅 ${fechaAlistadoFmt}</span>` : ''}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Pie del modal -->
        <div class="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div class="text-xs text-slate-500">
            ${stats.pendientes === 0 && stats.total > 0
              ? '<span class="text-emerald-700 font-bold">🎉 ¡Todos los productos faltantes están listos en la canasta!</span>'
              : `<span>Quedan <b>${stats.pendientes}</b> productos pendientes por alistar.</span>`}
          </div>
          <button type="button" onclick="ModuloDomicilios.cerrarModalCanastaFaltantes()"
                  class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer">
            Cerrar Canasta
          </button>
        </div>
      </div>
    `;

    // Eventos del modal
    const inpBusqueda = modal.querySelector('#inp-buscar-canasta');
    if (inpBusqueda) {
      inpBusqueda.addEventListener('input', (e) => {
        estado.busqueda = e.target.value;
        this.renderModalCanastaFaltantesContenido(modal, estado, recargarDatos);
        const nuevoInp = modal.querySelector('#inp-buscar-canasta');
        if (nuevoInp) {
          nuevoInp.focus();
          nuevoInp.setSelectionRange(nuevoInp.value.length, nuevoInp.value.length);
        }
      });
    }

    modal.querySelectorAll('.btn-filtro-canasta').forEach(btn => {
      btn.addEventListener('click', () => {
        estado.filtroTab = btn.dataset.tab;
        this.renderModalCanastaFaltantesContenido(modal, estado, recargarDatos);
      });
    });

    const btnQuitarFiltro = modal.querySelector('#btn-quitar-filtro-pedido');
    if (btnQuitarFiltro) {
      btnQuitarFiltro.addEventListener('click', () => {
        estado.filtroPedidoId = null;
        recargarDatos();
      });
    }
  },

  /**
   * Marca o desmarca un producto faltante como alistado en la canasta, guardando quién lo alistó.
   */
  async toggleAlistadoFaltante(itemId, nuevoEstado, tieneFiltroPedido) {
    try {
      const usuarioActivo = (typeof Auth !== 'undefined' && Auth.getUser && Auth.getUser()) 
        ? Auth.getUser() 
        : { id: null, nombre: 'Operador Bodega' };

      const res = await apiFetch(`/domicilios/faltantes/${itemId}/alistado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alistado: nuevoEstado ? 1 : 0,
          usuario_id: usuarioActivo.id || null,
          usuario_nombre: usuarioActivo.nombre || usuarioActivo.usuario || 'Operador Bodega'
        })
      });

      if (res && res.ok) {
        showToast(res.mensaje || (nuevoEstado ? '✅ Producto alistado en la canasta' : '↩ Producto desmarcado'), 'success');
        this.actualizarBadgesCanasta();
        
        // Recargar contenido del modal abierto
        const modal = document.getElementById('modal-canasta-faltantes');
        if (modal) {
          // Re-disparar apertura manteniendo el filtro activo si existía
          await this.abrirModalCanastaFaltantes(tieneFiltroPedido ? this._ultimoPedidoIdCanasta : null);
        }
      } else {
        alert(res?.error || 'No se pudo actualizar el estado en la canasta');
      }
    } catch (err) {
      alert(err.message || 'Error de conexión');
    }
  },

  /** Abre el modal para agregar los pedidos seleccionados a una ruta que ya se encuentra en curso (despachada) */
  async abrirModalAgregarARutaEnCurso() {
    const chks = Array.from(document.querySelectorAll('.chk-pedido:checked'));
    if (!chks.length) {
      showToast('⚠️ Selecciona al menos un pedido de la lista para agregarlo a una ruta en curso.', 'warning');
      return;
    }

    const pedidosSeleccionados = chks.map(chk => {
      const pid = parseInt(chk.value, 10);
      const chkYaPago = document.getElementById(`chk-yapago-${pid}`);
      const sel = document.querySelector(`.sel-metodo-despacho[data-id="${pid}"]`);
      let metodo = sel ? sel.value : 'EFECTIVO';
      if (chkYaPago && chkYaPago.checked) {
        metodo = 'YA_PAGO';
      }
      const total = parseFloat(chk.dataset.total) || 0;
      let pagaCon = parseFloat(chk.dataset.pagaCon) || 0;
      let devuelta = parseFloat(chk.dataset.devuelta) || 0;
      if (metodo === 'TRANSFERENCIA' || metodo === 'YA_PAGO') {
        pagaCon = 0;
        devuelta = 0;
      }
      const card = chk.closest('[data-pedido-card]');
      const cliente = card ? (card.querySelector('.font-extrabold')?.innerText || `Pedido #${pid}`) : `Pedido #${pid}`;
      return {
        id: pid,
        metodoPago: metodo,
        total,
        pagaCon,
        devuelta,
        cliente
      };
    });

    const sumaTotal = pedidosSeleccionados.reduce((acc, p) => acc + p.total, 0);
    const sumaDevuelta = pedidosSeleccionados.reduce((acc, p) => acc + p.devuelta, 0);

    // Cargar rutas en curso
    let rutas = [];
    try {
      const res = await apiFetch('/rutas?estado=EN_RUTA');
      rutas = (res && res.rutas) || [];
    } catch (err) {
      showToast('Error al consultar rutas en curso: ' + err.message, 'error');
      return;
    }

    // Modal
    const modalExistente = document.getElementById('modal-agregar-a-ruta');
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-agregar-a-ruta';
    modal.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-fade-in';

    let rutaSeleccionadaId = rutas.length === 1 ? rutas[0].id : (rutas.length > 0 ? rutas[0].id : null);

    const renderContenidoModal = () => {
      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200" onclick="event.stopPropagation()">
          <div class="px-4 py-3 bg-indigo-700 text-white flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-lg">➕🚚</span>
              <div>
                <h3 class="font-bold text-sm">Agregar Pedidos a Ruta en Curso</h3>
                <p class="text-[11px] text-indigo-100">${pedidosSeleccionados.length} pedido(s) seleccionado(s)</p>
              </div>
            </div>
            <button type="button" id="btn-cerrar-modal-ruta" class="text-white/80 hover:text-white p-1 rounded-md text-lg leading-none">✕</button>
          </div>

          <div class="p-4 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            <!-- Resumen de pedidos a agregar -->
            <div class="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 space-y-2">
              <div class="font-bold text-indigo-950 flex items-center justify-between text-xs">
                <span>📦 Pedidos seleccionados (${pedidosSeleccionados.length}):</span>
                <span class="font-mono text-emerald-800 font-black">$${sumaTotal.toLocaleString('es-CO')}</span>
              </div>
              <div class="max-h-28 overflow-y-auto space-y-1 pr-1">
                ${pedidosSeleccionados.map(p => `
                  <div class="flex items-center justify-between bg-white px-2 py-1 rounded border border-indigo-100 text-[11px]">
                    <span class="font-medium text-slate-800 truncate mr-2">${escapeHtml(p.cliente)}</span>
                    <div class="flex items-center gap-2 shrink-0 font-mono">
                      <span class="text-slate-500 font-medium">${p.metodoPago === 'TRANSFERENCIA' ? '🏦 Transf' : (p.metodoPago === 'YA_PAGO' ? '✅ Ya pagó' : '💵 Efec')}</span>
                      <b class="text-slate-900">$${p.total.toLocaleString('es-CO')}</b>
                      ${p.devuelta > 0 ? `<span class="text-amber-800 text-[10px]" title="Devuelta">(Dev: $${p.devuelta.toLocaleString('es-CO')})</span>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
              ${sumaDevuelta > 0 ? `
                <div class="text-[11px] text-amber-900 font-semibold pt-1 border-t border-indigo-100 flex justify-between">
                  <span>Base de cambio adicional a sumar a la ruta:</span>
                  <b class="font-mono font-bold">$${sumaDevuelta.toLocaleString('es-CO')}</b>
                </div>
              ` : ''}
            </div>

            <!-- Listado de rutas en curso -->
            <div>
              <label class="block font-bold text-slate-800 mb-2">
                Selecciona la ruta en curso a la que deseas agregar estos pedidos:
              </label>

              ${rutas.length === 0 ? `
                <div class="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                  <p class="text-slate-500 font-medium">No hay rutas activas en curso actualmente.</p>
                  <p class="text-[11px] text-slate-400">Despacha primero una ruta para poder agregarle más pedidos mientras el repartidor está en la calle.</p>
                </div>
              ` : `
                <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                  ${rutas.map(r => {
                    const esSeleccionada = rutaSeleccionadaId === r.id;
                    const horaSalida = r.fecha_creacion ? (new Date(r.fecha_creacion).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })) : '--:--';
                    return `
                      <div onclick="ModuloDomicilios.seleccionarRutaDestinoModal(${r.id})"
                           class="cursor-pointer p-3 rounded-xl border transition-all ${esSeleccionada ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <input type="radio" name="ruta_destino" value="${r.id}" ${esSeleccionada ? 'checked' : ''} class="text-indigo-600 focus:ring-indigo-500 pointer-events-none">
                            <div>
                              <b class="text-slate-900 text-xs">🚴‍♂️ ${escapeHtml(r.domiciliario_nombre || 'Domiciliario')}</b>
                              <p class="text-[10px] text-slate-500">Ruta #${r.id} · Salida: ${horaSalida}</p>
                            </div>
                          </div>
                          <div class="text-right">
                            <span class="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                              ${r.cantidad_pedidos || 0} pedido(s)
                            </span>
                            <p class="text-[11px] font-mono font-bold text-slate-700 mt-0.5">$${Number(r.total_dinero || 0).toLocaleString('es-CO')}</p>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>

          <div class="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
            <button type="button" id="btn-cancelar-modal-ruta" class="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="button" id="btn-confirmar-agregar-ruta"
                    ${!rutaSeleccionadaId || rutas.length === 0 ? 'disabled' : ''}
                    class="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none rounded-lg shadow transition-all active:scale-[0.98] flex items-center gap-1.5">
              <span>🚀</span> Confirmar y Agregar a Ruta
            </button>
          </div>
        </div>
      `;

      modal.querySelector('#btn-cerrar-modal-ruta')?.addEventListener('click', () => modal.remove());
      modal.querySelector('#btn-cancelar-modal-ruta')?.addEventListener('click', () => modal.remove());
      modal.querySelector('#btn-confirmar-agregar-ruta')?.addEventListener('click', async () => {
        if (!rutaSeleccionadaId) {
          showToast('Selecciona una ruta en curso', 'warning');
          return;
        }
        const btnConf = modal.querySelector('#btn-confirmar-agregar-ruta');
        if (btnConf) {
          btnConf.disabled = true;
          btnConf.innerHTML = '⏳ Agregando pedidos...';
        }

        try {
          const res = await apiFetch(`/rutas/${rutaSeleccionadaId}/agregar-pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pedidos: pedidosSeleccionados,
              baseEfectivoAdicional: sumaDevuelta
            })
          });

          if (res && res.ok) {
            modal.remove();
            showToast(`✅ Se agregaron ${pedidosSeleccionados.length} pedidos a la ruta de ${res.domiciliario || 'domiciliario'}`);
            await ModuloDomicilios.renderTabDespachar();
          } else {
            alert((res && res.error) || 'No se pudieron agregar los pedidos a la ruta');
            if (btnConf) {
              btnConf.disabled = false;
              btnConf.innerHTML = '🚀 Confirmar y Agregar a Ruta';
            }
          }
        } catch (err) {
          alert(err.message || 'Error de conexión');
          if (btnConf) {
            btnConf.disabled = false;
            btnConf.innerHTML = '🚀 Confirmar y Agregar a Ruta';
          }
        }
      });
    };

    ModuloDomicilios._modalAgregarRutaState = {
      setRuta(id) {
        rutaSeleccionadaId = id;
        renderContenidoModal();
      }
    };

    renderContenidoModal();
    document.body.appendChild(modal);
  },

  seleccionarRutaDestinoModal(id) {
    if (this._modalAgregarRutaState) {
      this._modalAgregarRutaState.setRuta(id);
    }
  },

    async renderTabRutas() {
    const cont = document.getElementById('contenedor-subtab');
    if (!cont) return;
    cont.innerHTML = `<p class="text-center text-xs text-slate-400 py-4">Cargando rutas...</p>`;

    try {
      const resActivas = await apiFetch('/rutas?estado=EN_RUTA'); // las rutas activas en calle
      const activas = resActivas.rutas || [];

      // Cargar pedidos de cada ruta activa para mostrarlos en columnas en escritorio
      const activasConPedidos = await Promise.all(
        activas.map(async r => {
          try {
            const d = await apiFetch(`/rutas/${r.id}`);
            return { ...r, pedidos: d.pedidos || [] };
          } catch(e) {
            return { ...r, pedidos: [] };
          }
        })
      );

      this._initPersistentState();

      const contActual = document.getElementById('contenedor-subtab');
      if (!contActual) return;

      contActual.innerHTML = `
        <div class="space-y-6">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>🚚</span> <span>Rutas y Pedidos en Curso</span>
                <span class="text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                  ${activas.length} activa(s)
                </span>
              </h3>
            </div>

            ${activasConPedidos.length === 0
              ? `<div class="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                   <p class="text-2xl mb-1">🛵</p>
                   <p class="text-xs font-semibold text-slate-600">No hay rutas activas en calle en este momento.</p>
                   <p class="text-[11px] text-slate-400 mt-1">Despacha una nueva ruta desde la pestaña "1. Despachar".</p>
                 </div>`
              : activasConPedidos.map(r => {
                const abiertaRuta = (this._rutasAbiertasSeguimiento && this._rutasAbiertasSeguimiento[r.id] !== undefined)
                  ? Boolean(this._rutasAbiertasSeguimiento[r.id])
                  : true;

                return `
                <div class="border border-slate-200 rounded-2xl bg-white p-4 shadow-sm mb-4 space-y-3.5">
                  <!-- Cabecera de la ruta activa -->
                  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-lg shrink-0">
                        🚚
                      </div>
                      <div>
                        <div class="flex items-center gap-2 flex-wrap">
                          <h4 class="font-black text-sm text-slate-900">Ruta #${r.id} · ${escapeHtml(r.domiciliario_nombre || 'Sin repartidor')}</h4>
                          <span class="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-full">En calle</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">
                          <span>📦 <b>${r.pedidos?.length || r.cantidad_pedidos || 0}</b> pedidos</span>
                          <span class="mx-1.5 text-slate-300">•</span>
                          <span>💵 Total: <b class="text-slate-800 font-mono">$${(r.total_dinero || 0).toLocaleString('es-CO')}</b></span>
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <button type="button" onclick="ModuloDomicilios.toggleRutaSeguimiento(${r.id}, event)"
                              class="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border border-slate-200"
                              title="Plegar o desplegar esta ruta">
                        <span id="ruta-arrow-${r.id}" class="text-xs font-black">${abiertaRuta ? '▼' : '▶'}</span>
                        <span id="ruta-btn-text-${r.id}" class="text-[11px] font-semibold">${abiertaRuta ? 'Plegar ruta' : 'Desplegar ruta'}</span>
                      </button>

                      <button onclick="ModuloDomicilios.seleccionarRutaCuadre(${r.id})"
                        class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5">
                        <span>${(typeof Auth !== 'undefined' && Auth.isDomiciliario()) ? '🛵 Mis entregas' : '📦 Gestionar / Liquidar'}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Pedidos organizados por municipio -->
                  <div id="ruta-body-${r.id}" class="${abiertaRuta ? '' : 'hidden'} space-y-4">
                    ${(() => {
                      const porMunicipio = {};
                      (r.pedidos || []).forEach(p => {
                        const mun = (p.municipio || 'Sin municipio').trim() || 'Sin municipio';
                        if (!porMunicipio[mun]) porMunicipio[mun] = [];
                        porMunicipio[mun].push(p);
                      });
                      const municipios = Object.keys(porMunicipio);

                      if (municipios.length === 0) {
                        return `<p class="text-xs text-slate-400 italic py-2">No hay pedidos asignados a esta ruta.</p>`;
                      }

                      // Pre-cálculo de estadísticas por municipio
                      const statsPorMun = {};
                      let totalCobradoEfectivoRuta = 0;
                      let totalDevueltasPedidos = 0;
                      let totalSaldosPendientesRuta = 0;

                      municipios.forEach(mun => {
                        const lista = porMunicipio[mun];
                        const entregadosMun = lista.filter(p => p.estado_entrega === 'ENTREGADO').length;
                        const completadoMun = entregadosMun === lista.length && lista.length > 0;

                        let devueltasMun = 0;
                        let cobradoEfectivoMun = 0;
                        let saldosMun = 0;

                        lista.forEach(p => {
                          const total = Number(p.total) || 0;
                          const dev = this.redondearDevuelta50(Number(p.devuelta_calculada) || 0);
                          devueltasMun += dev;
                          totalDevueltasPedidos += dev;

                          const metodo = p.metodo_pago_final || 'EFECTIVO';
                          const montoAbono = Number(p.monto_abono) || 0;
                          const metodoAbono = p.metodo_abono || 'EFECTIVO';

                          let cobro = 0;
                          let saldo = 0;

                          if (metodo === 'YA_PAGO') {
                            cobro = 0;
                          } else if (montoAbono > 0) {
                            cobro = (metodoAbono === 'TRANSFERENCIA') ? 0 : this.redondearCaja50(montoAbono);
                            saldo = (p.saldo_pendiente !== undefined && p.saldo_pendiente !== null && Number(p.saldo_pendiente) >= 0)
                              ? Number(p.saldo_pendiente)
                              : Math.max(0, total - montoAbono);
                          } else if (metodo === 'TRANSFERENCIA' || metodo === 'TRANSFERENCIA_PENDIENTE') {
                            cobro = 0;
                            if (metodo === 'TRANSFERENCIA_PENDIENTE') {
                              saldo = total;
                            }
                          } else {
                            cobro = this.redondearCaja50(total);
                          }

                          cobradoEfectivoMun += cobro;
                          saldosMun += saldo;
                        });

                        cobradoEfectivoMun = this.redondearCaja50(cobradoEfectivoMun);
                        devueltasMun = this.redondearDevuelta50(devueltasMun);

                        totalCobradoEfectivoRuta += cobradoEfectivoMun;
                        totalSaldosPendientesRuta += saldosMun;

                        const subtotalMun = this.redondearCaja50(cobradoEfectivoMun + devueltasMun);

                        statsPorMun[mun] = {
                          lista,
                          entregadosMun,
                          totalMun: lista.length,
                          completadoMun,
                          devueltasMun,
                          cobradoEfectivoMun,
                          subtotalMun,
                          saldosMun
                        };
                      });

                      const totalDevueltasRuta = this.redondearDevuelta50((Number(r.base_efectivo) > 0) ? Number(r.base_efectivo) : totalDevueltasPedidos);
                      totalCobradoEfectivoRuta = this.redondearCaja50(totalCobradoEfectivoRuta);
                      const totalEntregarCajaRuta = this.redondearCaja50(totalCobradoEfectivoRuta + totalDevueltasRuta);

                      const htmlMunicipios = municipios.map((mun, munIdx) => {
                        const st = statsPorMun[mun];
                        const keyMun = `ruta_${r.id}_mun_${mun}`;
                        const abiertoMun = (this._municipiosAbiertosSeguimiento && this._municipiosAbiertosSeguimiento[keyMun] !== undefined)
                          ? Boolean(this._municipiosAbiertosSeguimiento[keyMun])
                          : false;

                        const devueltasPendientesOtros = municipios.reduce((acc, m2) => {
                          if (m2 === mun) return acc;
                          const s2 = statsPorMun[m2];
                          return acc + (s2.completadoMun ? 0 : s2.devueltasMun);
                        }, 0);

                        return `
                          <div class="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs space-y-0 transition-all">
                            <!-- Cabecera del Municipio Desplegable -->
                            <div class="bg-indigo-50/90 hover:bg-indigo-100/90 px-4 py-2.5 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none transition-colors"
                                 onclick="ModuloDomicilios.toggleMunicipioSeguimiento(${r.id}, '${escapeHtml(mun)}', ${munIdx}, event)">
                              <div class="flex items-center gap-2.5">
                                <span id="mun-arrow-${r.id}-${munIdx}" class="w-5 h-5 flex items-center justify-center rounded-md bg-indigo-100/80 text-indigo-900 text-xs font-black transition-transform">
                                  ${abiertoMun ? '▼' : '▶'}
                                </span>
                                <span class="text-base">📍</span>
                                <div>
                                  <div class="flex items-center gap-2 flex-wrap">
                                    <h5 class="font-black text-xs sm:text-sm text-indigo-950">${escapeHtml(mun)}</h5>
                                    <span class="text-[10px] font-semibold text-indigo-700 bg-white/80 border border-indigo-200 px-1.5 py-0.2 rounded-full">
                                      ${st.totalMun} pedido(s)
                                    </span>
                                  </div>
                                  <p class="text-[10px] text-indigo-700 font-medium">
                                    ${st.entregadosMun}/${st.totalMun} entregado(s) · 
                                    ${st.completadoMun 
                                      ? '<span class="text-emerald-700 font-bold">✓ Completo</span>' 
                                      : '<span class="text-amber-800 font-semibold">En curso</span>'}
                                  </p>
                                </div>
                              </div>
                              <div class="text-right flex items-center gap-3">
                                <div>
                                  <p class="text-xs sm:text-sm text-indigo-950 font-black font-mono">
                                    A caja: $${st.subtotalMun.toLocaleString('es-CO')}
                                  </p>
                                  <p class="text-[10px] text-slate-500 font-medium">
                                    (Cobrado $${st.cobradoEfectivoMun.toLocaleString('es-CO')} + Dev $${st.devueltasMun.toLocaleString('es-CO')})
                                  </p>
                                </div>
                                <span id="mun-hint-${r.id}-${munIdx}" class="text-xs font-bold text-indigo-600 bg-indigo-100/60 px-2 py-1 rounded-lg hidden sm:inline-block">
                                  ${abiertoMun ? 'Ocultar' : 'Ver pedidos'}
                                </span>
                              </div>
                            </div>

                            <!-- Contenido Desplegable: Tarjetas + Resumen del Municipio -->
                            <div id="mun-body-${r.id}-${munIdx}" class="${abiertoMun ? '' : 'hidden'}">
                              <!-- Tarjetas de pedidos de este municipio -->
                              <div class="p-3.5 bg-slate-50/40">
                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                                ${st.lista.map(p => {
                                  const entregado = p.estado_entrega === 'ENTREGADO';
                                  const total = Number(p.total) || 0;
                                  const devuelta = this.redondearDevuelta50(Number(p.devuelta_calculada) || 0);
                                  const itemsFaltantes = (p.items || []).filter(i => i.es_faltante);
                                  const metodoActual = p.metodo_pago_final || 'EFECTIVO';
                                  const montoAbono = Number(p.monto_abono) || 0;
                                  const metodoAbono = p.metodo_abono || 'EFECTIVO';

                                  const esTransfer = metodoActual === 'TRANSFERENCIA' || metodoActual === 'TRANSFERENCIA_PENDIENTE';
                                  const esYaPago = metodoActual === 'YA_PAGO';

                                  let cobradoEfectivo = 0;
                                  let explicacion = '';
                                  if (esYaPago) {
                                    cobradoEfectivo = 0;
                                    explicacion = devuelta > 0 ? '(solo devolver devuelta base)' : '(ya pagado $0)';
                                  } else if (montoAbono > 0) {
                                    cobradoEfectivo = (metodoAbono === 'TRANSFERENCIA') ? 0 : this.redondearCaja50(montoAbono);
                                    explicacion = (metodoAbono === 'TRANSFERENCIA')
                                      ? (devuelta > 0 ? '(solo devolver devuelta · abono transf)' : '(abono transf $0)')
                                      : (devuelta > 0 ? '(abono efectivo + devuelta)' : '(abono efectivo)');
                                  } else if (esTransfer) {
                                    cobradoEfectivo = 0;
                                    explicacion = devuelta > 0 ? '(solo devolver devuelta base)' : '(transferencia $0)';
                                  } else {
                                    cobradoEfectivo = this.redondearCaja50(total);
                                    explicacion = devuelta > 0 ? '(efectivo + devuelta)' : '(solo efectivo)';
                                  }

                                  const valorAEntregar = this.redondearCaja50(cobradoEfectivo + devuelta);

                                  return `
                                    <div class="border p-3.5 rounded-xl ${entregado ? 'bg-emerald-50/80 border-emerald-300' : 'bg-white border-slate-200'} shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-2.5">
                                      <div>
                                        <!-- 1. Datos del cliente arriba -->
                                        <div class="flex justify-between items-start gap-1.5 mb-1.5">
                                          <div class="min-w-0 pr-1">
                                            <p class="font-bold text-xs text-slate-900 leading-snug">
                                              ${escapeHtml(p.cliente || p.cliente_nombre || 'Cliente General')}
                                              ${p.empresa ? ` · <span class="text-indigo-600 font-bold">🏢 ${escapeHtml(p.empresa)}</span>` : ''}
                                            </p>
                                            <p class="text-[11px] text-slate-600 mt-0.5 font-medium">
                                              📍 ${escapeHtml(p.direccion || 'Sin dirección')}
                                              ${p.telefono ? ` · <span class="text-slate-500 font-normal">📞 ${escapeHtml(p.telefono)}</span>` : ''}
                                            </p>
                                          </div>
                                          <div class="flex flex-col items-end gap-1 shrink-0">
                                            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${entregado ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'}">
                                              ${entregado ? '✓ Entregado' : 'En camino'}
                                            </span>
                                            ${this.badgeMetodoPagoCompacto(p)}
                                            ${(r.fecha_creacion || p.ruta_fecha_creacion || p.fecha_creacion) ? `
                                              <span class="text-[10px] font-semibold text-slate-500 font-mono">
                                                ${this.formatearFechaCorta(r.fecha_creacion || p.ruta_fecha_creacion || p.fecha_creacion)}
                                              </span>
                                            ` : ''}
                                          </div>
                                        </div>

                                        <!-- 2. Abajo el número de pedido y la devuelta entregada -->
                                        <div class="flex items-center justify-between text-[11px] text-slate-500 font-normal pt-1.5 border-t border-slate-100 flex-wrap gap-1">
                                          <span class="font-normal text-slate-600 font-mono">${escapeHtml(p.codigo_pedido || ('Pedido #' + p.id))}</span>
                                          <span class="font-normal text-slate-600">Devuelta: <b class="font-medium text-amber-900 font-mono">$${devuelta.toLocaleString('es-CO')}</b></span>
                                        </div>

                                        <!-- 3. Abajito el total y el valor a entregar -->
                                        <div class="pt-1.5 space-y-1 text-xs border-t border-slate-100">
                                          <div class="flex items-center justify-between">
                                            <span class="text-[11px] text-slate-500 font-medium">Total Pedido:</span>
                                            <b class="text-slate-800 font-bold font-mono text-xs ml-1">$${total.toLocaleString('es-CO')}</b>
                                          </div>
                                          <div class="flex items-center justify-between pt-1 border-t border-dashed border-slate-200">
                                            <div class="flex flex-col">
                                              <span class="text-[11px] font-bold text-emerald-800">Valor a Entregar:</span>
                                              <span class="text-[9px] text-slate-400 font-normal leading-tight">${escapeHtml(explicacion)}</span>
                                            </div>
                                            <b class="text-emerald-700 font-black font-mono text-sm">$${valorAEntregar.toLocaleString('es-CO')}</b>
                                          </div>
                                        </div>

                                        ${itemsFaltantes.length > 0 ? `
                                          <div class="mt-2 p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900 font-medium">
                                            ⚠️ <b>${itemsFaltantes.length} producto(s) faltante(s)</b>
                                          </div>
                                        ` : ''}
                                      </div>

                                      <!-- Acciones: Entrega rápida y Ruedita modal -->
                                      <div class="pt-2 border-t border-slate-200/70 space-y-2">
                                        <div class="flex items-center gap-1.5">
                                          <button type="button" onclick="ModuloDomicilios.marcarEntregaRapida(${p.id}, ${!entregado})"
                                            class="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${entregado ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-2xs'}">
                                            ${entregado ? '↩ Deshacer' : '✓ Entregado'}
                                          </button>
                                          <button type="button" onclick="ModuloDomicilios.abrirModalDetallePedido(${p.id}, ${r.id})"
                                            class="p-1.5 px-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors shadow-2xs" title="Detalle del pedido / Ajustar valores y correcciones">
                                            ⚙️
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  `;
                                }).join('')}
                              </div>
                            </div>

                            <!-- Resumen por Municipio estilo exacto de referencia -->
                            <div class="bg-white border-t border-slate-200 px-4 py-3 text-xs space-y-1.5">
                              <div class="flex justify-between text-slate-700">
                                <span>Cobrado en efectivo (${escapeHtml(mun)}):</span>
                                <b class="font-mono text-slate-900 font-bold">$${st.cobradoEfectivoMun.toLocaleString('es-CO')}</b>
                              </div>
                              <div class="flex justify-between text-amber-900">
                                <span>Devueltas de ${escapeHtml(mun)}:</span>
                                <b class="font-mono text-amber-950 font-bold">$${st.devueltasMun.toLocaleString('es-CO')}</b>
                              </div>
                              <div class="flex justify-between text-emerald-800 font-bold border-t border-slate-100 pt-1.5 text-xs sm:text-sm">
                                <span>A entregar / guardar (${escapeHtml(mun)}):</span>
                                <b class="font-mono text-emerald-700 font-black">$${st.subtotalMun.toLocaleString('es-CO')}</b>
                              </div>
                              <div class="flex justify-between text-slate-800 font-semibold border-t border-slate-100 pt-1.5">
                                <span>Devueltas pendientes (otros municipios):</span>
                                <b class="font-mono text-slate-900 font-bold">$${devueltasPendientesOtros.toLocaleString('es-CO')}</b>
                              </div>
                              <p class="text-[11px] text-slate-500 pt-0.5">
                                ${st.completadoMun
                                  ? `Terminaste ${escapeHtml(mun)}. Aparta $${st.subtotalMun.toLocaleString('es-CO')} y conserva $${devueltasPendientesOtros.toLocaleString('es-CO')} de cambio para el resto.`
                                  : `En curso en ${escapeHtml(mun)}. Aparta $${st.subtotalMun.toLocaleString('es-CO')} y conserva $${devueltasPendientesOtros.toLocaleString('es-CO')} de cambio para el resto.`
                                }
                              </p>
                            </div>
                            </div>
                          </div>
                        `;
                      }).join('');

                      // Resumen final de la ruta completo (Tarjeta oscura de referencia)
                      const htmlResumenRuta = `
                        <div class="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl text-xs space-y-2.5 shadow-xl border border-slate-800 mt-3">
                          <div class="flex justify-between text-slate-300">
                            <span class="flex items-center gap-1.5"><span>💵</span> (+) Efectivo cobrado (pedidos + abonos):</span>
                            <b class="font-bold text-white font-mono text-sm sm:text-base">$${totalCobradoEfectivoRuta.toLocaleString('es-CO')}</b>
                          </div>
                          <div class="flex justify-between text-slate-300">
                            <span class="flex items-center gap-1.5"><span>🎒</span> (+) Base devueltas asignada:</span>
                            <b class="font-bold text-white font-mono text-sm sm:text-base">$${totalDevueltasRuta.toLocaleString('es-CO')}</b>
                          </div>
                          <div class="flex justify-between text-amber-400 border-t border-slate-800 pt-1.5">
                            <span class="flex items-center gap-1.5"><span>⏳</span> Saldos pendientes / Cartera (deuda):</span>
                            <b class="font-bold text-amber-400 font-mono text-sm sm:text-base">$${totalSaldosPendientesRuta.toLocaleString('es-CO')}</b>
                          </div>
                          <div class="flex justify-between font-black text-emerald-400 border-t border-slate-700 pt-2 text-sm sm:text-base">
                            <span class="flex items-center gap-1.5 text-emerald-400"><span>💰</span> (=) Total a entregar en caja:</span>
                            <b class="text-emerald-400 font-mono font-black text-base sm:text-lg">$${totalEntregarCajaRuta.toLocaleString('es-CO')}</b>
                          </div>

                          ${!(typeof Auth !== 'undefined' && Auth.isDomiciliario()) ? `
                            <div class="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                              <span class="text-slate-400 text-[11px]">¿Ruta terminada y dinero verificado?</span>
                              <button type="button" onclick="ModuloDomicilios.seleccionarRutaCuadre(${r.id})"
                                      class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer">
                                <span>✅</span> <span>Liquidar Ruta #${r.id}</span>
                              </button>
                            </div>
                          ` : ''}
                        </div>
                      `;

                      return htmlMunicipios + htmlResumenRuta;
                    })()}
                  </div>
                </div>
              `;
            }).join('')
            }
          </div>
        </div>
      `;
    } catch (err) {
      const contActual = document.getElementById('contenedor-subtab');
      if (contActual) {
        contActual.innerHTML = `<p class="text-xs text-rose-500 text-center py-4">Error: ${err.message}</p>`;
      }
    }
  },

  seleccionarRutaCuadre(rutaId) {
    this.rutaSeleccionadaId = rutaId;
    this.cambiarSubTab('cuadre');
  },

  /** Modal emergente completo para ver el detalle de un pedido y realizar correcciones de valor, abonos, métodos y entrega */
  async abrirModalDetallePedido(pedidoId, rutaId) {
    const modalExistente = document.getElementById('modal-detalle-pedido-emergente');
    if (modalExistente) modalExistente.remove();

    // Crear modal contenedor
    const modal = document.createElement('div');
    modal.id = 'modal-detalle-pedido-emergente';
    modal.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-center text-slate-600">
        <p class="text-sm font-semibold">⏳ Cargando detalle del pedido...</p>
      </div>
    `;
    document.body.appendChild(modal);

    try {
      const res = await apiFetch(`/rutas/${rutaId}`);
      if (!res.ok) throw new Error(res.error || 'No se pudo cargar la información del pedido');

      const ruta = res.ruta || {};
      const pedidos = res.pedidos || [];
      const p = pedidos.find(item => item.id === pedidoId);
      if (!p) throw new Error('Pedido no encontrado en la ruta');

      let totalPedido = Number(p.total) || 0;
      let totalOriginal = Number(p.total_original) || totalPedido;
      let metodoPago = p.metodo_pago_final || 'EFECTIVO';
      let comprobante = p.comprobante_transf || '';
      let estadoEntrega = p.estado_entrega || 'PENDIENTE';
      let motivoAjuste = p.observacion || '';
      const devueltaEntregada = Number(p.devuelta_calculada) || 0;

      let montoAbono = Number(p.monto_abono) || 0;
      let metodoAbono = p.metodo_abono || 'EFECTIVO';
      let tipoSaldo = p.tipo_saldo || 'CREDITO';
      let saldoPendiente = (p.saldo_pendiente !== undefined && p.saldo_pendiente !== null && Number(p.saldo_pendiente) >= 0)
        ? Number(p.saldo_pendiente)
        : Math.max(0, totalPedido - montoAbono);

      let mostrarPanelAjuste = false;
      let ajusteSigno = 1;

      const renderModal = () => {
        const esEntregado = estadoEntrega === 'ENTREGADO';
        const esTransfer = metodoPago === 'TRANSFERENCIA' || metodoPago === 'TRANSFERENCIA_PENDIENTE';
        const esYaPago = metodoPago === 'YA_PAGO';
        const hayAbono = montoAbono > 0;

        let aCaja = 0;
        if (esYaPago) {
          aCaja = devueltaEntregada;
        } else if (hayAbono) {
          aCaja = (metodoAbono === 'TRANSFERENCIA') ? devueltaEntregada : (montoAbono + devueltaEntregada);
        } else if (esTransfer) {
          aCaja = devueltaEntregada;
        } else {
          aCaja = totalPedido + devueltaEntregada;
        }

        modal.innerHTML = `
          <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 text-slate-800 my-auto" onclick="event.stopPropagation()">
            <!-- Cabecera del modal -->
            <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="text-xl">⚙️</span>
                <div>
                  <h3 class="font-black text-sm sm:text-base">${escapeHtml(p.codigo_pedido || ('Pedido #' + p.id))}</h3>
                  <p class="text-[11px] text-slate-300">Ruta #${rutaId} · ${escapeHtml(ruta.domiciliario_nombre || 'Sin repartidor')}</p>
                </div>
              </div>
              <button type="button" id="btn-cerrar-modal-detalle" class="w-8 h-8 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white text-lg flex items-center justify-center transition">✕</button>
            </div>

            <!-- Cuerpo del modal -->
            <div class="p-4 sm:p-5 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
              
              <!-- 1. Datos del cliente y entrega -->
              <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div class="flex justify-between items-start gap-2">
                  <div>
                    <h4 class="font-extrabold text-sm text-slate-900">
                      ${escapeHtml(p.cliente || p.cliente_nombre || 'Cliente General')}
                      ${p.empresa ? ` · <span class="text-indigo-600 font-bold">🏢 ${escapeHtml(p.empresa)}</span>` : ''}
                    </h4>
                    <p class="text-slate-600 text-[11px] mt-0.5">
                      📍 <b>Dirección:</b> ${escapeHtml(p.direccion || 'Sin dirección')}${p.municipio ? ` (${escapeHtml(p.municipio)})` : ''}
                    </p>
                    ${p.telefono ? `<p class="text-slate-600 text-[11px]">📞 <b>Teléfono:</b> ${escapeHtml(p.telefono)}</p>` : ''}
                  </div>
                  <div class="flex flex-col items-end gap-1 shrink-0">
                    <button type="button" id="btn-toggle-entrega-modal"
                            class="px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all ${esEntregado ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'}">
                      ${esEntregado ? '✓ Entregado' : '⏳ En camino'}
                    </button>
                    ${esEntregado ? `
                      <span class="text-[9.5px] font-semibold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-1" title="Fecha en que se despachó la ruta">
                        <span>🚚 Despacho:</span> <b class="font-mono text-slate-800">${this.formatearFechaDespacho(ruta.fecha_creacion || p.ruta_fecha_creacion)}</b>
                      </span>
                    ` : ''}
                  </div>
                </div>
              </div>

              <!-- 2. Lista de productos de la factura -->
              <div class="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>🛒</span> <span>Productos del pedido (${p.items?.length || 0})</span>
                  </span>
                  ${(p.items || []).some(i => i.es_faltante) ? `<span class="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-300">⚠️ Tiene faltantes</span>` : ''}
                </div>

                <div class="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  ${(p.items && p.items.length > 0) ? p.items.map(item => `
                    <div class="p-2 rounded-lg border text-[11px] ${item.es_faltante ? 'bg-amber-50/80 border-amber-300' : 'bg-slate-50 border-slate-200/80'}">
                      <div class="flex justify-between items-center gap-2">
                        <div>
                          <p class="font-bold text-slate-800 flex items-center gap-1">
                            <span>${escapeHtml(item.nombre_producto || 'Producto')}</span>
                            ${item.es_faltante ? '<span class="bg-amber-200 text-amber-950 text-[9px] px-1 rounded font-bold">⚠️ Faltante</span>' : ''}
                          </p>
                          <p class="text-[10px] text-slate-400 font-mono">SKU: ${item.sku || '—'}</p>
                        </div>
                        <div class="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs shrink-0">
                          ${item.es_faltante ? 'Faltante' : '×' + (item.cantidad_solicitada || item.cantidad_empacada || 1)}
                        </div>
                      </div>
                      ${item.nota_faltante ? `<p class="text-[10px] text-amber-900 italic mt-1 font-medium bg-white/60 p-1 rounded">Nota: ${escapeHtml(item.nota_faltante)}</p>` : ''}
                    </div>
                  `).join('') : '<p class="text-slate-400 italic text-center py-2">No hay productos detallados registrados.</p>'}
                </div>
              </div>

              <!-- 3. Valor y Corrección de Precio -->
              <div class="border border-slate-200 rounded-xl p-3.5 bg-white space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <label class="block font-bold text-slate-800 text-xs">Valor del Pedido a Cobrar</label>
                    <span class="text-[10px] text-slate-400">Despachado: $${totalOriginal.toLocaleString('es-CO')}</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-base font-black text-emerald-800 font-mono bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      $${totalPedido.toLocaleString('es-CO')}
                    </span>
                    <button type="button" id="btn-abrir-ajuste-mas" class="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-2xs" title="Aumentar valor">+</button>
                    <button type="button" id="btn-abrir-ajuste-menos" class="w-7 h-7 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-2xs" title="Disminuir valor">−</button>
                  </div>
                </div>

                ${motivoAjuste ? `
                  <p class="text-[11px] text-amber-900 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                    📝 <b>Observación/Ajuste:</b> ${escapeHtml(motivoAjuste)}
                  </p>
                ` : ''}

                <!-- Panel de ajuste desplegable -->
                ${mostrarPanelAjuste ? `
                  <div class="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2 animate-fade-in">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-amber-950 text-xs">Corregir Total (${ajusteSigno > 0 ? '+ Sumar' : '− Restar'} monto)</span>
                      <button type="button" id="btn-cancelar-panel-ajuste" class="text-amber-800 hover:text-amber-950 font-bold text-xs">✕ Cancelar</button>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-base text-amber-950">${ajusteSigno > 0 ? '+' : '−'}</span>
                      <input type="number" id="inp-ajuste-monto-modal" min="0" step="500" placeholder="Ej: 3000"
                             class="flex-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <textarea id="inp-ajuste-motivo-modal" rows="2" placeholder="Motivo: faltó producto / devolución / descuento..."
                              class="w-full px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs"></textarea>
                    <button type="button" id="btn-aplicar-ajuste-modal" class="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-2xs">
                      Aplicar Ajuste de Precio
                    </button>
                  </div>
                ` : ''}
              </div>

              <!-- 4. Método de Pago y Comprobante -->
              <div class="border border-slate-200 rounded-xl p-3.5 bg-white space-y-3">
                <div>
                  <label class="block font-bold text-slate-800 mb-1">Método de Pago</label>
                  <select id="sel-metodo-modal" class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-xs font-semibold focus:ring-2 focus:ring-indigo-500">
                    <option value="EFECTIVO" ${metodoPago === 'EFECTIVO' ? 'selected' : ''}>💵 Efectivo</option>
                    <option value="TRANSFERENCIA" ${metodoPago === 'TRANSFERENCIA' ? 'selected' : ''}>🏦 Transferencia (Ya realizada)</option>
                    <option value="TRANSFERENCIA_PENDIENTE" ${metodoPago === 'TRANSFERENCIA_PENDIENTE' ? 'selected' : ''}>⏳ Transferencia pendiente</option>
                    <option value="YA_PAGO" ${metodoPago === 'YA_PAGO' ? 'selected' : ''}>✅ Ya pagó previamente (Cobro $0)</option>
                  </select>
                </div>

                <div id="box-comprobante-modal" class="${metodoPago === 'TRANSFERENCIA' ? '' : 'hidden'} space-y-1">
                  <label class="block font-medium text-slate-600 text-[11px]"># Comprobante de Transferencia</label>
                  <input type="text" id="inp-comp-modal" value="${escapeHtml(comprobante)}" placeholder="Ej: 987654321 / Nequi / Bancolombia"
                         class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs" />
                </div>
              </div>

              <!-- 5. Abonos Parciales (si el cliente solo paga una parte) -->
              <div class="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>💵</span> <span>Abono Parcial / Deuda</span>
                  </span>
                  ${hayAbono ? `
                    <button type="button" id="btn-quitar-abono-modal" class="text-rose-600 hover:text-rose-800 text-[11px] font-bold underline">
                      Quitar abono
                    </button>
                  ` : ''}
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label class="block text-[11px] text-slate-500 font-medium">Monto recibido ($)</label>
                    <input type="number" id="inp-abono-monto-modal" min="0" max="${totalPedido}" step="1000"
                           value="${montoAbono > 0 ? montoAbono : ''}" placeholder="Ej: 20000"
                           class="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-500 font-medium">Método del abono</label>
                    <select id="sel-abono-metodo-modal" class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-slate-50">
                      <option value="EFECTIVO" ${metodoAbono === 'EFECTIVO' ? 'selected' : ''}>💵 Efectivo</option>
                      <option value="TRANSFERENCIA" ${metodoAbono === 'TRANSFERENCIA' ? 'selected' : ''}>🏦 Transferencia</option>
                    </select>
                  </div>
                </div>

                ${hayAbono ? `
                  <div class="p-2.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1 mt-1">
                    <div class="flex justify-between items-center text-xs">
                      <span class="text-amber-950 font-medium">Saldo pendiente (deuda):</span>
                      <b class="text-rose-700 font-mono font-bold">$${saldoPendiente.toLocaleString('es-CO')}</b>
                    </div>
                    <div class="flex items-center gap-2 pt-1">
                      <span class="text-[10px] text-slate-600">Tipo de saldo:</span>
                      <select id="sel-abono-tipo-saldo-modal" class="px-2 py-0.5 border border-amber-300 rounded text-[11px] font-medium bg-white">
                        <option value="CREDITO" ${tipoSaldo === 'CREDITO' ? 'selected' : ''}>💳 Crédito / Fiado</option>
                        <option value="TRANSFERENCIA_PENDIENTE" ${tipoSaldo === 'TRANSFERENCIA_PENDIENTE' ? 'selected' : ''}>⏳ Transferencia pendiente</option>
                      </select>
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- 6. Resumen de caja y devueltas -->
              <div class="bg-slate-900 text-white p-3.5 rounded-xl space-y-1.5">
                <div class="flex justify-between text-slate-300 text-[11px]">
                  <span>🎒 Devuelta base que salió con el repartidor:</span>
                  <b class="text-white font-mono">$${devueltaEntregada.toLocaleString('es-CO')}</b>
                </div>
                <div class="flex justify-between text-emerald-400 text-xs font-bold border-t border-slate-800 pt-1.5">
                  <span>💰 Dinero a entregar en caja:</span>
                  <b class="text-sm font-mono font-black">$${aCaja.toLocaleString('es-CO')}</b>
                </div>
              </div>
            </div>

            <!-- Pie del modal -->
            <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button type="button" id="btn-cancelar-modal-detalle" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition">
                Cancelar
              </button>
              <button type="button" id="btn-guardar-modal-detalle" class="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow transition-all flex items-center gap-1.5">
                <span>💾</span> <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        `;

        // Event Listeners
        modal.querySelector('#btn-cerrar-modal-detalle')?.addEventListener('click', () => modal.remove());
        modal.querySelector('#btn-cancelar-modal-detalle')?.addEventListener('click', () => modal.remove());

        modal.querySelector('#btn-toggle-entrega-modal')?.addEventListener('click', () => {
          estadoEntrega = estadoEntrega === 'ENTREGADO' ? 'PENDIENTE' : 'ENTREGADO';
          renderModal();
        });

        modal.querySelector('#btn-abrir-ajuste-mas')?.addEventListener('click', () => {
          mostrarPanelAjuste = true;
          ajusteSigno = 1;
          renderModal();
        });

        modal.querySelector('#btn-abrir-ajuste-menos')?.addEventListener('click', () => {
          mostrarPanelAjuste = true;
          ajusteSigno = -1;
          renderModal();
        });

        modal.querySelector('#btn-cancelar-panel-ajuste')?.addEventListener('click', () => {
          mostrarPanelAjuste = false;
          renderModal();
        });

        modal.querySelector('#btn-aplicar-ajuste-modal')?.addEventListener('click', () => {
          const inpMonto = modal.querySelector('#inp-ajuste-monto-modal');
          const inpMotivo = modal.querySelector('#inp-ajuste-motivo-modal');
          const valMonto = parseFloat(inpMonto?.value) || 0;
          const txtMotivo = (inpMotivo?.value || '').trim();

          if (valMonto <= 0) {
            alert('Ingresa un monto de ajuste mayor a 0');
            return;
          }
          if (!txtMotivo) {
            alert('Escribe el motivo del ajuste (ej: faltó producto, descuento, etc.)');
            return;
          }

          const delta = ajusteSigno * valMonto;
          totalPedido = Math.max(0, totalPedido + delta);
          motivoAjuste = `Ajuste ${ajusteSigno > 0 ? '+' : '−'}$${valMonto.toLocaleString('es-CO')}: ${txtMotivo}`;
          mostrarPanelAjuste = false;
          if (montoAbono > totalPedido) montoAbono = totalPedido;
          saldoPendiente = Math.max(0, totalPedido - montoAbono);
          renderModal();
        });

        modal.querySelector('#sel-metodo-modal')?.addEventListener('change', (e) => {
          metodoPago = e.target.value;
          const boxComp = modal.querySelector('#box-comprobante-modal');
          if (boxComp) boxComp.classList.toggle('hidden', metodoPago !== 'TRANSFERENCIA');
          renderModal();
        });

        modal.querySelector('#inp-comp-modal')?.addEventListener('input', (e) => {
          comprobante = e.target.value;
        });

        modal.querySelector('#inp-abono-monto-modal')?.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value) || 0;
          montoAbono = Math.min(Math.max(0, val), totalPedido);
          saldoPendiente = Math.max(0, totalPedido - montoAbono);
        });

        modal.querySelector('#inp-abono-monto-modal')?.addEventListener('change', () => {
          renderModal();
        });

        modal.querySelector('#sel-abono-metodo-modal')?.addEventListener('change', (e) => {
          metodoAbono = e.target.value;
        });

        modal.querySelector('#sel-abono-tipo-saldo-modal')?.addEventListener('change', (e) => {
          tipoSaldo = e.target.value;
        });

        modal.querySelector('#btn-quitar-abono-modal')?.addEventListener('click', () => {
          montoAbono = 0;
          saldoPendiente = 0;
          renderModal();
        });

        modal.querySelector('#btn-guardar-modal-detalle')?.addEventListener('click', async () => {
          const btnGuardar = modal.querySelector('#btn-guardar-modal-detalle');
          if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = '⏳ Guardando...';
          }

          try {
            const body = {
              total: totalPedido,
              total_original: totalOriginal,
              metodoPago,
              comprobante: metodoPago === 'TRANSFERENCIA' ? (modal.querySelector('#inp-comp-modal')?.value || comprobante) : '',
              observacion: motivoAjuste,
              estadoEntrega,
              estado_entrega: estadoEntrega,
              montoAbono,
              monto_abono: montoAbono,
              saldoPendiente,
              saldo_pendiente: saldoPendiente,
              metodoAbono,
              metodo_abono: metodoAbono,
              tipoSaldo: (modal.querySelector('#sel-abono-tipo-saldo-modal')?.value || tipoSaldo),
              tipo_saldo: (modal.querySelector('#sel-abono-tipo-saldo-modal')?.value || tipoSaldo)
            };

            const resp = await apiFetch(`/rutas/pedido/${pedidoId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });

            if (resp && resp.ok) {
              modal.remove();
              showToast('✅ Pedido actualizado correctamente');
              if (ModuloDomicilios.subTabActual === 'cuadre') {
                await ModuloDomicilios.renderTabCuadre();
              } else {
                await ModuloDomicilios.cargarTabActual();
              }
            } else {
              alert(resp?.error || 'No se pudo guardar la actualización del pedido');
              if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = '💾 Guardar Cambios';
              }
            }
          } catch (err) {
            alert(err.message || 'Error de conexión');
            if (btnGuardar) {
              btnGuardar.disabled = false;
              btnGuardar.innerHTML = '💾 Guardar Cambios';
            }
          }
        });
      };

      renderModal();
    } catch (err) {
      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center text-slate-800 space-y-3">
          <p class="text-rose-600 font-bold">⚠️ ${escapeHtml(err.message || 'Error al cargar pedido')}</p>
          <button type="button" onclick="document.getElementById('modal-detalle-pedido-emergente')?.remove()"
                  class="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-bold text-xs rounded-xl">Cerrar</button>
        </div>
      `;
    }
  },

  async renderTabCuadre() {
    const cont = document.getElementById('contenedor-subtab');
    if (!cont) return;

    cont.innerHTML = `
      <div class="text-center py-10 px-4 space-y-2">
        <div class="inline-block animate-spin text-2xl">⏳</div>
        <p class="text-xs font-bold text-slate-700">Cargando rutas en curso y pedidos para cuadre...</p>
      </div>
    `;

    try {
      let rutasActivas = [];
      try {
        const resRutas = await apiFetch('/rutas?estado=EN_RUTA');
        if (resRutas && resRutas.ok) {
          rutasActivas = resRutas.rutas || [];
        }
      } catch(e) {
        console.error('Error al listar rutas en cuadre:', e);
      }

      const contActual = document.getElementById('contenedor-subtab');
      if (!contActual) return;

      if (rutasActivas.length === 0) {
        contActual.innerHTML = `
          <div class="text-center py-12 px-4 space-y-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <span class="text-4xl">📦</span>
            <p class="text-sm font-bold text-slate-800">No hay rutas activas para cuadrar en este momento</p>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">
              Puedes despachar nuevos pedidos o consultar las rutas activas en la pestaña "En Curso".
            </p>
            <div class="flex justify-center gap-2 pt-2">
              <button type="button" onclick="ModuloDomicilios.cambiarSubTab('rutas')"
                      class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
                🛵 Ver rutas en curso
              </button>
            </div>
          </div>
        `;
        return;
      }

      // Ordenar rutas por orden de despacho (fecha de creación ascendente / ID)
      rutasActivas.sort((a, b) => {
        const fa = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : (a.id || 0);
        const fb = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : (b.id || 0);
        return fa - fb || (a.id - b.id);
      });

      // Cargar detalles de pedidos para cada ruta en paralelo
      const rutasConDetalles = await Promise.all(
        rutasActivas.map(async (r) => {
          try {
            const resDetalle = await apiFetch(`/rutas/${r.id}`);
            if (resDetalle && resDetalle.ok) {
              return {
                ...r,
                ...(resDetalle.ruta || {}),
                pedidos: resDetalle.pedidos || []
              };
            }
          } catch (e) {
            console.error(`Error cargando detalle de ruta #${r.id}:`, e);
          }
          return { ...r, pedidos: [] };
        })
      );

      this._rutasActivasCuadre = rutasConDetalles;
      this._initPersistentState();

      // Función auxiliar para calcular devuelta
      function calcDevueltaPedido(p) {
        const storedDev = Number(p.devuelta_calculada);
        return (!isNaN(storedDev) && storedDev >= 0) ? storedDev : 0;
      }

      // Resumen general superior
      const totalRutas = rutasConDetalles.length;
      const totalPedidosTodas = rutasConDetalles.reduce((acc, r) => acc + (r.pedidos?.length || 0), 0);
      const totalEntregadosTodas = rutasConDetalles.reduce((acc, r) => acc + (r.pedidos || []).filter(p => p.estado_entrega === 'ENTREGADO').length, 0);

      let html = `
        <div class="space-y-4">
          <!-- Barra superior de contexto y controles globales -->
          <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <div>
              <h2 class="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>📦</span> <span>Cuadre y Liquidación de Rutas en Curso</span>
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                Organizadas por repartidor en <strong>orden de despacho</strong>. Los pedidos entregados se muestran completos listos para verificar y liquidar.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                ${totalRutas} ruta(s) · ${totalEntregadosTodas}/${totalPedidosTodas} entregados
              </span>
              <button type="button" onclick="ModuloDomicilios.toggleTodosRutasCuadre(true)"
                      class="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer">
                📂 Desplegar todas
              </button>
              <button type="button" onclick="ModuloDomicilios.toggleTodosRutasCuadre(false)"
                      class="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer">
                📁 Plegar todas
              </button>
              <button type="button" onclick="ModuloDomicilios.cargarTabActual()"
                      class="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 transition cursor-pointer flex items-center gap-1"
                      title="Actualizar">
                <span>🔄</span> <span>Actualizar</span>
              </button>
            </div>
          </div>

          <!-- Listado de tarjetas de rutas en orden de despacho -->
          <div class="space-y-4" id="contenedor-rutas-cuadre">
      `;

      rutasConDetalles.forEach((r, rIdx) => {
        const pedidos = r.pedidos || [];
        const totalPedidos = pedidos.length;
        const entregados = pedidos.filter(p => p.estado_entrega === 'ENTREGADO').length;
        const aceptadosCount = pedidos.filter(p => Boolean(p.aceptado_cuadre)).length;
        const pctAceptados = totalPedidos > 0 ? Math.round((aceptadosCount / totalPedidos) * 100) : 0;
        const todasEntregadas = totalPedidos > 0 && entregados === totalPedidos;
        const baseEfectivo = Number(r.base_efectivo) || 0;

        // Agrupar por municipio para esta ruta
        const porMunicipio = {};
        pedidos.forEach(p => {
          const mun = (p.municipio || 'Sin municipio').trim() || 'Sin municipio';
          if (!porMunicipio[mun]) porMunicipio[mun] = [];
          porMunicipio[mun].push(p);
        });
        const municipios = Object.keys(porMunicipio);

        let totalCobradoEfectivoRuta = 0;
        let totalSaldosPendientesRuta = 0;

        const statsPorMun = {};
        municipios.forEach(mun => {
          const lista = porMunicipio[mun];
          const todosEntregadosMun = lista.every(p => p.estado_entrega === 'ENTREGADO');
          let devueltasMun = 0;
          let cobradoEfectivoMun = 0;

          lista.forEach(p => {
            const totalPedido = Number(p.total) || 0;
            const metodo = p.metodo_pago_final || 'EFECTIVO';
            const esTransfer = metodo === 'TRANSFERENCIA' || metodo === 'TRANSFERENCIA_PENDIENTE';
            const esYaPago = metodo === 'YA_PAGO';
            const montoAbono = Number(p.monto_abono) || 0;
            const metodoAbono = p.metodo_abono || 'EFECTIVO';
            const dev = calcDevueltaPedido(p);
            devueltasMun += dev;

            if (p.estado_entrega === 'ENTREGADO') {
              if (esYaPago) {
                // $0 cobrado
              } else if (montoAbono > 0) {
                if (metodoAbono === 'EFECTIVO') {
                  const abonoEfectivo = ModuloDomicilios.redondearCaja50(montoAbono);
                  cobradoEfectivoMun += abonoEfectivo;
                  totalCobradoEfectivoRuta += abonoEfectivo;
                }
                const saldo = Math.max(0, totalPedido - montoAbono);
                totalSaldosPendientesRuta += saldo;
              } else if (esTransfer) {
                if (metodo === 'TRANSFERENCIA_PENDIENTE') {
                  totalSaldosPendientesRuta += totalPedido;
                }
              } else {
                const cobro = ModuloDomicilios.redondearCaja50(totalPedido);
                cobradoEfectivoMun += cobro;
                totalCobradoEfectivoRuta += cobro;
              }
            } else {
              // Pedido en camino
              if (montoAbono > 0) {
                totalSaldosPendientesRuta += Math.max(0, totalPedido - montoAbono);
              } else if (metodo === 'TRANSFERENCIA_PENDIENTE') {
                totalSaldosPendientesRuta += totalPedido;
              }
            }
          });

          devueltasMun = ModuloDomicilios.redondearDevuelta50(devueltasMun);
          cobradoEfectivoMun = ModuloDomicilios.redondearCaja50(cobradoEfectivoMun);
          const subtotalMun = ModuloDomicilios.redondearCaja50(cobradoEfectivoMun + devueltasMun);

          statsPorMun[mun] = {
            todosEntregados: todosEntregadosMun,
            devueltas: devueltasMun,
            cobradoEfectivo: cobradoEfectivoMun,
            subtotal: subtotalMun,
            numPedidos: lista.length,
            numEntregados: lista.filter(p => p.estado_entrega === 'ENTREGADO').length
          };
        });

        totalCobradoEfectivoRuta = ModuloDomicilios.redondearCaja50(totalCobradoEfectivoRuta);
        const totalEntregarCajaRuta = ModuloDomicilios.redondearCaja50(totalCobradoEfectivoRuta + baseEfectivo);

        // Estado colapsado/expandido de la tarjeta de la ruta
        const abiertaRuta = (this._rutasAbiertasCuadre && this._rutasAbiertasCuadre[r.id] !== undefined)
          ? Boolean(this._rutasAbiertasCuadre[r.id])
          : true;

        html += `
          <!-- TARJETA CONTENEDORA DE RUTA #${r.id} -->
          <div class="bg-white border ${todasEntregadas ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'} rounded-2xl shadow-2xs overflow-hidden" id="card-ruta-cuadre-${r.id}">
            <!-- Encabezado de la Ruta y Repartidor -->
            <div class="p-3.5 ${todasEntregadas ? 'bg-emerald-50/70 border-b border-emerald-100' : 'bg-slate-50/80 border-b border-slate-200'} transition">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <!-- Izquierda: Repartidor y Orden de despacho -->
                <div class="flex items-center gap-3">
                  <span class="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${todasEntregadas ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'}">
                    #${rIdx + 1}
                  </span>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <span>🛵</span> <span>${escapeHtml(r.domiciliario_nombre || 'Sin repartidor')}</span>
                      </span>
                      <span class="text-[11px] font-bold text-slate-600 bg-white/90 border border-slate-200 px-2 py-0.5 rounded-lg">
                        Ruta #${r.id}
                      </span>
                      ${todasEntregadas ? `
                        <span class="text-[11px] px-2.5 py-0.5 rounded-full font-extrabold bg-emerald-600 text-white shadow-2xs flex items-center gap-1">
                          <span>✓</span> <span>Entregas completas (${entregados}/${totalPedidos})</span>
                        </span>
                      ` : `
                        <span class="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-950 border border-amber-300">
                          ⏳ ${entregados}/${totalPedidos} entregados (en ruta)
                        </span>
                      `}
                    </div>
                    <p class="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>🚚 Despacho: <b>${this.formatearFechaDespacho(r.fecha_creacion)}</b></span>
                      <span>·</span>
                      <span>📍 ${municipios.length} municipio(s)</span>
                      <span>·</span>
                      <span>📦 ${totalPedidos} pedido(s)</span>
                    </p>
                  </div>
                </div>

                <!-- Derecha: Resumen financiero rápido + Botones -->
                <div class="flex flex-wrap items-center gap-2">
                  <div class="hidden sm:flex items-center gap-2 bg-white/95 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono shadow-2xs">
                    <span class="text-slate-600">Base: <b class="text-slate-900">$${baseEfectivo.toLocaleString('es-CO')}</b></span>
                    <span class="text-slate-300">|</span>
                    <span class="text-slate-600">Cobrado: <b class="text-slate-900">$${totalCobradoEfectivoRuta.toLocaleString('es-CO')}</b></span>
                    <span class="text-slate-300">|</span>
                    <span class="text-emerald-700 font-black">A caja: $${totalEntregarCajaRuta.toLocaleString('es-CO')}</span>
                  </div>

                  ${!(typeof Auth !== 'undefined' && Auth.isDomiciliario()) ? `
                    <button onclick="ModuloDomicilios.imprimirTicketRuta80mm(${r.id})"
                            class="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                            title="Imprimir ticket para cuadre">
                      <span>🖨️</span> <span class="hidden md:inline">Ticket 80mm</span>
                    </button>
                    <button type="button"
                            onclick="ModuloDomicilios.cerrarYLiquidarRuta(${r.id})"
                            class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5">
                      <span>✅</span> <span>Liquidar</span>
                    </button>
                  ` : ''}

                  <!-- Botón para plegar/desplegar pedidos de esta ruta -->
                  <button type="button"
                          onclick="ModuloDomicilios.toggleRutaCuadre(${r.id}, event)"
                          class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5">
                    <span id="ruta-arrow-cuadre-${r.id}" class="text-xs font-black">${abiertaRuta ? '▼' : '▶'}</span>
                    <span id="ruta-btn-text-cuadre-${r.id}" class="hidden sm:inline">${abiertaRuta ? 'Plegar pedidos' : 'Desplegar pedidos'}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- CUERPO DESPLEGABLE DE LA RUTA -->
            <div id="ruta-body-cuadre-${r.id}" class="${abiertaRuta ? '' : 'hidden'} p-4 space-y-4">
              <!-- Barra de verificación y aceptación individual de pedidos para esta ruta -->
              <div class="p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>📋</span> <span>Verificación en Caja:</span>
                      <b class="${aceptadosCount === totalPedidos && totalPedidos > 0 ? 'text-emerald-700' : 'text-slate-900'} font-black text-sm">
                        ${aceptadosCount} de ${totalPedidos} pedidos aceptados
                      </b>
                    </span>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      Marca los pedidos conforme recibes el dinero del domiciliario <strong>${escapeHtml(r.domiciliario_nombre || '')}</strong>.
                    </p>
                  </div>
                  <div class="flex items-center gap-1.5">
                    ${aceptadosCount < totalPedidos ? `
                      <button type="button" onclick="ModuloDomicilios.aceptarTodosPedidosCuadre(${r.id}, true)"
                              class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer">
                        <span>✓</span> <span>Aceptar todos (${r.id})</span>
                      </button>
                    ` : `
                      <button type="button" onclick="ModuloDomicilios.aceptarTodosPedidosCuadre(${r.id}, false)"
                              class="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer">
                        ↩ Desmarcar todos
                      </button>
                    `}
                  </div>
                </div>
                <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div class="bg-emerald-500 h-full transition-all duration-300 rounded-full" style="width: ${pctAceptados}%"></div>
                </div>
              </div>

              <!-- Municipios y Pedidos de la Ruta -->
              <div class="space-y-3" id="lista-municipios-cuadre-${r.id}">
                ${municipios.map((mun, munIdx) => {
                  const lista = porMunicipio[mun];
                  const st = statsPorMun[mun];
                  const devueltasPendientesOtros = municipios.reduce((acc, m2) => {
                    if (m2 === mun) return acc;
                    const s2 = statsPorMun[m2];
                    return acc + (s2.todosEntregados ? 0 : s2.devueltas);
                  }, 0);

                  const keyCuadreMun = `cuadre_${r.id}_mun_${mun}`;
                  const abiertoMun = (this._municipiosAbiertosCuadre && this._municipiosAbiertosCuadre[keyCuadreMun] !== undefined)
                    ? Boolean(this._municipiosAbiertosCuadre[keyCuadreMun])
                    : true;

                  return `
                    <div class="border border-slate-200 rounded-xl overflow-hidden shadow-2xs" data-municipio="${mun}" data-ruta-id="${r.id}" data-mun-idx="${munIdx}">
                      <div class="bg-indigo-50/90 px-3.5 py-2.5 border-b border-indigo-100 cursor-pointer select-none hover:bg-indigo-100/80 transition"
                           onclick="ModuloDomicilios.toggleMunicipioCuadre(${r.id}, ${munIdx}, '${escapeHtml(mun)}', event)">
                        <div class="flex justify-between items-center gap-2">
                          <div class="flex items-center gap-2">
                            <span id="mun-arrow-${r.id}-${munIdx}" class="text-indigo-800 text-sm font-black transition-transform">${abiertoMun ? '▾' : '▸'}</span>
                            <div>
                              <p class="text-xs font-bold text-indigo-950 flex items-center gap-1">
                                <span>📍</span> <span>${mun}</span>
                              </p>
                              <p class="text-[10px] text-indigo-700">
                                ${st.numEntregados}/${st.numPedidos} entregado(s)
                                ${st.todosEntregados
                                  ? ' · <span class="text-emerald-700 font-bold">✓ Completo</span>'
                                  : ' · <span class="text-amber-700 font-bold">En curso</span>'}
                              </p>
                            </div>
                          </div>
                          <div class="flex items-center gap-3">
                            <span class="text-[11px] font-bold text-indigo-600 bg-white/90 border border-indigo-200 px-2 py-0.5 rounded-lg hidden sm:inline-block">
                              ${st.numPedidos} pedido(s)
                            </span>
                            <div class="text-right">
                              <p class="text-indigo-950 font-black text-xs">
                                A caja: $${st.subtotal.toLocaleString('es-CO')}
                              </p>
                              <p class="text-[9px] text-slate-500 font-normal">
                                ${st.cobradoEfectivo > 0 ? `(Cobrado $${st.cobradoEfectivo.toLocaleString('es-CO')} + Dev $${st.devueltas.toLocaleString('es-CO')})` : `(Base devueltas $${st.devueltas.toLocaleString('es-CO')})`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="p-3 space-y-3 bg-slate-50/40 ${abiertoMun ? '' : 'hidden'}" id="mun-body-${r.id}-${munIdx}">
                        <!-- Grilla de pedidos con tarjetas visuales claras -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                          ${lista.map(p => {
                            const entregado = p.estado_entrega === 'ENTREGADO';
                            const totalPedido = Number(p.total) || 0;
                            const devuelta = calcDevueltaPedido(p);
                            const metodo = p.metodo_pago_final || 'EFECTIVO';
                            const montoAbono = Number(p.monto_abono) || 0;
                            const metodoAbono = p.metodo_abono || 'EFECTIVO';
                            const devueltaRedondeada = ModuloDomicilios.redondearDevuelta50(devuelta);

                            let cobradoEfectivoReal = 0;
                            let explicacion = '';
                            if (metodo === 'YA_PAGO') {
                              cobradoEfectivoReal = 0;
                              explicacion = 'Ya pagó anticipado ($0 cobrado)';
                            } else if (montoAbono > 0) {
                              if (metodoAbono === 'EFECTIVO') {
                                cobradoEfectivoReal = ModuloDomicilios.redondearCaja50(montoAbono);
                                explicacion = `Abono $${cobradoEfectivoReal.toLocaleString('es-CO')} en efectivo`;
                              } else {
                                cobradoEfectivoReal = 0;
                                explicacion = 'Abono por transferencia ($0 efectivo)';
                              }
                            } else if (metodo === 'TRANSFERENCIA' || metodo === 'TRANSFERENCIA_PENDIENTE') {
                              cobradoEfectivoReal = 0;
                              explicacion = 'Transferencia bancaria ($0 efectivo)';
                            } else {
                              cobradoEfectivoReal = ModuloDomicilios.redondearCaja50(totalPedido);
                              explicacion = 'Efectivo cobrado al cliente';
                            }

                            const valorAEntregar = ModuloDomicilios.redondearCaja50(cobradoEfectivoReal + devueltaRedondeada);
                            const saldoPendiente = Math.max(0, totalPedido - montoAbono);

                            return `
                              <div class="border p-3 rounded-xl space-y-2 ${p.aceptado_cuadre ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-300' : (entregado ? 'bg-white border-emerald-300 ring-1 ring-emerald-100' : 'bg-white border-slate-200')} shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                                   id="item-pedido-${p.id}"
                                   data-id="${p.id}"
                                   data-ruta-id="${r.id}"
                                   data-total="${totalPedido}"
                                   data-devuelta="${devueltaRedondeada}"
                                   data-monto-abono="${montoAbono}"
                                   data-saldo-pendiente="${saldoPendiente}"
                                   data-metodo-abono="${metodoAbono}"
                                   data-tipo-saldo="${p.tipo_saldo || 'CREDITO'}"
                                   data-metodo="${metodo}">
                                <input type="hidden" class="sel-metodo" data-id="${p.id}" data-ruta-id="${r.id}" data-total="${totalPedido}" data-devuelta="${devueltaRedondeada}" value="${metodo}">
                                
                                <div class="space-y-2">
                                  <!-- 1. Encabezado: Chulo en esquina + Datos cliente + Estado entregado y método -->
                                  <div class="flex items-start justify-between gap-2">
                                    <div class="flex items-start gap-2 min-w-0">
                                      <!-- Botón chulo de verificación en caja -->
                                      <button type="button"
                                              id="btn-check-cuadre-${p.id}"
                                              onclick="ModuloDomicilios.toggleAceptarPedidoCuadre(${p.id}, ${!p.aceptado_cuadre})"
                                              title="${p.aceptado_cuadre ? 'Pedido verificado y aceptado (clic para desmarcar)' : 'Clic para verificar y aceptar en caja'}"
                                              class="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${p.aceptado_cuadre ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300' : 'bg-white hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 border-2 border-slate-300 hover:border-emerald-500'}">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                                      </button>
                                      <div class="min-w-0 flex-1">
                                        <p class="font-bold text-xs text-slate-900 leading-snug">
                                          ${escapeHtml(p.cliente || p.cliente_nombre || 'Cliente General')}
                                          ${p.empresa ? ` · <span class="text-indigo-600 font-bold">🏢 ${escapeHtml(p.empresa)}</span>` : ''}
                                        </p>
                                        <p class="text-[11px] text-slate-600 mt-0.5 font-medium">
                                          📍 ${escapeHtml(p.direccion || 'Sin dirección')}
                                          ${p.telefono ? ` · <span class="text-slate-500 font-normal">📞 ${escapeHtml(p.telefono)}</span>` : ''}
                                        </p>
                                      </div>
                                    </div>

                                    <!-- Derecha: Estado entregado/completo, método de pago y fecha corta sin hora -->
                                    <div class="flex flex-col items-end gap-1 shrink-0">
                                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${entregado ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'}">
                                        ${entregado ? '✓ Entregado' : 'En camino'}
                                      </span>
                                      ${this.badgeMetodoPagoCompacto(p)}
                                      ${(r.fecha_creacion || p.ruta_fecha_creacion || p.fecha_creacion) ? `
                                        <span class="text-[10px] font-semibold text-slate-500 font-mono">
                                          ${this.formatearFechaCorta(r.fecha_creacion || p.ruta_fecha_creacion || p.fecha_creacion)}
                                        </span>
                                      ` : ''}
                                    </div>
                                  </div>

                                  <!-- 2. Valor que se debe entregar en efectivo -->
                                  <div class="flex items-center justify-between py-1.5 px-2.5 bg-emerald-50/90 border border-emerald-200/90 rounded-lg">
                                    <div class="flex items-center gap-1.5">
                                      <span class="text-xs font-black text-emerald-950">Efectivo a entregar:</span>
                                      <span class="text-[10px] text-emerald-800 font-mono">(${metodo === 'TRANSFERENCIA' ? 'Devuelta base' : (metodo === 'YA_PAGO' ? 'Devuelta base' : 'Cobro + Devuelta')})</span>
                                    </div>
                                    <b class="text-sm font-black font-mono text-emerald-700">$${valorAEntregar.toLocaleString('es-CO')}</b>
                                  </div>

                                  <!-- 3. Flechita para desplegar detalles del pedido -->
                                  <button type="button"
                                          onclick="ModuloDomicilios.toggleDetallesCuadrePedido(${p.id})"
                                          class="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-indigo-600 font-medium pt-0.5 cursor-pointer transition-colors select-none">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                      <span class="font-mono text-slate-600">${escapeHtml(p.codigo_pedido || ('Pedido #' + p.id))}</span>
                                      ${devueltaRedondeada > 0 ? `<span class="text-[10px] text-amber-900 font-medium">· Dev: $${devueltaRedondeada.toLocaleString('es-CO')}</span>` : ''}
                                    </div>
                                    <span class="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 shrink-0">
                                      <span>Detalles y edición</span>
                                      <span id="flecha-detalles-${p.id}" class="text-xs">${(this.detallesPedidoAbiertos && this.detallesPedidoAbiertos[p.id]) ? '▲' : '▼'}</span>
                                    </span>
                                  </button>

                                  <!-- 4. Contenedor desplegable de detalles -->
                                  <div id="detalles-cuadre-${p.id}" class="${(this.detallesPedidoAbiertos && this.detallesPedidoAbiertos[p.id]) ? '' : 'hidden'} pt-2 space-y-2 border-t border-slate-200 text-xs">
                                    <div class="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200/70 text-[11px]">
                                      <div class="flex justify-between items-center text-slate-600">
                                        <span class="font-medium">Total del Pedido:</span>
                                        <b class="font-mono text-slate-900">$${totalPedido.toLocaleString('es-CO')}</b>
                                      </div>
                                      ${devueltaRedondeada > 0 ? `
                                        <div class="flex justify-between items-center text-slate-600">
                                          <span>Devuelta entregada al despachar:</span>
                                          <b class="font-mono text-amber-900">$${devueltaRedondeada.toLocaleString('es-CO')}</b>
                                        </div>
                                      ` : ''}
                                      ${montoAbono > 0 ? `
                                        <div class="flex justify-between items-center text-amber-900">
                                          <span>Abono recibido (${metodoAbono === 'EFECTIVO' ? 'Efectivo' : 'Transf.'}):</span>
                                          <b class="font-mono font-bold">$${montoAbono.toLocaleString('es-CO')}</b>
                                        </div>
                                        <div class="flex justify-between items-center text-rose-700">
                                          <span>Saldo restante:</span>
                                          <b class="font-mono font-bold">$${saldoPendiente.toLocaleString('es-CO')} (${p.tipo_saldo === 'TRANSFERENCIA_PENDIENTE' ? 'Transf. Pend.' : 'Crédito'})</b>
                                        </div>
                                      ` : ''}
                                      <div class="flex justify-between items-center text-slate-600">
                                        <span>Ruta despachada el:</span>
                                        <b class="font-mono text-slate-800">${this.formatearFechaDespacho(r.fecha_creacion || p.ruta_fecha_creacion)}</b>
                                      </div>
                                      <div class="flex justify-between items-center text-slate-500 text-[10px] pt-1 border-t border-slate-200/80">
                                        <span>Detalle caja:</span>
                                        <span class="italic">${escapeHtml(explicacion)}</span>
                                      </div>
                                    </div>

                                    <!-- Lista de productos -->
                                    <div class="space-y-1">
                                      <span class="text-[10px] font-bold text-slate-700">Productos (${p.items?.length || 0}):</span>
                                      <div class="space-y-1 bg-white p-1.5 rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
                                        ${(p.items && p.items.length > 0) ? p.items.map(item => `
                                          <div class="flex justify-between items-center text-[10px] border-b border-slate-100 pb-0.5 last:border-b-0 last:pb-0">
                                            <span class="font-medium text-slate-800">${escapeHtml(item.nombre_producto || 'Producto')}</span>
                                            <b class="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded text-[9px]">×${item.cantidad_solicitada || item.cantidad_empacada || 1}</b>
                                          </div>
                                        `).join('') : '<p class="text-[10px] text-slate-400 italic">Sin productos registrados</p>'}
                                      </div>
                                    </div>

                                    <!-- Acciones de edición -->
                                    <div class="flex items-center gap-1.5 pt-1">
                                      <button type="button" onclick="ModuloDomicilios.confirmarEntrega(${p.id}, ${!entregado})"
                                              class="flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${entregado ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-900 text-white'}">
                                        ${entregado ? '↩ Pasar a Pendiente' : '✓ Marcar Entregado'}
                                      </button>
                                      <button type="button" onclick="ModuloDomicilios.abrirModalDetallePedido(${p.id}, ${r.id})"
                                              class="py-1 px-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                              title="Ajustar valores, cambiar método de pago o registrar abonos">
                                        <span>⚙️</span> <span>Editar / Ajustar</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            `;
                          }).join('')}
                        </div>

                        <!-- Resumen financiero del municipio -->
                        <div class="bg-white border border-slate-200/90 rounded-xl p-3 text-xs space-y-1.5 shadow-2xs">
                          ${st.todosEntregados ? `
                            <div class="flex justify-between text-slate-700">
                              <span>Cobrado en efectivo (${mun}):</span>
                              <b class="font-mono text-slate-900">$${st.cobradoEfectivo.toLocaleString('es-CO')}</b>
                            </div>
                            <div class="flex justify-between text-amber-900">
                              <span>Devueltas de ${mun}:</span>
                              <b class="font-mono">$${st.devueltas.toLocaleString('es-CO')}</b>
                            </div>
                            <div class="flex justify-between text-emerald-800 font-black border-t border-slate-200 pt-1.5 text-xs">
                              <span>A entregar / guardar (${mun}):</span>
                              <b class="font-mono text-emerald-700 text-sm">$${st.subtotal.toLocaleString('es-CO')}</b>
                            </div>
                          ` : `
                            <div class="flex justify-between text-amber-900 font-semibold">
                              <span>Devueltas a llevar en ${mun}:</span>
                              <b class="font-mono">$${st.devueltas.toLocaleString('es-CO')}</b>
                            </div>
                            <p class="text-[10px] text-slate-400">Municipio en curso: solo devueltas (aún no se suma el cobro).</p>
                          `}
                          <div class="flex justify-between text-indigo-900 font-semibold border-t border-slate-200 pt-1">
                            <span>Devueltas pendientes (otros municipios):</span>
                            <b class="font-mono">$${devueltasPendientesOtros.toLocaleString('es-CO')}</b>
                          </div>
                          <p class="text-[10px] text-slate-500 font-medium">
                            ${st.todosEntregados
                              ? `Terminaste ${mun}. Aparta $${st.subtotal.toLocaleString('es-CO')} y conserva $${devueltasPendientesOtros.toLocaleString('es-CO')} de cambio para el resto.`
                              : `Aún hay entregas en ${mun}. Cambio para otros municipios: $${devueltasPendientesOtros.toLocaleString('es-CO')}.`
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Arqueo consolidado de caja de la Ruta -->
              <div class="bg-slate-900 text-white p-4 rounded-xl text-xs space-y-2.5 shadow-lg" id="box-arqueo-ruta-${r.id}">
                <div class="flex justify-between text-slate-300">
                  <span class="flex items-center gap-1.5"><span>💵</span> (+) Efectivo cobrado (pedidos + abonos):</span>
                  <span id="arq-efectivo-${r.id}" class="font-bold text-white font-mono">$${totalCobradoEfectivoRuta.toLocaleString('es-CO')}</span>
                </div>
                <div class="flex justify-between text-slate-300">
                  <span class="flex items-center gap-1.5"><span>🎒</span> (+) Base devueltas asignada:</span>
                  <span id="arq-base-${r.id}" data-valor="${baseEfectivo}" class="font-bold text-white font-mono">$${baseEfectivo.toLocaleString('es-CO')}</span>
                </div>
                <div class="flex justify-between text-amber-300 border-t border-slate-800 pt-1">
                  <span class="flex items-center gap-1.5"><span>⏳</span> Saldos pendientes / Cartera (deuda):</span>
                  <span id="arq-saldos-${r.id}" class="font-bold font-mono">$${totalSaldosPendientesRuta.toLocaleString('es-CO')}</span>
                </div>
                <div class="flex justify-between font-extrabold text-emerald-400 border-t border-slate-700 pt-2 text-sm">
                  <span class="flex items-center gap-1.5"><span>💰</span> (=) Total a entregar en caja:</span>
                  <span id="arq-total-${r.id}" data-valor="${totalEntregarCajaRuta}" class="text-base font-black font-mono">$${totalEntregarCajaRuta.toLocaleString('es-CO')}</span>
                </div>
              </div>

              <!-- Botón principal para liquidar esta ruta -->
              ${!(typeof Auth !== 'undefined' && Auth.isDomiciliario()) ? `
                <div class="space-y-1.5 pt-1">
                  <button type="button"
                          onclick="ModuloDomicilios.cerrarYLiquidarRuta(${r.id})"
                          class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2">
                    <span>✅</span> <span>Liquidar Ruta #${r.id} · ${escapeHtml(r.domiciliario_nombre || 'Domiciliario')} (${aceptadosCount}/${totalPedidos} aceptados)</span>
                  </button>
                  <p class="text-[11px] text-center text-slate-400">
                    ${aceptadosCount === totalPedidos
                      ? '✓ Todos los pedidos han sido aceptados y verificados. Listo para liquidar y asentar en auditoría.'
                      : `Hay ${totalPedidos - aceptadosCount} pedido(s) pendientes de aceptar. Se confirmará su aceptación automática al liquidar.`}
                  </p>
                </div>
              ` : `
                <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p class="text-xs font-bold text-emerald-900">🛵 Modo Repartidor de Calle</p>
                  <p class="text-[11px] text-emerald-800 mt-0.5">El cierre definitivo y liquidación de dinero en caja lo realiza la administración.</p>
                </div>
              `}
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;

      const contFinal = document.getElementById('contenedor-subtab');
      if (contFinal) {
        contFinal.innerHTML = html;
        this.recalcularArqueo();
      }
    } catch (err) {
      console.error('Error al renderizar cuadre:', err);
      const contErr = document.getElementById('contenedor-subtab');
      if (contErr) {
        contErr.innerHTML = `<p class="text-xs text-rose-500 text-center py-4">Error al cargar cuadre: ${escapeHtml(err.message)}</p>`;
      }
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

  _initPersistentState() {
    try {
      if (!this._rutasAbiertasSeguimiento) {
        this._rutasAbiertasSeguimiento = JSON.parse(localStorage.getItem('domi_rutas_abiertas') || '{}');
      }
      if (!this._municipiosAbiertosSeguimiento) {
        this._municipiosAbiertosSeguimiento = JSON.parse(localStorage.getItem('domi_mun_abiertos') || '{}');
      }
      if (!this._rutasAbiertasCuadre) {
        this._rutasAbiertasCuadre = JSON.parse(localStorage.getItem('domi_cuadre_rutas_abiertas') || '{}');
      }
      if (!this._municipiosAbiertosCuadre) {
        this._municipiosAbiertosCuadre = JSON.parse(localStorage.getItem('domi_cuadre_mun_abiertos') || '{}');
      }
    } catch (e) {
      this._rutasAbiertasSeguimiento = this._rutasAbiertasSeguimiento || {};
      this._municipiosAbiertosSeguimiento = this._municipiosAbiertosSeguimiento || {};
      this._rutasAbiertasCuadre = this._rutasAbiertasCuadre || {};
      this._municipiosAbiertosCuadre = this._municipiosAbiertosCuadre || {};
    }
  },

  toggleRutaCuadre(rutaId, event) {
    if (event) event.stopPropagation();
    this._initPersistentState();
    const body = document.getElementById(`ruta-body-cuadre-${rutaId}`);
    const arrow = document.getElementById(`ruta-arrow-cuadre-${rutaId}`);
    const btnText = document.getElementById(`ruta-btn-text-cuadre-${rutaId}`);
    if (!body) return;
    const abierto = !body.classList.contains('hidden');
    if (abierto) {
      body.classList.add('hidden');
      if (arrow) arrow.textContent = '▶';
      if (btnText) btnText.textContent = 'Desplegar pedidos';
      this._rutasAbiertasCuadre[rutaId] = false;
    } else {
      body.classList.remove('hidden');
      if (arrow) arrow.textContent = '▼';
      if (btnText) btnText.textContent = 'Plegar pedidos';
      this._rutasAbiertasCuadre[rutaId] = true;
    }
    try {
      localStorage.setItem('domi_cuadre_rutas_abiertas', JSON.stringify(this._rutasAbiertasCuadre));
    } catch (e) {}
  },

  toggleTodosRutasCuadre(desplegar = true) {
    this._initPersistentState();
    const container = document.getElementById('contenedor-rutas-cuadre');
    if (!container) return;
    const cards = container.querySelectorAll('[id^="card-ruta-cuadre-"]');
    cards.forEach(card => {
      const rutaId = card.id.replace('card-ruta-cuadre-', '');
      const body = document.getElementById(`ruta-body-cuadre-${rutaId}`);
      const arrow = document.getElementById(`ruta-arrow-cuadre-${rutaId}`);
      const btnText = document.getElementById(`ruta-btn-text-cuadre-${rutaId}`);
      if (body) {
        if (desplegar) {
          body.classList.remove('hidden');
          if (arrow) arrow.textContent = '▼';
          if (btnText) btnText.textContent = 'Plegar pedidos';
          this._rutasAbiertasCuadre[rutaId] = true;
        } else {
          body.classList.add('hidden');
          if (arrow) arrow.textContent = '▶';
          if (btnText) btnText.textContent = 'Desplegar pedidos';
          this._rutasAbiertasCuadre[rutaId] = false;
        }
      }
    });
    try {
      localStorage.setItem('domi_cuadre_rutas_abiertas', JSON.stringify(this._rutasAbiertasCuadre));
    } catch (e) {}
  },

  toggleRutaSeguimiento(rutaId, event) {
    if (event) event.stopPropagation();
    this._initPersistentState();
    const body = document.getElementById(`ruta-body-${rutaId}`);
    const arrow = document.getElementById(`ruta-arrow-${rutaId}`);
    const btnText = document.getElementById(`ruta-btn-text-${rutaId}`);
    if (!body) return;
    const abierto = !body.classList.contains('hidden');
    if (abierto) {
      body.classList.add('hidden');
      if (arrow) arrow.textContent = '▶';
      if (btnText) btnText.textContent = 'Desplegar ruta';
      this._rutasAbiertasSeguimiento[rutaId] = false;
    } else {
      body.classList.remove('hidden');
      if (arrow) arrow.textContent = '▼';
      if (btnText) btnText.textContent = 'Plegar ruta';
      this._rutasAbiertasSeguimiento[rutaId] = true;
    }
    try {
      localStorage.setItem('domi_rutas_abiertas', JSON.stringify(this._rutasAbiertasSeguimiento));
    } catch (e) {}
  },

  toggleMunicipioSeguimiento(rutaId, mun, munIdx, event) {
    if (event) event.stopPropagation();
    this._initPersistentState();
    const key = `ruta_${rutaId}_mun_${mun}`;
    const body = document.getElementById(`mun-body-${rutaId}-${munIdx}`);
    const arrow = document.getElementById(`mun-arrow-${rutaId}-${munIdx}`);
    const textHint = document.getElementById(`mun-hint-${rutaId}-${munIdx}`);
    if (!body) return;
    const abierto = !body.classList.contains('hidden');
    if (abierto) {
      body.classList.add('hidden');
      if (arrow) arrow.textContent = '▶';
      if (textHint) textHint.textContent = 'Ver pedidos';
      this._municipiosAbiertosSeguimiento[key] = false;
    } else {
      body.classList.remove('hidden');
      if (arrow) arrow.textContent = '▼';
      if (textHint) textHint.textContent = 'Ocultar';
      this._municipiosAbiertosSeguimiento[key] = true;
    }
    try {
      localStorage.setItem('domi_mun_abiertos', JSON.stringify(this._municipiosAbiertosSeguimiento));
    } catch (e) {}
  },

  toggleMunicipioCuadre(rutaIdOrIdx, munIdxOrName, munNameOrEvent, maybeEvent) {
    let rutaId, munIdx, munName, event;
    if (typeof munNameOrEvent === 'string') {
      rutaId = rutaIdOrIdx;
      munIdx = munIdxOrName;
      munName = munNameOrEvent;
      event = maybeEvent;
    } else {
      munIdx = rutaIdOrIdx;
      munName = munIdxOrName;
      event = munNameOrEvent;
      rutaId = this.rutaSeleccionadaId || 0;
    }
    if (event && event.stopPropagation) event.stopPropagation();
    this._initPersistentState();
    const key = `cuadre_${rutaId}_mun_${munName || munIdx}`;
    
    let body = document.getElementById(`mun-body-${rutaId}-${munIdx}`);
    let arrow = document.getElementById(`mun-arrow-${rutaId}-${munIdx}`);
    if (!body) {
      body = document.getElementById(`mun-body-${munIdx}`);
      arrow = document.getElementById(`mun-arrow-${munIdx}`);
    }
    if (!body) return;
    const abierto = !body.classList.contains('hidden');
    if (abierto) {
      body.classList.add('hidden');
      if (arrow) arrow.textContent = '▸';
      this._municipiosAbiertosCuadre[key] = false;
    } else {
      body.classList.remove('hidden');
      if (arrow) arrow.textContent = '▾';
      this._municipiosAbiertosCuadre[key] = true;
    }
    try {
      localStorage.setItem('domi_cuadre_mun_abiertos', JSON.stringify(this._municipiosAbiertosCuadre));
    } catch (e) {}
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

  /** Despliega o pliega los detalles y herramientas de edición en la tarjeta del cuadre */
  toggleDetallesCuadrePedido(pedidoId) {
    this.detallesPedidoAbiertos = this.detallesPedidoAbiertos || {};
    const box = document.getElementById(`detalles-cuadre-${pedidoId}`);
    const arrow = document.getElementById(`flecha-detalles-${pedidoId}`);
    if (!box) return;
    const abierto = !box.classList.contains('hidden');
    if (abierto) {
      box.classList.add('hidden');
      if (arrow) arrow.textContent = '▼';
      this.detallesPedidoAbiertos[pedidoId] = false;
    } else {
      box.classList.remove('hidden');
      if (arrow) arrow.textContent = '▲';
      this.detallesPedidoAbiertos[pedidoId] = true;
    }
  },

  /** Marca o desmarca individualmente un pedido como verificado/aceptado en el cuadre */
  async toggleAceptarPedidoCuadre(pedidoId, aceptar) {
    try {
      // Feedback visual optimista inmediato
      const card = document.getElementById(`item-pedido-${pedidoId}`);
      const btn = document.getElementById(`btn-check-cuadre-${pedidoId}`);
      if (card) {
        card.classList.toggle('bg-emerald-50/80', Boolean(aceptar));
        card.classList.toggle('border-emerald-400', Boolean(aceptar));
        card.classList.toggle('ring-1', Boolean(aceptar));
        card.classList.toggle('ring-emerald-300', Boolean(aceptar));
      }
      if (btn) {
        btn.classList.toggle('bg-emerald-600', Boolean(aceptar));
        btn.classList.toggle('text-white', Boolean(aceptar));
        btn.classList.toggle('ring-2', Boolean(aceptar));
        btn.classList.toggle('ring-emerald-300', Boolean(aceptar));
        btn.classList.toggle('bg-white', !aceptar);
        btn.classList.toggle('text-slate-300', !aceptar);
        btn.setAttribute('onclick', `ModuloDomicilios.toggleAceptarPedidoCuadre(${pedidoId}, ${!aceptar})`);
      }

      await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aceptado_cuadre: Boolean(aceptar) })
      });
      await this.cargarTabActual();
    } catch (err) {
      console.error('Error al actualizar estado de cuadre:', err);
      alert('Error al actualizar estado del pedido: ' + err.message);
      this.cargarTabActual();
    }
  },

  /** Acepta o desmarca todos los pedidos de la ruta para el cuadre */
  async aceptarTodosPedidosCuadre(rutaId, aceptar = true) {
    try {
      await apiFetch(`/rutas/${rutaId}/aceptar-todos-cuadre`, {
        method: 'POST',
        body: JSON.stringify({ aceptado: Boolean(aceptar) })
      });
      await this.cargarTabActual();
    } catch (err) {
      alert('Error al aceptar pedidos: ' + err.message);
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

    // Devuelta: establecida al despachar la ruta y NO se recalcula jamás (es el dinero entregado al domiciliario)
    let devueltaFija = parseFloat(card?.dataset?.devuelta);
    if (isNaN(devueltaFija) || devueltaFija < 0) {
      devueltaFija = 0;
    }
    if (card) card.dataset.devuelta = String(devueltaFija);
    if (sel) sel.dataset.devuelta = String(devueltaFija);

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
    const esYaPago = metodo === 'YA_PAGO';
    const montoAbono = parseFloat(card?.dataset?.montoAbono) || 0;
    const metodoAbono = card?.dataset?.metodoAbono || 'EFECTIVO';
    const tipoSaldo = card?.dataset?.tipoSaldo || 'CREDITO';
    const saldoPendiente = parseFloat(card?.dataset?.saldoPendiente) || 0;
    const hayAbono = montoAbono > 0;

    const devuelta = parseFloat(sel?.dataset?.devuelta) || parseFloat(card?.dataset?.devuelta) || 0;
    
    let aCaja = 0;
    if (esYaPago) {
      aCaja = this.redondearCaja50(devuelta);
    } else if (hayAbono) {
      if (metodoAbono === 'TRANSFERENCIA') {
        aCaja = this.redondearCaja50(devuelta);
      } else {
        aCaja = this.redondearCaja50(montoAbono + devuelta);
      }
    } else if (esTransfer) {
      aCaja = this.redondearCaja50(devuelta);
    } else {
      aCaja = this.redondearCaja50(total + devuelta);
    }

    const elCaja = document.getElementById(`caja-line-${pedidoId}`);
    const elHint = document.getElementById(`caja-hint-${pedidoId}`);
    const elDevLine = document.getElementById(`dev-line-${pedidoId}`);
    if (elCaja) elCaja.innerText = `$${aCaja.toLocaleString('es-CO')}`;
    if (elDevLine) {
      elDevLine.innerText = `$${devuelta.toLocaleString('es-CO')}`;
      elDevLine.closest('div')?.classList.toggle('hidden', !(devuelta > 0));
    }
    if (elHint) {
      elHint.textContent = esYaPago
        ? (devuelta > 0
            ? 'Ya pagó: el domiciliario regresa la devuelta que salió con él (cobro $0).'
            : 'Ya pagó: cobro $0 al cliente.')
        : (hayAbono
            ? (metodoAbono === 'TRANSFERENCIA'
                ? `Abono por transferencia ($${montoAbono.toLocaleString('es-CO')}): el repartidor entrega la devuelta base de $${devuelta.toLocaleString('es-CO')}.`
                : `Abono en efectivo ($${montoAbono.toLocaleString('es-CO')}) + devuelta base ($${devuelta.toLocaleString('es-CO')}) = $${aCaja.toLocaleString('es-CO')} a caja. Resto: $${saldoPendiente.toLocaleString('es-CO')} a ${tipoSaldo === 'TRANSFERENCIA_PENDIENTE' ? 'transferencia pendiente' : 'crédito'}.`)
            : (esTransfer
                ? (devuelta > 0
                    ? 'Transferencia: el domiciliario regresa la devuelta que salió con él.'
                    : 'Transferencia: sin devuelta (se despachó sin cambio).')
                : 'Efectivo: en caja el valor cobrado del pedido.'));
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
      // TRANSFERENCIA_PENDIENTE / YA_PAGO: sin exigir comprobante

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

  /** Abre el modal para registrar o modificar un abono parcial */
  abrirModalAbono(pedidoId) {
    this.cerrarModalAbono();
    const pedido = (this._cuadrePedidos || []).find(p => p.id === pedidoId);
    if (!pedido) return;

    const totalPedido = Number(pedido.total) || 0;
    const montoActual = Number(pedido.monto_abono) || 0;
    const metodoActual = pedido.metodo_abono || 'EFECTIVO';
    const tipoSaldoActual = pedido.tipo_saldo || 'CREDITO';
    const devueltaEntregada = Number(pedido.devuelta_calculada) || 0;
    const saldoActual = (pedido.saldo_pendiente !== undefined && pedido.saldo_pendiente !== null && Number(pedido.saldo_pendiente) >= 0)
      ? Number(pedido.saldo_pendiente)
      : Math.max(0, totalPedido - montoActual);

    const modal = document.createElement('div');
    modal.id = 'modal-abono-pedido';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 transform transition-all text-slate-800" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>💵</span> Registrar Abono Parcial
            </h3>
            <p class="text-xs text-slate-500">${pedido.codigo_pedido || ('Pedido #' + pedido.id)} · ${pedido.cliente || 'Cliente'}</p>
          </div>
          <button type="button" onclick="ModuloDomicilios.cerrarModalAbono()"
                  class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold transition">✕</button>
        </div>

        <div class="py-4 space-y-4 text-xs">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
            <span class="text-slate-600 font-medium">Valor total del pedido:</span>
            <span class="text-sm font-bold text-slate-900">$${totalPedido.toLocaleString('es-CO')}</span>
          </div>

          <div class="space-y-1.5">
            <label class="block font-bold text-slate-700">Monto del abono recibido ($)</label>
            <input type="number" id="input-monto-abono" min="0" max="${totalPedido}" step="1000"
                   value="${montoActual > 0 ? montoActual : ''}" placeholder="Ej: 20000"
                   class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                   oninput="ModuloDomicilios.recalcularSaldoAbonoModal(${totalPedido}, ${devueltaEntregada})" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="block font-bold text-slate-700">Método del abono</label>
              <select id="select-metodo-abono" onchange="ModuloDomicilios.recalcularSaldoAbonoModal(${totalPedido}, ${devueltaEntregada})"
                      class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 bg-white">
                <option value="EFECTIVO" ${metodoActual === 'EFECTIVO' ? 'selected' : ''}>💵 Efectivo (Recibido)</option>
                <option value="TRANSFERENCIA" ${metodoActual === 'TRANSFERENCIA' ? 'selected' : ''}>🏦 Transferencia</option>
              </select>
            </div>

            <div class="space-y-1.5">
              <label class="block font-bold text-slate-700">¿Cómo queda el saldo restante?</label>
              <select id="select-tipo-saldo" onchange="ModuloDomicilios.recalcularSaldoAbonoModal(${totalPedido}, ${devueltaEntregada})"
                      class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 bg-white">
                <option value="CREDITO" ${tipoSaldoActual === 'CREDITO' ? 'selected' : ''}>💳 Crédito (Cartera/Fiado)</option>
                <option value="TRANSFERENCIA_PENDIENTE" ${tipoSaldoActual === 'TRANSFERENCIA_PENDIENTE' ? 'selected' : ''}>⏳ Transferencia pendiente</option>
              </select>
            </div>
          </div>

          <div class="pt-1">
            <label class="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200">
              <input type="checkbox" id="chk-modal-marcar-entregado" class="w-4 h-4 text-emerald-600 rounded" ${pedido.estado_entrega === 'ENTREGADO' ? 'checked' : 'checked'} />
              <span>Marcar pedido como <b>Entregado al cliente</b></span>
            </label>
          </div>

          <div class="p-3 bg-amber-50/90 rounded-xl border border-amber-200 space-y-2">
            <div class="flex justify-between items-center text-amber-950 font-bold">
              <span>Saldo que queda debiendo el cliente:</span>
              <span id="txt-modal-saldo-pendiente" class="text-sm font-extrabold text-rose-700">$${saldoActual.toLocaleString('es-CO')}</span>
            </div>
            <div id="txt-modal-arqueo-explicacion" class="text-[11px] text-slate-700 border-t border-amber-200/80 pt-1.5 leading-relaxed">
              <!-- Calculado dinámicamente -->
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onclick="ModuloDomicilios.cerrarModalAbono()"
                  class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancelar</button>
          <button type="button" onclick="ModuloDomicilios.guardarAbono(${pedidoId})"
                  class="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition">Guardar Abono</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) ModuloDomicilios.cerrarModalAbono();
    });
    this.recalcularSaldoAbonoModal(totalPedido, devueltaEntregada);
    setTimeout(() => {
      const inp = document.getElementById('input-monto-abono');
      if (inp) { inp.focus(); inp.select(); }
    }, 50);
  },

  cerrarModalAbono() {
    const modal = document.getElementById('modal-abono-pedido');
    if (modal) modal.remove();
  },

  recalcularSaldoAbonoModal(totalPedido, devueltaEntregada = 0) {
    const inp = document.getElementById('input-monto-abono');
    const txt = document.getElementById('txt-modal-saldo-pendiente');
    const txtExp = document.getElementById('txt-modal-arqueo-explicacion');
    const selMetodo = document.getElementById('select-metodo-abono');
    const selTipoSaldo = document.getElementById('select-tipo-saldo');
    if (!inp || !txt) return;

    let monto = parseFloat(inp.value) || 0;
    if (monto < 0) monto = 0;
    const saldo = Math.max(0, totalPedido - monto);
    txt.innerText = `$${saldo.toLocaleString('es-CO')}`;

    const metodo = selMetodo?.value || 'EFECTIVO';
    const tipoSaldo = selTipoSaldo?.value || 'CREDITO';
    const dev = Number(devueltaEntregada) || 0;

    let totalCajaPedido = 0;
    if (metodo === 'EFECTIVO') {
      totalCajaPedido = monto + dev;
    } else {
      totalCajaPedido = dev;
    }

    if (txtExp) {
      txtExp.innerHTML = `
        <div class="space-y-1.5">
          <p><strong>📥 A entregar en caja por este pedido:</strong>
            ${metodo === 'EFECTIVO'
              ? `Abono recibido en efectivo ($${monto.toLocaleString('es-CO')}) + Devuelta base ($${dev.toLocaleString('es-CO')}) = <strong class="text-emerald-800 text-xs">$${totalCajaPedido.toLocaleString('es-CO')}</strong>`
              : `Abono por transferencia ($${monto.toLocaleString('es-CO')} - entra a cuenta). En caja se entrega la devuelta base de <strong class="text-emerald-800 text-xs">$${dev.toLocaleString('es-CO')}</strong>`}
          </p>
          <p><strong>📑 Cartera / Cobro pendiente:</strong>
            Saldo restante de <strong class="text-rose-700">$${saldo.toLocaleString('es-CO')}</strong> queda como <strong>${tipoSaldo === 'TRANSFERENCIA_PENDIENTE' ? '⏳ Transferencia pendiente' : '💳 Crédito / Cartera cliente'}</strong>.
          </p>
        </div>
      `;
    }
  },

  async guardarAbono(pedidoId) {
    const pedido = (this._cuadrePedidos || []).find(p => p.id === pedidoId);
    if (!pedido) return;

    const totalPedido = Number(pedido.total) || 0;
    const inpMonto = document.getElementById('input-monto-abono');
    const selMetodo = document.getElementById('select-metodo-abono');
    const selTipoSaldo = document.getElementById('select-tipo-saldo');
    const chkEntregado = document.getElementById('chk-modal-marcar-entregado');
    const marcarEntregado = chkEntregado ? chkEntregado.checked : true;

    let montoAbono = parseFloat(inpMonto?.value) || 0;
    if (montoAbono < 0) montoAbono = 0;
    if (montoAbono > totalPedido) {
      return alert(`El monto del abono ($${montoAbono.toLocaleString('es-CO')}) no puede ser mayor que el total del pedido ($${totalPedido.toLocaleString('es-CO')}).`);
    }

    const metodoAbono = selMetodo?.value || 'EFECTIVO';
    const tipoSaldo = selTipoSaldo?.value || 'CREDITO';
    const saldoPendiente = Math.max(0, totalPedido - montoAbono);
    const estadoEntregaFinal = marcarEntregado ? 'ENTREGADO' : (pedido.estado_entrega || 'PENDIENTE');

    try {
      const res = await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoAbono: montoAbono,
          monto_abono: montoAbono,
          saldoPendiente: saldoPendiente,
          saldo_pendiente: saldoPendiente,
          metodoAbono: metodoAbono,
          metodo_abono: metodoAbono,
          tipoSaldo: tipoSaldo,
          tipo_saldo: tipoSaldo,
          estadoEntrega: estadoEntregaFinal,
          estado_entrega: estadoEntregaFinal
        })
      });

      if (res && res.ok) {
        if (res.pedido) {
          Object.assign(pedido, res.pedido);
        } else {
          pedido.monto_abono = montoAbono;
          pedido.saldo_pendiente = saldoPendiente;
          pedido.metodo_abono = metodoAbono;
          pedido.tipo_saldo = tipoSaldo;
          pedido.estado_entrega = estadoEntregaFinal;
        }
        showToast(`Abono de $${montoAbono.toLocaleString('es-CO')} guardado exitosamente`);
        this.cerrarModalAbono();
        await this.renderTabCuadre();
        this.recalcularArqueo();
      } else {
        alert(res?.error || 'No se pudo guardar el abono');
      }
    } catch (err) {
      alert('Error al guardar el abono: ' + (err.message || 'Error de conexión'));
    }
  },

  async eliminarAbono(pedidoId) {
    if (!confirm('¿Deseas quitar el abono registrado para este pedido?')) return;
    const pedido = (this._cuadrePedidos || []).find(p => p.id === pedidoId);
    try {
      const res = await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoAbono: 0,
          monto_abono: 0,
          saldoPendiente: 0,
          saldo_pendiente: 0,
          metodoAbono: 'EFECTIVO',
          metodo_abono: 'EFECTIVO',
          tipoSaldo: 'CREDITO',
          tipo_saldo: 'CREDITO'
        })
      });
      if (res && res.ok) {
        if (pedido) {
          pedido.monto_abono = 0;
          pedido.saldo_pendiente = 0;
          pedido.metodo_abono = 'EFECTIVO';
          pedido.tipo_saldo = 'CREDITO';
        }
        showToast('Abono eliminado');
        await this.renderTabCuadre();
      }
    } catch (err) {
      alert('Error al quitar abono');
    }
  },

  async marcarEntregaRapida(pedidoId, entregado) {
    const estadoEntrega = entregado ? 'ENTREGADO' : 'PENDIENTE';
    try {
      const res = await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoEntrega })
      });
      if (res && res.ok) {
        showToast(entregado ? '✓ Pedido marcado como entregado' : '↩ Pedido vuelto a pendiente');
        if (this.subTabActual === 'cuadre') {
          await this.renderTabCuadre();
        } else {
          await this.cargarTabActual();
        }
      } else {
        alert(res?.error || 'No se pudo actualizar el estado de entrega');
      }
    } catch (e) {
      alert('Error al actualizar entrega');
    }
  },

  async confirmarEntrega(pedidoId, entregado) {
    const estadoEntrega = entregado ? 'ENTREGADO' : 'PENDIENTE';
    try {
      // Guarda método/total actuales antes de refrescar si los campos existen en DOM
      if (document.querySelector(`.sel-metodo[data-id="${pedidoId}"]`)) {
        await this.guardarCambioPedido(pedidoId);
      }

      const res = await apiFetch(`/rutas/pedido/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoEntrega })
      });
      if (res && res.ok) {
        showToast(entregado ? 'Pedido marcado como entregado' : 'Pedido vuelto a pendiente');
        if (this.subTabActual === 'cuadre') {
          await this.renderTabCuadre();
        } else {
          await this.cargarTabActual();
        }
      } else {
        alert(res.error || 'No se pudo actualizar');
      }
    } catch (e) {
      alert('Error al confirmar entrega');
    }
  },

  recalcularArqueo(rutaId = null) {
    // Si no se especifica rutaId o si queremos recalcular todas las rutas en pantalla
    const rutasCards = document.querySelectorAll('[id^="card-ruta-cuadre-"]');
    
    if (rutasCards.length > 0) {
      let grandTotalEntregar = 0;
      rutasCards.forEach(cardRuta => {
        const rid = cardRuta.id.replace('card-ruta-cuadre-', '');
        if (rutaId && String(rutaId) !== String(rid)) return;

        let totalEfectivoRecolectado = 0;
        let totalSaldosPendientes = 0;
        const selects = cardRuta.querySelectorAll('.sel-metodo');

        selects.forEach(sel => {
          const pid = sel.dataset.id;
          const card = document.getElementById(`item-pedido-${pid}`);
          const total = parseFloat(sel.dataset.total) || 0;
          const montoAbono = parseFloat(card?.dataset?.montoAbono) || 0;
          const saldoPendiente = parseFloat(card?.dataset?.saldoPendiente) || 0;
          const metodoAbono = card?.dataset?.metodoAbono || 'EFECTIVO';
          const metodo = sel.value;
          const esTransfer = metodo === 'TRANSFERENCIA' || metodo === 'TRANSFERENCIA_PENDIENTE';
          const esYaPago = metodo === 'YA_PAGO';

          if (esYaPago) {
            // $0 cobrado
          } else if (montoAbono > 0) {
            if (metodoAbono === 'EFECTIVO') {
              totalEfectivoRecolectado += this.redondearCaja50(montoAbono);
            }
            totalSaldosPendientes += saldoPendiente;
          } else if (esTransfer) {
            if (metodo === 'TRANSFERENCIA_PENDIENTE') {
              totalSaldosPendientes += total;
            }
          } else {
            totalEfectivoRecolectado += this.redondearCaja50(total);
          }
        });

        const elBase = document.getElementById(`arq-base-${rid}`);
        const baseRuta = parseFloat(elBase?.dataset?.valor) || 0;

        totalEfectivoRecolectado = this.redondearCaja50(totalEfectivoRecolectado);
        const totalEntregar = this.redondearCaja50(totalEfectivoRecolectado + baseRuta);
        grandTotalEntregar += totalEntregar;

        const elEfectivo = document.getElementById(`arq-efectivo-${rid}`);
        const elSaldos = document.getElementById(`arq-saldos-${rid}`);
        const elTotal = document.getElementById(`arq-total-${rid}`);
        if (elEfectivo) elEfectivo.innerText = `$${totalEfectivoRecolectado.toLocaleString('es-CO')}`;
        if (elSaldos) elSaldos.innerText = `$${totalSaldosPendientes.toLocaleString('es-CO')}`;
        if (elTotal) {
          elTotal.innerText = `$${totalEntregar.toLocaleString('es-CO')}`;
          elTotal.dataset.valor = String(totalEntregar);
        }
      });
      return grandTotalEntregar;
    }

    // Fallback si hay un solo bloque global
    let totalEfectivoRecolectado = 0;
    let totalSaldosPendientes = 0;
    const selects = document.querySelectorAll('.sel-metodo');

    selects.forEach(sel => {
      const pid = sel.dataset.id;
      const card = document.getElementById(`item-pedido-${pid}`);
      const total = parseFloat(sel.dataset.total) || 0;
      const montoAbono = parseFloat(card?.dataset?.montoAbono) || 0;
      const saldoPendiente = parseFloat(card?.dataset?.saldoPendiente) || 0;
      const metodoAbono = card?.dataset?.metodoAbono || 'EFECTIVO';
      const metodo = sel.value;
      const boxComp = document.getElementById(`box-comp-${pid}`);
      const esTransfer = metodo === 'TRANSFERENCIA' || metodo === 'TRANSFERENCIA_PENDIENTE';
      const esYaPago = metodo === 'YA_PAGO';

      if (boxComp) {
        if (metodo === 'TRANSFERENCIA') boxComp.classList.remove('hidden');
        else boxComp.classList.add('hidden');
      }

      if (esYaPago) {
        // Nada en efectivo cobrado
      } else if (montoAbono > 0) {
        if (metodoAbono === 'EFECTIVO') {
          totalEfectivoRecolectado += this.redondearCaja50(montoAbono);
        }
        totalSaldosPendientes += saldoPendiente;
      } else if (esTransfer) {
        if (metodo === 'TRANSFERENCIA_PENDIENTE') {
          totalSaldosPendientes += total;
        }
      } else {
        totalEfectivoRecolectado += this.redondearCaja50(total);
      }
    });

    const elBase = document.getElementById('arq-base');
    const baseRuta = parseFloat(elBase?.dataset?.valor) || 0;

    totalEfectivoRecolectado = this.redondearCaja50(totalEfectivoRecolectado);
    const totalEntregar = this.redondearCaja50(totalEfectivoRecolectado + baseRuta);

    const elEfectivo = document.getElementById('arq-efectivo');
    const elSaldos = document.getElementById('arq-saldos');
    const elTotal = document.getElementById('arq-total');
    if (elEfectivo) elEfectivo.innerText = `$${totalEfectivoRecolectado.toLocaleString('es-CO')}`;
    if (elSaldos) elSaldos.innerText = `$${totalSaldosPendientes.toLocaleString('es-CO')}`;
    if (elTotal) {
      elTotal.innerText = `$${totalEntregar.toLocaleString('es-CO')}`;
      elTotal.dataset.valor = String(totalEntregar);
    }
    return totalEntregar;
  },

  async cerrarYLiquidarRuta(rutaId) {
    this.abrirModalConfirmarLiquidacion(rutaId);
  },

  async abrirModalConfirmarLiquidacion(rutaId) {
    try {
      const ruta = await apiFetch(`/rutas/${rutaId}`);
      if (!ruta || !ruta.pedidos) {
        showToast('No se encontró la información de la ruta', 'error');
        return;
      }
      const pedidos = ruta.pedidos;
      const totalPedidos = pedidos.length;
      const aceptadosCount = pedidos.filter(p => p.aceptado_cuadre).length;
      const noAceptadosCount = totalPedidos - aceptadosCount;

      // Calcular totales
      const totalEntregar = this.recalcularArqueo(rutaId);
      const elBase = document.getElementById(`arq-base-${rutaId}`);
      const baseRuta = parseFloat(elBase?.dataset?.valor) || parseFloat(ruta.base_efectivo) || 0;
      const elEfectivo = document.getElementById(`arq-efectivo-${rutaId}`);
      const textoEfectivo = elEfectivo ? elEfectivo.innerText : `$0`;
      const elSaldos = document.getElementById(`arq-saldos-${rutaId}`);
      const textoSaldos = elSaldos ? elSaldos.innerText : `$0`;

      // Remover modal previo si existiera
      const previo = document.getElementById('modal-confirm-liquidar-ruta');
      if (previo) previo.remove();

      const modalDiv = document.createElement('div');
      modalDiv.id = 'modal-confirm-liquidar-ruta';
      modalDiv.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn';
      modalDiv.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
          <div class="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xl">💰</span>
              <div>
                <h3 class="font-bold text-sm">Liquidar Ruta #${rutaId}</h3>
                <p class="text-[11px] text-slate-300">${escapeHtml(ruta.domiciliario_nombre || 'Domiciliario')}</p>
              </div>
            </div>
            <button type="button" onclick="document.getElementById('modal-confirm-liquidar-ruta').remove()" class="text-slate-400 hover:text-white text-lg font-bold p-1">✕</button>
          </div>

          <div class="p-5 space-y-4">
            <!-- Desglose financiero -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div class="flex justify-between text-slate-700">
                <span>📦 Total Pedidos:</span>
                <b class="font-bold">${totalPedidos} pedido(s)</b>
              </div>
              <div class="flex justify-between text-slate-700">
                <span>💵 Efectivo cobrado:</span>
                <b class="font-mono text-slate-900 font-bold">${textoEfectivo}</b>
              </div>
              <div class="flex justify-between text-slate-700">
                <span>🎒 Base devueltas asignada:</span>
                <b class="font-mono text-slate-900 font-bold">$${baseRuta.toLocaleString('es-CO')}</b>
              </div>
              <div class="flex justify-between text-amber-700 border-t border-slate-200 pt-1.5">
                <span>⏳ Saldos / Cartera pendiente:</span>
                <b class="font-mono font-bold">${textoSaldos}</b>
              </div>
              <div class="flex justify-between text-emerald-800 font-extrabold border-t border-slate-300 pt-2 text-sm">
                <span>💰 Total a entregar en caja:</span>
                <b class="font-mono text-base text-emerald-700 font-black">$${totalEntregar.toLocaleString('es-CO')}</b>
              </div>
            </div>

            ${noAceptadosCount > 0 ? `
              <div class="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs flex gap-2.5 items-start">
                <span class="text-base">⚠️</span>
                <div>
                  <p class="font-bold">Hay ${noAceptadosCount} pedido(s) sin marcar con chulo.</p>
                  <p class="text-[11px] text-amber-800 mt-0.5">Al liquidar, se marcarán automáticamente como entregados y aceptados en el cuadre.</p>
                </div>
              </div>
            ` : `
              <div class="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl text-xs flex gap-2 items-center">
                <span class="text-base">✓</span>
                <p class="font-medium">Todos los ${totalPedidos} pedidos están verificados con chulo.</p>
              </div>
            `}

            <div class="flex items-center gap-2.5 pt-2">
              <button type="button"
                      onclick="document.getElementById('modal-confirm-liquidar-ruta').remove()"
                      class="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition">
                Cancelar
              </button>
              <button type="button"
                      id="btn-confirmar-liquidacion-modal"
                      onclick="ModuloDomicilios.ejecutarLiquidacionRuta(${rutaId})"
                      class="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5">
                <span>✅</span> <span>Confirmar y Liquidar</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalDiv);
    } catch (err) {
      console.error('Error al abrir modal de liquidación:', err);
      // Fallback directo a ejecución si falla la carga del modal
      this.ejecutarLiquidacionRuta(rutaId);
    }
  },

  async ejecutarLiquidacionRuta(rutaId) {
    const btnModal = document.getElementById('btn-confirmar-liquidacion-modal');
    if (btnModal) {
      btnModal.disabled = true;
      btnModal.innerHTML = `<span class="animate-spin inline-block">⏳</span> <span>Liquidando...</span>`;
    }

    try {
      const ruta = await apiFetch(`/rutas/${rutaId}`);
      if (!ruta || !ruta.pedidos) {
        showToast('No se encontró la información de la ruta', 'error');
        if (btnModal) btnModal.disabled = false;
        return;
      }
      const pedidos = ruta.pedidos;

      // Obtener los selects específicos de esta ruta si están en el DOM
      const cardRuta = document.getElementById(`card-ruta-cuadre-${rutaId}`);
      const selects = cardRuta ? cardRuta.querySelectorAll('.sel-metodo') : document.querySelectorAll(`.sel-metodo[data-ruta-id="${rutaId}"]`);
      const pedidosLiquidacion = [];

      if (selects && selects.length > 0) {
        for (const sel of selects) {
          const pid = parseInt(sel.dataset.id, 10);
          const card = document.getElementById(`item-pedido-${pid}`);
          const metodo = sel.value;
          const inpComp = document.querySelector(`.inp-comp[data-id="${pid}"]`);
          const comp = inpComp ? inpComp.value.trim() : '';
          const tipoSaldo = card?.dataset?.tipoSaldo || 'CREDITO';
          pedidosLiquidacion.push({ id: pid, metodoPago: metodo, comprobante: comp, tipoSaldo });
        }
      } else {
        for (const p of pedidos) {
          pedidosLiquidacion.push({
            id: p.id,
            metodoPago: p.metodo_pago_final || 'EFECTIVO',
            comprobante: p.comprobante_transf || '',
            tipoSaldo: p.tipo_saldo || 'CREDITO'
          });
        }
      }

      const totalEfectivoEntregado = this.recalcularArqueo(rutaId);

      const res = await apiFetch('/rutas/liquidar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ rutaId, pedidosLiquidacion, totalEfectivoEntregado })
      });

      // Cerrar modal
      const modal = document.getElementById('modal-confirm-liquidar-ruta');
      if (modal) modal.remove();

      if (res && res.ok) {
        showToast('Ruta liquidada exitosamente', 'success');
        this.rutaSeleccionadaId = null;
        await this.cambiarSubTab('auditoria');
      } else {
        showToast(res.error || 'No se pudo liquidar la ruta', 'error');
      }
    } catch (e) {
      console.error('Error al liquidar ruta:', e);
      showToast('Error al liquidar la ruta: ' + (e.message || ''), 'error');
      const modal = document.getElementById('modal-confirm-liquidar-ruta');
      if (modal) modal.remove();
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

  setVistaConfirmadosAuditoria(vista) {
    this.vistaConfirmadosAuditoria = vista;
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
      const { totales, rutas, resumenDomiciliarios, pagosPendientes, todosPagosPendientes, pagosConfirmados, todosPagosConfirmados, novedadesAjustes, fecha } = res;

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

      // Lista de pagos confirmados a mostrar según el selector de vista
      const listaConfirmados = (this.vistaConfirmadosAuditoria === 'todos' ? todosPagosConfirmados : pagosConfirmados) || [];
      const confirmadosFiltrados = q
        ? listaConfirmados.filter(p =>
            (p.codigo_pedido || '').toLowerCase().includes(q) ||
            (p.cliente || '').toLowerCase().includes(q) ||
            (p.telefono || '').toLowerCase().includes(q) ||
            (p.domiciliario_nombre || '').toLowerCase().includes(q) ||
            (p.comprobante_transf || '').toLowerCase().includes(q) ||
            (p.usuario_confirmacion_nombre || '').toLowerCase().includes(q) ||
            (p.observacion || '').toLowerCase().includes(q)
          )
        : listaConfirmados;

      const subActiva = this.subseccionAuditoria || 'rutas';
      const pillActiva = 'bg-indigo-600 text-white shadow-xs font-bold';
      const pillInactiva = 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium';

      const contActual = document.getElementById('contenedor-subtab');
      if (!contActual) return;

      contActual.innerHTML = `
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
            <button onclick="ModuloDomicilios.cambiarSubseccionAuditoria('confirmados')"
              class="px-3 py-1.5 text-xs rounded-lg transition ${subActiva === 'confirmados' ? pillActiva : pillInactiva}">
              ✅ Pagos Confirmados (${pagosConfirmados?.length || 0})
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
              confirmados: confirmadosFiltrados,
              todosConfirmadosCount: todosPagosConfirmados?.length || 0,
              diaConfirmadosCount: pagosConfirmados?.length || 0,
              novedades: novedadesAjustes,
              filtroDom
            })}
          </div>
        </div>
      `;
    } catch (err) {
      const contErr = document.getElementById('contenedor-subtab');
      if (contErr) {
        contErr.innerHTML = `
          <div class="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs space-y-2 text-center">
            <p class="font-bold">Error al cargar la información de auditoría:</p>
            <p>${err.message}</p>
            <button onclick="ModuloDomicilios.renderTabAuditoria()" class="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700">
              Reintentar
            </button>
          </div>
        `;
      }
    }
  },

  renderSubseccionAuditoria({ subActiva, rutas, resumenDomiciliarios, pendientes, todosPendientesCount, diaPendientesCount, confirmados, todosConfirmadosCount, diaConfirmadosCount, novedades, filtroDom }) {
    if (subActiva === 'rutas') {
      return this.renderSubseccionRutas(rutas, resumenDomiciliarios, filtroDom);
    } else if (subActiva === 'domiciliarios') {
      return this.renderSubseccionDomiciliarios(resumenDomiciliarios);
    } else if (subActiva === 'pendientes') {
      return this.renderSubseccionPendientes(pendientes, todosPendientesCount, diaPendientesCount);
    } else if (subActiva === 'confirmados') {
      return this.renderSubseccionConfirmados(confirmados, todosConfirmadosCount, diaConfirmadosCount);
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
                        🚚 Despacho: <b>${this.formatearFechaDespacho(r.fecha_creacion)}</b>
                        ${r.fecha_liquidacion ? ` · ✅ Liquidada el: <b>${this.formatearFechaDespacho(r.fecha_liquidacion)}</b>` : ''}
                        ${r.usuario_liquidacion_nombre ? ` · Liquidada por: <strong class="text-slate-700">${escapeHtml(r.usuario_liquidacion_nombre)}</strong>` : ''}
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

                              <div class="flex items-center gap-1.5 flex-wrap justify-end">
                                ${p.estado_entrega === 'ENTREGADO'
                                  ? `<span class="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-bold">✓ Entregado</span>
                                     <span class="text-[9.5px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1" title="Fecha en que se despachó la ruta">
                                       <span>🚚 Despacho:</span> <b class="font-mono text-slate-800">${this.formatearFechaDespacho(r.fecha_creacion || p.ruta_fecha_creacion)}</b>
                                     </span>`
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
                                ${p.usuario_confirmacion_nombre ? `
                                  <span class="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-semibold rounded text-[10px] border border-emerald-200">
                                    ✓ Confirmado por: ${escapeHtml(p.usuario_confirmacion_nombre)}
                                  </span>
                                ` : ''}
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
              const total = Number(p.total || 0);
              const montoAbono = Number(p.monto_abono || 0);
              const saldoPend = Number(p.saldo_pendiente > 0 ? p.saldo_pendiente : Math.max(0, total - montoAbono));
              const tieneAbono = montoAbono > 0;
              const valorACobrar = tieneAbono ? saldoPend : total;

              const celLimpio = (p.telefono || '').replace(/\D/g, '');
              const textoMsg = tieneAbono
                ? `Hola ${p.cliente || ''}, te saludamos respecto a tu pedido #${p.codigo_pedido || p.id}. Se registró un abono inicial de $${montoAbono.toLocaleString('es-CO')}. ¿Nos confirmas por favor el soporte del saldo pendiente de $${saldoPend.toLocaleString('es-CO')}? (Total: $${total.toLocaleString('es-CO')}). ¡Muchas gracias!`
                : `Hola ${p.cliente || ''}, te saludamos de la tienda respecto a tu pedido #${p.codigo_pedido || p.id} por valor de $${total.toLocaleString('es-CO')}. ¿Nos confirmas por favor el soporte de pago? ¡Muchas gracias!`;
              const textoWa = encodeURIComponent(textoMsg);
              const waLink = celLimpio ? `https://wa.me/${celLimpio.startsWith('57') ? celLimpio : '57' + celLimpio}?text=${textoWa}` : null;
              const fechaDisplay = p.fecha_pedido_ruta || (p.fecha_creacion ? p.fecha_creacion.slice(0, 10) : 'Sin fecha');

              return `
                <div class="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-xs space-y-2">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-mono font-bold text-indigo-700 text-xs">#${p.codigo_pedido || p.id}</span>
                        <span class="font-bold text-slate-900 text-sm">${escapeHtml(p.cliente || 'Cliente')}</span>
                        <span class="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded font-semibold">
                          ${p.metodo_pago_final === 'TRANSFERENCIA_PENDIENTE' ? 'Transferencia por verificar' : (p.metodo_pago_final === 'CREDITO' ? 'Crédito cliente' : 'Pago pendiente')}
                        </span>
                        ${tieneAbono ? `
                          <span class="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-300">
                            🛵 Con Abono Previo
                          </span>
                        ` : ''}
                      </div>
                      <p class="text-[11px] text-slate-500 mt-0.5">
                        📅 Fecha: <strong>${fechaDisplay}</strong> · Domiciliario: <strong>${escapeHtml(p.domiciliario_nombre || 'Sin asignar')}</strong> ${p.ruta_id ? `(Ruta #${p.ruta_id})` : ''}
                        ${p.ruta_fecha_creacion ? ` · 🚚 Despacho: <b>${this.formatearFechaDespacho(p.ruta_fecha_creacion)}</b>` : ''}
                      </p>
                    </div>

                    <div class="flex items-center gap-3">
                      <div class="text-right">
                        ${tieneAbono ? `
                          <span class="text-[10px] text-slate-500 line-through block">Total: $${total.toLocaleString('es-CO')}</span>
                          <span class="text-[10px] text-amber-800 font-semibold block">Abonó: $${montoAbono.toLocaleString('es-CO')} (${escapeHtml(p.metodo_abono || 'EFECTIVO')})</span>
                          <span class="text-base font-extrabold text-rose-600 block">
                            Saldo: $${saldoPend.toLocaleString('es-CO')}
                          </span>
                        ` : `
                          <span class="text-base font-extrabold text-rose-600 block">
                            $${total.toLocaleString('es-CO')}
                          </span>
                        `}
                      </div>
                      <button onclick="ModuloDomicilios.abrirModalConfirmarPago(${p.id}, '${(p.cliente || '').replace(/'/g, "\\'")}', ${valorACobrar}, '${p.codigo_pedido || ''}', ${montoAbono}, ${total})"
                        class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition shrink-0">
                        ✅ Confirmar Pago
                      </button>
                    </div>
                  </div>

                  ${tieneAbono ? `
                    <div class="bg-amber-50/80 border border-amber-200 rounded-lg p-2 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        🛵 <strong>Abono recibido al domicilio:</strong> $${montoAbono.toLocaleString('es-CO')} (${escapeHtml(p.metodo_abono || 'EFECTIVO')})
                      </div>
                      <div>
                        ⏳ <strong>Saldo por confirmar:</strong> <span class="font-extrabold text-rose-700">$${saldoPend.toLocaleString('es-CO')}</span>
                      </div>
                    </div>
                  ` : ''}

                  <div class="text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
                    <div>
                      📍 ${escapeHtml(p.direccion || 'Sin dirección')}${p.municipio ? `, ${escapeHtml(p.municipio)}` : ''}
                      ${p.telefono ? ` · 📞 ${escapeHtml(p.telefono)}` : ''}
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
                      Observación: ${escapeHtml(p.observacion)}
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

  renderSubseccionConfirmados(confirmados, todosCount, diaCount) {
    const esVistaTodos = this.vistaConfirmadosAuditoria === 'todos';

    return `
      <div class="space-y-3">
        <!-- SELECTOR DE VISTA: DEL DÍA VS TODA LA HISTORIA -->
        <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
          <span class="font-bold text-slate-700">Alcance de pagos confirmados:</span>
          <div class="flex items-center gap-1.5">
            <button onclick="ModuloDomicilios.setVistaConfirmadosAuditoria('dia')"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition ${!esVistaTodos ? 'bg-slate-900 text-white' : 'bg-white border text-slate-700'}">
              De la fecha seleccionada (${diaCount})
            </button>
            <button onclick="ModuloDomicilios.setVistaConfirmadosAuditoria('todos')"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition ${esVistaTodos ? 'bg-slate-900 text-white' : 'bg-white border text-slate-700'}">
              Todo el histórico confirmado (${todosCount})
            </button>
          </div>
        </div>

        ${(!confirmados || confirmados.length === 0) ? `
          <div class="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
            <p class="text-2xl mb-1">🔍</p>
            <p class="font-semibold text-slate-700">No hay pagos confirmados en esta vista.</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Los pagos pendientes confirmados o transferencias verificadas aparecerán aquí.</p>
          </div>
        ` : `
          <div class="space-y-2.5">
            ${confirmados.map(p => {
              const total = Number(p.total || 0);
              const montoAbono = Number(p.monto_abono || 0);
              const saldoRestante = Math.max(0, total - montoAbono);
              const tieneAbono = montoAbono > 0;

              const celLimpio = (p.telefono || '').replace(/\D/g, '');
              const textoMsg = tieneAbono
                ? `Hola ${p.cliente || ''}, te confirmamos que tu abono de $${montoAbono.toLocaleString('es-CO')} y el pago restante de $${saldoRestante.toLocaleString('es-CO')} del pedido #${p.codigo_pedido || p.id} (Total: $${total.toLocaleString('es-CO')}) han sido verificados y liquidados correctamente. ¡Muchas gracias!`
                : `Hola ${p.cliente || ''}, te confirmamos que tu pago del pedido #${p.codigo_pedido || p.id} por valor de $${total.toLocaleString('es-CO')} ha sido verificado y liquidado correctamente. ¡Muchas gracias!`;
              const textoWa = encodeURIComponent(textoMsg);
              const waLink = celLimpio ? `https://wa.me/${celLimpio.startsWith('57') ? celLimpio : '57' + celLimpio}?text=${textoWa}` : null;
              const fechaDisplay = p.fecha_pedido_ruta || (p.fecha_creacion ? p.fecha_creacion.slice(0, 10) : 'Sin fecha');
              const horaDisplay = p.hora_confirmacion_pago || (p.fecha_confirmacion_pago ? new Date(p.fecha_confirmacion_pago).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

              return `
                <div class="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs space-y-2.5">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-mono font-bold text-indigo-700 text-xs">#${p.codigo_pedido || p.id}</span>
                        <span class="font-bold text-slate-900 text-sm">${escapeHtml(p.cliente || 'Cliente')}</span>
                        ${tieneAbono ? `
                          <span class="bg-indigo-100 text-indigo-900 text-[10px] px-2 py-0.5 rounded font-bold border border-indigo-300">
                            ✓ Abono + Saldo Confirmado
                          </span>
                        ` : `
                          <span class="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-bold border border-emerald-300">
                            ✓ Pago Total Confirmado
                          </span>
                        `}
                        ${p.usuario_confirmacion_nombre ? `
                          <span class="bg-slate-100 text-slate-800 text-[11px] px-2 py-0.5 rounded font-semibold border border-slate-300 flex items-center gap-1">
                            👤 Confirmado por: <strong class="text-indigo-900">${escapeHtml(p.usuario_confirmacion_nombre)}</strong>
                          </span>
                        ` : ''}
                      </div>
                      <p class="text-[11px] text-slate-500 mt-0.5">
                        📅 Fecha: <strong>${fechaDisplay}</strong> ${horaDisplay ? `· ⏰ ${horaDisplay}` : ''} · Domiciliario: <strong>${escapeHtml(p.domiciliario_nombre || 'Sin asignar')}</strong> ${p.ruta_id ? `(Ruta #${p.ruta_id})` : ''}
                      </p>
                    </div>

                    <div class="flex items-center gap-2">
                      <div class="text-right">
                        <span class="text-base font-extrabold text-emerald-700 block">
                          $${total.toLocaleString('es-CO')}
                        </span>
                        <p class="text-[10px] text-slate-500 font-medium">
                          ${p.metodo_pago_final === 'TRANSFERENCIA' ? '📱 Transferencia' : '💵 Efectivo'}
                          ${p.comprobante_transf ? ` (#${escapeHtml(p.comprobante_transf)})` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  ${tieneAbono ? `
                    <!-- DETALLE EXPLICITO DE ABONO + RESTANTE CONFIRMADO -->
                    <div class="bg-gradient-to-r from-amber-50/90 to-emerald-50/90 border border-amber-200/80 rounded-lg p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div class="border-b sm:border-b-0 sm:border-r border-amber-200/60 pb-1.5 sm:pb-0 sm:pr-2">
                        <span class="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">💵 Total Pedido</span>
                        <span class="text-sm font-extrabold text-slate-900">$${total.toLocaleString('es-CO')}</span>
                      </div>
                      <div class="border-b sm:border-b-0 sm:border-r border-amber-200/60 pb-1.5 sm:pb-0 sm:pr-2">
                        <span class="text-[10px] text-amber-800 uppercase tracking-wider font-bold block">🛵 1. Abono al Domicilio</span>
                        <span class="text-sm font-extrabold text-amber-900">$${montoAbono.toLocaleString('es-CO')}</span>
                        <span class="text-[10px] text-amber-700 block">Medio: <strong>${escapeHtml(p.metodo_abono || 'EFECTIVO')}</strong></span>
                      </div>
                      <div>
                        <span class="text-[10px] text-emerald-800 uppercase tracking-wider font-bold block">✅ 2. Pago Restante Confirmado</span>
                        <span class="text-sm font-extrabold text-emerald-700">$${saldoRestante.toLocaleString('es-CO')}</span>
                        <span class="text-[10px] text-emerald-800 block">
                          Medio: <strong>${p.metodo_pago_final === 'TRANSFERENCIA' ? '📱 Transferencia' : '💵 Efectivo'}</strong>
                          ${p.comprobante_transf ? `(Comp: #${escapeHtml(p.comprobante_transf)})` : ''}
                        </span>
                      </div>
                    </div>
                  ` : `
                    <div class="bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-1.5 text-xs text-emerald-900 flex items-center justify-between">
                      <span>✓ <strong>Pago confirmado por el total:</strong> $${total.toLocaleString('es-CO')}</span>
                      <span class="font-medium text-[11px] text-emerald-800">
                        ${p.metodo_pago_final === 'TRANSFERENCIA' ? '📱 Transferencia' : '💵 Efectivo'}
                        ${p.comprobante_transf ? `· Comprobante: #${escapeHtml(p.comprobante_transf)}` : ''}
                      </span>
                    </div>
                  `}

                  <div class="text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
                    <div>
                      📍 ${escapeHtml(p.direccion || 'Sin dirección')}${p.municipio ? `, ${escapeHtml(p.municipio)}` : ''}
                      ${p.telefono ? ` · 📞 ${escapeHtml(p.telefono)}` : ''}
                    </div>
                    ${waLink ? `
                      <a href="${waLink}" target="_blank"
                        class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold flex items-center gap-1">
                        💬 Notificar por WhatsApp
                      </a>
                    ` : ''}
                  </div>

                  ${p.observacion ? `
                    <div class="bg-slate-50 border border-slate-200 p-2 rounded text-[11px] text-slate-700">
                      <strong>Detalle de auditoría:</strong> ${escapeHtml(p.observacion)}
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

  abrirModalConfirmarPago(pedidoId, cliente, totalACobrar, codigoPedido, montoAbono = 0, totalFactura = 0) {
    const modalExistente = document.getElementById('modal-confirmar-pago');
    if (modalExistente) modalExistente.remove();

    const tieneAbono = Number(montoAbono) > 0;
    const modal = document.createElement('div');
    modal.id = 'modal-confirmar-pago';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-slate-200">
        <div class="flex justify-between items-start border-b pb-3">
          <div>
            <h3 class="text-sm font-bold text-slate-900">✅ Confirmar Pago de Cartera</h3>
            <p class="text-xs text-slate-500">Pedido #${codigoPedido || pedidoId} - ${escapeHtml(cliente || 'Cliente')}</p>
          </div>
          <button onclick="ModuloDomicilios.cerrarModalConfirmarPago()" class="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        ${tieneAbono ? `
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-950 space-y-1.5">
            <div class="flex justify-between items-center text-slate-600">
              <span>Total Pedido:</span>
              <span class="font-bold">$${Number(totalFactura || totalACobrar).toLocaleString('es-CO')}</span>
            </div>
            <div class="flex justify-between items-center text-amber-800">
              <span>🛵 Abono Inicial Recibido:</span>
              <span class="font-bold">-$${Number(montoAbono).toLocaleString('es-CO')}</span>
            </div>
            <div class="flex justify-between items-center pt-1 border-t border-amber-200/80 font-bold text-slate-900">
              <span>Saldo Restante a Liquidar:</span>
              <span class="text-base text-rose-700 font-extrabold">$${Number(totalACobrar).toLocaleString('es-CO')}</span>
            </div>
          </div>
        ` : `
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex justify-between items-center">
            <span>Valor Total a Confirmar / Liquidar:</span>
            <span class="text-base font-extrabold text-amber-950">$${Number(totalACobrar || 0).toLocaleString('es-CO')}</span>
          </div>
        `}

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

  imprimirTicketRuta80mm(arg1, arg2) {
    let ruta = null;
    let pedidos = null;

    if (typeof arg1 === 'object' && arg1 !== null) {
      ruta = { ...arg1 };
      pedidos = Array.isArray(arg2) ? [...arg2] : (ruta.pedidos || []);
    } else {
      const rutaId = Number(arg1);
      ruta = (this.auditoriaData?.rutas || []).find(r => r.id === rutaId);
      if (!ruta && this._cuadreRuta && this._cuadreRuta.id === rutaId) {
        ruta = { ...this._cuadreRuta };
        pedidos = this._cuadrePedidos ? [...this._cuadrePedidos] : [];
      }
      if (ruta && !pedidos) {
        pedidos = ruta.pedidos || [];
      }
    }

    if (!ruta) {
      showToast('Ruta no encontrada para imprimir', 'error');
      return;
    }

    if (pedidos) {
      ruta.pedidos = pedidos;
      let ef = 0, tr = 0, pend = 0, entr = 0, dev = 0;
      pedidos.forEach(p => {
        const met = p.metodo_pago_final || 'EFECTIVO';
        const tot = Number(p.total) || 0;
        const abono = Number(p.monto_abono) || 0;
        const metAbono = p.metodo_abono || 'EFECTIVO';
        const saldo = (p.saldo_pendiente !== undefined && p.saldo_pendiente !== null) ? Number(p.saldo_pendiente) : (abono > 0 ? Math.max(0, tot - abono) : 0);

        if (p.estado_entrega === 'ENTREGADO') {
          entr++;
          if (abono > 0) {
            if (metAbono === 'EFECTIVO') ef += abono;
            else tr += abono;
            pend += saldo;
          } else if (met === 'EFECTIVO') {
            ef += tot;
          } else if (met === 'TRANSFERENCIA') {
            tr += tot;
          } else if (met === 'TRANSFERENCIA_PENDIENTE' || met === 'CREDITO') {
            pend += tot;
          }
        } else if (p.estado_entrega === 'NO_ENTREGADO') {
          dev++;
        }
      });
      if (ruta.efectivo === undefined) ruta.efectivo = ef;
      if (ruta.transferencia === undefined) ruta.transferencia = tr;
      if (ruta.pendiente === undefined) ruta.pendiente = pend;
      if (ruta.entregados === undefined) ruta.entregados = entr;
      if (ruta.no_entregados === undefined) ruta.no_entregados = dev;
    }

    const ahora = new Date();
    const horaImpresion = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const horaSalida = ruta.fecha_creacion ? new Date(ruta.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    const horaCierre = ruta.fecha_liquidacion ? new Date(ruta.fecha_liquidacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pendiente';

    const totalCajaRuta = (ruta.total_recolectado || ((ruta.efectivo || 0) + (ruta.base_efectivo || 0)));

    let filasPedidos = '';
    (ruta.pedidos || []).forEach(p => {
      const estadoTxt = p.estado_entrega === 'ENTREGADO' ? 'ENTREGADO' : (p.estado_entrega === 'NO_ENTREGADO' ? 'DEVUELTO' : 'PENDIENTE');
      const montoAbono = Number(p.monto_abono) || 0;
      const hayAbono = montoAbono > 0;
      const saldoPend = Number(p.saldo_pendiente || 0);

      filasPedidos += `
        <div style="margin-bottom: 5px; border-bottom: 1px dotted #ccc; padding-bottom: 3px;">
          <div class="bold">#${escapeHtml(p.codigo_pedido || String(p.id))} - ${escapeHtml(p.cliente || 'Cliente')}</div>
          <div style="font-size: 9px; color: #222;">
            ${escapeHtml(p.direccion || 'Sin dirección')}<br>
            Estado: <b>${estadoTxt}</b>
            ${hayAbono ? ` | Abono: <b>$${montoAbono.toLocaleString('es-CO')} (${p.metodo_abono || 'EFECTIVO'})</b><br>Saldo: <b>$${saldoPend.toLocaleString('es-CO')} (${p.tipo_saldo === 'TRANSFERENCIA_PENDIENTE' ? 'Transf Pend' : 'Crédito'})</b>` : ` | Pago: <b>${escapeHtml(p.metodo_pago_final || 'Por liquidar')}</b>`}
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