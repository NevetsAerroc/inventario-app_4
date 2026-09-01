//const db = require('./db');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'inventario.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ejecuta el esquema al iniciar (CREATE TABLE IF NOT EXISTS es idempotente)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// ------------------------------------------------------------------
// Migraciones ligeras: agregan columnas nuevas a bases de datos que ya
// existian antes de que esa columna se incluyera en schema.sql. Seguro
// de correr multiples veces (verifica antes de alterar).
// ------------------------------------------------------------------
function agregarColumnaSiNoExiste(tabla, columna, definicion) {
  const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all();
  const existe = columnas.some(c => c.name === columna);
  if (!existe) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    console.log(`[migracion] Columna "${columna}" agregada a "${tabla}".`);
  }
}

agregarColumnaSiNoExiste('productos', 'ubicacion', "TEXT DEFAULT ''");
agregarColumnaSiNoExiste('productos', 'subcategoria', "TEXT DEFAULT ''");
agregarColumnaSiNoExiste('productos', 'codigo_caja', "TEXT");
agregarColumnaSiNoExiste('productos', 'unidades_por_caja', "INTEGER NOT NULL DEFAULT 1");

// ==========================================
// MIGRACIONES MÓDULO D (DOMICILIOS)
// ==========================================
agregarColumnaSiNoExiste('pedidos', 'cliente_id', 'INTEGER');
agregarColumnaSiNoExiste('pedidos', 'telefono', "TEXT DEFAULT ''");
agregarColumnaSiNoExiste('pedidos', 'direccion', "TEXT DEFAULT ''");
agregarColumnaSiNoExiste('pedidos', 'total', 'REAL DEFAULT 0');
agregarColumnaSiNoExiste('pedidos', 'observacion', "TEXT DEFAULT ''");
agregarColumnaSiNoExiste('pedidos', 'tipo_entrega', "TEXT DEFAULT 'TIENDA'");
agregarColumnaSiNoExiste('pedidos', 'estado_liquidacion', "TEXT DEFAULT 'PENDIENTE'");
agregarColumnaSiNoExiste('pedidos', 'ruta_id', 'INTEGER');
agregarColumnaSiNoExiste('pedidos', 'metodo_pago_final', 'TEXT');
agregarColumnaSiNoExiste('pedidos', 'comprobante_transf', 'TEXT');
agregarColumnaSiNoExiste('pedidos', 'monto_efectivo_recibido', 'REAL DEFAULT 0');
agregarColumnaSiNoExiste('pedidos', 'devuelta_calculada', 'REAL DEFAULT 0');
agregarColumnaSiNoExiste('pedidos', 'observacion', "TEXT DEFAULT ''");
agregarColumnaSiNoExiste('pedidos', 'municipio', "TEXT DEFAULT ''");
agregarColumnaSiNoExiste('pedidos', 'tipo_entrega', "TEXT DEFAULT 'TIENDA'");
agregarColumnaSiNoExiste('pedidos', 'estado_liquidacion', "TEXT DEFAULT 'PENDIENTE'");
agregarColumnaSiNoExiste('pedidos', 'estado_entrega', "TEXT DEFAULT 'PENDIENTE'");
agregarColumnaSiNoExiste('pedidos', 'total_original', 'REAL');
agregarColumnaSiNoExiste('pedidos', 'devuelta_calculada', 'REAL DEFAULT 0');
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_pedidos_telefono ON pedidos(telefono);
  CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente);
  CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
`);

// ==========================================
// MIGRACIONES MÓDULO D: RUTAS Y DOMICILIOS
// ==========================================
db.exec(`
  CREATE TABLE IF NOT EXISTS domiciliarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    activo INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS rutas_domicilio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domiciliario_id INTEGER,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado TEXT DEFAULT 'EN_RUTA', -- EN_RUTA, LIQUIDADA
    base_efectivo REAL DEFAULT 0,
    total_recolectado REAL DEFAULT 0,
    fecha_liquidacion DATETIME,
    FOREIGN KEY (domiciliario_id) REFERENCES domiciliarios(id)
  );
