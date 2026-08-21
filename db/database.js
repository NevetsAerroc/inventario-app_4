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

module.exports = db;
