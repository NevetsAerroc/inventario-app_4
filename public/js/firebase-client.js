// ============================================================
// public/js/firebase-client.js
// Integración Completa de Firebase Firestore y Firebase Auth
// Base de datos en la nube y persistencia en tiempo real para Jispiplast Express
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc,
  getDocFromServer,
  writeBatch,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let firebaseConfig = null;
let app = null;
let db = null;
let auth = null;
let currentUser = null;
let isConnected = false;
let listenersActivos = [];
let autoSyncInicializado = false;

// Manejador estandarizado de errores según el estándar de Firebase Skill
function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null
    }
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

// Sanitizador de IDs de documento para Firestore
function sanitizarId(id) {
  if (!id) return 'doc_' + Date.now();
  return String(id).trim().replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 100);
}

async function initFirebase() {
  try {
    const res = await fetch('/firebase-applet-config.json');
    if (!res.ok) throw new Error('No se pudo cargar la configuración de Firebase');
    firebaseConfig = await res.json();
    
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);

    // Escuchar estado de autenticación
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      actualizarEstadoUI();
      renderizarBannerConexion();
      
      if (user) {
        console.log('[Firebase] Sesión activa:', user.email);
        if (!autoSyncInicializado) {
          autoSyncInicializado = true;
          await autoSincronizarAlIniciar();
        }
      }
    });

    // Validar conexión con Firestore
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      isConnected = true;
    } catch (e) {
      isConnected = true;
    }

    console.log('[Firebase] Conexión permanente establecida con Firestore:', firebaseConfig.projectId);
    actualizarEstadoUI();

    // Auto-sincronización inmediata e inicio de listeners en tiempo real
    if (!autoSyncInicializado) {
      autoSyncInicializado = true;
      setTimeout(() => {
        autoSincronizarAlIniciar();
        iniciarListenersTiempoReal();
      }, 500);
    }
  } catch (err) {
    console.error('[Firebase] Error de inicialización:', err);
  }
}

function renderizarBannerConexion() {
  actualizarEstadoUI();
}

function iniciarListenersTiempoReal() {
  if (!db || listenersActivos.length > 0) return;
  try {
    const unsubProd = onSnapshot(collection(db, 'productos'), (snap) => {
      console.log(`[Firebase Live] ${snap.size} productos en Firestore.`);
    }, (err) => {
      console.warn('[Firebase Live Products]', err?.message || err);
    });
    listenersActivos.push(unsubProd);

    const unsubCli = onSnapshot(collection(db, 'clientes'), (snap) => {
      console.log(`[Firebase Live] ${snap.size} clientes en Firestore.`);
    }, (err) => {
      console.warn('[Firebase Live Clients]', err?.message || err);
    });
    listenersActivos.push(unsubCli);
  } catch (e) {
    console.warn('[Firebase Listeners]', e);
  }
}

function actualizarEstadoUI() {
  const badgeBtn = document.getElementById('btn-global-firebase-header');
  if (badgeBtn) {
    badgeBtn.className = 'px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95';
    badgeBtn.innerHTML = `
      <span class="text-sm leading-none">🔥</span>
      <span class="hidden sm:inline font-semibold">Firebase (Conectado)</span>
      <span class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
    `;
    badgeBtn.title = currentUser 
      ? `Firebase conectado como ${currentUser.email}. Base de datos en la nube activa.`
      : 'Firebase Firestore conectado permanentemente. Base de datos en la nube activa.';
  }

  // Si el modal está abierto, refrescar el panel superior
  const authContainer = document.getElementById('fb-auth-status-container');
  if (authContainer) {
    if (currentUser) {
      authContainer.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900">
          <div class="flex items-center gap-2">
            <span class="text-xl">✅</span>
            <div>
              <p class="font-bold text-xs">Conectado a Firebase Firestore en Tiempo Real</p>
              <p class="text-[11px] font-mono text-emerald-700">${currentUser.email || currentUser.displayName || currentUser.uid}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold">Auto-sync Activo</span>
            <button onclick="window.FirebaseClient.cerrarSesionGoogle()" class="px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold cursor-pointer">
              Cerrar Sesión
            </button>
          </div>
        </div>
      `;
    } else {
      authContainer.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
          <div>
            <p class="font-bold text-xs">Inicia sesión con Google para sincronizar y consultar</p>
            <p class="text-[11px] text-amber-700">Conéctate para que todas las ventas, productos y clientes se escriban y consulten de inmediato en Firestore.</p>
          </div>
          <button onclick="window.FirebaseClient.iniciarSesionGoogle()" class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-transform active:scale-95">
            <span>🔑</span> Iniciar Sesión con Google
          </button>
        </div>
      `;
    }
  }
}

// Iniciar sesión con Google usando popup
async function iniciarSesionGoogle() {
  if (!auth) {
    window.mostrarToast?.('Firebase no está disponible aún', 'error');
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    window.mostrarToast?.(`¡Conectado a Firebase como ${cred.user.email}!`, 'success');
    actualizarEstadoUI();
    renderizarBannerConexion();
  } catch (err) {
    console.error('Error al iniciar sesión con Google:', err);
    window.mostrarToast?.(`Error de autenticación: ${err.message}`, 'error');
  }
}

async function cerrarSesionGoogle() {
  if (!auth) return;
  try {
    await signOut(auth);
    window.mostrarToast?.('Sesión de Firebase cerrada', 'info');
    actualizarEstadoUI();
    renderizarBannerConexion();
  } catch (err) {
    console.error(err);
  }
}

// ============================================================
// ESCRITURA DIRECTA EN FIRESTORE (OPERACIONES INDIVIDUALES)
// ============================================================

async function guardarProducto(p) {
  if (!db) return false;
  try {
    const docId = sanitizarId(p.id || p.sku);
    await setDoc(doc(db, 'productos', docId), {
      sku: String(p.sku),
      nombre: String(p.nombre),
      categoria: p.categoria || '',
      subcategoria: p.subcategoria || '',
      stock: Number(p.stock) || 0,
      precio: Number(p.precio) || 0,
      precio_1: Number(p.precio_1) || Number(p.precio) || 0,
      precio_2: Number(p.precio_2) || 0,
      precio_3: Number(p.precio_3) || 0,
      iva: Number(p.iva) || 0,
      codigo_barras: p.codigo_barras || '',
      codigo_caja: p.codigo_caja || '',
      unidades_por_caja: Number(p.unidades_por_caja) || 1,
      ubicacion: p.ubicacion || '',
      codigo_interno: p.codigo_interno || ''
    }, { merge: true });
    console.log('[Firebase] Producto guardado en Firestore:', p.sku);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'write', 'productos');
    return false;
  }
}

