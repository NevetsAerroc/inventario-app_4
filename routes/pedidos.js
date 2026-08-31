const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

// ------------------------------------------------------------------
// GET /api/pedidos -> listado (mas recientes primero)
// ------------------------------------------------------------------
router.get('/', (req, res) => {
  const pedidos = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM detalle_pedidos d WHERE d.pedido_id = p.id) as total_items,
      (SELECT COUNT(*) FROM detalle_pedidos d WHERE d.pedido_id = p.id AND d.verificado = 1) as items_verificados
    FROM pedidos p
    ORDER BY p.fecha_creacion DESC
  `).all();
  res.json({ ok: true, data: pedidos });
});

// ------------------------------------------------------------------
// GET /api/pedidos/:id -> detalle completo con items
// ------------------------------------------------------------------
router.get('/:id', (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });

  const items = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ? ORDER BY id ASC').all(req.params.id);
  res.json({ ok: true, data: { ...pedido, items } });
});

// ------------------------------------------------------------------
// POST /api/pedidos { codigo_pedido, cliente, items: [{sku, cantidad}] }
// ------------------------------------------------------------------
router.post('/', (req, res) => {
  const { codigo_pedido, cliente, cliente_id, items } = req.body;
  if (!codigo_pedido || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'codigo_pedido e items[] son requeridos.' });
  }

  try {
    const pedidoId = crearPedidoConItems(codigo_pedido, cliente || '', items, { cliente_id });
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    const detalle = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ?').all(pedidoId);
    res.status(201).json({ ok: true, data: { ...pedido, items: detalle } });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/pedidos/manual — directo a despacho (EMPACADO) y descuenta stock
router.post('/manual', (req, res) => {
  try {
    const {
      codigo_pedido,
      cliente_nombre,
      cliente_id,
      telefono,
      direccion,
      municipio,
      total,
      observacion,
      items,
      tipo_entrega
    } = req.body;

    if (!total || Number(total) <= 0) {
      return res.status(400).json({ ok: false, error: 'El valor total del pedido es obligatorio' });
    }

    const tx = db.transaction(() => {
      let finalClienteId = cliente_id || null;

      if (!finalClienteId && telefono) {
        const clienteExistente = db.prepare('SELECT id FROM clientes WHERE telefono = ?').get(telefono);
        if (clienteExistente) {
          finalClienteId = clienteExistente.id;
        } else {
          const resCliente = db.prepare(
            'INSERT INTO clientes (nombre, telefono) VALUES (?, ?)'
          ).run(cliente_nombre || 'Cliente General', telefono);
          finalClienteId = resCliente.lastInsertRowid;
        }
      }

      const stmtPedido = db.prepare(`
        INSERT INTO pedidos (
          codigo_pedido, cliente_id, cliente, telefono, direccion, municipio,
          total, observacion, tipo_entrega, estado, estado_liquidacion, ruta_id, fecha_cierre
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMPACADO', 'PENDIENTE', 0, datetime('now'))
      `);

      const info = stmtPedido.run(
        codigo_pedido || `EMP-${Date.now()}`,
        finalClienteId,
        cliente_nombre || 'Cliente General',
        telefono || '',
        direccion || '',
        municipio || '',
        Number(total),
        observacion || '',
        tipo_entrega || 'DOMICILIO'
      );

      const pedidoId = info.lastInsertRowid;
      const buscarProducto = db.prepare('SELECT * FROM productos WHERE sku = ?');
      const stmtItem = db.prepare(`
        INSERT INTO detalle_pedidos (pedido_id, producto_id, sku, nombre_producto, cantidad_solicitada, cantidad_empacada, verificado)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `);

      if (items && Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const cant = Number(item.cantidad) || 1;
          const prod = item.sku ? buscarProducto.get(item.sku) : null;
          stmtItem.run(
            pedidoId,
            prod ? prod.id : null,
            item.sku || '',
            (prod && prod.nombre) || item.nombre || 'Producto',
            cant,
            cant
          );
        }
        db.descontarStockDePedido(pedidoId, `Pedido domicilio ${codigo_pedido || pedidoId}`);
      }

      return pedidoId;
    });

    const pedidoId = tx();
    res.json({ ok: true, pedidoId });
  } catch (err) {
    console.error('Error al guardar pedido manual:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/pedidos/importar (multipart, campo "archivo")
// ------------------------------------------------------------------
router.post('/importar', upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibio ningun archivo.' });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const get = (fila, ...keys) => {
      for (const k of keys) {
        const found = Object.keys(fila).find(fk => fk.trim().toLowerCase() === k.toLowerCase());
        if (found !== undefined && fila[found] !== '') return fila[found];
      }
      return undefined;
    };

    const pedidosAgrupados = {};
    rows.forEach((fila) => {
      const codigo = String(get(fila, 'CodigoPedido', 'Pedido', 'Codigo Pedido') ?? '').trim();
      const cliente = String(get(fila, 'Cliente') ?? '').trim();
      const sku = String(get(fila, 'SKU') ?? '').trim();
      const cantidad = parseInt(get(fila, 'Cantidad') ?? 0, 10) || 0;
      if (!codigo || !sku || cantidad <= 0) return;

      if (!pedidosAgrupados[codigo]) pedidosAgrupados[codigo] = { cliente, items: [] };
      pedidosAgrupados[codigo].items.push({ sku, cantidad });
    });

    const codigos = Object.keys(pedidosAgrupados);
    if (codigos.length === 0) {
      return res.status(400).json({ ok: false, error: 'El archivo no contiene filas validas (CodigoPedido, SKU, Cantidad).' });
    }

    const creados = [];
    codigos.forEach((codigo) => {
      const existente = db.prepare('SELECT id FROM pedidos WHERE codigo_pedido = ?').get(codigo);
      if (existente) return;
      const { cliente, items } = pedidosAgrupados[codigo];
      const id = crearPedidoConItems(codigo, cliente, items);
      creados.push(id);
    });

    res.json({ ok: true, resumen: { pedidosDetectados: codigos.length, pedidosCreados: creados.length } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error procesando el archivo: ' + err.message });
  }
});

// Helper: crea un pedido + su detalle
function crearPedidoConItems(codigo_pedido, cliente, items, extras = {}) {
  const insertPedido = db.prepare(`
    INSERT INTO pedidos (codigo_pedido, cliente, cliente_id, estado, total, tipo_entrega, estado_liquidacion)
    VALUES (?, ?, ?, 'PENDIENTE', ?, 'TIENDA', 'PENDIENTE')
  `);
  const insertDetalle = db.prepare(`
    INSERT INTO detalle_pedidos (pedido_id, producto_id, sku, nombre_producto, cantidad_solicitada, cantidad_empacada, verificado)
    VALUES (?, ?, ?, ?, ?, 0, 0)
  `);
  const buscarProducto = db.prepare('SELECT * FROM productos WHERE sku = ?');

  let pedidoId;
  const tx = db.transaction(() => {
    let total = Number(extras.total) || 0;
    const productos = items.map((it) => {
      const producto = buscarProducto.get(it.sku);
      if (producto && !extras.total) total += (producto.precio || 0) * (Number(it.cantidad) || 0);
      return { it, producto };
    });

    const info = insertPedido.run(codigo_pedido, cliente, extras.cliente_id || null, total);
    pedidoId = info.lastInsertRowid;
    productos.forEach(({ it, producto }) => {
      insertDetalle.run(
        pedidoId,
        producto ? producto.id : null,
        it.sku,
        producto ? producto.nombre : `(SKU no encontrado: ${it.sku})`,
        it.cantidad
      );
    });
  });
  tx();
  return pedidoId;
}

// ------------------------------------------------------------------
// DELETE /api/pedidos/:pedidoId/items/:itemId -> Eliminar ítem
// ------------------------------------------------------------------
router.delete('/:pedidoId/items/:itemId', (req, res) => {
  const { pedidoId, itemId } = req.params;
  
  const pedido = db.prepare('SELECT estado FROM pedidos WHERE id = ?').get(pedidoId);
  if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });
  if (pedido.estado === 'EMPACADO') {
    return res.status(400).json({ ok: false, error: 'No se pueden modificar ítems de un pedido empacado.' });
  }

  db.prepare('DELETE FROM detalle_pedidos WHERE id = ? AND pedido_id = ?').run(itemId, pedidoId);
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// POST /api/pedidos/:pedidoId/items -> Agregar ítem extra a la lista
// ------------------------------------------------------------------
router.post('/:pedidoId/items', (req, res) => {
  const { pedidoId } = req.params;
  const { producto_id, cantidad } = req.body;

  const pedido = db.prepare('SELECT estado FROM pedidos WHERE id = ?').get(pedidoId);
  if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });
  if (pedido.estado === 'EMPACADO') {
    return res.status(400).json({ ok: false, error: 'No se pueden modificar ítems de un pedido empacado.' });
  }

  const prod = db.prepare('SELECT id, nombre, sku FROM productos WHERE id = ?').get(producto_id);
  if (!prod) return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });

  const exist = db.prepare('SELECT id, cantidad_solicitada FROM detalle_pedidos WHERE pedido_id = ? AND producto_id = ?').get(pedidoId, producto_id);
  
  if (exist) {
    db.prepare('UPDATE detalle_pedidos SET cantidad_solicitada = cantidad_solicitada + ? WHERE id = ?')
      .run(Number(cantidad) || 1, exist.id);
  } else {
    db.prepare(`
      INSERT INTO detalle_pedidos (pedido_id, producto_id, sku, nombre_producto, cantidad_solicitada, cantidad_empacada, verificado)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run(pedidoId, prod.id, prod.sku, prod.nombre, Number(cantidad) || 1);
  }

  res.json({ ok: true });
});

