// ============================================================
// Utilidades compartidas: cliente API + Toast de notificaciones
// ============================================================

const API_BASE = '/api';

async function apiFetch(url, options = {}) {
  let res;
  const token = localStorage.getItem('jispi_token');
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  try {
    res = await fetch(API_BASE + url, {
      ...options,
      headers,
    });
  } catch (e) {
    // fetch() lanza cuando no hay red o el servidor esta caido (no cuando responde con error HTTP)
    return { ok: false, error: 'Sin conexion con el servidor. Verifica tu red e intenta de nuevo.' };
  }

  let data;
  try {
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch (_) {
      // Si el servidor respondió HTML o texto plano con error
      const cleanText = (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      data = { ok: false, error: cleanText ? cleanText.slice(0, 150) : `Error ${res.status} del servidor.` };
    }
  } catch (e) {
    data = { ok: false, error: `Error ${res.status || ''} al comunicar con el servidor.` };
  }
  if (!res.ok && data.ok !== false) data.ok = false;

  // Si la sesión expiró o es inválida, invocar cierre automático
  if (res.status === 401 && !url.includes('/auth/login')) {
    if (typeof Auth !== 'undefined' && typeof Auth.handleUnauthorized === 'function') {
      Auth.handleUnauthorized();
    }
  }

  return data;
}

function showToast(mensaje, tipo = 'info') {
  const el = document.getElementById('toast');
  const colores = {
    info: 'bg-slate-800',
    success: 'bg-emerald-600',
    error: 'bg-rose-600',
  };
  el.innerHTML = `
    <div class="${colores[tipo] || colores.info} text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg text-center">
      ${mensaje}
    </div>`;
  el.classList.remove('hidden');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.add('hidden'), 3000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatMoney(n) {
  const num = Math.round(Number(n) || 0);
  return num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Limpia y normaliza lo que devuelve la cámara / foto / pistola lectora.
 * - Quita caracteres de control e invisibles
 * - Quita prefijos AIM (]C1, ]C0, ]e0, ]Q3, etc.)
 * - Si es GS1 (01) extrae el GTIN de 14 dígitos limpio
 */
function normalizarCodigoBarras(raw) {
  if (raw == null) return '';
  let t = String(raw).trim();

  // 1. Quitar caracteres de control e invisibles
  t = t.replace(/[\x00-\x1F\x7F\uFFFD]/g, '');

  // 2. Si empieza por ]C1, ]C0, [c1, etc., remueve el prefijo AIM (] + 1 letra + 1 digito/letra)
  t = t.replace(/^(\]C1|\]C0|\[c1|\[C1|\][a-zA-Z][0-9a-zA-Z])/i, '');

  // 3. Quitar todos los espacios y corchetes sobrantes
  t = t.replace(/[\s\[\]]+/g, '');

  // 4. Caso GS1: Si contiene paréntesis (01)17709279644693
  const matchAI = t.match(/\(0?1\)\s*(\d{12,14})/);
  if (matchAI) {
    return matchAI[1];
  }

  // 5. Si empieza con el AI "01" seguido de 14 dígitos (ej: 0117709279644693)
  if (/^01\d{14}/.test(t)) {
    return t.slice(2, 16);
  }

  // 6. Si quedaron solo dígitos y tiene longitud 16 empezando con 01
  if (t.length === 16 && t.startsWith('01')) {
    return t.slice(2);
  }

  return t;
}

