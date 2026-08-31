// ============================================================
// Wrapper reutilizable sobre html5-qrcode.
// Optimizado para códigos de barras 1D de producto y cajas (GS1 / CODE128).
// ============================================================

/**
 * Limpia y normaliza lo que devuelve la cámara / foto.
 * - Quita prefijos AIM (]C1, ]C0, ]A0…)
 * - Si es GS1 (01) extrae el GTIN limpio
 */
function normalizarCodigoBarras(raw) {
  if (raw == null) return '';
  let t = String(raw).trim();

  // 1. Quitar caracteres de control e invisibles
  t = t.replace(/[\x00-\x1F\x7F\uFFFD]/g, '');

  // 2. Si empieza por ]C1, ]C0, [c1, etc., remueve el prefijo AIM (] + 1 letra + 1 digito/letra)
  t = t.replace(/^(\]C1|\]C0|\[c1|\[C1|\][a-zA-Z][0-9a-zA-Z])/i, '');

  // 3. Quitar todos los espacios y corchetes sobrantes
  t = t.replace(/[\s\[\]]+/g, '');

  // 4. Caso GS1: Si contiene paréntesis (01)17709279644693
  const matchAI = t.match(/\(0?1\)\s*(\d{12,14})/);
  if (matchAI) {
    return matchAI[1];
  }

  // 5. Si empieza con el AI "01" seguido de 14 dígitos (ej: 0117709279644693)
  if (/^01\d{14}/.test(t)) {
    return t.slice(2, 16);
  }

  // 6. Si quedaron solo dígitos y tiene longitud 16 empezando con 01
  if (t.length === 16 && t.startsWith('01')) {
    return t.slice(2);
  }

  return t;
}

/**
 * Descarta lecturas claramente basura (muy cortas o con símbolos raros).
 */