// ------------------------------------------------------------------
// POST /api/pedidos/:id/escanear
// ------------------------------------------------------------------
router.post('/:id/escanear', (req, res) => {
  const { id } = req.params;
  const { codigo_barras } = req.body;
  if (!codigo_barras) return res.status(400).json({ ok: false, error: 'codigo_barras es requerido.' });

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
  if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });
  if (pedido.estado === 'EMPACADO') {
    return res.status(400).json({ ok: false, resultado: 'ERROR', mensaje: 'Este pedido ya fue EMPACADO y cerrado.' });
  }

  const rawCodigo = String(codigo_barras || '').trim();
  const normCodigo = db.normalizarCodigoBarras(rawCodigo) || rawCodigo;

  const producto = db.prepare(
    'SELECT * FROM productos WHERE codigo_barras = ? OR codigo_caja = ? OR sku = ? OR codigo_barras = ? OR codigo_caja = ?'
  ).get(normCodigo, normCodigo, rawCodigo, rawCodigo, rawCodigo);

  if (!producto) {
    return res.json({ ok: true, resultado: 'ERROR', mensaje: 'Codigo no reconocido en el catalogo de productos.' });
  }

  const item = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ? AND sku = ?').get(id, producto.sku);

  if (!item) {
    return res.json({
      ok: true,
      resultado: 'ERROR',
      mensaje: `"${producto.nombre}" (SKU ${producto.sku}) no pertenece a este pedido.`
    });
  }

  const cantEmpacada = item.cantidad_empacada || 0;
  if (cantEmpacada >= item.cantidad_solicitada) {
    return res.json({
      ok: true,
      resultado: 'ERROR',
      mensaje: `"${producto.nombre}" ya se completo (${cantEmpacada}/${item.cantidad_solicitada}).`,
      item
    });
  }

  const nuevaCantidad = cantEmpacada + 1;
  const verificado = nuevaCantidad >= item.cantidad_solicitada ? 1 : 0;

  const tx = db.transaction(() => {
    db.prepare('UPDATE detalle_pedidos SET cantidad_empacada = ?, verificado = ? WHERE id = ?')
      .run(nuevaCantidad, verificado, item.id);
    if (pedido.estado === 'PENDIENTE') {
      db.prepare("UPDATE pedidos SET estado = 'EN_PROCESO' WHERE id = ?").run(id);
    }
  });
  tx();

  const itemActualizado = db.prepare('SELECT * FROM detalle_pedidos WHERE id = ?').get(item.id);
  const totales = db.prepare(`
    SELECT COUNT(*) as total, SUM(verificado) as verificados FROM detalle_pedidos WHERE pedido_id = ?
  `).get(id);

  res.json({
    ok: true,
    resultado: 'OK',
    mensaje: `"${producto.nombre}" verificado (${nuevaCantidad}/${item.cantidad_solicitada}).`,
    item: itemActualizado,
    progreso: { total: totales.total, verificados: totales.verificados || 0 }
  });
});