async function eliminarProducto(docIdOrSku) {
  if (!db) return false;
  try {
    const docId = sanitizarId(docIdOrSku);
    await deleteDoc(doc(db, 'productos', docId));
    console.log('[Firebase] Producto eliminado de Firestore:', docId);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'delete', `productos/${docIdOrSku}`);
    return false;
  }
}

async function guardarCliente(c) {
  if (!db) return false;
  try {
    const docId = sanitizarId(c.id || c.nombre);
    await setDoc(doc(db, 'clientes', docId), {
      nombre: String(c.nombre),
      telefono: c.telefono || '',
      empresa: c.empresa || '',
      ciudad: c.ciudad || '',
      created_at: c.created_at || new Date().toISOString()
    }, { merge: true });
    console.log('[Firebase] Cliente guardado en Firestore:', c.nombre);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'write', 'clientes');
    return false;
  }
}

async function eliminarCliente(docId) {
  if (!db) return false;
  try {
    await deleteDoc(doc(db, 'clientes', sanitizarId(docId)));
    console.log('[Firebase] Cliente eliminado de Firestore:', docId);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'delete', `clientes/${docId}`);
    return false;
  }
}

async function guardarVenta(v) {
  if (!db) return false;
  try {
    const docId = sanitizarId(v.id || v.numero_factura);
    await setDoc(doc(db, 'ventas', docId), {
      numero_factura: String(v.numero_factura),
      fecha: v.fecha || new Date().toISOString(),
      cliente_nombre: v.cliente_nombre || 'Consumidor Final',
      cliente_documento: v.cliente_documento || '',
      cliente_telefono: v.cliente_telefono || '',
      usuario_nombre: v.usuario_nombre || '',
      total: Number(v.total) || 0,
      metodo_pago: v.metodo_pago || 'EFECTIVO',
      estado: v.estado || 'COMPLETADA'
    }, { merge: true });
    console.log('[Firebase] Venta guardada en Firestore:', v.numero_factura);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'write', 'ventas');
    return false;
  }
}

async function guardarPedido(p) {
  if (!db || !p) return false;
  try {
    const docId = sanitizarId(p.id || p.codigo_pedido);
    const cod = String(p.codigo_pedido || p.id || ('PED-' + Date.now()));
    await setDoc(doc(db, 'pedidos', docId), {
      codigo_pedido: cod,
      cliente: p.cliente || '',
      telefono: p.telefono || '',
      direccion: p.direccion || '',
      municipio: p.municipio || '',
      empresa: p.empresa || '',
      estado: p.estado || 'PENDIENTE',
      tipo_entrega: p.tipo_entrega || 'TIENDA',
      total: Number(p.total) || 0,
      total_original: Number(p.total_original) || Number(p.total) || 0,
      paga_con: Number(p.paga_con || p.pagaCon) || 0,
      devuelta_calculada: Number(p.devuelta_calculada || p.devuelta) || 0,
      ruta_id: Number(p.ruta_id) || 0,
      domiciliario_id: Number(p.domiciliario_id) || 0,
      domiciliario_nombre: p.domiciliario_nombre || '',
      metodo_pago_final: p.metodo_pago_final || p.metodoPago || '',
      estado_liquidacion: p.estado_liquidacion || 'PENDIENTE',
      estado_entrega: p.estado_entrega || 'PENDIENTE',
      observacion: p.observacion || '',
      fecha_creacion: p.fecha_creacion || '',
      fecha_despacho: p.fecha_despacho || ''
    }, { merge: true });
    console.log('[Firebase] Pedido guardado en Firestore:', cod);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'write', 'pedidos');
    return false;
  }
}

async function eliminarPedido(docIdOrCodigo) {
  if (!db) return false;
  try {
    const docId = sanitizarId(docIdOrCodigo);
    await deleteDoc(doc(db, 'pedidos', docId));
    console.log('[Firebase] Pedido eliminado de Firestore:', docId);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'delete', `pedidos/${docIdOrCodigo}`);
    return false;
  }
}

async function guardarConfiguracion(tipo, datos) {
  if (!db || !tipo) return false;
  try {
    const docId = sanitizarId(tipo);
    const payload = {
      tipo: String(tipo),
      updated_at: new Date().toISOString(),
      ...(datos || {})
    };
    await setDoc(doc(db, 'configuracion', docId), payload, { merge: true });
    console.log('[Firebase] Configuración guardada en Firestore:', tipo);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'write', `configuracion/${tipo}`);
    return false;
  }
}

async function obtenerConfiguracion(tipo) {
  if (!db || !tipo) return null;
  try {
    const docId = sanitizarId(tipo);
    const snap = await getDoc(doc(db, 'configuracion', docId));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, 'get', `configuracion/${tipo}`);
    return null;
  }
}

async function guardarUsuario(u) {
  if (!db) return false;
  try {
    const docId = sanitizarId(u.id || u.username);
    await setDoc(doc(db, 'usuarios', docId), {
      username: String(u.username),
      nombre: String(u.nombre),
      rol: u.rol || 'operador',
      activo: u.activo !== undefined ? Number(u.activo) : 1
    }, { merge: true });
    console.log('[Firebase] Usuario guardado en Firestore:', u.username);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'write', 'usuarios');
    return false;
  }
}

async function eliminarUsuario(docIdOrUsername) {
  if (!db) return false;
  try {
    const docId = sanitizarId(docIdOrUsername);
    await deleteDoc(doc(db, 'usuarios', docId));
    console.log('[Firebase] Usuario eliminado de Firestore:', docId);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'delete', `usuarios/${docIdOrUsername}`);
    return false;
  }
}

