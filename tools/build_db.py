# Convierte USDA SR28 (ABBREV.txt + FOOD_DES.txt) en foods.js para la app.
# Todos los valores nutricionales salen tal cual del archivo oficial USDA; aquí solo
# se añaden nombres en español para alimentos comunes y se traducen las medidas caseras.
import json, sys, os

D = sys.argv[1] if len(sys.argv) > 1 else 'data/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'foods.js'

# NDB_No -> nombre en español (IDs comprobados contra la descripción oficial USDA)
ES = {
 # Cereales, pan, tubérculos
 '20045': 'Arroz blanco cocido', '20044': 'Arroz blanco crudo', '20037': 'Arroz integral cocido',
 '20121': 'Pasta cocida', '20120': 'Pasta seca (cruda)', '20125': 'Pasta integral cocida',
 '18069': 'Pan blanco de molde', '18070': 'Pan blanco tostado', '18075': 'Pan integral de molde',
 '08120': 'Avena en copos (cruda)', '20137': 'Quinoa cocida', '20035': 'Quinoa cruda',
 '20029': 'Cuscús cocido', '18363': 'Tortilla de maíz', '18364': 'Tortilla de trigo',
 '18228': 'Galletas saladas tipo cracker', '08037': 'Granola',
 '11367': 'Patata cocida sin piel', '11508': 'Boniato / batata asado',
 # Carnes y aves
 '05062': 'Pechuga de pollo cruda', '05747': 'Pechuga de pollo a la plancha',
 '05098': 'Muslo de pollo asado (sin piel)',
 '23562': 'Carne picada de ternera 90/10 cruda', '23565': 'Carne picada de ternera 90/10 cocinada',
 '23572': 'Carne picada de ternera 80/20 cruda', '23575': 'Carne picada de ternera 80/20 cocinada',
 '23625': 'Filete de ternera (solomillo alto) crudo', '23372': 'Solomillo de ternera crudo (magro)',
 '13442': 'Solomillo de ternera a la plancha (magro)',
 '10060': 'Solomillo de cerdo crudo', '10061': 'Solomillo de cerdo asado',
 '07029': 'Jamón cocido / de York', '07081': 'Pechuga de pavo en lonchas', '10123': 'Bacon / panceta crudo',
 # Pescado y marisco
 '15236': 'Salmón crudo', '15237': 'Salmón cocinado', '15121': 'Atún al natural (lata, escurrido)',
 '15119': 'Atún en aceite (lata, escurrido)', '15015': 'Bacalao fresco crudo', '15016': 'Bacalao cocinado',
 '15033': 'Eglefino / pescado blanco crudo', '15261': 'Tilapia cruda', '15046': 'Caballa cruda',
 '15088': 'Sardinas en aceite (lata, escurridas)', '15270': 'Gambas / camarones crudos',
 '15271': 'Gambas / camarones cocidos', '15175': 'Calamar crudo', '15166': 'Pulpo crudo',
 '15164': 'Mejillones crudos',
 '15091': 'Lubina cruda', '15092': 'Lubina cocinada', '15028': 'Lenguado / platija crudo', '15029': 'Lenguado / platija cocinado',
 '15240': 'Trucha arcoíris (piscifactoría) cruda', '15001': 'Boquerón / anchoa fresco crudo', '15002': 'Anchoas en aceite (lata, escurridas)',
 '07019': 'Chorizo (cerdo y ternera)',
 # Huevos y lácteos
 '01123': 'Huevo entero crudo', '01129': 'Huevo cocido', '01128': 'Huevo frito', '01124': 'Clara de huevo',
 '01077': 'Leche entera', '01082': 'Leche semidesnatada (1%)', '01079': 'Leche semidesnatada (2%)', '01085': 'Leche desnatada', '01116': 'Yogur natural entero',
 '01256': 'Yogur griego natural 0%', '01293': 'Yogur griego natural entero',
 '01015': 'Queso cottage / requesón (2%)', '01037': 'Ricotta semidesnatada', '01009': 'Queso cheddar',
 '01026': 'Queso mozzarella', '01033': 'Queso parmesano', '01019': 'Queso feta', '01017': 'Queso crema',
 '01053': 'Nata para montar', '01001': 'Mantequilla con sal', '19095': 'Helado de vainilla',
 # Aceites y grasas
 '04053': 'Aceite de oliva', '09037': 'Aguacate', '09193': 'Aceitunas negras', '06931': 'Salsa de tomate para pasta',
 # Frutas
 '09003': 'Manzana con piel', '09040': 'Plátano / banana', '09200': 'Naranja', '09218': 'Mandarina',
 '09316': 'Fresas', '09132': 'Uvas', '09252': 'Pera', '09236': 'Melocotón', '09266': 'Piña',
 '09326': 'Sandía', '09181': 'Melón cantalupo', '09148': 'Kiwi', '09176': 'Mango', '09050': 'Arándanos',
 '09070': 'Cerezas', '09206': 'Zumo de naranja natural',
 # Verduras
 '11529': 'Tomate', '11253': 'Lechuga de hoja verde', '11251': 'Lechuga romana', '11457': 'Espinacas crudas',
 '11458': 'Espinacas cocidas', '11090': 'Brócoli crudo', '11091': 'Brócoli cocido', '11124': 'Zanahoria',
 '11282': 'Cebolla', '11821': 'Pimiento rojo', '11333': 'Pimiento verde', '11205': 'Pepino con piel',
 '11477': 'Calabacín', '11209': 'Berenjena', '11260': 'Champiñones', '11215': 'Ajo',
 '11135': 'Coliflor', '11052': 'Judías verdes crudas', '11053': 'Judías verdes cocidas',
 '11313': 'Guisantes cocidos', '11172': 'Maíz dulce en lata (escurrido)',
 # Legumbres y derivados
 '16057': 'Garbanzos cocidos', '16358': 'Garbanzos en bote (escurridos)', '16070': 'Lentejas cocidas',
 '16015': 'Frijoles / alubias negras cocidas', '16033': 'Alubias rojas cocidas', '16050': 'Alubias blancas cocidas',
 '16426': 'Tofu firme', '16120': 'Bebida de soja (sin azúcar añadido)', '16158': 'Hummus',
 # Frutos secos y semillas
 '12061': 'Almendras', '12155': 'Nueces', '12087': 'Anacardos crudos', '12151': 'Pistachos crudos',
 '12120': 'Avellanas', '16087': 'Cacahuetes crudos', '16390': 'Cacahuetes tostados sin sal',
 '16398': 'Crema de cacahuete (sin sal)', '12006': 'Semillas de chía', '12220': 'Semillas de lino',
 '12036': 'Pipas de girasol peladas',
 # Dulces, bebidas, otros
 '19335': 'Azúcar blanco', '19296': 'Miel', '19297': 'Mermelada', '19904': 'Chocolate negro 70-85%',
 '19165': 'Cacao puro en polvo', '18159': 'Galletas con pepitas de chocolate', '18155': 'Galletas de mantequilla',
 '19411': 'Patatas fritas de bolsa', '11935': 'Kétchup', '14209': 'Café solo', '14091': 'Bebida de almendra sin azúcar',
 '14058': 'Proteína whey isolate (polvo)', '14003': 'Cerveza', '14096': 'Vino tinto',
 '14037': 'Destilados (ron, vodka, whisky, ginebra)', '21224': 'Pizza de queso (congelada, horneada)',
 '21107': 'Hamburguesa simple (comida rápida)',
}

