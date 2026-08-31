
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ dest: 'uploads/' });

// GET /api/clientes/exportar -> Descarga la lista completa de clientes en .xlsx
router.get('/exportar', (req, res) => {
  try {
    const clientes = db.prepare('SELECT id, nombre, empresa, direccion, telefono, ciudad FROM clientes ORDER BY id ASC').all();
    
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

// POST /api/clientes/importar -> Actualiza o inserta clientes de forma masiva
router.post('/importar', upload.single('archivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No se subió ningún archivo.' });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
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

    const transaction = db.transaction((filas) => {
      for (const row of filas) {
        const id = row.id || row.ID || null;
        const nombre = String(row.nombre || row.Nombre || '').trim();
        const empresa = String(row.empresa || row.Empresa || '').trim();
        const direccion = String(row.direccion || row.Direccion || row.Dirección || '').trim();
        const telefono = String(row.telefono || row.Telefono || row.Teléfono || '').trim();
        const ciudad = String(row.ciudad || row.Ciudad || '').trim();

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
          stmtInsert.run(nombre, empresa, direccion, telefono, ciudad);
          creados++;
        }
      }
    });

    transaction(rows);

    res.json({
      ok: true,
      resumen: { creados, actualizados, totalProcesados: rows.length }
    });
  } catch (err) {
    console.error('Error al importar clientes:', err);
    res.status(500).json({ ok: false, error: 'Error al procesar la lista de clientes.' });
  }
});
// Asegurar que la columna 'direccion' exista en la tabla clientes
try {
  db.prepare("ALTER TABLE clientes ADD COLUMN direccion TEXT").run();
} catch (e) {
  // La columna ya existe, ignorar error
}

// GET /api/clientes/sugerencias?q=texto
router.get('/sugerencias', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ ok: true, data: [] });

  const clientes = db.prepare(`
    SELECT * FROM clientes
    WHERE nombre LIKE ? OR empresa LIKE ? OR ciudad LIKE ? OR direccion LIKE ?
    ORDER BY nombre ASC LIMIT 8
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  res.json({ ok: true, data: clientes });
});

// POST /api/clientes -> Crear un cliente nuevo
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
  res.status(201).json({ ok: true, data: creado });
});

module.exports = router;