const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

function parsePrecio(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, Math.round(val));

  let s = String(val).trim().replace(/[$]/g, '').replace(/\s+/g, '');
  if (!s) return 0;

  // Ambos presentes: punto y coma (ej: "1.240.000,00" o "1,240,000.00")
  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato latino: miles con punto, decimales con coma (ej: 14.000,00 o 1.240.000,00)
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglo: miles con coma, decimales con punto (ej: 14,000.00 o 1,240,000.00)
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Solo contiene comas
    const parts = s.split(',');
    if (parts.length > 2) {
      // Múltiples comas: separador de miles (ej: 1,240,000)
      s = s.replace(/,/g, '');
    } else {
      // Una sola coma: decimal (ej: "2000,00", "1650,00", "0,0000")
      const decimalPart = parts[1];
      if (decimalPart.length <= 4) {
        s = parts[0] + '.' + parts[1];
      } else {
        s = s.replace(/,/g, '');
      }
    }
  } else if (s.includes('.')) {
    // Solo contiene puntos
    const parts = s.split('.');
    if (parts.length > 2) {
      // Múltiples puntos: separador de miles (ej: 1.240.000)
      s = s.replace(/\./g, '');
    } else {
      // Un solo punto: si tiene 3 dígitos al final (ej: "2.000", "15.000"), en COP es separador de miles!
      if (parts[1].length === 3) {
        s = parts[0] + parts[1];
      } else {
        // Decimal (ej: "12.50")
        s = parts[0] + '.' + parts[1];
      }
    }
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : Math.max(0, Math.round(num));
}

function parseBarcode(val) {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    // Evitar notación científica en números largos
    return Number.isInteger(val) ? String(val) : val.toLocaleString('fullwide', { useGrouping: false });
  }
  let s = String(val).trim();
  if (s.includes('E+') || s.includes('e+')) {
    const num = Number(s);
    if (!isNaN(num)) return num.toLocaleString('fullwide', { useGrouping: false });
  }
  return s;
}

