// ============================================================
// public/js/modulo-ventas.js
// MÓDULO E: FACTURACIÓN POS, GESTIÓN DE PRECIOS 1, 2, 3 Y CARGA DE ARCHIVO
// ============================================================

const ModuloVentas = (() => {
  // Estado local del módulo
  let subtabActiva = 'pos'; // 'pos' | 'precios' | 'historial'
  let listaPreciosDefault = 'precio_1'; // Predeterminado: precio 1 / general
  let consecutivoActual = 'FAC-0001';
  let carrito = [];
  let scannerActivo = null;
  let catalogoPrecios = [];
  let facturasHistorial = [];
  let statsHistorial = null;
  let ultimaFacturaCreada = null;

  // Configuración de formato y visibilidad de factura (80mm)
  const CONFIG_FACTURA_DEFAULT = {
    mostrarLogo: true,
    urlLogo: '/img/Logo.png',
    mostrarNombreNegocio: true,
    nombreNegocio: 'Jispiplast',
    mostrarRazonSocial: true,
    razonSocial: 'Olga Inés Bueno Pineda',
    mostrarNit: true,
    nitNegocio: '',
    mostrarDireccion: true,
    direccionNegocio: 'Calle 13 #15-20',
    mostrarTelefono: true,
    telefonoNegocio: '',
    mostrarCiudad: true,
    ciudadNegocio: 'Bucaramanga',
    mostrarFecha: true,
    mostrarNumeroFactura: true,
    mostrarCliente: true,
    mostrarTelefonoCliente: true,
    mostrarDireccionCliente: true,
    mostrarCajero: true,
    mostrarListaPrecios: true,
    mostrarSku: true,
    mostrarPrecioUnitario: true,
    mostrarSubtotalDescuento: true,
    mostrarMetodoPago: true,
    mostrarCambio: true,
    mostrarPiePagina: true,
    textoPiePagina: '*** ¡GRACIAS POR SU COMPRA! ***\nVuelva pronto',
    tamanoPapel: '80mm'
  };

  let configFactura = Object.assign({}, CONFIG_FACTURA_DEFAULT);
  let configFacturaTemp = null;

  const MUESTRA_FACTURA_DEFAULT = {
    numero_factura: 'FAC-0001',
    fecha: new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    cliente_nombre: 'Comercializadora San Mateo',
    cliente_telefono: '312 345 6789',
    cliente_direccion: 'Carrera 22 #35-40',
    usuario_nombre: 'Caja Principal',
    lista_precios: 'precio_1',
    subtotal: 26200,
    descuento: 2000,
    total: 24200,
    metodo_pago: 'EFECTIVO',
    monto_recibido: 30000,
    cambio: 5800,
    items: [
      { sku: 'P309', nombre_producto: 'BOLSA 18X24COLORX10', cantidad: 3, precio_unitario: 2000, subtotal: 6000 },
      { sku: 'P307', nombre_producto: 'BOLSA 18X24 P.P CAL1.2', cantidad: 1, precio_unitario: 20200, subtotal: 20200 }
    ]
  };

  // ------------------------------------------------------------
  // INICIALIZACIÓN Y RENDER PRINCIPAL
  // ------------------------------------------------------------
  async function render() {
    const contenedor = document.getElementById('view-ventas');
    if (!contenedor) return;

    contenedor.innerHTML = `
      <!-- SUB-NAVEGACIÓN SUPERIOR DEL MÓDULO -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 sm:p-3 flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-1.5 sm:gap-2">
          <button id="btn-subtab-pos" onclick="ModuloVentas.cambiarSubtab('pos')"
                  class="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${subtabActiva === 'pos' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
            <span>🧾</span> <span>Facturación POS</span>
          </button>
          <button id="btn-subtab-precios" onclick="ModuloVentas.cambiarSubtab('precios')"
                  class="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${subtabActiva === 'precios' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
            <span>🏷️</span> <span>Revisar y Subir Precios</span>
          </button>
          <button id="btn-subtab-historial" onclick="ModuloVentas.cambiarSubtab('historial')"
                  class="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${subtabActiva === 'historial' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
            <span>📜</span> <span>Historial Facturas</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" onclick="ModuloVentas.abrirModalConfigTicket()"
                  class="px-2.5 sm:px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  title="Configurar campos y visibilidad del ticket (ojitos de activar/desactivar)">
            <span>👁️</span>
            <span class="hidden md:inline">Diseño Factura</span>
          </button>
          <button type="button" onclick="ModuloVentas.abrirModalServidorImpresion()"
                  class="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  title="Configuración de Servidor de Impresión Local">
            <span>🖨️</span>
            <span class="hidden sm:inline">Impresora Tienda:</span>
            <span id="label-estado-impresora" class="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <span id="dot-estado-impresora" class="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
              <span id="txt-estado-impresora">Verificar</span>
            </span>
          </button>
          <div class="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs flex items-center gap-2">
            <span class="text-slate-500 font-medium">Factura:</span>
            <span id="label-consecutivo-pos" class="font-mono font-bold text-indigo-700">${consecutivoActual}</span>
          </div>
        </div>
      </div>

      <!-- CONTENEDOR DINÁMICO DE SUB-VISTAS -->
      <div id="subview-ventas-container" class="mt-4">
        <!-- Renderizado por cambiarSubtab() -->
      </div>

      <!-- MODAL DE TICKET / FACTURA IMPRESA -->
      <div id="modal-ticket-factura" class="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 hidden">
        <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
          <div class="bg-slate-900 text-white p-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xl">🧾</span>
              <div>
                <h3 class="font-bold text-sm">Ticket de Venta</h3>
                <p id="ticket-modal-sub" class="text-[11px] text-slate-400">Comprobante térmico 80mm</p>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="ModuloVentas.abrirModalConfigTicket()" class="px-2.5 py-1 rounded-lg bg-indigo-600/70 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors" title="Configurar qué campos se ven en este ticket">
                <span>👁️</span> <span>Diseño</span>
              </button>
              <button onclick="ModuloVentas.cerrarModalTicket()" class="text-slate-400 hover:text-white text-lg">✕</button>
            </div>
          </div>

          <div id="ticket-body-container" class="p-4 overflow-y-auto font-mono text-xs text-slate-800 bg-amber-50/30 flex-1">
            <!-- Contenido del ticket -->
          </div>

          <div class="p-3 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <button onclick="ModuloVentas.imprimirTicketDirecto()" class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer" title="Imprimir en este dispositivo mediante el navegador">
              <span>🖨️</span> <span>Imprimir Aquí</span>
            </button>
            <button onclick="ModuloVentas.enviarAImpresoraTienda()" class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer" title="Enviar directamente a la impresora térmica conectada al PC de la tienda">
              <span>⚡</span> <span>Imprimir en Tienda</span>
            </button>
            <button onclick="ModuloVentas.cerrarModalTicket()" class="px-3 py-2.5 rounded-xl bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold text-xs cursor-pointer">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL DE CONFIGURACIÓN Y EDICIÓN DE FACTURA (OJITOS DE VISIBILIDAD) -->
      <div id="modal-config-ticket" class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 hidden">
        <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-700/30">
          <!-- Header -->
          <div class="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
            <div class="flex items-center gap-3">
              <span class="text-2xl">👁️</span>
              <div>
                <h3 class="font-bold text-base sm:text-lg flex items-center gap-2">
                  <span>Edición y Diseño de Factura</span>
                  <span class="text-xs bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full font-mono font-bold">Térmica 80mm</span>
                </h3>
                <p class="text-xs text-slate-400">Activa o desactiva con los ojitos (<b class="text-emerald-400">👁️ Visible</b> / <b class="text-slate-400">👁️‍🗨️ Oculto</b>) los elementos que deseas que se impriman en el ticket.</p>
              </div>
            </div>
            <button onclick="ModuloVentas.cerrarModalConfigTicket()" class="text-slate-400 hover:text-white text-xl font-bold cursor-pointer">✕</button>
          </div>

          <!-- Body con 2 columnas: Controles a la izquierda y Vista previa en vivo a la derecha -->
          <div class="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50">
            <!-- Columna Izquierda: Opciones y Ojitos -->
            <div id="config-ticket-controles" class="lg:col-span-7 space-y-4">
              <!-- Renderizado por renderControlesConfigTicket() -->
            </div>

            <!-- Columna Derecha: Vista previa térmica en tiempo real -->
            <div class="lg:col-span-5 flex flex-col">
              <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-0 flex flex-col h-full max-h-[700px]">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div class="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    <span>Vista Previa en Vivo</span>
                  </div>
                  <span class="text-[10px] bg-indigo-50 text-indigo-700 font-mono px-2 py-0.5 rounded font-bold border border-indigo-100">Papel 80mm</span>
                </div>

                <div class="flex-1 overflow-y-auto mt-3 p-3 bg-amber-50/40 rounded-xl border border-amber-200/70 shadow-inner flex justify-center">
                  <div id="preview-ticket-live" class="w-full max-w-[310px]">
                    <!-- Renderizado dinámicamente -->
                  </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>* Simulación fiel del ticket impreso</span>
                  <button type="button" onclick="ModuloVentas.probarImpresionConfigTicket()" class="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer">
                    <span>🖨️</span> <span>Imprimir Prueba</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer con Acciones -->
          <div class="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onclick="ModuloVentas.restablecerConfigTicketDefault()" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
              <span>↺</span> <span>Restablecer Predeterminados</span>
            </button>
            <div class="flex items-center gap-2">
              <button type="button" onclick="ModuloVentas.cerrarModalConfigTicket()" class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors">
                Cancelar
              </button>
              <button type="button" id="btn-guardar-config-ticket" onclick="ModuloVentas.guardarConfigTicket()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all">
                <span>💾</span> <span>Guardar Formato</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL CONFIGURACIÓN SERVIDOR DE IMPRESIÓN LOCAL -->
      <div id="modal-servidor-impresion" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 hidden">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
          <div class="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">🖨️</span>
              <div>
                <h3 class="font-bold text-sm sm:text-base">Servidor de Impresión Local (Node.js)</h3>
                <p class="text-xs text-slate-400">Imprime en la tienda desde celulares, tablets u otros PCs</p>
              </div>
            </div>
            <button onclick="ModuloVentas.cerrarModalServidorImpresion()" class="text-slate-400 hover:text-white text-xl font-bold cursor-pointer">✕</button>
          </div>

          <div class="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
            <!-- Estado en Vivo -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800">Estado del Agente en el PC de la Tienda:</span>
                <span id="info-estado-agente-badge" class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-200 text-slate-600 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-slate-400"></span> Verificando...
                </span>
              </div>
              <div class="text-[11px] text-slate-500 space-y-1">
                <p>• <b>Impresora:</b> <span id="info-impresora-nombre" class="font-mono text-slate-700 font-bold">Predeterminada de Windows</span></p>
                <p>• <b>Tickets en espera:</b> <span id="info-tickets-cola" class="font-bold text-slate-700">0</span></p>
              </div>
            </div>

            <!-- Pasos de Instalación -->
            <div class="space-y-2.5">
              <h4 class="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span>🚀</span> ¿Cómo instalarlo en el computador de la tienda?
              </h4>
              <p class="text-slate-600 leading-relaxed">
                Solo toma 2 minutos. En el computador que tiene conectada la impresora térmica USB:
              </p>
              <div class="space-y-2 bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-[11px]">
                <p><b>1.</b> Asegúrate de tener instalado <b>Node.js</b> (si no lo tienes, descárgalo gratis de <a href="https://nodejs.org" target="_blank" class="text-indigo-600 underline font-bold">nodejs.org</a>).</p>
                <p><b>2.</b> Descarga estos 2 archivos en una carpeta (por ejemplo en el Escritorio):</p>
                <div class="flex flex-wrap gap-2 pt-1">
                  <a href="/api/impresion/descargar-agente" download="agente-impresion.js" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1 shadow-2xs">
                    <span>📥</span> Descargar agente-impresion.js
                  </a>
                  <a href="/api/impresion/descargar-bat" download="iniciar_impresora.bat" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold flex items-center gap-1 shadow-2xs">
                    <span>⚡</span> Descargar iniciar_impresora.bat
                  </a>
                </div>
                <p class="pt-1"><b>3.</b> Haz <b>doble clic en <code>iniciar_impresora.bat</code></b>. ¡Listo! Verás que el estado cambia a <b class="text-emerald-700">🟢 En Línea</b> y cada venta que hagas desde tu celular se imprimirá automáticamente en la tienda.</p>
              </div>
            </div>
          </div>

          <div class="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center gap-2">
            <button onclick="ModuloVentas.verificarEstadoServidorImpresion(true)" class="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
              <span>🔄</span> Actualizar Estado
            </button>
            <button onclick="ModuloVentas.cerrarModalServidorImpresion()" class="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer">
              Entendido
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL DE CÁMARA ESCÁNER -->
      <div id="modal-scanner-ventas" class="fixed inset-0 z-50 bg-slate-950/90 flex flex-col items-center justify-center p-3 hidden">
        <div class="w-full max-w-md bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
          <div class="p-3 bg-slate-800 text-white flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xl">📷</span>
              <span class="font-bold text-sm">Escanear Código de Barras</span>
            </div>
            <button onclick="ModuloVentas.detenerCamaraScanner()" class="text-slate-400 hover:text-white text-lg font-bold">✕</button>
          </div>
          <div class="p-3">
            <div id="reader-ventas-cam" class="w-full rounded-xl overflow-hidden bg-black min-h-[260px]"></div>
            <p class="text-center text-xs text-slate-400 mt-2">Apunta la cámara al código de barras del producto</p>
          </div>
        </div>
      </div>
    `;

    await cargarConsecutivo();
    await cargarConfigFactura();
    cambiarSubtab(subtabActiva);
    iniciarListenerTecladoCodigoBarras();
    verificarEstadoServidorImpresion();
  }

  function onEnterTab() {
    cargarConsecutivo();
    cargarConfigFactura();
    verificarEstadoServidorImpresion();
    if (subtabActiva === 'precios') cargarCatalogoPrecios();
    if (subtabActiva === 'historial') cargarHistorialFacturas();
    enfocarBuscador();
  }

  function onLeaveTab() {
    detenerCamaraScanner();
  }

  async function cargarConsecutivo() {
    try {
      const res = await apiFetch('/ventas/consecutivo');
      if (res && res.ok && res.numero) {
        consecutivoActual = res.numero;
        const el = document.getElementById('label-consecutivo-pos');
        if (el) el.textContent = consecutivoActual;
      }
    } catch (e) {}
  }

  function cambiarSubtab(tab) {
    subtabActiva = tab;
    ['pos', 'precios', 'historial'].forEach(t => {
      const btn = document.getElementById(`btn-subtab-${t}`);
      if (btn) {
        const activo = t === tab;
        btn.className = `px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
          activo ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`;
      }
    });

    const subview = document.getElementById('subview-ventas-container');
    if (!subview) return;

    if (tab === 'pos') {
      renderSubtabPOS(subview);
      setTimeout(enfocarBuscador, 100);
    } else if (tab === 'precios') {
      renderSubtabPrecios(subview);
      cargarCatalogoPrecios();
    } else if (tab === 'historial') {
      renderSubtabHistorial(subview);
      cargarHistorialFacturas();
    }
  }

  // ------------------------------------------------------------
  // SUB-TAB 1: FACTURACIÓN POS
  // ------------------------------------------------------------
  function renderSubtabPOS(container) {
    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">

        <!-- COLUMNA IZQUIERDA / PRINCIPAL: BÚSQUEDA Y CARRITO DE FACTURACIÓN -->
        <div class="lg:col-span-8 space-y-4">

          <!-- BARRA DE ENCABEZADO DE FACTURA (LISTA DE PRECIOS Y CLIENTE) -->
          <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <!-- SELECTOR DE LISTA DE PRECIOS -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>🏷️</span> <span>Lista de Precios:</span>
                </span>
                <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200" id="group-selector-precios">
                  <button type="button" onclick="ModuloVentas.seleccionarListaPreciosGlobal('precio_1')"
                          id="btn-lp-1"
                          class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${listaPreciosDefault === 'precio_1' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                    Precio 1 (General) ★
                  </button>
                  <button type="button" onclick="ModuloVentas.seleccionarListaPreciosGlobal('precio_2')"
                          id="btn-lp-2"
                          class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${listaPreciosDefault === 'precio_2' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                    Precio 2
                  </button>
                  <button type="button" onclick="ModuloVentas.seleccionarListaPreciosGlobal('precio_3')"
                          id="btn-lp-3"
                          class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${listaPreciosDefault === 'precio_3' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                    Precio 3
                  </button>
                </div>
              </div>

              <!-- DATOS RÁPIDOS DEL CLIENTE -->
              <div class="flex items-center gap-2 flex-1 max-w-sm justify-end">
                <div class="relative w-full">
                  <span class="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 text-xs">👤</span>
                  <input type="text" id="pos-cliente-nombre" value="Consumidor Final"
                         placeholder="Nombre del cliente / Consumidor Final..."
                         class="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          <!-- BARRA DE BÚSQUEDA AUTO-COMPLETADO Y CÓDIGO DE BARRAS -->
          <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm relative">
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm">🔍</span>
                <input type="text" id="pos-input-busqueda" autocomplete="off"
                       placeholder="Escanear código de barras o escribir nombre/SKU del producto..."
                       class="w-full pl-10 pr-24 py-2.5 text-sm font-medium bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400" />
                
                <button type="button" onclick="ModuloVentas.limpiarBuscador()"
                        id="btn-limpiar-busq"
                        class="hidden absolute right-12 inset-y-0 px-2 text-slate-400 hover:text-slate-600 text-xs">✕</button>

                <div class="absolute right-2 inset-y-0 flex items-center">
                  <span class="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-200/70 hidden sm:inline">Enter</span>
                </div>
              </div>

              <!-- BOTÓN CÁMARA ESCÁNER -->
              <button type="button" onclick="ModuloVentas.abrirCamaraScanner()"
                      title="Escanear con cámara"
                      class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm">
                <span class="text-base">📷</span>
                <span class="hidden sm:inline">Escanear</span>
              </button>
            </div>

            <!-- MENÚ FLOTANTE DE RESULTADOS / AUTO-COMPLETADO -->
            <div id="pos-sugerencias-dropdown"
                 class="hidden absolute left-4 right-4 top-[64px] z-30 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto divide-y divide-slate-100">
              <!-- Renderizado dinámico de sugerencias -->
            </div>
          </div>

          <!-- TABLA DEL CARRITO DE LA FACTURA -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-slate-700 uppercase tracking-wider">Productos en Factura</span>
                <span id="pos-items-count-badge" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700">
                  ${carrito.length} ítems
                </span>
              </div>
              <button type="button" onclick="ModuloVentas.vaciarCarrito()"
                      class="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 hover:underline">
                <span>🗑️</span> <span>Vaciar</span>
              </button>
            </div>

            <!-- CONTENIDO DE LA TABLA O ESTADO VACÍO -->
            <div id="pos-tabla-items-container" class="overflow-x-auto min-h-[220px]">
              ${renderTablaCarritoHTML()}
            </div>
          </div>

        </div>

        <!-- COLUMNA DERECHA: RESUMEN DE TOTALES Y COBRO -->
        <div class="lg:col-span-4 space-y-4">

          <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 sticky top-16">
            <div class="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 class="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <span>💳</span> <span>Liquidación y Cobro</span>
              </h3>
              <span class="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                Lista: ${getNombreLista(listaPreciosDefault)}
              </span>
            </div>

            <!-- SUB-TOTAL, DESCUENTO Y TOTAL -->
            <div class="space-y-2 text-xs">
              <div class="flex justify-between items-center text-slate-600">
                <span>Subtotal ítems:</span>
                <span id="pos-txt-subtotal" class="font-mono font-semibold">$ 0</span>
              </div>

              <div class="flex justify-between items-center text-slate-600">
                <span class="flex items-center gap-1">Descuento ($):</span>
                <input type="number" id="pos-input-descuento" min="0" value="0" step="500"
                       oninput="ModuloVentas.actualizarTotales()"
                       class="w-24 text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold" />
              </div>

              <div class="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span class="text-sm font-bold text-slate-800">TOTAL A PAGAR:</span>
                <span id="pos-txt-total" class="text-2xl font-black text-indigo-700 font-mono">$ 0</span>
              </div>
            </div>

            <!-- MÉTODO DE PAGO -->
            <div class="space-y-2 pt-2 border-t border-slate-100">
              <label class="block text-xs font-bold text-slate-700">Método de Pago:</label>
              <div class="grid grid-cols-2 gap-1.5" id="pos-metodos-pago">
                <button type="button" onclick="ModuloVentas.seleccionarMetodoPago('EFECTIVO')"
                        id="btn-pago-efectivo"
                        class="p-2 rounded-xl border text-xs font-bold text-center transition-all bg-emerald-50 border-emerald-500 text-emerald-800">
                  💵 Efectivo
                </button>
                <button type="button" onclick="ModuloVentas.seleccionarMetodoPago('TRANSFERENCIA')"
                        id="btn-pago-transferencia"
                        class="p-2 rounded-xl border text-xs font-bold text-center transition-all bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100">
                  📲 Transferencia
                </button>
                <button type="button" onclick="ModuloVentas.seleccionarMetodoPago('DATAFONO')"
                        id="btn-pago-datafono"
                        class="p-2 rounded-xl border text-xs font-bold text-center transition-all bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100">
                  💳 Datáfono
                </button>
                <button type="button" onclick="ModuloVentas.seleccionarMetodoPago('CREDITO')"
                        id="btn-pago-credito"
                        class="p-2 rounded-xl border text-xs font-bold text-center transition-all bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100">
                  📝 Crédito
                </button>
              </div>
            </div>

            <!-- SECCIÓN CONDICIONAL EFECTIVO (MONTO RECIBIDO Y DEVUELTA) -->
            <div id="pos-seccion-efectivo" class="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div class="flex justify-between items-center text-xs">
                <span class="font-bold text-slate-700">Monto Recibido:</span>
                <input type="number" id="pos-input-recibido" min="0" step="1000"
                       placeholder="0"
                       oninput="ModuloVentas.calcularDevuelta()"
                       class="w-32 text-right px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>

              <!-- BOTONES RÁPIDOS DE BILLETES -->
              <div class="flex items-center gap-1 flex-wrap text-[10px]">
                <button type="button" onclick="ModuloVentas.ponerEfectivoExacto()" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-bold text-slate-700">Exacto</button>
                <button type="button" onclick="ModuloVentas.sumarEfectivo(10000)" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-mono font-bold text-slate-700">$10k</button>
                <button type="button" onclick="ModuloVentas.sumarEfectivo(20000)" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-mono font-bold text-slate-700">$20k</button>
                <button type="button" onclick="ModuloVentas.sumarEfectivo(50000)" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-mono font-bold text-slate-700">$50k</button>
                <button type="button" onclick="ModuloVentas.sumarEfectivo(100000)" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-mono font-bold text-slate-700">$100k</button>
              </div>

              <div class="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span class="text-xs font-bold text-slate-700">Cambio / Devuelta:</span>
                <span id="pos-txt-devuelta" class="text-lg font-black text-emerald-700 font-mono">$ 0</span>
              </div>
            </div>

            <!-- TOGGLE DESCONTAR STOCK -->
            <label class="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
              <input type="checkbox" id="pos-chk-descontar-stock" checked class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>Descontar inventario automáticamente</span>
            </label>

            <!-- BOTÓN PRINCIPAL FACTURAR -->
            <button type="button" id="btn-completar-factura"
                    onclick="ModuloVentas.procesarVenta()"
                    class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2">
              <span class="text-lg">🧾</span>
              <span>Completar Venta &amp; Facturar</span>
            </button>
          </div>

        </div>

      </div>
    `;

    iniciarAutocompletadoPOS();
    actualizarTotales();
  }

  function renderTablaCarritoHTML() {
    if (!carrito.length) {
      return `
        <div class="py-12 px-4 text-center text-slate-400 space-y-2">
          <div class="text-4xl">🛒</div>
          <p class="text-sm font-medium text-slate-600">No hay productos en la factura actual</p>
          <p class="text-xs max-w-sm mx-auto text-slate-400">
            Escanea un código de barras o escribe en el buscador de arriba para agregar productos.
          </p>
        </div>
      `;
    }

    return `
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
          <tr>
            <th class="py-2.5 px-3">#</th>
            <th class="py-2.5 px-3">Producto</th>
            <th class="py-2.5 px-3 text-center">Lista</th>
            <th class="py-2.5 px-3 text-right">Precio Unit.</th>
            <th class="py-2.5 px-3 text-center">Cantidad</th>
            <th class="py-2.5 px-3 text-right">Subtotal</th>
            <th class="py-2.5 px-2 text-center"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${carrito.map((it, idx) => `
            <tr class="hover:bg-slate-50/70 transition-colors">
              <td class="py-2.5 px-3 font-mono text-slate-400">${idx + 1}</td>
              <td class="py-2.5 px-3">
                <div class="font-bold text-slate-800">${escapeHtml(it.nombre_producto)}</div>
                <div class="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 font-mono">
                  <span>SKU: ${escapeHtml(it.sku)}</span>
                  ${it.codigo_barras ? `<span class="text-slate-400">• Barcode: ${escapeHtml(it.codigo_barras)}</span>` : ''}
                  <span class="px-1.5 py-0.2 rounded text-[10px] ${it.stock > 0 ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600 font-bold'}">
                    Stock: ${it.stock}
                  </span>
                </div>
              </td>
              <td class="py-2.5 px-3 text-center">
                <select onchange="ModuloVentas.cambiarTipoPrecioItem(${idx}, this.value)"
                        class="text-[11px] font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:ring-1 focus:ring-indigo-500">
                  <option value="precio_1" ${it.tipo_precio === 'precio_1' ? 'selected' : ''}>P1: $${formatMoney(it.precio_1)}</option>
                  <option value="precio_2" ${it.tipo_precio === 'precio_2' ? 'selected' : ''}>P2: $${formatMoney(it.precio_2 || it.precio_1)}</option>
                  <option value="precio_3" ${it.tipo_precio === 'precio_3' ? 'selected' : ''}>P3: $${formatMoney(it.precio_3 || it.precio_1)}</option>
                </select>
              </td>
              <td class="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                $ ${formatMoney(it.precio_unitario)}
              </td>
              <td class="py-2.5 px-3 text-center">
                <div class="inline-flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                  <button type="button" onclick="ModuloVentas.modificarCantidad(${idx}, -1)"
                          class="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs">-</button>
                  <input type="number" min="1" value="${it.cantidad}"
                         onchange="ModuloVentas.fijarCantidad(${idx}, this.value)"
                         class="w-12 text-center py-1 text-xs font-mono font-bold text-slate-800 border-x border-slate-200 focus:outline-none" />
                  <button type="button" onclick="ModuloVentas.modificarCantidad(${idx}, 1)"
                          class="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs">+</button>
                </div>
              </td>
              <td class="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                $ ${formatMoney(it.subtotal)}
              </td>
              <td class="py-2.5 px-2 text-center">
                <button type="button" onclick="ModuloVentas.eliminarItem(${idx})"
                        title="Quitar de la factura"
                        class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                  ✕
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function getNombreLista(lp) {
    if (lp === 'precio_1') return 'Precio 1 (General)';
    if (lp === 'precio_2') return 'Precio 2';
    if (lp === 'precio_3') return 'Precio 3';
    return lp;
  }

  // ------------------------------------------------------------
  // SUB-TAB 2: REVISIÓN DE PRECIOS Y SUBIDA DE ARCHIVO
  // ------------------------------------------------------------
  function renderSubtabPrecios(container) {
    container.innerHTML = `
      <div class="space-y-6">

        <!-- TARJETA DESTACADA: IMPORTAR Y ACTUALIZAR SOLO PRECIOS POR ARCHIVO EXCEL/CSV -->
        <div class="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-900/50">
          <div class="max-w-3xl space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-2xl">📊</span>
              <h2 class="text-lg sm:text-xl font-bold tracking-tight">Actualizador Masivo de Precios (Excel / CSV)</h2>
            </div>
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Sube el archivo Excel con las listas de precios (compatible exactamente con tu archivo de columnas
              <span class="font-mono text-emerald-300">ID, CODIGO, ARTICULO, COD. BARRAS, VENTA (1), VENTA (2), VENTA (3)</span>).
              <strong class="text-amber-300">Este proceso SOLO actualiza los precios</strong> de los productos encontrados, sin borrar ni alterar existencias, ubicaciones ni datos existentes.
            </p>

            <!-- ZONA DE CARGA DE ARCHIVO DRAG & DROP -->
            <div id="dropzone-precios"
                 class="mt-4 border-2 border-dashed border-indigo-400/40 hover:border-indigo-400 bg-white/5 hover:bg-white/10 rounded-2xl p-6 text-center transition-all cursor-pointer">
              <input type="file" id="input-archivo-precios" accept=".xlsx,.xls,.csv" class="hidden"
                     onchange="ModuloVentas.onSeleccionarArchivoPrecios(this)" />
              <div class="space-y-2">
                <div class="text-3xl">📁</div>
                <p class="text-xs sm:text-sm font-semibold text-white">Haz clic aquí o arrastra tu archivo Excel / CSV</p>
                <p class="text-[11px] text-slate-400">Formatos soportados: .xlsx, .xls o .csv (Hasta 15 MB)</p>
              </div>
            </div>

            <!-- RESULTADOS Y PROGRESO DE LA IMPORTACIÓN -->
            <div id="precios-resultado-box" class="hidden mt-4 p-4 rounded-xl bg-white/10 border border-white/15 text-xs space-y-3">
              <!-- Llenado dinámico -->
            </div>
          </div>
        </div>

        <!-- LISTA Y REVISIÓN DE PRECIOS ACTUALES DEL CATÁLOGO -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-bold text-sm sm:text-base text-slate-800 flex items-center gap-2">
                <span>🏷️</span> <span>Revisión de Precios del Catálogo</span>
              </h3>
              <p class="text-xs text-slate-500">Consulta los 3 precios de cada producto y edítalos manualmente si lo deseas.</p>
            </div>

            <!-- BUSCADOR EN EL CATÁLOGO DE PRECIOS -->
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <div class="relative w-full sm:w-72">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs">🔍</span>
                <input type="text" id="catalogo-precios-busq"
                       oninput="ModuloVentas.onFiltrarCatalogoPrecios(this.value)"
                       placeholder="Buscar por código, nombre o barcode..."
                       class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <button onclick="ModuloVentas.cargarCatalogoPrecios()"
                      title="Refrescar lista"
                      class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold">
                🔄
              </button>
            </div>
          </div>

          <!-- TABLA DE PRODUCTOS CON PRECIO 1, PRECIO 2 Y PRECIO 3 -->
          <div id="catalogo-precios-tabla-container" class="overflow-x-auto min-h-[300px]">
            <div class="py-12 text-center text-slate-400 text-xs">Cargando catálogo de precios...</div>
          </div>
        </div>

      </div>
    `;

    iniciarDragAndDropPrecios();
  }

  // ------------------------------------------------------------
  // SUB-TAB 3: HISTORIAL DE FACTURAS
  // ------------------------------------------------------------
  function renderSubtabHistorial(container) {
    container.innerHTML = `
      <div class="space-y-4">

        <!-- RESUMEN DE VENTAS DE HOY -->
        <div id="historial-stats-cards" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-500">Facturas de Hoy</span>
            <div id="stat-ventas-count" class="text-xl font-black text-slate-800 font-mono mt-1">0</div>
          </div>
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-emerald-600">Total Vendido Hoy</span>
            <div id="stat-ventas-total" class="text-xl font-black text-emerald-700 font-mono mt-1">$ 0</div>
          </div>
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-500">💵 En Efectivo</span>
            <div id="stat-ventas-efectivo" class="text-base font-bold text-slate-800 font-mono mt-1">$ 0</div>
          </div>
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-500">📲 Transferencia / Otros</span>
            <div id="stat-ventas-transferencia" class="text-base font-bold text-slate-800 font-mono mt-1">$ 0</div>
          </div>
        </div>

        <!-- FILTRO Y TABLA DE FACTURAS -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <span>📜</span> <span>Facturas Emitidas</span>
            </h3>

            <div class="flex items-center gap-2 flex-wrap">
              <input type="date" id="historial-fecha-filtro"
                     onchange="ModuloVentas.cargarHistorialFacturas()"
                     class="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" />
              <input type="text" id="historial-q-filtro" placeholder="Buscar # factura o cliente..."
                     oninput="ModuloVentas.cargarHistorialFacturas()"
                     class="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none w-48" />
              <button onclick="ModuloVentas.cargarHistorialFacturas()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">
                Buscar
              </button>
            </div>
          </div>

          <div id="historial-tabla-container" class="overflow-x-auto min-h-[250px]">
            <div class="py-12 text-center text-slate-400 text-xs">Cargando facturas...</div>
          </div>
        </div>

      </div>
    `;
  }

  // ------------------------------------------------------------
  // LÓGICA DE AGREGAR PRODUCTOS Y GESTIÓN DEL CARRITO
  // ------------------------------------------------------------
  function seleccionarListaPreciosGlobal(tipo) {
    listaPreciosDefault = tipo;
    ['precio_1', 'precio_2', 'precio_3'].forEach(lp => {
      const btn = document.getElementById(`btn-lp-${lp.replace('precio_', '')}`);
      if (btn) {
        const activo = lp === tipo;
        btn.className = `px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
          activo ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
        }`;
      }
    });

    // Si ya hay ítems en el carrito, actualizar sus precios unitarios a la nueva lista seleccionada
    if (carrito.length > 0) {
      carrito.forEach(it => {
        it.tipo_precio = tipo;
        it.precio_unitario = it[tipo] || it.precio_1 || it.precio || 0;
        it.subtotal = Math.round(it.cantidad * it.precio_unitario);
      });
      renderTablaCarrito();
      actualizarTotales();
      showToast(`Lista de precios actualizada a: ${getNombreLista(tipo)}`, 'info');
    }
  }

  function agregarProductoAlCarrito(prod) {
    if (!prod) return;

    const p1 = Number(prod.precio_1) || Number(prod.precio) || 0;
    const p2 = Number(prod.precio_2) || p1;
    const p3 = Number(prod.precio_3) || p1;

    // Buscar si ya existe en el carrito
    const idx = carrito.findIndex(it => it.producto_id === prod.id || (it.sku && it.sku === prod.sku));

    if (idx !== -1) {
      carrito[idx].cantidad += 1;
      carrito[idx].subtotal = Math.round(carrito[idx].cantidad * carrito[idx].precio_unitario);
    } else {
      const tipoP = listaPreciosDefault;
      let unitario = p1;
      if (tipoP === 'precio_2') unitario = p2;
      else if (tipoP === 'precio_3') unitario = p3;

      carrito.push({
        producto_id: prod.id,
        sku: prod.sku,
        nombre_producto: prod.nombre,
        stock: prod.stock,
        precio_1: p1,
        precio_2: p2,
        precio_3: p3,
        tipo_precio: tipoP,
        precio_unitario: unitario,
        cantidad: 1,
        subtotal: Math.round(unitario),
        codigo_barras: prod.codigo_barras || ''
      });
    }

    if (typeof Sound !== 'undefined' && typeof Sound.beep === 'function') {
      Sound.beep();
    }

    renderTablaCarrito();
    actualizarTotales();
    limpiarBuscador();
    enfocarBuscador();
  }

  function cambiarTipoPrecioItem(idx, nuevoTipo) {
    if (!carrito[idx]) return;
    carrito[idx].tipo_precio = nuevoTipo;
    const nuevoUnitario = carrito[idx][nuevoTipo] || carrito[idx].precio_1 || 0;
    carrito[idx].precio_unitario = nuevoUnitario;
    carrito[idx].subtotal = Math.round(carrito[idx].cantidad * nuevoUnitario);
    renderTablaCarrito();
    actualizarTotales();
  }

  function modificarCantidad(idx, delta) {
    if (!carrito[idx]) return;
    const nueva = carrito[idx].cantidad + delta;
    if (nueva <= 0) {
      eliminarItem(idx);
    } else {
      carrito[idx].cantidad = nueva;
      carrito[idx].subtotal = Math.round(nueva * carrito[idx].precio_unitario);
      renderTablaCarrito();
      actualizarTotales();
    }
  }

  function fijarCantidad(idx, val) {
    if (!carrito[idx]) return;
    const cant = parseFloat(val) || 1;
    if (cant <= 0) {
      eliminarItem(idx);
    } else {
      carrito[idx].cantidad = cant;
      carrito[idx].subtotal = Math.round(cant * carrito[idx].precio_unitario);
      renderTablaCarrito();
      actualizarTotales();
    }
  }

  function eliminarItem(idx) {
    carrito.splice(idx, 1);
    renderTablaCarrito();
    actualizarTotales();
  }

  function vaciarCarrito() {
    if (!carrito.length) return;
    carrito = [];
    renderTablaCarrito();
    actualizarTotales();
  }

  function renderTablaCarrito() {
    const cont = document.getElementById('pos-tabla-items-container');
    const badge = document.getElementById('pos-items-count-badge');
    if (badge) badge.textContent = `${carrito.length} ítems`;
    if (cont) cont.innerHTML = renderTablaCarritoHTML();
  }

  // ------------------------------------------------------------
  // CÁLCULOS DE TOTALES Y PAGO
  // ------------------------------------------------------------
  let metodoPagoSeleccionado = 'EFECTIVO';

  function seleccionarMetodoPago(metodo) {
    metodoPagoSeleccionado = metodo;
    ['EFECTIVO', 'TRANSFERENCIA', 'DATAFONO', 'CREDITO'].forEach(m => {
      const btn = document.getElementById(`btn-pago-${m.toLowerCase()}`);
      if (btn) {
        const activo = m === metodo;
        btn.className = `p-2 rounded-xl border text-xs font-bold text-center transition-all ${
          activo ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
        }`;
      }
    });

    const secEfectivo = document.getElementById('pos-seccion-efectivo');
    if (secEfectivo) {
      secEfectivo.classList.toggle('hidden', metodo !== 'EFECTIVO');
    }
    calcularDevuelta();
  }

  function actualizarTotales() {
    const subtotal = carrito.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    const descInp = document.getElementById('pos-input-descuento');
    const descuento = descInp ? (parseFloat(descInp.value) || 0) : 0;
    const total = Math.max(0, subtotal - descuento);

    const txtSub = document.getElementById('pos-txt-subtotal');
    const txtTot = document.getElementById('pos-txt-total');
    if (txtSub) txtSub.textContent = `$ ${formatMoney(subtotal)}`;
    if (txtTot) txtTot.textContent = `$ ${formatMoney(total)}`;

    calcularDevuelta();
  }

  function ponerEfectivoExacto() {
    const subtotal = carrito.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    const descInp = document.getElementById('pos-input-descuento');
    const descuento = descInp ? (parseFloat(descInp.value) || 0) : 0;
    const total = Math.max(0, subtotal - descuento);

    const inpRec = document.getElementById('pos-input-recibido');
    if (inpRec) {
      inpRec.value = total;
      calcularDevuelta();
    }
  }

  function sumarEfectivo(monto) {
    const inpRec = document.getElementById('pos-input-recibido');
    if (inpRec) {
      inpRec.value = monto;
      calcularDevuelta();
    }
  }

  function calcularDevuelta() {
    const subtotal = carrito.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    const descInp = document.getElementById('pos-input-descuento');
    const descuento = descInp ? (parseFloat(descInp.value) || 0) : 0;
    const total = Math.max(0, subtotal - descuento);

    const inpRec = document.getElementById('pos-input-recibido');
    const txtDev = document.getElementById('pos-txt-devuelta');
    if (!inpRec || !txtDev) return;

    const recibido = parseFloat(inpRec.value) || 0;
    const devuelta = Math.max(0, recibido - total);
    txtDev.textContent = `$ ${formatMoney(devuelta)}`;
  }

  // ------------------------------------------------------------
  // COMPLETAR Y GUARDAR FACTURA
  // ------------------------------------------------------------
  async function procesarVenta() {
    if (!carrito.length) {
      showToast('No has agregado ningún producto a la factura.', 'error');
      enfocarBuscador();
      return;
    }

    const subtotal = carrito.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    const descInp = document.getElementById('pos-input-descuento');
    const descuento = descInp ? (parseFloat(descInp.value) || 0) : 0;
    const total = Math.max(0, subtotal - descuento);

    const clienteInp = document.getElementById('pos-cliente-nombre');
    const clienteNombre = (clienteInp ? clienteInp.value.trim() : '') || 'Consumidor Final';

    const chkDescontar = document.getElementById('pos-chk-descontar-stock');
    const descontarStock = chkDescontar ? chkDescontar.checked : true;

    const inpRec = document.getElementById('pos-input-recibido');
    const montoRecibido = metodoPagoSeleccionado === 'EFECTIVO' ? (parseFloat(inpRec?.value) || total) : total;

    if (metodoPagoSeleccionado === 'EFECTIVO' && montoRecibido < total) {
      showToast(`El monto recibido ($${formatMoney(montoRecibido)}) es menor al total a pagar ($${formatMoney(total)}).`, 'error');
      return;
    }

    const btn = document.getElementById('btn-completar-factura');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Procesando factura...</span>';
    }

    try {
      const payload = {
        cliente_nombre: clienteNombre,
        lista_precios: listaPreciosDefault,
        items: carrito,
        metodo_pago: metodoPagoSeleccionado,
        monto_recibido: montoRecibido,
        descuento: descuento,
        descontar_stock: descontarStock
      };

      const res = await apiFetch('/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res && res.ok && res.venta) {
        showToast(`¡Factura ${res.venta.numero_factura} generada con éxito!`, 'success');
        ultimaFacturaCreada = res.venta;

        // Limpiar el carrito y preparar nueva venta
        carrito = [];
        renderTablaCarrito();
        actualizarTotales();
        if (clienteInp) clienteInp.value = 'Consumidor Final';
        if (inpRec) inpRec.value = '';
        await cargarConsecutivo();

        // Abrir modal de ticket para impresión
        abrirModalTicket(res.venta);
      } else {
        showToast(res.error || 'Error al guardar la factura', 'error');
      }
    } catch (e) {
      showToast('Error de conexión al guardar la factura', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="text-lg">🧾</span><span>Completar Venta &amp; Facturar</span>';
      }
    }
  }

  // ------------------------------------------------------------
  // BÚSQUEDA AUTO-COMPLETADO Y SCANNER
  // ------------------------------------------------------------
  let debounceBusq = null;

  function iniciarAutocompletadoPOS() {
    const input = document.getElementById('pos-input-busqueda');
    const dropdown = document.getElementById('pos-sugerencias-dropdown');
    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      const btnLimpiar = document.getElementById('btn-limpiar-busq');
      if (btnLimpiar) btnLimpiar.classList.toggle('hidden', !q);

      clearTimeout(debounceBusq);
      if (!q) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
      }

      debounceBusq = setTimeout(async () => {
        try {
          const res = await apiFetch(`/ventas/productos-sugerencias?q=${encodeURIComponent(q)}`);
          if (res && res.ok && res.productos && res.productos.length > 0) {
            renderSugerenciasDropdown(res.productos);
          } else {
            dropdown.innerHTML = `
              <div class="p-3 text-center text-xs text-slate-400">
                No se encontraron productos coincidentes con "<strong>${escapeHtml(q)}</strong>"
              </div>
            `;
            dropdown.classList.remove('hidden');
          }
        } catch (e) {}
      }, 150);
    });

    // Evento Enter para pistola lectora física o teclado
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const raw = input.value.trim();
        if (!raw) return;

        // Intentar búsqueda exacta de código de barras primero
        const res = await apiFetch(`/ventas/buscar-codigo/${encodeURIComponent(raw)}`);
        if (res && res.ok && res.producto) {
          agregarProductoAlCarrito(res.producto);
        } else {
          // Si no es exacto, buscar sugerencias y si hay 1 resultado agregarlo directamente
          const resSugg = await apiFetch(`/ventas/productos-sugerencias?q=${encodeURIComponent(raw)}`);
          if (resSugg && resSugg.ok && resSugg.productos && resSugg.productos.length === 1) {
            agregarProductoAlCarrito(resSugg.productos[0]);
          } else if (resSugg && resSugg.productos && resSugg.productos.length > 1) {
            renderSugerenciasDropdown(resSugg.productos);
          } else {
            showToast(`Producto "${raw}" no encontrado`, 'error');
          }
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
      }
    });

    // Cerrar dropdown si se hace clic afuera
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  function renderSugerenciasDropdown(productos) {
    const dropdown = document.getElementById('pos-sugerencias-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = productos.map((p, idx) => {
      const p1 = Number(p.precio_1) || Number(p.precio) || 0;
      const p2 = Number(p.precio_2) || p1;
      const p3 = Number(p.precio_3) || p1;

      return `
        <div onclick='ModuloVentas.agregarProductoPorId(${JSON.stringify(p).replace(/'/g, "&apos;")})'
             class="p-3 hover:bg-indigo-50/70 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs">
          <div class="space-y-0.5 min-w-0">
            <div class="font-bold text-slate-800 truncate">${escapeHtml(p.nombre)}</div>
            <div class="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span class="text-indigo-600 font-bold">${escapeHtml(p.sku)}</span>
              ${p.codigo_barras ? `<span>• 🏷️ ${escapeHtml(p.codigo_barras)}</span>` : ''}
              <span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-sans">Stock: ${p.stock}</span>
            </div>
          </div>

          <div class="text-right flex-shrink-0 space-y-0.5">
            <div class="font-bold font-mono text-emerald-700 text-sm">
              $ ${formatMoney(p1)}
              <span class="text-[9px] text-slate-400 font-sans font-normal">(P1)</span>
            </div>
            <div class="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 justify-end">
              <span>P2: $${formatMoney(p2)}</span>
              <span>• P3: $${formatMoney(p3)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    dropdown.classList.remove('hidden');
  }

  function agregarProductoPorId(prod) {
    const dropdown = document.getElementById('pos-sugerencias-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    agregarProductoAlCarrito(prod);
  }

  function limpiarBuscador() {
    const input = document.getElementById('pos-input-busqueda');
    const dropdown = document.getElementById('pos-sugerencias-dropdown');
    const btnLimpiar = document.getElementById('btn-limpiar-busq');
    if (input) input.value = '';
    if (dropdown) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
    }
    if (btnLimpiar) btnLimpiar.classList.add('hidden');
  }

  function enfocarBuscador() {
    const input = document.getElementById('pos-input-busqueda');
    if (input) input.focus();
  }

  // Escaneo físico global de código de barras
  let barcodeBuffer = '';
  let barcodeTimeout = null;

  function iniciarListenerTecladoCodigoBarras() {
    window.addEventListener('keydown', (e) => {
      // Si el foco está en un input que no sea el buscador, no interceptar
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT' && activeEl.id !== 'pos-input-busqueda') {
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) {
          const code = barcodeBuffer;
          barcodeBuffer = '';
          procesarCodigoEscaneado(code);
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => {
          barcodeBuffer = '';
        }, 150);
      }
    });
  }

  async function procesarCodigoEscaneado(codigo) {
    if (!codigo) return;
    try {
      const res = await apiFetch(`/ventas/buscar-codigo/${encodeURIComponent(codigo)}`);
      if (res && res.ok && res.producto) {
        agregarProductoAlCarrito(res.producto);
        showToast(`Producto agregado: ${res.producto.nombre}`, 'success');
      } else {
        showToast(`Código de barras "${codigo}" no registrado`, 'error');
      }
    } catch (e) {}
  }

  // Cámara Escáner con Html5Qrcode
  async function abrirCamaraScanner() {
    const modal = document.getElementById('modal-scanner-ventas');
    if (!modal) return;
    modal.classList.remove('hidden');

    try {
      if (typeof Html5Qrcode === 'undefined') {
        showToast('Librería de cámara no disponible', 'error');
        return;
      }
      scannerActivo = new Html5Qrcode('reader-ventas-cam');
      await scannerActivo.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 180 } },
        async (decodedText) => {
          detenerCamaraScanner();
          await procesarCodigoEscaneado(decodedText);
        },
        () => {}
      );
    } catch (e) {
      showToast('No se pudo acceder a la cámara', 'error');
      detenerCamaraScanner();
    }
  }

  function detenerCamaraScanner() {
    const modal = document.getElementById('modal-scanner-ventas');
    if (modal) modal.classList.add('hidden');
    if (scannerActivo) {
      try {
        scannerActivo.stop().then(() => {
          scannerActivo.clear();
          scannerActivo = null;
        });
      } catch (e) {
        scannerActivo = null;
      }
    }
  }

  // ------------------------------------------------------------
  // GESTIÓN Y CARGA DE ARCHIVO DE PRECIOS
  // ------------------------------------------------------------
  function iniciarDragAndDropPrecios() {
    const dropzone = document.getElementById('dropzone-precios');
    const input = document.getElementById('input-archivo-precios');
    if (!dropzone || !input) return;

    dropzone.addEventListener('click', () => input.click());

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('border-indigo-400', 'bg-white/15');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-indigo-400', 'bg-white/15');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        subirArchivoPrecios(e.dataTransfer.files[0]);
      }
    });
  }

  function onSeleccionarArchivoPrecios(input) {
    if (input.files && input.files.length) {
      subirArchivoPrecios(input.files[0]);
    }
  }

  async function subirArchivoPrecios(file) {
    if (!file) return;

    const box = document.getElementById('precios-resultado-box');
    if (box) {
      box.classList.remove('hidden');
      box.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="animate-spin text-xl">⏳</div>
          <div>
            <p class="font-bold text-white text-sm">Procesando y actualizando precios...</p>
            <p class="text-slate-300 text-xs">Leyendo archivo ${escapeHtml(file.name)}</p>
          </div>
        </div>
      `;
    }

    const formData = new FormData();
    formData.append('archivo', file);

    try {
      const res = await apiFetch('/ventas/actualizar-precios-archivo', {
        method: 'POST',
        body: formData
      });

      if (res && res.ok) {
        showToast(res.mensaje || 'Precios actualizados con éxito', 'success');
        if (box) {
          box.innerHTML = `
            <div class="space-y-3">
              <div class="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <span>✅</span> <span>${escapeHtml(res.mensaje)}</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div class="bg-black/20 p-2 rounded-lg">
                  <div class="text-slate-400 text-[10px]">Filas leídas</div>
                  <div class="font-mono font-bold text-white">${res.stats.filas_procesadas}</div>
                </div>
                <div class="bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-lg">
                  <div class="text-emerald-300 text-[10px]">Actualizados</div>
                  <div class="font-mono font-bold text-emerald-400">${res.stats.productos_actualizados}</div>
                </div>
                <div class="bg-black/20 p-2 rounded-lg">
                  <div class="text-slate-400 text-[10px]">No encontrados</div>
                  <div class="font-mono font-bold text-amber-300">${res.stats.no_encontrados}</div>
                </div>
                <div class="bg-black/20 p-2 rounded-lg">
                  <div class="text-slate-400 text-[10px]">Columnas Venta</div>
                  <div class="font-mono font-bold text-indigo-300">${res.stats.columnas_precios_detectadas}</div>
                </div>
              </div>

              ${res.muestra_actualizados && res.muestra_actualizados.length > 0 ? `
                <div class="mt-2">
                  <span class="font-bold text-[11px] text-slate-300 block mb-1">Muestra de productos actualizados:</span>
                  <div class="max-h-40 overflow-y-auto divide-y divide-white/10 rounded-lg bg-black/30 p-2 font-mono text-[11px]">
                    ${res.muestra_actualizados.slice(0, 15).map(m => `
                      <div class="py-1 flex justify-between gap-2">
                        <span class="truncate text-slate-300">${escapeHtml(m.nombre)}</span>
                        <span class="text-emerald-300 flex-shrink-0">P1: $${formatMoney(m.precio_1_nuevo)} | P2: $${formatMoney(m.precio_2_nuevo)} | P3: $${formatMoney(m.precio_3_nuevo)}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }

        // Recargar el catálogo visual de precios
        cargarCatalogoPrecios();
      } else {
        if (box) {
          box.innerHTML = `
            <div class="text-rose-400 text-xs space-y-1">
              <p class="font-bold">❌ Error al actualizar precios:</p>
              <p>${escapeHtml(res.error || 'No se pudo procesar el archivo')}</p>
            </div>
          `;
        }
        showToast(res.error || 'Error al procesar archivo', 'error');
      }
    } catch (e) {
      if (box) {
        box.innerHTML = `<div class="text-rose-400 text-xs font-bold">Error de red o archivo dañado</div>`;
      }
      showToast('Error de conexión', 'error');
    }
  }

  // ------------------------------------------------------------
  // CATÁLOGO VISUAL DE PRECIOS Y EDICIÓN INLINE
  // ------------------------------------------------------------
  let debounceCatalogoBusq = null;

  async function cargarCatalogoPrecios(query = '') {
    const cont = document.getElementById('catalogo-precios-tabla-container');
    if (!cont) return;

    try {
      const res = await apiFetch(`/ventas/catalogo/precios?q=${encodeURIComponent(query)}&limit=100`);
      if (res && res.ok && res.productos) {
        catalogoPrecios = res.productos;
        renderTablaCatalogoPrecios(res.productos);
      } else {
        cont.innerHTML = `<div class="py-8 text-center text-rose-500 text-xs">Error al cargar precios</div>`;
      }
    } catch (e) {
      cont.innerHTML = `<div class="py-8 text-center text-rose-500 text-xs">Sin conexión</div>`;
    }
  }

  function onFiltrarCatalogoPrecios(val) {
    clearTimeout(debounceCatalogoBusq);
    debounceCatalogoBusq = setTimeout(() => {
      cargarCatalogoPrecios(val.trim());
    }, 200);
  }

  function renderTablaCatalogoPrecios(prods) {
    const cont = document.getElementById('catalogo-precios-tabla-container');
    if (!cont) return;

    if (!prods.length) {
      cont.innerHTML = `<div class="py-12 text-center text-slate-400 text-xs">No se encontraron productos en el catálogo</div>`;
      return;
    }

    cont.innerHTML = `
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
          <tr>
            <th class="py-2.5 px-3">SKU / Código</th>
            <th class="py-2.5 px-3">Artículo / Producto</th>
            <th class="py-2.5 px-3">Código Barras</th>
            <th class="py-2.5 px-3 text-center">Stock</th>
            <th class="py-2.5 px-3 text-right">Precio 1 (General)</th>
            <th class="py-2.5 px-3 text-right">Precio 2</th>
            <th class="py-2.5 px-3 text-right">Precio 3</th>
            <th class="py-2.5 px-3 text-center">Guardar</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${prods.map(p => `
            <tr class="hover:bg-slate-50/70" id="row-prod-precio-${p.id}">
              <td class="py-2.5 px-3 font-mono font-bold text-indigo-700">${escapeHtml(p.sku)}</td>
              <td class="py-2.5 px-3 font-medium text-slate-800">${escapeHtml(p.nombre)}</td>
              <td class="py-2.5 px-3 font-mono text-slate-500 text-[11px]">${escapeHtml(p.codigo_barras || '-')}</td>
              <td class="py-2.5 px-3 text-center font-mono font-bold text-slate-700">${p.stock}</td>
              <td class="py-2 px-2 text-right">
                <div class="relative inline-flex items-center">
                  <span class="absolute left-2 text-emerald-600 font-bold text-xs select-none pointer-events-none">$</span>
                  <input type="text" inputmode="numeric" id="inp-p1-${p.id}"
                         value="${formatMoney(p.precio_1 || p.precio || 0)}"
                         oninput="ModuloVentas.formatearInputPrecio(this)"
                         onfocus="this.select()"
                         title="Precio 1 (General)"
                         class="w-28 text-right pl-5 pr-2 py-1 bg-white border border-emerald-300 rounded font-mono text-xs focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-800 shadow-sm" />
                </div>
              </td>
              <td class="py-2 px-2 text-right">
                <div class="relative inline-flex items-center">
                  <span class="absolute left-2 text-slate-400 font-bold text-xs select-none pointer-events-none">$</span>
                  <input type="text" inputmode="numeric" id="inp-p2-${p.id}"
                         value="${formatMoney(p.precio_2 || p.precio_1 || 0)}"
                         oninput="ModuloVentas.formatearInputPrecio(this)"
                         onfocus="this.select()"
                         title="Precio 2"
                         class="w-28 text-right pl-5 pr-2 py-1 bg-white border border-slate-200 rounded font-mono text-xs focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700 shadow-sm" />
                </div>
              </td>
              <td class="py-2 px-2 text-right">
                <div class="relative inline-flex items-center">
                  <span class="absolute left-2 text-slate-400 font-bold text-xs select-none pointer-events-none">$</span>
                  <input type="text" inputmode="numeric" id="inp-p3-${p.id}"
                         value="${formatMoney(p.precio_3 || p.precio_1 || 0)}"
                         oninput="ModuloVentas.formatearInputPrecio(this)"
                         onfocus="this.select()"
                         title="Precio 3"
                         class="w-28 text-right pl-5 pr-2 py-1 bg-white border border-slate-200 rounded font-mono text-xs focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700 shadow-sm" />
                </div>
              </td>
              <td class="py-2 px-3 text-center">
                <button type="button" onclick="ModuloVentas.guardarPrecioIndividual(${p.id})"
                        id="btn-save-precio-${p.id}"
                        class="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-xs transition-colors">
                  💾
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function extraerPrecioLimpio(str) {
    if (!str) return 0;
    let s = String(str).trim().replace(/[$]/g, '').replace(/\s+/g, '');
    if (s.includes(',')) {
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        s = parts[0];
      }
    }
    const digits = s.replace(/\D/g, '');
    return parseInt(digits, 10) || 0;
  }

  function formatearInputPrecio(input) {
    if (!input) return;
    const num = extraerPrecioLimpio(input.value);
    input.value = num > 0 ? formatMoney(num) : '0';
  }

  async function guardarPrecioIndividual(id) {
    const inp1 = document.getElementById(`inp-p1-${id}`);
    const inp2 = document.getElementById(`inp-p2-${id}`);
    const inp3 = document.getElementById(`inp-p3-${id}`);
    const btn = document.getElementById(`btn-save-precio-${id}`);
    if (!inp1 || !inp2 || !inp3) return;

    const val1 = extraerPrecioLimpio(inp1.value);
    const val2 = extraerPrecioLimpio(inp2.value);
    const val3 = extraerPrecioLimpio(inp3.value);

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳';
    }

    try {
      const res = await apiFetch(`/ventas/producto-precio/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precio_1: val1,
          precio_2: val2,
          precio_3: val3
        })
      });

      if (res && res.ok) {
        showToast('Precios guardados con éxito', 'success');
        if (btn) btn.textContent = '✓';
        inp1.value = formatMoney(val1);
        inp2.value = formatMoney(val2);
        inp3.value = formatMoney(val3);
        setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = '💾'; } }, 1500);
      } else {
        showToast(res.error || 'Error al guardar precio', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '💾'; }
      }
    } catch (e) {
      showToast('Error de red', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '💾'; }
    }
  }

  // ------------------------------------------------------------
  // HISTORIAL DE FACTURAS
  // ------------------------------------------------------------
  async function cargarHistorialFacturas() {
    const cont = document.getElementById('historial-tabla-container');
    if (!cont) return;

    const fechaFiltro = document.getElementById('historial-fecha-filtro')?.value || '';
    const qFiltro = document.getElementById('historial-q-filtro')?.value || '';

    try {
      const url = `/ventas?fecha=${encodeURIComponent(fechaFiltro)}&q=${encodeURIComponent(qFiltro)}`;
      const res = await apiFetch(url);

      if (res && res.ok) {
        facturasHistorial = res.facturas || [];
        statsHistorial = res.stats || {};
        actualizarCardsHistorial(statsHistorial);
        renderTablaHistorial(facturasHistorial);
      } else {
        cont.innerHTML = `<div class="py-8 text-center text-rose-500 text-xs">Error al cargar facturas</div>`;
      }
    } catch (e) {
      cont.innerHTML = `<div class="py-8 text-center text-rose-500 text-xs">Sin conexión</div>`;
    }
  }

  function actualizarCardsHistorial(st) {
    const elCount = document.getElementById('stat-ventas-count');
    const elTot = document.getElementById('stat-ventas-total');
    const elEfe = document.getElementById('stat-ventas-efectivo');
    const elTra = document.getElementById('stat-ventas-transferencia');

    if (elCount) elCount.textContent = st.total_ventas || 0;
    if (elTot) elTot.textContent = `$ ${formatMoney(st.total_dinero || 0)}`;
    if (elEfe) elEfe.textContent = `$ ${formatMoney(st.total_efectivo || 0)}`;
    if (elTra) elTra.textContent = `$ ${formatMoney(st.total_transferencia || 0)}`;
  }

  function renderTablaHistorial(facts) {
    const cont = document.getElementById('historial-tabla-container');
    if (!cont) return;

    if (!facts.length) {
      cont.innerHTML = `<div class="py-12 text-center text-slate-400 text-xs">No hay facturas registradas en este período</div>`;
      return;
    }

    cont.innerHTML = `
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
          <tr>
            <th class="py-2.5 px-3">Factura</th>
            <th class="py-2.5 px-3">Fecha y Hora</th>
            <th class="py-2.5 px-3">Cliente</th>
            <th class="py-2.5 px-3">Vendedor</th>
            <th class="py-2.5 px-3 text-center">Método</th>
            <th class="py-2.5 px-3 text-right">Total</th>
            <th class="py-2.5 px-3 text-center">Estado</th>
            <th class="py-2.5 px-3 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${facts.map(f => `
            <tr class="hover:bg-slate-50/70">
              <td class="py-2.5 px-3 font-mono font-bold text-indigo-700">${escapeHtml(f.numero_factura)}</td>
              <td class="py-2.5 px-3 text-slate-600">${escapeHtml(f.fecha)}</td>
              <td class="py-2.5 px-3 font-semibold text-slate-800">${escapeHtml(f.cliente_nombre || 'Consumidor Final')}</td>
              <td class="py-2.5 px-3 text-slate-500">${escapeHtml(f.usuario_nombre || 'Caja')}</td>
              <td class="py-2.5 px-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  f.metodo_pago === 'EFECTIVO' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                }">
                  ${escapeHtml(f.metodo_pago)}
                </span>
              </td>
              <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">$ ${formatMoney(f.total)}</td>
              <td class="py-2.5 px-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  f.estado === 'COMPLETADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }">
                  ${escapeHtml(f.estado)}
                </span>
              </td>
              <td class="py-2.5 px-3 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <button type="button" onclick="ModuloVentas.verTicketHistorial(${f.id})"
                          title="Ver y reimprimir ticket"
                          class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">
                    🖨️
                  </button>
                  ${f.estado === 'COMPLETADA' ? `
                    <button type="button" onclick="ModuloVentas.anularFactura(${f.id})"
                            title="Anular factura y reponer stock"
                            class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs">
                      🚫
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async function verTicketHistorial(id) {
    try {
      const res = await apiFetch(`/ventas/${id}`);
      if (res && res.ok && res.venta) {
        abrirModalTicket(res.venta);
      } else {
        showToast('No se encontró la factura', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  }

  async function anularFactura(id) {
    if (!confirm('¿Estás seguro de anular esta factura? Se repondrá el inventario de los productos vendidos.')) {
      return;
    }
    try {
      const res = await apiFetch(`/ventas/anular/${id}`, { method: 'POST' });
      if (res && res.ok) {
        showToast(res.mensaje || 'Factura anulada', 'success');
        cargarHistorialFacturas();
      } else {
        showToast(res.error || 'Error al anular', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  }

  // ------------------------------------------------------------
  // GENERADOR DE HTML DE TICKET (80MM) Y VISTA PREVIA
  // ------------------------------------------------------------
  function generarHtmlTicketInterno(f, cfg) {
    if (!f) f = MUESTRA_FACTURA_DEFAULT;
    const c = Object.assign({}, CONFIG_FACTURA_DEFAULT, cfg || configFactura);

    const totalFactura = Number(f.total) || 0;
    const subtotal = Number(f.subtotal) || totalFactura;
    const descuento = Number(f.descuento) || 0;
    const clienteNombre = f.cliente_nombre || 'Consumidor Final';
    const clienteTelefono = f.cliente_telefono || '';
    const clienteDireccion = f.cliente_direccion || '';
    const formaPago = f.metodo_pago || 'EFECTIVO';

    // Generar filas de items
    const filasItems = (f.items || []).map(it => {
      const precioUnitario = Number(it.precio_unitario || 0);
      const cantidad = Number(it.cantidad || 0);
      const itemSubtotal = Number(it.subtotal || (precioUnitario * cantidad));

      return `
        <tr>
          <td style="text-align: left; padding: 3px 0; vertical-align: top;">
            ${escapeHtml(it.nombre_producto)}
            ${c.mostrarSku && it.sku ? `<br><small style="font-size: 8px; color: #555;">SKU: ${escapeHtml(it.sku)}</small>` : ''}
          </td>
          <td style="text-align: center; vertical-align: top; padding: 3px 0;">${cantidad}</td>
          ${c.mostrarPrecioUnitario ? `
            <td style="text-align: right; vertical-align: top; padding: 3px 0;">$${formatMoney(precioUnitario)}</td>
          ` : ''}
          <td style="text-align: right; vertical-align: top; padding: 3px 0;">$${formatMoney(itemSubtotal)}</td>
        </tr>
      `;
    }).join('');

    // Encabezado
    const tieneCabecera = c.mostrarLogo || c.mostrarNombreNegocio || c.mostrarRazonSocial || c.mostrarNit || c.mostrarDireccion || c.mostrarTelefono || c.mostrarCiudad;

    let htmlCabecera = '';
    if (tieneCabecera) {
      htmlCabecera = `
        <div style="text-align: center; margin-bottom: 4px;">
          ${c.mostrarLogo ? `
            <img src="${c.urlLogo || '/img/Logo.png'}" style="max-width: 50mm; max-height: 24mm; margin: 0 auto 4px auto; display: block;" alt="Logo" onerror="this.style.display='none';" />
          ` : ''}
          ${c.mostrarNombreNegocio && c.nombreNegocio ? `
            <p style="font-weight: bold; font-size: 15px; margin: 0; text-transform: uppercase;">${escapeHtml(c.nombreNegocio)}</p>
          ` : ''}
          ${c.mostrarRazonSocial && c.razonSocial ? `
            <p style="margin: 2px 0; font-size: 11px;">${escapeHtml(c.razonSocial)}</p>
          ` : ''}
          ${c.mostrarNit && c.nitNegocio ? `
            <p style="margin: 2px 0; font-size: 11px;">${escapeHtml(c.nitNegocio)}</p>
          ` : ''}
          ${c.mostrarDireccion && c.direccionNegocio ? `
            <p style="margin: 2px 0; font-size: 11px;">${escapeHtml(c.direccionNegocio)}</p>
          ` : ''}
          ${c.mostrarTelefono && c.telefonoNegocio ? `
            <p style="margin: 2px 0; font-size: 11px;">Tel: ${escapeHtml(c.telefonoNegocio)}</p>
          ` : ''}
          ${c.mostrarCiudad && c.ciudadNegocio ? `
            <p style="margin: 2px 0; font-size: 11px;">${escapeHtml(c.ciudadNegocio)}</p>
          ` : ''}
        </div>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      `;
    }

    // Datos de la venta
    let htmlDatosVenta = '';
    if (c.mostrarFecha) htmlDatosVenta += `<p style="margin: 2px 0;"><b>Fecha:</b> ${escapeHtml(f.fecha || '')}</p>`;
    if (c.mostrarNumeroFactura) htmlDatosVenta += `<p style="margin: 2px 0;"><b>Factura N°:</b> ${escapeHtml(f.numero_factura || '')}</p>`;
    if (c.mostrarCliente) {
      const tieneNombreReal = clienteNombre && clienteNombre !== 'Consumidor Final' && clienteNombre !== 'Cliente General';
      const tieneTelefonoReal = clienteTelefono && clienteTelefono !== 'N/A' && clienteTelefono.trim() !== '';
      const tieneDireccionReal = clienteDireccion && clienteDireccion !== 'No especificada' && clienteDireccion.trim() !== '';

      if (tieneNombreReal || tieneTelefonoReal || tieneDireccionReal || !clienteNombre) {
        if (tieneNombreReal) {
          htmlDatosVenta += `<p style="margin: 2px 0;"><b>Cliente:</b> ${escapeHtml(clienteNombre)}</p>`;
        }
        if (c.mostrarTelefonoCliente && tieneTelefonoReal) {
          htmlDatosVenta += `<p style="margin: 2px 0;"><b>Teléfono:</b> ${escapeHtml(clienteTelefono)}</p>`;
        }
        if (c.mostrarDireccionCliente && tieneDireccionReal) {
          htmlDatosVenta += `<p style="margin: 2px 0;"><b>Dirección:</b> ${escapeHtml(clienteDireccion)}</p>`;
        }
      }
    }
    if (c.mostrarCajero) htmlDatosVenta += `<p style="margin: 2px 0;"><b>Cajero:</b> ${escapeHtml(f.usuario_nombre || 'Caja')}</p>`;
    if (c.mostrarListaPrecios) htmlDatosVenta += `<p style="margin: 2px 0;"><b>Lista Precios:</b> ${escapeHtml(getNombreLista(f.lista_precios))}</p>`;

    if (htmlDatosVenta) {
      htmlDatosVenta += `<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>`;
    }

    // Pie de página
    let htmlPie = '';
    if (c.mostrarPiePagina && c.textoPiePagina) {
      htmlPie = `
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        <div style="text-align: center; font-weight: bold; margin-top: 8px; font-size: 10px; line-height: 1.3;">
          ${c.textoPiePagina.split('\n').map(linea => `<p style="margin: 2px 0;">${escapeHtml(linea)}</p>`).join('')}
        </div>
      `;
    }

    return `
      <div id="ticket-print-area" style="font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.25; color: #000; width: 100%; max-width: 300px; margin: 0 auto; background: #fff; padding: 6px; box-sizing: border-box;">
        ${htmlCabecera}
        ${htmlDatosVenta}

        <table style="width: 100%; border-collapse: collapse; margin: 4px 0;">
          <thead>
            <tr>
              <th style="border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; text-align: left;">DESCRIPCIÓN</th>
              <th style="border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; text-align: center; width: 22px;">CANT</th>
              ${c.mostrarPrecioUnitario ? `
                <th style="border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; text-align: right; width: 45px;">VR.UNI</th>
              ` : ''}
              <th style="border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; text-align: right; width: 50px;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${filasItems}
          </tbody>
        </table>

        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

        <table style="width: 100%; margin-top: 4px;">
          ${c.mostrarSubtotalDescuento && descuento > 0 ? `
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">$${formatMoney(subtotal)}</td>
            </tr>
            <tr>
              <td>Descuento:</td>
              <td style="text-align: right;">-$${formatMoney(descuento)}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="font-weight: bold; font-size: 12px;">VALOR A PAGAR:</td>
            <td style="text-align: right; font-weight: bold; font-size: 13px;">$${formatMoney(totalFactura)}</td>
          </tr>
          ${c.mostrarMetodoPago ? `
            <tr>
              <td style="padding-top: 3px;">Forma de Pago:</td>
              <td style="text-align: right; padding-top: 3px;">${escapeHtml(formaPago)}</td>
            </tr>
          ` : ''}
          ${c.mostrarCambio && formaPago === 'EFECTIVO' ? `
            <tr>
              <td style="padding-top: 2px;">Monto Recibido:</td>
              <td style="text-align: right; padding-top: 2px;">$${formatMoney(f.monto_recibido || totalFactura)}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding-top: 2px;">Cambio / Devuelta:</td>
              <td style="text-align: right; font-weight: bold; padding-top: 2px;">$${formatMoney(f.cambio || 0)}</td>
            </tr>
          ` : ''}
        </table>

        ${htmlPie}
      </div>
    `;
  }

  // ------------------------------------------------------------
  // MODAL DE TICKET Y FORMATO DE IMPRESIÓN
  // ------------------------------------------------------------
  function abrirModalTicket(venta) {
    ultimaFacturaCreada = venta;
    const modal = document.getElementById('modal-ticket-factura');
    const body = document.getElementById('ticket-body-container');
    const sub = document.getElementById('ticket-modal-sub');
    if (!modal || !body) return;

    if (sub) sub.textContent = `${venta.numero_factura} • ${venta.fecha}`;
    body.innerHTML = generarHtmlTicketInterno(venta, configFactura);
    modal.classList.remove('hidden');
  }

  function cerrarModalTicket() {
    const modal = document.getElementById('modal-ticket-factura');
    if (modal) modal.classList.add('hidden');
    enfocarBuscador();
  }

  function imprimirTicketDirecto(facturaCustom) {
    const f = facturaCustom || ultimaFacturaCreada;
    if (!f) return;

    let iframe = document.getElementById('iframe-impresion-ventas');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'iframe-impresion-ventas';
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();

    const ticketHtml = generarHtmlTicketInterno(f, configFactura);

    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Factura POS - ${escapeHtml(f.numero_factura || 'Venta')}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm;
            margin: 0 auto;
            padding: 4mm 0;
            font-size: 11px;
            color: #000;
            line-height: 1.25;
            background: #fff;
          }
        </style>
      </head>
      <body>
        ${ticketHtml}
      </body>
      </html>
    `);

    doc.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
    }, 250);
  }

  // ------------------------------------------------------------
  // SERVIDOR DE IMPRESIÓN LOCAL (TIENDA) - TEXTO PLANO
  // ------------------------------------------------------------
  function centrarTexto(str, len) {
    if (!str) return '';
    if (str.length >= len) return str.substring(0, len);
    const pad = Math.floor((len - str.length) / 2);
    return ' '.repeat(pad) + str;
  }

  function generarTextoPlanoTicket(venta, cfg) {
    if (!venta) return '';
    const f = venta;
    const c = Object.assign({}, CONFIG_FACTURA_DEFAULT, cfg || configFactura);
    const items = f.items || [];
    const ancho = 40;
    const sep = '='.repeat(ancho);
    const lin = '-'.repeat(ancho);

    let t = '';

    // Encabezado
    if (c.mostrarNombreNegocio && c.nombreNegocio) {
      t += centrarTexto(c.nombreNegocio.toUpperCase(), ancho) + '\n';
    }
    if (c.mostrarRazonSocial && c.razonSocial) {
      t += centrarTexto(c.razonSocial, ancho) + '\n';
    }
    if (c.mostrarNit && c.nitNegocio) {
      t += centrarTexto(c.nitNegocio, ancho) + '\n';
    }
    if (c.mostrarDireccion && c.direccionNegocio) {
      t += centrarTexto(c.direccionNegocio, ancho) + '\n';
    }
    if (c.mostrarTelefono && c.telefonoNegocio) {
      t += centrarTexto('Tel: ' + c.telefonoNegocio, ancho) + '\n';
    }
    if (c.mostrarCiudad && c.ciudadNegocio) {
      t += centrarTexto(c.ciudadNegocio, ancho) + '\n';
    }

    t += sep + '\n';

    if (c.mostrarFecha) t += `Fecha: ${f.fecha || new Date().toLocaleString('es-CO')}\n`;
    if (c.mostrarNumeroFactura) t += `Factura N°: ${f.numero_factura}\n`;
    if (c.mostrarCliente) {
      const cliNom = f.cliente_nombre || '';
      const cliTel = f.cliente_telefono || '';
      const cliDir = f.cliente_direccion || '';
      const tieneReal = cliNom && cliNom !== 'Consumidor Final' && cliNom !== 'Cliente General';
      const tieneTel = cliTel && cliTel !== 'N/A' && cliTel.trim() !== '';
      const tieneDir = cliDir && cliDir !== 'No especificada' && cliDir.trim() !== '';

      if (tieneReal || tieneTel || tieneDir) {
        if (tieneReal) t += `Cliente: ${cliNom}\n`;
        if (c.mostrarTelefonoCliente && tieneTel) t += `Teléfono: ${cliTel}\n`;
        if (c.mostrarDireccionCliente && tieneDir) t += `Dirección: ${cliDir}\n`;
      }
    }
    if (c.mostrarCajero) t += `Cajero: ${f.usuario_nombre || 'Caja'}\n`;
    if (c.mostrarListaPrecios) t += `Lista: ${getNombreLista(f.lista_precios || 'precio_1')}\n`;

    t += sep + '\n';
    if (c.mostrarPrecioUnitario) {
      t += 'DESCRIPCION       CANT  VR.UNI    TOTAL\n';
    } else {
      t += 'DESCRIPCION                 CANT   TOTAL\n';
    }
    t += lin + '\n';

    items.forEach(it => {
      if (c.mostrarPrecioUnitario) {
        const nom = (it.nombre_producto || 'Producto').substring(0, 16).padEnd(16, ' ');
        const cant = String(it.cantidad || 1).padStart(4, ' ');
        const uni = String(Math.round(it.precio_unitario || 0)).padStart(8, ' ');
        const sub = String(Math.round(it.subtotal || 0)).padStart(9, ' ');
        t += `${nom} ${cant} ${uni} ${sub}\n`;
      } else {
        const nom = (it.nombre_producto || 'Producto').substring(0, 24).padEnd(24, ' ');
        const cant = String(it.cantidad || 1).padStart(4, ' ');
        const sub = String(Math.round(it.subtotal || 0)).padStart(10, ' ');
        t += `${nom} ${cant} ${sub}\n`;
      }
      if (c.mostrarSku && it.sku) {
        t += `  * SKU: ${it.sku}\n`;
      }
    });

    t += sep + '\n';
    const total = Math.round(Number(f.total) || 0);
    const subtotal = Math.round(Number(f.subtotal) || total);
    const descuento = Math.round(Number(f.descuento) || 0);

    if (c.mostrarSubtotalDescuento && descuento > 0) {
      t += `SUBTOTAL:          $ ${formatMoney(subtotal)}\n`;
      t += `DESCUENTO:        -$ ${formatMoney(descuento)}\n`;
    }
    t += `VALOR A PAGAR:     $ ${formatMoney(total)}\n`;
    if (c.mostrarMetodoPago) {
      t += `Forma de Pago:     ${f.metodo_pago || 'EFECTIVO'}\n`;
    }
    if (c.mostrarCambio && f.metodo_pago === 'EFECTIVO') {
      const rec = Math.round(Number(f.monto_recibido) || total);
      const cam = Math.round(Number(f.cambio) || 0);
      t += `Recibido:          $ ${formatMoney(rec)}\n`;
      t += `Cambio:            $ ${formatMoney(cam)}\n`;
    }

    if (c.mostrarPiePagina && c.textoPiePagina) {
      t += sep + '\n';
      c.textoPiePagina.split('\n').forEach(linea => {
        t += centrarTexto(linea, ancho) + '\n';
      });
    }
    t += '\n\n\n\n\n';
    return t;
  }

  // ------------------------------------------------------------
  // GESTIÓN DEL FORMATO DE FACTURA (MODAL CON OJITOS Y EN VIVO)
  // ------------------------------------------------------------
  async function cargarConfigFactura() {
    try {
      const savedLocal = localStorage.getItem('jispi_config_factura');
      if (savedLocal) {
        try {
          configFactura = Object.assign({}, CONFIG_FACTURA_DEFAULT, JSON.parse(savedLocal));
        } catch (e) {}
      }
      const res = await apiFetch('/ventas/config-factura');
      if (res && res.ok && res.config) {
        configFactura = Object.assign({}, CONFIG_FACTURA_DEFAULT, res.config);
        localStorage.setItem('jispi_config_factura', JSON.stringify(configFactura));
      }
    } catch (e) {
      console.warn('Usando configuración local de factura:', e);
    }
  }

  function abrirModalConfigTicket() {
    const modal = document.getElementById('modal-config-ticket');
    if (!modal) return;
    configFacturaTemp = Object.assign({}, configFactura);
    renderControlesConfigTicket();
    renderPreviewConfigTicket();
    modal.classList.remove('hidden');
  }

  function cerrarModalConfigTicket() {
    const modal = document.getElementById('modal-config-ticket');
    if (modal) modal.classList.add('hidden');
    configFacturaTemp = null;
  }

  function renderFilaOpcion({ campo, titulo, descripcion, tieneInput, inputTipo, inputCampo, placeholder }) {
    const visible = !!configFacturaTemp[campo];
    return `
      <div class="bg-white border ${visible ? 'border-emerald-300 shadow-2xs' : 'border-slate-200 opacity-80'} rounded-xl p-3 flex flex-col gap-2 transition-all">
        <div class="flex items-center justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-bold text-xs text-slate-800">${escapeHtml(titulo)}</span>
              ${visible ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full">Activo</span>' : '<span class="text-[10px] bg-slate-100 text-slate-500 font-medium px-1.5 py-0.2 rounded-full">Oculto</span>'}
            </div>
            ${descripcion ? `<p class="text-[11px] text-slate-500 truncate">${escapeHtml(descripcion)}</p>` : ''}
          </div>
          <button type="button" onclick="ModuloVentas.toggleVisibilidad('${campo}')"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs select-none ${visible ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}">
            <span class="text-sm">${visible ? '👁️' : '👁️‍🗨️'}</span>
            <span>${visible ? 'Visible' : 'Oculto'}</span>
          </button>
        </div>
        ${tieneInput && visible ? `
          <div class="pt-1 border-t border-slate-100">
            ${inputTipo === 'textarea' ? `
              <textarea rows="2" oninput="ModuloVentas.actualizarCampoTexto('${inputCampo}', this.value)"
                        placeholder="${escapeHtml(placeholder || '')}"
                        class="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-800 bg-slate-50/80 font-mono">${escapeHtml(configFacturaTemp[inputCampo] || '')}</textarea>
            ` : `
              <input type="text" oninput="ModuloVentas.actualizarCampoTexto('${inputCampo}', this.value)"
                     value="${escapeHtml(configFacturaTemp[inputCampo] || '')}"
                     placeholder="${escapeHtml(placeholder || '')}"
                     class="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-800 bg-slate-50/80" />
            `}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderControlesConfigTicket() {
    const cont = document.getElementById('config-ticket-controles');
    if (!cont || !configFacturaTemp) return;

    const isAdmin = Auth.isAdmin();
    const btnGuardar = document.getElementById('btn-guardar-config-ticket');
    if (btnGuardar) {
      if (!isAdmin) {
        btnGuardar.disabled = true;
        btnGuardar.className = 'px-5 py-2 rounded-xl bg-slate-300 text-slate-500 font-bold text-xs cursor-not-allowed';
        btnGuardar.title = 'Se requiere rol Administrador para guardar cambios';
      } else {
        btnGuardar.disabled = false;
        btnGuardar.className = 'px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all';
        btnGuardar.title = 'Guardar configuración para todos los usuarios';
      }
    }

    cont.innerHTML = `
      ${!isAdmin ? `
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2.5">
          <span class="text-xl">🔒</span>
          <div>
            <p class="font-bold">Modo de solo visualización</p>
            <p class="text-[11px] text-amber-700">Puedes probar los ojitos y previsualizar los cambios en pantalla, pero solo los usuarios Administradores pueden guardar el diseño de factura para la tienda.</p>
          </div>
        </div>
      ` : ''}

      <!-- SECCIÓN 1: CABECERA Y DATOS DEL NEGOCIO -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
        <h4 class="font-extrabold text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
          <span>🏢</span> <span>Cabecera y Datos del Negocio</span>
        </h4>
        <div class="space-y-2">
          ${renderFilaOpcion({
            campo: 'mostrarLogo',
            titulo: 'Logo de la Empresa',
            descripcion: 'Muestra el logotipo de Jispiplast en la parte superior del ticket.'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarNombreNegocio',
            titulo: 'Nombre Comercial',
            descripcion: 'Nombre principal visible en el encabezado.',
            tieneInput: true,
            inputCampo: 'nombreNegocio',
            placeholder: 'Ej: Jispiplast'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarRazonSocial',
            titulo: 'Razón Social / Propietario',
            descripcion: 'Nombre legal o del propietario.',
            tieneInput: true,
            inputCampo: 'razonSocial',
            placeholder: 'Ej: Olga Inés Bueno Pineda'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarNit',
            titulo: 'NIT / Cédula / RUT',
            descripcion: 'Identificación tributaria de la empresa.',
            tieneInput: true,
            inputCampo: 'nitNegocio',
            placeholder: 'Ej: NIT: 1098.123.456-7'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarDireccion',
            titulo: 'Dirección del Establecimiento',
            descripcion: 'Ubicación física de la tienda.',
            tieneInput: true,
            inputCampo: 'direccionNegocio',
            placeholder: 'Ej: Calle 13 #15-20'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarTelefono',
            titulo: 'Teléfono / WhatsApp de Contacto',
            descripcion: 'Línea de atención para clientes.',
            tieneInput: true,
            inputCampo: 'telefonoNegocio',
            placeholder: 'Ej: 312 345 6789'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarCiudad',
            titulo: 'Ciudad / Municipio',
            descripcion: 'Ciudad de operación.',
            tieneInput: true,
            inputCampo: 'ciudadNegocio',
            placeholder: 'Ej: Bucaramanga'
          })}
        </div>
      </div>

      <!-- SECCIÓN 2: INFORMACIÓN DE LA FACTURA Y VENTA -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
        <h4 class="font-extrabold text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
          <span>🧾</span> <span>Datos de la Factura y Cajero</span>
        </h4>
        <div class="space-y-2">
          ${renderFilaOpcion({
            campo: 'mostrarFecha',
            titulo: 'Fecha y Hora de Emisión',
            descripcion: 'Estampa de tiempo en la que se generó la venta.'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarNumeroFactura',
            titulo: 'Número de Factura / Consecutivo',
            descripcion: 'Identificador único del comprobante (ej: FAC-0001).'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarCajero',
            titulo: 'Nombre del Cajero / Vendedor',
            descripcion: 'Usuario del sistema que registró la operación.'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarListaPrecios',
            titulo: 'Nombre de la Lista de Precios',
            descripcion: 'Indica si se cobró Precio 1 (General), Precio 2 o Precio 3.'
          })}
        </div>
      </div>

      <!-- SECCIÓN 3: DATOS DEL CLIENTE -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
        <h4 class="font-extrabold text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
          <span>👤</span> <span>Datos del Cliente</span>
        </h4>
        <div class="space-y-2">
          ${renderFilaOpcion({
            campo: 'mostrarCliente',
            titulo: 'Nombre del Cliente',
            descripcion: 'Muestra el nombre o razón social del cliente.'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarTelefonoCliente',
            titulo: 'Teléfono del Cliente',
            descripcion: 'Muestra el número de teléfono si está registrado.'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarDireccionCliente',
            titulo: 'Dirección del Cliente',
            descripcion: 'Muestra la dirección de entrega o domicilio.'
          })}
        </div>
      </div>

      <!-- SECCIÓN 4: DETALLE DE PRODUCTOS -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
        <h4 class="font-extrabold text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
          <span>📦</span> <span>Detalle de Productos en la Tabla</span>
        </h4>
        <div class="space-y-2">
          ${renderFilaOpcion({
            campo: 'mostrarSku',
            titulo: 'Código SKU del Producto',
            descripcion: 'Muestra el SKU debajo del nombre de cada artículo.'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarPrecioUnitario',
            titulo: 'Columna de Precio Unitario (VR.UNI)',
            descripcion: 'Muestra el costo unitario de cada producto en la tabla.'
          })}
        </div>
      </div>

      <!-- SECCIÓN 5: TOTALES Y FORMA DE PAGO -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
        <h4 class="font-extrabold text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
          <span>💵</span> <span>Totales, Forma de Pago y Cambio</span>
        </h4>
        <div class="space-y-2">
          ${renderFilaOpcion({
            campo: 'mostrarSubtotalDescuento',
            titulo: 'Líneas de Subtotal y Descuento',
            descripcion: 'Desglose del valor bruto y rebajas aplicadas.'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarMetodoPago',
            titulo: 'Método de Pago',
            descripcion: 'Muestra si fue pagado en Efectivo, Transferencia u otro.'
          })}
          ${renderFilaOpcion({
            campo: 'mostrarCambio',
            titulo: 'Monto Recibido y Cambio / Devuelta',
            descripcion: 'Muestra el valor entregado por el cliente y el cambio en efectivo.'
          })}
        </div>
      </div>

      <!-- SECCIÓN 6: PIE DE PÁGINA -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
        <h4 class="font-extrabold text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
          <span>💬</span> <span>Pie de Página y Despedida</span>
        </h4>
        <div class="space-y-2">
          ${renderFilaOpcion({
            campo: 'mostrarPiePagina',
            titulo: 'Mensaje Final / Agradecimiento',
            descripcion: 'Texto al pie del ticket con mensajes de agradecimiento o notas legales.',
            tieneInput: true,
            inputTipo: 'textarea',
            inputCampo: 'textoPiePagina',
            placeholder: '*** ¡GRACIAS POR SU COMPRA! ***\nVuelva pronto'
          })}
        </div>
      </div>
    `;
  }

  function toggleVisibilidad(campo) {
    if (!configFacturaTemp) return;
    configFacturaTemp[campo] = !configFacturaTemp[campo];
    renderControlesConfigTicket();
    renderPreviewConfigTicket();
  }

  function actualizarCampoTexto(campo, valor) {
    if (!configFacturaTemp) return;
    configFacturaTemp[campo] = valor;
    renderPreviewConfigTicket();
  }

  function renderPreviewConfigTicket() {
    const cont = document.getElementById('preview-ticket-live');
    if (!cont || !configFacturaTemp) return;
    const muestra = ultimaFacturaCreada || MUESTRA_FACTURA_DEFAULT;
    cont.innerHTML = generarHtmlTicketInterno(muestra, configFacturaTemp);
  }

  async function guardarConfigTicket() {
    if (!Auth.isAdmin()) {
      showToast('Solo los administradores tienen permiso para modificar el formato de la factura.', 'error');
      return;
    }

    const btn = document.getElementById('btn-guardar-config-ticket');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>Guardando...</span>';
    }

    try {
      const res = await apiFetch('/ventas/config-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configFacturaTemp })
      });

      if (res && res.ok && res.config) {
        configFactura = Object.assign({}, res.config);
        localStorage.setItem('jispi_config_factura', JSON.stringify(configFactura));
        showToast('✓ Formato de factura guardado exitosamente.', 'success');
        cerrarModalConfigTicket();

        // Si el modal de ticket de factura está abierto, refrescar el ticket
        if (ultimaFacturaCreada) {
          const body = document.getElementById('ticket-body-container');
          if (body) {
            body.innerHTML = generarHtmlTicketInterno(ultimaFacturaCreada, configFactura);
          }
        }
      } else {
        showToast(res?.error || 'Error al guardar configuración de factura', 'error');
      }
    } catch (e) {
      showToast('Error de conexión al guardar configuración', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>💾</span> <span>Guardar Formato</span>';
      }
    }
  }

  function restablecerConfigTicketDefault() {
    if (!confirm('¿Deseas restablecer todos los elementos y visibilidad de la factura a sus valores originales?')) return;
    configFacturaTemp = Object.assign({}, CONFIG_FACTURA_DEFAULT);
    renderControlesConfigTicket();
    renderPreviewConfigTicket();
    showToast('Valores restablecidos en la vista previa. Haz clic en Guardar Formato para aplicar.', 'info');
  }

  function probarImpresionConfigTicket() {
    const muestra = ultimaFacturaCreada || MUESTRA_FACTURA_DEFAULT;
    const backup = Object.assign({}, configFactura);
    configFactura = Object.assign({}, configFacturaTemp);
    imprimirTicketDirecto(muestra);
    configFactura = backup;
  }

  async function enviarAImpresoraTienda(facturaCustom) {
    const f = facturaCustom || ultimaFacturaCreada;
    if (!f) {
      showToast('No hay ninguna factura activa para imprimir.', 'error');
      return;
    }

    const textoPlano = generarTextoPlanoTicket(f);
    showToast('Enviando factura a la impresora física de la tienda...', 'info');

    try {
      const res = await apiFetch('/impresion/encolar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'VENTA',
          referencia_id: f.id,
          numero_factura: f.numero_factura,
          contenido_ticket: textoPlano,
          usuario_nombre: f.usuario_nombre
        })
      });

      if (res && res.ok) {
        showToast(`✓ Factura ${f.numero_factura} enviada a imprimir en tienda.`, 'success');
      } else {
        showToast(res?.error || 'Error al enviar a la impresora de la tienda.', 'error');
      }
    } catch (err) {
      showToast('Error de red al enviar la impresión.', 'error');
    }
  }

  async function verificarEstadoServidorImpresion(mostrarToast = false) {
    try {
      const res = await apiFetch('/impresion/estado');
      const conectado = res && res.agente_conectado;

      const dotTop = document.getElementById('dot-estado-impresora');
      const txtTop = document.getElementById('txt-estado-impresora');
      const badgeModal = document.getElementById('info-estado-agente-badge');
      const txtCola = document.getElementById('info-tickets-cola');
      const txtImpr = document.getElementById('info-impresora-nombre');

      if (dotTop && txtTop) {
        if (conectado) {
          dotTop.className = 'w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse';
          txtTop.textContent = 'En Línea';
          txtTop.className = 'text-emerald-700 font-bold';
        } else {
          dotTop.className = 'w-2 h-2 rounded-full bg-slate-400 inline-block';
          txtTop.textContent = 'Fuera de Línea';
          txtTop.className = 'text-slate-500 font-bold';
        }
      }

      if (badgeModal) {
        if (conectado) {
          badgeModal.className = 'px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1.5';
          badgeModal.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 🟢 En Línea (Listo)';
        } else {
          badgeModal.className = 'px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-600 flex items-center gap-1.5';
          badgeModal.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-400"></span> ⚪ Fuera de Línea (Esperando PC)';
        }
      }

      if (txtCola) txtCola.textContent = String(res?.pendientes_en_cola || 0);
      if (txtImpr) txtImpr.textContent = res?.impresora_registrada || 'Predeterminada de Windows';

      if (mostrarToast) {
        if (conectado) {
          showToast('✓ El servidor de impresión de la tienda está conectado y listo.', 'success');
        } else {
          showToast('El servidor de impresión en el PC de la tienda aún no está iniciado.', 'info');
        }
      }
    } catch (e) {}
  }

  function abrirModalServidorImpresion() {
    const modal = document.getElementById('modal-servidor-impresion');
    if (modal) {
      modal.classList.remove('hidden');
      verificarEstadoServidorImpresion(false);
    }
  }

  function cerrarModalServidorImpresion() {
    const modal = document.getElementById('modal-servidor-impresion');
    if (modal) modal.classList.add('hidden');
  }

  // API pública del módulo
  return {
    render,
    onEnterTab,
    onLeaveTab,
    cambiarSubtab,
    seleccionarListaPreciosGlobal,
    agregarProductoAlCarrito,
    agregarProductoPorId,
    cambiarTipoPrecioItem,
    modificarCantidad,
    fijarCantidad,
    eliminarItem,
    vaciarCarrito,
    seleccionarMetodoPago,
    actualizarTotales,
    ponerEfectivoExacto,
    sumarEfectivo,
    calcularDevuelta,
    procesarVenta,
    limpiarBuscador,
    abrirCamaraScanner,
    detenerCamaraScanner,
    onSeleccionarArchivoPrecios,
    subirArchivoPrecios,
    cargarCatalogoPrecios,
    onFiltrarCatalogoPrecios,
    formatearInputPrecio,
    guardarPrecioIndividual,
    cargarHistorialFacturas,
    verTicketHistorial,
    anularFactura,
    abrirModalTicket,
    cerrarModalTicket,
    imprimirTicketDirecto,
    abrirModalServidorImpresion,
    cerrarModalServidorImpresion,
    verificarEstadoServidorImpresion,
    enviarAImpresoraTienda,
    abrirModalConfigTicket,
    cerrarModalConfigTicket,
    toggleVisibilidad,
    actualizarCampoTexto,
    renderControlesConfigTicket,
    renderPreviewConfigTicket,
    guardarConfigTicket,
    restablecerConfigTicketDefault,
    probarImpresionConfigTicket,
    cargarConfigFactura
  };
})();