// ============================================================
// Autocompletado de productos (usa GET /api/productos/sugerencias?q=)
// ============================================================
function attachAutocompleteProductos(inputEl, dropdownEl, onSelect, opts = {}) {
  let debounceTimer = null;
  let items = [];
  let activeIndex = -1;
  let currentQuery = '';
  let total = 0;
  let cargando = false;
  const PAGE_SIZE = 10; // de 10 en 10
  const UMBRAL_SCROLL_PX = 60;
  const soloConCodigo = !!opts.soloConCodigo;

  function ocultar() {
    dropdownEl.classList.add('hidden');
    dropdownEl.innerHTML = '';
    items = [];
    activeIndex = -1;
    total = 0;
    cargando = false;
  }

  function crearFila(p, i) {
    const codigos = [
      p.codigo_barras ? `Und: ${p.codigo_barras}` : null,
      p.codigo_caja ? `Caja: ${p.codigo_caja}` : null,
    ].filter(Boolean).join(' · ');
    return `
      <div class="autocomplete-item px-3 py-2 text-sm cursor-pointer border-b border-slate-100 last:border-b-0 ${i === activeIndex ? 'bg-slate-100' : ''}"
           data-idx="${i}">
        <p class="font-medium text-slate-800">${(p.codigo_barras || p.codigo_caja) ? '🔗' : '⚪'} ${escapeHtml(p.nombre)}</p>
        <p class="text-xs text-slate-400">SKU ${escapeHtml(p.sku)}${p.categoria ? ' · ' + escapeHtml(p.categoria) : ''} · stock ${p.stock}</p>
        ${codigos ? `<p class="text-[11px] text-slate-400 font-mono">${escapeHtml(codigos)}</p>` : ''}
      </div>`;
  }

  function actualizarIndicador() {
    // quitar indicador viejo si existe
    const viejo = dropdownEl.querySelector('#autocomplete-cargando');
    if (viejo) viejo.remove();

    const restantes = total - items.length;
    if (restantes > 0 || cargando) {
      const div = document.createElement('div');
      div.id = 'autocomplete-cargando';
      div.className = 'text-center text-xs text-slate-400 py-2';
      div.textContent = cargando ? 'Cargando más...' : 'Desplázate para cargar más...';
      dropdownEl.appendChild(div);
    }
  }

  function pintar(esAppend = false) {
    if (!items.length) { ocultar(); return; }

    if (!esAppend) {
      // primera carga o reset → pintamos todo
      const filas = items.map((p, i) => crearFila(p, i)).join('');
      dropdownEl.innerHTML = filas;
      dropdownEl.classList.remove('hidden');
    } else {
      // carga de más páginas → solo añadimos las nuevas filas (NO tocamos scrollTop)
      const desde = dropdownEl.querySelectorAll('.autocomplete-item').length;
      const nuevas = items.slice(desde).map((p, i) => crearFila(p, desde + i)).join('');
      // insertamos antes del indicador (si existe)
      const indicador = dropdownEl.querySelector('#autocomplete-cargando');
      if (indicador) {
        indicador.insertAdjacentHTML('beforebegin', nuevas);
      } else {
        dropdownEl.insertAdjacentHTML('beforeend', nuevas);
      }
    }

    // re-asignar listeners solo a los items (los viejos ya los tienen)
    dropdownEl.querySelectorAll('.autocomplete-item').forEach(el => {
      // evitamos duplicar listeners
      if (el.dataset.listener) return;
      el.dataset.listener = '1';
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const p = items[Number(el.dataset.idx)];
        ocultar();
        onSelect(p);
      });
    });

    actualizarIndicador();

    // Si todavía hay más y el contenido no llena el contenedor (no hay scrollbar),
    // cargamos automáticamente la siguiente página.
    requestAnimationFrame(() => {
      if (cargando) return;
      if (items.length >= total) return;
      const noHayScroll = dropdownEl.scrollHeight <= dropdownEl.clientHeight + 5;
      const cercaDelFinal = (dropdownEl.scrollHeight - dropdownEl.scrollTop - dropdownEl.clientHeight) < UMBRAL_SCROLL_PX;
      if (noHayScroll || cercaDelFinal) {
        buscar(currentQuery, false);
      }
    });
  }

  async function buscar(q, reset) {
    if (!q || q.trim().length < 2) { ocultar(); return; }
    if (reset) {
      currentQuery = q.trim();
      items = [];
      dropdownEl.scrollTop = 0;
    }
    if (cargando) return;
    if (!reset && items.length >= total && total > 0) return;

    cargando = true;
    actualizarIndicador(); // muestra “Cargando más...” inmediatamente

    const extra = soloConCodigo ? '&con_codigo=1' : '';
    const data = await apiFetch(`/productos/sugerencias?q=${encodeURIComponent(currentQuery)}&limit=${PAGE_SIZE}&offset=${items.length}${extra}`);

    cargando = false;

    if (!data.ok) {
      // si falla una página de “más”, NO borramos lo que ya se veía
      if (reset) ocultar();
      else actualizarIndicador();
      return;
    }

    const nuevos = data.data || [];
    items = items.concat(nuevos);
    total = data.total ?? items.length;
    activeIndex = -1;

    pintar(!reset); // true = append (no resetea scroll)
  }

  // Scroll infinito
  dropdownEl.addEventListener('scroll', () => {
    if (cargando) return;
    if (items.length >= total) return;
    const faltanPx = dropdownEl.scrollHeight - dropdownEl.scrollTop - dropdownEl.clientHeight;
    if (faltanPx < UMBRAL_SCROLL_PX) {
      buscar(currentQuery, false);
    }
  });

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => buscar(inputEl.value, true), 250);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (dropdownEl.classList.contains('hidden') || !items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      // solo actualizamos la clase active sin re-pintar todo
      dropdownEl.querySelectorAll('.autocomplete-item').forEach((el, i) => {
        el.classList.toggle('bg-slate-100', i === activeIndex);
      });
      // precargar si estamos cerca del final
      if (activeIndex >= items.length - 2 && !cargando && items.length < total) {
        buscar(currentQuery, false);
      }
      // hacer visible el item activo
      const activo = dropdownEl.querySelector(`.autocomplete-item[data-idx="${activeIndex}"]`);
      if (activo) activo.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      dropdownEl.querySelectorAll('.autocomplete-item').forEach((el, i) => {
        el.classList.toggle('bg-slate-100', i === activeIndex);
      });
      const activo = dropdownEl.querySelector(`.autocomplete-item[data-idx="${activeIndex}"]`);
      if (activo) activo.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        const p = items[activeIndex];
        ocultar();
        onSelect(p);
      }
    } else if (e.key === 'Escape') {
      ocultar();
    }
  });

  inputEl.addEventListener('blur', () => setTimeout(ocultar, 150));
}

