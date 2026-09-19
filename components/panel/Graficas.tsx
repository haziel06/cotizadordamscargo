import { cn } from "@/lib/utils";

/** Gráficas SVG ligeras (sin dependencias) para el panel de inicio. */

export function BarrasVerticales({ datos, alto = 120, etiquetaCada = 1, formato }: {
  datos: { etiqueta: string; valor: number; secundario?: number; titulo?: string }[];
  alto?: number;
  etiquetaCada?: number;
  formato?: (v: number) => string;
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const ancho = 100 / datos.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${alto}`} preserveAspectRatio="none" className="h-32 w-full">
        {datos.map((d, i) => {
          const h = (d.valor / max) * (alto - 8);
          const h2 = d.secundario ? (d.secundario / max) * (alto - 8) : 0;
          return (
            <g key={i}>
              <title>{d.titulo ?? `${d.etiqueta}: ${formato ? formato(d.valor) : d.valor}`}</title>
              <rect x={i * ancho + ancho * 0.18} y={alto - h} width={ancho * 0.64} height={h} rx={0.6} className="fill-primary/80" />
              {h2 > 0 && <rect x={i * ancho + ancho * 0.18} y={alto - h2} width={ancho * 0.64} height={h2} rx={0.6} className="fill-verde" />}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 grid text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${datos.length}, minmax(0, 1fr))` }}>
        {datos.map((d, i) => (
          <span key={i} className="truncate text-center">{i % etiquetaCada === 0 ? d.etiqueta : ""}</span>
        ))}
      </div>
    </div>
  );
}

export function BarrasHorizontales({ datos, formato }: { datos: { etiqueta: string; valor: number; detalle?: string }[]; formato?: (v: number) => string }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  if (!datos.length) return <p className="text-sm text-muted-foreground">Sin datos todavía.</p>;
  return (
    <ul className="space-y-2">
      {datos.map((d, i) => (
        <li key={i} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate">{d.etiqueta}</span>
            <span className="num shrink-0 text-xs text-muted-foreground">{d.detalle ?? (formato ? formato(d.valor) : d.valor)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary/80" style={{ width: `${(d.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Tarjeta({ titulo, valor, detalle, clase, href }: { titulo: string; valor: string | number; detalle?: string; clase?: string; href?: string }) {
  const contenido = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className={cn("num mt-1 text-2xl font-semibold", clase)}>{valor}</div>
      {detalle && <div className="mt-0.5 text-xs text-muted-foreground">{detalle}</div>}
    </>
  );
  const clases = "block rounded-lg border bg-card p-4 transition-colors";
  return href ? <a href={href} className={cn(clases, "hover:border-primary/50 hover:bg-primary/5")}>{contenido}</a> : <div className={clases}>{contenido}</div>;
}
