const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

// ------------------------------------------------------------------
// GET /api/productos/siguiente-sku -> Devuelve el consecutivo (P001, P002...)
// (IMPORTANTE: Debe ir antes de rutas dinámicas como /:id)
// ------------------------------------------------------------------
router.get('/siguiente-sku', (req, res) => {
  try {
    const row = db.prepare(
      "SELECT sku FROM productos WHERE sku LIKE 'P%' ORDER BY LENGTH(sku) DESC, sku DESC LIMIT 1"
    ).get();

    let siguienteNumero = 1;

    if (row && row.sku) {
      const numeroActual = parseInt(row.sku.replace(/\D/g, ''), 10);
      if (!isNaN(numeroActual)) {
        siguienteNumero = numeroActual + 1;
      }
    }

    const siguienteSku = `P${String(siguienteNumero).padStart(3, '0')}`;
    res.json({ ok: true, siguienteSku });
  } catch (err) {
    console.error('Error al obtener el siguiente SKU:', err);
    res.status(500).json({ ok: false, error: 'Error al consultar la base de datos' });
  }
});

// ------------------------------------------------------------------
// GET /api/productos -> listado completo, filtrable por ?q=
// ------------------------------------------------------------------
router.get('/', (req, res) => {
  const { q, sinBarcode } = req.query;
  let sql = 'SELECT * FROM productos';
  const params = [];
  const where = [];

  if (q) {
    where.push('(sku LIKE ? OR nombre LIKE ? OR codigo_barras LIKE ? OR ubicacion LIKE ? OR subcategoria LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (sinBarcode === '1') {
    where.push("(codigo_barras IS NULL OR codigo_barras = '')");
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY nombre ASC';

  const productos = db.prepare(sql).all(...params);
  res.json({ ok: true, data: productos });
});

// ------------------------------------------------------------------
// POST /api/productos -> Crea UN producto manualmente
// ------------------------------------------------------------------
router.post('/', (req, res) => {
  const { sku, nombre, categoria, subcategoria, ubicacion, stock, precio, codigo_barras } = req.body;

  const skuLimpio = String(sku || '').trim();
  const nombreLimpio = String(nombre || '').trim();
  if (!skuLimpio || !nombreLimpio) {
    return res.status(400).json({ ok: false, error: 'SKU y Nombre son obligatorios.' });
  }

  const existente = db.prepare('SELECT id FROM productos WHERE sku = ?').get(skuLimpio);
  if (existente) {
    return res.status(409).json({ ok: false, error: `Ya existe un producto con el SKU "${skuLimpio}".` });
  }

  const stockNum = parseInt(stock, 10);
  const precioNum = parseFloat(precio);
  const stockFinal = Number.isInteger(stockNum) && stockNum >= 0 ? stockNum : 0;
  const precioFinal = !isNaN(precioNum) && precioNum >= 0 ? precioNum : 0;

  let codigoFinal = db.normalizarCodigoBarras(codigo_barras);
  if (codigoFinal) {
    const yaUsado = db.prepare('SELECT sku, nombre FROM productos WHERE codigo_barras = ?').get(codigoFinal);
    if (yaUsado) {
      return res.status(409).json({ ok: false, error: `El codigo de barras ya esta vinculado a "${yaUsado.nombre}" (SKU ${yaUsado.sku}).` });
    }
  }

  const info = db.prepare(`
    INSERT INTO productos (sku, nombre, categoria, subcategoria, ubicacion, stock, precio, codigo_barras)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(skuLimpio, nombreLimpio, (categoria || '').trim(), (subcategoria || '').trim(), (ubicacion || '').trim(), stockFinal, precioFinal, codigoFinal);

  const creado = db.prepare('SELECT * FROM productos WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ok: true, data: creado });
});

// ------------------------------------------------------------------
// GET /api/productos/sugerencias?q=&limit=&offset=
// ------------------------------------------------------------------
router.get('/sugerencias', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = parseInt(req.query.limit, 10) || 8;
  const offset = parseInt(req.query.offset, 10) || 0;
  const soloConCodigo = req.query.con_codigo === '1' || req.query.con_codigo === 'true';
  if (!q) return res.json({ ok: true, data: [], total: 0 });

  const qNorm = db.normalizarCodigoBarras(q) || q;
  const like = `%${q}%`;
  const likeNorm = `%${qNorm}%`;
  let where = `(nombre LIKE ? OR sku LIKE ? OR ubicacion LIKE ? OR categoria LIKE ? OR subcategoria LIKE ?
                 OR codigo_barras LIKE ? OR codigo_caja LIKE ? OR codigo_barras LIKE ? OR codigo_caja LIKE ?)`;
  const params = [like, like, like, like, like, like, like, likeNorm, likeNorm];

  if (soloConCodigo) {
    where += ` AND ((codigo_barras IS NOT NULL AND codigo_barras != '') OR (codigo_caja IS NOT NULL AND codigo_caja != ''))`;
  }

  const totalRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM productos
    WHERE ${where}
  `).get(...params);

  const productos = db.prepare(`
    SELECT id, sku, nombre, categoria, subcategoria, ubicacion, stock, precio, codigo_barras, codigo_caja, unidades_por_caja
    FROM productos
    WHERE ${where}
    ORDER BY
      CASE
        WHEN codigo_barras = ? OR codigo_caja = ? OR sku = ? THEN 0
        WHEN codigo_barras = ? OR codigo_caja = ? THEN 0
        WHEN nombre LIKE ? THEN 1
        ELSE 2
      END,
      nombre ASC
    LIMIT ? OFFSET ?
  `).all(...params, q, q, q, qNorm, qNorm, `${q}%`, limit, offset);

  res.json({ ok: true, data: productos, total: totalRow.total });
});

// ------------------------------------------------------------------
// GET /api/productos/exportar
// ------------------------------------------------------------------
router.get('/exportar', (req, res) => {
  const productos = db.prepare('SELECT * FROM productos ORDER BY nombre ASC').all();

  const filas = productos.map(p => ({
    SKU: p.sku,
    Nombre: p.nombre,
    Categoria: p.categoria || '',
    Subcategoria: p.subcategoria || '',
    Ubicacion: p.ubicacion || '',
    StockInicial: p.stock,
    Precio: p.precio,
    CodigoBarras: p.codigo_barras || '',
    CodigoCaja: p.codigo_caja || '',
    UnidadesPorCaja: p.unidades_por_caja || 1,
  }));

  const header = ['SKU', 'Nombre', 'Categoria', 'Subcategoria', 'Ubicacion', 'StockInicial', 'Precio', 'CodigoBarras', 'CodigoCaja', 'UnidadesPorCaja'];
  const ws = XLSX.utils.json_to_sheet(filas, { header });
  ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_productos.xlsx"');
  res.send(buffer);
});

// ------------------------------------------------------------------
// GET /api/productos/buscar/:codigo
// ------------------------------------------------------------------
router.get('/buscar/:codigo', (req, res) => {
  const rawCodigo = decodeURIComponent(req.params.codigo || '').trim();
  if (!rawCodigo) {
    return res.status(400).json({ ok: false, error: 'Escribe un código, SKU o nombre.' });
  }

  const codigoNorm = db.normalizarCodigoBarras(rawCodigo) || rawCodigo;

  // 1) Coincidencia exacta con código normalizado o crudo: unidad, caja o SKU
  let producto = db.prepare(
    'SELECT * FROM productos WHERE codigo_barras = ? OR codigo_caja = ? OR sku = ? OR codigo_barras = ? OR codigo_caja = ?'
  ).get(codigoNorm, codigoNorm, rawCodigo, rawCodigo, rawCodigo);

  let tipo_match = 'sku';

  if (producto) {
    if (producto.codigo_barras === codigoNorm || producto.codigo_barras === rawCodigo) tipo_match = 'unidad';
    else if (producto.codigo_caja === codigoNorm || producto.codigo_caja === rawCodigo) tipo_match = 'caja';
    else tipo_match = 'sku';
  } else {
    // 2) Búsqueda por nombre / SKU parcial
    const like = `%${rawCodigo}%`;
    producto = db.prepare(`
      SELECT * FROM productos
      WHERE nombre LIKE ? OR sku LIKE ?
      ORDER BY
        CASE WHEN nombre LIKE ? THEN 0 WHEN sku LIKE ? THEN 1 ELSE 2 END,
        nombre ASC
      LIMIT 1
    `).get(like, like, `${rawCodigo}%`, `${rawCodigo}%`);
    tipo_match = 'nombre';
  }

  if (!producto) {
    return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
  }

  res.json({ ok: true, data: producto, tipo_match });
});

// ------------------------------------------------------------------
// PUT /api/productos/:id -> Edita datos del producto (nombre, unidades_por_caja, precio, etc.)
// ------------------------------------------------------------------
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, unidades_por_caja, categoria, subcategoria, ubicacion, precio } = req.body;

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) {
    return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
  }

  const updates = [];
  const params = [];

  if (nombre !== undefined) {
    const nombreLimpio = String(nombre || '').trim();
    if (!nombreLimpio) {
      return res.status(400).json({ ok: false, error: 'El nombre del producto es obligatorio.' });
    }
    updates.push('nombre = ?');
    params.push(nombreLimpio);
  }

  if (unidades_por_caja !== undefined) {
    const upc = parseInt(unidades_por_caja, 10);
    if (!Number.isInteger(upc) || upc < 1) {
      return res.status(400).json({ ok: false, error: 'Las unidades por caja deben ser al menos 1.' });
    }
    updates.push('unidades_por_caja = ?');
    params.push(upc);
  }

  if (categoria !== undefined) {
    updates.push('categoria = ?');
    params.push(String(categoria || '').trim());
  }

  if (subcategoria !== undefined) {
    updates.push('subcategoria = ?');
    params.push(String(subcategoria || '').trim());
  }

  if (ubicacion !== undefined) {
    updates.push('ubicacion = ?');
    params.push(String(ubicacion || '').trim());
  }

  if (precio !== undefined) {
    const precioNum = parseFloat(precio);
    if (!isNaN(precioNum) && precioNum >= 0) {
      updates.push('precio = ?');
      params.push(precioNum);
    }
  }

  if (updates.length === 0) {
    return res.json({ ok: true, data: producto, mensaje: 'Sin cambios.' });
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE productos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Si se cambió el nombre, sincronizar con pedidos pendientes o en proceso
  if (nombre !== undefined) {
    try {
      db.prepare(`
        UPDATE detalle_pedidos 
        SET nombre_producto = ? 
        WHERE producto_id = ? AND pedido_id IN (SELECT id FROM pedidos WHERE estado != 'EMPACADO')
      `).run(String(nombre).trim(), id);
    } catch (e) {}
  }

  const productoActualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({ ok: true, data: productoActualizado, mensaje: 'Producto actualizado exitosamente.' });
});

