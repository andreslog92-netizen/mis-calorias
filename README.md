# Mis Calorías

App web (PWA) para contar calorías y macros, en español, con la base oficial **USDA SR28** (8.789 alimentos, 156 con nombre en español).

## Archivos
- `index.html`: la app
- `foods.js`: base de alimentos generada desde USDA (por 100 g)
- `manifest.json`, `sw.js`, `icon*`: instalación en el móvil y uso sin conexión
- `tools/build_db.py`: regenera `foods.js` desde `tools/usda-sr28/` (para añadir nombres en español, edita el diccionario `ES`)

## Probar en el ordenador
    cd calorias && python3 -m http.server 8000   # abre http://localhost:8000

## Instalar en el móvil
Súbelo a un hosting HTTPS gratis (GitHub Pages, Netlify Drop, Cloudflare Pages), abre la URL en el móvil y elige
"Añadir a pantalla de inicio". Los datos se guardan solo en tu dispositivo: usa Perfil → Exportar como copia de seguridad.

## Cálculos
- BMR: Mifflin-St Jeor. TDEE = BMR × factor de actividad.
- Objetivo: TDEE ± (kg/semana × 7700 / 7). Mínimo 1500 kcal (hombre) / 1200 kcal (mujer).
- Proteína en g/kg de peso, grasa en % de kcal, el resto carbohidratos.