// ============================================================
// Autocompletado de clientes + Modal Formulario Flotante
// ============================================================
function attachAutocompleteClientes(inputEl, dropdownEl, onSelect, onClienteCreado) {
  let debounceTimer = null;
  let clientes = [];

  function ocultar() {
    dropdownEl.classList.add('hidden');
    dropdownEl.innerHTML = '';
    clientes = [];
  }

  function pintar(query) {
    let html = clientes.map((c, i) => `
      <div class="autocomplete-cliente-item px-3 py-2 text-sm cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
           data-idx="${i}">
        <p class="font-medium text-slate-800">${escapeHtml(c.nombre)} ${c.empresa ? '· ' + escapeHtml(c.empresa) : ''}</p>
        <p class="text-xs text-slate-400">${c.ciudad ? escapeHtml(c.ciudad) : ''} ${c.telefono ? '· 📞 ' + escapeHtml(c.telefono) : ''}</p>
      </div>
    `).join('');

    if (query && query.trim().length > 0) {
      html += `
        <div id="btn-crear-cliente-sug" class="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 cursor-pointer text-sm text-emerald-800 font-semibold border-t border-slate-100 flex items-center gap-1">
          ➕ Registrar "${escapeHtml(query)}" como cliente nuevo
        </div>
      `;
    }

    dropdownEl.innerHTML = html;
    dropdownEl.classList.remove('hidden');

    dropdownEl.querySelectorAll('.autocomplete-cliente-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const c = clientes[Number(el.dataset.idx)];
        ocultar();
        onSelect(c);
      });
    });

    const btnCrear = dropdownEl.querySelector('#btn-crear-cliente-sug');
    if (btnCrear) {
      btnCrear.addEventListener('mousedown', (e) => {
        e.preventDefault();
        ocultar();
        abrirModalNuevoCliente(query.trim(), onClienteCreado);
      });
    }
  }

  async function buscar(q) {
    if (!q || q.trim().length === 0) { ocultar(); return; }
    const res = await apiFetch('/clientes/sugerencias?q=' + encodeURIComponent(q.trim()));
    clientes = (res.ok && res.data) ? res.data : [];
    pintar(q);
  }

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => buscar(inputEl.value), 200);
  });

  inputEl.addEventListener('blur', () => setTimeout(ocultar, 150));
}

