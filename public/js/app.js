// public/js/app.js (Versión corregida sin duplicados)

const App = (() => {
  const tabs = {
    carga: { view: 'view-carga', mod: typeof ModuloCarga !== 'undefined' ? ModuloCarga : null },
    inventario: { view: 'view-inventario', mod: typeof ModuloInventario !== 'undefined' ? ModuloInventario : null },
    empaque: { view: 'view-empaque', mod: typeof ModuloEmpaque !== 'undefined' ? ModuloEmpaque : null },
    domicilios: { view: 'view-domicilios', mod: typeof ModuloDomicilios !== 'undefined' ? ModuloDomicilios : null },
    ventas: { view: 'view-ventas', mod: typeof ModuloVentas !== 'undefined' ? ModuloVentas : null }
  };
  let tabActual = null;
  const montado = {};

  function switchTab(nombre) {
    if (typeof Auth !== 'undefined' && !Auth.tienePermiso(nombre)) {
      showToast('No tienes permisos para acceder a este módulo', 'error');
      return;
    }
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

  async function init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    checkConnection();
    setInterval(checkConnection, 15000);

    // Inicializar y refrescar periódicamente los badges de la Canasta de Faltantes
    if (typeof ModuloDomicilios !== 'undefined' && typeof ModuloDomicilios.actualizarBadgesCanasta === 'function') {
      ModuloDomicilios.actualizarBadgesCanasta();
      setInterval(() => ModuloDomicilios.actualizarBadgesCanasta(), 30000);
    }

    // Inicializar autenticación antes de seleccionar tab
    if (typeof Auth !== 'undefined') {
      const autenticado = await Auth.init();
      if (autenticado) {
        if (Auth.isDomiciliario()) {
          switchTab('domicilios');
        } else if (Auth.tienePermiso('carga')) {
          switchTab('carga');
        } else if (Auth.tienePermiso('inventario')) {
          switchTab('inventario');
        } else if (Auth.tienePermiso('empaque')) {
          switchTab('empaque');
        } else if (Auth.tienePermiso('domicilios')) {
          switchTab('domicilios');
        } else {
          switchTab('carga');
        }
      }
    }

    // Detección inteligente de teclado virtual en móviles (Resize del Viewport)
    if (window.visualViewport) {
      const initialHeight = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        const header = document.getElementById('app-header');
        const bottomNav = document.getElementById('app-bottom-nav');
        const mobileBar = document.getElementById('pos-mobile-bottom-bar');
        
        // Si la diferencia de altura es notable (> 150px), el teclado virtual está abierto
        const tecladoAbierto = (initialHeight - currentHeight) > 150;

        if (header) {
          header.style.transform = tecladoAbierto ? 'translateY(-100%)' : 'translateY(0)';
          header.style.opacity = tecladoAbierto ? '0' : '1';
          header.style.pointerEvents = tecladoAbierto ? 'none' : 'auto';
        }

        if (bottomNav) {
          bottomNav.style.transform = tecladoAbierto ? 'translateY(100%)' : 'translateY(0)';
          bottomNav.style.opacity = tecladoAbierto ? '0' : '1';
          bottomNav.style.pointerEvents = tecladoAbierto ? 'none' : 'auto';
        }

        if (mobileBar) {
          // Si el teclado está abierto, pegamos la barra de facturar justo al fondo de la pantalla (sin la nav debajo)
          mobileBar.style.bottom = tecladoAbierto ? '0px' : '58px';
        }
      });
    }
  }

  return { init, switchTab };
})();

document.addEventListener('DOMContentLoaded', App.init);