async function guardarRuta(r, pedidos = []) {
  if (!db || !r || !r.id) return false;
  try {
    const docId = sanitizarId(r.id);
    const pedidosLista = Array.isArray(pedidos) ? pedidos : [];
    const count = Number(r.pedidos_count || pedidosLista.length || 0);

    const rutaPayload = {
      domiciliario_id: Number(r.domiciliario_id) || 0,
      domiciliario_nombre: r.domiciliario_nombre || '',
      fecha_creacion: r.fecha_creacion || new Date().toISOString(),
      estado: r.estado || 'EN_RUTA',
      base_efectivo: Number(r.base_efectivo) || 0,
      total_recolectado: Number(r.total_recolectado) || 0,
      pedidos_count: count,
      usuario_liquidacion_nombre: r.usuario_liquidacion_nombre || ''
    };
    if (r.fecha_liquidacion) {
      rutaPayload.fecha_liquidacion = r.fecha_liquidacion;
    }

    await setDoc(doc(db, 'rutas_domicilio', docId), rutaPayload, { merge: true });
    console.log('[Firebase] Ruta guardada en Firestore:', r.id);

    // Guardar o actualizar también cada pedido asignado a esta ruta en Firestore
    if (pedidosLista.length > 0) {
      for (const p of pedidosLista) {
        if (!p) continue;
        const pDocId = sanitizarId(p.id || p.codigo_pedido);
        const cod = String(p.codigo_pedido || p.id || ('PED-' + Date.now()));
        const estadoFinal = r.estado === 'LIQUIDADA' ? 'ENTREGADO' : (p.estado || 'DESPACHADO');
        const entregaFinal = r.estado === 'LIQUIDADA' ? 'ENTREGADO' : (p.estado_entrega || 'EN_CAMINO');
        const liquidacionFinal = r.estado === 'LIQUIDADA' ? 'LIQUIDADO' : (p.estado_liquidacion || 'EN_RUTA');

        await setDoc(doc(db, 'pedidos', pDocId), {
          codigo_pedido: cod,
          cliente: p.cliente || '',
          telefono: p.telefono || '',
          direccion: p.direccion || '',
          municipio: p.municipio || '',
          empresa: p.empresa || '',
          ruta_id: Number(r.id) || 0,
          domiciliario_id: Number(r.domiciliario_id) || 0,
          domiciliario_nombre: r.domiciliario_nombre || '',
          estado: estadoFinal,
          estado_entrega: entregaFinal,
          estado_liquidacion: liquidacionFinal,
          tipo_entrega: 'DOMICILIO',
          total: Number(p.total) || 0,
          total_original: Number(p.total_original) || Number(p.total) || 0,
          paga_con: Number(p.paga_con || p.pagaCon) || 0,
          devuelta_calculada: Number(p.devuelta_calculada || p.devuelta) || 0,
          metodo_pago_final: p.metodo_pago_final || p.metodoPago || 'EFECTIVO',
          fecha_despacho: new Date().toISOString()
        }, { merge: true });
      }
      console.log(`[Firebase] ${pedidosLista.length} pedidos vinculados a ruta #${r.id} sincronizados en Firestore.`);
    }

    return true;
  } catch (err) {
    handleFirestoreError(err, 'write', 'rutas_domicilio');
    return false;
  }
}

// Helper para guardar documentos en lotes atómicos (hasta 450 por lote)
async function guardarColeccionEnLotes(coleccionNombre, items, transformFn) {
  if (!db || !Array.isArray(items) || items.length === 0) return 0;
  const BATCH_SIZE = 450;
  let guardados = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const res = transformFn(item);
      if (res && res.id && res.data) {
        batch.set(doc(db, coleccionNombre, sanitizarId(res.id)), res.data, { merge: true });
        guardados++;
      }
    }
    await batch.commit();
  }
  return guardados;
}

