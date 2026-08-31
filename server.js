const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const https = require('https');
const db = require('./db/database'); // <-- Apunta a database.js

const productosRouter = require('./routes/productos');
const pedidosRouter = require('./routes/pedidos');
const clientesRouter = require('./routes/clientes');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const CERT_DIR = path.join(__dirname, 'certs');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// API Base
app.use('/api/productos', productosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/clientes', clientesRouter);
app.get('/api/health', (req, res) => res.json({ ok: true, status: 'up', time: new Date().toISOString() }));

// ==========================================
// RUTAS MÓDULO D: DOMICILIOS & LIQUIDACIÓN
// ==========================================

app.get('/api/domiciliarios', (req, res) => {
  try {
    res.json({ ok: true, domiciliarios: db.prepare("SELECT * FROM domiciliarios WHERE activo = 1").all() });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.post('/api/domiciliarios', (req, res) => {
  try {
    const info = db.prepare("INSERT INTO domiciliarios (nombre, telefono) VALUES (?, ?)").run(req.body.nombre, req.body.telefono || '');
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.get('/api/domicilios/pendientes', (req, res) => {
  try {
    const pedidos = db.prepare(`
      SELECT * FROM pedidos
      WHERE estado = 'EMPACADO'
        AND (ruta_id IS NULL OR ruta_id = 0 OR ruta_id = '')
        AND (COALESCE(estado_liquidacion, 'PENDIENTE') = 'PENDIENTE' OR estado_liquidacion = '')
      ORDER BY id DESC
    `).all();
    res.json({ ok: true, pedidos });
  } catch (err) { 
    res.status(500).json({ ok: false, error: err.message }); 
  }
});

app.post('/api/rutas/despachar', (req, res) => {
  try {
    const { domiciliarioId, pedidos, pedidoIds, baseEfectivo } = req.body;

    // Acepta formato nuevo (array de objetos) o el viejo (solo ids)
    let lista = [];
    if (Array.isArray(pedidos) && pedidos.length > 0) {
      lista = pedidos;
    } else if (Array.isArray(pedidoIds) && pedidoIds.length > 0) {
      lista = pedidoIds.map(id => ({ id, metodoPago: 'EFECTIVO' }));
    }

    if (!lista.length) {
      return res.status(400).json({ ok: false, error: 'Debes seleccionar al menos un pedido' });
    }

    const tx = db.transaction(() => {
      const domiciliario = db.prepare('SELECT id FROM domiciliarios WHERE id = ? AND activo = 1').get(domiciliarioId);
      if (!domiciliario) throw new Error('Domiciliario no válido');

      const getPedido = db.prepare('SELECT * FROM pedidos WHERE id = ?');
      for (const item of lista) {
        const pedido = getPedido.get(item.id);
        if (!pedido) throw new Error(`Pedido ${item.id} no encontrado`);
        if (pedido.estado !== 'EMPACADO') {
          throw new Error(`El pedido ${pedido.codigo_pedido} aún no está empacado`);
        }
        if (pedido.ruta_id && Number(pedido.ruta_id) !== 0) {
          throw new Error(`El pedido ${pedido.codigo_pedido} ya está en una ruta`);
        }
      }

      const infoRuta = db.prepare(
        "INSERT INTO rutas_domicilio (domiciliario_id, base_efectivo, estado) VALUES (?, ?, 'EN_RUTA')"
      ).run(domiciliarioId, baseEfectivo || 0);

      const updatePedido = db.prepare(`
        UPDATE pedidos 
        SET ruta_id = ?, 
            tipo_entrega = 'DOMICILIO', 
            estado_liquidacion = 'EN_RUTA',
            metodo_pago_final = ?
        WHERE id = ?
      `);

      for (const item of lista) {
        updatePedido.run(
          infoRuta.lastInsertRowid,
          item.metodoPago || 'EFECTIVO',
          item.id
        );
      }
      return infoRuta.lastInsertRowid;
    });

    res.json({ ok: true, rutaId: tx() });
  } catch (err) {
    const msg = err.message || 'Error al despachar';
    const status = /no válido|no encontrado|aún no está|ya está en una ruta/i.test(msg) ? 400 : 500;
    res.status(status).json({ ok: false, error: msg });
  }
});

app.get('/api/rutas', (req, res) => {
  try {
    const estado = req.query.estado || 'EN_RUTA';
    const rutas = db.prepare(`
      SELECT r.*, d.nombre as domiciliario_nombre,
             (SELECT COUNT(*) FROM pedidos p WHERE p.ruta_id = r.id) as cantidad_pedidos,
             (SELECT SUM(total) FROM pedidos p WHERE p.ruta_id = r.id) as total_dinero
      FROM rutas_domicilio r
      LEFT JOIN domiciliarios d ON r.domiciliario_id = d.id
      WHERE r.estado = ?
      ORDER BY r.fecha_creacion DESC
    `).all(estado);
    res.json({ ok: true, rutas });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.get('/api/rutas/:id', (req, res) => {
  try {
    const ruta = db.prepare("SELECT r.*, d.nombre as domiciliario_nombre FROM rutas_domicilio r LEFT JOIN domiciliarios d ON r.domiciliario_id = d.id WHERE r.id = ?").get(req.params.id);
    const pedidos = db.prepare("SELECT * FROM pedidos WHERE ruta_id = ?").all(req.params.id);
    res.json({ ok: true, ruta, pedidos });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Actualizar un pedido mientras la ruta está en curso (precio, método, entrega)
app.put('/api/rutas/pedido/:id', (req, res) => {
  try {
    const { total, metodoPago, estadoEntrega, comprobante } = req.body;
    const id = req.params.id;

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    if (!pedido) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
    if (pedido.estado_liquidacion === 'LIQUIDADO') {
      return res.status(400).json({ ok: false, error: 'El pedido ya está liquidado' });
    }

    db.prepare(`
      UPDATE pedidos SET
        total = COALESCE(?, total),
        metodo_pago_final = COALESCE(?, metodo_pago_final),
        estado_entrega = COALESCE(?, estado_entrega),
        comprobante_transf = COALESCE(?, comprobante_transf)
      WHERE id = ?
    `).run(
      total != null ? total : null,
      metodoPago || null,
      estadoEntrega || null,
      comprobante != null ? comprobante : null,
      id
    );

    const actualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    res.json({ ok: true, pedido: actualizado });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/rutas/liquidar', (req, res) => {
  try {
    const { rutaId, pedidosLiquidacion, totalEfectivoEntregado } = req.body;
    if (!rutaId) return res.status(400).json({ ok: false, error: 'rutaId es requerido' });

    const tx = db.transaction(() => {
      const ruta = db.prepare('SELECT * FROM rutas_domicilio WHERE id = ?').get(rutaId);
      if (!ruta) throw new Error('Ruta no encontrada');
      if (ruta.estado === 'LIQUIDADA') throw new Error('Esta ruta ya está liquidada');

      const pedidosRuta = db.prepare('SELECT * FROM pedidos WHERE ruta_id = ?').all(rutaId);
      if (!pedidosRuta.length) throw new Error('La ruta no tiene pedidos');

      const porId = new Map((pedidosLiquidacion || []).map((p) => [Number(p.id), p]));
      const updatePedido = db.prepare(`
        UPDATE pedidos SET
          metodo_pago_final = COALESCE(?, metodo_pago_final),
          comprobante_transf = COALESCE(?, comprobante_transf),
          estado_liquidacion = 'LIQUIDADO',
          estado_entrega = CASE WHEN COALESCE(estado_entrega, '') = '' OR estado_entrega = 'PENDIENTE' THEN 'ENTREGADO' ELSE estado_entrega END
        WHERE id = ? AND ruta_id = ?
      `);

      for (const pedido of pedidosRuta) {
        const extra = porId.get(Number(pedido.id)) || {};
        const metodo = extra.metodoPago || pedido.metodo_pago_final || 'EFECTIVO';
        const comprobante = extra.comprobante != null ? extra.comprobante : pedido.comprobante_transf;
        if (metodo === 'TRANSFERENCIA' && !String(comprobante || '').trim()) {
          throw new Error(`Falta el comprobante del pedido ${pedido.codigo_pedido}`);
        }
        updatePedido.run(metodo, comprobante || null, pedido.id, rutaId);
      }

      const sumaEfectivo = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS total
        FROM pedidos
        WHERE ruta_id = ? AND COALESCE(metodo_pago_final, 'EFECTIVO') = 'EFECTIVO'
      `).get(rutaId);

      const recolectado = totalEfectivoEntregado != null && totalEfectivoEntregado !== ''
        ? Number(totalEfectivoEntregado) || 0
        : Number(sumaEfectivo.total || 0) + Number(ruta.base_efectivo || 0);

      db.prepare(`
        UPDATE rutas_domicilio SET
          estado = 'LIQUIDADA',
          total_recolectado = ?,
          fecha_liquidacion = datetime('now')
        WHERE id = ?
      `).run(recolectado, rutaId);

      return { recolectado };
    });

    const resultado = tx();
    res.json({ ok: true, rutaId, totalRecolectado: resultado.recolectado });
  } catch (err) {
    const msg = err.message || 'Error al liquidar';
    const status = /no encontrada|ya está liquidada|no tiene pedidos|Falta el comprobante/i.test(msg) ? 400 : 500;
    res.status(status).json({ ok: false, error: msg });
  }
});

function obtenerIPsLocales() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  Object.values(interfaces).forEach((ifaceList) => {
    ifaceList.forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    });
  });
  return ips;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================');
  console.log('  Inventario & Pick-Pack - Servidor iniciado');
  console.log('==============================================');
  console.log(`  Local:    http://localhost:${PORT}`);
  obtenerIPsLocales().forEach((ip) => {
    console.log(`  Red WiFi (HTTP):  http://${ip}:${PORT}`);
  });

  const certPath = path.join(CERT_DIR, 'cert.pem');
  const keyPath = path.join(CERT_DIR, 'key.pem');
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const options = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    https.createServer(options, app).listen(HTTPS_PORT, '0.0.0.0', () => {
      obtenerIPsLocales().forEach((ip) => {
        console.log(`  Red WiFi (HTTPS): https://${ip}:${HTTPS_PORT}   <-- usar esta URL en el celular (camara)`);
      });
      console.log('==============================================');
    });
  } else {
    obtenerIPsLocales().forEach((ip) => {
      console.log(`  Red WiFi: http://${ip}:${PORT}   <-- usar esta URL en el celular`);
    });
    console.log('  ⚠️  Sin HTTPS configurado: la camara puede fallar por IP de red.');
    console.log('  Ver certs/README.md para habilitar HTTPS local (recomendado).');
    console.log('==============================================');
  }
});