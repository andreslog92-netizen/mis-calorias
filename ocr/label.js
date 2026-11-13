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
    const r = { found: [] };

    // Energía: preferimos kcal; si solo hay kJ, convertimos
    const kcalM = t.match(/(\d+(?:[.,]\d+)?)\s*k\s*ca[l1i]/);
    if (kcalM) r.k = parseFloat(kcalM[1].replace(',', '.'));
    else {
      const calLine = lines.map(norm).find(l => /^\W*calories\b/.test(l) && !/from fat/.test(l));
      const kjM = t.match(/(\d+(?:[.,]\d+)?)\s*k\s*j/);
      const cn = calLine && nums(calLine)[0];
      if (cn) r.k = cn.v;
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
        const v = firstG(l.slice(m.index));
        if (v != null) { r[key] = key === 'na' ? v * 1000 : v; r.found.push(key); }
        break;
      }
    }
    if (r.salt == null && r.na != null) r.salt = r.na / 400; // na en mg -> sal en g
    if (r.na == null && r.salt != null) r.na = r.salt * 400;

    // ¿Por 100 g o por ración?
    const per100 = /(por|per)\s*100|100\s*(g|ml)\b|\b100[09]\s*g?\b/.test(t);
    const usFormat = /nutrition facts|serving size|amount per serving/.test(t);
    const servM = t.match(/(?:serving size|racion|porcion)[^\n]{0,30}?\(\s*(\d+?(?:[.,]\d+)?)\s*(g|ml|q|9)\s*\)/) || t.match(/(?:serving size|racion|porcion)[^\d\n]{0,30}(\d+(?:[.,]\d+)?)\s*(g|ml)\b/);
    r.serving = servM ? parseFloat(servM[1].replace(',', '.')) : null;
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
  async function prepImage(file) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const x = c.getContext('2d');
    x.drawImage(bmp, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) a[i] = a[i + 1] = a[i + 2] = (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000;
    x.putImageData(d, 0, 0);
    return c;
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
      await w.setParameters({ tessedit_pageseg_mode: '4' }); // columna única: lo que mejor lee las tablas
      return w;
    })().catch(e => { workerP = null; throw e; });
    return workerP;
  }
  async function readLabel(file, onProgress) {
    const w = await getWorker(onProgress);
    const img = await prepImage(file);
    const { data } = await w.recognize(img);
    return { text: data.text, conf: data.confidence, values: parseLabel(data.text) };
  }

  g.LabelOCR = { parseLabel, readLabel };
  if (typeof module !== 'undefined') module.exports = { parseLabel };
})(typeof window !== 'undefined' ? window : globalThis);
