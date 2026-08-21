// ============================================================
// Utilidades compartidas: cliente API + Toast de notificaciones
// ============================================================

const API_BASE = '/api';

async function apiFetch(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
  });
  let data;
  try { data = await res.json(); } catch (e) { data = { ok: false, error: 'Respuesta invalida del servidor.' }; }
  if (!res.ok && data.ok !== false) data.ok = false;
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
  const num = Number(n) || 0;
  return num.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================
// Autocompletado de productos (usa GET /api/productos/sugerencias?q=)
// ============================================================
// inputEl:     el <input> de texto donde el usuario escribe
// dropdownEl:  un <div> vacio, posicionado bajo el input, donde se pintan las sugerencias
// onSelect(producto): callback cuando el usuario toca/clickea una sugerencia
function attachAutocompleteProductos(inputEl, dropdownEl, onSelect) {
  let debounceTimer = null;
  let items = [];
  let activeIndex = -1;

  function ocultar() {
    dropdownEl.classList.add('hidden');
    dropdownEl.innerHTML = '';
    items = [];
    activeIndex = -1;
  }

  function pintar() {
    if (!items.length) { ocultar(); return; }
    dropdownEl.innerHTML = items.map((p, i) => `
      <div class="autocomplete-item px-3 py-2 text-sm cursor-pointer border-b border-slate-100 last:border-b-0 ${i === activeIndex ? 'bg-slate-100' : ''}"
           data-idx="${i}">
        <p class="font-medium text-slate-800">${p.codigo_barras ? '🔗' : '⚪'} ${escapeHtml(p.nombre)}</p>
        <p class="text-xs text-slate-400">SKU ${escapeHtml(p.sku)}${p.categoria ? ' · ' + escapeHtml(p.categoria) : ''}${p.subcategoria ? ' / ' + escapeHtml(p.subcategoria) : ''} · stock ${p.stock}</p>
      </div>
    `).join('');
    dropdownEl.classList.remove('hidden');
    dropdownEl.querySelectorAll('.autocomplete-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); // evita que el input pierda foco antes del click
        const p = items[Number(el.dataset.idx)];
        ocultar();
        onSelect(p);
      });
    });
  }

  async function buscar(q) {
    if (!q || q.trim().length < 2) { ocultar(); return; }
    const data = await apiFetch('/productos/sugerencias?q=' + encodeURIComponent(q.trim()));
    if (!data.ok) { ocultar(); return; }
    items = data.data || [];
    activeIndex = -1;
    pintar();
  }

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => buscar(inputEl.value), 250);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (dropdownEl.classList.contains('hidden') || !items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      pintar();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      pintar();
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

  inputEl.addEventListener('blur', () => setTimeout(ocultar, 100));
}
