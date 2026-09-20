import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listarCotizaciones, listarPerfiles } from "@/lib/cotizaciones/consultas";
import { formatoFecha, formatoMoneda, formatoPorcentaje } from "@/lib/calculo/formato";
import { ESTADOS, infoServicio } from "@/lib/etiquetas";
import { sesionRequerida } from "@/lib/sesion";
import { SelectorEstado } from "@/components/cotizacion/SelectorEstado";
import { CasillaFila, CasillaTodas, SeleccionLista } from "@/components/cotizacion/SeleccionLista";
import { cn } from "@/lib/utils";

export default async function ListaCotizaciones(props: PageProps<"/cotizaciones">) {
  const sp = await props.searchParams;
  const sesion = await sesionRequerida();
  const estado = typeof sp.estado === "string" ? sp.estado : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const usuario = sesion.esAdmin && typeof sp.usuario === "string" ? sp.usuario : "";
  const [cotizaciones, perfiles] = await Promise.all([listarCotizaciones({ estado, q, usuario }), sesion.esAdmin ? listarPerfiles() : Promise.resolve([])]);
  const nombreDe = new Map(perfiles.map((p) => [p.user_id, p.nombre || p.email]));
  const vencidas = estado ? 0 : cotizaciones.filter((c) => c.estado_efectivo === "vencida").length;
  const puedeBorrar = (c: { creado_por: string | null }) => sesion.esAdmin || c.creado_por === sesion.userId;
  const idsBorrables = cotizaciones.filter(puedeBorrar).map((c) => c.id);
  const params = (extra: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, estado, usuario, ...extra })) if (v) u.set(k, v);
    return `/cotizaciones${u.size ? `?${u}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">{sesion.esAdmin ? "Todas las cotizaciones del equipo." : "Tus cotizaciones."}</p>
        </div>
        <Button size="lg" nativeButton={false} render={<Link href="/cotizaciones/nueva" />}>
          <Plus /> Nueva cotización
        </Button>
      </div>

      {vencidas > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-ambar bg-ambar/10 px-4 py-2 text-sm text-amber-900">
          <AlertTriangle className="size-4" />
          {vencidas === 1 ? "Hay 1 cotización vencida" : `Hay ${vencidas} cotizaciones vencidas`} (pasó su fecha de vigencia sin aceptarse ni rechazarse).
          <Link href={params({ estado: "vencida" })} className="ml-auto underline">Ver</Link>
        </div>
      )}

      <form className="flex flex-wrap items-center gap-2" action="/cotizaciones">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por cliente…"
          autoComplete="off"
          className="h-9 w-64 rounded border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        />
        {estado && <input type="hidden" name="estado" value={estado} />}
        {sesion.esAdmin && (
          <select name="usuario" defaultValue={usuario} className="h-9 rounded border border-input bg-white px-2 text-sm">
            <option value="">Todas las personas</option>
            {perfiles.map((p) => (
              <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>
            ))}
          </select>
        )}
        {sesion.esAdmin && <button type="submit" className="h-9 rounded border bg-white px-3 text-sm hover:bg-muted">Filtrar</button>}
        <div className="flex flex-wrap gap-1">
          <Filtro href={params({ estado: "" })} activo={!estado} texto="Todas" />
          {ESTADOS.map((e) => (
            <Filtro key={e.valor} href={params({ estado: e.valor })} activo={estado === e.valor} texto={e.texto} />
          ))}
        </div>
      </form>

      <SeleccionLista ids={idsBorrables}>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2"><CasillaTodas ids={idsBorrables} /></th>
              <th className="px-3 py-2 font-medium">Número</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Servicio</th>
              {sesion.esAdmin && <th className="px-3 py-2 font-medium">Creada por</th>}
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium" title="Cámbialo aquí mismo">Estado</th>
              <th className="px-3 py-2 text-right font-medium">Total (Q)</th>
              {sesion.esAdmin && <th className="px-3 py-2 text-right font-medium" title="Interno: margen sobre costo">Margen</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {cotizaciones.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  {q || estado ? "No hay cotizaciones con ese filtro." : "Todavía no hay cotizaciones. Crea la primera."}
                </td>
              </tr>
            )}
            {cotizaciones.map((c) => {
              const margen = Number(c.margen_pct);
              const tipos = c.tipos_servicio?.length ? c.tipos_servicio : [c.tipo_servicio];
              return (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2"><CasillaFila id={c.id} disabled={!puedeBorrar(c)} /></td>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/cotizaciones/${c.id}`} className="text-primary hover:underline">{c.numero}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <div>{c.cliente_nombre}</div>
                    {c.contacto && <div className="text-xs text-muted-foreground">{c.contacto}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {tipos.map((t) => infoServicio(t).texto).join(" + ")}
                    {c.segmento_courier && <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] capitalize text-primary">{c.segmento_courier}</span>}
                  </td>
                  {sesion.esAdmin && <td className="px-3 py-2 text-muted-foreground">{c.creado_por ? nombreDe.get(c.creado_por) ?? "—" : "—"}</td>}
                  <td className="px-3 py-2 whitespace-nowrap">{formatoFecha(c.fecha)}</td>
                  <td className="px-3 py-2">
                    <SelectorEstado id={c.id} estado={c.estado} estadoEfectivo={c.estado_efectivo} modo="compacto" disabled={!sesion.esAdmin && c.creado_por !== sesion.userId} />
                  </td>
                  <td className="num px-3 py-2 text-right font-medium">{formatoMoneda(Number(c.total_gtq), "GTQ")}</td>
                  {sesion.esAdmin && <td className={cn("num px-3 py-2 text-right", margen < 15 ? "text-amber-700" : "text-verde")}>{formatoPorcentaje(margen)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </SeleccionLista>
      <p className="text-xs text-muted-foreground">Marca una o varias filas para borrarlas. Para cambiar el estado usa el selector de cada fila.</p>
    </div>
  );
}

function Filtro({ href, activo, texto }: { href: string; activo: boolean; texto: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted",
        activo ? "border-primary bg-primary text-primary-foreground hover:bg-primary" : "bg-white",
      )}
    >
      {texto}
    </Link>
  );
}