function esLecturaValida(codigo) {
  if (!codigo || codigo.length < 4) return false;
  const raros = (codigo.match(/[^A-Za-z0-9\-_./]/g) || []).length;
  if (raros > 2 && codigo.length < 12) return false;
  // Patrón típico de basura tipo "1x8Z1>"
  if (/[<>\"'`|\\]/.test(codigo) && codigo.length < 15) return false;
  return true;
}

class BarcodeScanner {
  /**
   * @param {string} elementId - id del div contenedor donde se monta el lector
   * @param {(texto:string)=>void} onScan - callback ejecutado con cada lectura
   * @param {object} opts - opciones adicionales
   */
  constructor(elementId, onScan, opts = {}) {
    this.elementId = elementId;
    this.onScan = onScan;
    this.html5QrCode = null;
    this.track = null;
    this.torchEnabled = false;
    this.running = false;
    this.cooldownMs = opts.cooldownMs ?? 1500;
    this._lastScanAt = 0;
    this._lastText = null;
  }

  async start() {
    if (this.running) return;
    if (!window.Html5Qrcode) {
      showToast('No se pudo cargar la librería de cámara.', 'error');
      return;
    }

    try {
      this.html5QrCode = new Html5Qrcode(this.elementId);

      const config = {
        fps: 20,
        qrbox: (viewfinderW, viewfinderH) => {
          const minEdge = Math.min(viewfinderW, viewfinderH);
          return {
            width: Math.floor(viewfinderW * 0.88),
            height: Math.floor(Math.max(minEdge * 0.45, 120)),
          };
        },
        aspectRatio: 1.777778,
      };

      await this.html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => this._handleDecoded(decodedText),
        () => { /* frame sin lectura */ }
      );
      this.running = true;

      // Obtener la pista de video para linterna y enfoque
      try {
        const video = document.querySelector(`#${this.elementId} video`);
        if (video && video.srcObject) {
          this.track = video.srcObject.getVideoTracks()[0];
          const caps = this.track.getCapabilities ? this.track.getCapabilities() : {};
          if (caps.focusMode && caps.focusMode.includes('continuous')) {
            await this.track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        }
      } catch (e) {
        // No todos los celulares permiten zoom/enfoque desde el navegador
      }
    } catch (err) {
      console.warn('Intento estándar con facingMode falló, intentando por ID de dispositivo...', err);
      // Fallback: listar cámaras disponibles y seleccionar la trasera
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const backCamera = cameras.find(c => /back|rear|environment|trasera/i.test(c.label)) || cameras[cameras.length - 1];
          await this.html5QrCode.start(
            backCamera.id,
            { fps: 20, aspectRatio: 1.777778 },
            (decodedText) => this._handleDecoded(decodedText),
            () => {}
          );
          this.running = true;
          const video = document.querySelector(`#${this.elementId} video`);
          if (video && video.srcObject) {
            this.track = video.srcObject.getVideoTracks()[0];
          }
          return;
        }
      } catch (fallbackErr) {
        console.error('Error en fallback de cámaras:', fallbackErr);
      }

      showToast('No se pudo acceder a la cámara. Revisa los permisos del navegador.', 'error');
    }
  }

  async toggleTorch() {
    if (!this.track) {
      showToast('Cámara no activa o sin soporte para flash.', 'error');
      return false;
    }

    const capabilities = this.track.getCapabilities ? this.track.getCapabilities() : {};
    if (!capabilities.torch) {
      showToast('Tu dispositivo o navegador no soporta encender el flash.', 'error');
      return false;
    }

    try {
      this.torchEnabled = !this.torchEnabled;
      await this.track.applyConstraints({
        advanced: [{ torch: this.torchEnabled }]
      });
      return this.torchEnabled;
    } catch (err) {
      console.error("Error al activar linterna:", err);
      return false;
    }
  }

  _handleDecoded(text) {
    const limpio = normalizarCodigoBarras(text);
    if (!esLecturaValida(limpio)) {
      console.warn('Lectura descartada (basura):', text, '→', limpio);
      return;
    }

    const now = Date.now();
    if (limpio === this._lastText && (now - this._lastScanAt) < this.cooldownMs) {
      return;
    }
    this._lastText = limpio;
    this._lastScanAt = now;
    this.onScan(limpio);
  }

  async stop() {
    if (!this.running || !this.html5QrCode) return;
    try {
      if (this.torchEnabled) {
        try { await this.toggleTorch(); } catch (e) {}
      }
      await this.html5QrCode.stop();
      await this.html5QrCode.clear();
    } catch (e) { /* ya estaba detenido */ }
    this.track = null;
    this.running = false;
  }

  // ------------------------------------------------------------------
  // Decodifica un codigo de barras/QR a partir de una foto (File).
  // A diferencia del escaneo en vivo, una foto estatica no tiene "varios
  // intentos" para que el codigo quede bien alineado, asi que si el primer
  // intento falla, probamos rotando la imagen 90/180/270 grados.
  // ------------------------------------------------------------------
  static async scanearDesdeArchivo(file) {
    if (!window.Html5Qrcode) {
      showToast('No se pudo cargar la libreria de camara.', 'error');
      throw new Error('Html5Qrcode no disponible');
    }
    if (!(file instanceof File)) {
      throw new Error('scanearDesdeArchivo requiere un File (event.target.files[0]).');
    }

    let tempDiv = document.getElementById('html5qrcode-file-scan-temp');
    if (!tempDiv) {
      tempDiv = document.createElement('div');
      tempDiv.id = 'html5qrcode-file-scan-temp';
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);
    }

    const html5QrCode = new Html5Qrcode('html5qrcode-file-scan-temp', {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    });

    // Orden de intentos: recto, luego los giros mas probables (90/270 es lo
    // tipico cuando el telefono estaba "acostado"), y 180 al final.
    const angulos = [0, 90, 270, 180];
    let ultimoError = null;

    try {
      for (const angulo of angulos) {
        const archivoParaProbar = angulo === 0 ? file : await this._rotarImagen(file, angulo);
        try {
          const texto = await html5QrCode.scanFile(archivoParaProbar, false);
          return normalizarCodigoBarras(texto);
        } catch (err) {
          ultimoError = err;
        }
      }
      throw ultimoError || new Error('No se detecto ningun codigo en la foto.');
    } finally {
      try { html5QrCode.clear(); } catch (e) { /* noop */ }
    }
  }

  // Devuelve una copia del File rotada N grados (usando un canvas).
  static _rotarImagen(file, grados) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const giro90 = grados === 90 || grados === 270;
        const canvas = document.createElement('canvas');
        canvas.width = giro90 ? img.height : img.width;
        canvas.height = giro90 ? img.width : img.height;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((grados * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        URL.revokeObjectURL(img.src);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('No se pudo rotar la imagen.')); return; }
          resolve(new File([blob], file.name || 'foto.jpg', { type: file.type || 'image/jpeg' }));
        }, file.type || 'image/jpeg', 0.92);
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para rotarla.'));
      img.src = URL.createObjectURL(file);
    });
  }
    /**
   * Lee un código de barras desde una foto (archivo o captura del celular).
   * La cámara nativa enfoca mejor los códigos pequeños.
   */
  static async escanearDesdeArchivo(file) {
    if (!window.Html5Qrcode) {
      throw new Error('Librería de cámara no cargada');
    }
    if (!file) {
      throw new Error('No se seleccionó ninguna imagen');
    }

    const formatos = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.CODABAR,
      Html5QrcodeSupportedFormats.QR_CODE,
    ];

    // Contenedor temporal oculto (html5-qrcode lo requiere)
    let tempId = 'reader-scan-file-temp';
    let temp = document.getElementById(tempId);
    if (!temp) {
      temp = document.createElement('div');
      temp.id = tempId;
      temp.style.display = 'none';
      document.body.appendChild(temp);
    }

    const scanner = new Html5Qrcode(tempId, { formatsToSupport: formatos, verbose: false });
    try {
      const texto = await scanner.scanFile(file, false);
      const limpio = typeof normalizarCodigoBarras === 'function'
        ? normalizarCodigoBarras(texto)
        : String(texto || '').trim();
      if (typeof esLecturaValida === 'function' && !esLecturaValida(limpio)) {
        throw new Error('No se detectó un código válido en la imagen');
      }
      return limpio || texto;
    } finally {
      try { await scanner.clear(); } catch (e) { /* ignore */ }
    }
  }
}