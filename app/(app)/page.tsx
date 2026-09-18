import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listarCotizaciones } from "@/lib/cotizaciones/consultas";
import { formatoFecha, formatoMoneda, formatoPorcentaje } from "@/lib/calculo/formato";
import { ESTADOS, infoEstado } from "@/lib/etiquetas";
import { cn } from "@/lib/utils";

export default async function Inicio(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const estado = typeof sp.estado === "string" ? sp.estado : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const cotizaciones = await listarCotizaciones({ estado, q });
  const vencidas = estado ? 0 : cotizaciones.filter((c) => c.estado_efectivo === "vencida").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-primary">Cotizaciones</h1>
        <Button size="lg" nativeButton={false} render={<Link href="/cotizaciones/nueva" />}>
          <Plus /> Nueva cotización
        </Button>
      </div>

      {vencidas > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-ambar bg-ambar/10 px-4 py-2 text-sm text-amber-900">
          <AlertTriangle className="size-4" />
          {vencidas === 1 ? "Hay 1 cotización vencida" : `Hay ${vencidas} cotizaciones vencidas`} (pasó su fecha de vigencia sin aceptarse ni rechazarse).
          <Link href="/?estado=vencida" className="ml-auto underline">Ver</Link>
        </div>
      )}

      <form className="flex flex-wrap items-center gap-2" action="/">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por cliente…"
          className="h-9 w-64 rounded border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        />
        <div className="flex flex-wrap gap-1">
          <FiltroEstado actual={estado} valor="" texto="Todas" q={q} />
          {ESTADOS.map((e) => (
            <FiltroEstado key={e.valor} actual={estado} valor={e.valor} texto={e.texto} q={q} />
          ))}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Número</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Carga</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 text-right font-medium">Total (Q)</th>
              <th className="px-3 py-2 text-right font-medium" title="Interno: margen sobre costo">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cotizaciones.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {q || estado ? "No hay cotizaciones con ese filtro." : "Todavía no hay cotizaciones. Crea la primera."}
                </td>
              </tr>
            )}
            {cotizaciones.map((c) => {
              const info = infoEstado(c.estado_efectivo);
              const margen = Number(c.margen_pct);
              return (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/cotizaciones/${c.id}`} className="text-primary hover:underline">{c.numero}</Link>
                  </td>
                  <td className="px-3 py-2">{c.cliente_nombre}</td>
                  <td className="px-3 py-2 text-muted-foreground">{[c.tipo_carga, c.origen].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatoFecha(c.fecha)}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded px-2 py-0.5 text-xs font-medium", info.clase)}>{info.texto}</span>
                  </td>
                  <td className="num px-3 py-2 text-right font-medium">{formatoMoneda(Number(c.total_gtq), "GTQ")}</td>
                  <td className={cn("num px-3 py-2 text-right", margen < 15 ? "text-amber-700" : "text-verde")}>{formatoPorcentaje(margen)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FiltroEstado({ actual, valor, texto, q }: { actual: string; valor: string; texto: string; q: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (valor) params.set("estado", valor);
  const href = `/${params.size ? `?${params}` : ""}`;
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted",
        actual === valor ? "border-primary bg-primary text-primary-foreground hover:bg-primary" : "bg-white",
      )}
    >
      {texto}
    </Link>
  );
}
