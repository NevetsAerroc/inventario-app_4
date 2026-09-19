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
  const pedido = db.prepare(`
    SELECT p.*,
           COALESCE(NULLIF(p.empresa, ''), c.empresa, '') AS empresa,
           COALESCE(NULLIF(p.telefono, ''), c.telefono, '') AS telefono,
           COALESCE(NULLIF(p.direccion, ''), c.direccion, '') AS direccion,
           COALESCE(NULLIF(p.municipio, ''), c.ciudad, '') AS municipio,
           COALESCE(NULLIF(p.cliente, ''), c.nombre, 'Cliente General') AS cliente
    FROM pedidos p
    LEFT JOIN clientes c ON p.cliente_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });

  // Trae el precio unitario desde productos (por producto_id, o por sku si el item
  // no quedo vinculado). Sin este JOIN, d.precio no existe y la factura POS
  // calculaba el total en $0.
  const items = db.prepare(`
    SELECT d.*, COALESCE(p.precio, 0) AS precio
    FROM detalle_pedidos d
    LEFT JOIN productos p ON p.id = d.producto_id OR (d.producto_id IS NULL AND p.sku = d.sku)
    WHERE d.pedido_id = ?
    ORDER BY d.id ASC
  `).all(req.params.id);
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
      empresa,
      telefono,
      direccion,
      municipio,
      total,
      observacion,
      items,
      tipo_entrega
    } = req.body;

    const itemsList = Array.isArray(items) ? items : [];

    const tx = db.transaction(() => {
      let finalClienteId = cliente_id || null;
      const municipioFinal = (municipio && String(municipio).trim()) || '';
      const empresaFinal = (empresa && String(empresa).trim()) || '';

      if (!finalClienteId && telefono) {
        const clienteExistente = db.prepare('SELECT id, empresa FROM clientes WHERE telefono = ?').get(telefono);
        if (clienteExistente) {
          finalClienteId = clienteExistente.id;
        } else {
          const resCliente = db.prepare(
            'INSERT INTO clientes (nombre, telefono, empresa, ciudad, direccion) VALUES (?, ?, ?, ?, ?)'
          ).run(
            cliente_nombre || 'Cliente General',
            telefono,
            empresaFinal,
            municipioFinal,
            direccion || ''
          );
          finalClienteId = resCliente.lastInsertRowid;
        }
      }

      // Si hay cliente y escribieron municipio, dirección, teléfono o empresa, actualizarlo en la ficha
      if (finalClienteId && (municipioFinal || direccion || telefono || empresaFinal)) {
        db.prepare(`
          UPDATE clientes
          SET ciudad = CASE WHEN ? != '' THEN ? ELSE ciudad END,
              direccion = CASE WHEN ? != '' THEN ? ELSE direccion END,
              telefono = CASE WHEN ? != '' THEN ? ELSE telefono END,
              empresa = CASE WHEN ? != '' THEN ? ELSE empresa END
          WHERE id = ?
        `).run(
          municipioFinal, municipioFinal,
          direccion || '', direccion || '',
          telefono || '', telefono || '',
          empresaFinal, empresaFinal,
          finalClienteId
        );
      }

      // Si no enviaron empresa pero el cliente ya la tenía registrada, usarla
      const cliExistenteRow = finalClienteId ? db.prepare('SELECT empresa FROM clientes WHERE id = ?').get(finalClienteId) : null;
      const empresaParaPedido = empresaFinal || (cliExistenteRow && cliExistenteRow.empresa) || '';

      const buscarProducto = db.prepare('SELECT * FROM productos WHERE sku = ?');
      const buscarProductoPorId = db.prepare('SELECT * FROM productos WHERE id = ?');

      // Calcular total automáticamente si no lo enviaron
      let totalFinal = Number(total) || 0;
      if (totalFinal <= 0) {
        totalFinal = 0;
        for (const item of itemsList) {
          const cant = Number(item.cantidad) || 1;
          const prod = item.producto_id ? buscarProductoPorId.get(item.producto_id) : (item.sku ? buscarProducto.get(item.sku) : null);
          const precioUnit = (prod && Number(prod.precio)) || Number(item.precio) || 0;
          totalFinal += (precioUnit * cant);
        }
      }

      const stmtPedido = db.prepare(`
        INSERT INTO pedidos (
          codigo_pedido, cliente_id, cliente, empresa, telefono, direccion, municipio,
          total, observacion, tipo_entrega, estado, estado_liquidacion, ruta_id, fecha_cierre
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMPACADO', 'PENDIENTE', 0, datetime('now'))
      `);

      const info = stmtPedido.run(
        codigo_pedido || `EMP-${Date.now()}`,
        finalClienteId,
        cliente_nombre || 'Cliente General',
        empresaParaPedido,
        telefono || '',
        direccion || '',
        municipioFinal,
        totalFinal,
        observacion || '',
        tipo_entrega || 'DOMICILIO'
      );

      const pedidoId = info.lastInsertRowid;
      const stmtItem = db.prepare(`
        INSERT INTO detalle_pedidos (pedido_id, producto_id, sku, nombre_producto, cantidad_solicitada, cantidad_empacada, verificado, es_faltante, nota_faltante)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of itemsList) {
        const cant = Number(item.cantidad) || 1;
        const esFaltante = item.es_faltante ? 1 : 0;
        const notaFaltante = item.nota_faltante || '';
        const verificado = esFaltante ? 1 : 1;
        const cantEmpacada = esFaltante ? 0 : cant;
        const prod = item.producto_id ? buscarProductoPorId.get(item.producto_id) : (item.sku ? buscarProducto.get(item.sku) : null);
        stmtItem.run(
          pedidoId,
          prod ? prod.id : null,
          (prod && prod.sku) || item.sku || '',
          (prod && prod.nombre) || item.nombre || 'Producto',
          cant,
          cantEmpacada,
          verificado,
          esFaltante,
          notaFaltante
        );
      }

      db.descontarStockDePedido(pedidoId, `Empaque directo ${codigo_pedido || pedidoId}`);
      return pedidoId;
    });

    const pedidoId = tx();
    res.json({ ok: true, pedidoId });
  } catch (err) {
    console.error('Error al guardar pedido manual/empaque:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// PUT /api/pedidos/:id — Edición de pedido e ítems (desde Central de Domicilios o Gestión)
// ------------------------------------------------------------------
router.put('/:id', (req, res) => {
  const pedidoId = Number(req.params.id);
  if (!pedidoId) return res.status(400).json({ ok: false, error: 'ID de pedido no válido' });

  const {
    cliente,
    cliente_id,
    empresa,
    telefono,
    direccion,
    municipio,
    observacion,
    tipo_entrega,
    total,
    items
  } = req.body;

  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });

    if (pedido.estado_liquidacion === 'LIQUIDADA') {
      return res.status(400).json({ ok: false, error: 'No se puede editar un pedido que ya fue liquidado en ruta.' });
    }

    const tx = db.transaction(() => {
      // 1. Obtener ítems actuales para conciliar inventario
      const itemsPrevios = db.prepare(`
        SELECT d.*, COALESCE(p.precio, 0) AS precio, p.id AS prod_id_real
        FROM detalle_pedidos d
        LEFT JOIN productos p ON p.id = d.producto_id OR (d.producto_id IS NULL AND p.sku = d.sku)
        WHERE d.pedido_id = ?
      `).all(pedidoId);

      // Mapear cantidades previas por producto_id (o sku)
      const mapaPrevio = new Map();
      itemsPrevios.forEach(it => {
        const prodKey = it.producto_id || it.prod_id_real;
        const cant = Number(it.cantidad_empacada || it.cantidad_solicitada || 0);
        if (prodKey) {
          mapaPrevio.set(prodKey, (mapaPrevio.get(prodKey) || 0) + cant);
        }
      });

      // 2. Procesar nuevos ítems si fueron enviados
      let nuevosItems = [];
      const mapaNuevo = new Map();
      const getProdById = db.prepare('SELECT id, sku, nombre, precio, stock FROM productos WHERE id = ?');
      const getProdBySku = db.prepare('SELECT id, sku, nombre, precio, stock FROM productos WHERE sku = ?');

      if (Array.isArray(items)) {
        nuevosItems = items.map(item => {
          let prod = null;
          if (item.producto_id) prod = getProdById.get(item.producto_id);
          if (!prod && item.sku) prod = getProdBySku.get(item.sku);

          const cant = Math.max(1, Number(item.cantidad) || 1);
          const precio = (prod && Number(prod.precio)) || Number(item.precio) || 0;
          const prodId = prod ? prod.id : (item.producto_id || null);
          const sku = prod ? prod.sku : (item.sku || '');
          const nombre = prod ? prod.nombre : (item.nombre_producto || item.nombre || 'Producto');

          if (prodId) {
            mapaNuevo.set(prodId, (mapaNuevo.get(prodId) || 0) + cant);
          }

          return {
            producto_id: prodId,
            sku,
            nombre_producto: nombre,
            cantidad_solicitada: cant,
            cantidad_empacada: cant,
            precio
          };
        });

        // 3. Ajustar diferencias de stock de inventario
        // a) Reponer productos eliminados o que redujeron cantidad
        mapaPrevio.forEach((cantPrevia, prodId) => {
          const cantNueva = mapaNuevo.get(prodId) || 0;
          if (cantNueva < cantPrevia) {
            const diferencia = cantPrevia - cantNueva;
            db.reponerStockItem(prodId, diferencia, `Edición pedido ${pedido.codigo_pedido}: reducción de producto`, pedidoId);
          }
        });

        // b) Descontar productos que aumentaron cantidad o son nuevos
        mapaNuevo.forEach((cantNueva, prodId) => {
          const cantPrevia = mapaPrevio.get(prodId) || 0;
          if (cantNueva > cantPrevia) {
            const diferencia = cantNueva - cantPrevia;
            db.descontarStockItem(prodId, diferencia, `Edición pedido ${pedido.codigo_pedido}: incremento de producto`, pedidoId);
          }
        });

        // 4. Reemplazar detalle_pedidos
        db.prepare('DELETE FROM detalle_pedidos WHERE pedido_id = ?').run(pedidoId);
        const insertDetalle = db.prepare(`
          INSERT INTO detalle_pedidos (pedido_id, producto_id, sku, nombre_producto, cantidad_solicitada, cantidad_empacada, verificado)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `);
        nuevosItems.forEach(it => {
          insertDetalle.run(
            pedidoId,
            it.producto_id,
            it.sku,
            it.nombre_producto,
            it.cantidad_solicitada,
            it.cantidad_empacada
          );
        });
      }

      // 5. Calcular nuevo total si no fue enviado explícitamente
      let totalCalculado = total !== undefined && total !== null ? Number(total) : null;
      if (totalCalculado === null || isNaN(totalCalculado)) {
        if (nuevosItems.length > 0) {
          totalCalculado = nuevosItems.reduce((acc, it) => acc + (it.precio * it.cantidad_solicitada), 0);
        } else {
          totalCalculado = db.totalPedidoDesdeItems(pedidoId);
        }
      }

      // 6. Actualizar tabla pedidos
      db.prepare(`
        UPDATE pedidos
        SET cliente = COALESCE(?, cliente),
            cliente_id = COALESCE(?, cliente_id),
            empresa = COALESCE(?, empresa),
            telefono = COALESCE(?, telefono),
            direccion = COALESCE(?, direccion),
            municipio = COALESCE(?, municipio),
            observacion = COALESCE(?, observacion),
            tipo_entrega = COALESCE(?, tipo_entrega),
            total = ?
        WHERE id = ?
      `).run(
        cliente !== undefined ? cliente : null,
        cliente_id !== undefined ? cliente_id : null,
        empresa !== undefined ? empresa : null,
        telefono !== undefined ? telefono : null,
        direccion !== undefined ? direccion : null,
        municipio !== undefined ? municipio : null,
        observacion !== undefined ? observacion : null,
        tipo_entrega !== undefined ? tipo_entrega : null,
        totalCalculado,
        pedidoId
      );

      // Si se especificó cliente y datos de contacto/empresa, actualizar la ficha del cliente
      const finalClienteId = cliente_id || pedido.cliente_id;
      if (finalClienteId && (telefono || direccion || municipio || empresa)) {
        db.prepare(`
          UPDATE clientes
          SET telefono = CASE WHEN ? != '' THEN ? ELSE telefono END,
              direccion = CASE WHEN ? != '' THEN ? ELSE direccion END,
              ciudad = CASE WHEN ? != '' THEN ? ELSE ciudad END,
              empresa = CASE WHEN ? != '' THEN ? ELSE empresa END
          WHERE id = ?
        `).run(
          telefono || '', telefono || '',
          direccion || '', direccion || '',
          municipio || '', municipio || '',
          empresa || '', empresa || '',
          finalClienteId
        );
      }

      return { totalCalculado };
    });

    const resultado = tx();
    const pedidoActualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    const itemsActualizados = db.prepare(`
      SELECT d.*, COALESCE(p.precio, 0) AS precio
      FROM detalle_pedidos d
      LEFT JOIN productos p ON p.id = d.producto_id OR (d.producto_id IS NULL AND p.sku = d.sku)
      WHERE d.pedido_id = ?
    `).all(pedidoId);

    res.json({
      ok: true,
      mensaje: 'Pedido actualizado correctamente',
      data: { ...pedidoActualizado, items: itemsActualizados }
    });
  } catch (err) {
    console.error('Error al actualizar pedido:', err);
    res.status(400).json({ ok: false, error: err.message });
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
// POST /api/pedidos/:pedidoId/items/:itemId/faltante
// ------------------------------------------------------------------
router.post('/:pedidoId/items/:itemId/faltante', (req, res) => {
  const { pedidoId, itemId } = req.params;
  const { es_faltante, nota_faltante } = req.body;

  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });

    const item = db.prepare('SELECT * FROM detalle_pedidos WHERE id = ? AND pedido_id = ?').get(itemId, pedidoId);
    if (!item) return res.status(404).json({ ok: false, error: 'Ítem no encontrado' });

    const nuevoEsFaltante = es_faltante ? 1 : 0;
    const nuevaNota = nota_faltante !== undefined ? String(nota_faltante).trim() : (item.nota_faltante || '');
    const verificadoFinal = 1; // Si es faltante o verificado, se marca como procesado para empaque

    db.prepare(`
      UPDATE detalle_pedidos 
      SET es_faltante = ?, nota_faltante = ?, verificado = ?
      WHERE id = ?
    `).run(nuevoEsFaltante, nuevaNota, verificadoFinal, itemId);

    const itemActualizado = db.prepare('SELECT * FROM detalle_pedidos WHERE id = ?').get(itemId);
    const totales = db.prepare(`
      SELECT COUNT(*) as total, SUM(verificado) as verificados FROM detalle_pedidos WHERE pedido_id = ?
    `).get(pedidoId);

    res.json({
      ok: true,
      mensaje: nuevoEsFaltante ? 'Ítem marcado como faltante para compra/recolección' : 'Ítem desmarcado de faltante',
      item: itemActualizado,
      progreso: { total: totales.total, verificados: totales.verificados || 0 }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
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

  // Marcar automáticamente como verificados los ítems faltantes antes de evaluar
  db.prepare("UPDATE detalle_pedidos SET verificado = 1 WHERE pedido_id = ? AND es_faltante = 1").run(id);

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