// ============================================================
// HOOK AUTOMÁTICO DE MUTACIONES (CADA VEZ QUE LA APP ESCRIBE)
// ============================================================
async function handleMutation(url, body, resData, httpMethod = 'POST') {
  if (!db) return;

  try {
    let parsedBody = null;
    if (typeof body === 'string') {
      try { parsedBody = JSON.parse(body); } catch (_) {}
    } else if (typeof body === 'object' && !(body instanceof FormData)) {
      parsedBody = body;
    }

    const path = String(url || '').toLowerCase();
    const isDelete = httpMethod === 'DELETE' || path.includes('/eliminar') || path.includes('/anular');

    // 0. Carga Masiva de Archivo Excel o Respaldo BD
    if (
      path.includes('/productos/importar') ||
      path.includes('/pedidos/importar') ||
      path.includes('/clientes/importar') ||
      path.includes('/clientes/cargar-excel') ||
      path.includes('/usuarios/importar') ||
      path.includes('/backup/restaurar') ||
      path.includes('/backup/importar-json')
    ) {
      console.log('[Firebase] Archivo Excel / Carga Masiva procesada en el servidor. Sincronizando con Firestore...');
      setTimeout(() => {
        migrarTodaLaBaseDeDatosAFirebaseSilencioso();
      }, 500);
      return;
    }

    // 1. Manejo de eliminaciones
    if (isDelete) {
      const idMatch = path.match(/\/(?:productos|pedidos|clientes|usuarios)\/([^\/\?]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      if (targetId) {
        if (path.includes('/productos')) await eliminarProducto(targetId);
        else if (path.includes('/pedidos')) await eliminarPedido(targetId);
        else if (path.includes('/clientes')) await eliminarCliente(targetId);
        else if (path.includes('/usuarios')) await eliminarUsuario(targetId);
      }
      return;
    }

    // 2. Productos (Alta manual, edición, códigos de barra, stock, precios)
    if (path.includes('/productos')) {
      const prod = resData?.data || resData?.producto || parsedBody;
      if (prod && (prod.sku || prod.id || prod.nombre)) {
        await guardarProducto(prod);
      }
    }

    // 3. Clientes (Alta manual o edición)
    if (path.includes('/clientes')) {
      const cli = resData?.data || resData?.cliente || parsedBody;
      if (cli && (cli.nombre || cli.id)) {
        await guardarCliente(cli);
      }
    }

    // 4. Pedidos (Creación, edición de ítems, cambio de estado, empaque)
    if (path.includes('/pedidos')) {
      const ped = resData?.data || resData?.pedido || parsedBody;
      if (ped && (ped.codigo_pedido || ped.id)) {
        await guardarPedido(ped);
      }
    }

    // 5. Ventas y Formato de Factura (Facturación POS o configuración de ticket)
    if (path.includes('/ventas')) {
      if (path.includes('config-factura')) {
        const cfg = resData?.config || parsedBody?.config || parsedBody;
        if (cfg) {
          await guardarConfiguracion('factura', cfg);
        }
      } else {
        const vta = resData?.venta || resData?.data || parsedBody;
        if (vta && (vta.numero_factura || vta.id)) {
          await guardarVenta(vta);
        }
      }
    }

    // 6. Impresora y Servidor de Impresión
    if (path.includes('/impresion')) {
      if (path.includes('config') || parsedBody?.config || parsedBody?.impresora_seleccionada) {
        const cfg = resData?.config || parsedBody?.config || parsedBody;
        if (cfg) {
          await guardarConfiguracion('impresora', cfg);
        }
      }
    }

    // 7. Usuarios (Creación o edición de usuario del sistema)
    if (path.includes('/usuarios')) {
      const usu = (parsedBody?.username && parsedBody?.nombre)
        ? { id: resData?.id, ...parsedBody }
        : (resData?.data || null);
      if (usu && (usu.username || usu.nombre)) {
        await guardarUsuario(usu);
      }
    }

    // 8. Rutas y Domicilios (Despacho, Asignación de pedidos y Liquidación)
    if (path.includes('/rutas/despachar') || path.includes('/rutas/liquidar') || path.includes('/rutas')) {
      const rutaId = resData?.rutaId || parsedBody?.rutaId || parsedBody?.id;
      const estado = path.includes('liquidar') ? 'LIQUIDADA' : 'EN_RUTA';
      const rutaObj = resData?.ruta || {
        id: rutaId,
        domiciliario_id: parsedBody?.domiciliarioId,
        base_efectivo: parsedBody?.baseEfectivo,
        total_recolectado: parsedBody?.totalEfectivoEntregado,
        estado
      };
      const pedidosLista = resData?.pedidosActualizados || parsedBody?.pedidos || [];
      if (rutaId) {
        await guardarRuta(rutaObj, pedidosLista);
      }
    }
  } catch (err) {
    console.warn('[Firebase Hook] Error al replicar mutación:', err);
  }
}

// ============================================================
// AUTO-SINCRONIZACIÓN AL INICIAR
// ============================================================
async function autoSincronizarAlIniciar() {
  if (!db) return;

  try {
    // 1. Consultar cuántos productos hay en Firestore
    const snapProd = await getDocs(collection(db, 'productos'));
    const cantFirestore = snapProd.size;

    // 2. Consultar cuántos productos hay en local
    const infoRes = await fetch('/api/backup/info');
    const infoJson = await infoRes.json();
    const cantLocal = infoJson?.resumen?.productos || 0;

    console.log(`[Firebase Auto-Sync] Firestore: ${cantFirestore} docs | Local SQLite: ${cantLocal} docs`);

    if (cantFirestore > 0 && cantLocal === 0) {
      // Caso A: El servidor se reinició o republicó y local está vacío -> traer de Firestore
      console.log('[Firebase Auto-Sync] Repoblando base de datos local desde Firestore...');
      await restaurarTodaLaBaseDeDatosDesdeFirebase();
      window.mostrarToast?.('Base de datos restaurada automáticamente desde Firebase Firestore', 'info');
    } else if (cantLocal > 0 && cantFirestore === 0) {
      // Caso B: Primera vez conectando a Firebase y local tiene datos -> subir a Firestore
      console.log('[Firebase Auto-Sync] Inicializando Firestore con datos locales existentes...');
      await migrarTodaLaBaseDeDatosAFirebaseSilencioso();
    }
  } catch (e) {
    console.warn('[Firebase Auto-Sync] Error en comprobación inicial:', e);
  }
}

// Sincronización ultrarrápida en segundo plano usando lotes (writeBatch)
async function migrarTodaLaBaseDeDatosAFirebaseSilencioso() {
  if (!db) return;
  try {
    const resp = await fetch('/api/backup/exportar-json');
    if (!resp.ok) return;
    const json = await resp.json();
    const datos = json.datos || {};

    // 1. Productos
    await guardarColeccionEnLotes('productos', datos.productos || [], p => ({
      id: p.id || p.sku,
      data: {
        sku: String(p.sku),
        nombre: String(p.nombre),
        categoria: p.categoria || '',
        subcategoria: p.subcategoria || '',
        stock: Number(p.stock) || 0,
        precio: Number(p.precio) || 0,
        precio_1: Number(p.precio_1) || Number(p.precio) || 0,
        precio_2: Number(p.precio_2) || 0,
        precio_3: Number(p.precio_3) || 0,
        iva: Number(p.iva) || 0,
        codigo_barras: p.codigo_barras || '',
        codigo_caja: p.codigo_caja || '',
        unidades_por_caja: Number(p.unidades_por_caja) || 1,
        ubicacion: p.ubicacion || '',
        codigo_interno: p.codigo_interno || ''
      }
    }));

    // 2. Clientes
    await guardarColeccionEnLotes('clientes', datos.clientes || [], c => ({
      id: c.id || c.nombre,
      data: {
        nombre: String(c.nombre),
        telefono: c.telefono || '',
        empresa: c.empresa || '',
        ciudad: c.ciudad || '',
        created_at: c.created_at || new Date().toISOString()
      }
    }));

    // 3. Pedidos
    await guardarColeccionEnLotes('pedidos', datos.pedidos || [], p => ({
      id: p.id || p.codigo_pedido,
      data: {
        codigo_pedido: String(p.codigo_pedido),
        cliente: p.cliente || '',
        telefono: p.telefono || '',
        direccion: p.direccion || '',
        municipio: p.municipio || '',
        empresa: p.empresa || '',
        estado: p.estado || 'PENDIENTE',
        tipo_entrega: p.tipo_entrega || 'TIENDA',
        total: Number(p.total) || 0,
        metodo_pago_final: p.metodo_pago_final || '',
        estado_liquidacion: p.estado_liquidacion || 'PENDIENTE',
        estado_entrega: p.estado_entrega || 'PENDIENTE',
        observacion: p.observacion || '',
        fecha_creacion: p.fecha_creacion || ''
      }
    }));

    // 4. Ventas
    await guardarColeccionEnLotes('ventas', datos.ventas || [], v => ({
      id: v.id || v.numero_factura,
      data: {
        numero_factura: String(v.numero_factura),
        fecha: v.fecha || new Date().toISOString(),
        cliente_nombre: v.cliente_nombre || 'Consumidor Final',
        cliente_documento: v.cliente_documento || '',
        cliente_telefono: v.cliente_telefono || '',
        usuario_nombre: v.usuario_nombre || '',
        total: Number(v.total) || 0,
        metodo_pago: v.metodo_pago || 'EFECTIVO',
        estado: v.estado || 'COMPLETADA'
      }
    }));

    // 5. Usuarios
    await guardarColeccionEnLotes('usuarios', datos.usuarios || [], u => ({
      id: u.id || u.username,
      data: {
        username: String(u.username),
        nombre: String(u.nombre),
        rol: u.rol || 'operador',
        activo: u.activo !== undefined ? Number(u.activo) : 1
      }
    }));

    // 6. Domiciliarios
    await guardarColeccionEnLotes('domiciliarios', datos.domiciliarios || [], d => ({
      id: d.id || d.nombre,
      data: {
        nombre: String(d.nombre),
        telefono: d.telefono || '',
        activo: d.activo !== undefined ? Number(d.activo) : 1
      }
    }));

    // 7. Rutas
    await guardarColeccionEnLotes('rutas_domicilio', datos.rutas_domicilio || [], r => ({
      id: r.id,
      data: {
        domiciliario_id: Number(r.domiciliario_id) || 0,
        fecha_creacion: r.fecha_creacion || '',
        estado: r.estado || 'EN_RUTA',
        base_efectivo: Number(r.base_efectivo) || 0,
        total_recolectado: Number(r.total_recolectado) || 0,
        usuario_liquidacion_nombre: r.usuario_liquidacion_nombre || ''
      }
    }));

    // 8. Copia de control
    await setDoc(doc(db, 'respaldos', 'ultimo_respaldo'), {
      fecha: new Date().toISOString(),
      total_tablas: 7,
      usuario: auth?.currentUser?.email || 'sistema'
    }, { merge: true });

    console.log('[Firebase] Toda la base de datos se sincronizó exitosamente con Firestore.');
  } catch (err) {
    console.warn('[Firebase] Error en sincronización silenciosa:', err);
  }
}

// ============================================================
// TRANSFERENCIA COMPLETA: SQLite -> Firebase Firestore (Manual)
// ============================================================
async function migrarTodaLaBaseDeDatosAFirebase() {
  if (!db) {
    window.mostrarToast?.('Firebase no está inicializado', 'error');
    return;
  }

  const logBox = document.getElementById('fb-resultado-container');
  if (logBox) {
    logBox.innerHTML = `
      <div class="space-y-2">
        <p class="text-amber-400 font-bold flex items-center gap-2">
          <span class="animate-spin">⏳</span> Extrayendo base de datos completa de Jispiplast Express...
        </p>
        <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div id="fb-progress-bar" class="bg-amber-500 h-full transition-all duration-300" style="width: 10%"></div>
        </div>
        <p id="fb-progress-text" class="text-xs text-slate-300">Consultando datos locales...</p>
      </div>
    `;
  }

  try {
    const resp = await fetch('/api/backup/exportar-json');
    if (!resp.ok) throw new Error('Error al extraer datos locales');
    const json = await resp.json();
    const datos = json.datos || {};

    const progressEl = document.getElementById('fb-progress-bar');
    const textEl = document.getElementById('fb-progress-text');

    const updateProg = (pct, msg) => {
      if (progressEl) progressEl.style.width = `${pct}%`;
      if (textEl) textEl.textContent = msg;
    };

    let totalSincronizados = 0;

    // 2. Subir Productos
    const productos = datos.productos || [];
    updateProg(15, `Subiendo ${productos.length} productos a Firestore en lotes...`);
    const cantProd = await guardarColeccionEnLotes('productos', productos, p => ({
      id: p.id || p.sku,
      data: {
        sku: String(p.sku),
        nombre: String(p.nombre),
        categoria: p.categoria || '',
        subcategoria: p.subcategoria || '',
        stock: Number(p.stock) || 0,
        precio: Number(p.precio) || 0,
        precio_1: Number(p.precio_1) || Number(p.precio) || 0,
        precio_2: Number(p.precio_2) || 0,
        precio_3: Number(p.precio_3) || 0,
        iva: Number(p.iva) || 0,
        codigo_barras: p.codigo_barras || '',
        codigo_caja: p.codigo_caja || '',
        unidades_por_caja: Number(p.unidades_por_caja) || 1,
        ubicacion: p.ubicacion || '',
        codigo_interno: p.codigo_interno || ''
      }
    }));
    totalSincronizados += cantProd;

    // 3. Subir Clientes
    const clientes = datos.clientes || [];
    updateProg(35, `Subiendo ${clientes.length} clientes a Firestore en lotes...`);
    const cantCli = await guardarColeccionEnLotes('clientes', clientes, c => ({
      id: c.id || c.nombre,
      data: {
        nombre: String(c.nombre),
        telefono: c.telefono || '',
        empresa: c.empresa || '',
        ciudad: c.ciudad || '',
        created_at: c.created_at || new Date().toISOString()
      }
    }));
    totalSincronizados += cantCli;

    // 4. Subir Pedidos
    const pedidos = datos.pedidos || [];
    updateProg(55, `Subiendo ${pedidos.length} pedidos a Firestore en lotes...`);
    const cantPed = await guardarColeccionEnLotes('pedidos', pedidos, p => ({
      id: p.id || p.codigo_pedido,
      data: {
        codigo_pedido: String(p.codigo_pedido),
        cliente: p.cliente || '',
        telefono: p.telefono || '',
        direccion: p.direccion || '',
        municipio: p.municipio || '',
        empresa: p.empresa || '',
        estado: p.estado || 'PENDIENTE',
        tipo_entrega: p.tipo_entrega || 'TIENDA',
        total: Number(p.total) || 0,
        metodo_pago_final: p.metodo_pago_final || '',
        estado_liquidacion: p.estado_liquidacion || 'PENDIENTE',
        estado_entrega: p.estado_entrega || 'PENDIENTE',
        observacion: p.observacion || '',
        fecha_creacion: p.fecha_creacion || ''
      }
    }));
    totalSincronizados += cantPed;

    // 5. Subir Ventas
    const ventas = datos.ventas || [];
    updateProg(75, `Subiendo ${ventas.length} ventas a Firestore en lotes...`);
    const cantVta = await guardarColeccionEnLotes('ventas', ventas, v => ({
      id: v.id || v.numero_factura,
      data: {
        numero_factura: String(v.numero_factura),
        fecha: v.fecha || new Date().toISOString(),
        cliente_nombre: v.cliente_nombre || 'Consumidor Final',
        cliente_documento: v.cliente_documento || '',
        cliente_telefono: v.cliente_telefono || '',
        usuario_nombre: v.usuario_nombre || '',
        total: Number(v.total) || 0,
        metodo_pago: v.metodo_pago || 'EFECTIVO',
        estado: v.estado || 'COMPLETADA'
      }
    }));
    totalSincronizados += cantVta;

    // 6. Subir Usuarios
    const usuarios = datos.usuarios || [];
    updateProg(85, `Subiendo ${usuarios.length} usuarios a Firestore...`);
    const cantUsu = await guardarColeccionEnLotes('usuarios', usuarios, u => ({
      id: u.id || u.username,
      data: {
        username: String(u.username),
        nombre: String(u.nombre),
        rol: u.rol || 'operador',
        activo: u.activo !== undefined ? Number(u.activo) : 1
      }
    }));
    totalSincronizados += cantUsu;

    // 7. Subir Domiciliarios y Rutas
    const domiciliarios = datos.domiciliarios || [];
    const rutas = datos.rutas_domicilio || [];
    await guardarColeccionEnLotes('domiciliarios', domiciliarios, d => ({
      id: d.id || d.nombre,
      data: {
        nombre: String(d.nombre),
        telefono: d.telefono || '',
        activo: d.activo !== undefined ? Number(d.activo) : 1
      }
    }));
    await guardarColeccionEnLotes('rutas_domicilio', rutas, r => ({
      id: r.id,
      data: {
        domiciliario_id: Number(r.domiciliario_id) || 0,
        fecha_creacion: r.fecha_creacion || '',
        estado: r.estado || 'EN_RUTA',
        base_efectivo: Number(r.base_efectivo) || 0,
        total_recolectado: Number(r.total_recolectado) || 0,
        usuario_liquidacion_nombre: r.usuario_liquidacion_nombre || ''
      }
    }));
    totalSincronizados += domiciliarios.length + rutas.length;

    // 8. Subir Configuraciones (Factura e Impresora)
    try {
      const resCfgFact = await fetch('/api/ventas/config-factura');
      if (resCfgFact.ok) {
        const jsonCfg = await resCfgFact.json();
        if (jsonCfg?.config) await guardarConfiguracion('factura', jsonCfg.config);
      }
      const resCfgImpr = await fetch('/api/impresion/config');
      if (resCfgImpr.ok) {
        const jsonImpr = await resCfgImpr.json();
        if (jsonImpr?.config) await guardarConfiguracion('impresora', jsonImpr.config);
      }
    } catch (_) {}

    // 9. Respaldo maestro
    updateProg(95, 'Guardando copia maestra en Firestore...');
    await setDoc(doc(db, 'respaldos', 'ultimo_respaldo'), {
      fecha: new Date().toISOString(),
      total_tablas: 8,
      usuario: auth?.currentUser?.email || 'admin',
      resumen: {
        productos: productos.length,
        clientes: clientes.length,
        pedidos: pedidos.length,
        ventas: ventas.length,
        usuarios: usuarios.length,
        configuraciones: 2
      }
    }, { merge: true });

    updateProg(100, '¡Sincronización completa con Firebase!');

    if (logBox) {
      logBox.innerHTML = `
        <div class="space-y-3">
          <div class="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300">
            <h4 class="font-bold text-sm flex items-center gap-2">
              <span>🎉</span> ¡Toda la base de datos está guardada en Firebase Firestore!
            </h4>
            <p class="text-xs text-slate-300 mt-1">
              Se migraron con éxito <strong>${totalSincronizados} documentos</strong> y todas las configuraciones de factura e impresora. A partir de ahora todas las operaciones se replican automáticamente.
            </p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
            <div class="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
              <span class="text-slate-400 block">📦 Productos</span>
              <strong class="text-emerald-400 text-sm">${productos.length}</strong>
            </div>
            <div class="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
              <span class="text-slate-400 block">👥 Clientes</span>
              <strong class="text-emerald-400 text-sm">${clientes.length}</strong>
            </div>
            <div class="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
              <span class="text-slate-400 block">📋 Pedidos</span>
              <strong class="text-emerald-400 text-sm">${pedidos.length}</strong>
            </div>
            <div class="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
              <span class="text-slate-400 block">🧾 Ventas</span>
              <strong class="text-emerald-400 text-sm">${ventas.length}</strong>
            </div>
            <div class="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
              <span class="text-slate-400 block">👤 Usuarios</span>
              <strong class="text-emerald-400 text-sm">${usuarios.length}</strong>
            </div>
            <div class="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
              <span class="text-slate-400 block">⚙️ Configs</span>
              <strong class="text-emerald-400 text-sm">2</strong>
            </div>
          </div>
        </div>
      `;
    }

    window.mostrarToast?.(`¡Base de datos migrada a Firebase (${totalSincronizados} registros)!`, 'success');
  } catch (err) {
    console.error('Error migrando a Firebase:', err);
    if (logBox) {
      logBox.innerHTML = `
        <div class="p-4 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300">
          <p class="font-bold text-xs">Error durante la sincronización:</p>
          <p class="font-mono text-xs mt-1 text-rose-400">${err.message}</p>
        </div>
      `;
    }
    window.mostrarToast?.('Error al migrar a Firebase', 'error');
  }
}

// ============================================================
// RESTAURAR DE FIREBASE -> LOCAL SQLITE
// ============================================================
async function restaurarTodaLaBaseDeDatosDesdeFirebase() {
  if (!db) {
    window.mostrarToast?.('Firebase no está inicializado', 'error');
    return;
  }

  const logBox = document.getElementById('fb-resultado-container');
  if (logBox) {
    logBox.innerHTML = `<p class="text-amber-400 animate-pulse">Descargando todas las colecciones desde Firebase Firestore...</p>`;
  }

  try {
    const [snapProd, snapCli, snapPed, snapVta, snapDom, snapRut, snapUsu, snapCfg] = await Promise.all([
      getDocs(collection(db, 'productos')),
      getDocs(collection(db, 'clientes')),
      getDocs(collection(db, 'pedidos')),
      getDocs(collection(db, 'ventas')),
      getDocs(collection(db, 'domiciliarios')),
      getDocs(collection(db, 'rutas_domicilio')),
      getDocs(collection(db, 'usuarios')),
      getDocs(collection(db, 'configuracion'))
    ]);

    const productos = [];
    snapProd.forEach(d => productos.push({ id: d.id, ...d.data() }));

    const clientes = [];
    snapCli.forEach(d => clientes.push({ id: d.id, ...d.data() }));

    const pedidos = [];
    snapPed.forEach(d => pedidos.push({ id: d.id, ...d.data() }));

    const ventas = [];
    snapVta.forEach(d => ventas.push({ id: d.id, ...d.data() }));

    const domiciliarios = [];
    snapDom.forEach(d => domiciliarios.push({ id: d.id, ...d.data() }));

    const rutas_domicilio = [];
    snapRut.forEach(d => rutas_domicilio.push({ id: d.id, ...d.data() }));

    const usuarios = [];
    snapUsu.forEach(d => usuarios.push({ id: d.id, ...d.data() }));

    // Aplicar configuraciones restauradas
    snapCfg.forEach(d => {
      const data = d.data();
      if (d.id === 'factura' || data.tipo === 'factura') {
        localStorage.setItem('jispi_config_factura', JSON.stringify(data));
        fetch('/api/ventas/config-factura', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: data })
        }).catch(() => {});
      } else if (d.id === 'impresora' || data.tipo === 'impresora') {
        fetch('/api/impresion/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: data })
        }).catch(() => {});
      }
    });

    if (productos.length === 0 && clientes.length === 0) {
      if (logBox) {
        logBox.innerHTML = `<p class="text-slate-400">Las colecciones en Firebase están vacías aún. Primero haz clic en "Subir Toda la BD a Firebase".</p>`;
      }
      return;
    }

    const resImport = await fetch('/api/backup/importar-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productos, clientes, pedidos, ventas, domiciliarios, rutas_domicilio, usuarios })
    });

    const resJson = await resImport.json();
    if (!resJson.ok) throw new Error(resJson.error || 'Error al importar datos a la aplicación');

    if (logBox) {
      logBox.innerHTML = `
        <div class="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300">
          <h4 class="font-bold text-sm">✅ ¡Datos sincronizados desde Firebase a la aplicación!</h4>
          <p class="text-xs text-slate-300 mt-1">
            Se actualizaron ${productos.length} productos, ${clientes.length} clientes, ${pedidos.length} pedidos, ${ventas.length} ventas, ${usuarios.length} usuarios y configuraciones.
          </p>
        </div>
      `;
    }

    // Refrescar vistas activas
    if (window.ModuloInventario?.cargarProductos) window.ModuloInventario.cargarProductos();
    if (window.ModuloVentas?.cargarProductos) window.ModuloVentas.cargarProductos();
    if (window.ModuloVentas?.cargarConfigFactura) window.ModuloVentas.cargarConfigFactura();
    if (window.ModuloDomicilios?.cargarRutas) window.ModuloDomicilios.cargarRutas();
  } catch (err) {
    console.error('Error restaurando desde Firebase:', err);
    if (logBox) {
      logBox.innerHTML = `<p class="text-rose-400">Error al restaurar: ${err.message}</p>`;
    }
  }
}

