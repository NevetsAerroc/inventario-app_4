const express = require('express');
const router = express.Router();
const db = require('../db/database');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });

// Middleware: superadmin, admin (dueño del local) o usuario con permiso 'usuarios'
router.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'Debes iniciar sesión' });
  }
  const esSuper = req.user.rol === 'superadmin';
  const esAdmin = req.user.rol === 'admin';
  const tienePermiso = Array.isArray(req.user.permisos) && req.user.permisos.includes('usuarios');

  if (!esSuper && !esAdmin && !tienePermiso) {
    return res.status(403).json({ ok: false, error: 'Acceso denegado. Se requiere rol de Administrador o Super Administrador.' });
  }
  next();
});

// GET /api/usuarios -> Listar todos los usuarios
router.get('/', (req, res) => {
  try {
    const usuarios = db.prepare(`
      SELECT u.id, u.username, u.nombre, u.rol, u.domiciliario_id, u.permisos, u.activo,
             u.created_at, u.ultimo_login,
             d.nombre as domiciliario_nombre, d.telefono as domiciliario_telefono
      FROM usuarios u
      LEFT JOIN domiciliarios d ON u.domiciliario_id = d.id
      ORDER BY u.id ASC
    `).all();

    const formateados = usuarios.map(u => {
      let permisos = [];
      try {
        permisos = typeof u.permisos === 'string' ? JSON.parse(u.permisos) : (u.permisos || []);
      } catch (e) {}
      return { ...u, permisos };
    });

    res.json({ ok: true, usuarios: formateados });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/usuarios -> Crear nuevo usuario
router.post('/', (req, res) => {
  try {
    const { username, password, nombre, rol, domiciliario_id, permisos } = req.body;

    if (!username || !password || !nombre) {
      return res.status(400).json({ ok: false, error: 'Usuario, contraseña y nombre completo son obligatorios' });
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ ok: false, error: 'El usuario debe tener al menos 3 caracteres' });
    }

    // Verificar si ya existe
    const existe = db.prepare("SELECT id FROM usuarios WHERE LOWER(username) = LOWER(?)").get(cleanUsername);
    if (existe) {
      return res.status(400).json({ ok: false, error: 'El nombre de usuario ya está registrado' });
    }

    // Solo el superadmin puede crear cuentas con rol superadmin
    let rolValido = rol;
    if (rolValido === 'superadmin' && req.user.rol !== 'superadmin') {
      return res.status(403).json({ ok: false, error: 'Solo el Super Administrador (Programador) puede crear otros superadministradores.' });
    }
    if (!['superadmin', 'admin', 'admin_domicilios', 'domiciliario', 'operador'].includes(rolValido)) {
      rolValido = 'operador';
    }
    if (rolValido === 'admin_domicilios') rolValido = 'admin';

    // Permisos por defecto según rol si no se envían
    let arrayPermisos = Array.isArray(permisos) ? permisos : [];
    if (!arrayPermisos.length) {
      if (rolValido === 'superadmin' || rolValido === 'admin') {
        arrayPermisos = ['carga', 'inventario', 'empaque', 'domicilios_todos', 'usuarios'];
      } else if (rolValido === 'domiciliario') {
        arrayPermisos = ['domicilios_en_curso'];
      } else {
        arrayPermisos = ['inventario', 'empaque'];
      }
    }

    let finalDomiId = domiciliario_id ? Number(domiciliario_id) : null;

    const passwordHash = db.hashPassword(password);

    const infoUser = db.prepare(`
      INSERT INTO usuarios (username, password_hash, nombre, rol, domiciliario_id, permisos, activo)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(
      cleanUsername,
      passwordHash,
      nombre.trim(),
      rolValido,
      finalDomiId,
      JSON.stringify(arrayPermisos)
    );

    // Sincronizar automáticamente el usuario como cliente en la base de datos
    try {
      db.prepare(`
        INSERT INTO clientes (nombre, empresa, direccion, telefono, ciudad)
        SELECT ?, '', '', '', ''
        WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)))
      `).run(nombre.trim(), nombre.trim());
    } catch (_) {}

    res.json({
      ok: true,
      id: infoUser.lastInsertRowid,
      mensaje: 'Usuario creado exitosamente'
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/usuarios/:id -> Actualizar usuario
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, rol, domiciliario_id, permisos, activo, password } = req.body;

    const userActual = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
    if (!userActual) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }

    // Regla de seguridad: Si el usuario objetivo es superadmin, solo superadmin puede modificarlo
    if (userActual.rol === 'superadmin' && req.user.rol !== 'superadmin') {
      return res.status(403).json({ ok: false, error: 'Solo el Super Administrador (Programador) puede modificar esta cuenta.' });
    }

    // Si intenta asignar rol superadmin, debe ser superadmin
    if (rol === 'superadmin' && req.user.rol !== 'superadmin') {
      return res.status(403).json({ ok: false, error: 'Solo el Super Administrador puede otorgar dicho rol.' });
    }

    // No permitir que el usuario se desactive a sí mismo
    if (userActual.id === req.user.id && activo === 0) {
      return res.status(400).json({ ok: false, error: 'No puedes desactivar tu propia cuenta' });
    }

    const sets = [];
    const vals = [];

    if (nombre) { sets.push('nombre = ?'); vals.push(nombre.trim()); }
    if (rol && ['superadmin', 'admin', 'admin_domicilios', 'domiciliario', 'operador'].includes(rol)) {
      const rolNormalizado = rol === 'admin_domicilios' ? 'admin' : rol;
      sets.push('rol = ?'); vals.push(rolNormalizado);
    }
    if (domiciliario_id !== undefined) {
      sets.push('domiciliario_id = ?'); vals.push(domiciliario_id ? Number(domiciliario_id) : null);
    }
    if (permisos !== undefined) {
      sets.push('permisos = ?'); vals.push(JSON.stringify(Array.isArray(permisos) ? permisos : []));
    }
    if (activo !== undefined) {
      sets.push('activo = ?'); vals.push(Number(activo));
    }
    if (password && String(password).trim().length > 0) {
      sets.push('password_hash = ?'); vals.push(db.hashPassword(String(password).trim()));
    }

    if (sets.length > 0) {
      vals.push(id);
      db.prepare(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

      // Si cambió el nombre, sincronizar en clientes
      if (nombre && nombre.trim()) {
        try {
          db.prepare(`
            INSERT INTO clientes (nombre, empresa, direccion, telefono, ciudad)
            SELECT ?, '', '', '', ''
            WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)))
          `).run(nombre.trim(), nombre.trim());
        } catch (_) {}
      }
    }

    res.json({ ok: true, mensaje: 'Usuario actualizado exitosamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/usuarios/importar -> Importación masiva de usuarios y clientes desde Excel
// ------------------------------------------------------------------
router.post('/importar', upload.single('archivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No se subió ningún archivo' });
  }

  const filePath = req.file.path;
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let creados = 0;
    let actualizados = 0;

    const stmtFind = db.prepare("SELECT id FROM usuarios WHERE LOWER(username) = LOWER(?) OR LOWER(nombre) = LOWER(?) LIMIT 1");
    const stmtInsertUser = db.prepare(`
      INSERT INTO usuarios (username, password_hash, nombre, rol, activo, permisos)
      VALUES (?, ?, ?, ?, 1, ?)
    `);
    const stmtUpdateUser = db.prepare("UPDATE usuarios SET nombre = ?, rol = ? WHERE id = ?");
    
    const stmtFindCliente = db.prepare("SELECT id FROM clientes WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) OR (telefono = ? AND telefono != '') LIMIT 1");
    const stmtInsertCliente = db.prepare("INSERT INTO clientes (nombre, empresa, direccion, telefono, ciudad) VALUES (?, ?, ?, ?, ?)");
    const stmtUpdateCliente = db.prepare("UPDATE clientes SET nombre = ?, empresa = ?, direccion = ?, telefono = ?, ciudad = ? WHERE id = ?");

    const hashDefecto = db.hashPassword('123456');

    const tx = db.transaction((filas) => {
      for (const row of filas) {
        const nombre = String(row.nombre || row.Nombre || row.CLIENTE || row.Cliente || row.usuario || row.Usuario || '').trim();
        if (!nombre) continue;

        let username = String(row.username || row.Username || row.usuario || row.Usuario || nombre.toLowerCase().replace(/[^a-z0-9]/g, '')).trim();
        if (username.length < 3) username = username + '_' + Math.floor(Math.random() * 1000);

        const rol = ['admin', 'domiciliario', 'operador'].includes(row.rol) ? row.rol : 'operador';
        const telefono = String(row.telefono || row.Telefono || row.celular || '').trim();
        const direccion = String(row.direccion || row.Direccion || '').trim();
        const ciudad = String(row.ciudad || row.Ciudad || '').trim();
        const empresa = String(row.empresa || row.Empresa || '').trim();

        // 1. Sincronizar en usuarios
        const existUser = stmtFind.get(username, nombre);
        if (existUser) {
          stmtUpdateUser.run(nombre, rol, existUser.id);
          actualizados++;
        } else {
          stmtInsertUser.run(username, hashDefecto, nombre, rol, JSON.stringify(['inventario', 'empaque']));
          creados++;
        }

        // 2. Sincronizar en clientes
        const existCli = stmtFindCliente.get(nombre, telefono);
        if (existCli) {
          stmtUpdateCliente.run(nombre, empresa, direccion, telefono, ciudad, existCli.id);
        } else {
          stmtInsertCliente.run(nombre, empresa, direccion, telefono, ciudad);
        }
      }
    });

    tx(rows);
    try { fs.unlinkSync(filePath); } catch (_) {}

    res.json({
      ok: true,
      mensaje: `Importación completada: ${creados} nuevos, ${actualizados} actualizados.`,
      resumen: { creados, actualizados, totalProcesados: rows.length }
    });
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (_) {}
    res.status(500).json({ ok: false, error: 'Error al importar: ' + err.message });
  }
});

// POST /api/usuarios/:id/toggle -> Activar / Desactivar usuario
router.post('/:id/toggle', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ ok: false, error: 'No puedes desactivar tu propia cuenta' });
    }

    const user = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
    if (!user) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

    // No se puede desactivar al superadmin salvo que seas superadmin
    if (user.rol === 'superadmin' && req.user.rol !== 'superadmin') {
      return res.status(403).json({ ok: false, error: 'No tienes permiso para modificar la cuenta del Programador.' });
    }

    const nuevoEstado = user.activo === 1 ? 0 : 1;
    db.prepare("UPDATE usuarios SET activo = ? WHERE id = ?").run(nuevoEstado, id);

    // Si se desactiva, cerrar todas sus sesiones activas
    if (nuevoEstado === 0) {
      db.prepare("DELETE FROM sesiones WHERE usuario_id = ?").run(id);
    }

    res.json({ ok: true, activo: nuevoEstado });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/usuarios/:id -> Eliminar usuario
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ ok: false, error: 'No puedes eliminar tu propia cuenta' });
    }

    const user = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
    if (!user) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

    if (user.rol === 'superadmin') {
      return res.status(403).json({ ok: false, error: 'No se puede eliminar la cuenta de Super Administrador (Programador).' });
    }

    db.prepare("DELETE FROM sesiones WHERE usuario_id = ?").run(id);
    db.prepare("DELETE FROM usuarios WHERE id = ?").run(id);

    res.json({ ok: true, mensaje: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