// PATCH /api/productos/:id -> Alias de PUT (misma lógica)
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, unidades_por_caja, categoria, subcategoria, ubicacion, precio } = req.body;

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) {
    return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
  }

  const updates = [];
  const params = [];

  if (nombre !== undefined) {
    const nombreLimpio = String(nombre || '').trim();
    if (!nombreLimpio) {
      return res.status(400).json({ ok: false, error: 'El nombre del producto es obligatorio.' });
    }
    updates.push('nombre = ?');
    params.push(nombreLimpio);
  }

  if (unidades_por_caja !== undefined) {
    const upc = parseInt(unidades_por_caja, 10);
    if (!Number.isInteger(upc) || upc < 1) {
      return res.status(400).json({ ok: false, error: 'Las unidades por caja deben ser al menos 1.' });
    }
    updates.push('unidades_por_caja = ?');
    params.push(upc);
  }

  if (categoria !== undefined) { updates.push('categoria = ?'); params.push(String(categoria || '').trim()); }
  if (subcategoria !== undefined) { updates.push('subcategoria = ?'); params.push(String(subcategoria || '').trim()); }
  if (ubicacion !== undefined) { updates.push('ubicacion = ?'); params.push(String(ubicacion || '').trim()); }
  if (precio !== undefined) {
    const precioNum = parseFloat(precio);
    if (!isNaN(precioNum) && precioNum >= 0) { updates.push('precio = ?'); params.push(precioNum); }
  }

  if (updates.length === 0) {
    return res.json({ ok: true, data: producto, mensaje: 'Sin cambios.' });
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE productos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  if (nombre !== undefined) {
    try {
      db.prepare(`
        UPDATE detalle_pedidos
        SET nombre_producto = ?
        WHERE producto_id = ? AND pedido_id IN (SELECT id FROM pedidos WHERE estado != 'EMPACADO')
      `).run(String(nombre).trim(), id);
    } catch (e) {}
  }

  const productoActualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({ ok: true, data: productoActualizado, mensaje: 'Producto actualizado exitosamente.' });
});