// ------------------------------------------------------------------
// GET /api/ventas/consecutivo -> Siguiente número de factura (FAC-0001)
// ------------------------------------------------------------------
router.get('/consecutivo', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT numero_factura FROM ventas
      ORDER BY id DESC LIMIT 1
    `).get();

    let sigNum = 1;
    if (row && row.numero_factura) {
      const match = row.numero_factura.match(/\d+/);
      if (match) {
        sigNum = parseInt(match[0], 10) + 1;
      }
    }
    const numero = `FAC-${String(sigNum).padStart(4, '0')}`;
    res.json({ ok: true, numero, sigNum });
  } catch (err) {
    console.error('Error al generar consecutivo de venta:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/ventas/productos-sugerencias -> Búsqueda rápida / auto-llenado
// ------------------------------------------------------------------
router.get('/productos-sugerencias', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ ok: true, productos: [] });

    const like = `%${q}%`;
    const qNorm = db.normalizarCodigoBarras ? (db.normalizarCodigoBarras(q) || q) : q;
    const likeNorm = `%${qNorm}%`;

    const productos = db.prepare(`
      SELECT id, sku, nombre, categoria, subcategoria, ubicacion, stock,
             COALESCE(NULLIF(precio_1, 0), precio, 0) AS precio_1,
             COALESCE(precio_2, 0) AS precio_2,
             COALESCE(precio_3, 0) AS precio_3,
             COALESCE(precio, 0) AS precio,
             COALESCE(iva, 0) AS iva,
             codigo_barras, codigo_caja, unidades_por_caja
      FROM productos
      WHERE (sku LIKE ? OR nombre LIKE ? OR codigo_barras LIKE ? OR codigo_barras LIKE ? OR codigo_caja LIKE ? OR codigo_interno LIKE ?)
      ORDER BY
        CASE
          WHEN codigo_barras = ? OR sku = ? THEN 0
          WHEN codigo_barras = ? THEN 0
          WHEN nombre LIKE ? THEN 1
          ELSE 2
        END,
        nombre ASC
      LIMIT 12
    `).all(like, like, like, likeNorm, like, like, q, q, qNorm, `${q}%`);

    res.json({ ok: true, productos });
  } catch (err) {
    console.error('Error al buscar productos para venta:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/ventas/buscar-codigo/:codigo -> Búsqueda exacta por código de barras o SKU
// ------------------------------------------------------------------
router.get('/buscar-codigo/:codigo', (req, res) => {
  try {
    const raw = (req.params.codigo || '').trim();
    if (!raw) return res.status(400).json({ ok: false, error: 'Código vacío' });

    const norm = db.normalizarCodigoBarras ? (db.normalizarCodigoBarras(raw) || raw) : raw;

    const prod = db.prepare(`
      SELECT id, sku, nombre, categoria, subcategoria, ubicacion, stock,
             COALESCE(NULLIF(precio_1, 0), precio, 0) AS precio_1,
             COALESCE(precio_2, 0) AS precio_2,
             COALESCE(precio_3, 0) AS precio_3,
             COALESCE(precio, 0) AS precio,
             COALESCE(iva, 0) AS iva,
             codigo_barras, codigo_caja, unidades_por_caja
      FROM productos
      WHERE codigo_barras = ? OR codigo_barras = ? OR sku = ? OR codigo_caja = ? OR codigo_caja = ? OR id = ?
      LIMIT 1
    `).get(raw, norm, raw, raw, norm, parseInt(raw, 10) || 0);

    if (!prod) {
      return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
    }

    res.json({ ok: true, producto: prod });
  } catch (err) {
    console.error('Error al buscar código de barras:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/ventas -> Crear y registrar una factura de venta
// ------------------------------------------------------------------
router.post('/', (req, res) => {
  try {
    const {
      cliente_id,
      cliente_nombre,
      cliente_documento,
      cliente_telefono,
      lista_precios = 'precio_1',
      items = [],
      metodo_pago = 'EFECTIVO',
      monto_recibido = 0,
      descuento = 0,
      observacion = '',
      comprobante = '',
      descontar_stock = true
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ ok: false, error: 'La factura no tiene ningún producto.' });
    }

    let subtotalCalculado = 0;
    const itemsValidados = [];

    for (const item of items) {
      const cantidad = parseFloat(item.cantidad) || 0;
      const precioUnit = parseFloat(item.precio_unitario) || 0;
      if (cantidad <= 0) continue;
      const sub = Math.round(cantidad * precioUnit);
      subtotalCalculado += sub;
      itemsValidados.push({
        producto_id: item.producto_id || null,
        sku: item.sku || '',
        nombre_producto: item.nombre_producto || 'Producto sin nombre',
        cantidad,
        precio_unitario: precioUnit,
        tipo_precio: item.tipo_precio || lista_precios,
        subtotal: sub
      });
    }

    if (!itemsValidados.length) {
      return res.status(400).json({ ok: false, error: 'No hay productos válidos con cantidad mayor a cero.' });
    }

    const descNum = parseFloat(descuento) || 0;
    const totalFinal = Math.max(0, subtotalCalculado - descNum);
    const montoRec = parseFloat(monto_recibido) || totalFinal;
    const cambioCalc = metodo_pago === 'EFECTIVO' ? Math.max(0, montoRec - totalFinal) : 0;

    // Generar consecutivo dentro de la transacción
    let ventaCreadaId = null;
    let numeroFactura = '';

    const tx = db.transaction(() => {
      // Consecutivo seguro
      const row = db.prepare(`SELECT numero_factura FROM ventas ORDER BY id DESC LIMIT 1`).get();
      let sig = 1;
      if (row && row.numero_factura) {
        const match = row.numero_factura.match(/\d+/);
        if (match) sig = parseInt(match[0], 10) + 1;
      }
      numeroFactura = `FAC-${String(sig).padStart(4, '0')}`;

      const usrId = req.user ? req.user.id : null;
      const usrNom = req.user ? req.user.nombre : 'Vendedor Caja';

      const infoVenta = db.prepare(`
        INSERT INTO ventas (
          numero_factura, fecha, cliente_id, cliente_nombre, cliente_documento, cliente_telefono,
          usuario_id, usuario_nombre, lista_precios, subtotal, descuento, total,
          metodo_pago, monto_recibido, cambio, comprobante, observacion, estado
        ) VALUES (?, datetime('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADA')
      `).run(
        numeroFactura,
        cliente_id || null,
        (cliente_nombre || 'Consumidor Final').trim(),
        (cliente_documento || '').trim(),
        (cliente_telefono || '').trim(),
        usrId,
        usrNom,
        lista_precios,
        subtotalCalculado,
        descNum,
        totalFinal,
        metodo_pago,
        montoRec,
        cambioCalc,
        comprobante || '',
        observacion || ''
      );

      ventaCreadaId = infoVenta.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO detalle_ventas (
          venta_id, producto_id, sku, nombre_producto, cantidad, precio_unitario, tipo_precio, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of itemsValidados) {
        insertItem.run(
          ventaCreadaId,
          it.producto_id,
          it.sku,
          it.nombre_producto,
          it.cantidad,
          it.precio_unitario,
          it.tipo_precio,
          it.subtotal
        );

        // Descontar inventario si el producto está vinculado
        if (descontar_stock && it.producto_id) {
          const prod = db.prepare('SELECT stock FROM productos WHERE id = ?').get(it.producto_id);
          if (prod) {
            const nuevoStock = Math.max(0, prod.stock - it.cantidad);
            db.prepare("UPDATE productos SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(nuevoStock, it.producto_id);
            db.prepare(`
              INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo)
              VALUES (?, 'salida', ?, ?, ?)
            `).run(it.producto_id, it.cantidad, nuevoStock, `Venta en caja ${numeroFactura}`);
          }
        }
      }
    });

    tx();

    // Obtener factura completa para retornar
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaCreadaId);
    const detalle = db.prepare('SELECT * FROM detalle_ventas WHERE venta_id = ?').all(ventaCreadaId);

    res.status(201).json({
      ok: true,
      mensaje: `Factura ${numeroFactura} generada exitosamente`,
      venta: {
        ...venta,
        items: detalle
      }
    });
  } catch (err) {
    console.error('Error al procesar la venta:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/ventas -> Historial de facturas recientes
// ------------------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const { fecha, q, limit = 50 } = req.query;
    let sql = `SELECT * FROM ventas`;
    const conditions = [];
    const params = [];

    if (fecha) {
      conditions.push(`date(fecha) = ?`);
      params.push(fecha);
    }
    if (q) {
      conditions.push(`(numero_factura LIKE ? OR cliente_nombre LIKE ? OR cliente_documento LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (conditions.length) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    sql += ` ORDER BY id DESC LIMIT ?`;
    params.push(parseInt(limit, 10) || 50);

    const facturas = db.prepare(sql).all(...params);

    // Totales rápidos del día actual
    const stats = db.prepare(`
      SELECT COUNT(*) AS total_ventas,
             COALESCE(SUM(total), 0) AS total_dinero,
             COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN total ELSE 0 END), 0) AS total_efectivo,
             COALESCE(SUM(CASE WHEN metodo_pago = 'TRANSFERENCIA' THEN total ELSE 0 END), 0) AS total_transferencia
      FROM ventas
      WHERE date(fecha) = date('now', 'localtime') AND estado = 'COMPLETADA'
    `).get();

    res.json({ ok: true, facturas, stats });
  } catch (err) {
    console.error('Error al listar facturas:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/ventas/:id -> Obtener una factura específica con sus ítems
// ------------------------------------------------------------------
router.get('/:id', (req, res) => {
  try {
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
    if (!venta) return res.status(404).json({ ok: false, error: 'Factura no encontrada' });
    const items = db.prepare('SELECT * FROM detalle_ventas WHERE venta_id = ?').all(venta.id);
    res.json({ ok: true, venta: { ...venta, items } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/ventas/anular/:id -> Anular factura y reponer stock
// ------------------------------------------------------------------
router.post('/anular/:id', (req, res) => {
  try {
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
    if (!venta) return res.status(404).json({ ok: false, error: 'Factura no encontrada' });
    if (venta.estado === 'ANULADA') {
      return res.status(400).json({ ok: false, error: 'La factura ya está anulada' });
    }

    const items = db.prepare('SELECT * FROM detalle_ventas WHERE venta_id = ?').all(venta.id);

    const tx = db.transaction(() => {
      db.prepare("UPDATE ventas SET estado = 'ANULADA', observacion = observacion || ' [ANULADA]' WHERE id = ?").run(venta.id);
      for (const it of items) {
        if (it.producto_id) {
          const prod = db.prepare('SELECT stock FROM productos WHERE id = ?').get(it.producto_id);
          if (prod) {
            const nuevoStock = prod.stock + it.cantidad;
            db.prepare("UPDATE productos SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(nuevoStock, it.producto_id);
            db.prepare(`
              INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo)
              VALUES (?, 'ajuste', ?, ?, ?)
            `).run(it.producto_id, it.cantidad, nuevoStock, `Anulación de factura ${venta.numero_factura}`);
          }
        }
      }
    });

    tx();
    res.json({ ok: true, mensaje: `Factura ${venta.numero_factura} anulada e inventario repuesto.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/ventas/catalogo-precios -> Listado de productos para revisar precios
// ------------------------------------------------------------------
router.get('/catalogo/precios', (req, res) => {
  try {
    const { q, limit = 100, offset = 0 } = req.query;
    let sql = `
      SELECT id, sku, nombre, categoria, subcategoria, ubicacion, stock,
             COALESCE(NULLIF(precio_1, 0), precio, 0) AS precio_1,
             COALESCE(precio_2, 0) AS precio_2,
             COALESCE(precio_3, 0) AS precio_3,
             COALESCE(precio, 0) AS precio,
             COALESCE(iva, 0) AS iva,
             codigo_barras, codigo_caja, codigo_interno
      FROM productos
    `;
    const params = [];
    if (q) {
      sql += ` WHERE (sku LIKE ? OR nombre LIKE ? OR codigo_barras LIKE ? OR codigo_interno LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY nombre ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10) || 100, parseInt(offset, 10) || 0);

    const productos = db.prepare(sql).all(...params);

    const totalRow = db.prepare(`
      SELECT COUNT(*) as total FROM productos
      ${q ? 'WHERE (sku LIKE ? OR nombre LIKE ? OR codigo_barras LIKE ? OR codigo_interno LIKE ?)' : ''}
    `).get(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : []));

    res.json({ ok: true, productos, total: totalRow ? totalRow.total : productos.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// PUT /api/ventas/producto-precio/:id -> Actualizar precios manuales de 1 producto
// ------------------------------------------------------------------
router.put('/producto-precio/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { precio_1, precio_2, precio_3, iva } = req.body;

    const p1 = parsePrecio(precio_1);
    const p2 = parsePrecio(precio_2);
    const p3 = parsePrecio(precio_3);
    const ivaVal = parseFloat(iva) || 0;

    const update = db.prepare(`
      UPDATE productos
      SET precio = ?,
          precio_1 = ?,
          precio_2 = ?,
          precio_3 = ?,
          iva = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(p1, p1, p2, p3, ivaVal, id);

    if (update.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
    }

    const prod = db.prepare('SELECT id, sku, nombre, precio, precio_1, precio_2, precio_3, iva FROM productos WHERE id = ?').get(id);
    res.json({ ok: true, producto: prod, mensaje: 'Precios actualizados con éxito' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/ventas/actualizar-precios-archivo -> IMPORTAR Y ACTUALIZAR SOLO PRECIOS
// Admite el formato exacto del archivo de la foto del usuario:
// ID | CODIGO | GRUPO | ARTICULO | UE | VENTA MIN | COD. BARRAS | REFE... | DCTO | CONTABLE | CON IVA | VENTA (1) | IVA | R/C | R/V | INC 1 | VENTA (2) | IVA | R/C | R/V | INC 1 | VENTA (3) | IVA | R/C | R/V | INC 1 | PRINCIPAL | PEND | ACTIVO
// ------------------------------------------------------------------
router.post('/actualizar-precios-archivo', upload.single('archivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo Excel (.xlsx, .xls) o CSV.' });
  }

  const filePath = req.file.path;
  try {
    const workbook = XLSX.readFile(filePath, { cellFormula: false, cellHTML: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Leer como matriz bidimensional para preservar columnas repetidas (como múltiples columnas "VENTA")
    // Usar raw: false para respetar el texto formateado de Excel (evitando inflar comas decimales)
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

    if (!rawRows || rawRows.length < 2) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ ok: false, error: 'El archivo Excel no tiene suficientes filas o está vacío.' });
    }

    // Encontrar la fila del encabezado real (debe contener CODIGO/SKU o ARTICULO/PRODUCTO)
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
      const rowStrings = (rawRows[r] || []).map(c => String(c || '').replace(/\r?\n/g, ' ').trim().toUpperCase());
      const hasCode = rowStrings.some(c => c === 'CODIGO' || c === 'CÓDIGO' || c === 'SKU' || c === 'COD');
      const hasArt = rowStrings.some(c => c.includes('ARTICULO') || c.includes('ARTÍCULO') || c.includes('PRODUCTO') || c.includes('DESCRIP') || c === 'NOMBRE');
      if (hasCode || hasArt) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
    }

    // Combinar encabezados desde la fila 0 hasta headerRowIdx para detectar tanto nombres de lista
    // ("Lista: GENERAL", "Lista: PRECIO 2", "Lista: PRECIO 3") como campos ("CODIGO", "ARTICULO", "VENTA")
    const maxCols = Math.max(...rawRows.slice(0, Math.min(rawRows.length, 6)).map(r => (r ? r.length : 0)));
    const header = [];
    for (let c = 0; c < maxCols; c++) {
      const parts = [];
      for (let r = 0; r <= headerRowIdx; r++) {
        const txt = String((rawRows[r] && rawRows[r][c]) || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
        if (txt && !parts.includes(txt)) {
          parts.push(txt);
        }
      }
      header.push(parts.join(' '));
    }

    // Mapear índices de columnas
    let colCodigo = -1;
    let colArticulo = -1;
    let colCodBarras = -1;
    let colP1 = -1;
    let colP2 = -1;
    let colP3 = -1;
    const colVentas = [];
    const colIvas = [];

    header.forEach((colName, idx) => {
      const norm = String(colName || '').trim().toUpperCase();
      if ((norm === 'CODIGO' || norm === 'CÓDIGO' || norm === 'SKU' || norm === 'COD' || norm.startsWith('CODIGO') || norm.startsWith('CÓDIGO')) && colCodigo === -1) {
        colCodigo = idx;
      } else if ((norm.includes('ARTICULO') || norm.includes('ARTÍCULO') || norm.includes('PRODUCTO') || norm.includes('DESCRIP') || norm === 'NOMBRE') && colArticulo === -1) {
        colArticulo = idx;
      } else if ((norm.includes('BARRAS') || norm.includes('BARCODE') || norm.includes('COD. BARRAS') || norm.includes('COD_BARRAS')) && colCodBarras === -1) {
        colCodBarras = idx;
      }

      if (norm.includes('IVA')) {
        colIvas.push(idx);
      }

      // Descartar explícitamente columnas auxiliares para no confundirlas con columnas de precio
      const esAux = norm.includes('IVA') ||
                    norm.includes('MIN') ||
                    norm.includes('R/C') ||
                    norm.includes('R/V') ||
                    norm.includes('INC') ||
                    norm.includes('COSTO') ||
                    norm.includes('CONTABLE') ||
                    norm.includes('PRINCIPAL') ||
                    norm.includes('BODEGA') ||
                    norm.includes('SALDO') ||
                    norm.includes('DCTO') ||
                    norm.includes('ACTIVO');
      if (esAux) return;

      // Columnas reales de precio de venta:
      if (norm === 'VENTA' || norm.startsWith('VENTA ') || norm.startsWith('VENTA(') || norm.includes('PRECIO') || norm.startsWith('LISTA')) {
        colVentas.push(idx);
        if ((norm.includes('GENERAL') || norm.includes('PRECIO 1') || norm.includes('PRECIO1') || norm.includes('LISTA 1')) && colP1 === -1) {
          colP1 = idx;
        } else if ((norm.includes('PRECIO 2') || norm.includes('PRECIO2') || norm.includes('LISTA 2') || norm.includes('VENTA 2')) && colP2 === -1) {
          colP2 = idx;
        } else if ((norm.includes('PRECIO 3') || norm.includes('PRECIO3') || norm.includes('LISTA 3') || norm.includes('VENTA 3')) && colP3 === -1) {
          colP3 = idx;
        }
      }
    });

    // Si no se asignaron listas específicas por nombre, asignar según orden de columnas de venta
    if (colP1 === -1 && colVentas.length > 0) colP1 = colVentas[0];
    if (colP2 === -1 && colVentas.length > 1) colP2 = colVentas[1];
    if (colP3 === -1 && colVentas.length > 2) colP3 = colVentas[2];

    console.log('[importar-precios] Fila cabecera:', headerRowIdx, 'Mapeo de columnas:', {
      colCodigo,
      colArticulo,
      colCodBarras,
      colP1,
      colP2,
      colP3,
      colVentas,
      colIvas
    });

    if (colP1 === -1 && colVentas.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        ok: false,
        error: 'No se encontraron columnas de precios ("VENTA", "GENERAL" o "PRECIO") en el archivo. Por favor verifica los encabezados.'
      });
    }

    // Consultas preparadas de búsqueda precisa
    const findBySku = db.prepare('SELECT id, sku, nombre, precio, precio_1, precio_2, precio_3, codigo_interno FROM productos WHERE UPPER(TRIM(sku)) = ?');
    const findByCodigoInterno = db.prepare('SELECT id, sku, nombre, precio, precio_1, precio_2, precio_3, codigo_interno FROM productos WHERE UPPER(TRIM(codigo_interno)) = ?');
    const findByBarcode = db.prepare('SELECT id, sku, nombre, precio, precio_1, precio_2, precio_3, codigo_interno FROM productos WHERE codigo_barras = ? OR codigo_caja = ?');
    const findByNombreExacto = db.prepare('SELECT id, sku, nombre, precio, precio_1, precio_2, precio_3, codigo_interno FROM productos WHERE UPPER(TRIM(nombre)) = ?');
    const findByNombreNormalizado = db.prepare(`
      SELECT id, sku, nombre, precio, precio_1, precio_2, precio_3, codigo_interno
      FROM productos
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(UPPER(nombre), ' ', ''), '-', ''), '.', ''), '/', '') = ?
      LIMIT 1
    `);

    const updatePrecios = db.prepare(`
      UPDATE productos
      SET precio = ?,
          precio_1 = ?,
          precio_2 = ?,
          precio_3 = ?,
          codigo_interno = CASE 
            WHEN (codigo_interno IS NULL OR codigo_interno = '') AND ? != '' THEN ? 
            ELSE codigo_interno 
          END,
          updated_at = datetime('now')
      WHERE id = ?
    `);

    let procesadas = 0;
    let actualizados = 0;
    let noEncontrados = 0;
    const detallesActualizados = [];
    const noEncontradosList = [];

    const tx = db.transaction(() => {
      for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const valCodigo = colCodigo !== -1 ? String(row[colCodigo] || '').trim() : '';
        const valArticulo = colArticulo !== -1 ? String(row[colArticulo] || '').trim() : '';
        const valCodBarras = colCodBarras !== -1 ? parseBarcode(row[colCodBarras]) : '';

        // Si la fila no tiene ni código ni artículo ni barcode, saltar
        if (!valCodigo && !valArticulo && !valCodBarras) continue;
        procesadas++;

        // Extraer los 3 precios de venta usando colP1, colP2, colP3
        const p1Raw = colP1 !== -1 ? row[colP1] : (colVentas[0] !== undefined ? row[colVentas[0]] : 0);
        const p2Raw = colP2 !== -1 ? row[colP2] : (colVentas[1] !== undefined ? row[colVentas[1]] : 0);
        const p3Raw = colP3 !== -1 ? row[colP3] : (colVentas[2] !== undefined ? row[colVentas[2]] : 0);

        const p1 = parsePrecio(p1Raw);
        const p2 = parsePrecio(p2Raw);
        const p3 = parsePrecio(p3Raw);

        // Búsqueda jerárquica segura (JAMÁS por columna ID externa)
        let prod = null;

        // 1. Por Nombre Exacto del Artículo (la correspondencia más fiel en listados ERP)
        if (valArticulo) {
          prod = findByNombreExacto.get(valArticulo.toUpperCase());
        }

        // 2. Por Nombre Normalizado (sin espacios ni puntuación)
        if (!prod && valArticulo) {
          const normArt = valArticulo.toUpperCase().replace(/[\s\.\-\/]/g, '');
          if (normArt.length >= 3) {
            prod = findByNombreNormalizado.get(normArt);
          }
        }

        // 3. Por Código / SKU
        if (!prod && valCodigo) {
          prod = findBySku.get(valCodigo.toUpperCase());
          if (!prod) {
            prod = findByCodigoInterno.get(valCodigo.toUpperCase());
          }
          // Si el código en la base fue guardado con prefijo 'P' (ej P210006 o P309)
          if (!prod && /^\d+$/.test(valCodigo)) {
            prod = findBySku.get('P' + valCodigo) || findBySku.get('P' + valCodigo.padStart(3, '0'));
          }
        }

        // 4. Por Código de Barras
        if (!prod && valCodBarras) {
          prod = findByBarcode.get(valCodBarras, valCodBarras);
          if (!prod && db.normalizarCodigoBarras) {
            const norm = db.normalizarCodigoBarras(valCodBarras);
            if (norm) prod = findByBarcode.get(norm, norm);
          }
        }

        if (prod) {
          // Asignación inteligente de precios
          const nuevoP1 = p1 > 0 ? p1 : (prod.precio_1 || prod.precio || 0);
          const nuevoP2 = p2 > 0 ? p2 : (nuevoP1);
          const nuevoP3 = p3 > 0 ? p3 : (nuevoP2);

          // Actualizar SOLO los precios y vincular codigo_interno si no lo tenía
          updatePrecios.run(nuevoP1, nuevoP1, nuevoP2, nuevoP3, valCodigo, valCodigo, prod.id);
          actualizados++;

          if (detallesActualizados.length < 50) {
            detallesActualizados.push({
              id: prod.id,
              sku: prod.sku,
              nombre: prod.nombre,
              precio_1_anterior: prod.precio_1 || prod.precio,
              precio_1_nuevo: nuevoP1,
              precio_2_nuevo: nuevoP2,
              precio_3_nuevo: nuevoP3
            });
          }
        } else {
          noEncontrados++;
          if (noEncontradosList.length < 20) {
            noEncontradosList.push({
              codigo: valCodigo,
              articulo: valArticulo,
              barcode: valCodBarras
            });
          }
        }
      }
    });

    tx();

    // Eliminar archivo temporal
    try { fs.unlinkSync(filePath); } catch (e) {}

    res.json({
      ok: true,
      mensaje: `Precios actualizados: ${actualizados} producto(s) modificado(s).`,
      stats: {
        filas_procesadas: procesadas,
        productos_actualizados: actualizados,
        no_encontrados: noEncontrados,
        columnas_precios_detectadas: colVentas.length
      },
      muestra_actualizados: detallesActualizados,
      muestra_no_encontrados: noEncontradosList
    });
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (e) {}
    console.error('Error al actualizar precios desde archivo:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
