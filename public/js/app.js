// ============================================================
// APP: navegacion entre modulos (pestañas inferiores)
// ============================================================

const App = (() => {
  const tabs = {
    carga: { view: 'view-carga', mod: ModuloCarga },
    inventario: { view: 'view-inventario', mod: ModuloInventario },
    empaque: { view: 'view-empaque', mod: ModuloEmpaque },
  };
  let tabActual = null;
  let inicializados = new Set();

  function switchTab(nombre) {
    if (tabActual === nombre) return;

    // Notificar salida del modulo anterior (para detener camara, etc.)
    if (tabActual && tabs[tabActual].mod.onLeaveTab) tabs[tabActual].mod.onLeaveTab();

    Object.entries(tabs).forEach(([key, cfg]) => {
      document.getElementById(cfg.view).classList.toggle('hidden', key !== nombre);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === nombre);
    });

    if (!inicializados.has(nombre)) {
      tabs[nombre].mod.render();
      inicializados.add(nombre);
    }

    tabActual = nombre;
  }

  async function checkConnection() {
    const statusEl = document.getElementById('conn-status');
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
