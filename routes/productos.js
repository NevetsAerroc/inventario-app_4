const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const db = require('../db/database');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

// ------------------------------------------------------------------
// GET /api/productos  -> listado completo, filtrable por ?q= (sku/nombre/barcode/ubicacion)
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
// POST /api/productos  { sku, nombre, categoria, subcategoria, ubicacion,
//                         stock, precio, codigo_barras }
// Crea UN producto manualmente desde el formulario "+ Agregar producto".
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

  let codigoFinal = null;
  const codigoLimpio = String(codigo_barras || '').trim();
  if (codigoLimpio) {
    const yaUsado = db.prepare('SELECT sku, nombre FROM productos WHERE codigo_barras = ?').get(codigoLimpio);
    if (yaUsado) {
      return res.status(409).json({ ok: false, error: `El codigo de barras ya esta vinculado a "${yaUsado.nombre}" (SKU ${yaUsado.sku}).` });
    }
    codigoFinal = codigoLimpio;
  }

  const info = db.prepare(`
    INSERT INTO productos (sku, nombre, categoria, subcategoria, ubicacion, stock, precio, codigo_barras)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(skuLimpio, nombreLimpio, (categoria || '').trim(), (subcategoria || '').trim(), (ubicacion || '').trim(), stockFinal, precioFinal, codigoFinal);

  const creado = db.prepare('SELECT * FROM productos WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ok: true, data: creado });
});

// ------------------------------------------------------------------
// GET /api/productos/sugerencias?q=texto -> autocompletar de busqueda.
// Devuelve coincidencias por nombre, SKU, ubicacion, categoria o subcategoria.
// Pensado para mostrarse como lista desplegable mientras el usuario escribe.
// ------------------------------------------------------------------
router.get('/sugerencias', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ ok: true, data: [] });

  const productos = db.prepare(`
    SELECT id, sku, nombre, categoria, subcategoria, ubicacion, stock, precio, codigo_barras, codigo_caja, unidades_por_caja
    FROM productos
    WHERE nombre LIKE ? OR sku LIKE ? OR ubicacion LIKE ? OR categoria LIKE ? OR subcategoria LIKE ?
    ORDER BY
      CASE WHEN nombre LIKE ? THEN 0 ELSE 1 END,
      nombre ASC
    LIMIT 8
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `${q}%`);

  res.json({ ok: true, data: productos });
});

// ------------------------------------------------------------------
// GET /api/productos/exportar -> genera un .xlsx con el catalogo ACTUAL
// (SKU, Nombre, Categoria, Subcategoria, Ubicacion, StockInicial, Precio,
//  CodigoBarras, CodigoCaja, UnidadesPorCaja).
// Sirve como "plantilla siempre actualizada": se descarga, se edita
// (incluyendo escribir codigos a mano) y se vuelve a subir por /importar
// para actualizar la base de datos masivamente.
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
  // Si el catalogo esta vacio, igual generamos el archivo con los encabezados
  // correctos para que sirva como plantilla desde cero.
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
// GET /api/productos/buscar/:codigo -> busca por codigo_barras (unidad),
// codigo_caja (caja cerrada) o SKU. El campo "tipo_match" en la respuesta
// indica cual de los tres fue el que coincidio, para que el frontend
// decida si debe ofrecer "recepcion de caja" (sumar varias unidades de una vez).
// ------------------------------------------------------------------
router.get('/buscar/:codigo', (req, res) => {
  const { codigo } = req.params;
  const producto = db.prepare(
    'SELECT * FROM productos WHERE codigo_barras = ? OR codigo_caja = ? OR sku = ?'
  ).get(codigo, codigo, codigo);

  if (!producto) {
    return res.status(404).json({ ok: false, error: 'Producto no encontrado para ese codigo.' });
  }

  let tipo_match = 'sku';
  if (producto.codigo_barras === codigo) tipo_match = 'unidad';
  else if (producto.codigo_caja === codigo) tipo_match = 'caja';

  res.json({ ok: true, data: producto, tipo_match });
});

