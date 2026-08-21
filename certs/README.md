# 🔒 HTTPS local (para que la cámara funcione desde el celular)

Los navegadores solo dan acceso a la cámara en **contextos seguros**: `https://` o `http://localhost`.
Cuando el celular entra por la IP de red (`http://192.168.x.x:3000`), lo trata como inseguro y
bloquea la cámara. La solución más simple y confiable es generar un certificado HTTPS local con
[mkcert](https://github.com/FiloSottile/mkcert) y ponerlo aquí.

## Pasos (una sola vez)

### 1. Instalar mkcert
- **Windows** (con [Chocolatey](https://chocolatey.org)): `choco install mkcert`
- **Mac** (con Homebrew): `brew install mkcert`
- **Linux**: revisa las instrucciones en https://github.com/FiloSottile/mkcert#installation

### 2. Instalar la autoridad de certificación local
```bash
mkcert -install
```

### 3. Averigua la IP local de tu servidor
- Windows: `ipconfig` (busca "Dirección IPv4")
- Mac/Linux: `ifconfig` o `ip addr` (busca algo tipo `192.168.x.x`)

También puedes simplemente iniciar el servidor una vez (`npm start`) — la consola imprime tu IP de red.

### 4. Generar el certificado para esa IP (y localhost)
Parado en esta carpeta (`certs/`), ejecuta (reemplaza la IP por la tuya real):

```bash
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 192.168.1.35
```

Esto genera dos archivos aquí mismo: `key.pem` y `cert.pem`.

### 5. Reiniciar el servidor
```bash
npm start
```

Ahora la consola mostrará también una URL HTTPS, por ejemplo:

```
Red WiFi (HTTPS): https://192.168.1.35:3443   <-- usar esta URL en el celular (camara)
```

Usa **esa URL HTTPS** en el celular (no la de HTTP) y la cámara debería pedir permiso y funcionar sin problema.

### 6. Confiar en el certificado desde el celular (si el navegador muestra advertencia)
`mkcert -install` solo instala el certificado de confianza en la PC donde lo generaste, no en el
celular. Es normal que el celular muestre una advertencia de "conexión no privada" la primera vez.
Dos formas de resolverlo:
- Tocar "Avanzado" → "Continuar de todas formas" (suficiente para uso interno en red local).
- O instalar el certificado raíz de mkcert también en el celular: ejecuta `mkcert -CAROOT` en tu PC
  para ubicar el archivo `rootCA.pem`, pásalo al celular por cualquier medio (WhatsApp, USB, etc.) e
  instálalo como certificado de confianza desde Ajustes del sistema operativo del teléfono.

## Si no quieres usar mkcert
Alternativas rápidas:
- **Chrome Android**: usa el flag `chrome://flags/#unsafely-treat-insecure-origin-as-secure` y agrega
  ahí la URL HTTP exacta de tu servidor (ver README principal, sección de solución de problemas).
- **ngrok / localtunnel**: exponen tu servidor local con una URL HTTPS pública temporal
  (`npx localtunnel --port 3000`), útil para pruebas rápidas, pero sale a internet — no recomendado
  si el inventario es sensible.
