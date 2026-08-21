const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const https = require('https');

const productosRouter = require('./routes/productos');
const pedidosRouter = require('./routes/pedidos');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const CERT_DIR = path.join(__dirname, 'certs');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Frontend estatico
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api/productos', productosRouter);
app.use('/api/pedidos', pedidosRouter);

app.get('/api/health', (req, res) => res.json({ ok: true, status: 'up', time: new Date().toISOString() }));

// Fallback SPA -> index.html para cualquier ruta no-API
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

  // Si existen certificados locales (ver certs/README.md), levanta tambien HTTPS.
  // La camara del celular SOLO funciona de forma confiable en HTTP si es "localhost";
  // por IP de red (192.168.x.x) los navegadores exigen HTTPS. Por eso se recomienda
  // usar esta URL HTTPS desde el celular.
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