// ------------------------------------------------------------------
// POST /api/productos/:id/vincular-barcode  { codigo_barras }
// Vincula el codigo de barras de la UNIDAD individual a un producto.
// ------------------------------------------------------------------
router.post('/:id/vincular-barcode', (req, res) => {
  const { id } = req.params;
  const { codigo_barras } = req.body;

  if (!codigo_barras || !codigo_barras.trim()) {
    return res.status(400).json({ ok: false, error: 'codigo_barras es requerido.' });
  }

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) return res.status(404).json({ ok: false, error: 'Producto no existe.' });

  const codigo = codigo_barras.trim();
  const yaUsado = db.prepare('SELECT * FROM productos WHERE codigo_barras = ? AND id != ?').get(codigo, id);
  if (yaUsado) {
    return res.status(409).json({ ok: false, error: `Ese codigo ya esta vinculado como codigo de UNIDAD a "${yaUsado.nombre}" (SKU ${yaUsado.sku}).` });
  }
  const usadoComoCaja = db.prepare('SELECT * FROM productos WHERE codigo_caja = ? AND id != ?').get(codigo, id);
  if (usadoComoCaja) {
    return res.status(409).json({ ok: false, error: `Ese codigo ya esta vinculado como codigo de CAJA a "${usadoComoCaja.nombre}" (SKU ${usadoComoCaja.sku}).` });
  }

  db.prepare("UPDATE productos SET codigo_barras = ?, updated_at = datetime('now') WHERE id = ?")
    .run(codigo, id);

  const actualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({ ok: true, data: actualizado });
});

// ------------------------------------------------------------------
// POST /api/productos/:id/vincular-caja  { codigo_caja, unidades_por_caja }
// Vincula el codigo de barras que trae la CAJA/CARTON cerrado (distinto al
// codigo de la unidad) y cuantas unidades trae cada caja. Al escanear este
// codigo despues (Modulo Inventario), se puede sumar el stock de toda la
// caja de una sola vez.
// ------------------------------------------------------------------
router.post('/:id/vincular-caja', (req, res) => {
  const { id } = req.params;
  const { codigo_caja, unidades_por_caja } = req.body;

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) return res.status(404).json({ ok: false, error: 'Producto no existe.' });

  const unidades = parseInt(unidades_por_caja, 10);
  if (!Number.isInteger(unidades) || unidades <= 0) {
    return res.status(400).json({ ok: false, error: 'unidades_por_caja debe ser un entero positivo.' });
  }

  let codigo = null;
  if (codigo_caja && codigo_caja.trim()) {
    codigo = codigo_caja.trim();
    const yaUsadoCaja = db.prepare('SELECT * FROM productos WHERE codigo_caja = ? AND id != ?').get(codigo, id);
    if (yaUsadoCaja) {
      return res.status(409).json({ ok: false, error: `Ese codigo de caja ya esta vinculado a "${yaUsadoCaja.nombre}" (SKU ${yaUsadoCaja.sku}).` });
    }
    const usadoComoUnidad = db.prepare('SELECT * FROM productos WHERE codigo_barras = ? AND id != ?').get(codigo, id);
    if (usadoComoUnidad) {
      return res.status(409).json({ ok: false, error: `Ese codigo ya esta vinculado como codigo de UNIDAD a "${usadoComoUnidad.nombre}" (SKU ${usadoComoUnidad.sku}).` });
    }
  }

  db.prepare("UPDATE productos SET codigo_caja = ?, unidades_por_caja = ?, updated_at = datetime('now') WHERE id = ?")
    .run(codigo, unidades, id);

  const actualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({ ok: true, data: actualizado });
});

// ------------------------------------------------------------------
// POST /api/productos/:id/recibir-caja  { cantidad_cajas, motivo }
// Recepcion rapida de mercancia: suma (cantidad_cajas * unidades_por_caja)
// al stock en un solo movimiento. Se usa despues de escanear el codigo_caja.
// ------------------------------------------------------------------
router.post('/:id/recibir-caja', (req, res) => {
  const { id } = req.params;
  const { cantidad_cajas, motivo } = req.body;

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) return res.status(404).json({ ok: false, error: 'Producto no existe.' });

  const cajas = parseInt(cantidad_cajas, 10);
  if (!Number.isInteger(cajas) || cajas <= 0) {
    return res.status(400).json({ ok: false, error: 'cantidad_cajas debe ser un entero positivo.' });
  }

  const unidadesPorCaja = producto.unidades_por_caja || 1;
  const totalUnidades = cajas * unidadesPorCaja;
  const nuevoStock = producto.stock + totalUnidades;

  const tx = db.transaction(() => {
    db.prepare("UPDATE productos SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(nuevoStock, id);
    db.prepare(`INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo)
                VALUES (?, 'entrada', ?, ?, ?)`)
      .run(id, totalUnidades, nuevoStock,
        motivo || `Recepcion de ${cajas} caja(s) x ${unidadesPorCaja} und`);
  });
  tx();

  const actualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({ ok: true, data: actualizado, unidadesAgregadas: totalUnidades });
});

// ------------------------------------------------------------------
// POST /api/productos/:id/ubicacion  { ubicacion }
// Edita/asigna la ubicacion fisica del producto (pasillo, estante, bodega, etc).
// ------------------------------------------------------------------
router.post('/:id/ubicacion', (req, res) => {
  const { id } = req.params;
  const { ubicacion } = req.body;

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) return res.status(404).json({ ok: false, error: 'Producto no existe.' });

  db.prepare("UPDATE productos SET ubicacion = ?, updated_at = datetime('now') WHERE id = ?")
    .run((ubicacion || '').trim(), id);

  const actualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({ ok: true, data: actualizado });
});

