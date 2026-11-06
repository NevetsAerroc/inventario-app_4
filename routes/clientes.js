const express = require('express');
const router = express.Router();
const db = require('../db/database');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });

// Asegurar que la columna 'direccion' exista en la tabla clientes
try {
  db.prepare("ALTER TABLE clientes ADD COLUMN direccion TEXT").run();
} catch (e) {
  // La columna ya existe, ignorar error
}

// ------------------------------------------------------------------
// GET /api/clientes -> Listar clientes con búsqueda opcional
// ------------------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let clientes;
    if (q) {
      clientes = db.prepare(`
        SELECT id, nombre, empresa, direccion, telefono, ciudad, created_at
        FROM clientes
        WHERE nombre LIKE ? OR empresa LIKE ? OR ciudad LIKE ? OR direccion LIKE ? OR telefono LIKE ?
        ORDER BY nombre ASC
        LIMIT 300
      `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    } else {
      clientes = db.prepare(`
        SELECT id, nombre, empresa, direccion, telefono, ciudad, created_at
        FROM clientes
        ORDER BY id DESC
        LIMIT 300
      `).all();
    }

    const total = db.prepare('SELECT COUNT(*) as c FROM clientes').get()?.c || 0;
    res.json({ ok: true, data: clientes, total });
  } catch (err) {
    console.error('Error al listar clientes:', err);
    res.status(500).json({ ok: false, error: 'Error al consultar clientes.' });
  }
});

// ------------------------------------------------------------------
// GET /api/clientes/exportar -> Descarga la lista completa de clientes en .xlsx
// ------------------------------------------------------------------
router.get('/exportar', (req, res) => {
  try {
    const clientes = db.prepare(`
      SELECT id, nombre, empresa, direccion, telefono, ciudad 
      FROM clientes 
      ORDER BY id ASC
    `).all();
    
    const worksheet = XLSX.utils.json_to_sheet(clientes);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=base_clientes.xlsx');
    res.send(buffer);
  } catch (err) {
    console.error('Error al exportar clientes:', err);
    res.status(500).json({ ok: false, error: 'Error al generar el archivo Excel.' });
  }
});

