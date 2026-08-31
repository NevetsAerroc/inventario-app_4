/// ============================================================
// MODULO A: Alta manual + Carga masiva (Excel) + Vinculo/Edicion de codigos
// ============================================================

const ModuloCarga = (() => {
  let scanner = null;
  let productoSeleccionado = null;
  let productosCache = [];
  let formularioAbierto = false;
  let limiteCatalogo = 50;
    let limiteConCodigo = 50;

  function render() {
    const el = document.getElementById('view-carga');
    el.innerHTML = `
      <!-- 1. RECEPCIÓN AUTOMÁTICA DE MERCANCÍA CON ESCÁNER INTEGRADO -->
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">📥 Recepción / Entrada de mercancía</h2>
        <p class="text-xs text-slate-400">Escanea la caja o la unidad. El sistema detectará automáticamente el tipo de empaque.</p>
        
        <!-- VISOR CÁMARA ADAPTATIVO -->
        <div id="entrada-scanner-wrap" class="hidden space-y-2">
          <div id="reader-entrada" class="rounded-xl overflow-hidden bg-black w-full min-h-[220px]"></div>
          
          <div class="flex gap-2">
            <button id="btn-torch-entrada" type="button" class="flex-1 py-1.5 rounded-lg bg-amber-500 text-white font-medium text-xs flex items-center justify-center gap-1 shadow-sm">
              🔦 Activar Flash
            </button>
            <button id="btn-stop-entrada-scan" type="button" class="flex-1 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-medium text-xs">
              Cerrar cámara
            </button>
          </div>
        </div>

        <!-- CONTROLES DE ENTRADA -->
        <div class="grid grid-cols-12 gap-2">
          <input id="input-entrada-codigo" type="text" placeholder="Escanear o digitar código..." autocomplete="off"
                 class="col-span-12 sm:col-span-5 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          
          <button id="btn-start-entrada-scan" class="col-span-6 sm:col-span-3 bg-slate-900 text-white rounded-lg text-sm font-semibold py-2 flex items-center justify-center gap-1">
            📷 Cámara
          </button>
          
          <input id="input-entrada-cant" type="number" min="1" value="1" placeholder="Cant"
                 class="col-span-6 sm:col-span-2 border border-slate-300 rounded-lg px-2 py-2 text-sm text-center" />
          
          <button id="btn-procesar-entrada" class="col-span-12 sm:col-span-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold py-2">
            Ingresar
          </button>
        </div>

        <div id="contenedor-alerta-escaneo"></div>
      </div>

      <!-- 2. ALTA MANUAL DE PRODUCTO -->
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-slate-800 flex items-center gap-2">📦 Productos</h2>
          <button id="btn-toggle-form" class="text-sm font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white">
            ➕ Agregar producto
          </button>
        </div>
        <div id="form-agregar-wrap" class="hidden space-y-2 pt-2 border-t border-slate-100"></div>
      </div>

      <!-- 3. CARGA MASIVA MEDIANTE EXCEL -->
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">📥 Carga masiva de productos</h2>
        <p class="text-sm text-slate-500">
          Columnas esperadas: <b>SKU, Nombre, Categoria, Subcategoria, Ubicacion, StockInicial, Precio,
          CodigoBarras, CodigoCaja, UnidadesPorCaja</b> (todas menos SKU/Nombre son opcionales).
        </p>
        <a id="link-descargar-plantilla" href="/api/productos/exportar" download
           class="block text-center text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-2">
          ⬇️ Descargar plantilla / catalogo actual (.xlsx)
        </a>

        <label class="block">
          <input type="file" id="file-productos" accept=".xlsx,.xls,.csv" class="hidden" />
          <div class="w-full text-center border-2 border-dashed border-slate-300 rounded-xl py-6 cursor-pointer active:bg-slate-50">
            <span class="text-3xl block mb-1">📄</span>
            <span class="text-sm font-medium text-slate-600">Toca para elegir archivo y subir cambios</span>
          </div>
        </label>
        <div id="resumen-importacion"></div>
      </div>

      <!-- 4. VINCULACIÓN DUAL (UNIDAD O CAJA MÁSTER) Y EDICIÓN -->
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">🔗 Vincular / editar producto y códigos</h2>
        <p class="text-sm text-slate-500">Busca el producto para editar su nombre, unidades por caja o vincular códigos de barras.</p>

        <div class="relative">
          <input id="input-buscar-vinculo" type="text" placeholder="🔍 Escribe nombre o SKU para autocompletar..." autocomplete="off"
                 class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div id="autocomplete-vinculo" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"></div>
        </div>

        <select id="select-producto-codigo" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Cargando productos...</option>
        </select>

        <!-- Tarjeta del producto seleccionado: Editar Nombre y Und/Caja -->
        <div id="card-producto-seleccionado" class="hidden bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Producto seleccionado:</span>
              <p id="sel-prod-nombre" class="text-sm font-bold text-slate-800 leading-snug"></p>
              <p id="sel-prod-sku" class="text-xs text-slate-500 font-mono mt-0.5"></p>
            </div>
            <button type="button" id="btn-editar-nombre-vinculo" class="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 shadow-sm shrink-0 flex items-center gap-1">
              ✏️ Editar nombre
            </button>
          </div>

          <div class="border-t border-slate-200/60 pt-2.5 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div class="flex items-center gap-2">
              <label class="text-xs font-semibold text-slate-700 whitespace-nowrap">📦 Unidades por caja:</label>
              <input id="input-vinculo-unidades-caja" type="number" min="1" value="1" 
                     class="w-20 border border-emerald-300 rounded-lg px-2 py-1 text-sm bg-white font-bold text-center text-slate-800 focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button type="button" id="btn-guardar-upc-vinculo" class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm shrink-0 flex items-center gap-1">
              💾 Guardar Und/Caja
            </button>
          </div>

          <div id="codigo-actual-info" class="text-xs text-slate-600 bg-white rounded-lg p-2.5 border border-slate-100 space-y-1"></div>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-1">
          <label class="flex items-center gap-2 border border-slate-200 rounded-lg p-2 text-xs cursor-pointer bg-slate-50 hover:bg-slate-100">
            <input type="radio" name="tipo_vinculo" value="UNIDAD" checked class="text-emerald-600 focus:ring-emerald-500" />
            <span>🥄 Código de Unidad</span>
          </label>
          <label class="flex items-center gap-2 border border-slate-200 rounded-lg p-2 text-xs cursor-pointer bg-slate-50 hover:bg-slate-100">
            <input type="radio" name="tipo_vinculo" value="CAJA" class="text-emerald-600 focus:ring-emerald-500" />
            <span>📦 Código de Caja Máster</span>
          </label>
        </div>

        <div id="vinculo-scanner-wrap" class="hidden space-y-2">
          <div id="reader-carga" class="rounded-xl overflow-hidden bg-black"></div>
          <button id="btn-stop-vinculo" class="w-full py-2 rounded-lg bg-slate-200 text-slate-700 font-medium text-sm">Cerrar cámara</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button id="btn-start-vinculo" type="button" class="py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm disabled:opacity-40" disabled>
            📷 Cámara en vivo
          </button>
          <label id="btn-foto-vinculo" class="py-2.5 rounded-lg bg-slate-700 text-white font-semibold text-sm text-center cursor-pointer disabled:opacity-40">
            <input type="file" id="input-foto-vinculo" accept="image/*" capture="environment" class="hidden" disabled />
            📸 Tomar foto
          </label>
        </div>


        <div id="vinculo-confirm-wrap" class="hidden space-y-3 border-2 border-emerald-400 bg-emerald-50 rounded-xl p-4 shadow-sm">
          <p class="text-sm font-bold text-emerald-900">⚠️ Confirmar vinculación</p>
          <div class="text-sm text-slate-700 space-y-1.5 bg-white rounded-lg p-3 border border-emerald-100">
            <p>Producto: <b id="vinculo-confirm-nombre" class="text-slate-900"></b></p>
            <p>Tipo: <b id="vinculo-confirm-tipo" class="text-slate-900"></b></p>
          </div>
          <label class="block text-xs font-semibold text-slate-700">Código de barras escaneado (puedes editarlo):</label>
          <input id="vinculo-confirm-codigo" type="text" autocomplete="off" inputmode="numeric"
                 class="w-full border-2 border-emerald-300 rounded-lg px-3 py-2.5 text-sm font-mono bg-white focus:ring-2 focus:ring-emerald-500" />
          <div class="grid grid-cols-3 gap-2">
            <button type="button" data-vinculo-accion="cancelar" class="py-2.5 rounded-lg bg-slate-200 text-slate-700 font-semibold text-xs">
              Cancelar
            </button>
            <button type="button" data-vinculo-accion="reintentar" class="py-2.5 rounded-lg bg-amber-500 text-white font-semibold text-xs">
              📷 Otra foto
            </button>
            <button type="button" data-vinculo-accion="aceptar" class="py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs">
              ✓ Aceptar
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2 text-xs text-slate-400">
          <div class="flex-1 h-px bg-slate-200"></div> o escribirlo manualmente <div class="flex-1 h-px bg-slate-200"></div>
        </div>
        <div class="flex gap-2">
          <input id="input-codigo-manual" type="text" placeholder="Ej: 7701234500019"
                 class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" disabled />
          <button id="btn-guardar-manual" class="px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-40" disabled>Guardar</button>
        </div>
      </div>

            <!-- PRODUCTOS QUE YA TIENEN CÓDIGO DE BARRAS -->
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3 border-2 border-sky-100">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">
          🔗 Productos con código de barras
          (<span id="total-con-codigo" class="text-sm font-semibold text-sky-700">0</span>)
        </h2>
        <p class="text-xs text-slate-500">Solo los que ya tienen código de unidad o de caja. Busca, toca uno y edita, quita o vuelve a escanear.</p>

        <div class="relative">
          <input id="input-buscar-con-codigo" type="text" placeholder="🔍 Buscar por nombre, SKU o código..." autocomplete="off"
                 class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div id="autocomplete-con-codigo" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"></div>
        </div>

        <div id="lista-con-codigo" class="divide-y divide-slate-100 max-h-64 overflow-y-auto border border-slate-100 rounded-xl"></div>

        <div id="editor-con-codigo" class="hidden space-y-3 border border-emerald-200 bg-emerald-50/40 rounded-xl p-3">
          <div class="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div class="min-w-0 flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-slate-800">Editando: <span id="editor-con-codigo-nombre"></span></p>
              <button type="button" id="editor-btn-editar-nombre" class="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 shadow-sm flex items-center gap-1">
                ✏️ Editar nombre
              </button>
            </div>
            <button type="button" id="editor-btn-cerrar" class="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold">
              ✕ Cerrar
            </button>
          </div>
          <div class="text-xs space-y-2 bg-white rounded-lg p-2.5 border border-slate-100">
            <div class="flex justify-between items-start gap-2">
              <div>
                <p class="text-slate-500 font-medium">🥄 Código Unidad</p>
                <p id="editor-cod-unidad" class="font-mono text-slate-800 break-all">—</p>
              </div>
              <div class="flex gap-1">
                <button type="button" id="editor-btn-editar-und" class="px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">Editar</button>
                <button type="button" id="editor-btn-quitar-und" class="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-semibold">Quitar</button>
              </div>
            </div>
            <div class="flex justify-between items-start gap-2 border-t border-slate-100 pt-2">
              <div>
                <p class="text-slate-500 font-medium">📦 Código Caja Máster</p>
                <p id="editor-cod-caja" class="font-mono text-slate-800 break-all">—</p>
              </div>
              <div class="flex gap-1">
                <button type="button" id="editor-btn-editar-caja" class="px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">Editar</button>
                <button type="button" id="editor-btn-quitar-caja" class="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-semibold">Quitar</button>
              </div>
            </div>
            <div class="flex items-center justify-between border-t border-slate-100 pt-2">
              <span class="text-slate-500 font-medium">📦 Unidades por caja:</span>
              <div class="flex items-center gap-1.5">
                <input id="editor-input-upc" type="number" min="1" value="1" class="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs text-center font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500" />
                <button id="editor-btn-guardar-upc" type="button" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm">
                  💾 Guardar
                </button>
              </div>
            </div>
          </div>
          <p class="text-[11px] text-slate-500">Al pulsar <b>Editar</b> usa la sección Vincular de arriba: cámara o escritura manual.</p>
          <button type="button" id="editor-btn-ir-escanear" class="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm">
            📷 Ir a escanear / escribir código
          </button>
        </div>
      </div>

      <!-- 5. LISTADO GENERAL / CATÁLOGO -->
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-slate-800">📋 Catalogo (<span id="total-catalogo">0</span> productos)</h2>
        </div>
        
        <input id="input-filtro-catalogo" type="text" placeholder="🔎 Filtrar catálogo por nombre, SKU o categoría..."
               class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:bg-white" />

        <div id="lista-catalogo" class="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1"></div>
      </div>
    `;

    bindEvents();
    cargarProductos();
    cargarCatalogo();
  }

  function renderFormulario() {
    const wrap = document.getElementById('form-agregar-wrap');
    wrap.innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        <input id="f-sku" type="text" placeholder="SKU *" class="border border-slate-300 rounded-lg px-3 py-2 text-sm col-span-1" />
        <div class="flex gap-1 col-span-1">
          <input id="f-codigo" type="text" placeholder="Cod. Unidad" class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button id="btn-scan-codigo-nuevo" type="button" class="px-2.5 py-2 bg-slate-900 text-white rounded-lg text-sm" title="Escanear unidad">📷</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <input id="f-codigo-caja" type="text" placeholder="Cod. Barras Caja (Máster)" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input id="f-unidades-caja" type="number" min="1" value="1" placeholder="Unidades por caja" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>

            <div id="scanner-nuevo-wrap" class="hidden space-y-2 pt-2">
        <p class="text-xs text-center text-slate-500 font-medium">Apunta el código de barras al centro del recuadro</p>
        <div id="reader-nuevo-producto" class="rounded-xl overflow-hidden bg-black w-full min-h-[260px]"></div>
        <button id="btn-stop-scanner-nuevo" type="button" class="w-full py-2 rounded-lg bg-slate-200 text-slate-700 font-medium text-sm">Cancelar cámara</button>
      </div>

      <div class="relative">
        <input id="f-nombre" type="text" placeholder="Nombre del producto *" autocomplete="off" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div id="autocomplete-nombre" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"></div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input id="f-categoria" type="text" placeholder="Categoria" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input id="f-subcategoria" type="text" placeholder="Subcategoria" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <input id="f-ubicacion" type="text" placeholder="Ubicacion (ej: Bodega A - Estante 3)" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      <div class="grid grid-cols-2 gap-2">
        <input id="f-stock" type="number" min="0" placeholder="Stock inicial (unidades)" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input id="f-precio" type="number" min="0" step="0.01" placeholder="Precio unitario" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div id="form-agregar-error" class="text-xs text-rose-600 hidden"></div>
      <div class="grid grid-cols-2 gap-2 pt-1">
        <button id="btn-cancelar-form" class="py-2.5 rounded-lg bg-slate-200 text-slate-700 font-semibold text-sm">Cancelar</button>
        <button id="btn-guardar-producto" class="py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm">Guardar producto</button>
      </div>
    `;

    document.getElementById('btn-cancelar-form').addEventListener('click', () => toggleFormulario(false));
    document.getElementById('btn-guardar-producto').addEventListener('click', guardarProductoNuevo);

    document.getElementById('btn-scan-codigo-nuevo').addEventListener('click', startScannerNuevoProducto);
    document.getElementById('btn-stop-scanner-nuevo').addEventListener('click', stopScannerNuevoProducto);

    attachAutocompleteProductos(
      document.getElementById('f-nombre'),
      document.getElementById('autocomplete-nombre'),
      (producto) => {
        document.getElementById('f-nombre').value = producto.nombre;
        document.getElementById('f-categoria').value = producto.categoria || '';
        document.getElementById('f-subcategoria').value = producto.subcategoria || '';
        document.getElementById('f-ubicacion').value = producto.ubicacion || '';
        document.getElementById('f-codigo-caja').value = producto.codigo_caja || '';
        document.getElementById('f-unidades-caja').value = producto.unidades_por_caja || 1;
        if (!document.getElementById('f-precio').value) {
          document.getElementById('f-precio').value = producto.precio || '';
        }
        showToast(`Datos copiados de "${producto.nombre}" (SKU ${producto.sku}). Recuerda usar un SKU distinto.`, 'info');
      }
    );
  }

  function toggleFormulario(abrir) {
    formularioAbierto = abrir ?? !formularioAbierto;
    const wrap = document.getElementById('form-agregar-wrap');
    const btn = document.getElementById('btn-toggle-form');
    if (formularioAbierto) {
      renderFormulario();
      wrap.classList.remove('hidden');
      btn.textContent = '✖️ Cerrar';
      autocompletarSiguienteSku();
    } else {
      stopScannerNuevoProducto();
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
      btn.textContent = '➕ Agregar producto';
    }
  }

  async function guardarProductoNuevo() {
    const errorEl = document.getElementById('form-agregar-error');
    errorEl.classList.add('hidden');

    const payload = {
      sku: document.getElementById('f-sku').value.trim(),
      nombre: document.getElementById('f-nombre').value.trim(),
      categoria: document.getElementById('f-categoria').value.trim(),
      subcategoria: document.getElementById('f-subcategoria').value.trim(),
      ubicacion: document.getElementById('f-ubicacion').value.trim(),
      stock: document.getElementById('f-stock').value || 0,
      precio: document.getElementById('f-precio').value || 0,
      codigo_barras: document.getElementById('f-codigo').value.trim(),
      codigo_caja: document.getElementById('f-codigo-caja').value.trim(),
      unidades_por_caja: Number(document.getElementById('f-unidades-caja').value) || 1
    };

    if (!payload.sku || !payload.nombre) {
      errorEl.textContent = 'SKU y Nombre son obligatorios.';
      errorEl.classList.remove('hidden');
      return;
    }

    const data = await apiFetch('/productos', { method: 'POST', body: JSON.stringify(payload) });
    if (!data.ok) {
      errorEl.textContent = data.error;
      errorEl.classList.remove('hidden');
      return;
    }

    showToast(`Producto "${data.data.nombre}" creado`, 'success');
    toggleFormulario(false);
    cargarProductos();
    cargarCatalogo();
  }

  function bindEvents() {
    document.getElementById('btn-toggle-form').addEventListener('click', () => toggleFormulario());
    document.getElementById('file-productos').addEventListener('change', handleUpload);

    document.getElementById('input-foto-vinculo')?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // permite volver a elegir la misma foto
      if (!file) return;
      if (!productoSeleccionado) {
        showToast('Selecciona un producto primero', 'error');
        return;
      }
      try {
        showToast('Leyendo imagen...', 'info');
        const archivoParaLeer = (typeof mostrarRecortador === 'function')
          ? await mostrarRecortador(file)
          : file;
        if (!archivoParaLeer) return; // canceló el recorte

        const codigoRaw = await BarcodeScanner.scanearDesdeArchivo(archivoParaLeer);
        const codigo = (typeof normalizarCodigoBarras === 'function')
          ? normalizarCodigoBarras(codigoRaw)
          : String(codigoRaw || '').trim();

        if (!codigo) {
          showToast('No se detectó un código válido en la foto.', 'error');
          return;
        }
        mostrarConfirmacionVinculo(codigo);
      } catch (err) {
        console.error(err);
        beepError();
        showToast('No se detectó ningún código en la foto. Intenta con más luz o enfoque.', 'error');
      }
    });

    document.getElementById('btn-procesar-entrada')?.addEventListener('click', () => procesarEntradaMercancia());
    document.getElementById('input-entrada-codigo')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') procesarEntradaMercancia();
    });
        document.getElementById('editor-btn-cerrar')?.addEventListener('click', () => {
      document.getElementById('editor-con-codigo')?.classList.add('hidden');
    });
    document.getElementById('btn-start-entrada-scan')?.addEventListener('click', startScannerEntrada);
    document.getElementById('btn-stop-entrada-scan')?.addEventListener('click', stopScannerEntrada);

    document.getElementById('btn-torch-entrada')?.addEventListener('click', async () => {
      if (scanner) {
        const estadoTorch = await scanner.toggleTorch();
        const btnTorch = document.getElementById('btn-torch-entrada');
        if (btnTorch) {
          btnTorch.textContent = estadoTorch ? '💡 Apagar Flash' : '🔦 Activar Flash';
          btnTorch.className = estadoTorch 
            ? 'flex-1 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm'
            : 'flex-1 py-1.5 rounded-lg bg-amber-500 text-white font-medium text-xs flex items-center justify-center gap-1 shadow-sm';
        }
      }
    });

    document.querySelectorAll('input[name="tipo_vinculo"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const wrapCant = document.getElementById('wrap-unidades-caja-vinculo');
        if (e.target.value === 'CAJA') {
          wrapCant.classList.remove('hidden');
        } else {
          wrapCant.classList.add('hidden');
        }
      });
    });

    attachAutocompleteProductos(
      document.getElementById('input-buscar-vinculo'),
      document.getElementById('autocomplete-vinculo'),
      (producto) => {
        seleccionarProducto(String(producto.id));
      }
    );

    document.getElementById('select-producto-codigo').addEventListener('change', (e) => {
      seleccionarProducto(e.target.value || null);
    });

    document.getElementById('btn-start-vinculo').addEventListener('click', startVinculoScanner);
    document.getElementById('btn-stop-vinculo').addEventListener('click', () => stopVinculoScanner(false));
    document.getElementById('btn-quitar-unidad')?.addEventListener('click', () => quitarCodigo('UNIDAD'));
    document.getElementById('btn-quitar-caja')?.addEventListener('click', () => quitarCodigo('CAJA'));
    document.getElementById('btn-usar-unidad')?.addEventListener('click', () => prepararEdicion('UNIDAD'));
    document.getElementById('btn-usar-caja')?.addEventListener('click', () => prepararEdicion('CAJA'));

    // Botones de editar nombre y guardar unidades por caja
    document.getElementById('btn-editar-nombre-vinculo')?.addEventListener('click', () => {
      if (productoSeleccionado) editarNombreProducto(productoSeleccionado);
    });
    document.getElementById('btn-guardar-upc-vinculo')?.addEventListener('click', () => {
      const upc = document.getElementById('input-vinculo-unidades-caja')?.value;
      if (productoSeleccionado) guardarUnidadesPorCaja(productoSeleccionado, upc);
    });
    document.getElementById('editor-btn-editar-nombre')?.addEventListener('click', () => {
      if (productoSeleccionado) editarNombreProducto(productoSeleccionado);
    });
    document.getElementById('editor-btn-guardar-upc')?.addEventListener('click', () => {
      const upc = document.getElementById('editor-input-upc')?.value;
      if (productoSeleccionado) guardarUnidadesPorCaja(productoSeleccionado, upc);
    });

    const confirmWrap = document.getElementById('vinculo-confirm-wrap');
    if (confirmWrap) {
      confirmWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-vinculo-accion]');
        if (!btn) return;
        const accion = btn.getAttribute('data-vinculo-accion');
        if (accion === 'aceptar') aceptarConfirmacionVinculo();
        else if (accion === 'cancelar') cancelarConfirmacionVinculo();
        else if (accion === 'reintentar') reintentarEscaneoVinculo();
      });
      confirmWrap.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.id === 'vinculo-confirm-codigo') {
          e.preventDefault();
          aceptarConfirmacionVinculo();
        }
      });
    }

        document.getElementById('btn-guardar-manual')?.addEventListener('click', () => {
      const input = document.getElementById('input-codigo-manual');
      const codigo = normalizarCodigoBarras(input?.value || '');
      if (!codigo) {
        showToast('Escribe un código de barras', 'error');
        return;
      }
      // Poner el código limpio también en el input para que se vea bien
      if (input) input.value = codigo;
      mostrarConfirmacionVinculo(codigo);
    });

    const inputFiltro = document.getElementById('input-filtro-catalogo');
    if (inputFiltro) {
      inputFiltro.addEventListener('input', () => {
        limiteCatalogo = 50;
        renderizarListaCatalogo();
      });
    }

    const listaEl = document.getElementById('lista-catalogo');
    if (listaEl) {
      listaEl.addEventListener('scroll', () => {
        if (listaEl.scrollTop + listaEl.clientHeight >= listaEl.scrollHeight - 30) {
          if (limiteCatalogo < productosCache.length) {
            limiteCatalogo += 50;
            renderizarListaCatalogo();
          }
        }
      });
    }

        // Sección: productos con código de barras
    const inputBuscarConCod = document.getElementById('input-buscar-con-codigo');
    if (inputBuscarConCod) {
      inputBuscarConCod.addEventListener('input', () => {
        limiteConCodigo = 50;
        renderizarListaConCodigo();
      });
    }

    const listaCod = document.getElementById('lista-con-codigo');
    if (listaCod) {
      listaCod.addEventListener('scroll', () => {
        if (listaCod.scrollTop + listaCod.clientHeight >= listaCod.scrollHeight - 30) {
          limiteConCodigo += 50;
          renderizarListaConCodigo();
        }
      });
      listaCod.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-id-producto]');
        if (!btn) return;
        const id = btn.getAttribute('data-id-producto');
        seleccionarProducto(id);
        const p = productosCache.find(x => String(x.id) === String(id));
        if (p) mostrarEditorConCodigo(p);
      });
    }

    document.getElementById('editor-btn-editar-und')?.addEventListener('click', () => {
      prepararEdicion('UNIDAD');
      document.getElementById('btn-start-vinculo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.getElementById('editor-btn-editar-caja')?.addEventListener('click', () => {
      prepararEdicion('CAJA');
      document.getElementById('btn-start-vinculo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.getElementById('editor-btn-quitar-und')?.addEventListener('click', () => quitarCodigo('UNIDAD'));
    document.getElementById('editor-btn-quitar-caja')?.addEventListener('click', () => quitarCodigo('CAJA'));
    document.getElementById('editor-btn-ir-escanear')?.addEventListener('click', () => {
      document.getElementById('btn-start-vinculo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Producto listo. Escanea o escribe el código en Vincular (arriba).', 'info');
    });

  }

  // ============================================================
  // FUNCIONES AUXILIARES DE CARGA Y ESCÁNER
  // ============================================================

    async function procesarEntradaMercancia(codigoForzado = null) {
    const inputCodigo = document.getElementById('input-entrada-codigo');
    const inputCant = document.getElementById('input-entrada-cant');
    const codigo = (codigoForzado || inputCodigo?.value || '').trim();
    const cantidad = Math.max(1, parseInt(inputCant?.value, 10) || 1);

    if (!codigo) {
      showToast('Escribe o escanea un código', 'error');
      return;
    }

    const res = await apiFetch('/productos/escanear-entrada', {
      method: 'POST',
      body: JSON.stringify({ codigo_barras: codigo, cantidad_ingresada: cantidad }),
    });

    // Caja compartida → abrir panel de distribución de sabores
    if (res.ok && res.requiere_distribucion) {
      abrirPanelCajaMixta(res);
      return;
    }

    if (res.ok) {
      beepSuccess();
      showToast(res.mensaje || 'Entrada registrada', 'success');
      if (inputCodigo) inputCodigo.value = '';
      if (inputCant) inputCant.value = '1';
      await cargarProductos();
      await cargarCatalogo();
    } else if (res.error === 'NO_ENCONTRADO') {
      beepError();
      showToast(`Código no encontrado: ${codigo}`, 'error');
    } else {
      beepError();
      showToast(res.error || 'Error al procesar la entrada', 'error');
    }
  }

    // ---------- Caja mixta: varios sabores en el mismo código de caja ----------
  let cajaMixtaState = null; // { codigo_caja, capacidad, productos, lineas: [{id,nombre,cantidad}] }

  function abrirPanelCajaMixta(data) {
    cajaMixtaState = {
      codigo_caja: data.codigo_caja,
      capacidad: data.capacidad_caja || 0,
      productos: data.productos || [],
      lineas: [],
    };
    renderPanelCajaMixta();
  }

  function renderPanelCajaMixta() {
    let panel = document.getElementById('panel-caja-mixta');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'panel-caja-mixta';
      panel.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3';
      document.body.appendChild(panel);
    }

    const total = cajaMixtaState.lineas.reduce((s, l) => s + l.cantidad, 0);
    const capacidad = cajaMixtaState.capacidad;
    const resto = capacidad > 0 ? Math.max(0, capacidad - total) : null;

    const opciones = cajaMixtaState.productos
      .map(p => `<option value="${p.id}">${p.sku} — ${p.nombre}</option>`)
      .join('');

    const filas = cajaMixtaState.lineas.map((l, i) => `
      <div class="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 text-sm">
        <span class="flex-1 truncate">${l.nombre}</span>
        <span class="font-semibold text-emerald-700">×${l.cantidad}</span>
        <button type="button" data-rm="${i}" class="text-rose-500 text-xs px-2">Quitar</button>
      </div>
    `).join('') || '<p class="text-xs text-slate-400 py-2">Aún no has agregado sabores</p>';

    panel.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-slate-800">📦 Caja mixta</h3>
          <button type="button" id="caja-mixta-cerrar" class="text-slate-400 text-sm">Cerrar</button>
        </div>
        <p class="text-xs text-slate-500">
          Código: <b class="font-mono">${cajaMixtaState.codigo_caja}</b>
          ${capacidad ? ` · Capacidad: <b>${capacidad}</b> und` : ''}
        </p>
        <p class="text-sm ${resto === 0 ? 'text-emerald-600' : 'text-amber-600'}">
          Asignadas: <b>${total}</b>${capacidad ? ` / ${capacidad}` : ''}
          ${resto !== null ? ` · Restan: <b>${resto}</b>` : ''}
        </p>

        <div class="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
          <label class="block text-xs font-semibold text-slate-600">Sabor / producto</label>
          <select id="caja-mixta-producto" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">— Elegir —</option>
            ${opciones}
          </select>
          <div class="flex gap-2">
            <input id="caja-mixta-cant" type="number" min="1" value="1"
                   class="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Cant" />
            <button type="button" id="caja-mixta-add"
                    class="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold">
              + Agregar
            </button>
          </div>
        </div>

        <div class="space-y-0.5">${filas}</div>

        <div class="grid grid-cols-2 gap-2 pt-1">
          <button type="button" id="caja-mixta-cancelar"
                  class="py-2.5 rounded-lg bg-slate-200 text-slate-700 font-semibold text-sm">Cancelar</button>
          <button type="button" id="caja-mixta-guardar"
                  class="py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm"
                  ${total <= 0 ? 'disabled' : ''}>
            Guardar entrada
          </button>
        </div>
      </div>
    `;

    // Eventos
    panel.querySelector('#caja-mixta-cerrar')?.addEventListener('click', cerrarPanelCajaMixta);
    panel.querySelector('#caja-mixta-cancelar')?.addEventListener('click', cerrarPanelCajaMixta);

    panel.querySelector('#caja-mixta-add')?.addEventListener('click', () => {
      const sel = panel.querySelector('#caja-mixta-producto');
      const cantEl = panel.querySelector('#caja-mixta-cant');
      const pid = Number(sel.value);
      const cant = Math.max(1, parseInt(cantEl.value, 10) || 1);
      if (!pid) {
        showToast('Elige un sabor', 'error');
        return;
      }
      if (capacidad && total + cant > capacidad) {
        if (!confirm(`Vas a superar la capacidad de la caja (${capacidad}). ¿Continuar igual?`)) return;
      }
      const prod = cajaMixtaState.productos.find(p => p.id === pid);
      // Si ya está en la lista, sumar cantidad
      const existente = cajaMixtaState.lineas.find(l => l.id === pid);
      if (existente) {
        existente.cantidad += cant;
      } else {
        cajaMixtaState.lineas.push({ id: pid, nombre: prod?.nombre || pid, cantidad: cant });
      }
      renderPanelCajaMixta();
    });

    panel.querySelectorAll('[data-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.rm);
        cajaMixtaState.lineas.splice(i, 1);
        renderPanelCajaMixta();
      });
    });

    panel.querySelector('#caja-mixta-guardar')?.addEventListener('click', async () => {
      if (!cajaMixtaState.lineas.length) return;
      const res = await apiFetch('/productos/escanear-entrada', {
        method: 'POST',
        body: JSON.stringify({
          codigo_barras: cajaMixtaState.codigo_caja,
          distribucion: cajaMixtaState.lineas.map(l => ({
            producto_id: l.id,
            cantidad: l.cantidad,
          })),
        }),
      });
      if (res.ok) {
        beepSuccess();
        showToast(res.mensaje || 'Caja mixta guardada', 'success');
        cerrarPanelCajaMixta();
        const inputCodigo = document.getElementById('input-entrada-codigo');
        if (inputCodigo) inputCodigo.value = '';
        await cargarProductos();
        await cargarCatalogo();
      } else {
        beepError();
        showToast(res.error || 'No se pudo guardar', 'error');
      }
    });
  }

  function cerrarPanelCajaMixta() {
    const panel = document.getElementById('panel-caja-mixta');
    if (panel) panel.remove();
    cajaMixtaState = null;
  }

  function startScannerEntrada() {
    const wrap = document.getElementById('entrada-scanner-wrap');
    if (!wrap) return;
    wrap.classList.remove('hidden');

    scanner = new BarcodeScanner('reader-entrada', (codigo) => {
      procesarEntradaMercancia(codigo);
    });
    scanner.start();
  }

  async function stopScannerEntrada() {
    if (scanner) await scanner.stop();
    const wrap = document.getElementById('entrada-scanner-wrap');
    if (wrap) wrap.classList.add('hidden');
  }

  function seleccionarProducto(id) {
    productoSeleccionado = id || null;
    const disabled = !productoSeleccionado;
    if (typeof ocultarConfirmacionVinculo === 'function') ocultarConfirmacionVinculo();

    const labelFoto = document.getElementById('btn-foto-vinculo');
    const inputFoto = document.getElementById('input-foto-vinculo');
    if (labelFoto) {
      if (disabled) labelFoto.classList.add('opacity-40', 'pointer-events-none');
      else labelFoto.classList.remove('opacity-40', 'pointer-events-none');
    }
    if (inputFoto) inputFoto.disabled = disabled;

    const select = document.getElementById('select-producto-codigo');
    if (select && select.value !== String(productoSeleccionado || '')) {
      select.value = productoSeleccionado || '';
    }

    const btnStart = document.getElementById('btn-start-vinculo');
    const inputManual = document.getElementById('input-codigo-manual');
    const btnGuardar = document.getElementById('btn-guardar-manual');
    if (btnStart) btnStart.disabled = disabled;
    if (inputManual) inputManual.disabled = disabled;
    if (btnGuardar) btnGuardar.disabled = disabled;

    const cardSel = document.getElementById('card-producto-seleccionado');
    const infoEl = document.getElementById('codigo-actual-info');
    const producto = productosCache.find(p => String(p.id) === String(productoSeleccionado));

    if (producto) {
      const buscar = document.getElementById('input-buscar-vinculo');
      if (buscar) buscar.value = `${producto.sku} — ${producto.nombre}`;

      if (cardSel) {
        cardSel.classList.remove('hidden');
        const nombreEl = document.getElementById('sel-prod-nombre');
        const skuEl = document.getElementById('sel-prod-sku');
        if (nombreEl) nombreEl.textContent = producto.nombre;
        if (skuEl) skuEl.textContent = `SKU: ${producto.sku} ${producto.categoria ? '· ' + producto.categoria : ''}`;
      }

      const inputUpc = document.getElementById('input-vinculo-unidades-caja');
      if (inputUpc) {
        inputUpc.value = producto.unidades_por_caja || 1;
      }

      if (infoEl) {
        const upc = producto.unidades_por_caja || 1;
        infoEl.innerHTML = `
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-500">🥄 Código Unidad:</span>
            <b class="font-mono text-slate-800">${escapeHtml(producto.codigo_barras || '— sin vincular —')}</b>
          </div>
          <div class="flex justify-between items-center text-xs border-t border-slate-100 pt-1">
            <span class="text-slate-500">📦 Código Caja:</span>
            <b class="font-mono text-slate-800">${escapeHtml(producto.codigo_caja || '— sin vincular —')} <span class="text-slate-400 font-normal">(${upc} und/caja)</span></b>
          </div>
        `;
        infoEl.classList.remove('hidden');
      }
    } else {
      const buscar = document.getElementById('input-buscar-vinculo');
      if (buscar) buscar.value = '';
      if (cardSel) cardSel.classList.add('hidden');
      if (infoEl) infoEl.classList.add('hidden');
    }
  }

  async function editarNombreProducto(id) {
    if (!id) return;
    const producto = productosCache.find(p => String(p.id) === String(id));
    if (!producto) return;

    const actual = producto.nombre || '';
    const nuevo = prompt(`Editar nombre del producto (${producto.sku}):`, actual);
    if (nuevo === null) return;
    const limpio = nuevo.trim();
    if (!limpio) {
      showToast('El nombre del producto no puede estar vacío.', 'error');
      return;
    }
    if (limpio === actual) return;

    const data = await apiFetch(`/productos/${producto.id}`, {
      method: 'PUT',
      body: JSON.stringify({ nombre: limpio }),
    });

    if (data.ok) {
      beepSuccess();
      showToast(`Nombre actualizado a "${data.data.nombre}"`, 'success');
      producto.nombre = data.data.nombre;
      await cargarProductos();
      if (typeof cargarCatalogo === 'function') await cargarCatalogo();
      seleccionarProducto(producto.id);
      if (typeof mostrarEditorConCodigo === 'function') {
        const act = productosCache.find(p => String(p.id) === String(producto.id));
        if (act && (act.codigo_barras || act.codigo_caja)) mostrarEditorConCodigo(act);
      }
    } else {
      beepError();
      showToast(data.error || 'Error actualizando el nombre', 'error');
    }
  }

  async function guardarUnidadesPorCaja(id, valor) {
    if (!id) return;
    const upc = parseInt(valor, 10);
    if (!Number.isInteger(upc) || upc < 1) {
      showToast('Ingresa una cantidad de unidades válida (mínimo 1).', 'error');
      return;
    }

    const data = await apiFetch(`/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ unidades_por_caja: upc }),
    });

    if (data.ok) {
      beepSuccess();
      showToast(`Unidades por caja guardadas: ${upc} und/caja`, 'success');
      const producto = productosCache.find(p => String(p.id) === String(id));
      if (producto) producto.unidades_por_caja = upc;
      await cargarProductos();
      if (typeof cargarCatalogo === 'function') await cargarCatalogo();
      seleccionarProducto(id);
      if (typeof mostrarEditorConCodigo === 'function') {
        const act = productosCache.find(p => String(p.id) === String(id));
        if (act && (act.codigo_barras || act.codigo_caja)) mostrarEditorConCodigo(act);
      }
    } else {
      beepError();
      showToast(data.error || 'Error guardando unidades por caja', 'error');
    }
  }

  async function quitarCodigo(tipo) {
    if (!productoSeleccionado) return;
    const etiqueta = tipo === 'CAJA' ? 'caja máster' : 'unidad';
    if (!confirm(`¿Quitar el código de ${etiqueta} de este producto?`)) return;

    const data = await apiFetch(`/productos/${productoSeleccionado}/vincular-barcode`, {
      method: 'POST',
      body: JSON.stringify({ accion: 'quitar', tipo_codigo: tipo }),
    });

    if (data.ok) {
      beepSuccess();
      showToast(`Código de ${etiqueta} eliminado`, 'success');
      await cargarProductos();
      if (typeof cargarCatalogo === 'function') await cargarCatalogo();

      const actualizado = productosCache.find(p => String(p.id) === String(productoSeleccionado));
      if (actualizado && (actualizado.codigo_barras || actualizado.codigo_caja)) {
        seleccionarProducto(productoSeleccionado);
        if (typeof mostrarEditorConCodigo === 'function') mostrarEditorConCodigo(actualizado);
      } else {
        document.getElementById('editor-con-codigo')?.classList.add('hidden');
        seleccionarProducto(null);
      }
    } else {
      beepError();
      showToast(data.error || 'No se pudo quitar el código', 'error');
    }
  }

  function prepararEdicion(tipo) {
    if (!productoSeleccionado) return;
    const radio = document.querySelector(`input[name="tipo_vinculo"][value="${tipo}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
    const producto = productosCache.find(p => String(p.id) === String(productoSeleccionado));
    const inputManual = document.getElementById('input-codigo-manual');
    if (inputManual && producto) {
      inputManual.value = tipo === 'CAJA'
        ? (producto.codigo_caja || '')
        : (producto.codigo_barras || '');
      inputManual.focus();
      inputManual.select();
    }
    showToast(
      tipo === 'CAJA'
        ? 'Edición CAJA: escanea, escribe el nuevo código o usa la cámara y guarda.'
        : 'Edición UNIDAD: escanea, escribe el nuevo código o usa la cámara y guarda.',
      'info'
    );
  }

    async function guardarCodigo(codigo, inputManualEl = null, forzar = false) {
    if (!productoSeleccionado) return;

    const tipoVinculo = document.querySelector('input[name="tipo_vinculo"]:checked').value;
    const unidadesCaja = Number(document.getElementById('input-vinculo-unidades-caja')?.value) || 1;

    const data = await apiFetch(`/productos/${productoSeleccionado}/vincular-barcode`, {
      method: 'POST',
      body: JSON.stringify({
        codigo_barras: codigo,
        tipo_codigo: tipoVinculo,
        unidades_por_caja: unidadesCaja,
        forzar: !!forzar,
      }),
    });

    // Código ya usado → preguntar si quiere usarlo igual
    if (!data.ok && data.codigo_duplicado) {
      beepError();
      const lista = (data.conflictos || [])
        .map(c => `• ${c.sku} — ${c.nombre} (${c.tipo})`)
        .join('\n');

      const aceptar = confirm(
        `⚠️ Ese código ya está en uso:\n\n${lista}\n\n` +
        `¿Deseas agregar este mismo código también a ESTE producto?\n\n` +
        `Aceptar = sí, usarlo igual\nCancelar = no guardar`
      );

      if (aceptar) {
        // Reintentar forzando el guardado
        return guardarCodigo(codigo, inputManualEl, true);
      }
      return;
    }

    if (data.ok) {
      beepSuccess();
      const extra = data.advertencia ? ` (${data.advertencia})` : '';
      showToast(`Guardado como ${tipoVinculo}: ${data.data.nombre} → ${codigo}${extra}`, 'success');
      await stopVinculoScanner();
      ocultarConfirmacionVinculo();
      if (inputManualEl) inputManualEl.value = '';

      const idGuardado = productoSeleccionado;
      await cargarProductos();
      await cargarCatalogo();
      seleccionarProducto(idGuardado);
    } else {
      beepError();
      showToast(data.error || 'No se pudo guardar el código', 'error');
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('archivo', file);

    const resumenEl = document.getElementById('resumen-importacion');
    resumenEl.innerHTML = `<p class="text-sm text-slate-500">Procesando archivo...</p>`;

    const data = await apiFetch('/productos/importar', { method: 'POST', body: formData });
    if (!data.ok) {
      resumenEl.innerHTML = `<p class="text-sm text-rose-600">${escapeHtml(data.error)}</p>`;
      showToast(data.error, 'error');
      return;
    }

    const { totalFilas, creados, actualizados, codigosAsignados, cajasAsignadas, errores } = data.resumen;
    resumenEl.innerHTML = `
      <div class="text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
        <p><b>${totalFilas}</b> filas &middot; <b class="text-emerald-700">${creados}</b> creados &middot; <b class="text-amber-700">${actualizados}</b> actualizados &middot; <b class="text-sky-700">${codigosAsignados || 0}</b> cod. unidad &middot; <b class="text-purple-700">${cajasAsignadas || 0}</b> cod. caja</p>
        ${errores.length ? `<p class="text-rose-600 text-xs">${errores.length} advertencia(s): ${errores.slice(0,3).map(escapeHtml).join(' · ')}${errores.length > 3 ? '…' : ''}</p>` : ''}
      </div>`;
    if (errores.length) console.warn('Advertencias de importacion:', errores);

    showToast('Importacion completada', 'success');
    e.target.value = '';
    cargarProductos();
    cargarCatalogo();
  }

async function cargarProductos() {
    const data = await apiFetch('/productos');
    const select = document.getElementById('select-producto-codigo');
    if (!data.ok || data.data.length === 0) {
      productosCache = [];
      if (select) select.innerHTML = `<option value="">No hay productos cargados aun</option>`;
      renderizarListaConCodigo();
      return;
    }
    productosCache = data.data;
    if (select) {
      select.innerHTML = `<option value="">Selecciona un producto...</option>` +
        data.data.map(p => `<option value="${p.id}">${(p.codigo_barras || p.codigo_caja) ? '🔗' : '⚪'} ${escapeHtml(p.sku)} — ${escapeHtml(p.nombre)}</option>`).join('');
    }
    renderizarListaConCodigo();
  }

  async function cargarCatalogo() {
    const data = await apiFetch('/productos');
    if (!data.ok) return;
    productosCache = data.data;
    renderizarListaCatalogo();
    renderizarListaConCodigo();
  }

  function renderizarListaCatalogo() {
    const lista = document.getElementById('lista-catalogo');
    const totalEl = document.getElementById('total-catalogo');
    const filtroInput = document.getElementById('input-filtro-catalogo');
    const query = filtroInput ? filtroInput.value.toLowerCase().trim() : '';

    if (!lista) return;

    const filtrados = productosCache.filter(p => 
      p.nombre.toLowerCase().includes(query) || 
      p.sku.toLowerCase().includes(query) ||
      (p.categoria && p.categoria.toLowerCase().includes(query)) ||
      (p.subcategoria && p.subcategoria.toLowerCase().includes(query))
    );

    totalEl.textContent = filtrados.length;

    const aMostrar = query ? filtrados : filtrados.slice(0, limiteCatalogo);

    lista.innerHTML = aMostrar.map(p => {
      const upc = p.unidades_por_caja || 1;
      const cajas = Math.floor(p.stock / upc);
      const sueltas = p.stock % upc;
      const desglose = upc > 1 ? ` (${cajas} cjs + ${sueltas} und)` : '';

      return `
        <div class="py-2 flex justify-between items-center text-sm">
          <div>
            <p class="font-medium text-slate-800">${escapeHtml(p.nombre)}</p>
            <p class="text-xs text-slate-400">
              SKU ${escapeHtml(p.sku)}
              ${p.categoria ? '· ' + escapeHtml(p.categoria) : ''}${p.subcategoria ? ' / ' + escapeHtml(p.subcategoria) : ''}
              ${p.ubicacion ? '· 📍 ' + escapeHtml(p.ubicacion) : ''}
              ${p.codigo_barras ? '· 🔗 Und: ' + escapeHtml(p.codigo_barras) : ''}
              ${p.codigo_caja ? '· 📦 Cj: ' + escapeHtml(p.codigo_caja) : ''}
            </p>
          </div>
          <span class="text-xs font-semibold ${p.stock > 0 ? 'text-slate-600' : 'text-rose-500'}">
            ${p.stock} und${desglose}
          </span>
        </div>
      `;
    }).join('') || `<p class="text-sm text-slate-400 py-4 text-center">Sin resultados encontrados.</p>`;
  }

    function renderizarListaConCodigo() {
    const lista = document.getElementById('lista-con-codigo');
    const totalEl = document.getElementById('total-con-codigo');
    const filtroInput = document.getElementById('input-buscar-con-codigo');
    if (!lista) return;

    const q = (filtroInput ? filtroInput.value : '').toLowerCase().trim();

    // Solo productos que YA tienen código
    let base = productosCache.filter(p => p.codigo_barras || p.codigo_caja);

    const filtrados = !q ? base : base.filter(p =>
      (p.nombre && p.nombre.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.codigo_barras && String(p.codigo_barras).toLowerCase().includes(q)) ||
      (p.codigo_caja && String(p.codigo_caja).toLowerCase().includes(q)) ||
      (p.categoria && p.categoria.toLowerCase().includes(q))
    );

    if (totalEl) totalEl.textContent = filtrados.length;

    const aMostrar = filtrados.slice(0, limiteConCodigo);
    const hayMas = filtrados.length > aMostrar.length;

    lista.innerHTML = aMostrar.map(p => {
      const sel = String(p.id) === String(productoSeleccionado);
      return `
        <button type="button" data-id-producto="${p.id}"
          class="w-full text-left px-3 py-2.5 text-sm hover:bg-sky-50 ${sel ? 'bg-sky-100 ring-1 ring-sky-300' : ''}">
          <p class="font-medium text-slate-800 truncate">${escapeHtml(p.nombre)}</p>
          <p class="text-[11px] text-slate-500">
            SKU ${escapeHtml(p.sku)}
            ${p.codigo_barras ? ' · 🥄 ' + escapeHtml(p.codigo_barras) : ''}
            ${p.codigo_caja ? ' · 📦 ' + escapeHtml(p.codigo_caja) : ''}
          </p>
        </button>`;
    }).join('') || `<p class="text-xs text-slate-400 py-4 text-center">Aún no hay productos con código. Asigna uno en Vincular arriba.</p>`;

    if (hayMas) {
      lista.innerHTML += `<p class="text-[10px] text-center text-slate-400 py-2">Baja para ver más (${aMostrar.length} de ${filtrados.length})...</p>`;
    }
  }

  function mostrarEditorConCodigo(producto) {
    const wrap = document.getElementById('editor-con-codigo');
    if (!wrap || !producto) return;
    document.getElementById('editor-con-codigo-nombre').textContent =
      `${producto.sku} — ${producto.nombre}`;
    document.getElementById('editor-cod-unidad').textContent =
      producto.codigo_barras || '— sin código —';
    document.getElementById('editor-cod-caja').textContent =
      producto.codigo_caja
        ? `${producto.codigo_caja} (${producto.unidades_por_caja || 1} und/caja)`
        : '— sin código —';

    const upcEl = document.getElementById('editor-input-upc');
    if (upcEl) upcEl.value = producto.unidades_por_caja || 1;

    const btnQuitarUnd = document.getElementById('editor-btn-quitar-und');
    const btnQuitarCaja = document.getElementById('editor-btn-quitar-caja');
    if (btnQuitarUnd) btnQuitarUnd.disabled = !producto.codigo_barras;
    if (btnQuitarCaja) btnQuitarCaja.disabled = !producto.codigo_caja;
    wrap.classList.remove('hidden');
  }

  let vinculoProcesandoScan = false;

      function startVinculoScanner() {
    if (!productoSeleccionado) {
      showToast('Selecciona un producto primero', 'error');
      return;
    }
    vinculoProcesandoScan = false;
    ocultarConfirmacionVinculo();

    const wrapScan = document.getElementById('vinculo-scanner-wrap');
    const btnStart = document.getElementById('btn-start-vinculo');
    if (wrapScan) wrapScan.classList.remove('hidden');
    if (btnStart) btnStart.classList.add('hidden');

    scanner = new BarcodeScanner('reader-carga', (codigo) => {
      onCodigoEscaneadoVinculo(codigo);
    });
    scanner.start();
  }

    async function onCodigoEscaneadoVinculo(codigo) {
    if (vinculoProcesandoScan) return;
    vinculoProcesandoScan = true;
    try {
      // Detener cámara pero NO dejar el botón perdido si falla la confirmación
      await stopVinculoScanner(true);
      const limpio = (typeof normalizarCodigoBarras === 'function')
        ? normalizarCodigoBarras(codigo)
        : String(codigo || '').trim();

      if (!limpio) {
        showToast('No se pudo leer un código válido. Intenta de nuevo.', 'error');
        // Restaurar botón de cámara
        const btnStart = document.getElementById('btn-start-vinculo');
        if (btnStart) {
          btnStart.classList.remove('hidden');
          btnStart.disabled = !productoSeleccionado;
        }
        return;
      }

      mostrarConfirmacionVinculo(limpio);
    } catch (err) {
      console.error(err);
      showToast('Error al procesar el escaneo', 'error');
      const btnStart = document.getElementById('btn-start-vinculo');
      if (btnStart) {
        btnStart.classList.remove('hidden');
        btnStart.disabled = !productoSeleccionado;
      }
    } finally {
      setTimeout(() => { vinculoProcesandoScan = false; }, 400);
    }
  }

  async function stopVinculoScanner(mantenerOcultoStart = false) {
    if (scanner) {
      try { await scanner.stop(); } catch (e) { /* ignore */ }
      scanner = null;
    }
    const wrapScan = document.getElementById('vinculo-scanner-wrap');
    if (wrapScan) wrapScan.classList.add('hidden');
    const btnStart = document.getElementById('btn-start-vinculo');
    if (btnStart && !mantenerOcultoStart) {
      btnStart.classList.remove('hidden');
      btnStart.disabled = !productoSeleccionado;
    }
  }

    function mostrarConfirmacionVinculo(codigo) {
    const producto = productosCache.find(p => String(p.id) === String(productoSeleccionado));
    const tipoVinculo = document.querySelector('input[name="tipo_vinculo"]:checked')?.value || 'UNIDAD';
    const tipoTexto = tipoVinculo === 'CAJA'
      ? '📦 Código de Caja Máster'
      : '🥄 Código de Unidad';

    const wrap = document.getElementById('vinculo-confirm-wrap');
    const nombreEl = document.getElementById('vinculo-confirm-nombre');
    const tipoEl = document.getElementById('vinculo-confirm-tipo');
    const codigoEl = document.getElementById('vinculo-confirm-codigo');
    const btnStart = document.getElementById('btn-start-vinculo');

    if (!wrap || !nombreEl || !tipoEl || !codigoEl) {
      showToast('Panel de confirmación no encontrado. Recarga con Ctrl+F5.', 'error');
      if (btnStart) {
        btnStart.classList.remove('hidden');
        btnStart.disabled = !productoSeleccionado;
      }
      return;
    }

    nombreEl.textContent = producto
      ? `${producto.sku} — ${producto.nombre}`
      : '(producto no seleccionado)';
    tipoEl.textContent = tipoTexto;
    codigoEl.value = (typeof normalizarCodigoBarras === 'function')
      ? normalizarCodigoBarras(codigo || '')
      : String(codigo || '').trim();

    // Cámara cerrada; el botón se queda oculto mientras se confirma
    if (btnStart) btnStart.classList.add('hidden');
    wrap.classList.remove('hidden');
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    beepSuccess();
    setTimeout(() => {
      codigoEl.focus();
      codigoEl.select();
    }, 120);
  }

      function ocultarConfirmacionVinculo() {
    const wrap = document.getElementById('vinculo-confirm-wrap');
    if (wrap) wrap.classList.add('hidden');
    const codigoEl = document.getElementById('vinculo-confirm-codigo');
    if (codigoEl) codigoEl.value = '';

    const btnStart = document.getElementById('btn-start-vinculo');
    if (btnStart) {
      btnStart.classList.remove('hidden');
      btnStart.disabled = !productoSeleccionado;
    }
  }

  async function aceptarConfirmacionVinculo() {
  const codigoEl = document.getElementById('vinculo-confirm-codigo');
  
  // Forzar siempre la normalización antes de guardar
  const codigo = codigoEl ? normalizarCodigoBarras(codigoEl.value) : '';

  if (!codigo) {
    showToast('El código de barras no puede estar vacío', 'error');
    return;
  }
  if (!productoSeleccionado) {
    showToast('Selecciona un producto primero', 'error');
    return;
  }
  
  ocultarConfirmacionVinculo();
  await guardarCodigo(codigo);
}

  function cancelarConfirmacionVinculo() {
    ocultarConfirmacionVinculo();
    showToast('Operación cancelada', 'info');
  }

  function reintentarEscaneoVinculo() {
    ocultarConfirmacionVinculo();
    startVinculoScanner();
  }

    function startScannerNuevoProducto() {
    const wrap = document.getElementById('scanner-nuevo-wrap');
    if (!wrap) return;
    wrap.classList.remove('hidden');

    // Centrar la sección de la cámara en pantalla
    setTimeout(() => {
      wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    scanner = new BarcodeScanner('reader-nuevo-producto', (codigo) => {
      const inputCodigo = document.getElementById('f-codigo');
      if (inputCodigo) {
        inputCodigo.value = codigo;
        beepSuccess();
        showToast(`Código escaneado: ${codigo}`, 'success');
      }
      stopScannerNuevoProducto();
    });
    scanner.start();
  }

  async function stopScannerNuevoProducto() {
    if (scanner) await scanner.stop();
    const wrap = document.getElementById('scanner-nuevo-wrap');
    if (wrap) wrap.classList.add('hidden');
  }

  function onLeaveTab() {
    stopVinculoScanner();
    stopScannerNuevoProducto();
    stopScannerEntrada();
  }

  return { render, onLeaveTab };
})();

async function autocompletarSiguienteSku() {
  try {
    const res = await apiFetch('/productos/siguiente-sku');
    if (res.ok && res.siguienteSku) {
      const skuInput = document.getElementById('f-sku');
      if (skuInput) {
        skuInput.value = res.siguienteSku;
      }
    }
  } catch (err) {
    console.error('Error al autocompletar SKU:', err);
  }
}