// ------------------------------------------------------------------
// POST /api/productos/:id/subcategoria  { subcategoria }
// Edita/asigna la subcategoria del producto.
// ------------------------------------------------------------------
router.post('/:id/subcategoria', (req, res) => {
  const { id } = req.params;
  const { subcategoria } = req.body;

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) return res.status(404).json({ ok: false, error: 'Producto no existe.' });

  db.prepare("UPDATE productos SET subcategoria = ?, updated_at = datetime('now') WHERE id = ?")
    .run((subcategoria || '').trim(), id);

  const actualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({ ok: true, data: actualizado });
});

// ------------------------------------------------------------------
// POST /api/productos/:id/ajustar-stock  { tipo: 'entrada'|'salida'|'ajuste', cantidad, motivo }
// ------------------------------------------------------------------
router.post('/:id/ajustar-stock', (req, res) => {
  const { id } = req.params;
  const { tipo, cantidad, motivo } = req.body;

  if (!['entrada', 'salida', 'ajuste'].includes(tipo)) {
    return res.status(400).json({ ok: false, error: 'tipo debe ser entrada, salida o ajuste.' });
  }
  const cant = parseInt(cantidad, 10);
  if (!Number.isInteger(cant) || cant <= 0) {
    return res.status(400).json({ ok: false, error: 'cantidad debe ser un entero positivo.' });
  }

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) return res.status(404).json({ ok: false, error: 'Producto no existe.' });

  let nuevoStock = producto.stock;
  if (tipo === 'entrada') nuevoStock += cant;
  else if (tipo === 'salida') nuevoStock -= cant;
  else nuevoStock = cant; // ajuste = fija el stock al valor indicado

  if (nuevoStock < 0) {
    return res.status(400).json({ ok: false, error: 'El stock no puede quedar negativo.' });
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE productos SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(nuevoStock, id);
    db.prepare(`INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo)
                VALUES (?, ?, ?, ?, ?)`).run(id, tipo, cant, nuevoStock, motivo || '');
  });
  tx();

  const actualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  res.json({ ok: true, data: actualizado });
});

