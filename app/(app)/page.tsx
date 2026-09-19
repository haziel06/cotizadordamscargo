import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listarCotizaciones, listarPerfiles } from "@/lib/cotizaciones/consultas";
import { calcularMetricas } from "@/lib/cotizaciones/metricas";
import { fechaVencimiento, formatoFecha, formatoMoneda } from "@/lib/calculo/formato";
import { ESTADOS, infoEstado, infoServicio } from "@/lib/etiquetas";
import { sesionRequerida } from "@/lib/sesion";
import { BarrasHorizontales, BarrasVerticales, Tarjeta } from "@/components/panel/Graficas";
import { cn } from "@/lib/utils";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const q = (v: number) => formatoMoneda(v, "GTQ");

export default async function Inicio(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const sesion = await sesionRequerida();
  const usuario = sesion.esAdmin && typeof sp.usuario === "string" ? sp.usuario : "";
  const [filas, perfiles] = await Promise.all([listarCotizaciones({ usuario, limite: 1000 }), sesion.esAdmin ? listarPerfiles() : Promise.resolve([])]);
  const m = calcularMetricas(filas.map((c) => ({
    id: c.id, numero: c.numero, cliente_nombre: c.cliente_nombre, fecha: c.fecha, dias_vigencia: c.dias_vigencia,
    estado_efectivo: c.estado_efectivo, total_gtq: Number(c.total_gtq), utilidad_gtq: Number(c.utilidad_gtq),
    tipo_servicio: c.tipo_servicio, tipos_servicio: c.tipos_servicio ?? [], creado_por: c.creado_por, created_at: c.created_at,
  })));
  const hola = sesion.nombre ? sesion.nombre.split(" ")[0] : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{hola ? `Hola, ${hola}` : "Inicio"}</h1>
          <p className="text-sm text-muted-foreground">
            {sesion.esAdmin ? "Resumen de todo el equipo." : "Resumen de tus cotizaciones."} {new Date().toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" })}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sesion.esAdmin && (
            <form action="/" className="flex items-center gap-2">
              <select name="usuario" defaultValue={usuario} className="h-9 rounded border border-input bg-white px-2 text-sm">
                <option value="">Todo el equipo</option>
                {perfiles.map((p) => (
                  <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>
                ))}
              </select>
              <button type="submit" className="h-9 rounded border bg-white px-3 text-sm hover:bg-muted">Ver</button>
            </form>
          )}
          <Button nativeButton={false} render={<Link href="/cotizaciones/nueva" />}>
            <Plus /> Nueva cotización
          </Button>
        </div>
      </div>

      {/* Conteo por estado */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tarjeta titulo="Todas" valor={m.total} href="/cotizaciones" />
        {ESTADOS.map((e) => (
          <Tarjeta key={e.valor} titulo={e.texto} valor={m.porEstado[e.valor]} href={`/cotizaciones?estado=${e.valor}`}
            clase={e.valor === "aceptada" ? "text-verde" : e.valor === "vencida" ? "text-amber-700" : e.valor === "rechazada" ? "text-red-700" : undefined} />
        ))}
      </div>

      {/* Mes en curso */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Cotizado este mes" valor={q(m.mes.monto_gtq)} detalle={`${m.mes.cotizadas} cotizaciones`} />
        <Tarjeta titulo="Aceptado este mes" valor={q(m.mes.monto_aceptado_gtq)} detalle={`${m.mes.aceptadas} aceptadas`} clase="text-verde" />
        <Tarjeta titulo="Tasa de aceptación" valor={`${m.tasa_aceptacion}%`} detalle="sobre las que ya tuvieron respuesta" />
        {sesion.esAdmin ? (
          <Tarjeta titulo="Utilidad aceptada (mes)" valor={q(m.mes.utilidad_gtq)} detalle="Interno: no sale en ningún PDF" clase="text-verde" />
        ) : (
          <Tarjeta titulo="Por vencer (7 días)" valor={m.porVencer.length} detalle="enviadas sin respuesta" clase={m.porVencer.length ? "text-amber-700" : undefined} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Cotizaciones por día" detalle="Últimos 30 días">
          <BarrasVerticales datos={m.porDia.map((d) => ({ etiqueta: d.dia.slice(8), valor: d.n, titulo: `${formatoFecha(d.dia)}: ${d.n}` }))} etiquetaCada={3} />
        </Panel>
        <Panel titulo="Cotizaciones por mes" detalle="Últimos 12 meses · en verde las aceptadas">
          <BarrasVerticales datos={m.porMes.map((d) => ({ etiqueta: MESES[Number(d.mes.slice(5)) - 1], valor: d.n, secundario: d.aceptadas, titulo: `${d.mes}: ${d.n} cotizadas, ${d.aceptadas} aceptadas, ${q(d.monto_gtq)}` }))} />
        </Panel>
        <Panel titulo="Por tipo de servicio" detalle="Cantidad y monto cotizado">
          <BarrasHorizontales datos={m.porServicio.map((s) => ({ etiqueta: infoServicio(s.servicio).texto, valor: s.n, detalle: `${s.n} · ${q(s.monto_gtq)}` }))} />
        </Panel>
        <Panel titulo="Clientes con más monto cotizado" detalle="Top 6">
          <BarrasHorizontales datos={m.topClientes.map((c) => ({ etiqueta: c.cliente, valor: c.monto_gtq, detalle: `${c.n} · ${q(c.monto_gtq)}` }))} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Por vencer en 7 días" detalle="Enviadas o en borrador que caducan pronto" enlace="/cotizaciones?estado=enviada">
          <TablaMini filas={m.porVencer} columnaFecha="vence" vacio="Nada por vencer esta semana." />
        </Panel>
        <Panel titulo="Últimas cotizaciones" detalle="Las más recientes" enlace="/cotizaciones">
          <TablaMini filas={m.ultimas} columnaFecha="fecha" vacio="Todavía no hay cotizaciones." />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ titulo, detalle, enlace, children }: { titulo: string; detalle?: string; enlace?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold text-primary">{titulo}</h2>
          {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
        </div>
        {enlace && <Link href={enlace} className="flex items-center gap-1 text-xs text-primary hover:underline">Ver todas <ArrowRight className="size-3" /></Link>}
      </div>
      {children}
    </section>
  );
}

function TablaMini({ filas, columnaFecha, vacio }: { filas: ReturnType<typeof calcularMetricas>["ultimas"]; columnaFecha: "vence" | "fecha"; vacio: string }) {
  if (!filas.length) return <p className="text-sm text-muted-foreground">{vacio}</p>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y">
        {filas.map((f) => {
          const info = infoEstado(f.estado_efectivo);
          return (
            <tr key={f.id}>
              <td className="py-1.5 pr-2">
                <Link href={`/cotizaciones/${f.id}`} className="font-medium text-primary hover:underline">{f.numero}</Link>
                <div className="truncate text-xs text-muted-foreground">{f.cliente_nombre}</div>
              </td>
              <td className="py-1.5 pr-2 text-xs text-muted-foreground whitespace-nowrap">
                {columnaFecha === "vence" ? `Vence ${formatoFecha(fechaVencimiento(f.fecha, f.dias_vigencia))}` : formatoFecha(f.fecha)}
              </td>
              <td className="py-1.5 pr-2"><span className={cn("rounded px-2 py-0.5 text-[11px] font-medium", info.clase)}>{info.texto}</span></td>
              <td className="num py-1.5 text-right font-medium">{q(f.total_gtq)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
