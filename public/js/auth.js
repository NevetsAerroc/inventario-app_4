// ============================================================
// public/js/auth.js
// Control de Roles (RBAC), Permisos Granulares y Gestión de Usuarios
// Roles:
//  - 'superadmin': 💻 Programador (Acceso total al sistema y código)
//  - 'admin': 🏢 Administrador / Dueño del Local (Gestión comercial y de usuarios)
//  - 'domiciliario': 🛵 Domiciliario de Calle (Solo sus entregas asignadas en curso)
//  - 'operador': 📦 Operador con permisos asignados por el Admin
// ============================================================

const Auth = (() => {
  let currentUser = null;
  let domiciliariosList = [];

  function getToken() {
    return localStorage.getItem('jispi_token');
  }

  function setToken(token) {
    if (token) localStorage.setItem('jispi_token', token);
    else localStorage.removeItem('jispi_token');
  }

  function getUser() {
    return currentUser;
  }

  function isSuperAdmin() {
    return currentUser && currentUser.rol === 'superadmin';
  }

  function isAdmin() {
    return currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'superadmin');
  }

  // Compatibilidad con admin_domicilios
  function isAdminDomicilios() {
    return isAdmin();
  }

  function canManageUsers() {
    if (!currentUser) return false;
    if (currentUser.rol === 'superadmin' || currentUser.rol === 'admin') return true;
    return Array.isArray(currentUser.permisos) && currentUser.permisos.includes('usuarios');
  }

  function isDomiciliario() {
    if (!currentUser) return false;
    if (currentUser.rol === 'superadmin' || currentUser.rol === 'admin') return false;
    if (currentUser.rol === 'domiciliario') return true;
    const perms = Array.isArray(currentUser.permisos) ? currentUser.permisos : [];
    return perms.includes('domicilios_en_curso') && !perms.includes('domicilios_todos');
  }

  function tienePermisoCompletoDomicilios() {
    if (!currentUser) return false;
    if (currentUser.rol === 'superadmin' || currentUser.rol === 'admin' || currentUser.rol === 'admin_domicilios') return true;
    const perms = Array.isArray(currentUser.permisos) ? currentUser.permisos : [];
    return perms.includes('domicilios_todos') || perms.includes('domicilios');
  }

  function tienePermiso(modulo) {
    if (!currentUser) return false;
    if (currentUser.rol === 'superadmin') return true;
    if (currentUser.rol === 'admin') return true;

    const perms = Array.isArray(currentUser.permisos) ? currentUser.permisos : [];

    if (modulo === 'domicilios') {
      return currentUser.rol === 'domiciliario' ||
             perms.includes('domicilios') ||
             perms.includes('domicilios_todos') ||
             perms.includes('domicilios_en_curso');
    }

    if (modulo === 'usuarios') {
      return canManageUsers();
    }

    return perms.includes(modulo);
  }

  async function verificarSesion() {
    const token = getToken();
    if (!token) {
      currentUser = null;
      mostrarLoginModal(true);
      return false;
    }

    try {
      const res = await apiFetch('/auth/me');
      if (res.ok && res.user) {
        currentUser = res.user;
        aplicarSesionEnUI();
        mostrarLoginModal(false);
        return true;
      } else {
        setToken(null);
        currentUser = null;
        mostrarLoginModal(true);
        return false;
      }
    } catch (e) {
      setToken(null);
      currentUser = null;
      mostrarLoginModal(true);
      return false;
    }
  }

  async function login(username, password) {
    const errorEl = document.getElementById('auth-error-msg');
    const submitBtn = document.getElementById('btn-auth-submit');
    if (errorEl) errorEl.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Verificando...</span>';
    }

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        if (errorEl) {
          errorEl.textContent = res.error || 'Credenciales inválidas';
          errorEl.classList.remove('hidden');
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Iniciar Sesión';
        }
        return false;
      }

      setToken(res.token);
      currentUser = res.user;
      aplicarSesionEnUI();
      mostrarLoginModal(false);
      showToast(`¡Bienvenido, ${currentUser.nombre}!`, 'success');

      // Redirigir según el rol del usuario
      if (typeof App !== 'undefined' && App.switchTab) {
        if (isDomiciliario()) {
          App.switchTab('domicilios');
        } else if (tienePermiso('carga')) {
          App.switchTab('carga');
        } else if (tienePermiso('inventario')) {
          App.switchTab('inventario');
        } else if (tienePermiso('empaque')) {
          App.switchTab('empaque');
        } else if (tienePermiso('domicilios')) {
          App.switchTab('domicilios');
        }
      }

      return true;
    } catch (e) {
      if (errorEl) {
        errorEl.textContent = 'Error de conexión al autenticar';
        errorEl.classList.remove('hidden');
      }
      return false;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Iniciar Sesión';
      }
    }
  }

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {}
    setToken(null);
    currentUser = null;
    window.location.reload();
  }

  function handleUnauthorized() {
    setToken(null);
    currentUser = null;
    mostrarLoginModal(true);
  }

  function mostrarLoginModal(mostrar) {
    let modal = document.getElementById('modal-login-auth');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-login-auth';
      modal.className = 'fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4';
      document.body.appendChild(modal);
    }

    if (!mostrar) {
      modal.classList.add('hidden');
      return;
    }

    modal.classList.remove('hidden');
    modal.innerHTML = `
      <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <!-- CABECERA -->
        <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white text-center relative">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 text-3xl shadow-inner mb-3">
            📦
          </div>
          <h2 class="text-xl font-bold tracking-tight">Jispiplast Express</h2>
          <p class="text-xs text-slate-300 mt-1">Control de Acceso • Roles y Domicilios</p>
        </div>

        <!-- FORMULARIO -->
        <form id="form-login-auth" class="p-6 space-y-4" onsubmit="event.preventDefault(); Auth.onSubmitLogin();">
          <div id="auth-error-msg" class="hidden text-xs bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg font-medium text-center"></div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Nombre de Usuario</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">👤</span>
              <input id="login-input-user" type="text" required autocomplete="username"
                     placeholder="Ej: admin, superadmin, domiciliario1"
                     class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 focus:bg-white" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Contraseña</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">🔒</span>
              <input id="login-input-pass" type="password" required autocomplete="current-password"
                     placeholder="Tu contraseña..."
                     class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 focus:bg-white" />
            </div>
          </div>

          <button id="btn-auth-submit" type="submit"
                  class="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-sm font-semibold shadow-md transition-all">
            Iniciar Sesión
          </button>

          <!-- ACCESOS RÁPIDOS DEMO -->
          <div class="pt-2 border-t border-slate-100">
            <p class="text-[11px] font-semibold text-slate-500 mb-2 text-center uppercase tracking-wider">Cuentas configuradas:</p>
            <div class="grid grid-cols-3 gap-1.5 text-center">
              <button type="button" onclick="Auth.setCredencialesPrueba('superadmin', 'admin123')"
                      class="p-2 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 text-[11px] font-medium leading-tight">
                💻 <b>Programador</b><br><span class="text-[10px] text-purple-700 opacity-90">Super Admin</span>
              </button>
              <button type="button" onclick="Auth.setCredencialesPrueba('admin', 'admin123')"
                      class="p-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-[11px] font-medium leading-tight">
                🏢 <b>Dueño Local</b><br><span class="text-[10px] text-blue-700 opacity-90">Administrador</span>
              </button>
              <button type="button" onclick="Auth.setCredencialesPrueba('domiciliario1', 'domi123')"
                      class="p-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-medium leading-tight">
                🛵 <b>Domiciliario</b><br><span class="text-[10px] text-emerald-700 opacity-90">Rutas en calle</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    `;

    setTimeout(() => {
      document.getElementById('login-input-user')?.focus();
    }, 100);
  }

  function setCredencialesPrueba(u, p) {
    const userInp = document.getElementById('login-input-user');
    const passInp = document.getElementById('login-input-pass');
    if (userInp && passInp) {
      userInp.value = u;
      passInp.value = p;
      userInp.classList.add('bg-amber-50');
      passInp.classList.add('bg-amber-50');
      setTimeout(() => {
        userInp.classList.remove('bg-amber-50');
        passInp.classList.remove('bg-amber-50');
      }, 500);
    }
  }

  function onSubmitLogin() {
    const userInp = document.getElementById('login-input-user');
    const passInp = document.getElementById('login-input-pass');
    if (!userInp || !passInp) return;
    login(userInp.value, passInp.value);
  }

  function aplicarSesionEnUI() {
    if (!currentUser) return;

    // 1. Actualizar barra de usuario en Header
    let userBadge = document.getElementById('header-user-badge');
    if (!userBadge) {
      const headerDiv = document.querySelector('header > div');
      if (headerDiv) {
        userBadge = document.createElement('div');
        userBadge.id = 'header-user-badge';
        userBadge.className = 'flex items-center gap-2';
        headerDiv.appendChild(userBadge);
      }
    }

    const rolBadgeStyles = {
      superadmin: 'bg-purple-900/80 text-purple-200 border-purple-400',
      admin: 'bg-blue-900/80 text-blue-200 border-blue-400',
      admin_domicilios: 'bg-blue-900/80 text-blue-200 border-blue-400',
      domiciliario: 'bg-emerald-900/80 text-emerald-200 border-emerald-400',
      operador: 'bg-slate-700 text-slate-200 border-slate-500'
    };

    const rolLabels = {
      superadmin: '💻 Programador (Superadmin)',
      admin: '🏢 Dueño del Local (Admin)',
      admin_domicilios: '🏢 Administrador',
      domiciliario: '🛵 Domiciliario de Calle',
      operador: '📦 Operador de Bodega'
    };

    if (userBadge) {
      userBadge.innerHTML = `
        <div class="flex items-center gap-1.5">
          <span class="text-xs px-2.5 py-0.5 rounded-full border font-semibold ${rolBadgeStyles[currentUser.rol] || 'bg-slate-700 text-white'}">
            ${rolLabels[currentUser.rol] || currentUser.rol}
          </span>
          <span class="text-xs font-bold text-white max-w-[120px] truncate" title="${escapeHtml(currentUser.nombre)}">
            ${escapeHtml(currentUser.nombre.split(' ')[0])}
          </span>
        </div>
        ${canManageUsers() ? `
          <button onclick="Auth.abrirModalUsuarios()" title="Administrar Usuarios, Contraseñas y Módulos"
                  class="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center gap-1 font-semibold shadow-sm transition-all">
            <span>👥</span> <span class="hidden sm:inline">Usuarios</span>
          </button>
        ` : ''}
        <button onclick="Auth.logout()" title="Cerrar sesión"
                class="px-2 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-xs flex items-center font-medium transition-colors">
          🚪 <span class="hidden sm:inline ml-1">Salir</span>
        </button>
      `;
    }

    // 2. Ajustar navegación inferior según permisos
    const navButtons = document.querySelectorAll('nav .tab-btn');
    let primerBotonVisible = null;

    navButtons.forEach(btn => {
      const tabName = btn.dataset.tab;
      const tieneAcceso = tienePermiso(tabName);

      if (isDomiciliario()) {
        // Para domiciliarios de calle: solo 'domicilios' está visible
        if (tabName !== 'domicilios') {
          btn.classList.add('hidden');
        } else {
          btn.classList.remove('hidden');
          const spanText = btn.querySelector('span:last-child');
          if (spanText) spanText.textContent = 'Mis Rutas';
          primerBotonVisible = btn;
        }
      } else {
        if (tieneAcceso) {
          btn.classList.remove('hidden');
          if (!primerBotonVisible) primerBotonVisible = btn;
          if (tabName === 'domicilios') {
            const spanText = btn.querySelector('span:last-child');
            if (spanText) spanText.textContent = 'Domicilios';
          }
        } else {
          btn.classList.add('hidden');
        }
      }
    });

    // Controlar visibilidad del botón de Usuarios en la barra inferior
    const navBtnUsuarios = document.getElementById('nav-btn-usuarios');
    if (navBtnUsuarios) {
      if (canManageUsers() && !isDomiciliario()) {
        navBtnUsuarios.classList.remove('hidden');
      } else {
        navBtnUsuarios.classList.add('hidden');
      }
    }

    // 3. Notificar al módulo de domicilios
    if (typeof ModuloDomicilios !== 'undefined') {
      if (isDomiciliario()) {
        ModuloDomicilios.tabActiva = 'rutas';
      }
      const viewDom = document.getElementById('view-domicilios');
      if (viewDom && !viewDom.classList.contains('hidden') && typeof ModuloDomicilios.render === 'function') {
        ModuloDomicilios.render();
      }
    }
  }

  // ============================================================
  // MÓDULO DE GESTIÓN DE USUARIOS (ADMIN & SUPERADMIN)
  // ============================================================
  async function abrirModalUsuarios() {
    if (!canManageUsers()) {
      showToast('Acceso restringido a Administradores y Super Administradores', 'error');
      return;
    }

    // Cargar domiciliarios registrados para el selector
    try {
      const resDom = await apiFetch('/domiciliarios');
      if (resDom.ok) domiciliariosList = resDom.domiciliarios || [];
    } catch (e) {}

    let modal = document.getElementById('modal-gestion-usuarios');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-gestion-usuarios';
      modal.className = 'fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4';
      document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');
    modal.innerHTML = `
      <div class="bg-white w-full max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <!-- HEADER MODAL -->
        <div class="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-lg">👥</div>
            <div>
              <h3 class="font-bold text-sm sm:text-base leading-tight">Administración de Cuentas y Módulos</h3>
              <p class="text-[11px] text-slate-300">Crea usuarios, asigna contraseñas y define a qué módulos tienen acceso</p>
            </div>
          </div>
          <button onclick="document.getElementById('modal-gestion-usuarios').classList.add('hidden')"
                  class="text-slate-400 hover:text-white p-1 rounded-lg text-lg">✕</button>
        </div>

        <!-- BARRA ACCIONES -->
        <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-700">Usuarios Activos</span>
            <span id="badge-total-usuarios" class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-bold text-slate-700">0</span>
          </div>
          <button onclick="Auth.mostrarFormularioUsuario(null)"
                  class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all">
            <span>+</span> <span>Nuevo Usuario</span>
          </button>
        </div>

        <!-- CONTENEDOR DE CONTENIDO (LISTA O FORMULARIO) -->
        <div id="usuarios-modal-body" class="p-4 overflow-y-auto flex-1">
          <div class="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <div class="animate-spin text-xl">⏳</div>
            <span>Cargando lista de usuarios...</span>
          </div>
        </div>
      </div>
    `;

    await cargarListaUsuarios();
  }

  async function cargarListaUsuarios() {
    const body = document.getElementById('usuarios-modal-body');
    if (!body) return;

    try {
      const res = await apiFetch('/usuarios');
      if (!res.ok) {
        body.innerHTML = `<div class="p-4 text-center text-xs text-rose-600 font-medium">${res.error || 'Error al cargar usuarios'}</div>`;
        return;
      }

      const usuarios = res.usuarios || [];
      const badgeTotal = document.getElementById('badge-total-usuarios');
      if (badgeTotal) badgeTotal.textContent = usuarios.length;

      if (!usuarios.length) {
        body.innerHTML = `<div class="py-12 text-center text-xs text-slate-400">No hay usuarios registrados</div>`;
        return;
      }

      const soySuper = isSuperAdmin();

      body.innerHTML = `
        <div class="space-y-3">
          ${usuarios.map(u => {
            const esYo = currentUser && currentUser.id === u.id;
            const esTargetSuper = u.rol === 'superadmin';
            const puedoModificar = soySuper || (!esTargetSuper);

            const rolBadges = {
              superadmin: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">💻 Programador (Superadmin)</span>',
              admin: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">🏢 Dueño del Local (Admin)</span>',
              admin_domicilios: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">🏢 Dueño / Admin</span>',
              domiciliario: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">🛵 Domiciliario</span>',
              operador: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">📦 Operador</span>'
            };

            // Formatear etiquetas de permisos
            const labelsPermisos = {
              carga: '📥 Carga',
              inventario: '🔍 Inventario',
              empaque: '✅ Empaque',
              domicilios_todos: '🚚 Domicilios Completo',
              domicilios_en_curso: '🛵 Rutas en curso',
              domicilios: '🚚 Domicilios',
              usuarios: '👥 Usuarios'
            };

            const permsArray = Array.isArray(u.permisos) ? u.permisos : [];
            const tagsPermisos = permsArray.map(p => `<span class="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">${labelsPermisos[p] || p}</span>`).join(' ');

            return `
              <div class="bg-white border ${u.activo ? 'border-slate-200 shadow-sm' : 'border-rose-200 bg-rose-50/20'} rounded-xl p-3.5 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    <span class="font-bold text-sm text-slate-900">${escapeHtml(u.nombre)}</span>
                    <span class="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">@${escapeHtml(u.username)}</span>
                    ${rolBadges[u.rol] || `<span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-800">${u.rol}</span>`}
                    ${!u.activo ? '<span class="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-bold border border-rose-200">INACTIVO</span>' : ''}
                    ${esYo ? '<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-200">TÚ</span>' : ''}
                  </div>

                  <div class="text-xs text-slate-600 mt-1 flex flex-col gap-1">
                    ${u.domiciliario_id ? `
                      <div class="text-emerald-700 font-medium flex items-center gap-1">
                        <span>🛵 Enlazado al repartidor:</span>
                        <b class="bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">${escapeHtml(u.domiciliario_nombre || 'ID #' + u.domiciliario_id)}</b>
                      </div>
                    ` : ''}

                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-slate-400 font-medium">Módulos:</span>
                      ${tagsPermisos.length > 0 ? tagsPermisos : '<span class="text-slate-400 italic text-[11px]">Sin módulos asignados</span>'}
                    </div>

                    <div class="text-[11px] text-slate-400">
                      ${u.ultimo_login ? `Último acceso: ${u.ultimo_login}` : '<span class="italic">Nunca ha iniciado sesión</span>'}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 self-end sm:self-center">
                  ${puedoModificar ? `
                    <button onclick="Auth.mostrarFormularioUsuario(${JSON.stringify(u).replace(/"/g, '&quot;')})"
                            class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1"
                            title="Editar usuario y permisos">
                      ✏️ <span>Editar</span>
                    </button>
                    ${!esYo ? `
                      <button onclick="Auth.toggleEstadoUsuario(${u.id}, ${u.activo ? 0 : 1})"
                              class="px-3 py-1.5 rounded-lg ${u.activo ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'} active:scale-95 text-xs font-semibold transition-all"
                              title="${u.activo ? 'Pausar acceso' : 'Habilitar acceso'}">
                        ${u.activo ? 'Pausar' : 'Activar'}
                      </button>
                      <button onclick="Auth.eliminarUsuario(${u.id}, '${escapeHtml(u.username)}')"
                              class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 active:scale-95 text-xs font-semibold transition-all"
                              title="Eliminar cuenta">
                        🗑️
                      </button>
                    ` : ''}
                  ` : `
                    <span class="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded-lg font-medium">
                      🔒 Cuenta del Programador
                    </span>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (e) {
      body.innerHTML = `<div class="p-4 text-center text-xs text-rose-600 font-medium">Error al cargar usuarios</div>`;
    }
  }

  function mostrarFormularioUsuario(userParaEditar) {
    const body = document.getElementById('usuarios-modal-body');
    if (!body) return;

    const esEdicion = !!userParaEditar;
    const u = userParaEditar || {
      id: null,
      username: '',
      nombre: '',
      rol: 'domiciliario',
      domiciliario_id: '',
      permisos: ['domicilios_en_curso'],
      activo: 1
    };

    const soySuper = isSuperAdmin();
    const perms = Array.isArray(u.permisos) ? u.permisos : [];

    body.innerHTML = `
      <div class="p-1">
        <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
          <div>
            <h4 class="font-bold text-sm text-slate-900">
              ${esEdicion ? `✏️ Modificar Usuario: @${escapeHtml(u.username)}` : '✨ Crear Nueva Cuenta de Usuario'}
            </h4>
            <p class="text-[11px] text-slate-500">Configura sus credenciales, rol y módulos asignados</p>
          </div>
          <button onclick="Auth.cargarListaUsuarios()" class="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1">
            ← Volver
          </button>
        </div>

        <form id="form-crear-editar-usuario" onsubmit="event.preventDefault(); Auth.guardarUsuario(${u.id});" class="space-y-4">
          <div id="form-user-error" class="hidden text-xs bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg font-medium text-center"></div>

          <!-- DATOS PERSONALES & CREDENCIALES -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo *</label>
              <input id="usr-nombre" type="text" required value="${escapeHtml(u.nombre)}" placeholder="Ej: Camilo Torres"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Nombre de Usuario (Login) *</label>
              <input id="usr-username" type="text" required ${esEdicion ? 'disabled class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-100 text-slate-500 cursor-not-allowed"' : 'class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500"'}
                     value="${escapeHtml(u.username)}" placeholder="Ej: camilot" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">
                ${esEdicion ? 'Contraseña (dejar en blanco para conservar actual)' : 'Contraseña de Acceso *'}
              </label>
              <input id="usr-password" type="password" ${esEdicion ? '' : 'required'} placeholder="${esEdicion ? '••••••••' : 'Mínimo 3 caracteres'}"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Rol Principal del Usuario *</label>
              <select id="usr-rol" onchange="Auth.onCambiarRolEnFormulario(this.value)"
                      class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800">
                <option value="domiciliario" ${u.rol === 'domiciliario' ? 'selected' : ''}>🛵 Domiciliario de Calle</option>
                <option value="admin" ${u.rol === 'admin' || u.rol === 'admin_domicilios' ? 'selected' : ''}>🏢 Administrador / Dueño del Local</option>
                <option value="operador" ${u.rol === 'operador' ? 'selected' : ''}>📦 Operador / Empleado de Bodega</option>
                ${soySuper ? `<option value="superadmin" ${u.rol === 'superadmin' ? 'selected' : ''}>💻 Super Administrador (Programador)</option>` : ''}
              </select>
            </div>
          </div>

          <!-- SECCIÓN: VINCULACIÓN A DOMICILIARIO REGISTRADO -->
          <div id="campo-vinculo-domiciliario" class="${u.rol === 'domiciliario' || perms.includes('domicilios_en_curso') ? '' : 'hidden'} bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
            <div class="flex items-center justify-between flex-wrap gap-1">
              <label class="block text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <span>🛵 Enlazar a Domiciliario Registrado en Sistema:</span>
              </label>
              <button type="button" onclick="Auth.crearDomiciliarioRapido()"
                      class="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline">
                + Crear nuevo domiciliario
              </button>
            </div>
            <select id="usr-domiciliario-id" class="w-full border border-emerald-300 rounded-lg px-3 py-2 text-xs bg-white font-semibold text-slate-800">
              <option value="">-- Seleccionar domiciliario o auto-crear con este nombre --</option>
              ${domiciliariosList.map(d => `
                <option value="${d.id}" ${u.domiciliario_id == d.id ? 'selected' : ''}>
                  ${escapeHtml(d.nombre)} ${d.telefono ? `(${escapeHtml(d.telefono)})` : ''}
                </option>
              `).join('')}
            </select>
            <p class="text-[11px] text-emerald-800">
              📌 Este enlace asegura que cuando este usuario inicie sesión, <b>únicamente vea los pedidos y rutas asignados a este repartidor</b>.
            </p>
          </div>

          <!-- SECCIÓN: ASIGNACIÓN DE MÓDULOS PERMITIDOS -->
          <div class="bg-indigo-50/50 border border-indigo-200 rounded-xl p-3.5 space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label class="block text-xs font-bold text-indigo-950">Módulos y Permisos de Acceso:</label>
                <p class="text-[11px] text-indigo-700">Marca las partes del sistema que este usuario tendrá habilitadas</p>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" onclick="Auth.aplicarPlantillaPermisos('todos')"
                        class="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-[10px] font-semibold text-indigo-800 border border-indigo-300">
                  Seleccionar Todo
                </button>
                <button type="button" onclick="Auth.aplicarPlantillaPermisos('domi')"
                        class="px-2 py-0.5 rounded bg-white hover:bg-emerald-100 text-[10px] font-semibold text-emerald-800 border border-emerald-300">
                  Solo Domicilios
                </button>
                <button type="button" onclick="Auth.aplicarPlantillaPermisos('bodega')"
                        class="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-800 border border-slate-300">
                  Solo Bodega
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <!-- CARGA -->
              <label class="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-300">
                <input type="checkbox" id="perm-carga" ${perms.includes('carga') ? 'checked' : ''} class="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <span class="font-bold text-slate-800">📥 Carga Masiva (Excel)</span>
                  <p class="text-[10px] text-slate-500">Importación de catálogos y códigos de barras.</p>
                </div>
              </label>

              <!-- INVENTARIO -->
              <label class="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-300">
                <input type="checkbox" id="perm-inventario" ${perms.includes('inventario') ? 'checked' : ''} class="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <span class="font-bold text-slate-800">🔍 Inventario &amp; Búsqueda</span>
                  <p class="text-[10px] text-slate-500">Consultar stock, precios y escáner de productos.</p>
                </div>
              </label>

              <!-- EMPAQUE -->
              <label class="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-300">
                <input type="checkbox" id="perm-empaque" ${perms.includes('empaque') ? 'checked' : ''} class="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <span class="font-bold text-slate-800">✅ Empaque (Pick &amp; Pack)</span>
                  <p class="text-[10px] text-slate-500">Verificar ítems de pedidos con código de barras.</p>
                </div>
              </label>

              <!-- USUARIOS -->
              <label class="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-300">
                <input type="checkbox" id="perm-usuarios" ${perms.includes('usuarios') ? 'checked' : ''} class="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <span class="font-bold text-slate-800">👥 Gestión de Usuarios</span>
                  <p class="text-[10px] text-slate-500">Crear usuarios, cambiar contraseñas y permisos.</p>
                </div>
              </label>
            </div>

            <!-- SUB-SECCIÓN DOMICILIOS: COMPLETO O SOLO EN CURSO -->
            <div class="bg-white p-3 rounded-lg border border-indigo-200 space-y-2">
              <span class="block font-bold text-xs text-slate-800">🚚 Configuración de Domicilios:</span>
              <div class="space-y-1.5">
                <label class="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="perm-domicilio-tipo" value="domicilios_todos"
                         ${perms.includes('domicilios_todos') || (perms.includes('domicilios') && !perms.includes('domicilios_en_curso')) ? 'checked' : ''}
                         onchange="Auth.onToggleTipoDomicilio(this.value)"
                         class="mt-0.5 text-indigo-600" />
                  <div>
                    <span class="font-bold text-slate-800">Todo el Módulo de Domicilios (Central / Administrador)</span>
                    <p class="text-[10px] text-slate-500">Despacho de rutas, cuadre y liquidación de caja, auditoría completa e impresión de tickets.</p>
                  </div>
                </label>

                <label class="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="perm-domicilio-tipo" value="domicilios_en_curso"
                         ${perms.includes('domicilios_en_curso') || u.rol === 'domiciliario' ? 'checked' : ''}
                         onchange="Auth.onToggleTipoDomicilio(this.value)"
                         class="mt-0.5 text-emerald-600" />
                  <div>
                    <span class="font-bold text-emerald-800">Solo Domicilios en Curso (Repartidor en Calle)</span>
                    <p class="text-[10px] text-slate-500">Solo ve las rutas asignadas a su nombre para marcar entregado / novedades. Sin acceso a caja ni despacho.</p>
                  </div>
                </label>

                <label class="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="perm-domicilio-tipo" value="ninguno"
                         ${!perms.includes('domicilios_todos') && !perms.includes('domicilios_en_curso') && !perms.includes('domicilios') && u.rol !== 'domiciliario' ? 'checked' : ''}
                         onchange="Auth.onToggleTipoDomicilio(this.value)"
                         class="mt-0.5 text-slate-400" />
                  <div>
                    <span class="font-semibold text-slate-600">Sin acceso a domicilios</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div class="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button type="button" onclick="Auth.cargarListaUsuarios()"
                    class="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 text-xs font-semibold">
              Cancelar
            </button>
            <button type="submit" id="btn-guardar-usr"
                    class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-md transition-all">
              ${esEdicion ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    `;
  }

  function onCambiarRolEnFormulario(rol) {
    if (rol === 'domiciliario') {
      aplicarPlantillaPermisos('domi');
    } else if (rol === 'admin' || rol === 'superadmin') {
      aplicarPlantillaPermisos('todos');
    } else if (rol === 'operador') {
      aplicarPlantillaPermisos('bodega');
    }
  }

  function onToggleTipoDomicilio(tipo) {
    const campoDomi = document.getElementById('campo-vinculo-domiciliario');
    if (campoDomi) {
      campoDomi.classList.toggle('hidden', tipo !== 'domicilios_en_curso');
    }
  }

  function aplicarPlantillaPermisos(tipo) {
    const chkCarga = document.getElementById('perm-carga');
    const chkInv = document.getElementById('perm-inventario');
    const chkEmp = document.getElementById('perm-empaque');
    const chkUsr = document.getElementById('perm-usuarios');
    const radioTodos = document.querySelector('input[name="perm-domicilio-tipo"][value="domicilios_todos"]');
    const radioEnCurso = document.querySelector('input[name="perm-domicilio-tipo"][value="domicilios_en_curso"]');
    const radioNinguno = document.querySelector('input[name="perm-domicilio-tipo"][value="ninguno"]');
    const campoDomi = document.getElementById('campo-vinculo-domiciliario');

    if (tipo === 'todos') {
      if (chkCarga) chkCarga.checked = true;
      if (chkInv) chkInv.checked = true;
      if (chkEmp) chkEmp.checked = true;
      if (chkUsr) chkUsr.checked = true;
      if (radioTodos) radioTodos.checked = true;
      if (campoDomi) campoDomi.classList.add('hidden');
    } else if (tipo === 'domi') {
      if (chkCarga) chkCarga.checked = false;
      if (chkInv) chkInv.checked = false;
      if (chkEmp) chkEmp.checked = false;
      if (chkUsr) chkUsr.checked = false;
      if (radioEnCurso) radioEnCurso.checked = true;
      if (campoDomi) campoDomi.classList.remove('hidden');
    } else if (tipo === 'bodega') {
      if (chkCarga) chkCarga.checked = false;
      if (chkInv) chkInv.checked = true;
      if (chkEmp) chkEmp.checked = true;
      if (chkUsr) chkUsr.checked = false;
      if (radioNinguno) radioNinguno.checked = true;
      if (campoDomi) campoDomi.classList.add('hidden');
    }
  }

  async function crearDomiciliarioRapido() {
    const nombre = prompt('Ingresa el nombre del repartidor a registrar:');
    if (!nombre || !nombre.trim()) return;
    const telefono = prompt('Ingresa el teléfono del repartidor (opcional):') || '';

    try {
      const res = await apiFetch('/domiciliarios', {
        method: 'POST',
        body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim() })
      });
      if (res.ok && res.id) {
        showToast('Domiciliario registrado con éxito', 'success');
        // Recargar lista
        const resDom = await apiFetch('/domiciliarios');
        if (resDom.ok) {
          domiciliariosList = resDom.domiciliarios || [];
          const select = document.getElementById('usr-domiciliario-id');
          if (select) {
            select.innerHTML = `
              <option value="">-- Seleccionar domiciliario o auto-crear con este nombre --</option>
              ${domiciliariosList.map(d => `
                <option value="${d.id}" ${d.id == res.id ? 'selected' : ''}>
                  ${escapeHtml(d.nombre)} ${d.telefono ? `(${escapeHtml(d.telefono)})` : ''}
                </option>
              `).join('')}
            `;
          }
        }
      } else {
        showToast(res.error || 'No se pudo crear el domiciliario', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  }

  async function guardarUsuario(id) {
    const errorEl = document.getElementById('form-user-error');
    const btn = document.getElementById('btn-guardar-usr');
    if (errorEl) errorEl.classList.add('hidden');

    const nombre = document.getElementById('usr-nombre')?.value.trim();
    const username = document.getElementById('usr-username')?.value.trim();
    const password = document.getElementById('usr-password')?.value.trim();
    const rol = document.getElementById('usr-rol')?.value;
    const domiciliario_id = document.getElementById('usr-domiciliario-id')?.value;

    if (!nombre) {
      if (errorEl) {
        errorEl.textContent = 'El nombre completo es obligatorio';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (!id && !username) {
      if (errorEl) {
        errorEl.textContent = 'El nombre de usuario es obligatorio';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Recolectar permisos
    const permisos = [];
    if (document.getElementById('perm-carga')?.checked) permisos.push('carga');
    if (document.getElementById('perm-inventario')?.checked) permisos.push('inventario');
    if (document.getElementById('perm-empaque')?.checked) permisos.push('empaque');
    if (document.getElementById('perm-usuarios')?.checked) permisos.push('usuarios');

    const tipoDomi = document.querySelector('input[name="perm-domicilio-tipo"]:checked')?.value;
    if (tipoDomi === 'domicilios_todos') {
      permisos.push('domicilios_todos');
      permisos.push('domicilios');
    } else if (tipoDomi === 'domicilios_en_curso') {
      permisos.push('domicilios_en_curso');
      permisos.push('domicilios');
    }

    const payload = {
      nombre,
      rol,
      domiciliario_id: domiciliario_id ? Number(domiciliario_id) : null,
      permisos
    };
    if (username) payload.username = username;
    if (password) payload.password = password;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando...';
    }

    try {
      const url = id ? `/usuarios/${id}` : '/usuarios';
      const method = id ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        if (errorEl) {
          errorEl.textContent = res.error || 'Error al procesar la solicitud';
          errorEl.classList.remove('hidden');
        }
        return;
      }

      showToast(id ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito', 'success');
      await cargarListaUsuarios();
    } catch (e) {
      if (errorEl) {
        errorEl.textContent = 'Error de conexión';
        errorEl.classList.remove('hidden');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = id ? 'Guardar Cambios' : 'Crear Usuario';
      }
    }
  }

  async function toggleEstadoUsuario(id, nuevoEstado) {
    try {
      const res = await apiFetch(`/usuarios/${id}/toggle`, { method: 'POST' });
      if (res.ok) {
        showToast(res.activo ? 'Usuario activado' : 'Usuario pausado', 'info');
        await cargarListaUsuarios();
      } else {
        showToast(res.error || 'No se pudo cambiar el estado', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  }

  async function eliminarUsuario(id, username) {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente la cuenta de @${username}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/usuarios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Usuario eliminado', 'info');
        await cargarListaUsuarios();
      } else {
        showToast(res.error || 'No se pudo eliminar el usuario', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  }

  return {
    init: verificarSesion,
    verificarSesion,
    login,
    logout,
    onSubmitLogin,
    setCredencialesPrueba,
    handleUnauthorized,
    getUser,
    isSuperAdmin,
    isAdmin,
    isAdminDomicilios,
    isDomiciliario,
    canManageUsers,
    tienePermiso,
    tienePermisoCompletoDomicilios,
    abrirModalUsuarios,
    cargarListaUsuarios,
    mostrarFormularioUsuario,
    onCambiarRolEnFormulario,
    onToggleTipoDomicilio,
    aplicarPlantillaPermisos,
    crearDomiciliarioRapido,
    guardarUsuario,
    toggleEstadoUsuario,
    eliminarUsuario
  };
})();

// Exportar globalmente
window.Auth = Auth;
