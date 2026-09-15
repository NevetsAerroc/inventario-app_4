const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const https = require('https');
const db = require('./db/database'); // <-- Apunta a database.js

const { router: authRouter, authMiddleware } = require('./routes/auth');
const usuariosRouter = require('./routes/usuarios');
const productosRouter = require('./routes/productos');
const pedidosRouter = require('./routes/pedidos');
const clientesRouter = require('./routes/clientes');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const CERT_DIR = path.join(__dirname, 'certs');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware global de autenticación (valida token si viene en cabeceras)
app.use(authMiddleware);

// Frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// API Base
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/productos', productosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/clientes', clientesRouter);
app.get('/api/health', (req, res) => res.json({ ok: true, status: 'up', time: new Date().toISOString() }));

// ==========================================
// RUTAS MÓDULO D: DOMICILIOS & LIQUIDACIÓN
// ==========================================

app.get('/api/domiciliarios', (req, res) => {
  try {
    res.json({ ok: true, domiciliarios: db.prepare("SELECT * FROM domiciliarios WHERE activo = 1").all() });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.post('/api/domiciliarios', (req, res) => {
  try {
    const info = db.prepare("INSERT INTO domiciliarios (nombre, telefono) VALUES (?, ?)").run(req.body.nombre, req.body.telefono || '');
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Helper para determinar si el usuario es un domiciliario de calle (solo ve sus rutas en curso)
function esDomiDeCalle(user) {
  if (!user) return false;
  if (user.rol === 'superadmin' || user.rol === 'admin' || user.rol === 'admin_domicilios') return false;
  const perms = Array.isArray(user.permisos) ? user.permisos : [];
  if (perms.includes('domicilios_todos')) return false;
  return user.rol === 'domiciliario' || perms.includes('domicilios_en_curso');
}

app.get('/api/domicilios/pendientes', (req, res) => {
  try {
    if (esDomiDeCalle(req.user)) {
      return res.status(403).json({ ok: false, error: 'Acceso no permitido para domiciliarios' });
    }
    // ?fecha=YYYY-MM-DD filtra por el dia en que el pedido quedo EMPACADO
    // (o, si no tiene fecha_cierre, por el dia en que se creo). Sin el
    // parametro, se devuelven todos los pendientes sin filtrar por fecha.
    const fecha = (req.query.fecha || '').trim();
    let sql = `
      SELECT * FROM pedidos
      WHERE estado = 'EMPACADO'
        AND (ruta_id IS NULL OR ruta_id = 0 OR ruta_id = '')
        AND (COALESCE(estado_liquidacion, 'PENDIENTE') = 'PENDIENTE' OR estado_liquidacion = '')
    `;
    const params = [];
    if (fecha) {
      sql += ` AND date(COALESCE(fecha_cierre, fecha_creacion), 'localtime') = ?`;
      params.push(fecha);
    }
    sql += ` ORDER BY id DESC`;

    const pedidos = db.prepare(sql).all(...params);
    res.json({ ok: true, pedidos });
  } catch (err) { 
    res.status(500).json({ ok: false, error: err.message }); 
  }
});

app.post('/api/rutas/despachar', (req, res) => {
  try {
    if (esDomiDeCalle(req.user)) {
      return res.status(403).json({ ok: false, error: 'Solo los administradores pueden despachar rutas' });
    }
    const { domiciliarioId, pedidos, pedidoIds, baseEfectivo } = req.body;

    if (!domiciliarioId || Number(domiciliarioId) === 0) {
      return res.status(400).json({ ok: false, error: 'Debes seleccionar y asignar obligatoriamente un domiciliario para despachar la ruta.' });
    }

    // Acepta formato nuevo (array de objetos) o el viejo (solo ids)
    let lista = [];
    if (Array.isArray(pedidos) && pedidos.length > 0) {
      lista = pedidos;
    } else if (Array.isArray(pedidoIds) && pedidoIds.length > 0) {
      lista = pedidoIds.map(id => ({ id, metodoPago: 'EFECTIVO' }));
    }

    if (!lista.length) {
      return res.status(400).json({ ok: false, error: 'Debes seleccionar al menos un pedido' });
    }

    const tx = db.transaction(() => {
      const domiciliario = db.prepare('SELECT id, nombre FROM domiciliarios WHERE id = ? AND activo = 1').get(domiciliarioId);
      if (!domiciliario) throw new Error('El domiciliario seleccionado no es válido o no está activo.');

      const getPedido = db.prepare('SELECT * FROM pedidos WHERE id = ?');
      for (const item of lista) {
        const pedido = getPedido.get(item.id);
        if (!pedido) throw new Error(`Pedido ${item.id} no encontrado`);
        if (pedido.estado !== 'EMPACADO') {
          throw new Error(`El pedido ${pedido.codigo_pedido} aún no está empacado`);
        }
        if (pedido.ruta_id && Number(pedido.ruta_id) !== 0) {
          throw new Error(`El pedido ${pedido.codigo_pedido} ya está en una ruta`);
        }
      }

      const infoRuta = db.prepare(
        "INSERT INTO rutas_domicilio (domiciliario_id, base_efectivo, estado) VALUES (?, ?, 'EN_RUTA')"
      ).run(domiciliarioId, baseEfectivo || 0);

            const updatePedido = db.prepare(`
        UPDATE pedidos
        SET ruta_id = ?,
            tipo_entrega = 'DOMICILIO',
            estado_liquidacion = 'EN_RUTA',
            metodo_pago_final = ?,
            total = ?,
            total_original = COALESCE(NULLIF(total_original, 0), ?),
            devuelta_calculada = ?
        WHERE id = ?
      `);

      const BILLETE = 50000;
      // La devuelta se redondea al múltiplo de $50 más cercano: no existen
      // monedas de menor denominación, así que no se puede dar cambio exacto.
      const redondearDevuelta50 = (v) => {
        const n = Number(v) || 0;
        if (n <= 0) return 0;
        return Math.round(n / 50) * 50;
      };

      for (const item of lista) {
        const pedido = getPedido.get(item.id);
        const totalOriginal = Number(pedido.total) || 0;

        // Si el pedido fue editado antes de despachar (precio corregido),
        // se usa el nuevo valor; si no, se conserva el que ya tenía.
        let total = (item.total !== undefined && item.total !== null && Number(item.total) > 0)
          ? Number(item.total)
          : totalOriginal;
        total = Math.round(total);

        // "Paga con" y "devuelta": se respeta lo definido en el despacho
        // (incluye ediciones manuales y la opción "sin devuelta"); si no
        // llegó nada, se calcula el sugerido por defecto.
        let pagaCon = (item.pagaCon !== undefined && item.pagaCon !== null && Number(item.pagaCon) >= total)
          ? Math.round(Number(item.pagaCon))
          : (total > 0 ? Math.ceil(total / BILLETE) * BILLETE : 0);

        let devuelta = (item.devuelta !== undefined && item.devuelta !== null)
          ? redondearDevuelta50(Number(item.devuelta))
          : redondearDevuelta50(Math.max(0, pagaCon - total));

        updatePedido.run(
          infoRuta.lastInsertRowid,
          item.metodoPago || 'EFECTIVO',
          total,
          totalOriginal,
          devuelta,
          item.id
        );
      }
      return infoRuta.lastInsertRowid;
    });

    res.json({ ok: true, rutaId: tx() });
  } catch (err) {
    const msg = err.message || 'Error al despachar';
    const status = /no válido|no encontrado|aún no está|ya está en una ruta/i.test(msg) ? 400 : 500;
    res.status(status).json({ ok: false, error: msg });
  }
});

app.get('/api/rutas', (req, res) => {
  try {
    const estado = req.query.estado || 'EN_RUTA';
    const fecha = (req.query.fecha || '').trim();

    // Para rutas LIQUIDADAS filtramos por el dia en que se liquidaron;
    // para rutas EN_RUTA filtramos por el dia en que se despacharon.
    const columnaFecha = estado === 'LIQUIDADA' ? 'r.fecha_liquidacion' : 'r.fecha_creacion';

    let sql = `
      SELECT r.*, d.nombre as domiciliario_nombre,
             (SELECT COUNT(*) FROM pedidos p WHERE p.ruta_id = r.id) as cantidad_pedidos,
             (SELECT SUM(total) FROM pedidos p WHERE p.ruta_id = r.id) as total_dinero
      FROM rutas_domicilio r
      LEFT JOIN domiciliarios d ON r.domiciliario_id = d.id
      WHERE r.estado = ?
    `;
    const params = [estado];

    // Si el usuario autenticado es domiciliario de calle, sólo puede ver SUS rutas
    if (esDomiDeCalle(req.user)) {
      sql += ` AND r.domiciliario_id = ?`;
      params.push(req.user.domiciliario_id || 0);
    } else if (req.query.domiciliario_id) {
      sql += ` AND r.domiciliario_id = ?`;
      params.push(Number(req.query.domiciliario_id));
    }

    if (fecha) {
      sql += ` AND date(COALESCE(${columnaFecha}, r.fecha_creacion), 'localtime') = ?`;
      params.push(fecha);
    }
    sql += ` ORDER BY r.fecha_creacion DESC`;

    const rutas = db.prepare(sql).all(...params);
    res.json({ ok: true, rutas });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.get('/api/rutas/:id', (req, res) => {
  try {
    const ruta = db.prepare("SELECT r.*, d.nombre as domiciliario_nombre FROM rutas_domicilio r LEFT JOIN domiciliarios d ON r.domiciliario_id = d.id WHERE r.id = ?").get(req.params.id);
    if (!ruta) return res.status(404).json({ ok: false, error: 'Ruta no encontrada' });

    if (esDomiDeCalle(req.user) && ruta.domiciliario_id !== req.user.domiciliario_id) {
      return res.status(403).json({ ok: false, error: 'No tienes autorización para ver esta ruta' });
    }

    const pedidos = db.prepare("SELECT * FROM pedidos WHERE ruta_id = ?").all(req.params.id);
    for (const p of pedidos) {
      const items = db.prepare("SELECT * FROM detalle_pedidos WHERE pedido_id = ?").all(p.id);
      p.items = items || [];
    }
    res.json({ ok: true, ruta, pedidos });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Actualizar un pedido mientras la ruta está en curso (precio, método, entrega)
app.put('/api/rutas/pedido/:id', (req, res) => {
  try {
    const { total, metodoPago, estadoEntrega, comprobante, observacion, total_original } = req.body;
    const id = req.params.id;

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
    if (pedido.estado_liquidacion === 'LIQUIDADO') {
      return res.status(400).json({ ok: false, error: 'El pedido ya está liquidado' });
    }

    // Solo actualiza campos que vengan en el body (undefined = no tocar)
    const sets = [];
    const vals = [];

    if (total != null) { sets.push('total = ?'); vals.push(total); }
    if (metodoPago != null && metodoPago !== '') {
      sets.push('metodo_pago_final = ?'); vals.push(metodoPago);
    }
    if (estadoEntrega != null && estadoEntrega !== '') {
      sets.push('estado_entrega = ?'); vals.push(estadoEntrega);
    }
    if (comprobante !== undefined) {
      sets.push('comprobante_transf = ?'); vals.push(comprobante || '');
    }
    if (observacion != null && observacion !== '') {
      sets.push('observacion = ?'); vals.push(observacion);
    }
    // total_original solo la primera vez
    if (total_original != null && !(pedido.total_original > 0)) {
      sets.push('total_original = ?'); vals.push(total_original);
    }

    if (sets.length) {
      vals.push(id);
      db.prepare(`UPDATE pedidos SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }

    const actualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    res.json({ ok: true, pedido: actualizado });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/rutas/liquidar', (req, res) => {
  try {
    if (esDomiDeCalle(req.user)) {
      return res.status(403).json({ ok: false, error: 'Solo administradores pueden liquidar rutas' });
    }
    const { rutaId, pedidosLiquidacion, totalEfectivoEntregado } = req.body;
    const tx = db.transaction(() => {
      const updatePedido = db.prepare(`
        UPDATE pedidos
        SET metodo_pago_final = ?,
            comprobante_transf = ?,
            estado_liquidacion = ?
        WHERE id = ?
      `);

      for (const item of pedidosLiquidacion) {
        // Si quedó transferencia pendiente, no lo marca como liquidado total
        const estado =
          item.metodoPago === 'TRANSFERENCIA_PENDIENTE'
            ? 'PAGO_PENDIENTE'
            : 'LIQUIDADO';

        updatePedido.run(
          item.metodoPago,
          item.comprobante || '',
          estado,
          item.id
        );
      }

      db.prepare(`
        UPDATE rutas_domicilio
        SET estado = 'LIQUIDADA',
            total_recolectado = ?,
            fecha_liquidacion = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(totalEfectivoEntregado, rutaId);
    });
    tx();
    res.json({ ok: true, mensaje: 'Ruta liquidada' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================================================================
// AUDITORÍA DE DOMICILIOS, RUTAS Y PAGOS PENDIENTES
// ==================================================================
app.get('/api/domicilios/auditoria', (req, res) => {
  try {
    if (esDomiDeCalle(req.user)) {
      return res.status(403).json({ ok: false, error: 'Acceso denegado a auditoría' });
    }
    const fecha = (req.query.fecha || '').trim(); // YYYY-MM-DD o vacío

    // 1. Obtener todas las rutas que coincidan con la fecha
    let sqlRutas = `
      SELECT r.*, d.nombre as domiciliario_nombre, d.telefono as domiciliario_telefono,
             (SELECT COUNT(*) FROM pedidos p WHERE p.ruta_id = r.id) as cantidad_pedidos,
             (SELECT SUM(total) FROM pedidos p WHERE p.ruta_id = r.id) as total_dinero
      FROM rutas_domicilio r
      LEFT JOIN domiciliarios d ON r.domiciliario_id = d.id
    `;
    const paramsRutas = [];
    if (fecha) {
      sqlRutas += ` WHERE date(r.fecha_creacion, 'localtime') = ? OR date(r.fecha_liquidacion, 'localtime') = ?`;
      paramsRutas.push(fecha, fecha);
    }
    sqlRutas += ` ORDER BY r.id DESC`;

    const rutas = db.prepare(sqlRutas).all(...paramsRutas);

    // Para cada ruta, cargamos sus pedidos con sus ítems
    for (const ruta of rutas) {
      const pedidos = db.prepare(`
        SELECT p.*
        FROM pedidos p
        WHERE p.ruta_id = ?
        ORDER BY p.id ASC
      `).all(ruta.id);

      for (const p of pedidos) {
        p.items = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ?').all(p.id);
      }
      ruta.pedidos = pedidos;

      // Calcular totales desglosados de la ruta
      ruta.efectivo = pedidos.reduce((acc, p) => acc + (p.metodo_pago_final === 'EFECTIVO' ? (Number(p.total) || 0) : 0), 0);
      ruta.transferencia = pedidos.reduce((acc, p) => acc + (p.metodo_pago_final === 'TRANSFERENCIA' ? (Number(p.total) || 0) : 0), 0);
      ruta.pendiente = pedidos.reduce((acc, p) => acc + (p.estado_liquidacion === 'PAGO_PENDIENTE' || p.metodo_pago_final === 'TRANSFERENCIA_PENDIENTE' || p.metodo_pago_final === 'CREDITO' ? (Number(p.total) || 0) : 0), 0);
      ruta.entregados = pedidos.filter(p => p.estado_entrega === 'ENTREGADO').length;
      ruta.no_entregados = pedidos.filter(p => p.estado_entrega === 'NO_ENTREGADO').length;
    }

    // 2. Resumen por domiciliario (agrupado)
    const domMap = new Map();
    for (const r of rutas) {
      const dId = r.domiciliario_id || 0;
      const dNombre = r.domiciliario_nombre || 'Sin asignar';
      const dTel = r.domiciliario_telefono || '';
      if (!domMap.has(dId)) {
        domMap.set(dId, {
          domiciliario_id: dId,
          nombre: dNombre,
          telefono: dTel,
          rutas_count: 0,
          pedidos_totales: 0,
          pedidos_entregados: 0,
          pedidos_no_entregados: 0,
          total_facturado: 0,
          total_efectivo: 0,
          total_transferencia: 0,
          total_pendiente: 0,
          total_bases: 0,
          total_recolectado: 0
        });
      }
      const item = domMap.get(dId);
      item.rutas_count += 1;
      item.total_bases += Number(r.base_efectivo || 0);
      item.total_recolectado += Number(r.total_recolectado || 0);

      for (const p of r.pedidos) {
        item.pedidos_totales += 1;
        if (p.estado_entrega === 'ENTREGADO') item.pedidos_entregados += 1;
        if (p.estado_entrega === 'NO_ENTREGADO') item.pedidos_no_entregados += 1;
        item.total_facturado += Number(p.total || 0);
        if (p.metodo_pago_final === 'EFECTIVO') item.total_efectivo += Number(p.total || 0);
        else if (p.metodo_pago_final === 'TRANSFERENCIA') item.total_transferencia += Number(p.total || 0);
        if (p.estado_liquidacion === 'PAGO_PENDIENTE' || p.metodo_pago_final === 'TRANSFERENCIA_PENDIENTE' || p.metodo_pago_final === 'CREDITO') {
          item.total_pendiente += Number(p.total || 0);
        }
      }
    }
    const resumenDomiciliarios = Array.from(domMap.values());

    // 3. Pagos pendientes (cartera / transferencias por verificar)
    let sqlPendientes = `
      SELECT p.*, d.nombre as domiciliario_nombre, r.id as ruta_id, r.estado as ruta_estado,
             date(COALESCE(r.fecha_liquidacion, r.fecha_creacion, p.fecha_creacion), 'localtime') as fecha_pedido_ruta
      FROM pedidos p
      LEFT JOIN rutas_domicilio r ON p.ruta_id = r.id
      LEFT JOIN domiciliarios d ON r.domiciliario_id = d.id
      WHERE (p.estado_liquidacion = 'PAGO_PENDIENTE' 
             OR p.metodo_pago_final = 'TRANSFERENCIA_PENDIENTE'
             OR p.metodo_pago_final = 'CREDITO')
    `;
    const paramsPendientes = [];
    if (fecha) {
      sqlPendientes += ` AND date(COALESCE(r.fecha_liquidacion, r.fecha_creacion, p.fecha_creacion), 'localtime') = ?`;
      paramsPendientes.push(fecha);
    }
    sqlPendientes += ` ORDER BY p.id DESC`;

    const pagosPendientes = db.prepare(sqlPendientes).all(...paramsPendientes);

    // Todos los pagos pendientes históricos (acumulados para cartera global)
    const todosPagosPendientes = db.prepare(`
      SELECT p.*, d.nombre as domiciliario_nombre, r.id as ruta_id,
             date(COALESCE(r.fecha_liquidacion, r.fecha_creacion, p.fecha_creacion), 'localtime') as fecha_pedido_ruta
      FROM pedidos p
      LEFT JOIN rutas_domicilio r ON p.ruta_id = r.id
      LEFT JOIN domiciliarios d ON r.domiciliario_id = d.id
      WHERE (p.estado_liquidacion = 'PAGO_PENDIENTE' 
             OR p.metodo_pago_final = 'TRANSFERENCIA_PENDIENTE'
             OR p.metodo_pago_final = 'CREDITO')
      ORDER BY p.id DESC
    `).all();

    // 4. Novedades y Ajustes de precio en las rutas del día
    const novedadesAjustes = [];
    for (const r of rutas) {
      for (const p of r.pedidos) {
        if (p.total_original != null && Number(p.total_original) > 0 && Number(p.total_original) !== Number(p.total)) {
          novedadesAjustes.push({
            pedido_id: p.id,
            codigo_pedido: p.codigo_pedido,
            cliente: p.cliente,
            total_original: Number(p.total_original),
            total_final: Number(p.total),
            diferencia: Number(p.total) - Number(p.total_original),
            observacion: p.observacion || '',
            ruta_id: r.id,
            domiciliario_nombre: r.domiciliario_nombre
          });
        }
      }
    }

    // 5. Totales generales del día
    let totalFacturado = 0;
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalPendiente = 0;
    let totalBases = 0;
    let totalRecolectadoRutas = 0;
    let totalPedidos = 0;
    let totalEntregados = 0;

    for (const r of rutas) {
      totalBases += Number(r.base_efectivo || 0);
      totalRecolectadoRutas += Number(r.total_recolectado || 0);
      for (const p of r.pedidos) {
        totalPedidos += 1;
        if (p.estado_entrega === 'ENTREGADO') totalEntregados += 1;
        totalFacturado += Number(p.total || 0);
        if (p.metodo_pago_final === 'EFECTIVO') totalEfectivo += Number(p.total || 0);
        else if (p.metodo_pago_final === 'TRANSFERENCIA') totalTransferencia += Number(p.total || 0);
        if (p.estado_liquidacion === 'PAGO_PENDIENTE' || p.metodo_pago_final === 'TRANSFERENCIA_PENDIENTE' || p.metodo_pago_final === 'CREDITO') {
          totalPendiente += Number(p.total || 0);
        }
      }
    }

    res.json({
      ok: true,
      fecha,
      totales: {
        totalFacturado,
        totalEfectivo,
        totalTransferencia,
        totalPendiente,
        totalBases,
        totalRecolectadoRutas,
        totalPedidos,
        totalEntregados,
        rutasCount: rutas.length,
        novedadesCount: novedadesAjustes.length
      },
      rutas,
      resumenDomiciliarios,
      pagosPendientes,
      todosPagosPendientes,
      novedadesAjustes
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/domicilios/confirmar-pago-pendiente', (req, res) => {
  try {
    const { pedidoId, metodoPago, comprobante, nota } = req.body;
    if (!pedidoId) return res.status(400).json({ ok: false, error: 'ID de pedido requerido' });
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });

    let observacion = pedido.observacion || '';
    const detalleNota = nota ? ` | Confirmado: ${nota}` : ` | Pago confirmado`;
    observacion += detalleNota;

    db.prepare(`
      UPDATE pedidos
      SET estado_liquidacion = 'LIQUIDADO',
          metodo_pago_final = ?,
          comprobante_transf = ?,
          observacion = ?
      WHERE id = ?
    `).run(metodoPago || 'EFECTIVO', comprobante || '', observacion, pedidoId);

    res.json({ ok: true, mensaje: 'Pago confirmado y liquidado con éxito' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function obtenerIPsLocales() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  Object.values(interfaces).forEach((ifaceList) => {
    ifaceList.forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    });
  });
  return ips;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================');
  console.log('  Inventario & Pick-Pack - Servidor iniciado');
  console.log('==============================================');
  console.log(`  Local:    http://localhost:${PORT}`);
  obtenerIPsLocales().forEach((ip) => {
    console.log(`  Red WiFi (HTTP):  http://${ip}:${PORT}`);
  });

  const certPath = path.join(CERT_DIR, 'cert.pem');
  const keyPath = path.join(CERT_DIR, 'key.pem');
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const options = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    https.createServer(options, app).listen(HTTPS_PORT, '0.0.0.0', () => {
      obtenerIPsLocales().forEach((ip) => {
        console.log(`  Red WiFi (HTTPS): https://${ip}:${HTTPS_PORT}   <-- usar esta URL en el celular (camara)`);
      });
      console.log('==============================================');
    });
  } else {
    obtenerIPsLocales().forEach((ip) => {
      console.log(`  Red WiFi: http://${ip}:${PORT}   <-- usar esta URL en el celular`);
    });
    console.log('  ⚠️  Sin HTTPS configurado: la camara puede fallar por IP de red.');
    console.log('  Ver certs/README.md para habilitar HTTPS local (recomendado).');
    console.log('==============================================');
  }
});