// ------------------------------------------------------------------
// POST /api/productos/importar  (multipart/form-data, campo "archivo")
// Excel/CSV con columnas: SKU, Nombre, Categoria, Subcategoria, Ubicacion,
// StockInicial, Precio, CodigoBarras, CodigoCaja, UnidadesPorCaja (todas
// las ultimas 5 son opcionales). Inserta productos nuevos y actualiza los
// existentes (por SKU). Si las columnas de codigo vienen con datos, tambien
// actualizan/asignan los codigos masivamente (util para escribirlos a mano).
// ------------------------------------------------------------------
router.post('/importar', upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibio ningun archivo.' });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const buscarPorSku = db.prepare('SELECT * FROM productos WHERE sku = ?');
    const buscarPorBarcode = db.prepare('SELECT sku, nombre FROM productos WHERE codigo_barras = ? AND sku != ?');
    const buscarPorCodigoCaja = db.prepare('SELECT sku, nombre FROM productos WHERE codigo_caja = ? AND sku != ?');

    const insertar = db.prepare(`
      INSERT INTO productos (sku, nombre, categoria, subcategoria, ubicacion, stock, precio, codigo_barras, codigo_caja, unidades_por_caja)
      VALUES (@sku, @nombre, @categoria, @subcategoria, @ubicacion, @stock, @precio, @codigo_barras, @codigo_caja, @unidades_por_caja)
    `);

    let creados = 0, actualizados = 0, codigosAsignados = 0, cajasAsignadas = 0, errores = [];

    const tx = db.transaction((filas) => {
      filas.forEach((fila, idx) => {
        // Tolerante a variaciones de nombre de columna (mayus/minus, con o sin acentos)
        const buscarClave = (...keys) => Object.keys(fila).find(fk =>
          keys.some(k => fk.trim().toLowerCase() === k.toLowerCase())
        );
        const get = (...keys) => {
          const found = buscarClave(...keys);
          return (found !== undefined && fila[found] !== '') ? fila[found] : undefined;
        };

        const sku = String(get('SKU') ?? '').trim();
        const nombre = String(get('Nombre') ?? '').trim();
        const categoria = String(get('Categoria', 'Categoría') ?? '').trim();
        const subcategoria = String(get('Subcategoria', 'Subcategoría', 'Sub Categoria') ?? '').trim();
        const ubicacion = String(get('Ubicacion', 'Ubicación', 'Location') ?? '').trim();
        const stockInicial = parseInt(get('StockInicial', 'Stock Inicial', 'Stock') ?? 0, 10) || 0;
        const precio = parseFloat(get('Precio') ?? 0) || 0;

        if (!sku || !nombre) {
          errores.push(`Fila ${idx + 2}: falta SKU o Nombre, se omitio.`);
          return;
        }

        // --- Codigo de barras de UNIDAD (opcional, no se toca si la columna no viene) ---
        const claveCodigo = buscarClave('CodigoBarras', 'Codigo de Barras', 'Código de Barras', 'Codigo Barras');
        const columnaCodigoPresente = claveCodigo !== undefined;
        const codigoCrudo = columnaCodigoPresente ? String(fila[claveCodigo] ?? '').trim() : '';

        let codigoFinal; // undefined = no tocar, null = limpiar, string = asignar
        if (columnaCodigoPresente) {
          if (!codigoCrudo) {
            codigoFinal = null;
          } else {
            const conflicto = buscarPorBarcode.get(codigoCrudo, sku);
            if (conflicto) {
              errores.push(`Fila ${idx + 2} (SKU ${sku}): codigo de unidad "${codigoCrudo}" ya esta asignado a SKU ${conflicto.sku} (${conflicto.nombre}); se omitio ese codigo.`);
              codigoFinal = undefined;
            } else {
              codigoFinal = codigoCrudo;
              codigosAsignados++;
            }
          }
        }

        // --- Codigo de CAJA + unidades por caja (opcional) ---
        const claveCodigoCaja = buscarClave('CodigoCaja', 'Codigo Caja', 'Código Caja', 'Codigo de Caja');
        const columnaCajaPresente = claveCodigoCaja !== undefined;
        const codigoCajaCrudo = columnaCajaPresente ? String(fila[claveCodigoCaja] ?? '').trim() : '';

        let codigoCajaFinal; // undefined = no tocar
        if (columnaCajaPresente) {
          if (!codigoCajaCrudo) {
            codigoCajaFinal = null;
          } else {
            const conflictoCaja = buscarPorCodigoCaja.get(codigoCajaCrudo, sku);
            if (conflictoCaja) {
              errores.push(`Fila ${idx + 2} (SKU ${sku}): codigo de caja "${codigoCajaCrudo}" ya esta asignado a SKU ${conflictoCaja.sku} (${conflictoCaja.nombre}); se omitio ese codigo.`);
              codigoCajaFinal = undefined;
            } else {
              codigoCajaFinal = codigoCajaCrudo;
              cajasAsignadas++;
            }
          }
        }

        const claveUnidadesCaja = buscarClave('UnidadesPorCaja', 'Unidades Por Caja', 'Unidades x Caja', 'UnidadesCaja');
        const unidadesPorCajaCruda = claveUnidadesCaja !== undefined ? parseInt(fila[claveUnidadesCaja], 10) : undefined;
        const unidadesPorCajaFinal = (Number.isInteger(unidadesPorCajaCruda) && unidadesPorCajaCruda > 0) ? unidadesPorCajaCruda : undefined;

        const existente = buscarPorSku.get(sku);
        const baseParams = { sku, nombre, categoria, subcategoria, ubicacion, stock: stockInicial, precio };

        if (existente) {
          // Construye UPDATE dinamico: solo toca columnas de codigo que vinieron en el archivo.
          const sets = ['nombre = @nombre', 'categoria = @categoria', 'subcategoria = @subcategoria',
                        'ubicacion = @ubicacion', 'stock = @stock', 'precio = @precio', "updated_at = datetime('now')"];
          const params = { ...baseParams };
          if (codigoFinal !== undefined) { sets.push('codigo_barras = @codigo_barras'); params.codigo_barras = codigoFinal; }
          if (codigoCajaFinal !== undefined) { sets.push('codigo_caja = @codigo_caja'); params.codigo_caja = codigoCajaFinal; }
          if (unidadesPorCajaFinal !== undefined) { sets.push('unidades_por_caja = @unidades_por_caja'); params.unidades_por_caja = unidadesPorCajaFinal; }

          db.prepare(`UPDATE productos SET ${sets.join(', ')} WHERE sku = @sku`).run({ ...params, sku });
          actualizados++;
        } else {
          insertar.run({
            ...baseParams,
            codigo_barras: codigoFinal === undefined ? null : codigoFinal,
            codigo_caja: codigoCajaFinal === undefined ? null : codigoCajaFinal,
            unidades_por_caja: unidadesPorCajaFinal === undefined ? 1 : unidadesPorCajaFinal,
          });
          creados++;
        }
      });
    });

    tx(rows);

    res.json({
      ok: true,
      resumen: { totalFilas: rows.length, creados, actualizados, codigosAsignados, cajasAsignadas, errores }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error procesando el archivo: ' + err.message });
  }
});

module.exports = router;