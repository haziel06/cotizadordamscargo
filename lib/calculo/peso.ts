export type GanadorPeso = "real" | "volumetrico" | "empate";

/** Peso a cobrar = MAX(peso real, peso volumétrico) (spec §5.1). */
export function pesoCobrable(
  real: number | null | undefined,
  volumetrico: number | null | undefined,
): { peso: number; gano: GanadorPeso } {
  const r = real ?? 0;
  const v = volumetrico ?? 0;
  if (r > v) return { peso: r, gano: "real" };
  if (v > r) return { peso: v, gano: "volumetrico" };
  return { peso: r, gano: "empate" };
}