// POST /api/productos/:id/vincular-barcode
// Body: { codigo_barras, tipo_codigo, unidades_por_caja, accion, forzar }
router.post('/:id/vincular-barcode', (req, res) => {
  const { id } = req.params;
  const { codigo_barras, tipo_codigo = 'UNIDAD', unidades_por_caja = 1, accion, forzar } = req.body;

  const productoExiste = db.prepare('SELECT id FROM productos WHERE id = ?').get(id);
  if (!productoExiste) {
    return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
  }

  // Quitar código
  if (accion === 'quitar') {
    if (tipo_codigo === 'CAJA') {
      db.prepare("UPDATE productos SET codigo_caja = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    } else {
      db.prepare("UPDATE productos SET codigo_barras = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    }
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    return res.json({ ok: true, data: producto, mensaje: 'Código eliminado' });
  }

  const codigo = db.normalizarCodigoBarras(codigo_barras);
  if (!codigo) {
    return res.status(400).json({ ok: false, error: 'El código es obligatorio (o usa accion: "quitar").' });
  }

  // ¿Ya lo usan otros productos?
  const conflictos = db.prepare(`
    SELECT id, sku, nombre, codigo_barras, codigo_caja
    FROM productos
    WHERE (codigo_barras = ? OR codigo_caja = ?) AND id != ?
  `).all(codigo, codigo, id);

  // Si hay conflicto y NO forzamos → devolver aviso (no bloquear del todo)
  if (conflictos.length > 0 && !forzar) {
    return res.status(409).json({
      ok: false,
      codigo_duplicado: true,
      error: `Ese código ya está en uso.`,
      conflictos: conflictos.map(c => ({
        id: c.id,
        sku: c.sku,
        nombre: c.nombre,
        tipo: c.codigo_barras === codigo ? 'UNIDAD' : 'CAJA',
      })),
    });
  }

  // Guardar (permite compartir si forzar = true)
  if (tipo_codigo === 'CAJA') {
    db.prepare("UPDATE productos SET codigo_caja = ?, unidades_por_caja = ?, updated_at = datetime('now') WHERE id = ?")
      .run(codigo, Number(unidades_por_caja) || 1, id);
  } else {
    db.prepare("UPDATE productos SET codigo_barras = ?, updated_at = datetime('now') WHERE id = ?")
      .run(codigo, id);
  }

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({
    ok: true,
    data: producto,
    advertencia: conflictos.length > 0
      ? `Código compartido con: ${conflictos.map(c => c.nombre).join(', ')}`
      : null,
  });
});

// ------------------------------------------------------------------
// POST /api/productos/importar -> Importa catálogo desde Excel/CSV
// ------------------------------------------------------------------
router.post('/importar', upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo.' });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ ok: false, error: 'El archivo Excel está vacío.' });
    }

    const get = (fila, ...keys) => {
      for (const k of keys) {
        const found = Object.keys(fila).find(fk => fk.trim().toLowerCase() === k.toLowerCase());
        if (found !== undefined && fila[found] !== '') return fila[found];
      }
      return undefined;
    };

    let creados = 0;
    let actualizados = 0;
    let codigosAsignados = 0;
    let cajasAsignadas = 0;
    const errores = [];

    const buscarPorSku = db.prepare('SELECT * FROM productos WHERE sku = ?');
    const buscarPorBarcode = db.prepare('SELECT id, sku, nombre FROM productos WHERE codigo_barras = ?');

    const updateStmt = db.prepare(`
      UPDATE productos
      SET nombre = ?, categoria = ?, subcategoria = ?, ubicacion = ?, stock = ?, precio = ?,
          codigo_barras = ?, codigo_caja = ?, unidades_por_caja = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    const insertStmt = db.prepare(`
      INSERT INTO productos (sku, nombre, categoria, subcategoria, ubicacion, stock, precio, codigo_barras, codigo_caja, unidades_por_caja)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMov = db.prepare(`
      INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo)
      VALUES (?, 'ajuste', ?, ?, 'Importación masiva')
    `);

    const tx = db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        const fila = rows[i];
        const sku = String(get(fila, 'SKU', 'Sku', 'Código') ?? '').trim();
        const nombre = String(get(fila, 'Nombre', 'NombreProducto', 'Producto', 'Descripcion') ?? '').trim();
        if (!sku || !nombre) {
          if (sku || nombre) errores.push(`Fila ${i + 2}: SKU y Nombre son obligatorios.`);
          continue;
        }

        const categoria = String(get(fila, 'Categoria', 'Categoría') ?? '').trim();
        const subcategoria = String(get(fila, 'Subcategoria', 'Subcategoría') ?? '').trim();
        const ubicacion = String(get(fila, 'Ubicacion', 'Ubicación', 'Posicion') ?? '').trim();

        const rawStock = get(fila, 'StockInicial', 'Stock', 'Stock Inicial', 'Cantidad');
        const stockNum = parseInt(rawStock, 10);
        const precioNum = parseFloat(get(fila, 'Precio', 'PrecioUnitario', 'Valor') ?? 0);
        const unidadesPorCaja = parseInt(get(fila, 'UnidadesPorCaja', 'UndPorCaja', 'UnidadesCaja') ?? 1, 10) || 1;

        let codigoBarras = db.normalizarCodigoBarras(get(fila, 'CodigoBarras', 'Codigo_Barras', 'Barcode', 'Codigo'));
        let codigoCaja = db.normalizarCodigoBarras(get(fila, 'CodigoCaja', 'Codigo_Caja', 'BarcodeCaja'));

        const prodExistente = buscarPorSku.get(sku);

        // Validar colisión de código de barras unidad
        if (codigoBarras) {
          const colision = buscarPorBarcode.get(codigoBarras);
          if (colision && (!prodExistente || colision.id !== prodExistente.id)) {
            errores.push(`SKU ${sku}: Código ${codigoBarras} ya está usado por "${colision.nombre}" (SKU ${colision.sku}).`);
            codigoBarras = prodExistente ? prodExistente.codigo_barras : null;
          }
        } else if (prodExistente) {
          codigoBarras = prodExistente.codigo_barras;
        }

        if (!codigoCaja && prodExistente) {
          codigoCaja = prodExistente.codigo_caja;
        }

        if (codigoBarras) codigosAsignados++;
        if (codigoCaja) cajasAsignadas++;

        if (prodExistente) {
          const stockFinal = !isNaN(stockNum) ? stockNum : prodExistente.stock;
          const precioFinal = !isNaN(precioNum) ? precioNum : prodExistente.precio;
          updateStmt.run(
            nombre,
            categoria || prodExistente.categoria,
            subcategoria || prodExistente.subcategoria,
            ubicacion || prodExistente.ubicacion,
            stockFinal,
            precioFinal,
            codigoBarras,
            codigoCaja,
            unidadesPorCaja,
            prodExistente.id
          );
          actualizados++;
        } else {
          const stockFinal = Number.isInteger(stockNum) && stockNum >= 0 ? stockNum : 0;
          const precioFinal = !isNaN(precioNum) && precioNum >= 0 ? precioNum : 0;
          const resInsert = insertStmt.run(
            sku,
            nombre,
            categoria,
            subcategoria,
            ubicacion,
            stockFinal,
            precioFinal,
            codigoBarras,
            codigoCaja,
            unidadesPorCaja
          );
          if (stockFinal > 0) {
            insertMov.run(resInsert.lastInsertRowid, stockFinal, stockFinal);
          }
          creados++;
        }
      }
    });

    tx();

    res.json({
      ok: true,
      resumen: {
        totalFilas: rows.length,
        creados,
        actualizados,
        codigosAsignados,
        cajasAsignadas,
        errores,
      },
    });
  } catch (err) {
    console.error('Error importando productos:', err);
    res.status(500).json({ ok: false, error: 'Error procesando el archivo: ' + err.message });
  } finally {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
  }
});