GROUPS = {
 '0100': 'Lácteos y huevos', '0200': 'Especias y hierbas', '0300': 'Alimentos infantiles', '0400': 'Grasas y aceites',
 '0500': 'Aves', '0600': 'Sopas y salsas', '0700': 'Embutidos y fiambres', '0800': 'Cereales de desayuno',
 '0900': 'Frutas', '1000': 'Cerdo', '1100': 'Verduras', '1200': 'Frutos secos y semillas', '1300': 'Ternera / vacuno',
 '1400': 'Bebidas', '1500': 'Pescados y mariscos', '1600': 'Legumbres', '1700': 'Cordero, ternera lechal y caza',
 '1800': 'Panadería y bollería', '1900': 'Dulces', '2000': 'Cereales y pasta', '2100': 'Comida rápida',
 '2200': 'Platos preparados', '2500': 'Snacks', '3500': 'Alimentos nativos americanos', '3600': 'Restaurantes',
}

UNITS = [  # traducción simple de medidas caseras USDA
 ('tbsp', 'cda'), ('tsp', 'cdta'), ('cup', 'taza'), ('slice', 'rebanada'), ('large', 'grande'),
 ('medium', 'mediano'), ('small', 'pequeño'), ('extra large', 'extra grande'), ('piece', 'pieza'),
 ('serving', 'ración'), ('fl oz', 'oz líq.'), ('oz', 'oz'), ('package', 'paquete'), ('container', 'envase'),
 ('fillet', 'filete'), ('breast', 'pechuga'), ('egg', 'huevo'), ('can', 'lata'), ('stalk', 'tallo'),
 ('leaf', 'hoja'), ('clove', 'diente'), ('fruit', 'fruta'), ('whole', 'entero'), ('chopped', 'picado'),
 ('sliced', 'en rodajas'), ('diced', 'en dados'), ('pat', 'porción'), ('stick', 'barra'),
]

