# 📦 Inventario & Empaque — PWA local (Pick & Pack)

Aplicación web local para **gestión de inventario** y **empaque de pedidos (Pick & Pack)** con lectura de códigos de barras desde la cámara del celular. Pensada para correr en un servidor local (tu PC / un mini-servidor en la bodega) y ser usada desde varios smartphones conectados a la misma red WiFi.

## 🧱 Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + JavaScript ES6 + TailwindCSS (CDN) — Mobile First |
| Lector de cámara | [html5-qrcode](https://github.com/mebjas/html5-qrcode) (EAN-13/8, UPC-A/E, CODE128, CODE39, QR) |
| Backend | Node.js + Express (API REST) |
| Base de datos | SQLite (`better-sqlite3`, un solo archivo, sin servidor DB) |
| Excel/CSV | `xlsx` (SheetJS) |
| Sonidos beep OK/Error | Web Audio API (sin archivos de audio externos) |

## 📁 Estructura del proyecto

```
inventario-app/
├── server.js                  # servidor Express, escucha en 0.0.0.0
├── package.json
├── db/
│   ├── schema.sql              # esquema SQLite (productos, pedidos, detalle_pedidos, movimientos_stock)
│   ├── database.js             # conexión + bootstrap del esquema
│   └── inventario.db           # (se genera automáticamente al iniciar el servidor)
├── routes/
│   ├── productos.js            # API: catálogo, búsqueda, vínculo de código, stock, importación Excel
│   └── pedidos.js              # API: pedidos, escaneo Pick&Pack, cierre, exportación
├── public/                     # Frontend (servido como estático por Express)
│   ├── index.html
│   ├── manifest.json
│   ├── css/styles.css
│   └── js/
│       ├── app.js              # navegación entre módulos (pestañas)
│       ├── utils.js            # cliente API + toasts
│       ├── sound.js            # beeps de éxito/error (Web Audio API)
│       ├── scanner.js          # wrapper de la cámara (html5-qrcode)
│       ├── modulo-carga.js     # MÓDULO A
│       ├── modulo-inventario.js# MÓDULO B
│       └── modulo-empaque.js   # MÓDULO C
├── plantillas/                 # Excel de ejemplo para importar
│   ├── plantilla_productos.xlsx
│   └── plantilla_pedido.xlsx
├── uploads/                    # archivos subidos temporalmente (se pueden borrar)
└── exports/
```

## 🗄️ Esquema de base de datos (SQLite)

- **productos**: `id, sku (unique), nombre, categoria, stock, precio, codigo_barras (unique, nullable), created_at, updated_at`
- **movimientos_stock**: histórico de entradas/salidas/ajustes/empaques — `id, producto_id, tipo, cantidad, stock_resultante, motivo, pedido_id, created_at`
- **pedidos**: `id, codigo_pedido (unique), cliente, estado (PENDIENTE|EN_PROCESO|EMPACADO), fecha_creacion, fecha_cierre`
- **detalle_pedidos**: `id, pedido_id, producto_id, sku, nombre_producto, cantidad_solicitada, cantidad_empacada, verificado`

El archivo completo está en [`db/schema.sql`](db/schema.sql). Se ejecuta automáticamente la primera vez que arrancas el servidor — **no necesitas crear la base de datos a mano**.

## 🚀 Instalación y ejecución

### 1. Requisitos
- [Node.js](https://nodejs.org) v18 o superior instalado en la máquina que hará de servidor (tu laptop, un mini PC, etc).
- Todos los dispositivos (servidor + celulares) conectados a la **misma red WiFi**.

### 2. Instalar dependencias

```bash
cd inventario-app
npm install
```

### 3. Iniciar el servidor

```bash
npm start
```

Verás algo como:

```
==============================================
  Inventario & Pick-Pack - Servidor iniciado
==============================================
  Local:    http://localhost:3000
  Red WiFi: http://192.168.1.35:3000   <-- usar esta URL en el celular
==============================================
```

- **En la misma PC**: abre `http://localhost:3000`.
- **Desde el celular** (conectado al mismo WiFi): abre en Chrome/Safari la URL "Red WiFi" que imprime la consola, por ejemplo `http://192.168.1.35:3000`.

> Si la consola no muestra ninguna IP de red, revisa que tu PC esté conectada por WiFi/Ethernet a la misma red que el celular (no uses "Datos móviles" en el teléfono).

### 4. Permitir el acceso por el firewall (si aplica)
En Windows puede aparecer un aviso de firewall al iniciar `node`: acepta permitir el acceso en "Redes privadas". En Mac/Linux normalmente no requiere configuración extra si están en la misma red local.

### 5. Cámara en el celular
La primera vez que uses un módulo con escaneo, el navegador pedirá permiso de cámara — acéptalo. Nota: la mayoría de navegadores móviles exigen **HTTPS o `localhost`** para la cámara; el acceso vía IP local (`http://192.168.x.x`) funciona en **Chrome Android** sin problema porque se trata como "origen seguro" en redes privadas, pero si tu navegador la bloquea, hay dos alternativas:
- Usar Chrome en Android (recomendado, el más permisivo con IP local + cámara).
- Exponer el servidor con HTTPS local (por ejemplo con [mkcert](https://github.com/FiloSottile/mkcert) + un proxy, o herramientas como `ngrok`/`localtunnel` si necesitas HTTPS real).

## 🧩 Uso de los módulos

### Módulo A — Carga masiva y vínculo de código de barras
1. Sube un `.xlsx`/`.csv` con columnas `SKU, Nombre, Categoria, StockInicial, Precio` (ver `plantillas/plantilla_productos.xlsx`). Si el SKU ya existe, se actualiza; si no, se crea.
2. En "Vincular código de barras", selecciona un producto sin código, toca "Escanear para vincular" y apunta la cámara al código físico. Queda vinculado al instante.

### Módulo B — Inventario y búsqueda rápida
- Busca por texto (SKU/nombre) o por cámara.
- Al encontrar el producto: nombre, SKU, stock y precio en pantalla.
- Botones **➕ Entrada** / **➖ Salida** para mover stock (quedan registrados en `movimientos_stock`).

### Módulo C — Checking / Empaque de pedidos (Pick & Pack)
1. Importa una lista de empaque `.xlsx`/`.csv` con columnas `CodigoPedido, Cliente, SKU, Cantidad` (ver `plantillas/plantilla_pedido.xlsx`) — varias filas con el mismo `CodigoPedido` arman un mismo pedido. O selecciona un pedido ya cargado.
2. Activa la cámara y empieza a escanear los ítems físicos:
   - ✅ Si el ítem pertenece al pedido y aún falta: suma al contador, se marca "verificado" y suena un beep de éxito.
   - ❌ Si no pertenece al pedido o ya se completó: alerta visual roja + beep de error.
3. Cuando el 100% de los ítems están verificados, el botón **"Cerrar pedido y descontar inventario"** se habilita. Al cerrar: el pedido pasa a estado `EMPACADO` y se descuentan automáticamente las unidades del inventario principal.

### Módulo D — Preparación para facturación
Desde un pedido ya `EMPACADO`, usa los botones **⬇️ Exportar JSON** / **⬇️ Exportar CSV** (o directamente `GET /api/pedidos/:id/exportar?formato=json|csv`) para obtener el pedido finalizado, listo para que otro sistema de facturación lo procese.

## 🔌 Referencia rápida de la API REST

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/productos/importar` | Importa productos desde Excel/CSV |
| GET  | `/api/productos?q=&sinBarcode=1` | Lista/filtra catálogo |
| GET  | `/api/productos/buscar/:codigo` | Busca por código de barras o SKU |
| POST | `/api/productos/:id/vincular-barcode` | Vincula código de barras a un producto |
| POST | `/api/productos/:id/ajustar-stock` | Entrada/salida/ajuste de stock |
| POST | `/api/pedidos/importar` | Importa pedidos desde Excel/CSV |
| POST | `/api/pedidos` | Crea un pedido manualmente (JSON) |
| GET  | `/api/pedidos` / `/api/pedidos/:id` | Lista / detalle de pedidos |
| POST | `/api/pedidos/:id/escanear` | Valida un ítem escaneado contra el pedido |
| POST | `/api/pedidos/:id/cerrar` | Cierra el pedido y descuenta inventario |
| GET  | `/api/pedidos/:id/exportar?formato=json|csv` | Exporta pedido finalizado |

## 🛠️ Notas de mantenimiento

- La base de datos vive en un único archivo: `db/inventario.db`. Para respaldarla, simplemente copia ese archivo (apaga el servidor o hazlo cuando no haya escrituras en curso).
- Para reiniciar todo desde cero: apaga el servidor y borra `db/inventario.db` (y los archivos `-shm`/`-wal` si existen); se regenerará vacío al reiniciar.
- El puerto por defecto es `3000`. Para cambiarlo: `PORT=3010 npm start`.

## 📋 Plantillas de Excel — siempre actualizadas

En el módulo **Carga**, el botón **"⬇️ Descargar plantilla / catálogo actual"** no baja un archivo fijo: genera un `.xlsx` **en vivo** con tu inventario actual (columnas `SKU, Nombre, Categoria, StockInicial, Precio, CodigoBarras`), incluyendo los códigos de barras que ya tengas asignados. Flujo recomendado para editar o agregar códigos de barras en lote:

1. Descarga la plantilla actual desde el botón de la app.
2. Ábrela en Excel/Sheets. Escribe o corrige los códigos de barras en la columna `CodigoBarras` para tantos productos como quieras (también puedes ajustar nombre, categoría, stock o precio).
3. Vuelve a subir ese mismo archivo desde "Toca para elegir archivo y subir cambios".
4. La base de datos se actualiza por `SKU` — filas existentes se actualizan, filas nuevas se crean. Si un código de barras ya está usado por otro producto, esa fila se omite solo en el campo de código (el resto de sus datos sí se actualiza) y queda reportado como advertencia, sin afectar al resto del archivo.

También existe una plantilla estática de ejemplo en [`plantillas/`](plantillas/) por si prefieres partir de cero.

## ✏️ Editar el código de barras de un producto

Hay dos formas dentro de la app, ambas permiten **cámara o escritura manual**:

- **Módulo Carga** → sección "🔗 Vincular / editar código de barras": selecciona cualquier producto (tenga o no código ya asignado) de la lista desplegable y escanéalo o escríbelo.
- **Módulo Inventario**: busca/escanea el producto, y en su ficha toca el ícono ✏️ junto al código para editarlo directamente.

## 🎥 Solución de problemas: "la cámara no abre / revisa los permisos"

Este es el problema más común y **casi nunca es un permiso mal dado**: es que el navegador bloquea
la cámara por seguridad cuando accedes por `http://IP-de-red:3000` en vez de `https://` o
`localhost`. Los navegadores solo permiten `getUserMedia` (cámara) en **contextos seguros**.

**Solución recomendada (una sola vez):** genera un certificado HTTPS local siguiendo
[`certs/README.md`](certs/README.md) (usa `mkcert`, toma 5 minutos) y luego entra desde el celular
a la URL `https://` que te muestra la consola al iniciar el servidor, en vez de la `http://`.

**Solución rápida sin instalar nada (solo Chrome Android):**
1. En el celular, ve a `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
2. Escribe la URL exacta de tu servidor, ej: `http://192.168.1.35:3000`.
3. Cambia el flag a "Enabled" y reinicia Chrome ("Relaunch").
4. Vuelve a entrar a la app — la cámara debería pedir permiso normalmente.

**Checklist adicional si el problema persiste:**
- Verifica que sea **Chrome** en Android (es el más permisivo) o Safari en iOS con HTTPS — evita navegadores integrados en otras apps (WhatsApp, Instagram, etc.), esos casi nunca permiten cámara.
- Revisa que Chrome tenga permiso de cámara a **nivel del sistema operativo** del celular (Ajustes del teléfono → Apps → Chrome → Permisos → Cámara), no solo dentro del navegador.
- Prueba en una pestaña de incógnito, por si una extensión o configuración guardada está bloqueando el sitio.
- Confirma que ninguna otra app esté usando la cámara en ese momento.
- Revisa la consola del navegador (en el celular: `chrome://inspect` desde una PC conectada por USB) para ver el error exacto que arroja `getUserMedia`.
