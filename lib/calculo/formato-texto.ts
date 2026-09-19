/**
 * Formato ligero para las notas del PDF: **negrita**, __subrayado__, ==resaltado==.
 * Se guarda como texto plano con estas marcas y se convierte a segmentos para el PDF o la pantalla.
 */
export interface Segmento {
  texto: string;
  negrita: boolean;
  subrayado: boolean;
  resaltado: boolean;
}

const MARCAS: { token: string; clave: keyof Omit<Segmento, "texto"> }[] = [
  { token: "**", clave: "negrita" },
  { token: "__", clave: "subrayado" },
  { token: "==", clave: "resaltado" },
];

export function segmentar(texto: string): Segmento[] {
  const out: Segmento[] = [];
  const estado = { negrita: false, subrayado: false, resaltado: false };
  let buffer = "";
  const vaciar = () => {
    if (buffer) out.push({ texto: buffer, ...estado });
    buffer = "";
  };
  let i = 0;
  while (i < texto.length) {
    const marca = MARCAS.find((m) => texto.startsWith(m.token, i));
    if (marca) {
      vaciar();
      estado[marca.clave] = !estado[marca.clave];
      i += 2;
    } else {
      buffer += texto[i];
      i += 1;
    }
  }
  vaciar();
  return out;
}

/** Texto sin marcas (para buscar, o cuando no se puede dar formato). */
export const textoPlano = (texto: string) => segmentar(texto).map((s) => s.texto).join("");

/** Envuelve la selección [ini, fin) con una marca; si ya está envuelta exactamente, la quita. */
export function alternarMarca(texto: string, ini: number, fin: number, token: string): { texto: string; ini: number; fin: number } {
  if (fin <= ini) return { texto, ini, fin };
  const antes = texto.slice(0, ini);
  const sel = texto.slice(ini, fin);
  const despues = texto.slice(fin);
  if (antes.endsWith(token) && despues.startsWith(token)) {
    return { texto: antes.slice(0, -2) + sel + despues.slice(2), ini: ini - 2, fin: fin - 2 };
  }
  if (sel.startsWith(token) && sel.endsWith(token) && sel.length >= 4) {
    return { texto: antes + sel.slice(2, -2) + despues, ini, fin: fin - 4 };
  }
  return { texto: antes + token + sel + token + despues, ini: ini + 2, fin: fin + 2 };
}
