const express = require('express');
const db = require('../db/database');

const router = express.Router();
let ultimoLatidoAgente = 0;
let nombreImpresoraAgente = '';

// ------------------------------------------------------------------
// POST /api/impresion/encolar -> Poner un ticket en la cola de impresión
// ------------------------------------------------------------------
router.post('/encolar', (req, res) => {
  try {
    const {
      tipo = 'VENTA',
      referencia_id = null,
      numero_factura = '',
      contenido_ticket = '',
      usuario_nombre = ''
    } = req.body;

    if (!contenido_ticket || !contenido_ticket.trim()) {
      return res.status(400).json({ ok: false, error: 'El contenido del ticket está vacío.' });
    }

    const usrNom = usuario_nombre || (req.user ? req.user.nombre : 'Ventas');

    const stmt = db.prepare(`
      INSERT INTO cola_impresion (tipo, referencia_id, numero_factura, contenido_ticket, estado, usuario_nombre)
      VALUES (?, ?, ?, ?, 'PENDIENTE', ?)
    `);
    const info = stmt.run(tipo, referencia_id, numero_factura, contenido_ticket.trim(), usrNom);

    res.json({
      ok: true,
      id: info.lastInsertRowid,
      mensaje: `Ticket para ${numero_factura || 'documento'} encolado para impresión en tienda.`
    });
  } catch (err) {
    console.error('Error al encolar ticket:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/impresion/pendientes -> El agente local consulta tickets por imprimir
// ------------------------------------------------------------------
router.get('/pendientes', (req, res) => {
  try {
    ultimoLatidoAgente = Date.now();
    if (req.query.impresora) {
      nombreImpresoraAgente = req.query.impresora;
    }

    const tickets = db.prepare(`
      SELECT id, tipo, referencia_id, numero_factura, contenido_ticket, usuario_nombre, created_at
      FROM cola_impresion
      WHERE estado = 'PENDIENTE'
      ORDER BY id ASC
      LIMIT 10
    `).all();

    res.json({
      ok: true,
      servidor_hora: new Date().toISOString(),
      pendientes: tickets
    });
  } catch (err) {
    console.error('Error al obtener tickets pendientes:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/impresion/confirmar/:id -> El agente confirma impresión exitosa
// ------------------------------------------------------------------
router.post('/confirmar/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { exito = true, error = '' } = req.body;

    ultimoLatidoAgente = Date.now();

    const estadoFinal = exito ? 'IMPRESO' : 'ERROR';
    db.prepare(`
      UPDATE cola_impresion
      SET estado = ?, printed_at = datetime('now')
      WHERE id = ?
    `).run(estadoFinal, id);

    res.json({ ok: true, id, estado: estadoFinal });
  } catch (err) {
    console.error('Error al confirmar ticket impreso:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/impresion/estado -> Verifica si el agente en el PC de la tienda está activo
// ------------------------------------------------------------------
router.get('/estado', (req, res) => {
  const haceSegundos = Math.floor((Date.now() - ultimoLatidoAgente) / 1000);
  const conectado = ultimoLatidoAgente > 0 && haceSegundos <= 15;

  const countPendientes = db.prepare(`
    SELECT COUNT(*) as c FROM cola_impresion WHERE estado = 'PENDIENTE'
  `).get()?.c || 0;

  res.json({
    ok: true,
    agente_conectado: conectado,
    hace_segundos: haceSegundos,
    impresora_registrada: nombreImpresoraAgente || 'Predeterminada de Windows',
    pendientes_en_cola: countPendientes
  });
});

// ------------------------------------------------------------------
// GET /api/impresion/descargar-agente -> Descargar el script para el PC de la tienda
// ------------------------------------------------------------------
router.get('/descargar-agente', (req, res) => {
  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  const scriptCode = `// ============================================================
// SERVIDOR / AGENTE DE IMPRESIÓN LOCAL PARA TIENDA (JISPIPLAST)
// Ejecutar en el computador donde está conectada la impresora USB.
// No requiere 'npm install' - Funciona con Node.js estándar (v18+)
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVIDOR_URL = process.env.URL_APP || '${baseUrl}';
const INTERVALO_MS = 2500; // Consulta cada 2.5 segundos

console.log('====================================================');
console.log('🖨️  AGENTE DE IMPRESIÓN LOCAL JISPIPLAST INICIADO');
console.log('📡 Servidor Cloud:', SERVIDOR_URL);
console.log('💻 Sistema Operativo:', process.platform);
console.log('🕒 Consultando cola cada 2.5 segundos...');
console.log('====================================================\\n');

function imprimirEnWindows(texto) {
  const tmpFile = path.join(__dirname, 'ticket_temp.txt');
  fs.writeFileSync(tmpFile, texto, { encoding: 'latin1' });

  try {
    // Imprime en la impresora predeterminada de Windows usando PowerShell
    execSync(\`powershell -NoProfile -Command "Get-Content -Path '\${tmpFile}' | Out-Printer"\`, { stdio: 'ignore' });
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    return true;
  } catch (err) {
    console.error('⚠️ Error al imprimir con PowerShell:', err.message);
    // Alternativa con comando print
    try {
      execSync(\`print /D:PRN "\${tmpFile}"\`, { stdio: 'ignore' });
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      return true;
    } catch (e2) {
      console.error('❌ Error crítico al enviar a impresora:', e2.message);
      return false;
    }
  }
}

function imprimirEnUnix(texto) {
  const tmpFile = path.join(__dirname, 'ticket_temp.txt');
  fs.writeFileSync(tmpFile, texto, { encoding: 'utf8' });
  try {
    execSync(\`lp "\${tmpFile}"\`, { stdio: 'ignore' });
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    return true;
  } catch (err) {
    console.error('Error al imprimir con lp:', err.message);
    return false;
  }
}

function imprimirTicket(texto) {
  if (process.platform === 'win32') {
    return imprimirEnWindows(texto);
  } else {
    return imprimirEnUnix(texto);
  }
}

async function cicloConsultarCola() {
  try {
    const res = await fetch(\`\${SERVIDOR_URL}/api/impresion/pendientes\`);
    if (!res.ok) {
      setTimeout(cicloConsultarCola, INTERVALO_MS);
      return;
    }

    const data = await res.json();
    const pendientes = data.pendientes || [];

    for (const ticket of pendientes) {
      console.log(\`⚡ [NUEVO TICKET] ID: \${ticket.id} | Factura: \${ticket.numero_factura} | Por: \${ticket.usuario_nombre}\`);
      const impreso = imprimirTicket(ticket.contenido_ticket);

      if (impreso) {
        console.log(\`✅ [IMPRESO] Factura \${ticket.numero_factura} enviada a la impresora con éxito.\\n\`);
        await fetch(\`\${SERVIDOR_URL}/api/impresion/confirmar/\${ticket.id}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exito: true })
        });
      } else {
        console.error(\`❌ [FALLÓ] No se pudo enviar el ticket \${ticket.id} a la impresora.\\n\`);
        await fetch(\`\${SERVIDOR_URL}/api/impresion/confirmar/\${ticket.id}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exito: false, error: 'Fallo al enviar a cola local de Windows' })
        });
      }
    }
  } catch (err) {
    // Silencioso ante pérdidas temporales de internet
  }

  setTimeout(cicloConsultarCola, INTERVALO_MS);
}

cicloConsultarCola();
`;

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Content-Disposition', 'attachment; filename="agente-impresion.js"');
  res.send(scriptCode);
});

// ------------------------------------------------------------------
// GET /api/impresion/descargar-bat -> Descargar el archivo iniciador para Windows
// ------------------------------------------------------------------
router.get('/descargar-bat', (req, res) => {
  const batContent = `@echo off
title Servidor de Impresion - Jispiplast
color 0A
echo ========================================================
echo   INICIANDO SERVIDOR DE IMPRESION LOCAL JISPIPLAST
echo ========================================================
echo.
echo Verificando Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se encontro Node.js instalado en este computador.
    echo Por favor descarga e instala Node.js desde: https://nodejs.org
    echo Luego vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b
)

echo Node.js detectado correctamente.
echo Iniciando agente de impresion...
echo.
node agente-impresion.js
pause
`;

  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', 'attachment; filename="iniciar_impresora.bat"');
  res.send(batContent);
});

module.exports = router;
