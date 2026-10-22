const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Puertos y ciudades de carga frecuentes → país. Sirve para no depender de que la IA (o el documento) diga el país en cada fila. */
const PAIS_POR_PUERTO: Record<string, string> = {};
const registrar = (pais: string, puertos: string[]) => puertos.forEach((p) => (PAIS_POR_PUERTO[norm(p)] = pais));
registrar("China", ["shanghai", "shenzhen", "qingdao", "tianjin", "tianjing", "ningbo", "xiamen", "dalian", "guangzhou", "nansha", "huangpu", "shekou", "yantian", "foshan", "fuzhou", "lianyungang", "zhongshan", "zhuhai", "wuhan", "nanjing", "taicang", "jiangmen", "xingang", "xiaolan", "humen", "dongguan", "chongqing", "yingkou", "rizhao", "shantou"]);
registrar("Hong Kong", ["hong kong", "hongkong"]);
registrar("Taiwán", ["kaohsiung", "keelung", "taichung", "taipei"]);
registrar("Corea del Sur", ["busan", "pusan", "incheon"]);
registrar("Japón", ["tokyo", "yokohama", "osaka", "kobe", "nagoya"]);
registrar("Vietnam", ["ho chi minh", "hai phong", "haiphong", "cat lai", "da nang", "vung tau"]);
registrar("Tailandia", ["laem chabang", "bangkok"]);
registrar("Malasia", ["port klang", "penang", "tanjung pelepas"]);
registrar("Singapur", ["singapore", "singapur"]);
registrar("Indonesia", ["jakarta", "surabaya", "semarang"]);
registrar("Filipinas", ["manila"]);
registrar("India", ["mumbai", "nhava sheva", "chennai", "mundra", "kolkata"]);
registrar("Sri Lanka", ["colombo"]);
registrar("Pakistán", ["karachi"]);
registrar("Turquía", ["istanbul", "mersin"]);
registrar("Italia", ["genoa", "genova", "la spezia", "naples"]);
registrar("España", ["valencia", "barcelona", "algeciras"]);
registrar("Alemania", ["hamburg", "bremerhaven"]);
registrar("Países Bajos", ["rotterdam"]);
registrar("Bélgica", ["antwerp", "amberes"]);
registrar("Reino Unido", ["felixstowe", "southampton"]);
registrar("Estados Unidos", ["miami", "los angeles", "long beach", "houston", "new york", "savannah", "oakland"]);

const titulo = (s: string) => s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/** País de un puerto conocido (acepta "Shanghai", "shanghai china"...); null si no se reconoce. */
export function paisDePuerto(origen: string): string | null {
  const n = norm(origen);
  if (PAIS_POR_PUERTO[n]) return PAIS_POR_PUERTO[n];
  const palabras = n.split(" ");
  for (let largo = Math.min(3, palabras.length); largo >= 1; largo--) {
    for (let i = 0; i + largo <= palabras.length; i++) {
      const pais = PAIS_POR_PUERTO[palabras.slice(i, i + largo).join(" ")];
      if (pais) return pais;
    }
  }
  return null;
}

/**
 * Una celda de origen con varios puertos ("shanghai shenzhen qingdao tianjing ningbo") son varias rutas, no una.
 * Solo separa cuando TODAS las palabras son puertos conocidos (o hay comas, barras o "/" claros); si no, la deja intacta.
 */
export function separarPuertos(origen: string): string[] {
  const limpio = origen.trim();
  if (!limpio) return [];
  const porSimbolo = limpio.split(/\s*[,/;&+]\s*|\s+y\s+/i).map((x) => x.trim()).filter(Boolean);
  if (porSimbolo.length > 1) return porSimbolo.flatMap((p) => separarPuertos(p));
  const palabras = limpio.split(/\s+/);
  if (palabras.length < 2) return [titulo(limpio)];
  const puertos: string[] = [];
  let i = 0;
  while (i < palabras.length) {
    let encontrado = 0;
    for (let largo = Math.min(3, palabras.length - i); largo >= 1; largo--) {
      if (PAIS_POR_PUERTO[norm(palabras.slice(i, i + largo).join(" "))]) { encontrado = largo; break; }
    }
    if (!encontrado) return [limpio];
    puertos.push(titulo(palabras.slice(i, i + encontrado).join(" ")));
    i += encontrado;
  }
  return puertos;
}
