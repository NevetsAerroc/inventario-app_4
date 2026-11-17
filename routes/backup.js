const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/database');

const upload = multer({ dest: 'uploads/' });

// ------------------------------------------------------------------
// GET /api/backup/info -> Estadísticas de la base de datos
// ------------------------------------------------------------------
router.get('/info', (req, res) => {
  try {
    const stats = fs.existsSync(db.DB_PATH) ? fs.statSync(db.DB_PATH) : null;
    const totalProductos = db.prepare('SELECT COUNT(*) as c FROM productos').get()?.c || 0;
    const totalClientes = db.prepare('SELECT COUNT(*) as c FROM clientes').get()?.c || 0;
    const totalVentas = db.prepare('SELECT COUNT(*) as c FROM ventas').get()?.c || 0;
    const totalPedidos = db.prepare('SELECT COUNT(*) as c FROM pedidos').get()?.c || 0;
    const totalUsuarios = db.prepare('SELECT COUNT(*) as c FROM usuarios').get()?.c || 0;

    res.json({
      ok: true,
      archivo: 'inventario.db',
      tamano_kb: stats ? Math.round(stats.size / 1024) : 0,
      ultima_modificacion: stats ? stats.mtime : null,
      zona_horaria: 'America/Bogota (UTC-5)',
      hora_actual_servidor: db.getFechaHoraBogota ? db.getFechaHoraBogota() : new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      resumen: {
        productos: totalProductos,
        clientes: totalClientes,
        ventas: totalVentas,
        pedidos: totalPedidos,
        usuarios: totalUsuarios
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/backup/descargar -> Descargar archivo inventario.db consolidado
// ------------------------------------------------------------------
router.get('/descargar', (req, res) => {
  try {
    // 1. Asegurar que WAL se vuelque completamente al archivo principal
    if (typeof db.checkpointSync === 'function') {
      db.checkpointSync();
    }

    if (!fs.existsSync(db.DB_PATH)) {
      return res.status(404).json({ ok: false, error: 'No se encontró el archivo de base de datos.' });
    }

    const fechaHoy = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const filename = `respaldo_jispiplast_${fechaHoy}.db`;

    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const fileStream = fs.createReadStream(db.DB_PATH);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error al descargar respaldo de BD:', err);
    res.status(500).json({ ok: false, error: 'Error al generar la descarga: ' + err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/backup/restaurar -> Restaurar base de datos desde archivo .db
// ------------------------------------------------------------------
router.post('/restaurar', upload.single('archivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No se subió ningún archivo de respaldo.' });
  }

  const uploadedPath = req.file.path;

  try {
    // Validar cabecera SQLite (los primeros 16 bytes deben ser "SQLite format 3\0")
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(uploadedPath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const header = buffer.toString('utf8');
    if (!header.startsWith('SQLite format 3')) {
      try { fs.unlinkSync(uploadedPath); } catch (_) {}
      return res.status(400).json({
        ok: false,
        error: 'El archivo subido no es una base de datos válida de SQLite (.db).'
      });
    }

    // Checkpoint previo
    if (typeof db.checkpointSync === 'function') {
      db.checkpointSync();
    }

    // Copia de seguridad del archivo actual antes de reemplazar
    const backupAnterior = db.DB_PATH + '.bak_' + Date.now();
    if (fs.existsSync(db.DB_PATH)) {
      fs.copyFileSync(db.DB_PATH, backupAnterior);
    }

    // Reemplazar el archivo inventario.db con el subido
    fs.copyFileSync(uploadedPath, db.DB_PATH);

    // Limpiar archivos auxiliares de WAL viejos si existen
    const walFile = db.DB_PATH + '-wal';
    const shmFile = db.DB_PATH + '-shm';
    if (fs.existsSync(walFile)) { try { fs.unlinkSync(walFile); } catch (_) {} }
    if (fs.existsSync(shmFile)) { try { fs.unlinkSync(shmFile); } catch (_) {} }

    try { fs.unlinkSync(uploadedPath); } catch (_) {}

    // Checkpoint y verificación de integridad
    if (typeof db.checkpointSync === 'function') {
      db.checkpointSync();
    }
    const integrity = db.prepare('PRAGMA integrity_check').get();

    res.json({
      ok: true,
      mensaje: 'Base de datos restaurada exitosamente.',
      integridad: integrity ? integrity.integrity_check : 'ok'
    });
  } catch (err) {
    try { fs.unlinkSync(uploadedPath); } catch (_) {}
    console.error('Error al restaurar base de datos:', err);
    res.status(500).json({ ok: false, error: 'Error al restaurar la base de datos: ' + err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/backup/exportar-json -> Volcado completo para Firebase
// ------------------------------------------------------------------
router.get('/exportar-json', (req, res) => {
  try {
    const productos = db.prepare('SELECT * FROM productos').all();
    const clientes = db.prepare('SELECT * FROM clientes').all();
    const domiciliarios = db.prepare('SELECT * FROM domiciliarios').all();
    const rutas = db.prepare('SELECT * FROM rutas_domicilio').all();
    const usuarios = db.prepare('SELECT id, username, nombre, rol, domiciliario_id, permisos, activo, created_at FROM usuarios').all();

    const pedidos = db.prepare('SELECT * FROM pedidos').all();
    const getDetallePedido = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ?');
    for (const p of pedidos) {
      p.items = getDetallePedido.all(p.id) || [];
    }

    const ventas = db.prepare('SELECT * FROM ventas').all();
    const getDetalleVenta = db.prepare('SELECT * FROM detalle_ventas WHERE venta_id = ?');
    for (const v of ventas) {
      v.items = getDetalleVenta.all(v.id) || [];
    }

    res.json({
      ok: true,
      fecha: db.getFechaHoraBogota ? db.getFechaHoraBogota() : new Date().toISOString(),
      datos: {
        productos,
        clientes,
        pedidos,
        ventas,
        domiciliarios,
        rutas_domicilio: rutas,
        usuarios
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/backup/importar-json -> Restaurar datos desde Firebase a SQLite
// ------------------------------------------------------------------
router.post('/importar-json', (req, res) => {
  try {
    const { productos, clientes, pedidos, ventas, domiciliarios, rutas_domicilio, usuarios } = req.body || {};

    let insertadosProductos = 0;
    let insertadosClientes = 0;
    let insertadosPedidos = 0;
    let insertadosVentas = 0;
    let insertadosUsuarios = 0;

    const tx = db.transaction(() => {
      // 1. Productos
      if (Array.isArray(productos) && productos.length > 0) {
        const insertProd = db.prepare(`
          INSERT INTO productos (id, sku, nombre, categoria, subcategoria, stock, precio, precio_1, precio_2, precio_3, iva, codigo_barras, codigo_caja, unidades_por_caja, ubicacion, codigo_interno)
          VALUES (@id, @sku, @nombre, @categoria, @subcategoria, @stock, @precio, @precio_1, @precio_2, @precio_3, @iva, @codigo_barras, @codigo_caja, @unidades_por_caja, @ubicacion, @codigo_interno)
          ON CONFLICT(sku) DO UPDATE SET
            nombre = excluded.nombre,
            categoria = excluded.categoria,
            subcategoria = excluded.subcategoria,
            stock = excluded.stock,
            precio = excluded.precio,
            precio_1 = excluded.precio_1,
            precio_2 = excluded.precio_2,
            precio_3 = excluded.precio_3,
            iva = excluded.iva,
            codigo_barras = excluded.codigo_barras,
            codigo_caja = excluded.codigo_caja,
            unidades_por_caja = excluded.unidades_por_caja,
            ubicacion = excluded.ubicacion,
            codigo_interno = excluded.codigo_interno
        `);

        for (const p of productos) {
          if (!p.sku || !p.nombre) continue;
          const idNum = p.id !== undefined && p.id !== null && !isNaN(Number(p.id)) ? Number(p.id) : null;
          insertProd.run({
            id: idNum,
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
            codigo_barras: p.codigo_barras || null,
            codigo_caja: p.codigo_caja || null,
            unidades_por_caja: Number(p.unidades_por_caja) || 1,
            ubicacion: p.ubicacion || '',
            codigo_interno: p.codigo_interno || ''
          });
          insertadosProductos++;
        }
      }

      // 2. Clientes
      if (Array.isArray(clientes) && clientes.length > 0) {
        const insertCli = db.prepare(`
          INSERT OR IGNORE INTO clientes (id, nombre, telefono, empresa, ciudad)
          VALUES (@id, @nombre, @telefono, @empresa, @ciudad)
        `);
        const updateCli = db.prepare(`
          UPDATE clientes SET telefono = @telefono, empresa = @empresa, ciudad = @ciudad WHERE nombre = @nombre
        `);
        for (const c of clientes) {
          if (!c.nombre) continue;
          const idNum = c.id !== undefined && c.id !== null && !isNaN(Number(c.id)) ? Number(c.id) : null;
          insertCli.run({
            id: idNum,
            nombre: String(c.nombre),
            telefono: c.telefono || '',
            empresa: c.empresa || '',
            ciudad: c.ciudad || ''
          });
          updateCli.run({
            nombre: String(c.nombre),
            telefono: c.telefono || '',
            empresa: c.empresa || '',
            ciudad: c.ciudad || ''
          });
          insertadosClientes++;
        }
      }

      // 3. Domiciliarios
      if (Array.isArray(domiciliarios) && domiciliarios.length > 0) {
        const insertDom = db.prepare(`
          INSERT OR IGNORE INTO domiciliarios (id, nombre, telefono, activo)
          VALUES (@id, @nombre, @telefono, @activo)
        `);
        for (const d of domiciliarios) {
          if (!d.nombre) continue;
          const idNum = d.id !== undefined && d.id !== null && !isNaN(Number(d.id)) ? Number(d.id) : null;
          insertDom.run({
            id: idNum,
            nombre: String(d.nombre),
            telefono: d.telefono || '',
            activo: d.activo !== undefined ? Number(d.activo) : 1
          });
        }
      }

      // 4. Pedidos
      if (Array.isArray(pedidos) && pedidos.length > 0) {
        const insertPed = db.prepare(`
          INSERT OR IGNORE INTO pedidos (id, codigo_pedido, cliente, empresa, telefono, direccion, municipio, estado, tipo_entrega, total, total_original, ruta_id, metodo_pago_final, comprobante_transf, estado_liquidacion, estado_entrega, observacion)
          VALUES (@id, @codigo_pedido, @cliente, @empresa, @telefono, @direccion, @municipio, @estado, @tipo_entrega, @total, @total_original, @ruta_id, @metodo_pago_final, @comprobante_transf, @estado_liquidacion, @estado_entrega, @observacion)
        `);
        for (const p of pedidos) {
          if (!p.codigo_pedido) continue;
          const idNum = p.id !== undefined && p.id !== null && !isNaN(Number(p.id)) ? Number(p.id) : null;
          const rutaIdNum = p.ruta_id !== undefined && p.ruta_id !== null && !isNaN(Number(p.ruta_id)) ? Number(p.ruta_id) : null;
          insertPed.run({
            id: idNum,
            codigo_pedido: String(p.codigo_pedido),
            cliente: p.cliente || '',
            empresa: p.empresa || '',
            telefono: p.telefono || '',
            direccion: p.direccion || '',
            municipio: p.municipio || '',
            estado: p.estado || 'PENDIENTE',
            tipo_entrega: p.tipo_entrega || 'TIENDA',
            total: Number(p.total) || 0,
            total_original: Number(p.total_original) || Number(p.total) || 0,
            ruta_id: rutaIdNum,
            metodo_pago_final: p.metodo_pago_final || '',
            comprobante_transf: p.comprobante_transf || '',
            estado_liquidacion: p.estado_liquidacion || 'PENDIENTE',
            estado_entrega: p.estado_entrega || 'PENDIENTE',
            observacion: p.observacion || ''
          });
          insertadosPedidos++;
        }
      }

      // 5. Ventas
      if (Array.isArray(ventas) && ventas.length > 0) {
        const insertVta = db.prepare(`
          INSERT OR IGNORE INTO ventas (id, numero_factura, fecha, cliente_nombre, cliente_documento, cliente_telefono, usuario_nombre, total, metodo_pago, estado)
          VALUES (@id, @numero_factura, @fecha, @cliente_nombre, @cliente_documento, @cliente_telefono, @usuario_nombre, @total, @metodo_pago, @estado)
        `);
        for (const v of ventas) {
          if (!v.numero_factura) continue;
          const idNum = v.id !== undefined && v.id !== null && !isNaN(Number(v.id)) ? Number(v.id) : null;
          insertVta.run({
            id: idNum,
            numero_factura: String(v.numero_factura),
            fecha: v.fecha || new Date().toISOString(),
            cliente_nombre: v.cliente_nombre || 'Consumidor Final',
            cliente_documento: v.cliente_documento || '',
            cliente_telefono: v.cliente_telefono || '',
            usuario_nombre: v.usuario_nombre || '',
            total: Number(v.total) || 0,
            metodo_pago: v.metodo_pago || 'EFECTIVO',
            estado: v.estado || 'COMPLETADA'
          });
          insertadosVentas++;
        }
      }

      // 6. Usuarios
      if (Array.isArray(usuarios) && usuarios.length > 0) {
        const insertUsu = db.prepare(`
          INSERT INTO usuarios (id, username, password_hash, nombre, rol, activo)
          VALUES (@id, @username, @password_hash, @nombre, @rol, @activo)
          ON CONFLICT(username) DO UPDATE SET
            nombre = excluded.nombre,
            rol = excluded.rol,
            activo = excluded.activo
        `);
        for (const u of usuarios) {
          if (!u.username || !u.nombre) continue;
          const idNum = u.id !== undefined && u.id !== null && !isNaN(Number(u.id)) ? Number(u.id) : null;
          insertUsu.run({
            id: idNum,
            username: String(u.username),
            password_hash: u.password_hash || (typeof db.hashPassword === 'function' ? db.hashPassword('admin123') : 'admin123'),
            nombre: String(u.nombre),
            rol: u.rol || 'operador',
            activo: u.activo !== undefined ? Number(u.activo) : 1
          });
          insertadosUsuarios++;
        }
      }
    });

    tx();

    // Ejecutar checkpoint de forma segura DESPUÉS de que la transacción haya finalizado
    if (typeof db.checkpointSync === 'function') {
      db.checkpointSync();
    }

    res.json({
      ok: true,
      mensaje: 'Base de datos sincronizada desde Firebase con éxito.',
      sincronizados: {
        productos: insertadosProductos,
        clientes: insertadosClientes,
        pedidos: insertadosPedidos,
        ventas: insertadosVentas,
        usuarios: insertadosUsuarios
      }
    });
  } catch (err) {
    console.error('Error al importar desde Firebase:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