// ============================================================
// CONSULTAR COLECCIONES EN TIEMPO REAL
// ============================================================
async function consultarColeccion(colName, filtroBusqueda = '') {
  if (!db) {
    window.mostrarToast?.('Firebase no está inicializado', 'error');
    return;
  }

  const logBox = document.getElementById('fb-resultado-container');
  if (logBox) {
    logBox.innerHTML = `<p class="text-amber-400 animate-pulse">Consultando colección '${colName}' en Firebase Firestore...</p>`;
  }

  try {
    const snap = await getDocs(collection(db, colName));
    let docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));

    if (filtroBusqueda.trim()) {
      const q = filtroBusqueda.trim().toLowerCase();
      docs = docs.filter(d => {
        const str = JSON.stringify(d).toLowerCase();
        return str.includes(q);
      });
    }

    if (!logBox) return;

    if (docs.length === 0) {
      logBox.innerHTML = `
        <div class="text-slate-400 text-xs p-4">
          No se encontraron documentos en la colección <strong>'${colName}'</strong>.
          ${filtroBusqueda ? '(Con el filtro actual)' : 'Puedes migrar tus datos con el botón "Migrar Todo a Firestore".'}
        </div>
      `;
      return;
    }

    // Renderizar tarjetas de resultados
    let html = `
      <div class="space-y-3">
        <div class="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-700">
          <span>Colección: <strong class="text-amber-400 font-mono">${colName}</strong></span>
          <span class="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">${docs.length} registros</span>
        </div>
        <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
    `;

    docs.slice(0, 50).forEach(d => {
      let titulo = d.nombre || d.cliente || d.numero_factura || d.codigo_pedido || d.tipo || d.id;
      let subtitulo = d.sku ? `SKU: ${d.sku} | Stock: ${d.stock || 0} | Precio: $${(d.precio || 0).toLocaleString('es-CO')}`
                    : d.telefono ? `Tel: ${d.telefono} | Empresa: ${d.empresa || 'N/A'}`
                    : d.total ? `Total: $${(d.total || 0).toLocaleString('es-CO')} | Método: ${d.metodo_pago || d.metodo_pago_final || 'N/A'}`
                    : d.tipo ? `Tipo: ${d.tipo} | Actualizado: ${d.updated_at || 'N/A'}`
                    : `ID: ${d.id}`;

      html += `
        <div class="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs transition-colors">
          <div class="flex items-center justify-between">
            <h5 class="font-bold text-slate-100">${titulo}</h5>
            <span class="font-mono text-[10px] text-slate-400">ID: ${d.id}</span>
          </div>
          <p class="text-slate-300 text-[11px] mt-1">${subtitulo}</p>
        </div>
      `;
    });

    if (docs.length > 50) {
      html += `<p class="text-center text-[10px] text-slate-400 py-1">Mostrando los primeros 50 registros de ${docs.length}...</p>`;
    }

    html += `</div></div>`;
    logBox.innerHTML = html;
  } catch (err) {
    console.error(`Error consultando colección ${colName}:`, err);
    if (logBox) {
      logBox.innerHTML = `<p class="text-rose-400 text-xs">Error en consulta: ${err.message}</p>`;
    }
  }
}