// ------------------------------------------------------------------
// POST /api/pedidos/:id/cerrar
// ------------------------------------------------------------------
router.post('/:id/cerrar', (req, res) => {
  const { id } = req.params;
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
  if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });
  if (pedido.estado === 'EMPACADO') {
    return res.status(400).json({ ok: false, error: 'El pedido ya esta EMPACADO.' });
  }

  const items = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ?').all(id);
  const incompletos = items.filter(i => i.verificado !== 1);
  if (incompletos.length > 0) {
    return res.status(400).json({
      ok: false,
      error: `Faltan ${incompletos.length} item(s) por completar antes de cerrar el pedido.`
    });
  }

  const tx = db.transaction(() => {
    db.descontarStockDePedido(id, `Empaque pedido ${pedido.codigo_pedido}`);
    const totalCalc = db.totalPedidoDesdeItems(id);
    db.prepare(`
      UPDATE pedidos SET
        estado = 'EMPACADO',
        fecha_cierre = datetime('now'),
        total = CASE WHEN COALESCE(total, 0) = 0 THEN ? ELSE total END
      WHERE id = ?
    `).run(totalCalc, id);
  });
  tx();

  const pedidoActualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
  res.json({ ok: true, data: pedidoActualizado });
});

// ------------------------------------------------------------------
// GET /api/pedidos/:id/exportar?formato=json|csv
// ------------------------------------------------------------------
router.get('/:id/exportar', (req, res) => {
  const { id } = req.params;
  const formato = (req.query.formato || 'json').toLowerCase();

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
  if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });
  const items = db.prepare(`
    SELECT d.sku, d.nombre_producto, d.cantidad_solicitada, d.cantidad_empacada,
           p.precio, (d.cantidad_empacada * p.precio) as subtotal
    FROM detalle_pedidos d
    LEFT JOIN productos p ON p.id = d.producto_id
    WHERE d.pedido_id = ?
  `).all(id);

  const total = items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  const payload = {
    codigo_pedido: pedido.codigo_pedido,
    cliente: pedido.cliente,
    estado: pedido.estado,
    fecha_cierre: pedido.fecha_cierre,
    items,
    total
  };

  if (formato === 'csv') {
    const ws = XLSX.utils.json_to_sheet(items);
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pedido_${pedido.codigo_pedido}.csv"`);
    return res.send(csv);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="pedido_${pedido.codigo_pedido}.json"`);
  res.send(JSON.stringify(payload, null, 2));
});

module.exports = router;