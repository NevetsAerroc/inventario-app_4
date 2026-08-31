// public/js/app.js (Versión corregida sin duplicados)

const App = (() => {
  const tabs = {
    carga: { view: 'view-carga', mod: typeof ModuloCarga !== 'undefined' ? ModuloCarga : null },
    inventario: { view: 'view-inventario', mod: typeof ModuloInventario !== 'undefined' ? ModuloInventario : null },
    empaque: { view: 'view-empaque', mod: typeof ModuloEmpaque !== 'undefined' ? ModuloEmpaque : null },
    domicilios: { view: 'view-domicilios', mod: typeof ModuloDomicilios !== 'undefined' ? ModuloDomicilios : null }
  };
  let tabActual = null;
  const montado = {};

  function switchTab(nombre) {
    if (!tabs[nombre]) return;
    if (tabActual === nombre) return;

    if (tabActual && tabs[tabActual].mod && typeof tabs[tabActual].mod.onLeaveTab === 'function') {
      tabs[tabActual].mod.onLeaveTab();
    }

    Object.entries(tabs).forEach(([key, cfg]) => {
      const el = document.getElementById(cfg.view);
      if (el) el.classList.toggle('hidden', key !== nombre);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      const activo = btn.dataset.tab === nombre;
      btn.classList.toggle('text-slate-900', activo);
      btn.classList.toggle('text-slate-500', !activo);
      btn.classList.toggle('active', activo);
    });

    const mod = tabs[nombre].mod;
    const view = document.getElementById(tabs[nombre].view);
    const yaListo = montado[nombre] && view && view.childElementCount > 0;

    if (mod) {
      if (!yaListo && typeof mod.render === 'function') {
        mod.render();
        montado[nombre] = true;
      } else if (typeof mod.onEnterTab === 'function') {
        mod.onEnterTab();
      }
    }

    tabActual = nombre;
  }

  async function checkConnection() {
    const statusEl = document.getElementById('conn-status');
    if (!statusEl) return;
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        statusEl.textContent = 'conectado';
        statusEl.className = 'text-xs px-2 py-1 rounded-full bg-emerald-600';
      } else throw new Error();
    } catch (e) {
      statusEl.textContent = 'sin conexion';
      statusEl.className = 'text-xs px-2 py-1 rounded-full bg-rose-600';
    }
  }

  function init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    switchTab('carga');
    checkConnection();
    setInterval(checkConnection, 15000);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);