def tr_unit(s):
    import re
    out = s
    for en, es in UNITS:
        out = re.sub(r'\b' + re.escape(en) + r's?\b', es, out)
    return out

def num(x):
    x = x.strip()
    return float(x) if x else None

def r(x, nd=1):
    if x is None: return None
    v = round(x, nd)
    return int(v) if v == int(v) else v

des = {}
for line in open(os.path.join(D, 'FOOD_DES.txt'), encoding='latin-1'):
    f = line.rstrip('\r\n').split('^')
    des[f[0].strip('~')] = (f[1].strip('~'), f[2].strip('~'))

foods = []
seen_es = set()
for line in open(os.path.join(D, 'ABBREV.txt'), encoding='latin-1'):
    f = line.rstrip('\r\n').split('^')
    assert len(f) == 53, line[:40]
    i = f[0].strip('~')
    grp, long_desc = des[i]
    kcal = num(f[3])
    if kcal is None: continue
    sv = []
    for gi, di in ((48, 49), (50, 51)):
        g, d = num(f[gi]), f[di].strip('~').strip()
        if g and d: sv.append([r(g), tr_unit(d)])
    item = {
        'id': i, 'en': long_desc, 'g': grp,
        'k': r(kcal, 0), 'p': r(num(f[4])), 'f': r(num(f[5])), 'c': r(num(f[7])),
        'fi': r(num(f[8])), 'su': r(num(f[9])), 'na': r(num(f[15]), 0),
        'sf': r(num(f[44])),
    }
    if sv: item['s'] = sv
    if i in ES:
        item['es'] = ES[i]; seen_es.add(i)
    foods.append({k: v for k, v in item.items() if v is not None})

missing = set(ES) - seen_es
assert not missing, f'IDs no encontrados: {missing}'

# Sanity check: kcal ≈ Atwater (4P + 4C + 9F) para los alimentos traducidos
for x in foods:
    if 'es' in x:
        est = 4 * x.get('p', 0) + 4 * x.get('c', 0) + 9 * x.get('f', 0)
        if x['k'] > 20 and abs(est - x['k']) / x['k'] > 0.25 and x['id'] not in ('14003', '14096', '14037'):
            print('AVISO kcal no cuadra', x['id'], x['es'], x['k'], round(est), file=sys.stderr)

with open(OUT, 'w', encoding='utf-8') as o:
    o.write('// Fuente: USDA National Nutrient Database for Standard Reference, Release 28 (SR28).\n')
    o.write('// Valores por 100 g de porción comestible. Dominio público (USDA ARS).\n')
    o.write('window.FOOD_GROUPS=' + json.dumps(GROUPS, ensure_ascii=False) + ';\n')
    o.write('window.FOODS=' + json.dumps(foods, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'{len(foods)} alimentos, {len(seen_es)} con nombre en español -> {OUT} ({os.path.getsize(OUT)//1024} KB)')