// ============================================================
// MODAL DE GESTIÓN Y CONSULTAS DE FIREBASE
// ============================================================
function abrirModalFirebase() {
  let modal = document.getElementById('modal-firebase');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'modal-firebase';
  modal.className = 'fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4';
  
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-200">
      
      <!-- Header -->
      <div class="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-5 py-4 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="text-2xl leading-none">🔥</span>
          <div>
            <h3 class="text-base sm:text-lg font-bold">Base de Datos Firebase (Firestore)</h3>
            <p class="text-xs text-amber-100">Almacenamiento persistente en la nube y sincronización automática</p>
          </div>
        </div>
        <button onclick="document.getElementById('modal-firebase').remove()" class="text-white/80 hover:text-white text-2xl font-bold leading-none cursor-pointer">&times;</button>
      </div>

      <!-- Cuerpo -->
      <div class="p-5 space-y-4 overflow-y-auto">
        
        <!-- Estado de Autenticación Google / Firebase -->
        <div id="fb-auth-status-container"></div>

        <!-- Acciones Principales de Sincronización -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-col justify-between space-y-2">
            <div>
              <h4 class="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                <span>☁️</span> Migrar Todo a Firestore
              </h4>
              <p class="text-[11px] text-amber-800 mt-1">
                Sube todos tus productos, clientes, pedidos, ventas y configuraciones a Firestore. Las escrituras futuras se sincronizan solas.
              </p>
            </div>
            <button onclick="window.FirebaseClient.migrarTodaLaBaseDeDatosAFirebase()" 
                    class="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-transform active:scale-95">
              <span>🚀</span> Migrar Todo a Firestore
            </button>
          </div>

          <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex flex-col justify-between space-y-2">
            <div>
              <h4 class="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                <span>📥</span> Traer Datos de Firestore
              </h4>
              <p class="text-[11px] text-emerald-800 mt-1">
                Descarga y sincroniza la información de Firestore al sistema local en segundos.
              </p>
            </div>
            <button onclick="window.FirebaseClient.restaurarTodaLaBaseDeDatosDesdeFirebase()" 
                    class="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-transform active:scale-95">
              <span>🔄</span> Traer Datos de Firestore
            </button>
          </div>
        </div>

        <!-- Consultas en tiempo real a Firebase -->
        <div class="space-y-2 pt-2 border-t border-slate-100">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h4 class="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <span>🔍</span> Consultar Colecciones en Firebase
            </h4>
            <div class="flex items-center gap-2">
              <input type="text" id="fb-input-search" placeholder="Buscar por texto..." 
                     class="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 w-36 sm:w-44" />
              <button onclick="window.FirebaseClient.ejecutarConsultaColeccionActual()"
                      class="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer">
                Buscar
              </button>
            </div>
          </div>

          <!-- Pestañas de Colecciones -->
          <div class="flex flex-wrap gap-1.5" id="fb-col-tabs">
            <button onclick="window.FirebaseClient.seleccionarColeccion('productos', this)" class="fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-xs cursor-pointer">📦 Productos</button>
            <button onclick="window.FirebaseClient.seleccionarColeccion('clientes', this)" class="fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">👥 Clientes</button>
            <button onclick="window.FirebaseClient.seleccionarColeccion('pedidos', this)" class="fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">📋 Pedidos</button>
            <button onclick="window.FirebaseClient.seleccionarColeccion('ventas', this)" class="fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">🧾 Ventas</button>
            <button onclick="window.FirebaseClient.seleccionarColeccion('usuarios', this)" class="fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">👤 Usuarios</button>
            <button onclick="window.FirebaseClient.seleccionarColeccion('domiciliarios', this)" class="fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">🛵 Domiciliarios</button>
            <button onclick="window.FirebaseClient.seleccionarColeccion('rutas_domicilio', this)" class="fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">🚚 Rutas</button>
            <button onclick="window.FirebaseClient.seleccionarColeccion('configuracion', this)" class="fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">⚙️ Configuración</button>
          </div>

          <!-- Contenedor de Resultados -->
          <div id="fb-resultado-container" class="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs min-h-[160px] max-h-72 overflow-y-auto">
            <p class="text-slate-400">Selecciona una colección o pulsa "Buscar" para consultar documentos en Firestore...</p>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span class="font-mono">BD: ${firebaseConfig?.firestoreDatabaseId || 'default'}</span>
        <button onclick="document.getElementById('modal-firebase').remove()" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer transition-colors">
          Cerrar
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
  actualizarEstadoUI();
  seleccionarColeccion('productos');
}

