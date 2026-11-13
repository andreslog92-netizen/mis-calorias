# Mis Calorías

App web (PWA) para contar calorías y macros, en español, con la base oficial **USDA SR28** (8.789 alimentos, 156 con nombre en español).

## Archivos
- `index.html`: la app
- `foods.js`: base de alimentos generada desde USDA (por 100 g)
- `ocr/`: lector de etiquetas (Tesseract.js + modelo de español)
- `manifest.json`, `sw.js`, `icon*`: instalación en el móvil y uso sin conexión
- `tools/build_db.py`: regenera `foods.js` desde `tools/usda-sr28/` (para añadir nombres en español, edita el diccionario `ES`)

## Probar en el ordenador
    cd calorias && python3 -m http.server 8000   # abre http://localhost:8000

## Instalar en el móvil
Súbelo a un hosting HTTPS gratis (GitHub Pages, Netlify Drop, Cloudflare Pages), abre la URL en el móvil y elige
"Añadir a pantalla de inicio". Los datos se guardan solo en tu dispositivo: usa Perfil → Exportar como copia de seguridad.

## Leer etiquetas con foto
En *Añadir → Mis alimentos → 📷 Foto de la etiqueta*. El texto se lee en el propio navegador con
[Tesseract.js](https://github.com/naptha/tesseract.js) (Apache 2.0, archivos en `ocr/`), sin enviar la foto a ningún servidor.
`ocr/label.js` interpreta tablas europeas (por 100 g) y estadounidenses (por ración → convierte a 100 g),
corrige confusiones típicas del OCR ("g" leída como "9", comas perdidas) y comprueba que los macros cuadran con las kcal.
Los valores siempre se revisan antes de guardar. La primera vez descarga ~6 MB.

## En el PC
Abre la URL en Chrome o Edge y pulsa el icono de instalar en la barra de direcciones para tenerla como app de escritorio.
Atajos: `A` o `/` añadir (buscar), `Enter` elige el primer resultado y confirma, `Esc` cierra, `H` hoy, `P` peso, `F` perfil, `←/→` cambiar de día.

## Cálculos
- BMR: Mifflin-St Jeor. TDEE = BMR × factor de actividad.
- Objetivo: TDEE ± (kg/semana × 7700 / 7). Mínimo 1500 kcal (hombre) / 1200 kcal (mujer).
- Proteína en g/kg de peso, grasa en % de kcal, el resto carbohidratos.
