// ============================================================
// Wrapper reutilizable sobre html5-qrcode.
// Soporta codigos de barras 1D (EAN, CODE128, UPC, etc.) y QR.
// ============================================================

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
    this.running = false;
    this.cooldownMs = opts.cooldownMs ?? 1200; // evita lecturas duplicadas del mismo frame
    this._lastScanAt = 0;
    this._lastText = null;
  }

  async start() {
    if (this.running) return;
    if (!window.Html5Qrcode) {
      showToast('No se pudo cargar la libreria de camara.', 'error');
      return;
    }

    this.html5QrCode = new Html5Qrcode(this.elementId, {
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

    const config = {
      fps: 12,
      qrbox: (viewfinderW, viewfinderH) => {
        const size = Math.floor(Math.min(viewfinderW, viewfinderH) * 0.7);
        return { width: size, height: Math.floor(size * 0.55) };
      },
      aspectRatio: 1.4,
    };

    try {
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => this._handleDecoded(decodedText),
        () => { /* frame sin lectura: ignorar, es normal */ }
      );
      this.running = true;
    } catch (err) {
      console.error(err);
      showToast('No se pudo acceder a la camara. Revisa los permisos del navegador.', 'error');
    }
  }

  _handleDecoded(text) {
    const now = Date.now();
    if (text === this._lastText && (now - this._lastScanAt) < this.cooldownMs) {
      return; // evita disparar el mismo codigo repetidamente en frames consecutivos
    }
    this._lastText = text;
    this._lastScanAt = now;
    this.onScan(text);
  }

  async stop() {
    if (!this.running || !this.html5QrCode) return;
    try {
      await this.html5QrCode.stop();
      this.html5QrCode.clear();
    } catch (e) { /* ya estaba detenido */ }
    this.running = false;
  }
}