// ------------------------------------------------------------------
// POST /api/clientes/importar -> Actualiza o inserta clientes de forma masiva
// ------------------------------------------------------------------
router.post('/importar', upload.single('archivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No se subió ningún archivo.' });
  }

  const filePath = req.file.path;

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let actualizados = 0;
    let creados = 0;

    const stmtUpdate = db.prepare(`
      UPDATE clientes 
      SET nombre = ?, empresa = ?, direccion = ?, telefono = ?, ciudad = ? 
      WHERE id = ?
    `);

    const stmtInsert = db.prepare(`
      INSERT INTO clientes (nombre, empresa, direccion, telefono, ciudad) 
      VALUES (?, ?, ?, ?, ?)
    `);

    const stmtFindPhone = db.prepare(`
      SELECT id FROM clientes WHERE telefono = ? AND telefono != '' LIMIT 1
    `);

    const transaction = db.transaction((filas) => {
      for (const row of filas) {
        const id = row.id || row.ID || row.Id || null;
        const nombre = String(row.nombre || row.Nombre || row.CLIENTE || row.Cliente || '').trim();
        const empresa = String(row.empresa || row.Empresa || row.EMPRESA || row.Negocio || '').trim();
        const direccion = String(row.direccion || row.Direccion || row.Dirección || row.DIRECCION || '').trim();
        const telefono = String(row.telefono || row.Telefono || row.Teléfono || row.TELEFONO || row.Celular || row.celular || '').trim();
        const ciudad = String(row.ciudad || row.Ciudad || row.CIUDAD || '').trim();

        if (!nombre) continue; // Nombre obligatorio

        if (id) {
          const resUpdate = stmtUpdate.run(nombre, empresa, direccion, telefono, ciudad, id);
          if (resUpdate.changes > 0) {
            actualizados++;
          } else {
            stmtInsert.run(nombre, empresa, direccion, telefono, ciudad);
            creados++;
          }
        } else {
          // Si no tiene ID pero sí teléfono, buscar si ya existe para actualizarlo
          const existTel = telefono ? stmtFindPhone.get(telefono) : null;
          if (existTel) {
            stmtUpdate.run(nombre, empresa, direccion, telefono, ciudad, existTel.id);
            actualizados++;
          } else {
            stmtInsert.run(nombre, empresa, direccion, telefono, ciudad);
            creados++;
          }
        }
      }
    });

    transaction(rows);

    try { fs.unlinkSync(filePath); } catch (e) {}

    res.json({
      ok: true,
      mensaje: `Proceso completado: ${creados} clientes nuevos, ${actualizados} actualizados.`,
      resumen: { creados, actualizados, totalProcesados: rows.length }
    });
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (e) {}
    console.error('Error al importar clientes:', err);
    res.status(500).json({ ok: false, error: 'Error al procesar la lista de clientes: ' + err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/clientes/sugerencias?q=texto -> Autocompletado rápido
// ------------------------------------------------------------------
router.get('/sugerencias', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ ok: true, data: [] });

  const clientes = db.prepare(`
    SELECT * FROM clientes
    WHERE nombre LIKE ? OR empresa LIKE ? OR ciudad LIKE ? OR direccion LIKE ? OR telefono LIKE ?
    ORDER BY nombre ASC LIMIT 10
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  res.json({ ok: true, data: clientes });
});

// ------------------------------------------------------------------
// GET /api/clientes/:id -> Obtener un cliente específico
// ------------------------------------------------------------------
router.get('/:id', (req, res) => {
  try {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente no encontrado.' });
    res.json({ ok: true, data: cliente });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/clientes -> Crear un cliente nuevo
// ------------------------------------------------------------------
router.post('/', (req, res) => {
  const { nombre, telefono, empresa, ciudad, direccion } = req.body;
  const nombreLimpio = String(nombre || '').trim();

  if (!nombreLimpio) {
    return res.status(400).json({ ok: false, error: 'El nombre del cliente es obligatorio.' });
  }

  const info = db.prepare(`
    INSERT INTO clientes (nombre, telefono, empresa, ciudad, direccion)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    nombreLimpio,
    (telefono || '').trim(),
    (empresa || '').trim(),
    (ciudad || '').trim(),
    (direccion || '').trim()
  );

  const creado = db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ok: true, data: creado, mensaje: `Cliente "${nombreLimpio}" creado con éxito.` });
});

// ------------------------------------------------------------------
// PUT /api/clientes/:id -> Editar cliente existente
// ------------------------------------------------------------------
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, empresa, ciudad, direccion } = req.body;
    const nombreLimpio = String(nombre || '').trim();

    if (!nombreLimpio) {
      return res.status(400).json({ ok: false, error: 'El nombre del cliente es obligatorio.' });
    }

    const clienteActual = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    if (!clienteActual) {
      return res.status(404).json({ ok: false, error: 'Cliente no encontrado.' });
    }

    db.prepare(`
      UPDATE clientes
      SET nombre = ?, telefono = ?, empresa = ?, ciudad = ?, direccion = ?
      WHERE id = ?
    `).run(
      nombreLimpio,
      (telefono || '').trim(),
      (empresa || '').trim(),
      (ciudad || '').trim(),
      (direccion || '').trim(),
      id
    );

    const actualizado = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    res.json({ ok: true, data: actualizado, mensaje: `Cliente "${nombreLimpio}" actualizado correctamente.` });
  } catch (err) {
    console.error('Error al actualizar cliente:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// DELETE /api/clientes/:id -> Eliminar cliente
// ------------------------------------------------------------------
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const info = db.prepare('DELETE FROM clientes WHERE id = ?').run(id);
    if (info.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Cliente no encontrado.' });
    }
    res.json({ ok: true, mensaje: 'Cliente eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar cliente:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;