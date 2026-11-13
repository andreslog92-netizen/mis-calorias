// Lectura de tablas nutricionales a partir de una foto (OCR con Tesseract.js, todo en el navegador).
// parseLabel() convierte el texto reconocido en valores por 100 g.
(function (g) {
  'use strict';
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Números: acepta "6,5", "6.5", "<0,5", y corrige confusiones típicas del OCR (O->0, l/I->1)
  const NUM = /(?:<\s*)?(\d+(?:[.,]\d+)?|[oO](?:[.,]\d+))\s*(k?j|kcal|mg|g|q|%)?(?![a-z])/g;
  function nums(s, gFix) {
    const out = [];
    let m;
    s = s.replace(/(\d)\s+[,.]\s*(\d)/g, '$1,$2');     // "6 ,5" -> "6,5"
    if (gFix) s = s.replace(/(\d)\s+9(?![\d.,])(?!\s*(?:g|mg|kcal|kj|%))/g, '$1 g'); // "0,65 9" -> "0,65 g" (la g leída como 9 suelto)
    NUM.lastIndex = 0;
    while ((m = NUM.exec(s))) {
      let n = m[1].replace(/^[oO]/, '0'), u = (m[2] || '').toLowerCase();
      if (u === 'q') u = 'g';
      // El OCR suele leer "4,9 g" como "4,99" o "17 g" como "179": un número sin unidad que acaba en 9 -> quitar el 9 final
      if (!u && gFix && n.length >= 2 && n.endsWith('9') && !/[.,]$/.test(n.slice(0, -1))) { n = n.slice(0, -1); u = 'g'; }
      const v = parseFloat(n.replace(',', '.'));
      if (!isNaN(v)) out.push({ v, u, i: m.index });
    }
    return out;
  }
  // Primer valor en gramos (o sin unidad) de una línea, ignorando porcentajes de CDR/IR
  function firstG(s) {
    const n = nums(s, true).filter(x => x.u !== '%' && x.u !== 'kj' && x.u !== 'kcal');
    const withG = n.find(x => x.u === 'g' || x.u === 'mg');
    const x = withG || n[0];
    if (!x) return null;
    return x.u === 'mg' ? x.v / 1000 : x.v;
  }

  // Todos los valores en gramos de una línea (una entrada por columna: por 100 g / por ración)
  function allG(s) {
    return nums(s, true).filter(x => x.u !== '%' && x.u !== 'kj' && x.u !== 'kcal').map(x => x.u === 'mg' ? x.v / 1000 : x.v);
  }

  const RULES = [ // orden importante: lo más específico primero
    ['sf', /saturad|saturat/],
    ['su', /azucar|azuc|sugars?\b/],
    ['fi', /fibra|fiber|fibre/],
    ['f',  /grasa|lipid|total fat|^fat\b|\bfat\b/],
    ['c',  /hidrat|carbohidrat|carbohydrat|carbs?\b/],
    ['p',  /prote/],
    ['salt', /^\W*sal\b|\bsal\s*\d|\bsalt\b/],
    ['na', /sodio|sodium/],
  ];

  function parseLabel(text) {
    const raw = text || '';
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const t = norm(raw);
    const r = { found: [] }, col2 = {};

    // Energía: preferimos kcal; si solo hay kJ, convertimos
    const kcalM = t.match(/(\d+(?:[.,]\d+)?)\s*k\s*ca[l1i]/);
    if (kcalM) r.k = parseFloat(kcalM[1].replace(',', '.'));
    else {
      const calLine = lines.map(norm).find(l => /^\W*(calories|calorias)\b/.test(l) && !/from fat|de grasa/.test(l));
      const kjM = t.match(/(\d+(?:[.,]\d+)?)\s*k\s*j/);
      const cns = calLine ? nums(calLine.replace(/\(?kcal\)?/g, '')) : [];
      if (cns.length) { r.k = cns[0].v; if (cns[1]) col2.k = cns[1].v; }
      else if (kjM) { r.k = Math.round(parseFloat(kjM[1].replace(',', '.')) / 4.184); r.fromKJ = true; }
    }

    for (const line of lines) {
      const l = norm(line);
      if (/energ|kcal|\bkj\b/.test(l) && !/grasa|prote|hidrat|carbo|fat/.test(l)) continue;
      for (const [key, re] of RULES) {
        if (!re.test(l)) continue;
        if (key === 'f' && /saturad|trans|insatur|mono|poli|poly/.test(l)) break;
        if (key === 'c' && /azuc|sugar|fibra|fiber|poliol/.test(l)) break;
        if (r[key] != null) break;
        // número tras la etiqueta (evita confundir con texto previo)
        const m = l.match(re);
        const rest = l.slice(m.index), v = firstG(rest), all = allG(rest);
        if (v != null) { r[key] = key === 'na' ? v * 1000 : v; r.found.push(key); }
        if (all.length >= 2) col2[key] = key === 'na' ? all[1] * 1000 : all[1];
        break;
      }
    }
    if (r.salt == null && r.na != null) r.salt = r.na / 400; // na en mg -> sal en g
    if (r.na == null && r.salt != null) r.na = r.salt * 400;

    // ¿Por 100 g o por ración?
    const per100 = /(por|per)\s*100|100\s*(g|ml)\b|\b100[09]\s*g?\b/.test(t);
    const usFormat = /nutrition facts|serving size|amount per serving/.test(t);
    const servM = t.match(/(?:serving size|racion|porcion)[^\n]{0,30}?\(\s*(\d+?(?:[.,]\d+)?)\s*(g|ml|q|9)\s*\)/) || t.match(/(?:serving size|racion|porcion)[^\d\n]{0,30}(\d+?(?:[.,]\d+)?)\s*(g|ml|q|9)\b/);
    r.serving = servM ? parseFloat(servM[1].replace(',', '.')) : null;
    const servUnit = servM ? (servM[2] === 'ml' ? 'ml' : 'g') : null;
    // Caso típico de batidos/polvos: columna "por 100 mL" (producto preparado) pero porción en gramos de polvo.
    // Para registrar el polvo en gramos usamos la columna "por porción" y la pasamos a 100 g.
    if (/100\s*ml/.test(t) && !/100\s*g\b/.test(t) && servUnit === 'g' && r.serving && ['k', 'p', 'c', 'f'].filter(k => col2[k] != null).length >= 3) {
      const f = 100 / r.serving;
      for (const k of ['k', 'p', 'c', 'su', 'f', 'sf', 'fi', 'na']) r[k] = col2[k] != null ? Math.round(col2[k] * f * 10) / 10 : null;
      for (const k in r) if (r[k] === null) delete r[k];
      r.salt = r.na != null ? Math.round(r.na / 400 * 100) / 100 : undefined; if (r.salt === undefined) delete r.salt;
      r.fromServingCol = true; r.converted = true;
      r.per100 = true;
      check(r);
      return r;
    }
    if (usFormat && !per100) {
      r.perServing = true;
      if (r.serving) { // convertir a 100 g
        const f = 100 / r.serving;
        for (const k of ['k', 'p', 'c', 'su', 'f', 'sf', 'fi', 'salt', 'na']) if (r[k] != null) r[k] = Math.round(r[k] * f * 10) / 10;
        r.converted = true;
      }
    }
    r.per100 = per100;
    check(r);
    return r;
  }

  // Comprueba que los macros cuadran con las kcal (4/4/9 kcal por g, fibra 2) y corrige comas perdidas ("85" -> "8,5")
  const atw = r => 4 * (r.p || 0) + 4 * (r.c || 0) + 9 * (r.f || 0) + 2 * (r.fi || 0);
  const err = r => Math.abs(atw(r) - r.k) / r.k;
  function check(r) {
    r.fixed = []; r.suspect = [];
    for (const k of ['sf', 'su']) { const parent = k === 'sf' ? 'f' : 'c'; if (r[k] != null && r[parent] != null && r[k] > r[parent] && r[k] / 10 <= r[parent]) { r.fixed.push([k, r[k], r[k] / 10]); r[k] = r[k] / 10; } }
    if (r.k == null || r.k < 20) return;
    for (let pass = 0; pass < 2 && err(r) > 0.12; pass++) {
      let best = null;
      for (const k of ['p', 'c', 'f', 'fi']) {
        if (r[k] == null || r[k] < 10) continue;
        const t = Object.assign({}, r, { [k]: r[k] / 10 });
        if (err(t) < 0.08 && (!best || err(t) < best[1])) best = [k, err(t)];
      }
      if (!best) break;
      r.fixed.push([best[0], r[best[0]], r[best[0]] / 10]); r[best[0]] = r[best[0]] / 10;
    }
    if (['p', 'c', 'f'].every(k => r[k] != null) && err(r) > 0.15) r.mismatch = Math.round(atw(r));
    for (const k of ['p', 'c', 'f', 'fi', 'su', 'sf']) if (r[k] != null && r[k] > 100) r.suspect.push(k);
  }

  // Mejora la foto para el OCR: escala a ~1800 px, escala de grises y estira el contraste
  // Prepara la foto: tamaño adecuado para el OCR, escala de grises y (opcional) borrar las líneas de la tabla,
  // que confunden al lector y le hacen saltarse celdas.
  async function loadImage(file) {
    const bmp = await createImageBitmap(file);
    const L = Math.max(bmp.width, bmp.height);
    // fotos grandes: reducir a 2200 px; capturas o fotos pequeñas: ampliar hasta ×6 (el OCR necesita letras grandes)
    const s = L > 2200 ? 2200 / L : L < 1500 ? Math.min(6, 2000 / L) : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(bmp, 0, 0, c.width, c.height);
    const W = c.width, H = c.height, a = x.getImageData(0, 0, W, H).data, gray = new Uint8ClampedArray(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = (a[i * 4] * 299 + a[i * 4 + 1] * 587 + a[i * 4 + 2] * 114) / 1000;
    return { W, H, gray, srcW: bmp.width, srcH: bmp.height };
  }
  function toCanvas(img, removeLines) {
    const { W, H } = img, g = Uint8ClampedArray.from(img.gray);
    if (removeLines) {
      let sum = 0; for (let i = 0; i < W * H; i++) sum += g[i];
      const thr = Math.min(160, sum / (W * H) * 0.75), kill = new Uint8Array(W * H);
      const minH = Math.max(40, W * 0.2), minV = Math.max(40, H * 0.12);
      for (let y = 0; y < H; y++) { let st = -1; for (let x = 0; x <= W; x++) { const dk = x < W && img.gray[y * W + x] < thr; if (dk && st < 0) st = x; if (!dk && st >= 0) { if (x - st >= minH) for (let k = st; k < x; k++) kill[y * W + k] = 1; st = -1; } } }
      for (let x = 0; x < W; x++) { let st = -1; for (let y = 0; y <= H; y++) { const dk = y < H && img.gray[y * W + x] < thr; if (dk && st < 0) st = y; if (!dk && st >= 0) { if (y - st >= minV) for (let k = st; k < y; k++) kill[k * W + x] = 1; st = -1; } } }
      for (let i = 0; i < W * H; i++) if (kill[i]) g[i] = 255;
    }
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), d = x.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = g[i]; d.data[i * 4 + 3] = 255; }
    x.putImageData(d, 0, 0);
    return c;
  }
  // Puntuación de una lectura: campos encontrados y que los macros cuadren con las kcal
  function score(v) {
    const keys = ['k', 'p', 'c', 'f', 'sf', 'su', 'fi', 'salt'];
    let sc = keys.filter(k => v[k] != null).length * 10;
    if (v.k == null) sc -= 15;
    if (v.k > 0 && ['p', 'c', 'f'].every(k => v[k] != null)) sc -= Math.min(40, err(v) * 150); else sc -= 10;
    sc -= (v.fixed || []).length * 4 + (v.suspect || []).length * 10;
    return sc;
  }

  let workerP = null;
  function loadScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  }
  async function getWorker(onProgress) {
    if (!workerP) workerP = (async () => {
      if (!g.Tesseract) await loadScript('ocr/tesseract.min.js');
      const base = new URL('ocr/', location.href).href;
      const w = await g.Tesseract.createWorker('spa', 1, {
        workerPath: base + 'worker.min.js', corePath: base, langPath: base + 'lang',
        logger: m => onProgress && onProgress(m),
      });
      return w;
    })().catch(e => { workerP = null; throw e; });
    return workerP;
  }
  // Varias pasadas (con/sin líneas de tabla, dos modos de segmentación); se queda con la más coherente
  const PASSES = [[true, '6'], [false, '4'], [true, '4'], [false, '6']];
  async function readLabel(file, onProgress) {
    const w = await getWorker(onProgress);
    const img = await loadImage(file);
    let best = null;
    for (let i = 0; i < PASSES.length; i++) {
      const [rm, psm] = PASSES[i];
      onProgress && onProgress({ status: 'pass', pass: i + 1, total: PASSES.length, progress: i / PASSES.length });
      await w.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await w.recognize(toCanvas(img, rm));
      const values = parseLabel(data.text), sc = score(values);
      if (!best || sc > best.score) best = { text: data.text, conf: data.confidence, values, score: sc };
      if (sc >= 70) break; // lectura completa y coherente: no hace falta seguir
    }
    best.small = Math.max(img.srcW, img.srcH) < 700 && best.score < 60 ? [img.srcW, img.srcH] : null;
    return best;
  }

  g.LabelOCR = { parseLabel, readLabel };
  if (typeof module !== 'undefined') module.exports = { parseLabel };
})(typeof window !== 'undefined' ? window : globalThis);