let coleccionActual = 'productos';

function seleccionarColeccion(colName, btnEl) {
  coleccionActual = colName;
  const buttons = document.querySelectorAll('#fb-col-tabs .fb-tab-btn');
  buttons.forEach(b => {
    b.className = 'fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer';
  });
  if (btnEl) {
    btnEl.className = 'fb-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-xs cursor-pointer';
  }
  ejecutarConsultaColeccionActual();
}

function ejecutarConsultaColeccionActual() {
  const q = document.getElementById('fb-input-search')?.value || '';
  consultarColeccion(coleccionActual, q);
}

// Exportar funciones a window.FirebaseClient
window.FirebaseClient = {
  abrirModalFirebase,
  iniciarSesionGoogle,
  cerrarSesionGoogle,
  renderizarBannerConexion,
  actualizarEstadoUI,
  guardarProducto,
  eliminarProducto,
  guardarCliente,
  eliminarCliente,
  guardarVenta,
  guardarPedido,
  eliminarPedido,
  guardarUsuario,
  eliminarUsuario,
  guardarRuta,
  guardarConfiguracion,
  obtenerConfiguracion,
  guardarColeccionEnLotes,
  handleMutation,
  autoSincronizarAlIniciar,
  migrarTodaLaBaseDeDatosAFirebase,
  migrarTodaLaBaseDeDatosAFirebaseSilencioso,
  restaurarTodaLaBaseDeDatosDesdeFirebase,
  consultarColeccion,
  seleccionarColeccion,
  ejecutarConsultaColeccionActual
};

initFirebase();

