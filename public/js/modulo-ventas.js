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
  let clienteSeleccionado = null; // { id, nombre, telefono, direccion, empresa }
  let ultimosNoEncontrados = [];
  let posProductosSugeridos = [];
  let posIndexSeleccionado = -1;

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
    tamanoPapel: '80mm',
    margenLateral: '4mm'
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

          <div class="p-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <!-- SELECTOR DE COPIAS A IMPRIMIR (Al ladito de los botones) -->
            <div class="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-2xs shrink-0 self-center" title="Número de copias a imprimir de este comprobante">
              <span class="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>📄</span> <span class="text-[11px] font-extrabold text-slate-600">Copias:</span>
              </span>
              <button type="button" onclick="ModuloVentas.ajustarCopiasImpresion(-1)"
                      class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center cursor-pointer select-none active:scale-90">-</button>
              <input type="number" id="ticket-input-copias" min="1" max="10" value="1"
                     onchange="ModuloVentas.fijarCopiasImpresion(this.value)"
                     class="w-8 text-center text-xs font-black font-mono border-0 p-0 text-slate-900 focus:outline-none" />
              <button type="button" onclick="ModuloVentas.ajustarCopiasImpresion(1)"
                      class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center cursor-pointer select-none active:scale-90">+</button>
            </div>

            <!-- BOTONES DE IMPRESIÓN -->
            <div class="flex items-center gap-2 flex-1 min-w-[260px]">
              <button onclick="ModuloVentas.imprimirTicketDirecto()" class="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors" title="Imprimir en este dispositivo mediante el navegador">
                <span>🖨️</span> <span>Imprimir Aquí</span>
              </button>
              <button onclick="ModuloVentas.enviarAImpresoraTienda()" class="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors" title="Enviar directamente a la impresora térmica conectada al PC de la tienda">
                <span>⚡</span> <span>Imprimir en Tienda</span>
              </button>
            </div>

            <button onclick="ModuloVentas.cerrarModalTicket()" class="px-3.5 py-2.5 rounded-xl bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold text-xs cursor-pointer shrink-0">
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
                <p>• <b>Impresora activa:</b> <span id="info-impresora-nombre" class="font-mono text-slate-700 font-bold">Predeterminada de Windows</span></p>
                <p>• <b>Tickets en espera:</b> <span id="info-tickets-cola" class="font-bold text-slate-700">0</span></p>
              </div>
            </div>

            <!-- CONFIGURACIÓN DE LA IMPRESORA (GUARDADO PERMANENTE EN FIREBASE) -->
            <div class="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🖨️</span>
                  <div>
                    <h4 class="font-bold text-indigo-950 text-xs uppercase tracking-wider">Ajustes de Impresora (Guardado en Firebase)</h4>
                    <p class="text-[11px] text-indigo-800">Se almacena en la nube para que no se pierda al reiniciar o cambiar de dispositivo.</p>
                  </div>
                </div>
                <span class="text-[10px] bg-indigo-200 text-indigo-900 font-extrabold px-2 py-0.5 rounded-full">🔥 Cloud Sync</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">Nombre de la Impresora en Windows:</label>
                  <input type="text" id="impresora-config-nombre" placeholder="Predeterminada de Windows o POS-80"
                         class="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500" />
                  <span class="text-[10px] text-slate-400">Escribe el nombre tal como aparece en impresoras de Windows.</span>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">Ancho de Papel Térmico:</label>
                  <select id="impresora-config-papel" class="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500">
                    <option value="80mm">80 mm (Ticket estándar de tienda)</option>
                    <option value="58mm">58 mm (Ticket angosto / mini printer)</option>
                  </select>
                </div>
              </div>

              <div class="flex items-center justify-between pt-1">
                <label class="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-slate-700">
                  <input type="checkbox" id="impresora-config-auto" checked class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Imprimir automáticamente al completar cada factura</span>
                </label>

                <button type="button" id="btn-guardar-config-impresora" onclick="ModuloVentas.guardarConfigImpresora()"
                        class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-transform active:scale-95">
                  <span>💾</span> <span>Guardar en Firebase</span>
                </button>
              </div>
            </div>

            <!-- SECCIÓN DESTACADA: ENCENDIDO AUTOMÁTICO AL PRENDER EL COMPUTADOR -->
            <div class="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 space-y-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">⚡</span>
                <div>
                  <h4 class="font-bold text-emerald-950 text-xs uppercase tracking-wider">¿Encender automáticamente cada vez que prendas el PC?</h4>
                  <p class="text-[11px] text-emerald-800">Descarga este configurador para que arranque solo al prender Windows sin tener que abrir nada.</p>
                </div>
              </div>
              <div class="pt-1">
                <a href="/api/impresion/descargar-auto-arranque" download="configurar_inicio_automatico.bat" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-sm transition-all">
                  <span>🚀</span> Descargar Configurador de Inicio Automático (.bat)
                </a>
              </div>
              <p class="text-[10px] text-emerald-700">Solo dale doble clic una vez y listo: se iniciará minimizado en segundo plano cada vez que enciendas tu equipo.</p>
            </div>

            <!-- Pasos de Instalación Normales -->
            <div class="space-y-2.5">
              <h4 class="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span>📁</span> Opciones de Ejecución Manual
              </h4>
              <div class="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px]">
                <p class="font-semibold text-slate-800">Opción A: Windows Nativo (Sin instalar nada, Cero márgenes)</p>
                <div class="flex flex-wrap gap-2 pt-0.5">
                  <a href="/api/impresion/descargar-windows-directo" download="imprimir_en_tienda_sin_instalar_nada.bat" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1 shadow-2xs">
                    <span>⚡</span> Descargar imprimir_en_tienda_sin_instalar_nada.bat
                  </a>
                </div>
                <div class="pt-2 border-t border-slate-200">
                  <p class="font-semibold text-slate-800">Opción B: Con Node.js (Si ya tienes Node instalado)</p>
                  <div class="flex flex-wrap gap-2 pt-1">
                    <a href="/api/impresion/descargar-agente" download="agente-impresion.js" class="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold flex items-center gap-1 shadow-2xs">
                      <span>📥</span> agente-impresion.js
                    </a>
                    <a href="/api/impresion/descargar-bat" download="iniciar_impresora.bat" class="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold flex items-center gap-1 shadow-2xs">
                      <span>⚡</span> iniciar_impresora.bat
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tip manual shell:startup -->
            <div class="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
              <p class="font-bold flex items-center gap-1"><span>💡</span> Si prefieres hacerlo tú mismo manualmente en Windows:</p>
              <p>Presiona <b>Windows + R</b> en el teclado, escribe <code>shell:startup</code> y dale Enter. Luego copia tu archivo <code>.bat</code> dentro de esa carpeta. ¡Windows lo abrirá automáticamente al iniciar!</p>
            </div>
          </div>

          <div class="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center gap-2 flex-wrap sm:flex-nowrap">
            <div class="flex items-center gap-2">
              <button onclick="ModuloVentas.verificarEstadoServidorImpresion(true)" class="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                <span>🔄</span> Actualizar
              </button>
              <button onclick="ModuloVentas.limpiarColaImpresion()" class="px-3 py-2 rounded-xl bg-rose-50 border border-rose-300 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer" title="Cancela cualquier ticket pendiente o trabado en la cola">
                <span>🧹</span> Limpiar Cola
              </button>
            </div>
            <button onclick="ModuloVentas.cerrarModalServidorImpresion()" class="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer">
              Cerrar
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

      <!-- MODAL PARA AGREGAR NUEVO PRODUCTO DESDE LA SECCIÓN DE PRECIOS -->
      <div id="modal-nuevo-producto-precios" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 hidden">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
          <div class="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">➕</span>
              <div>
                <h3 class="font-bold text-sm sm:text-base">Nuevo Producto en Base de Datos</h3>
                <p class="text-xs text-slate-400">Guarda en SQLite y se sincroniza en Firebase Firestore</p>
              </div>
            </div>
            <button type="button" onclick="ModuloVentas.cerrarModalNuevoProductoPrecios()" class="text-slate-400 hover:text-white text-xl font-bold cursor-pointer">✕</button>
          </div>

          <div class="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
            <!-- Nombre del Producto -->
            <div>
              <label class="block font-bold text-slate-800 mb-1">Nombre / Descripción del Artículo <span class="text-rose-500">*</span></label>
              <input type="text" id="prod-precios-nombre" placeholder="Ej: Vaso Domo 7oz Transparente x 50 un"
                     class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
            </div>

            <!-- SKU y Generador Automático -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="font-bold text-slate-800">SKU / Código</label>
                  <button type="button" onclick="ModuloVentas.generarSiguienteSKUPrecios()"
                          class="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer">
                    ⚡ Auto-generar
                  </button>
                </div>
                <input type="text" id="prod-precios-sku" placeholder="P001 o Código ERP"
                       class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-indigo-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>

              <div>
                <label class="block font-bold text-slate-800 mb-1">Código de Barras (Opcional)</label>
                <input type="text" id="prod-precios-barcode" placeholder="Escanear o escribir..."
                       class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
            </div>

            <!-- Categoría y Stock -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-800 mb-1">Categoría</label>
                <input type="text" id="prod-precios-categoria" value="General" placeholder="General, Vasos, Bolsas..."
                       class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label class="block font-bold text-slate-800 mb-1">Stock Inicial (Existencias)</label>
                <input type="number" id="prod-precios-stock" min="0" value="0"
                       class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
            </div>

            <!-- Los 3 Precios de Venta -->
            <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-3">
              <div class="flex items-center gap-2">
                <span class="text-base">🏷️</span>
                <div>
                  <h4 class="font-bold text-emerald-950 text-xs">Precios de Venta (3 Listas)</h4>
                  <p class="text-[11px] text-emerald-800">Define los precios para cobrar en POS o por mayor.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">Precio 1 (General) <span class="text-rose-500">*</span></label>
                  <div class="relative">
                    <span class="absolute left-2.5 inset-y-0 my-auto h-4 flex items-center text-emerald-700 font-bold">$</span>
                    <input type="number" id="prod-precios-p1" min="0" placeholder="0" oninput="ModuloVentas.autoSincronizarPreciosNuevos(this.value)"
                           class="w-full text-xs pl-6 pr-2 py-1.5 rounded-lg border border-emerald-300 bg-white font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">Precio 2</label>
                  <div class="relative">
                    <span class="absolute left-2.5 inset-y-0 my-auto h-4 flex items-center text-slate-500 font-bold">$</span>
                    <input type="number" id="prod-precios-p2" min="0" placeholder="0"
                           class="w-full text-xs pl-6 pr-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">Precio 3</label>
                  <div class="relative">
                    <span class="absolute left-2.5 inset-y-0 my-auto h-4 flex items-center text-slate-500 font-bold">$</span>
                    <input type="number" id="prod-precios-p3" min="0" placeholder="0"
                           class="w-full text-xs pl-6 pr-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <button type="button" onclick="ModuloVentas.cerrarModalNuevoProductoPrecios()"
                    class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer">
              Cancelar
            </button>
            <button type="button" id="btn-guardar-nuevo-prod-precios" onclick="ModuloVentas.guardarNuevoProductoPrecios()"
                    class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-transform">
              <span>💾</span> <span>Guardar en Base de Datos &amp; Firebase</span>
            </button>
          </div>
        </div>
      </div>
    `;

    await cargarConsecutivo();
    await cargarConfigFactura();
    await cargarConfigImpresora();
    cambiarSubtab(subtabActiva);
    iniciarListenerTecladoCodigoBarras();
    verificarEstadoServidorImpresion();
  }

  function onEnterTab() {
    cargarConsecutivo();
    cargarConfigFactura();
    cargarConfigImpresora();
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
      <!-- BARRA SUPERIOR DESTACADA DE FACTURACIÓN RÁPIDA (SOLO ESCRITORIO / TABLET) -->
      <div id="bar-facturacion-rapida" class="hidden lg:flex sticky top-14 z-30 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-4 rounded-2xl shadow-xl items-center justify-between flex-wrap gap-2.5 mb-4 border border-emerald-500/30 backdrop-blur-md">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-xl shrink-0">
            🧾
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-emerald-100 uppercase tracking-wider">Factura en Curso</span>
              <span id="pos-top-items-badge" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/25 text-white">
                ${carrito.length} ítems
              </span>
            </div>
            <div class="flex items-baseline gap-1.5 mt-0.5">
              <span class="text-xs text-emerald-100 font-medium">Total:</span>
              <span id="pos-top-txt-total" class="text-2xl font-black font-mono text-white tracking-tight">$ 0</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" onclick="ModuloVentas.vaciarCarrito()" 
                  class="px-3 py-2.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Vaciar carrito de factura">
            <span>🗑️</span> <span>Vaciar</span>
          </button>
          <button type="button" onclick="ModuloVentas.procesarVenta()"
                  id="btn-completar-factura-top"
                  class="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-sm rounded-xl shadow-lg transition-transform flex items-center gap-2 cursor-pointer">
            <span class="text-lg">⚡</span>
            <span>Facturar Ahora</span>
            <span id="pos-top-btn-total" class="font-mono bg-slate-950/15 px-2 py-0.5 rounded text-xs font-black">($ 0)</span>
          </button>
        </div>
      </div>

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

              <!-- DATOS DEL CLIENTE / FACTURAR A NOMBRE DE -->
              <div class="flex items-center gap-1.5 flex-1 max-w-md justify-end">
                <div class="relative flex-1">
                  <div class="flex gap-1 items-center">
                    <div class="relative flex-1">
                      <span class="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 text-xs pointer-events-none">👤</span>
                      <input type="text" id="pos-cliente-nombre" value="${clienteSeleccionado ? escapeHtml(clienteSeleccionado.nombre) : 'Consumidor Final'}"
                             placeholder="Buscar cliente o usuario..." autocomplete="off"
                             class="w-full pl-7 pr-6 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-medium text-slate-800" />
                      <button type="button" id="btn-pos-limpiar-cliente" onclick="ModuloVentas.restablecerConsumidorFinal()"
                              class="${clienteSeleccionado ? '' : 'hidden'} absolute right-1.5 inset-y-0 my-auto h-5 w-5 flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-full hover:bg-slate-200 text-xs cursor-pointer"
                              title="Restablecer a Consumidor Final">✕</button>
                    </div>
                    <button type="button" onclick="ModuloVentas.abrirModalNuevoClientePOS()"
                            class="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors shrink-0 cursor-pointer"
                            title="Registrar nuevo cliente">
                      <span>➕</span> <span class="hidden sm:inline">Nuevo</span>
                    </button>
                    <button type="button" onclick="abrirModalGestionClientes()"
                            class="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors shrink-0 cursor-pointer"
                            title="Directorio de clientes y usuarios">
                      <span>👥</span>
                    </button>
                  </div>
                  <!-- Dropdown de autocompletado para clientes y usuarios -->
                  <div id="pos-autocomplete-cliente"
                       class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto"></div>
                </div>
              </div>
            </div>

            <!-- BADGE DETALLE CLIENTE SELECCIONADO -->
            <div id="pos-cliente-badge-detalle" class="${clienteSeleccionado ? '' : 'hidden'} mt-2 bg-indigo-50 border border-indigo-200 text-indigo-950 px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 text-xs">
              <div class="flex items-center gap-1.5 truncate">
                <span class="font-bold text-indigo-700">🧾 Factura a nombre de:</span>
                <span id="pos-cliente-badge-nombre" class="font-bold">${clienteSeleccionado ? escapeHtml(clienteSeleccionado.nombre) : ''}</span>
                <span id="pos-cliente-badge-extra" class="text-slate-500 text-[11px] truncate">${clienteSeleccionado ? escapeHtml([clienteSeleccionado.empresa, clienteSeleccionado.telefono, clienteSeleccionado.direccion, clienteSeleccionado.ciudad].filter(Boolean).join(' · ')) : ''}</span>
              </div>
              <button type="button" onclick="ModuloVentas.restablecerConsumidorFinal()" class="text-indigo-600 hover:text-rose-600 font-bold text-[11px] underline shrink-0 cursor-pointer">
                Restablecer a General
              </button>
            </div>
          </div>

          <!-- BARRA DE BÚSQUEDA AUTO-COMPLETADO, CÓDIGO DE BARRAS Y SELECTOR VISIBLE DE CANTIDAD -->
          <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm relative space-y-2.5">
            <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              
              <!-- SELECTOR DE CANTIDAD VISIBLE -->
              <div class="flex items-center gap-1 bg-indigo-50/80 border border-indigo-200 p-1 rounded-xl shrink-0" title="Cantidad que se agregará al elegir o escanear un producto">
                <span class="text-[11px] font-black text-indigo-900 px-1 flex items-center gap-0.5">
                  <span>🔢</span> <span class="hidden xs:inline">Cant:</span>
                </span>
                <button type="button" onclick="ModuloVentas.ajustarCantidadEntrada(-1)"
                        class="w-7 h-8 bg-white hover:bg-indigo-100 text-indigo-900 font-black rounded-lg text-sm flex items-center justify-center border border-indigo-200 shadow-2xs active:scale-90 cursor-pointer select-none">
                  -
                </button>
                <input type="number" id="pos-input-cant" min="1" max="9999" value="1"
                       class="w-12 sm:w-14 text-center py-1 bg-white border border-indigo-200 rounded-lg text-sm font-black font-mono text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                <button type="button" onclick="ModuloVentas.ajustarCantidadEntrada(1)"
                        class="w-7 h-8 bg-white hover:bg-indigo-100 text-indigo-900 font-black rounded-lg text-sm flex items-center justify-center border border-indigo-200 shadow-2xs active:scale-90 cursor-pointer select-none">
                  +
                </button>
              </div>

              <!-- BUSCADOR -->
              <div class="relative flex-1 min-w-[200px]">
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
                      class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer">
                <span class="text-base">📷</span>
                <span class="hidden sm:inline">Escanear</span>
              </button>
            </div>

            <!-- CHIPS RÁPIDOS DE CANTIDAD -->
            <div class="flex items-center gap-1.5 text-[11px] text-slate-500 overflow-x-auto pb-0.5">
              <span class="font-bold text-[10px] uppercase tracking-wider text-slate-400 shrink-0">Cant. rápida:</span>
              <button type="button" onclick="ModuloVentas.fijarCantidadEntrada(1)" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 font-mono font-bold text-slate-700 transition-colors cursor-pointer">1 un</button>
              <button type="button" onclick="ModuloVentas.fijarCantidadEntrada(3)" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 font-mono font-bold text-slate-700 transition-colors cursor-pointer">3 un</button>
              <button type="button" onclick="ModuloVentas.fijarCantidadEntrada(6)" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 font-mono font-bold text-slate-700 transition-colors cursor-pointer">6 un</button>
              <button type="button" onclick="ModuloVentas.fijarCantidadEntrada(12)" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 font-mono font-bold text-slate-700 transition-colors cursor-pointer">12 (Docena)</button>
              <button type="button" onclick="ModuloVentas.fijarCantidadEntrada(24)" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 font-mono font-bold text-slate-700 transition-colors cursor-pointer">24 un</button>
              <button type="button" onclick="ModuloVentas.fijarCantidadEntrada(50)" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 font-mono font-bold text-slate-700 transition-colors cursor-pointer">50 un</button>
              <button type="button" onclick="ModuloVentas.fijarCantidadEntrada(100)" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 font-mono font-bold text-slate-700 transition-colors cursor-pointer">100 un</button>
            </div>

            <!-- MENÚ FLOTANTE DE RESULTADOS / AUTO-COMPLETADO -->
            <div id="pos-sugerencias-dropdown"
                 class="hidden absolute left-4 right-4 top-[85px] z-30 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto divide-y divide-slate-100">
              <!-- Renderizado dinámico de sugerencias -->
            </div>
          </div>

          <!-- TABLA DEL CARRITO DE LA FACTURA -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-16 lg:mb-0">
            <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-slate-700 uppercase tracking-wider">Productos en Factura</span>
                <span id="pos-items-count-badge" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700">
                  ${carrito.length} ítems
                </span>
              </div>
              <button type="button" onclick="ModuloVentas.vaciarCarrito()"
                      class="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer">
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
        <div class="lg:col-span-4 space-y-4 mb-20 lg:mb-0">

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
                        class="p-2 rounded-xl border text-xs font-bold text-center transition-all bg-emerald-50 border-emerald-500 text-emerald-800 cursor-pointer">
                  💵 Efectivo
                </button>
                <button type="button" onclick="ModuloVentas.seleccionarMetodoPago('TRANSFERENCIA')"
                        id="btn-pago-transferencia"
                        class="p-2 rounded-xl border text-xs font-bold text-center transition-all bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer">
                  📲 Transferencia
                </button>
                <button type="button" onclick="ModuloVentas.seleccionarMetodoPago('DATAFONO')"
                        id="btn-pago-datafono"
                        class="p-2 rounded-xl border text-xs font-bold text-center transition-all bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer">
                  💳 Datáfono
                </button>
                <button type="button" onclick="ModuloVentas.seleccionarMetodoPago('CREDITO')"
                        id="btn-pago-credito"
                        class="p-2 rounded-xl border text-xs font-bold text-center transition-all bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer">
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
                <button type="button" onclick="ModuloVentas.ponerEfectivoExacto()" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 cursor-pointer">Exacto</button>
                <button type="button" onclick="ModuloVentas.sumarEfectivo(10000)" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-mono font-bold text-slate-700 cursor-pointer">$10k</button>
                <button type="button" onclick="ModuloVentas.sumarEfectivo(20000)" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-mono font-bold text-slate-700 cursor-pointer">$20k</button>
                <button type="button" onclick="ModuloVentas.sumarEfectivo(50000)" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-mono font-bold text-slate-700 cursor-pointer">$50k</button>
                <button type="button" onclick="ModuloVentas.sumarEfectivo(100000)" class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-mono font-bold text-slate-700 cursor-pointer">$100k</button>
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

            <!-- BOTÓN PRINCIPAL FACTURAR EN COLUMNA DERECHA -->
            <button type="button" id="btn-completar-factura"
                    onclick="ModuloVentas.procesarVenta()"
                    class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
              <span class="text-lg">🧾</span>
              <span>Completar Venta &amp; Facturar</span>
            </button>
          </div>

        </div>

      </div>

      <!-- BARRA FLOTANTE / STICKY INFERIOR PARA VISTA DE CELULAR (NUNCA TENER QUE BAJAR) -->
      <div id="pos-mobile-bottom-bar" class="fixed bottom-[58px] left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-700 px-4 py-2.5 shadow-2xl flex items-center justify-between gap-3 block lg:hidden">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] uppercase font-bold text-slate-400 block leading-none">Total Factura</span>
            <span id="pos-mobile-items-badge" class="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-white/20 text-white">${carrito.length} ítems</span>
          </div>
          <span id="pos-mobile-txt-total" class="text-lg font-black font-mono text-emerald-400 leading-tight">$ 0</span>
        </div>
        <button type="button" onclick="ModuloVentas.procesarVenta()"
                class="flex-1 max-w-[210px] py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-transform">
          <span class="text-base">⚡</span>
          <span>Facturar Ahora</span>
        </button>
      </div>
    `;

    iniciarAutocompletadoPOS();
    iniciarAutocompletadoClientesPOS();
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
                ${it.editandoPrecio ? `
                  <div class="flex items-center justify-end gap-1">
                    <span class="text-xs font-bold text-slate-400">$</span>
                    <input type="number" min="0" id="inp-precio-cart-${idx}" value="${it.precio_unitario}"
                           onchange="ModuloVentas.guardarPrecioUnitarioItem(${idx}, this.value)"
                           onkeydown="if(event.key==='Enter'){ ModuloVentas.guardarPrecioUnitarioItem(${idx}, this.value); }"
                           class="w-20 text-right py-0.5 px-1.5 border-2 border-indigo-500 rounded-lg bg-indigo-50 text-indigo-900 font-mono font-bold text-xs focus:outline-none shadow-inner"
                           autofocus />
                    <button type="button" onclick="ModuloVentas.guardarPrecioUnitarioItem(${idx}, document.getElementById('inp-precio-cart-${idx}').value)"
                            class="p-1 rounded-lg bg-emerald-600 text-white font-bold text-xs cursor-pointer shadow-2xs hover:bg-emerald-700"
                            title="Confirmar precio">
                      ✓
                    </button>
                  </div>
                ` : `
                  <div class="flex items-center justify-end gap-1.5">
                    <span>$ ${formatMoney(it.precio_unitario)}</span>
                    <button type="button" onclick="ModuloVentas.toggleEditarPrecioItem(${idx})"
                            class="p-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs cursor-pointer transition-colors shadow-2xs"
                            title="Editar precio unitario de este producto directamente aquí">
                      ✏️
                    </button>
                  </div>
                `}
              </td>
              <td class="py-2.5 px-3 text-center">
                <div class="inline-flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                  <button type="button" onclick="ModuloVentas.modificarCantidad(${idx}, -1)"
                          title="Restar una unidad"
                          class="min-w-[32px] min-h-[32px] px-2 py-1 text-slate-700 hover:bg-slate-100 font-extrabold text-sm cursor-pointer select-none transition-colors active:bg-slate-200">-</button>
                  <input type="number" min="1" value="${it.cantidad}"
                         onchange="ModuloVentas.fijarCantidad(${idx}, this.value)"
                         class="w-14 text-center py-1 text-xs font-mono font-bold text-slate-900 border-x border-slate-200 focus:bg-indigo-50/50 focus:outline-none" />
                  <button type="button" onclick="ModuloVentas.modificarCantidad(${idx}, 1)"
                          title="Sumar una unidad"
                          class="min-w-[32px] min-h-[32px] px-2 py-1 text-slate-700 hover:bg-slate-100 font-extrabold text-sm cursor-pointer select-none transition-colors active:bg-slate-200">+</button>
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

            <!-- BUSCADOR Y ACCIONES EN EL CATÁLOGO DE PRECIOS -->
            <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <div class="relative w-full sm:w-72">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs">🔍</span>
                <input type="text" id="catalogo-precios-busq"
                       oninput="ModuloVentas.onFiltrarCatalogoPrecios(this.value)"
                       placeholder="Buscar por código, nombre o barcode..."
                       class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <button onclick="ModuloVentas.cargarCatalogoPrecios()"
                      title="Refrescar lista"
                      class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer">
                🔄
              </button>
              <button type="button" onclick="ModuloVentas.abrirModalNuevoProductoPrecios()"
                      class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-transform cursor-pointer shrink-0"
                      title="Crear un nuevo producto en la base de datos con sus 3 precios">
                <span>➕</span> <span>Nuevo Producto</span>
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

  function agregarProductoAlCarrito(prod, cantidadParam) {
    if (!prod) return;

    let cantAAgregar = 1;
    if (cantidadParam !== undefined && cantidadParam !== null && Number(cantidadParam) > 0) {
      cantAAgregar = Number(cantidadParam);
    } else {
      const inpCant = document.getElementById('pos-input-cant');
      const val = inpCant ? parseInt(inpCant.value, 10) : 1;
      cantAAgregar = (val && !isNaN(val) && val > 0) ? val : 1;
    }

    const p1 = Number(prod.precio_1) || Number(prod.precio) || 0;
    const p2 = Number(prod.precio_2) || p1;
    const p3 = Number(prod.precio_3) || p1;

    // Buscar si ya existe en el carrito
    const idx = carrito.findIndex(it => it.producto_id === prod.id || (it.sku && it.sku === prod.sku));

    if (idx !== -1) {
      carrito[idx].cantidad += cantAAgregar;
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
        cantidad: cantAAgregar,
        subtotal: Math.round(cantAAgregar * unitario),
        codigo_barras: prod.codigo_barras || ''
      });
    }

    if (typeof Sound !== 'undefined' && typeof Sound.beep === 'function') {
      Sound.beep();
    }

    // Restablecer el selector de cantidad visible a 1 para el próximo producto
    const inpCant = document.getElementById('pos-input-cant');
    if (inpCant) inpCant.value = '1';
    actualizarCantidadEnDropdown();

    renderTablaCarrito();
    actualizarTotales();
    limpiarBuscador();
    enfocarBuscador();
  }

  function ajustarCantidadEntrada(delta) {
    const inp = document.getElementById('pos-input-cant');
    if (!inp) return;
    let actual = parseInt(inp.value, 10) || 1;
    actual = Math.max(1, actual + delta);
    inp.value = actual;
    actualizarCantidadEnDropdown();
  }

  function fijarCantidadEntrada(n) {
    const inp = document.getElementById('pos-input-cant');
    if (!inp) return;
    inp.value = Math.max(1, parseInt(n, 10) || 1);
    actualizarCantidadEnDropdown();
  }

  function actualizarCantidadEnDropdown() {
    const inp = document.getElementById('pos-input-cant');
    const cant = inp ? (parseInt(inp.value, 10) || 1) : 1;
    const badges = document.querySelectorAll('.pos-sugg-cant-badge');
    badges.forEach(b => {
      b.textContent = `+${cant} un`;
    });
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

  function toggleEditarPrecioItem(idx) {
    if (!carrito[idx]) return;
    carrito[idx].editandoPrecio = !carrito[idx].editandoPrecio;
    renderTablaCarrito();
    if (carrito[idx].editandoPrecio) {
      setTimeout(() => {
        const inp = document.getElementById(`inp-precio-cart-${idx}`);
        if (inp) { inp.focus(); inp.select(); }
      }, 50);
    }
  }

  function guardarPrecioUnitarioItem(idx, val) {
    if (!carrito[idx]) return;
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      carrito[idx].precio_unitario = Math.round(num);
      carrito[idx].subtotal = Math.round(carrito[idx].cantidad * carrito[idx].precio_unitario);
    }
    carrito[idx].editandoPrecio = false;
    renderTablaCarrito();
    actualizarTotales();
    showToast(`Precio unitario actualizado`, 'success');
  }

  function editarPrecioItem(idx) {
    toggleEditarPrecioItem(idx);
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

    // Sincronizar barra superior destacada
    const topTot = document.getElementById('pos-top-txt-total');
    const topBtnTot = document.getElementById('pos-top-btn-total');
    const topBadge = document.getElementById('pos-top-items-badge');
    if (topTot) topTot.textContent = `$ ${formatMoney(total)}`;
    if (topBtnTot) topBtnTot.textContent = `($ ${formatMoney(total)})`;
    if (topBadge) topBadge.textContent = `${carrito.length} ítems`;

    // Sincronizar barra flotante inferior en celular
    const mobTot = document.getElementById('pos-mobile-txt-total');
    const mobBadge = document.getElementById('pos-mobile-items-badge');
    if (mobTot) mobTot.textContent = `$ ${formatMoney(total)}`;
    if (mobBadge) mobBadge.textContent = `${carrito.length} ítems`;

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
      const clienteId = clienteSeleccionado ? clienteSeleccionado.id : null;
      const clienteTel = clienteSeleccionado ? (clienteSeleccionado.telefono || '') : '';
      const clienteDir = clienteSeleccionado ? (clienteSeleccionado.direccion || '') : '';

      const payload = {
        cliente_id: clienteId,
        cliente_nombre: clienteNombre,
        cliente_telefono: clienteTel,
        cliente_direccion: clienteDir,
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
        restablecerConsumidorFinal();
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
  // GESTIÓN DE CLIENTES / FACTURAR A NOMBRE DE
  // ------------------------------------------------------------
  function iniciarAutocompletadoClientesPOS() {
    const input = document.getElementById('pos-cliente-nombre');
    const dropdown = document.getElementById('pos-autocomplete-cliente');
    if (!input || !dropdown) return;

    if (typeof attachAutocompleteClientes === 'function') {
      attachAutocompleteClientes(
        input,
        dropdown,
        (cliente) => {
          seleccionarClientePOS(cliente);
        },
        (clienteNuevo) => {
          seleccionarClientePOS(clienteNuevo);
        }
      );
    }
  }

  function seleccionarClientePOS(c) {
    if (!c) {
      restablecerConsumidorFinal();
      return;
    }

    clienteSeleccionado = {
      id: c.id || null,
      nombre: c.nombre || 'Consumidor Final',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      empresa: c.empresa || '',
      ciudad: c.ciudad || ''
    };

    const input = document.getElementById('pos-cliente-nombre');
    if (input) input.value = clienteSeleccionado.nombre;

    const btnLimpiar = document.getElementById('btn-pos-limpiar-cliente');
    if (btnLimpiar) btnLimpiar.classList.remove('hidden');

    const badgeDetalle = document.getElementById('pos-cliente-badge-detalle');
    const badgeNombre = document.getElementById('pos-cliente-badge-nombre');
    const badgeExtra = document.getElementById('pos-cliente-badge-extra');
    if (badgeDetalle && badgeNombre && badgeExtra) {
      badgeNombre.textContent = clienteSeleccionado.nombre;
      const extra = [clienteSeleccionado.empresa, clienteSeleccionado.telefono, clienteSeleccionado.direccion, clienteSeleccionado.ciudad].filter(Boolean).join(' · ');
      badgeExtra.textContent = extra ? `(${extra})` : '';
      badgeDetalle.classList.remove('hidden');
    }

    showToast(`Factura a nombre de "${clienteSeleccionado.nombre}"`, 'success');
  }

  function restablecerConsumidorFinal() {
    clienteSeleccionado = null;
    const input = document.getElementById('pos-cliente-nombre');
    if (input) input.value = 'Consumidor Final';

    const btnLimpiar = document.getElementById('btn-pos-limpiar-cliente');
    if (btnLimpiar) btnLimpiar.classList.add('hidden');

    const badgeDetalle = document.getElementById('pos-cliente-badge-detalle');
    if (badgeDetalle) badgeDetalle.classList.add('hidden');
  }

  function abrirModalNuevoClientePOS() {
    const input = document.getElementById('pos-cliente-nombre');
    const valorActual = (input && input.value !== 'Consumidor Final') ? input.value.trim() : '';
    if (typeof abrirModalNuevoCliente === 'function') {
      abrirModalNuevoCliente(valorActual, (nuevo) => {
        seleccionarClientePOS(nuevo);
      });
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
        posProductosSugeridos = [];
        posIndexSeleccionado = -1;
        return;
      }

      debounceBusq = setTimeout(async () => {
        try {
          const res = await apiFetch(`/ventas/productos-sugerencias?q=${encodeURIComponent(q)}`);
          if (res && res.ok && res.productos && res.productos.length > 0) {
            renderSugerenciasDropdown(res.productos);
          } else {
            posProductosSugeridos = [];
            posIndexSeleccionado = -1;
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

    // Navegación por teclado (Flecha abajo, Flecha arriba, Enter, Escape)
    input.addEventListener('keydown', async (e) => {
      const dropdownVisible = dropdown && !dropdown.classList.contains('hidden');

      if (e.key === 'ArrowDown') {
        if (dropdownVisible && posProductosSugeridos.length > 0) {
          e.preventDefault();
          posIndexSeleccionado = Math.min(posIndexSeleccionado + 1, posProductosSugeridos.length - 1);
          actualizarHighlightPOS();
        }
      } else if (e.key === 'ArrowUp') {
        if (dropdownVisible && posProductosSugeridos.length > 0) {
          e.preventDefault();
          posIndexSeleccionado = Math.max(posIndexSeleccionado - 1, 0);
          actualizarHighlightPOS();
        }
      } else if (e.key === 'Enter') {
        if (dropdownVisible && posIndexSeleccionado >= 0 && posProductosSugeridos[posIndexSeleccionado]) {
          e.preventDefault();
          agregarProductoPorId(posProductosSugeridos[posIndexSeleccionado]);
          posIndexSeleccionado = -1;
          return;
        }

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
        posIndexSeleccionado = -1;
      }
    });

    // Cerrar dropdown si se hace clic afuera
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
        posIndexSeleccionado = -1;
      }
    });
  }

  function actualizarHighlightPOS() {
    const items = document.querySelectorAll('.pos-sugg-item');
    items.forEach((item, idx) => {
      const activo = idx === posIndexSeleccionado;
      item.classList.toggle('bg-indigo-100', activo);
      item.classList.toggle('border-l-4', activo);
      item.classList.toggle('border-indigo-600', activo);
      if (activo) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function renderSugerenciasDropdown(productos) {
    const dropdown = document.getElementById('pos-sugerencias-dropdown');
    if (!dropdown) return;

    posProductosSugeridos = productos;
    posIndexSeleccionado = -1;

    const inpCant = document.getElementById('pos-input-cant');
    const cantActual = inpCant ? (parseInt(inpCant.value, 10) || 1) : 1;

    dropdown.innerHTML = productos.map((p, idx) => {
      const p1 = Number(p.precio_1) || Number(p.precio) || 0;
      const p2 = Number(p.precio_2) || p1;
      const p3 = Number(p.precio_3) || p1;

      return `
        <div data-pos-idx="${idx}"
             onclick='ModuloVentas.agregarProductoPorId(${JSON.stringify(p).replace(/'/g, "&apos;")})'
             class="pos-sugg-item p-3 hover:bg-indigo-50/90 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
          
          <div class="space-y-1 flex-1 pr-2">
            <!-- Nombre Completo Sin Recortar / Truncar -->
            <div class="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug break-words">
              ${escapeHtml(p.nombre)}
            </div>
            <div class="flex items-center flex-wrap gap-2 text-[11px] text-slate-500 font-mono">
              <span class="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">${escapeHtml(p.sku)}</span>
              ${p.codigo_barras ? `<span class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">🏷️ ${escapeHtml(p.codigo_barras)}</span>` : ''}
              <span class="px-1.5 py-0.5 rounded font-bold ${p.stock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}">
                Stock: ${p.stock}
              </span>
            </div>
          </div>

          <div class="text-right flex-shrink-0 flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <div class="space-y-0.5">
              <div class="font-black font-mono text-emerald-700 text-sm">
                $ ${formatMoney(p1)}
                <span class="text-[9px] text-slate-400 font-sans font-normal">(P1)</span>
              </div>
              <div class="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 justify-end">
                <span>P2: $${formatMoney(p2)}</span>
                <span>• P3: $${formatMoney(p3)}</span>
              </div>
            </div>
            <span class="pos-sugg-cant-badge px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs shrink-0">
              +${cantActual} un
            </span>
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
      // Verificar si el módulo de ventas está activo en pantalla
      const viewVentas = document.getElementById('view-ventas');
      if (!viewVentas || viewVentas.classList.contains('hidden')) return;

      const key = (e.key || '').toUpperCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;

      // 1. Facturar / Completar Venta: Ctrl + P, F2, Ctrl + Enter
      if ((ctrl && key === 'P') || e.key === 'F2' || (ctrl && e.key === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        if (subtabActiva === 'pos') {
          procesarVenta();
        }
        return;
      }

      // 2. Ir al Buscador: Ctrl + F, F4
      if ((ctrl && key === 'F') || e.key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        if (subtabActiva === 'pos') {
          enfocarBuscador();
        }
        return;
      }

      // 3. Efectivo Exacto: Ctrl + E, F9
      if ((ctrl && key === 'E') || e.key === 'F9') {
        e.preventDefault();
        e.stopPropagation();
        if (subtabActiva === 'pos') {
          ponerEfectivoExacto();
        }
        return;
      }

      // 4. Alternar Método de Pago: F8, Ctrl + M
      if (e.key === 'F8' || (ctrl && key === 'M')) {
        e.preventDefault();
        e.stopPropagation();
        if (subtabActiva === 'pos') {
          const metodos = ['EFECTIVO', 'TRANSFERENCIA', 'DATAFONO', 'CREDITO'];
          const idxActual = metodos.indexOf(metodoPagoSeleccionado);
          const sigMetodo = metodos[(idxActual + 1) % metodos.length];
          seleccionarMetodoPago(sigMetodo);
          showToast(`Método de pago cambiado a: ${sigMetodo}`, 'info');
        }
        return;
      }

      // 5. Vaciar Carrito: Alt + V o Ctrl + Delete
      if ((alt && key === 'V') || (ctrl && e.key === 'Delete')) {
        e.preventDefault();
        e.stopPropagation();
        if (subtabActiva === 'pos') {
          vaciarCarrito();
        }
        return;
      }

      // 6. Cambiar Lista de Precios: Alt + 1, Alt + 2, Alt + 3
      if (alt && (key === '1' || key === '2' || key === '3')) {
        e.preventDefault();
        e.stopPropagation();
        if (subtabActiva === 'pos') {
          seleccionarListaPreciosGlobal(`precio_${key}`);
        }
        return;
      }

      // 7. Abrir Guía de Atajos de Teclado: F1 o Ctrl + H
      if (e.key === 'F1' || (ctrl && key === 'H')) {
        e.preventDefault();
        e.stopPropagation();
        abrirModalAyudaAtajosPOS();
        return;
      }

      // Si el foco está en un input que no sea el buscador, no acumular buffer de código de barras
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
                  <div class="text-emerald-300 text-[10px]">Precios Modificados</div>
                  <div class="font-mono font-bold text-emerald-400">${res.stats.productos_actualizados}</div>
                </div>
                <div class="bg-black/20 p-2 rounded-lg">
                  <div class="text-slate-400 text-[10px]">Al día (Sin cambio)</div>
                  <div class="font-mono font-bold text-slate-300">${res.stats.precios_sin_cambio || 0}</div>
                </div>
                <div class="bg-amber-950/40 border border-amber-500/30 p-2 rounded-lg">
                  <div class="text-amber-300 text-[10px]">No encontrados</div>
                  <div class="font-mono font-bold text-amber-300">${res.stats.no_encontrados}</div>
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

              ${res.muestra_no_encontrados && res.muestra_no_encontrados.length > 0 ? (() => {
                ultimosNoEncontrados = res.muestra_no_encontrados;
                return `
                  <div id="box-no-encontrados-precios" class="mt-3 p-3 bg-amber-500/15 border border-amber-400/30 rounded-xl space-y-2.5">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                      <span class="font-bold text-[11px] text-amber-300 flex items-center gap-1.5">
                        <span>⚠️</span> <span>${res.stats.no_encontrados} producto(s) en el archivo no existen en la base de datos:</span>
                      </span>
                      <button type="button" id="btn-agregar-todos-no-encontrados" onclick="ModuloVentas.agregarTodosNoEncontradosBD()"
                              class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5">
                        <span>⚡</span> <span>Agregar TODOS a la BD</span>
                      </button>
                    </div>
                    <p class="text-[11px] text-slate-300">Haz clic en <strong>Agregar TODOS a la BD</strong> para registrarlos al instante con los precios del archivo (sin código de barras):</p>
                    <div class="max-h-48 overflow-y-auto divide-y divide-white/10 rounded-lg bg-black/40 p-2 font-mono text-[11px]">
                      ${res.muestra_no_encontrados.map(ne => {
                        const nomEsc = escapeHtml(ne.articulo || ne.codigo || 'Sin nombre');
                        const codEsc = escapeHtml(ne.codigo || '');
                        const p1 = Number(ne.precio_1) || 0;
                        const p2 = Number(ne.precio_2) || p1;
                        const p3 = Number(ne.precio_3) || p2;
                        return `
                          <div class="py-1.5 flex items-center justify-between gap-2">
                            <div class="truncate text-slate-200">
                              <strong>${nomEsc}</strong> ${codEsc ? `<span class="text-slate-400 font-mono">(${codEsc})</span>` : ''}
                              <span class="text-emerald-300 text-[10px] ml-1">P1: $${formatMoney(p1)} | P2: $${formatMoney(p2)}</span>
                            </div>
                            <button type="button" onclick="ModuloVentas.abrirModalNuevoProductoPrecios('${nomEsc}', '${codEsc}', '', ${p1}, ${p2}, ${p3})"
                                    class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shrink-0 cursor-pointer transition-transform active:scale-95">
                              ➕ Agregar a la BD
                            </button>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              })() : ''}
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
  let busquedaCatalogoActual = '';

  async function cargarCatalogoPrecios(query = '') {
    busquedaCatalogoActual = query;
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
      cont.innerHTML = `
        <div class="py-12 px-4 text-center space-y-3 bg-slate-50/70 rounded-2xl border border-dashed border-slate-300">
          <div class="text-3xl">🔍</div>
          <p class="text-sm font-semibold text-slate-700">
            ${busquedaCatalogoActual 
              ? `No se encontró ningún producto con "<strong>${escapeHtml(busquedaCatalogoActual)}</strong>"` 
              : 'No hay productos en el catálogo de precios'}
          </p>
          <p class="text-xs text-slate-400 max-w-sm mx-auto">
            ¿El producto aún no existe en el sistema? Puedes agregarlo ahora mismo con sus listas de precios P1, P2 y P3.
          </p>
          <button type="button" onclick="ModuloVentas.abrirModalNuevoProductoPrecios('${escapeHtml(busquedaCatalogoActual || '')}')"
                  class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer">
            <span>➕</span> <span>Agregar ${busquedaCatalogoActual ? `"${escapeHtml(busquedaCatalogoActual)}"` : 'Nuevo Producto'} a la Base de Datos</span>
          </button>
        </div>
      `;
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

  function abrirModalNuevoProductoPrecios(nombreSug = '', skuSug = '', barcodeSug = '', p1Sug = 0, p2Sug = 0, p3Sug = 0) {
    const modal = document.getElementById('modal-nuevo-producto-precios');
    if (!modal) return;

    const inpNombre = document.getElementById('prod-precios-nombre');
    const inpSku = document.getElementById('prod-precios-sku');
    const inpBarcode = document.getElementById('prod-precios-barcode');
    const inpCat = document.getElementById('prod-precios-categoria');
    const inpStock = document.getElementById('prod-precios-stock');
    const inpP1 = document.getElementById('prod-precios-p1');
    const inpP2 = document.getElementById('prod-precios-p2');
    const inpP3 = document.getElementById('prod-precios-p3');

    if (inpNombre) inpNombre.value = nombreSug || '';
    if (inpSku) {
      if (skuSug) {
        inpSku.value = skuSug;
      } else {
        // Generar SKU preliminar
        const nextId = (catalogoPrecios.length > 0 ? Math.max(...catalogoPrecios.map(p => p.id || 0)) : 100) + 1;
        inpSku.value = `P${String(nextId).padStart(4, '0')}`;
      }
    }
    // Por el apartado de ventas no se agregan códigos de barras por el momento
    if (inpBarcode) inpBarcode.value = '';
    if (inpCat) inpCat.value = 'General';
    if (inpStock) inpStock.value = '0';
    if (inpP1) inpP1.value = p1Sug > 0 ? p1Sug : '';
    if (inpP2) inpP2.value = p2Sug > 0 ? p2Sug : (p1Sug > 0 ? p1Sug : '');
    if (inpP3) inpP3.value = p3Sug > 0 ? p3Sug : (p1Sug > 0 ? p1Sug : '');

    modal.classList.remove('hidden');
    setTimeout(() => inpNombre?.focus(), 100);
  }

  function cerrarModalNuevoProductoPrecios() {
    const modal = document.getElementById('modal-nuevo-producto-precios');
    if (modal) modal.classList.add('hidden');
  }

  async function generarSiguienteSKUPrecios() {
    try {
      const res = await apiFetch('/productos/siguiente-sku');
      if (res && res.ok && res.sku) {
        const inpSku = document.getElementById('prod-precios-sku');
        if (inpSku) inpSku.value = res.sku;
      }
    } catch (_) {
      const inpSku = document.getElementById('prod-precios-sku');
      if (inpSku) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        inpSku.value = `P${rand}`;
      }
    }
  }

  function autoSincronizarPreciosNuevos(val) {
    const p1 = parseFloat(val) || 0;
    const inpP2 = document.getElementById('prod-precios-p2');
    const inpP3 = document.getElementById('prod-precios-p3');
    if (inpP2 && (!inpP2.value || inpP2.value === '0')) inpP2.value = p1;
    if (inpP3 && (!inpP3.value || inpP3.value === '0')) inpP3.value = p1;
  }

  async function guardarNuevoProductoPrecios() {
    const nombre = document.getElementById('prod-precios-nombre')?.value.trim() || '';
    const sku = document.getElementById('prod-precios-sku')?.value.trim() || '';
    // Por la parte de ventas no se agregan códigos de barras por el momento
    const codigo_barras = '';
    const categoria = document.getElementById('prod-precios-categoria')?.value.trim() || 'General';
    const stock = parseInt(document.getElementById('prod-precios-stock')?.value, 10) || 0;
    const precio_1 = parseFloat(document.getElementById('prod-precios-p1')?.value) || 0;
    const precio_2 = parseFloat(document.getElementById('prod-precios-p2')?.value) || precio_1;
    const precio_3 = parseFloat(document.getElementById('prod-precios-p3')?.value) || precio_2;

    if (!nombre) {
      showToast('El nombre del producto es obligatorio.', 'error');
      document.getElementById('prod-precios-nombre')?.focus();
      return;
    }

    const btn = document.getElementById('btn-guardar-nuevo-prod-precios');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Guardando...</span>';
    }

    try {
      // 1. Guardar en SQLite (backend)
      const res = await apiFetch('/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          nombre,
          categoria,
          stock,
          precio: precio_1,
          precio_1,
          precio_2,
          precio_3,
          codigo_barras
        })
      });

      if (res && res.ok && res.data) {
        const prodCreado = res.data;

        // 2. Sincronizar de inmediato en Firebase Firestore si está activo
        if (window.FirebaseClient?.guardarProducto) {
          try {
            await window.FirebaseClient.guardarProducto(prodCreado);
          } catch (e) {
            console.warn('[Firebase] Error guardando nuevo producto:', e);
          }
        }

        showToast(`¡Producto "${prodCreado.nombre}" creado con éxito!`, 'success');
        cerrarModalNuevoProductoPrecios();
        cargarCatalogoPrecios(busquedaCatalogoActual);
      } else {
        showToast(res?.error || 'Error al crear el producto en la base de datos', 'error');
      }
    } catch (e) {
      showToast('Error de red al guardar el producto', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>💾</span> <span>Guardar en Base de Datos &amp; Firebase</span>';
      }
    }
  }

  async function agregarTodosNoEncontradosBD() {
    if (!ultimosNoEncontrados || !ultimosNoEncontrados.length) {
      showToast('No hay productos pendientes por agregar.', 'info');
      return;
    }

    const btn = document.getElementById('btn-agregar-todos-no-encontrados');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Guardando productos...</span>';
    }

    try {
      const res = await apiFetch('/productos/crear-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productos: ultimosNoEncontrados,
          sin_barcodes: true
        })
      });

      if (res && res.ok && res.creados) {
        const creados = res.creados;

        // Sincronizar en Firebase Firestore
        if (window.FirebaseClient?.guardarProducto) {
          for (const p of creados) {
            try {
              await window.FirebaseClient.guardarProducto(p);
            } catch (_) {}
          }
        }

        showToast(`¡Se agregaron ${creados.length} productos a la Base de Datos y Firebase!`, 'success');
        ultimosNoEncontrados = [];

        const boxNe = document.getElementById('box-no-encontrados-precios');
        if (boxNe) boxNe.classList.add('hidden');

        cargarCatalogoPrecios();
      } else {
        showToast(res?.error || 'Error al agregar productos en lote', 'error');
      }
    } catch (e) {
      showToast('Error de red al agregar productos', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡</span> <span>Agregar TODOS a la BD</span>';
      }
    }
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
          <td style="text-align: left; padding: 2px 0; vertical-align: top; word-break: break-word; font-size: 10px;">
            ${escapeHtml(it.nombre_producto)}
            ${c.mostrarSku && it.sku ? `<br><small style="font-size: 8px; color: #555;">SKU: ${escapeHtml(it.sku)}</small>` : ''}
          </td>
          <td style="text-align: center; vertical-align: top; padding: 2px 0; font-size: 10px;">${cantidad}</td>
          ${c.mostrarPrecioUnitario ? `
            <td style="text-align: right; vertical-align: top; padding: 2px 0; white-space: nowrap; font-size: 10px;">$${formatMoney(precioUnitario)}</td>
          ` : ''}
          <td style="text-align: right; vertical-align: top; padding: 2px 0; white-space: nowrap; font-size: 10px;">$${formatMoney(itemSubtotal)}</td>
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
            <img src="${c.urlLogo || '/img/Logo.png'}" style="max-width: 44mm; max-height: 22mm; margin: 0 auto 4px auto; display: block;" alt="Logo" onerror="this.style.display='none';" />
          ` : ''}
          ${c.mostrarNombreNegocio && c.nombreNegocio ? `
            <p style="font-weight: bold; font-size: 14px; margin: 0; text-transform: uppercase;">${escapeHtml(c.nombreNegocio)}</p>
          ` : ''}
          ${c.mostrarRazonSocial && c.razonSocial ? `
            <p style="margin: 2px 0; font-size: 10.5px;">${escapeHtml(c.razonSocial)}</p>
          ` : ''}
          ${c.mostrarNit && c.nitNegocio ? `
            <p style="margin: 2px 0; font-size: 10.5px;">${escapeHtml(c.nitNegocio)}</p>
          ` : ''}
          ${c.mostrarDireccion && c.direccionNegocio ? `
            <p style="margin: 2px 0; font-size: 10.5px;">${escapeHtml(c.direccionNegocio)}</p>
          ` : ''}
          ${c.mostrarTelefono && c.telefonoNegocio ? `
            <p style="margin: 2px 0; font-size: 10.5px;">Tel: ${escapeHtml(c.telefonoNegocio)}</p>
          ` : ''}
          ${c.mostrarCiudad && c.ciudadNegocio ? `
            <p style="margin: 2px 0; font-size: 10.5px;">${escapeHtml(c.ciudadNegocio)}</p>
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
      <div id="ticket-print-area" style="font-family: 'Courier New', Courier, monospace; font-size: 10.5px; line-height: 1.25; color: #000; width: 100%; max-width: 290px; margin: 0 auto; background: #fff; padding: 2px; box-sizing: border-box;">
        ${htmlCabecera}
        ${htmlDatosVenta}

        <table style="width: 100%; border-collapse: collapse; margin: 4px 0; table-layout: fixed;">
          <thead>
            <tr>
              <th style="border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; text-align: left; width: 44%;">DESCRIPCIÓN</th>
              <th style="border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; text-align: center; width: 14%;">CANT</th>
              ${c.mostrarPrecioUnitario ? `
                <th style="border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; text-align: right; width: 21%; white-space: nowrap;">VR.UNI</th>
              ` : ''}
              <th style="border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; text-align: right; width: ${c.mostrarPrecioUnitario ? '21%' : '42%'}; white-space: nowrap;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${filasItems}
          </tbody>
        </table>

        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

        <table style="width: 100%; margin-top: 4px; border-collapse: collapse;">
          ${c.mostrarSubtotalDescuento && descuento > 0 ? `
            <tr>
              <td style="font-size: 10px; padding: 1px 0;">Subtotal:</td>
              <td style="text-align: right; font-size: 10px; padding: 1px 0; white-space: nowrap;">$${formatMoney(subtotal)}</td>
            </tr>
            <tr>
              <td style="font-size: 10px; padding: 1px 0;">Descuento:</td>
              <td style="text-align: right; font-size: 10px; padding: 1px 0; white-space: nowrap;">-$${formatMoney(descuento)}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="font-weight: bold; font-size: 11px; padding: 2px 0;">VALOR A PAGAR:</td>
            <td style="text-align: right; font-weight: bold; font-size: 12px; padding: 2px 0; white-space: nowrap;">$${formatMoney(totalFactura)}</td>
          </tr>
          ${c.mostrarMetodoPago ? `
            <tr>
              <td style="padding-top: 2px; font-size: 10px;">Forma de Pago:</td>
              <td style="text-align: right; padding-top: 2px; font-size: 10px; white-space: nowrap;">${escapeHtml(formaPago)}</td>
            </tr>
          ` : ''}
          ${c.mostrarCambio && formaPago === 'EFECTIVO' ? `
            <tr>
              <td style="padding-top: 1px; font-size: 10px;">Monto Recibido:</td>
              <td style="text-align: right; padding-top: 1px; font-size: 10px; white-space: nowrap;">$${formatMoney(f.monto_recibido || totalFactura)}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding-top: 1px; font-size: 10px;">Cambio / Devuelta:</td>
              <td style="text-align: right; font-weight: bold; padding-top: 1px; font-size: 10px; white-space: nowrap;">$${formatMoney(f.cambio || 0)}</td>
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

  function ajustarCopiasImpresion(delta) {
    const inp = document.getElementById('ticket-input-copias');
    if (!inp) return;
    let actual = parseInt(inp.value, 10) || 1;
    actual = Math.min(10, Math.max(1, actual + delta));
    inp.value = actual;
  }

  function fijarCopiasImpresion(val) {
    const inp = document.getElementById('ticket-input-copias');
    if (!inp) return;
    let actual = parseInt(val, 10) || 1;
    inp.value = Math.min(10, Math.max(1, actual));
  }

  function imprimirTicketDirecto(facturaCustom) {
    const f = facturaCustom || ultimaFacturaCreada;
    if (!f) return;

    const inpCopias = document.getElementById('ticket-input-copias');
    const copias = Math.min(10, Math.max(1, parseInt(inpCopias ? inpCopias.value : '1', 10) || 1));

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

    const c = Object.assign({}, CONFIG_FACTURA_DEFAULT, configFactura);
    const es58 = (c.tamanoPapel === '58mm');
    const papelSize = es58 ? '58mm auto' : '80mm auto';
    // Para 80mm con margen físico de 4mm a cada lado, el ancho útil es 72mm max.
    // Usamos 64mm centrados con margen lateral de 4mm para garantizar 100% que no se corte ningún precio ni borde.
    const anchoContenido = es58 ? '44mm' : '64mm';
    const margenLat = c.margenLateral || '4mm';

    const ticketHtml = generarHtmlTicketInterno(f, configFactura);

    // Multiplicar por el número de copias seleccionadas
    let cuerpoMultiplesCopias = '';
    for (let i = 0; i < copias; i++) {
      cuerpoMultiplesCopias += `
        <div class="ticket-copia-item" style="${i < copias - 1 ? 'page-break-after: always; break-after: page; margin-bottom: 25px;' : ''}">
          ${copias > 1 ? `<div style="text-align: center; font-size: 8px; color: #555; margin-bottom: 3px; font-weight: bold;">-- COPIA ${i + 1} DE ${copias} --</div>` : ''}
          ${ticketHtml}
        </div>
      `;
    }

    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Factura POS - ${escapeHtml(f.numero_factura || 'Venta')}${copias > 1 ? ` (${copias} copias)` : ''}</title>
        <style>
          @page {
            margin: 0;
            size: ${papelSize};
          }
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: #fff;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 10px;
            color: #000;
            line-height: 1.22;
            padding: 2mm ${margenLat} !important;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .ticket-copia-item {
            width: 100% !important;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          #ticket-print-area {
            width: 100% !important;
            max-width: ${anchoContenido} !important;
            padding: 0 1mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse;
          }
          td, th {
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        ${cuerpoMultiplesCopias}
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
    const es58 = (c.tamanoPapel === '58mm');
    // Ancho seguro con 4mm de margen a lado y lado: 38 columnas para 80mm, 30 para 58mm
    const ancho = es58 ? 30 : 38;
    const sep = '='.repeat(ancho);
    const lin = '-'.repeat(ancho);

    let t = '';

    // Etiqueta de control para que el servidor de impresión imprima el logo si está activo
    if (c.mostrarLogo) {
      t += '[[IMPRIMIR_LOGO]]\n';
    }

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
    if (es58) {
      if (c.mostrarPrecioUnitario) {
        t += 'DESCRIPCION   CANT VR.UNI  TOTAL\n';
      } else {
        t += 'DESCRIPCION         CANT   TOTAL\n';
      }
    } else {
      if (c.mostrarPrecioUnitario) {
        t += 'DESCRIPCION      CANT  VR.UNI    TOTAL\n';
      } else {
        t += 'DESCRIPCION                 CANT   TOTAL\n';
      }
    }
    t += lin + '\n';

    items.forEach(it => {
      if (es58) {
        if (c.mostrarPrecioUnitario) {
          const nom = (it.nombre_producto || 'Producto').substring(0, 11).padEnd(11, ' ');
          const cant = String(it.cantidad || 1).padStart(4, ' ');
          const uni = String(Math.round(it.precio_unitario || 0)).padStart(6, ' ');
          const sub = String(Math.round(it.subtotal || 0)).padStart(6, ' ');
          t += `${nom} ${cant} ${uni} ${sub}\n`;
        } else {
          const nom = (it.nombre_producto || 'Producto').substring(0, 16).padEnd(16, ' ');
          const cant = String(it.cantidad || 1).padStart(4, ' ');
          const sub = String(Math.round(it.subtotal || 0)).padStart(8, ' ');
          t += `${nom} ${cant} ${sub}\n`;
        }
      } else {
        if (c.mostrarPrecioUnitario) {
          const nom = (it.nombre_producto || 'Producto').substring(0, 16).padEnd(16, ' ');
          const cant = String(it.cantidad || 1).padStart(4, ' ');
          const uni = String(Math.round(it.precio_unitario || 0)).padStart(7, ' ');
          const sub = String(Math.round(it.subtotal || 0)).padStart(8, ' ');
          t += `${nom} ${cant} ${uni} ${sub}\n`;
        } else {
          const nom = (it.nombre_producto || 'Producto').substring(0, 22).padEnd(22, ' ');
          const cant = String(it.cantidad || 1).padStart(4, ' ');
          const sub = String(Math.round(it.subtotal || 0)).padStart(10, ' ');
          t += `${nom} ${cant} ${sub}\n`;
        }
      }
      if (c.mostrarSku && it.sku) {
        t += `  * SKU: ${it.sku}\n`;
      }
    });

    t += sep + '\n';
    const total = Math.round(Number(f.total) || 0);
    const subtotal = Math.round(Number(f.subtotal) || total);
    const descuento = Math.round(Number(f.descuento) || 0);

    const alinearMoneda = (label, valor) => {
      const v = '$ ' + formatMoney(valor);
      const l = label.padEnd(ancho - v.length, ' ');
      return l + v + '\n';
    };

    if (c.mostrarSubtotalDescuento && descuento > 0) {
      t += alinearMoneda('SUBTOTAL:', subtotal);
      t += alinearMoneda('DESCUENTO:', -descuento);
    }
    t += alinearMoneda('VALOR A PAGAR:', total);
    if (c.mostrarMetodoPago) {
      t += `Forma de Pago:     ${f.metodo_pago || 'EFECTIVO'}\n`;
    }
    if (c.mostrarCambio && f.metodo_pago === 'EFECTIVO') {
      const rec = Math.round(Number(f.monto_recibido) || total);
      const cam = Math.round(Number(f.cambio) || 0);
      t += alinearMoneda('Recibido:', rec);
      t += alinearMoneda('Cambio:', cam);
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
      // 1. Intentar cargar desde Firebase Firestore primero
      if (window.FirebaseClient?.obtenerConfiguracion) {
        try {
          const fbConfig = await window.FirebaseClient.obtenerConfiguracion('factura');
          if (fbConfig) {
            const { tipo, updated_at, ...datosLimpios } = fbConfig;
            configFactura = Object.assign({}, CONFIG_FACTURA_DEFAULT, datosLimpios);
            localStorage.setItem('jispi_config_factura', JSON.stringify(configFactura));
            console.log('[Factura] Formato cargado de Firebase Firestore.');
            return;
          }
        } catch (_) {}
      }

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

      <!-- SECCIÓN 0: ANCHO DE ROLLO Y MÁRGENES DE SEGURIDAD -->
      <div class="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🖨️</span>
            <div>
              <h4 class="font-bold text-xs uppercase tracking-wider text-indigo-950">Ancho de Rollo Térmico (Impresora POS)</h4>
              <p class="text-[11px] text-indigo-700">Ajusta las columnas para que el ticket ocupe todo el ancho de tu papel sin partir palabras.</p>
            </div>
          </div>
          <div class="inline-flex rounded-xl p-1 bg-white border border-indigo-200 shadow-2xs">
            <button type="button" onclick="window.JispiVentas.cambiarTamanoPapel('80mm')" class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${configFacturaTemp.tamanoPapel !== '58mm' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}">
              Rollo 80 mm (Estándar)
            </button>
            <button type="button" onclick="window.JispiVentas.cambiarTamanoPapel('58mm')" class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${configFacturaTemp.tamanoPapel === '58mm' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}">
              Rollo 58 mm (Compacto)
            </button>
          </div>
        </div>

        <div class="pt-2 border-t border-indigo-200/60 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <span class="font-bold text-xs text-indigo-950">Margen lateral físico (A lado y lado):</span>
            <p class="text-[11px] text-indigo-700">Evita que el cabezal de la impresora corte los bordes o los precios a la derecha.</p>
          </div>
          <div class="inline-flex rounded-xl p-1 bg-white border border-indigo-200 shadow-2xs">
            <button type="button" onclick="window.JispiVentas.cambiarMargenLateral('3mm')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${configFacturaTemp.margenLateral === '3mm' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">
              3 mm
            </button>
            <button type="button" onclick="window.JispiVentas.cambiarMargenLateral('4mm')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${(!configFacturaTemp.margenLateral || configFacturaTemp.margenLateral === '4mm') ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">
              4 mm (Predeterminado)
            </button>
            <button type="button" onclick="window.JispiVentas.cambiarMargenLateral('5mm')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${configFacturaTemp.margenLateral === '5mm' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">
              5 mm
            </button>
          </div>
        </div>
      </div>

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

  function cambiarTamanoPapel(tam) {
    if (!configFacturaTemp) return;
    configFacturaTemp.tamanoPapel = tam;
    renderControlesConfigTicket();
    renderPreviewConfigTicket();
  }

  function cambiarMargenLateral(margen) {
    if (!configFacturaTemp) return;
    configFacturaTemp.margenLateral = margen;
    renderControlesConfigTicket();
    renderPreviewConfigTicket();
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

        // Guardar configuración de factura directamente en Firebase Firestore
        if (window.FirebaseClient?.guardarConfiguracion) {
          try {
            await window.FirebaseClient.guardarConfiguracion('factura', configFactura);
            console.log('[Factura] Formato guardado en Firebase Firestore.');
          } catch (e) {
            console.warn('[Firebase Factura]', e);
          }
        }

        showToast('✓ Formato de factura guardado exitosamente en Firebase y en el sistema.', 'success');
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

  let enviandoImpresion = false;
  async function enviarAImpresoraTienda(facturaCustom) {
    if (enviandoImpresion) {
      showToast('Ya se está procesando el envío a la impresora...', 'info');
      return;
    }

    const f = facturaCustom || ultimaFacturaCreada;
    if (!f) {
      showToast('No hay ninguna factura activa para imprimir.', 'error');
      return;
    }

    enviandoImpresion = true;
    setTimeout(() => { enviandoImpresion = false; }, 3000);

    const inpCopias = document.getElementById('ticket-input-copias');
    const copias = Math.min(10, Math.max(1, parseInt(inpCopias ? inpCopias.value : '1', 10) || 1));

    const textoPlano = generarTextoPlanoTicket(f);
    showToast(`Enviando ${copias > 1 ? `${copias} copias` : 'factura'} a la impresora física de la tienda...`, 'info');

    try {
      const res = await apiFetch('/impresion/encolar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'VENTA',
          referencia_id: f.id,
          numero_factura: f.numero_factura,
          contenido_ticket: textoPlano,
          usuario_nombre: f.usuario_nombre,
          copias: copias,
          forzar: copias > 1
        })
      });

      if (res && res.ok) {
        if (res.duplicado) {
          showToast(`ℹ️ Factura ${f.numero_factura} ya estaba enviada. Si deseas otra copia, aumenta a 2 copias.`, 'info');
        } else {
          showToast(res.mensaje || `✓ ${copias} copia(s) de factura ${f.numero_factura} enviadas a la tienda.`, 'success');
        }
      } else {
        showToast(res?.error || 'Error al enviar a la impresora de la tienda.', 'error');
      }
    } catch (err) {
      showToast('Error de red al enviar la impresión.', 'error');
    }
  }

  async function limpiarColaImpresion() {
    try {
      const res = await apiFetch('/impresion/limpiar-cola', { method: 'POST' });
      if (res && res.ok) {
        showToast(res.mensaje || 'Cola de impresión limpiada con éxito.', 'success');
        verificarEstadoServidorImpresion();
      }
    } catch (_) {
      showToast('Error al limpiar la cola.', 'error');
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

  // ------------------------------------------------------------
  // GESTIÓN DE CONFIGURACIÓN DE IMPRESORA LOCAL (GUARDADO EN FIREBASE Y LOCAL)
  // ------------------------------------------------------------
  let configImpresora = {
    impresora_nombre: '',
    ancho_papel: '80mm',
    auto_imprimir: true
  };

  async function cargarConfigImpresora() {
    try {
      // 1. Intentar cargar desde Firebase Firestore primero
      if (window.FirebaseClient?.obtenerConfiguracion) {
        try {
          const fbConfig = await window.FirebaseClient.obtenerConfiguracion('impresora');
          if (fbConfig) {
            configImpresora = {
              impresora_nombre: fbConfig.impresora_nombre || '',
              ancho_papel: fbConfig.ancho_papel || '80mm',
              auto_imprimir: fbConfig.auto_imprimir !== false
            };
            aplicarConfigImpresoraEnUI();
            console.log('[Impresora] Configuración cargada desde Firebase Firestore.');
            return;
          }
        } catch (_) {}
      }

      // 2. Cargar desde API backend (/api/impresion/config)
      const res = await apiFetch('/impresion/config');
      if (res && res.ok && res.config) {
        configImpresora = {
          impresora_nombre: res.config.impresora_nombre || '',
          ancho_papel: res.config.ancho_papel || '80mm',
          auto_imprimir: res.config.auto_imprimir !== false
        };
        aplicarConfigImpresoraEnUI();
      }
    } catch (e) {
      console.warn('Error cargando configuración de impresora:', e);
    }
  }

  function aplicarConfigImpresoraEnUI() {
    const inpNombre = document.getElementById('impresora-config-nombre');
    const selPapel = document.getElementById('impresora-config-papel');
    const chkAuto = document.getElementById('impresora-config-auto');
    const txtInfoNombre = document.getElementById('info-impresora-nombre');

    if (inpNombre) inpNombre.value = configImpresora.impresora_nombre;
    if (selPapel) selPapel.value = configImpresora.ancho_papel || '80mm';
    if (chkAuto) chkAuto.checked = !!configImpresora.auto_imprimir;
    if (txtInfoNombre) {
      txtInfoNombre.textContent = configImpresora.impresora_nombre || 'Predeterminada de Windows';
    }
  }

  async function guardarConfigImpresora() {
    const inpNombre = document.getElementById('impresora-config-nombre');
    const selPapel = document.getElementById('impresora-config-papel');
    const chkAuto = document.getElementById('impresora-config-auto');

    const nuevaConfig = {
      impresora_nombre: inpNombre ? inpNombre.value.trim() : '',
      ancho_papel: selPapel ? selPapel.value : '80mm',
      auto_imprimir: chkAuto ? chkAuto.checked : true
    };

    const btn = document.getElementById('btn-guardar-config-impresora');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>Guardando en Firebase...</span>';
    }

    try {
      // 1. Guardar en Backend SQLite
      const res = await apiFetch('/impresion/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaConfig)
      });

      // 2. Guardar en Firebase Firestore
      if (window.FirebaseClient?.guardarConfiguracion) {
        try {
          await window.FirebaseClient.guardarConfiguracion('impresora', nuevaConfig);
        } catch (e) {
          console.warn('[Firebase] Error guardando config impresora:', e);
        }
      }

      configImpresora = nuevaConfig;
      aplicarConfigImpresoraEnUI();
      showToast('Configuración de impresora guardada con éxito en Firebase y servidor local.', 'success');
    } catch (e) {
      showToast('Error al guardar la configuración de impresora', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>💾</span> <span>Guardar en Firebase</span>';
      }
    }
  }

  function abrirModalServidorImpresion() {
    const modal = document.getElementById('modal-servidor-impresion');
    if (modal) {
      modal.classList.remove('hidden');
      cargarConfigImpresora();
      verificarEstadoServidorImpresion(false);
    }
  }

  function cerrarModalServidorImpresion() {
    const modal = document.getElementById('modal-servidor-impresion');
    if (modal) modal.classList.add('hidden');
  }

  function abrirModalAyudaAtajosPOS() {
    let modal = document.getElementById('modal-ayuda-atajos-pos');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-ayuda-atajos-pos';
      modal.className = 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div class="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">⌨️</span>
            <div>
              <h3 class="font-bold text-base leading-tight">Atajos de Teclado Rápidos (POS)</h3>
              <p class="text-xs text-slate-300">Factura y cobra en segundos sin usar el mouse</p>
            </div>
          </div>
          <button onclick="ModuloVentas.cerrarModalAyudaAtajosPOS()" class="text-slate-400 hover:text-white text-xl font-bold cursor-pointer">✕</button>
        </div>

        <div class="p-4 sm:p-5 space-y-2.5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          <div class="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <div>
              <div class="font-bold text-emerald-950 text-xs flex items-center gap-1">⚡ Facturar / Completar Venta</div>
              <div class="text-[11px] text-emerald-800">Genera la factura e imprime el ticket</div>
            </div>
            <div class="flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-900">
              <kbd class="px-2 py-1 bg-white border border-emerald-300 rounded shadow-2xs">Ctrl</kbd>+<kbd class="px-2 py-1 bg-white border border-emerald-300 rounded shadow-2xs">P</kbd>
              <span class="text-slate-400 font-sans mx-0.5">o</span>
              <kbd class="px-2 py-1 bg-white border border-emerald-300 rounded shadow-2xs">F2</kbd>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div class="font-bold text-slate-900 text-xs">🔍 Ir al Buscador de Productos</div>
              <div class="text-[11px] text-slate-500">Pone el cursor en la barra de búsqueda</div>
            </div>
            <div class="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800">
              <kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">Ctrl</kbd>+<kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">F</kbd>
              <span class="text-slate-400 font-sans mx-0.5">o</span>
              <kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">F4</kbd>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div class="font-bold text-slate-900 text-xs">💵 Efectivo Exacto</div>
              <div class="text-[11px] text-slate-500">Completa el monto recibido con el total exacto</div>
            </div>
            <div class="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800">
              <kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">Ctrl</kbd>+<kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">E</kbd>
              <span class="text-slate-400 font-sans mx-0.5">o</span>
              <kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">F9</kbd>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div class="font-bold text-slate-900 text-xs">💳 Cambiar Método de Pago</div>
              <div class="text-[11px] text-slate-500">Rota entre Efectivo, Transferencia, Datáfono y Crédito</div>
            </div>
            <div class="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800">
              <kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">F8</kbd>
              <span class="text-slate-400 font-sans mx-0.5">o</span>
              <kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">Ctrl</kbd>+<kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">M</kbd>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div class="font-bold text-slate-900 text-xs">🏷️ Cambiar Lista de Precios</div>
              <div class="text-[11px] text-slate-500">Aplica Precio 1 (General), Precio 2 o Precio 3</div>
            </div>
            <div class="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800">
              <kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">Alt</kbd>+<kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">1/2/3</kbd>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div class="font-bold text-slate-900 text-xs">🗑️ Vaciar Carrito</div>
              <div class="text-[11px] text-slate-500">Limpia la factura en curso</div>
            </div>
            <div class="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800">
              <kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">Alt</kbd>+<kbd class="px-2 py-1 bg-white border border-slate-300 rounded shadow-2xs">V</kbd>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-200">
            <div>
              <div class="font-bold text-indigo-950 text-xs">↕️ Navegar por la Lista de Búsqueda</div>
              <div class="text-[11px] text-indigo-800">Mueve la selección e inserta con Enter</div>
            </div>
            <div class="flex items-center gap-1 font-mono text-[11px] font-bold text-indigo-900">
              <kbd class="px-2 py-1 bg-white border border-indigo-300 rounded shadow-2xs">↑ / ↓</kbd>
              <span class="text-slate-400 font-sans mx-0.5">+</span>
              <kbd class="px-2 py-1 bg-white border border-indigo-300 rounded shadow-2xs">Enter</kbd>
            </div>
          </div>
        </div>

        <div class="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button onclick="ModuloVentas.cerrarModalAyudaAtajosPOS()" class="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer">
            Entendido
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  function cerrarModalAyudaAtajosPOS() {
    const modal = document.getElementById('modal-ayuda-atajos-pos');
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
    ajustarCantidadEntrada,
    fijarCantidadEntrada,
    cambiarTipoPrecioItem,
    toggleEditarPrecioItem,
    guardarPrecioUnitarioItem,
    editarPrecioItem,
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
    cargarConfigImpresora,
    guardarConfigImpresora,
    enviarAImpresoraTienda,
    limpiarColaImpresion,
    abrirModalConfigTicket,
    cerrarModalConfigTicket,
    cambiarTamanoPapel,
    cambiarMargenLateral,
    toggleVisibilidad,
    actualizarCampoTexto,
    renderControlesConfigTicket,
    renderPreviewConfigTicket,
    guardarConfigTicket,
    restablecerConfigTicketDefault,
    probarImpresionConfigTicket,
    cargarConfigFactura,
    seleccionarClientePOS,
    restablecerConsumidorFinal,
    abrirModalNuevoClientePOS,
    abrirModalNuevoProductoPrecios,
    cerrarModalNuevoProductoPrecios,
    generarSiguienteSKUPrecios,
    autoSincronizarPreciosNuevos,
    guardarNuevoProductoPrecios,
    agregarTodosNoEncontradosBD,
    abrirModalAyudaAtajosPOS,
    cerrarModalAyudaAtajosPOS,
    ajustarCopiasImpresion,
    fijarCopiasImpresion
  };
})();
