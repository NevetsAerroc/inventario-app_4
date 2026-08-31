// ============================================================
// Recortador simple de fotos: se muestra la foto a pantalla completa,
// el usuario arrastra un recuadro sobre el codigo de barras y confirma.
// Devuelve un File recortado y ampliado, listo para
// BarcodeScanner.scanearDesdeArchivo().
// ============================================================

function mostrarRecortador(file) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black z-[100] flex flex-col';
    overlay.innerHTML = `
      <div class="flex-1 relative overflow-hidden flex items-center justify-center touch-none p-2" id="recorte-stage">
        <img id="recorte-img" class="max-w-full max-h-full w-auto h-auto object-contain select-none pointer-events-none" draggable="false" />
        <div id="recorte-caja" class="absolute border-2 border-emerald-400 bg-emerald-400/10 hidden"></div>
      </div>
      <div class="p-3 bg-slate-900 space-y-2">
        <p class="text-xs text-slate-300 text-center">Arrastra un recuadro justo sobre el codigo de barras</p>
        <div class="grid grid-cols-2 gap-2">
          <button id="recorte-cancelar" class="py-2.5 rounded-lg bg-slate-700 text-white font-semibold text-sm">Cancelar</button>
          <button id="recorte-usar" class="py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm disabled:opacity-40" disabled>Usar recorte</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const img = overlay.querySelector('#recorte-img');
    const stage = overlay.querySelector('#recorte-stage');
    const caja = overlay.querySelector('#recorte-caja');
    const btnUsar = overlay.querySelector('#recorte-usar');
    const btnCancelar = overlay.querySelector('#recorte-cancelar');

    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    let seleccion = null;
    let arrastrando = false;
    let inicioX = 0, inicioY = 0;

    function posDesdeEvento(e) {
      const rect = stage.getBoundingClientRect();
      const punto = e.touches ? e.touches[0] : e;
      return { x: punto.clientX - rect.left, y: punto.clientY - rect.top };
    }

    function iniciar(e) {
      e.preventDefault();
      const p = posDesdeEvento(e);
      inicioX = p.x; inicioY = p.y;
      arrastrando = true;
      caja.classList.remove('hidden');
      actualizarCaja(p.x, p.y, 0, 0);
    }
    function mover(e) {
      if (!arrastrando) return;
      e.preventDefault();
      const p = posDesdeEvento(e);
      const left = Math.min(inicioX, p.x);
      const top = Math.min(inicioY, p.y);
      const width = Math.abs(p.x - inicioX);
      const height = Math.abs(p.y - inicioY);
      actualizarCaja(left, top, width, height);
    }
    function actualizarCaja(left, top, width, height) {
      caja.style.left = left + 'px';
      caja.style.top = top + 'px';
      caja.style.width = width + 'px';
      caja.style.height = height + 'px';
      seleccion = { left, top, width, height };
      btnUsar.disabled = !(width > 20 && height > 10);
    }
    function terminar() { arrastrando = false; }

    stage.addEventListener('mousedown', iniciar);
    stage.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', terminar);
    stage.addEventListener('touchstart', iniciar, { passive: false });
    stage.addEventListener('touchmove', mover, { passive: false });
    stage.addEventListener('touchend', terminar);

    function limpiar() {
      URL.revokeObjectURL(objectUrl);
      overlay.remove();
    }

    btnCancelar.addEventListener('click', () => { limpiar(); resolve(null); });

    btnUsar.addEventListener('click', () => {
      if (!seleccion) { limpiar(); resolve(null); return; }

      // Convierte la seleccion (coordenadas de pantalla) a coordenadas
      // reales de la imagen, usando la escala mostrado vs. natural.
      const rectImg = img.getBoundingClientRect();
      const rectStage = stage.getBoundingClientRect();
      const imgLeftEnStage = rectImg.left - rectStage.left;
      const imgTopEnStage = rectImg.top - rectStage.top;
      const escalaX = img.naturalWidth / rectImg.width;
      const escalaY = img.naturalHeight / rectImg.height;

      let sx = (seleccion.left - imgLeftEnStage) * escalaX;
      let sy = (seleccion.top - imgTopEnStage) * escalaY;
      let sw = seleccion.width * escalaX;
      let sh = seleccion.height * escalaY;

      // IMPORTANTE: todo codigo de barras necesita una "zona muda" (margen
      // en blanco) a los lados para que el lector detecte donde empieza y
      // termina. Si el recuadro quedo pegado a las barras, agregamos ese
      // margen automaticamente (mas en horizontal, que es donde mas se nota).
      const margenX = sw * 0.25;
      const margenY = sh * 0.6;
      sx = Math.max(0, sx - margenX);
      sy = Math.max(0, sy - margenY);
      sw = Math.min(img.naturalWidth - sx, sw + margenX * 2);
      sh = Math.min(img.naturalHeight - sy, sh + margenY * 2);

      // Ampliamos el recorte solo si hace falta (el codigo suele quedar
      // chico en la foto original), apuntando a un ancho minimo comodo.
      const anchoObjetivo = 900;
      const factorAmpliado = sw < anchoObjetivo ? anchoObjetivo / sw : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(sw * factorAmpliado);
      canvas.height = Math.round(sh * factorAmpliado);
      const ctx = canvas.getContext('2d');
      // Sin suavizado: para codigos de barras interesan bordes nitidos
      // (negro/blanco marcado), no una interpolacion que los difumine.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        limpiar();
        if (!blob) { resolve(null); return; }
        resolve(new File([blob], 'recorte.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.95);
    });
  });
}