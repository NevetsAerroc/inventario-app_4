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
    // ?fecha=YYYY-MM-DD filtra por el dia en que el pedido quedo EMPACADO
    // (o, si no tiene fecha_cierre, por el dia en que se creo). Sin el
    // parametro, se devuelven todos los pendientes sin filtrar por fecha.
    const fecha = (req.query.fecha || '').trim();
    let sql = `
      SELECT * FROM pedidos
      WHERE estado = 'EMPACADO'
        AND (ruta_id IS NULL OR ruta_id = 0 OR ruta_id = '')
        AND (COALESCE(estado_liquidacion, 'PENDIENTE') = 'PENDIENTE' OR estado_liquidacion = '')
    `;
    const params = [];
    if (fecha) {
      sql += ` AND date(COALESCE(fecha_cierre, fecha_creacion), 'localtime') = ?`;
      params.push(fecha);
    }
    sql += ` ORDER BY id DESC`;

    const pedidos = db.prepare(sql).all(...params);
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
    const fecha = (req.query.fecha || '').trim();

    // Para rutas LIQUIDADAS filtramos por el dia en que se liquidaron;
    // para rutas EN_RUTA filtramos por el dia en que se despacharon.
    const columnaFecha = estado === 'LIQUIDADA' ? 'r.fecha_liquidacion' : 'r.fecha_creacion';

    let sql = `
      SELECT r.*, d.nombre as domiciliario_nombre,
             (SELECT COUNT(*) FROM pedidos p WHERE p.ruta_id = r.id) as cantidad_pedidos,
             (SELECT SUM(total) FROM pedidos p WHERE p.ruta_id = r.id) as total_dinero
      FROM rutas_domicilio r
      LEFT JOIN domiciliarios d ON r.domiciliario_id = d.id
      WHERE r.estado = ?
    `;
    const params = [estado];
    if (fecha) {
      sql += ` AND date(COALESCE(${columnaFecha}, r.fecha_creacion), 'localtime') = ?`;
      params.push(fecha);
    }
    sql += ` ORDER BY r.fecha_creacion DESC`;

    const rutas = db.prepare(sql).all(...params);
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
    const { total, metodoPago, estadoEntrega, comprobante, observacion } = req.body;
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
        comprobante_transf = COALESCE(?, comprobante_transf),
        observacion = COALESCE(?, observacion)
      WHERE id = ?
    `).run(
      total != null ? total : null,
      metodoPago || null,
      estadoEntrega || null,
      comprobante != null ? comprobante : null,
      observacion != null ? observacion : null,
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
    const tx = db.transaction(() => {
      const updatePedido = db.prepare(`
        UPDATE pedidos
        SET metodo_pago_final = ?,
            comprobante_transf = ?,
            estado_liquidacion = ?
        WHERE id = ?
      `);

      for (const item of pedidosLiquidacion) {
        // Si quedó transferencia pendiente, no lo marca como liquidado total
        const estado =
          item.metodoPago === 'TRANSFERENCIA_PENDIENTE'
            ? 'PAGO_PENDIENTE'
            : 'LIQUIDADO';

        updatePedido.run(
          item.metodoPago,
          item.comprobante || '',
          estado,
          item.id
        );
      }

      db.prepare(`
        UPDATE rutas_domicilio
        SET estado = 'LIQUIDADA',
            total_recolectado = ?,
            fecha_liquidacion = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(totalEfectivoEntregado, rutaId);
    });
    tx();
    res.json({ ok: true, mensaje: 'Ruta liquidada' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
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