const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/database');

/**
 * Middleware para extraer y validar la sesión activa
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const sesion = db.prepare(`
      SELECT s.token, u.id, u.username, u.nombre, u.rol, u.domiciliario_id, u.permisos, u.activo,
             d.nombre as domiciliario_nombre, d.telefono as domiciliario_telefono
      FROM sesiones s
      JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN domiciliarios d ON u.domiciliario_id = d.id
      WHERE s.token = ? AND u.activo = 1
    `).get(token);

    if (sesion) {
      let permisos = [];
      try {
        permisos = typeof sesion.permisos === 'string' ? JSON.parse(sesion.permisos) : (sesion.permisos || []);
      } catch (e) {
        permisos = [];
      }

      req.user = {
        id: sesion.id,
        username: sesion.username,
        nombre: sesion.nombre,
        rol: sesion.rol,
        domiciliario_id: sesion.domiciliario_id,
        domiciliario_nombre: sesion.domiciliario_nombre,
        permisos
      };
      req.token = token;
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }

  next();
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Ingresa usuario y contraseña' });
    }

    const user = db.prepare(`
      SELECT u.*, d.nombre as domiciliario_nombre
      FROM usuarios u
      LEFT JOIN domiciliarios d ON u.domiciliario_id = d.id
      WHERE LOWER(u.username) = LOWER(?)
    `).get(username.trim());

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
    }

    if (user.activo !== 1) {
      return res.status(403).json({ ok: false, error: 'Este usuario se encuentra inactivo. Contacta al administrador.' });
    }

    const passwordValida = db.verifyPassword(password, user.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
    }

    // Generar token único de sesión
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(`
      INSERT INTO sesiones (token, usuario_id, expires_at)
      VALUES (?, ?, datetime('now', '+30 days'))
    `).run(token, user.id);

    // Actualizar último login
    try {
      db.prepare(`UPDATE usuarios SET ultimo_login = datetime('now', 'localtime') WHERE id = ?`).run(user.id);
    } catch (e) {}

    let permisos = [];
    try {
      permisos = typeof user.permisos === 'string' ? JSON.parse(user.permisos) : (user.permisos || []);
    } catch (e) {}

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
        domiciliario_id: user.domiciliario_id,
        domiciliario_nombre: user.domiciliario_nombre,
        permisos
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }
  res.json({ ok: true, user: req.user });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  try {
    if (req.token) {
      db.prepare("DELETE FROM sesiones WHERE token = ?").run(req.token);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/auth/me/password
router.put('/me/password', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'No autenticado' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Faltan datos' });
    }

    const user = db.prepare('SELECT password_hash FROM usuarios WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }

    if (!db.verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ ok: false, error: 'La contraseña actual es incorrecta' });
    }

    const hash = db.hashPassword(newPassword);
    db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, req.user.id);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = {
  router,
  authMiddleware
};
