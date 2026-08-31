-- ============================================================
-- Esquema de Base de Datos - Inventario / Pick & Pack
-- SQLite
-- ============================================================

CREATE TABLE IF NOT EXISTS productos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sku             TEXT NOT NULL UNIQUE,
    nombre          TEXT NOT NULL,
    categoria       TEXT DEFAULT '',
    stock           INTEGER NOT NULL DEFAULT 0,
    precio          REAL NOT NULL DEFAULT 0,
    codigo_barras   TEXT UNIQUE,               -- NULL hasta que se vincule con la camara
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku);
CREATE INDEX IF NOT EXISTS idx_productos_barcode ON productos(codigo_barras);

-- Historial de movimientos de stock (entradas / salidas / ajustes / empaque)
CREATE TABLE IF NOT EXISTS movimientos_stock (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id     INTEGER NOT NULL REFERENCES productos(id),
    tipo            TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste','empaque')),
    cantidad        INTEGER NOT NULL,
    stock_resultante INTEGER NOT NULL,
    motivo          TEXT DEFAULT '',
    pedido_id       INTEGER,                   -- si el movimiento proviene de un pedido empacado
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedidos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER REFERENCES clientes(id),
    codigo_pedido   TEXT NOT NULL UNIQUE,
    cliente         TEXT DEFAULT '',
    estado          TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','EN_PROCESO','EMPACADO')),
    fecha_creacion  TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_cierre    TEXT
);

CREATE TABLE IF NOT EXISTS detalle_pedidos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id           INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id         INTEGER REFERENCES productos(id),
    sku                 TEXT NOT NULL,
    nombre_producto     TEXT NOT NULL,
    cantidad_solicitada INTEGER NOT NULL,
    cantidad_empacada   INTEGER NOT NULL DEFAULT 0,
    verificado          INTEGER NOT NULL DEFAULT 0  -- 0/1, se marca cuando cantidad_empacada >= cantidad_solicitada
);

CREATE INDEX IF NOT EXISTS idx_detalle_pedido_id ON detalle_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_detalle_sku ON detalle_pedidos(sku);

CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    empresa TEXT,
    ciudad TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

