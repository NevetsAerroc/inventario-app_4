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

  // Impresión con márgenes 0 usando System.Drawing en PowerShell
  const escapedPath = tmpFile.replace(/\\\\/g, '\\\\\\\\');
  const psCode = [
    'Add-Type -AssemblyName System.Drawing;',
    '$doc = New-Object System.Drawing.Printing.PrintDocument;',
    '$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0);',
    '$doc.OriginAtMargins = $false;',
    "$lines = [System.IO.File]::ReadAllLines('" + escapedPath + "', [System.Text.Encoding]::GetEncoding(28591));",
    '$maxLen = 0;',
    'foreach ($l in $lines) { if ($l.Length -gt $maxLen) { $maxLen = $l.Length } };',
    '$fontSize = if ($maxLen -le 34) { 8.5 } else { 7.5 };',
    '$font = New-Object System.Drawing.Font("Lucida Console", $fontSize, [System.Drawing.FontStyle]::Regular);',
    '$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black);',
    '$idx = 0;',
    '$doc.add_PrintPage({',
    '  param($sender, $e);',
    '  $y = 0;',
    '  $lh = $font.GetHeight($e.Graphics);',
    '  while ($idx -lt $lines.Length) {',
    '    $e.Graphics.DrawString($lines[$idx], $font, $brush, 0, $y);',
    '    $y += $lh;',
    '    $idx++;',
    '    if ($y + $lh -gt $e.PageBounds.Height -and $idx -lt $lines.Length) {',
    '      $e.HasMorePages = $true;',
    '      return;',
    '    }',
    '  };',
    '  $e.HasMorePages = $false;',
    '});',
    '$doc.Print();'
  ].join(' ');

  const encoded = Buffer.from(psCode, 'utf16le').toString('base64');

  try {
    execSync('powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + encoded, { stdio: 'ignore' });
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    return true;
  } catch (err) {
    console.error('⚠️ Reintentando con método de respaldo:', err.message);
    try {
      execSync('powershell -NoProfile -Command "Get-Content -Path \\'' + escapedPath + '\\' | Out-Printer"', { stdio: 'ignore' });
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

// ------------------------------------------------------------------
// GET /api/impresion/descargar-windows-directo -> Ejecutor nativo Windows (CERO instalaciones, sin Node.js)
// ------------------------------------------------------------------
router.get('/descargar-windows-directo', (req, res) => {
  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  const psLoop = [
    `$url = '${baseUrl}';`,
    'Add-Type -AssemblyName System.Drawing;',
    'function Print-Ticket([string]$filePath) {',
    '  try {',
    '    $doc = New-Object System.Drawing.Printing.PrintDocument;',
    '    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0);',
    '    $doc.OriginAtMargins = $false;',
    '    $lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::GetEncoding(28591));',
    '    $maxLen = 0;',
    '    foreach ($l in $lines) { if ($l.Length -gt $maxLen) { $maxLen = $l.Length } };',
    '    $fontSize = if ($maxLen -le 34) { 8.5 } else { 7.5 };',
    '    $font = New-Object System.Drawing.Font("Lucida Console", $fontSize, [System.Drawing.FontStyle]::Regular);',
    '    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black);',
    '    $idx = 0;',
    '    $doc.add_PrintPage({',
    '      param($sender, $e);',
    '      $y = 0;',
    '      $lh = $font.GetHeight($e.Graphics);',
    '      while ($idx -lt $lines.Length) {',
    '        $e.Graphics.DrawString($lines[$idx], $font, $brush, 0, $y);',
    '        $y += $lh;',
    '        $idx++;',
    '        if ($y + $lh -gt $e.PageBounds.Height -and $idx -lt $lines.Length) {',
    '          $e.HasMorePages = $true;',
    '          return;',
    '        }',
    '      };',
    '      $e.HasMorePages = $false;',
    '    });',
    '    $doc.Print();',
    '    return $true;',
    '  } catch {',
    '    try {',
    '      Get-Content -Path $filePath | Out-Printer;',
    '      return $true;',
    '    } catch {',
    '      return $false;',
    '    }',
    '  }',
    '}',
    'Write-Host "========================================================" -ForegroundColor Green;',
    'Write-Host "  SERVIDOR DE IMPRESION TIENDA JISPIPLAST (CERO MARGENES)" -ForegroundColor Green;',
    'Write-Host "========================================================" -ForegroundColor Green;',
    'Write-Host "Conectando a: $url" -ForegroundColor Yellow;',
    'Write-Host "Margenes configurados a 0 mm (ancho completo de rollo termico)." -ForegroundColor Cyan;',
    'Write-Host "Esperando facturas desde celulares o computadores..." -ForegroundColor White;',
    'Write-Host "Para detener, cierra esta ventana.`n" -ForegroundColor Gray;',
    'while ($true) {',
    '  try {',
    '    $resp = Invoke-RestMethod -Uri "$url/api/impresion/pendientes" -Method Get -TimeoutSec 6;',
    '    if ($resp -and $resp.pendientes -and $resp.pendientes.Count -gt 0) {',
    '      foreach ($t in $resp.pendientes) {',
    '        Write-Host ("[NUEVO TICKET] Factura: " + $t.numero_factura + " | Cajero: " + $t.usuario_nombre) -ForegroundColor Cyan;',
    '        $tmp = [System.IO.Path]::GetTempFileName();',
    '        [System.IO.File]::WriteAllText($tmp, $t.contenido_ticket, [System.Text.Encoding]::GetEncoding(28591));',
    '        $ok = Print-Ticket $tmp;',
    '        if ($ok) {',
    '          Write-Host ("[IMPRESO OK] Factura " + $t.numero_factura + " impresa con exito.") -ForegroundColor Green;',
    '          $body = @{ exito = $true } | ConvertTo-Json;',
    '          Invoke-RestMethod -Uri "$url/api/impresion/confirmar/$($t.id)" -Method Post -Body $body -ContentType "application/json" | Out-Null;',
    '        } else {',
    '          Write-Host ("[ERROR] Fallo al imprimir factura " + $t.numero_factura) -ForegroundColor Red;',
    '        }',
    '        if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue };',
    '      }',
    '    }',
    '  } catch {',
    '  }',
    '  Start-Sleep -Seconds 2;',
    '}',
    'pause;'
  ].join('\r\n');

  const encodedLoop = Buffer.from(psLoop, 'utf16le').toString('base64');

  const batWindows = "@echo off\r\n" +
    "title Impresora Tienda Jispiplast (Sin Margenes)\r\n" +
    "color 0A\r\n" +
    "echo ========================================================\r\n" +
    "echo   INICIANDO IMPRESORA TIENDA JISPIPLAST\r\n" +
    "echo   Modo Cero Margenes para Rollo Termico\r\n" +
    "echo ========================================================\r\n" +
    "echo.\r\n" +
    `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedLoop}\r\n` +
    "pause\r\n";

  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', 'attachment; filename="imprimir_en_tienda_sin_instalar_nada.bat"');
  res.send(batWindows);
});

// ------------------------------------------------------------------
// GET /api/impresion/descargar-auto-arranque -> Instalador automático de inicio con Windows
// ------------------------------------------------------------------
router.get('/descargar-auto-arranque', (req, res) => {
  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  const autoBat = `@echo off
title Configurar Inicio Automatico con Windows - Jispiplast
color 0A
echo ========================================================
echo   CONFIGURADOR DE INICIO AUTOMATICO - JISPIPLAST
echo ========================================================
echo.
echo Este instalador configurara tu computador para que el
echo servidor de impresion arranque solo cada vez que prendas el PC.
echo.

set TARGET_DIR=%USERPROFILE%\\Jispiplast_Impresion
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo [1/3] Descargando la version mas reciente del agente de impresion...
powershell -NoProfile -Command "Invoke-WebRequest -Uri '${baseUrl}/api/impresion/descargar-windows-directo' -OutFile '%TARGET_DIR%\\imprimir_en_tienda.bat'"

if not exist "%TARGET_DIR%\\imprimir_en_tienda.bat" (
    echo [ERROR] No se pudo descargar el archivo. Verifica tu conexion a internet.
    pause
    exit /b
)

echo [2/3] Creando acceso directo en la carpeta de Inicio de Windows...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine($env:APPDATA, 'Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Jispiplast_Impresora.lnk')); $s.TargetPath = '%TARGET_DIR%\\imprimir_en_tienda.bat'; $s.WorkingDirectory = '%TARGET_DIR%'; $s.WindowStyle = 7; $s.Description = 'Servidor de Impresion Tienda Jispiplast'; $s.Save()"

echo [3/3] Iniciando el servicio ahora mismo...
start "" /min "%TARGET_DIR%\\imprimir_en_tienda.bat"

echo.
echo ========================================================
echo   EXITO: CONFIGURACION COMPLETADA!
echo ========================================================
echo 1. El servidor de impresion ya esta funcionando en segundo plano.
echo 2. De ahora en adelante se encendera AUTOMATICAMENTE cada vez
echo    que prendas este computador. No tendras que abrir nada.
echo.
echo Puedes cerrar esta ventana.
echo ========================================================
pause
`;

  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', 'attachment; filename="configurar_inicio_automatico.bat"');
  res.send(autoBat);
});

module.exports = router;

