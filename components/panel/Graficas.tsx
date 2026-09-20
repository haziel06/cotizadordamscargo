import { cn } from "@/lib/utils";

/** Gráficas SVG ligeras (sin dependencias) para el panel de inicio. Paleta fija de la marca. */
export const PALETA = ["#1F3864", "#2E7D4F", "#E8A33D", "#3B82F6", "#DC2626", "#7C3AED", "#0891B2", "#6B7280"];

export function BarrasVerticales({ datos, alto = 120, etiquetaCada = 1, formato }: {
  datos: { etiqueta: string; valor: number; secundario?: number; titulo?: string }[];
  alto?: number;
  etiquetaCada?: number;
  formato?: (v: number) => string;
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const ancho = 100 / datos.length;
  const lineas = [0.25, 0.5, 0.75, 1];
  return (
    <div>
      <svg viewBox={`0 0 100 ${alto}`} preserveAspectRatio="none" className="h-36 w-full">
        {lineas.map((f) => (
          <line key={f} x1={0} x2={100} y1={alto - f * (alto - 10)} y2={alto - f * (alto - 10)} stroke="#E5E7EB" strokeWidth={0.3} strokeDasharray="1 1" />
        ))}
        {datos.map((d, i) => {
          const h = (d.valor / max) * (alto - 10);
          const h2 = d.secundario ? (d.secundario / max) * (alto - 10) : 0;
          return (
            <g key={i}>
              <title>{d.titulo ?? `${d.etiqueta}: ${formato ? formato(d.valor) : d.valor}`}</title>
              <rect x={i * ancho + ancho * 0.2} y={alto - h} width={ancho * 0.6} height={h} rx={0.8} fill={PALETA[0]} opacity={0.85} />
              {h2 > 0 && <rect x={i * ancho + ancho * 0.2} y={alto - h2} width={ancho * 0.6} height={h2} rx={0.8} fill={PALETA[1]} />}
              {d.valor > 0 && datos.length <= 14 && (
                <text x={i * ancho + ancho / 2} y={alto - h - 2} fontSize={3.2} textAnchor="middle" fill="#374151" style={{ fontWeight: 600 }}>{d.valor}</text>
              )}
            </g>
          );
        })}
        <line x1={0} x2={100} y1={alto} y2={alto} stroke="#9CA3AF" strokeWidth={0.4} />
      </svg>
      <div className="mt-1 grid text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${datos.length}, minmax(0, 1fr))` }}>
        {datos.map((d, i) => (
          <span key={i} className="truncate text-center">{i % etiquetaCada === 0 ? d.etiqueta : ""}</span>
        ))}
      </div>
    </div>
  );
}

export function BarrasHorizontales({ datos, formato }: { datos: { etiqueta: string; valor: number; detalle?: string; color?: string }[]; formato?: (v: number) => string }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  if (!datos.length) return <p className="text-sm text-muted-foreground">Sin datos todavía.</p>;
  return (
    <ul className="space-y-2.5">
      {datos.map((d, i) => (
        <li key={i} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{d.etiqueta}</span>
            <span className="num shrink-0 text-xs text-muted-foreground">{d.detalle ?? (formato ? formato(d.valor) : d.valor)}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, (d.valor / max) * 100)}%`, backgroundColor: d.color ?? PALETA[i % PALETA.length] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Gráfica de dona con leyenda. `total` al centro. */
export function Dona({ datos, formato, centroTitulo }: {
  datos: { etiqueta: string; valor: number; color?: string; detalle?: string }[];
  formato?: (v: number) => string;
  centroTitulo?: string;
}) {
  const total = datos.reduce((s, d) => s + d.valor, 0);
  if (!total) return <p className="text-sm text-muted-foreground">Sin datos todavía.</p>;
  const R = 40, r = 26, C = 50;
  const visibles = datos.filter((d) => d.valor > 0);
  // Ángulo de inicio de cada porción = suma de las anteriores (sin variables mutables en el render).
  const inicios = visibles.map((_, i) => visibles.slice(0, i).reduce((s, x) => s + x.valor, 0));
  const textoCentro = formato ? formato(total) : String(total);
  const arcos = visibles.map((d, i) => {
    const ini = (inicios[i] / total) * 2 * Math.PI - Math.PI / 2;
    const fin = ((inicios[i] + d.valor) / total) * 2 * Math.PI - Math.PI / 2;
    const grande = fin - ini > Math.PI ? 1 : 0;
    const p = (ang: number, rad: number) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)];
    const [x1, y1] = p(ini, R), [x2, y2] = p(fin, R), [x3, y3] = p(fin, r), [x4, y4] = p(ini, r);
    const solo = visibles.length === 1;
    const d1 = solo
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} L ${C - 0.01} ${C - r} A ${r} ${r} 0 1 0 ${C} ${C - r} Z`
      : `M ${x1} ${y1} A ${R} ${R} 0 ${grande} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${grande} 0 ${x4} ${y4} Z`;
    return { d: d1, color: d.color ?? PALETA[i % PALETA.length], etiqueta: d.etiqueta, valor: d.valor, detalle: d.detalle };
  });
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 100 100" className="size-36 shrink-0">
        {arcos.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="#fff" strokeWidth={0.8}>
            <title>{`${a.etiqueta}: ${a.detalle ?? (formato ? formato(a.valor) : a.valor)} (${Math.round((a.valor / total) * 100)}%)`}</title>
          </path>
        ))}
        {/* El texto del centro se encoge según su largo para no salirse del hueco (diámetro interior 52). */}
        <text x={C} y={C - 1} textAnchor="middle" fontSize={Math.min(13, Math.max(5.5, 46 / (textoCentro.length * 0.58)))} fontWeight={700} fill="#1F3864">{textoCentro}</text>
        {centroTitulo && <text x={C} y={C + 8} textAnchor="middle" fontSize={5} fill="#6B7280">{centroTitulo}</text>}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {arcos.map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
            <span className="truncate">{a.etiqueta}</span>
            <span className="num ml-auto shrink-0 text-xs text-muted-foreground">{a.detalle ?? (formato ? formato(a.valor) : a.valor)} · {Math.round((a.valor / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Tarjeta({ titulo, valor, detalle, clase, href, acento }: { titulo: string; valor: string | number; detalle?: string; clase?: string; href?: string; acento?: string }) {
  const contenido = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className={cn("num mt-1 text-2xl font-semibold", clase)}>{valor}</div>
      {detalle && <div className="mt-0.5 text-xs text-muted-foreground">{detalle}</div>}
    </>
  );
  const clases = "block rounded-lg border bg-card p-4 transition-colors border-l-4";
  const estilo = { borderLeftColor: acento ?? "#1F3864" };
  return href ? (
    <a href={href} className={cn(clases, "hover:border-primary/50 hover:bg-primary/5")} style={estilo}>{contenido}</a>
  ) : (
    <div className={clases} style={estilo}>{contenido}</div>
  );
}
