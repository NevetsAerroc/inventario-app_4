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
// POST /api/pedidos  { codigo_pedido, cliente, items: [{sku, cantidad}] }
// Creacion manual / desde JSON (por ejemplo generado por otro sistema)
// ------------------------------------------------------------------
router.post('/', (req, res) => {
  const { codigo_pedido, cliente, items } = req.body;
  if (!codigo_pedido || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'codigo_pedido e items[] son requeridos.' });
  }

  try {
    const pedidoId = crearPedidoConItems(codigo_pedido, cliente || '', items);
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    const detalle = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ?').all(pedidoId);
    res.status(201).json({ ok: true, data: { ...pedido, items: detalle } });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/pedidos/importar (multipart, campo "archivo")
// Excel/CSV con columnas: CodigoPedido, Cliente, SKU, Cantidad
// Varias filas con el mismo CodigoPedido conforman un mismo pedido.
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

    // Agrupar filas por CodigoPedido
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
      if (existente) return; // no duplicar pedidos ya importados
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

// Helper: crea un pedido + su detalle, resolviendo producto_id por SKU si existe
function crearPedidoConItems(codigo_pedido, cliente, items) {
  const insertPedido = db.prepare(`INSERT INTO pedidos (codigo_pedido, cliente, estado) VALUES (?, ?, 'PENDIENTE')`);
  const insertDetalle = db.prepare(`
    INSERT INTO detalle_pedidos (pedido_id, producto_id, sku, nombre_producto, cantidad_solicitada)
    VALUES (?, ?, ?, ?, ?)
  `);
  const buscarProducto = db.prepare('SELECT * FROM productos WHERE sku = ?');

  let pedidoId;
  const tx = db.transaction(() => {
    const info = insertPedido.run(codigo_pedido, cliente);
    pedidoId = info.lastInsertRowid;
    items.forEach((it) => {
      const producto = buscarProducto.get(it.sku);
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
// POST /api/pedidos/:id/escanear  { codigo_barras }
// Logica central del modulo Pick & Pack.
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

  // Resolver el producto escaneado (por codigo de barras o por SKU directo)
  const producto = db.prepare('SELECT * FROM productos WHERE codigo_barras = ? OR sku = ?').get(codigo_barras, codigo_barras);

  if (!producto) {
    return res.json({ ok: true, resultado: 'ERROR', mensaje: 'Codigo no reconocido en el catalogo de productos.' });
  }

  // Buscar si ese SKU pertenece al pedido
  const item = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ? AND sku = ?').get(id, producto.sku);

  if (!item) {
    return res.json({
      ok: true,
      resultado: 'ERROR',
      mensaje: `"${producto.nombre}" (SKU ${producto.sku}) no pertenece a este pedido.`
    });
  }

  if (item.cantidad_empacada >= item.cantidad_solicitada) {
    return res.json({
      ok: true,
      resultado: 'ERROR',
      mensaje: `"${producto.nombre}" ya se completo (${item.cantidad_empacada}/${item.cantidad_solicitada}).`,
      item
    });
  }

  // Escaneo valido: incrementar
  const nuevaCantidad = item.cantidad_empacada + 1;
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
// Solo permite cerrar si el 100% de items estan verificados.
// Descuenta stock del inventario principal y marca estado EMPACADO.
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

  const restarStock = db.prepare('SELECT * FROM productos WHERE id = ?');
  const updateStock = db.prepare("UPDATE productos SET stock = ?, updated_at = datetime('now') WHERE id = ?");
  const insertMov = db.prepare(`INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo, pedido_id)
                                 VALUES (?, 'empaque', ?, ?, ?, ?)`);

  const tx = db.transaction(() => {
    items.forEach((item) => {
      if (!item.producto_id) return; // SKU sin producto vinculado, no se puede descontar
      const producto = restarStock.get(item.producto_id);
      if (!producto) return;
      const nuevoStock = Math.max(0, producto.stock - item.cantidad_empacada);
      updateStock.run(nuevoStock, producto.id);
      insertMov.run(producto.id, item.cantidad_empacada, nuevoStock, `Empaque pedido ${pedido.codigo_pedido}`, id);
    });
    db.prepare("UPDATE pedidos SET estado = 'EMPACADO', fecha_cierre = datetime('now') WHERE id = ?").run(id);
  });
  tx();

  const pedidoActualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
  res.json({ ok: true, data: pedidoActualizado });
});

// ------------------------------------------------------------------
// GET /api/pedidos/:id/exportar?formato=json|csv
// Vista lista para facturacion
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