// ------------------------------------------------------------------
// POST /api/productos/escanear-entrada -> Entrada rápida por escáner (unidad / caja)
// ------------------------------------------------------------------
router.post('/escanear-entrada', (req, res) => {
  const { codigo_barras, cantidad_ingresada = 1, distribucion } = req.body;
  const rawCodigo = String(codigo_barras || '').trim();
  const codigo = db.normalizarCodigoBarras(rawCodigo) || rawCodigo;

  if (!codigo) {
    return res.status(400).json({ ok: false, error: 'Código de barras no proporcionado.' });
  }

  // 1) Si viene con distribución (caso caja mixta confirmada por el usuario)
  if (Array.isArray(distribucion) && distribucion.length > 0) {
    const updateStock = db.prepare("UPDATE productos SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?");
    const insertMov = db.prepare(`
      INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo)
      VALUES (?, 'entrada', ?, (SELECT stock FROM productos WHERE id = ?), ?)
    `);
    const selectProd = db.prepare('SELECT id, nombre, stock FROM productos WHERE id = ?');

    const tx = db.transaction(() => {
      distribucion.forEach((linea) => {
        const cant = parseInt(linea.cantidad, 10) || 0;
        if (cant > 0 && linea.producto_id) {
          updateStock.run(cant, linea.producto_id);
          const p = selectProd.get(linea.producto_id);
          if (p) {
            insertMov.run(p.id, cant, p.stock, `Entrada caja mixta (${codigo})`);
          }
        }
      });
    });

    tx();
    return res.json({ ok: true, mensaje: 'Caja mixta ingresada exitosamente.' });
  }

  // 2) Buscar productos que coincidan con el código normalizado o crudo
  const cantIngreso = Math.max(1, parseInt(cantidad_ingresada, 10) || 1);

  // Buscar todos los productos que tengan este código de caja
  const prodsCaja = db.prepare('SELECT * FROM productos WHERE codigo_caja = ? OR codigo_caja = ?').all(codigo, rawCodigo);

  if (prodsCaja.length > 1) {
    // Es una caja compartida entre varios productos/sabores -> requiere distribución
    return res.json({
      ok: true,
      requiere_distribucion: true,
      codigo_caja: codigo,
      capacidad_caja: prodsCaja[0].unidades_por_caja || 1,
      productos: prodsCaja.map(p => ({ id: p.id, sku: p.sku, nombre: p.nombre, stock: p.stock })),
    });
  }

  // Si no es caja compartida, buscar por código de barras de unidad, de caja o SKU
  let producto = prodsCaja[0] || db.prepare('SELECT * FROM productos WHERE codigo_barras = ? OR codigo_caja = ? OR sku = ? OR codigo_barras = ? OR codigo_caja = ?').get(codigo, codigo, rawCodigo, rawCodigo, rawCodigo);

  if (!producto) {
    return res.status(404).json({ ok: false, error: 'NO_ENCONTRADO' });
  }

  const esCaja = producto.codigo_caja === codigo;
  const unidadesPorCaja = Number(producto.unidades_por_caja) || 1;
  const totalUnidades = esCaja ? cantIngreso * unidadesPorCaja : cantIngreso;

  const nuevoStock = producto.stock + totalUnidades;
  const motivo = esCaja
    ? `Entrada ${cantIngreso} caja(s) de ${unidadesPorCaja} und (${codigo})`
    : `Entrada ${cantIngreso} und (${codigo})`;

  const tx = db.transaction(() => {
    db.prepare("UPDATE productos SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(nuevoStock, producto.id);
    db.prepare(`
      INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo)
      VALUES (?, 'entrada', ?, ?, ?)
    `).run(producto.id, totalUnidades, nuevoStock, motivo);
  });

  tx();

  const productoActualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(producto.id);
  const textoDetalle = esCaja
    ? `+${totalUnidades} und (${cantIngreso} caja de ${unidadesPorCaja}) a "${producto.nombre}"`
    : `+${totalUnidades} und a "${producto.nombre}"`;

  res.json({
    ok: true,
    mensaje: `${textoDetalle} (Stock actual: ${nuevoStock})`,
    data: productoActualizado,
  });
});

// ------------------------------------------------------------------
// POST /api/productos/:id/ajustar-stock -> Ajuste manual de stock (+/-)
// ------------------------------------------------------------------
router.post('/:id/ajustar-stock', (req, res) => {
  const { id } = req.params;
  const { tipo = 'ajuste', cantidad, motivo } = req.body;

  const cant = parseInt(cantidad, 10);
  if (!Number.isInteger(cant) || cant < 0) {
    return res.status(400).json({ ok: false, error: 'Cantidad inválida.' });
  }

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) {
    return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
  }

  let nuevoStock = producto.stock;
  let tipoMov = tipo;

  if (tipo === 'entrada') {
    nuevoStock = producto.stock + cant;
  } else if (tipo === 'salida') {
    nuevoStock = Math.max(0, producto.stock - cant);
  } else if (tipo === 'ajuste') {
    nuevoStock = cant;
  } else {
    return res.status(400).json({ ok: false, error: 'Tipo de ajuste no válido (entrada, salida, ajuste).' });
  }

  const delta = Math.abs(nuevoStock - producto.stock);
  const motivoFinal = motivo || `Ajuste manual (${tipo})`;

  const tx = db.transaction(() => {
    db.prepare("UPDATE productos SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(nuevoStock, id);
    db.prepare(`
      INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, tipoMov, delta, nuevoStock, motivoFinal);
  });

  tx();

  const productoActualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({ ok: true, data: productoActualizado });
});

module.exports = router;