// Ventana Modal superpuesta para registrar nuevo cliente
function abrirModalNuevoCliente(nombreInicial, onClienteCreado) {
  let modal = document.getElementById('modal-nuevo-cliente');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-nuevo-cliente';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
        <div>
          <h3 class="font-bold text-slate-800 text-base">👤 Registrar Nuevo Cliente</h3>
          <p class="text-xs text-slate-400">Solo el nombre es obligatorio para guardar.</p>
        </div>
        <button id="btn-cerrar-modal-cliente" class="text-slate-400 hover:text-slate-600 font-bold text-lg p-1">✕</button>
      </div>

      <form id="form-modal-cliente" class="space-y-3" onsubmit="return false;">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo <span class="text-rose-500">*</span></label>
          <input id="mc-nombre" type="text" value="${escapeHtml(nombreInicial)}" placeholder="Ej: Maria Lopez" required
                 class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1">Empresa / Negocio <span class="text-slate-400 font-normal">(opcional)</span></label>
          <input id="mc-empresa" type="text" placeholder="Ej: Distribuidora Central"
                 class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1">Dirección de Entrega <span class="text-slate-400 font-normal">(opcional)</span></label>
          <input id="mc-direccion" type="text" placeholder="Ej: Calle 15 # 12-34, Local 2"
                 class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Teléfono <span class="text-slate-400 font-normal">(opcional)</span></label>
            <input id="mc-telefono" type="text" placeholder="Ej: 3001234567"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Ciudad <span class="text-slate-400 font-normal">(opcional)</span></label>
            <input id="mc-ciudad" type="text" placeholder="Ej: Armenia"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div id="mc-error" class="text-xs text-rose-600 hidden bg-rose-50 p-2 rounded-lg border border-rose-200"></div>

        <div class="flex gap-2 pt-2">
          <button id="btn-cancelar-modal-cliente" type="button" class="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200">Cancelar</button>
          <button id="btn-guardar-modal-cliente" type="button" class="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm shadow-sm hover:bg-emerald-700">Guardar Cliente</button>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');
  const inputNombre = document.getElementById('mc-nombre');
  inputNombre.focus();

  const cerrar = () => modal.classList.add('hidden');

  document.getElementById('btn-cerrar-modal-cliente').onclick = cerrar;
  document.getElementById('btn-cancelar-modal-cliente').onclick = cerrar;

  document.getElementById('btn-guardar-modal-cliente').onclick = async () => {
    const errorEl = document.getElementById('mc-error');
    errorEl.classList.add('hidden');

    const payload = {
      nombre: inputNombre.value.trim(),
      empresa: document.getElementById('mc-empresa').value.trim(),
      direccion: document.getElementById('mc-direccion').value.trim(),
      telefono: document.getElementById('mc-telefono').value.trim(),
      ciudad: document.getElementById('mc-ciudad').value.trim(),
    };

    if (!payload.nombre) {
      errorEl.textContent = 'El nombre del cliente es obligatorio.';
      errorEl.classList.remove('hidden');
      return;
    }

    const res = await apiFetch('/clientes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      cerrar();
      showToast(`Cliente "${res.data.nombre}" creado con éxito`, 'success');
      if (onClienteCreado) onClienteCreado(res.data);
    } else {
      errorEl.textContent = res.error || 'No se pudo guardar el cliente.';
      errorEl.classList.remove('hidden');
    }
  };
}