`);

agregarColumnaSiNoExiste('pedidos', 'ruta_id', 'INTEGER');
agregarColumnaSiNoExiste('pedidos', 'monto_efectivo_recibido', 'REAL DEFAULT 0');
agregarColumnaSiNoExiste('pedidos', 'devuelta_calculada', 'REAL DEFAULT 0');
agregarColumnaSiNoExiste('pedidos', 'comprobante_transf', 'TEXT');

// ------------------------------------------------------------------
// Función compartida de normalización de códigos de barras (GS1 / AIM / DUN-14)
// ------------------------------------------------------------------
function normalizarCodigoBarras(raw) {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t) return null;
  t = t.replace(/[\x00-\x1F\x7F\uFFFD]/g, '');
  t = t.replace(/^(\]C1|\]C0|\[c1|\[C1|\][a-zA-Z][0-9a-zA-Z])/i, '');
  t = t.replace(/[\s\[\]]+/g, '');
  const matchAI = t.match(/\(0?1\)\s*(\d{12,14})/);
  if (matchAI) return matchAI[1];
  if (/^01\d{14}/.test(t)) return t.slice(2, 16);
  if (t.length === 16 && t.startsWith('01')) return t.slice(2);
  return t;
}

// Sanitizar registros que hayan quedado con prefijos AIM o GS1 antes de la corrección
try {
  const prods = db.prepare("SELECT id, codigo_barras, codigo_caja FROM productos WHERE codigo_barras LIKE '%]C%' OR codigo_caja LIKE '%]C%' OR codigo_barras LIKE '%(01)%' OR codigo_caja LIKE '%(01)%'").all();
  if (prods.length > 0) {
    const updateStmt = db.prepare("UPDATE productos SET codigo_barras = ?, codigo_caja = ? WHERE id = ?");
    const tx = db.transaction(() => {
      prods.forEach(p => {
        const cb = normalizarCodigoBarras(p.codigo_barras);
        const cc = normalizarCodigoBarras(p.codigo_caja);
        updateStmt.run(cb, cc, p.id);
      });
    });
    tx();
    console.log(`[migracion] ${prods.length} códigos de barras normalizados en la base de datos.`);
  }
} catch (e) {
  console.error('[migracion] Error al normalizar códigos en BD:', e);
}

db.normalizarCodigoBarras = normalizarCodigoBarras;

/** Resta stock de los ítems de un pedido (llamar dentro de una transacción). */
db.descontarStockDePedido = function descontarStockDePedido(pedidoId, motivo) {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
  if (!pedido) throw new Error('Pedido no encontrado');

  const items = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ?').all(pedidoId);
  const getPorId = db.prepare('SELECT * FROM productos WHERE id = ?');
  const getPorSku = db.prepare('SELECT * FROM productos WHERE sku = ?');
  const updateStock = db.prepare("UPDATE productos SET stock = ?, updated_at = datetime('now') WHERE id = ?");
  const insertMov = db.prepare(`
    INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo, pedido_id)
    VALUES (?, 'empaque', ?, ?, ?, ?)
  `);
  const vincularItem = db.prepare('UPDATE detalle_pedidos SET producto_id = ? WHERE id = ? AND producto_id IS NULL');

  items.forEach((item) => {
    let producto = item.producto_id ? getPorId.get(item.producto_id) : null;
    if (!producto && item.sku) producto = getPorSku.get(item.sku);
    if (!producto) return;
    if (!item.producto_id) vincularItem.run(producto.id, item.id);

    const cant = Number(item.cantidad_empacada || item.cantidad_solicitada || 0);
    if (cant <= 0) return;
    const nuevoStock = Math.max(0, producto.stock - cant);
    updateStock.run(nuevoStock, producto.id);
    insertMov.run(
      producto.id,
      cant,
      nuevoStock,
      motivo || `Empaque pedido ${pedido.codigo_pedido}`,
      pedidoId
    );
  });
};

db.totalPedidoDesdeItems = function totalPedidoDesdeItems(pedidoId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(d.cantidad_empacada * COALESCE(p.precio, 0)), 0) AS total
    FROM detalle_pedidos d
    LEFT JOIN productos p ON p.id = d.producto_id OR (d.producto_id IS NULL AND p.sku = d.sku)
    WHERE d.pedido_id = ?
  `).get(pedidoId);
  return row ? Number(row.total) || 0 : 0;
};

module.exports = db;
