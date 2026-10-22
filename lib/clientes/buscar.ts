const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return fila[b.length];
}

export const mismoNombre = (a: string, b: string) => norm(a) === norm(b);

/**
 * ¿"Cemaco" es el cliente guardado como "camaco"? Ignora mayúsculas, acentos y símbolos, acepta que uno contenga al otro
 * y tolera una letra equivocada (dos en nombres largos) para que un error de dedo no haga "desaparecer" a un cliente.
 */
export function nombreSimilar(buscado: string, nombre: string): boolean {
  const q = norm(buscado);
  const n = norm(nombre);
  if (!q || !n) return false;
  if (n.includes(q) || q.includes(n)) return true;
  const palabrasQ = q.split(" ").filter((w) => w.length >= 3);
  const palabrasN = n.split(" ").filter((w) => w.length >= 3);
  return (
    palabrasQ.length > 0 &&
    palabrasQ.every((a) => palabrasN.some((b) => a === b || (Math.min(a.length, b.length) >= 4 && distancia(a, b) <= (Math.max(a.length, b.length) >= 8 ? 2 : 1))))
  );
}

/** Clientes que se parecen a lo escrito; primero los de nombre idéntico. */
export function clientesSimilares<T extends { nombre: string; empresa?: string | null }>(buscado: string, clientes: T[]): T[] {
  return clientes
    .filter((c) => nombreSimilar(buscado, c.nombre) || (c.empresa ? nombreSimilar(buscado, c.empresa) : false))
    .sort((a, b) => Number(mismoNombre(buscado, b.empresa || b.nombre) || mismoNombre(buscado, b.nombre)) - Number(mismoNombre(buscado, a.empresa || a.nombre) || mismoNombre(buscado, a.nombre)));
}