// ============================================================
// Modal para Editar Cliente Existente
// ============================================================
function abrirModalEditarCliente(cliente, onClienteActualizado) {
  if (!cliente || !cliente.id) {
    showToast('Datos de cliente inválidos para editar', 'error');
    return;
  }

  let modal = document.getElementById('modal-editar-cliente');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-editar-cliente';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
        <div>
          <h3 class="font-bold text-slate-800 text-base flex items-center gap-1.5">
            <span>✏️</span> Editar Cliente #${cliente.id}
          </h3>
          <p class="text-xs text-slate-400">Modifica los datos del cliente y guarda los cambios.</p>
        </div>
        <button id="btn-cerrar-modal-edit-cliente" class="text-slate-400 hover:text-slate-600 font-bold text-lg p-1">✕</button>
      </div>

      <form id="form-modal-edit-cliente" class="space-y-3" onsubmit="return false;">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo <span class="text-rose-500">*</span></label>
          <input id="edit-c-nombre" type="text" value="${escapeHtml(cliente.nombre || '')}" required
                 class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1">Empresa / Negocio <span class="text-slate-400 font-normal">(opcional)</span></label>
          <input id="edit-c-empresa" type="text" value="${escapeHtml(cliente.empresa || '')}" placeholder="Ej: Distribuidora Central"
                 class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1">Dirección de Entrega <span class="text-slate-400 font-normal">(opcional)</span></label>
          <input id="edit-c-direccion" type="text" value="${escapeHtml(cliente.direccion || '')}" placeholder="Ej: Calle 15 # 12-34, Local 2"
                 class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Teléfono <span class="text-slate-400 font-normal">(opcional)</span></label>
            <input id="edit-c-telefono" type="text" value="${escapeHtml(cliente.telefono || '')}" placeholder="Ej: 3001234567"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Ciudad <span class="text-slate-400 font-normal">(opcional)</span></label>
            <input id="edit-c-ciudad" type="text" value="${escapeHtml(cliente.ciudad || '')}" placeholder="Ej: Armenia"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div id="edit-c-error" class="text-xs text-rose-600 hidden bg-rose-50 p-2 rounded-lg border border-rose-200"></div>

        <div class="flex gap-2 pt-2">
          <button id="btn-cancelar-modal-edit-cliente" type="button" class="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200">Cancelar</button>
          <button id="btn-guardar-modal-edit-cliente" type="button" class="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm shadow-sm hover:bg-emerald-700 flex items-center justify-center gap-1">
            <span>💾</span> Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');
  const inputNombre = document.getElementById('edit-c-nombre');
  inputNombre.focus();
  inputNombre.select();

  const cerrar = () => modal.classList.add('hidden');
  document.getElementById('btn-cerrar-modal-edit-cliente').onclick = cerrar;
  document.getElementById('btn-cancelar-modal-edit-cliente').onclick = cerrar;

  document.getElementById('btn-guardar-modal-edit-cliente').onclick = async () => {
    const errorEl = document.getElementById('edit-c-error');
    errorEl.classList.add('hidden');

    const payload = {
      nombre: inputNombre.value.trim(),
      empresa: document.getElementById('edit-c-empresa').value.trim(),
      direccion: document.getElementById('edit-c-direccion').value.trim(),
      telefono: document.getElementById('edit-c-telefono').value.trim(),
      ciudad: document.getElementById('edit-c-ciudad').value.trim(),
    };

    if (!payload.nombre) {
      errorEl.textContent = 'El nombre del cliente es obligatorio.';
      errorEl.classList.remove('hidden');
      return;
    }

    const res = await apiFetch(`/clientes/${cliente.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      cerrar();
      showToast(`Cliente "${payload.nombre}" actualizado con éxito`, 'success');
      if (onClienteActualizado) onClienteActualizado(res.data || payload);
    } else {
      errorEl.textContent = res.error || 'No se pudo actualizar el cliente.';
      errorEl.classList.remove('hidden');
    }
  };
}

// ============================================================
// Modal Directorio Completo y Gestión de Clientes
// ============================================================
function abrirModalGestionClientes() {
  let modal = document.getElementById('modal-gestion-clientes');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-gestion-clientes';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <!-- Encabezado -->
      <div class="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-2xl">👥</span>
          <div>
            <h3 class="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
              Gestión de Clientes
              <span id="gc-badge-total" class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">Cargando...</span>
            </h3>
            <p class="text-xs text-slate-500">Consulta, edita, descarga y sube masivamente la base de clientes de Jispiplast.</p>
          </div>
        </div>
        <button id="btn-cerrar-gestion-clientes" class="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 py-1 rounded-lg hover:bg-slate-200">✕</button>
      </div>

      <!-- Barra de herramientas: Búsqueda y Botones de Acción -->
      <div class="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <!-- Buscador en tiempo real -->
        <div class="relative flex-1">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 text-sm">🔍</span>
          <input id="gc-input-buscar" type="text" placeholder="Buscar por nombre, empresa, teléfono, dirección o ciudad..."
                 class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>

        <!-- Botones de Acción -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Descargar Excel -->
          <a href="/api/clientes/exportar" download="base_clientes.xlsx"
             class="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-xs"
             title="Descargar base de clientes en archivo Excel (.xlsx)">
            <span>⬇️</span> Descargar Excel
          </a>

          <!-- Subir Masivo Excel/CSV -->
          <label class="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                 title="Cargar o actualizar clientes desde archivo Excel (.xlsx/.csv)">
            <span>📄</span> Subir Masivo
            <input type="file" id="gc-file-importar" accept=".xlsx,.xls,.csv" class="hidden" />
          </label>

          <!-- Nuevo Cliente -->
          <button id="gc-btn-nuevo-cliente"
                  class="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs">
            <span>➕</span> Nuevo Cliente
          </button>
        </div>
      </div>

      <!-- Contenedor de la Tabla con scroll -->
      <div class="flex-1 overflow-y-auto p-4 bg-slate-50">
        <div id="gc-tabla-contenedor" class="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div class="p-8 text-center text-slate-400 text-sm">Cargando lista de clientes...</div>
        </div>
      </div>

      <!-- Pie de página informativo -->
      <div class="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 px-4">
        <span id="gc-info-conteo">Mostrando clientes...</span>
        <button id="btn-cerrar-gestion-clientes-pie" class="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs">Cerrar</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  const inputBuscar = document.getElementById('gc-input-buscar');
  const tablaContenedor = document.getElementById('gc-tabla-contenedor');
  const badgeTotal = document.getElementById('gc-badge-total');
  const infoConteo = document.getElementById('gc-info-conteo');
  const fileImportar = document.getElementById('gc-file-importar');
  const btnNuevo = document.getElementById('gc-btn-nuevo-cliente');

  const cerrar = () => modal.classList.add('hidden');
  document.getElementById('btn-cerrar-gestion-clientes').onclick = cerrar;
  document.getElementById('btn-cerrar-gestion-clientes-pie').onclick = cerrar;

  btnNuevo.onclick = () => {
    abrirModalNuevoCliente('', () => cargarLista(inputBuscar.value));
  };

  // Subida masiva de archivo
  fileImportar.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('archivo', file);
    showToast('Procesando archivo masivo de clientes...', 'info');

    tablaContenedor.innerHTML = `
      <div class="p-8 text-center text-slate-500 text-sm animate-pulse">
        ⏳ Procesando archivo de clientes... Por favor espera.
      </div>
    `;

    const res = await apiFetch('/clientes/importar', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      showToast(`¡Importación exitosa! ${res.resumen.creados} nuevos, ${res.resumen.actualizados} actualizados.`, 'success');
      cargarLista();
    } else {
      showToast(res.error || 'Error al procesar el archivo', 'error');
      cargarLista();
    }
    e.target.value = '';
  };

  let debounceTimer = null;
  inputBuscar.oninput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      cargarLista(inputBuscar.value);
    }, 250);
  };

  async function cargarLista(q = '') {
    const queryStr = q ? `?q=${encodeURIComponent(q.trim())}` : '';
    const res = await apiFetch(`/clientes${queryStr}`);

    if (!res.ok) {
      tablaContenedor.innerHTML = `
        <div class="p-8 text-center text-rose-500 text-sm">
          Error al cargar clientes: ${escapeHtml(res.error || 'Desconocido')}
        </div>
      `;
      return;
    }

    const lista = res.data || [];
    const total = res.total ?? lista.length;
    badgeTotal.textContent = `${total} total`;
    infoConteo.textContent = `Mostrando ${lista.length} de ${total} clientes`;

    if (lista.length === 0) {
      tablaContenedor.innerHTML = `
        <div class="p-8 text-center space-y-3">
          <p class="text-3xl">📭</p>
          <p class="text-sm font-semibold text-slate-600">No se encontraron clientes${q ? ` para "${escapeHtml(q)}"` : ''}</p>
          <p class="text-xs text-slate-400">Puedes agregar un nuevo cliente o importar una lista en Excel.</p>
          <button onclick="abrirModalNuevoCliente('${escapeHtml(q)}', () => abrirModalGestionClientes())"
                  class="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
            ➕ Crear cliente nuevo
          </button>
        </div>
      `;
      return;
    }

    let rowsHtml = lista.map((c) => {
      const tel = c.telefono ? `<a href="tel:${escapeHtml(c.telefono)}" class="text-emerald-700 hover:underline font-mono">📞 ${escapeHtml(c.telefono)}</a>` : '<span class="text-slate-300 italic">Sin tel.</span>';
      const dir = c.direccion ? escapeHtml(c.direccion) : '<span class="text-slate-300 italic">Sin dirección</span>';
      const ciudad = c.ciudad ? `<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">${escapeHtml(c.ciudad)}</span>` : '<span class="text-slate-300 italic">-</span>';
      const empresa = c.empresa ? `<span class="text-slate-500 font-medium">🏢 ${escapeHtml(c.empresa)}</span>` : '';

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
          <td class="px-3.5 py-2.5 text-xs text-slate-400 font-mono">#${c.id}</td>
          <td class="px-3.5 py-2.5 text-sm">
            <div class="font-bold text-slate-800">${escapeHtml(c.nombre)}</div>
            ${empresa ? `<div class="text-xs">${empresa}</div>` : ''}
          </td>
          <td class="px-3.5 py-2.5 text-xs">${tel}</td>
          <td class="px-3.5 py-2.5 text-xs text-slate-600 max-w-xs truncate" title="${escapeHtml(c.direccion || '')}">${dir}</td>
          <td class="px-3.5 py-2.5 text-xs">${ciudad}</td>
          <td class="px-3.5 py-2.5 text-xs text-right whitespace-nowrap">
            <button class="btn-editar-cliente px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-semibold border border-slate-200 transition-colors mr-1"
                    data-id="${c.id}" title="Editar cliente">
              ✏️ Editar
            </button>
            <button class="btn-eliminar-cliente px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-semibold border border-slate-200 transition-colors"
                    data-id="${c.id}" data-nombre="${escapeHtml(c.nombre)}" title="Eliminar cliente">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tablaContenedor.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th class="px-3.5 py-2.5 w-12">ID</th>
              <th class="px-3.5 py-2.5">Cliente / Negocio</th>
              <th class="px-3.5 py-2.5">Teléfono</th>
              <th class="px-3.5 py-2.5">Dirección</th>
              <th class="px-3.5 py-2.5">Ciudad</th>
              <th class="px-3.5 py-2.5 text-right w-28">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    // Asignar listeners a los botones de editar y eliminar
    tablaContenedor.querySelectorAll('.btn-editar-cliente').forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.id);
        const cliente = lista.find(item => item.id === id);
        if (cliente) {
          abrirModalEditarCliente(cliente, () => cargarLista(inputBuscar.value));
        }
      };
    });

    tablaContenedor.querySelectorAll('.btn-eliminar-cliente').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const nombre = btn.dataset.nombre;
        if (!confirm(`¿Estás seguro de eliminar al cliente "${nombre}"? Esta acción no se puede deshacer.`)) {
          return;
        }

        const resDel = await apiFetch(`/clientes/${id}`, { method: 'DELETE' });
        if (resDel.ok) {
          showToast(`Cliente "${nombre}" eliminado`, 'success');
          cargarLista(inputBuscar.value);
        } else {
          showToast(resDel.error || 'No se pudo eliminar el cliente', 'error');
        }
      };
    });
  }

  // Primera carga
  cargarLista();
  setTimeout(() => inputBuscar.focus(), 100);
}