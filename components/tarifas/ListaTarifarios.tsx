"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Entrada, Selector } from "@/components/Campos";
import { SECCIONES, SERVICIOS, infoServicio } from "@/lib/etiquetas";
import { formatoFecha } from "@/lib/calculo/formato";
import type { Proveedor } from "@/lib/supabase/tipos";
import type { Recargos } from "@/lib/calculo/tipos";
import type { TarifarioResumen } from "@/lib/tarifas/consultas";
import { ETIQUETA_ESTADO, textoVencimiento, type EstadoTarifario } from "@/lib/tarifas/estado";
import { archivarTarifario, eliminarTarifario, establecerVigenciaTarifario } from "@/lib/tarifas/acciones";
import { DialogoTarifario } from "./DialogoTarifario";
import { DialogoTarifarioIA } from "./DialogoTarifarioIA";
import { BotonActualizarTarifa } from "./DialogoActualizarTarifa";
import { Proveedores } from "./Proveedores";
import { estiloSeccion } from "./estiloServicio";
import { cn } from "@/lib/utils";

interface Props {
  tarifarios: TarifarioResumen[];
  proveedores: Proveedor[];
  recargos: Recargos;
}

type Filtro = "todos" | "usables" | EstadoTarifario;
const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "todos", texto: "Todos" },
  { valor: "usables", texto: "Disponibles" },
  { valor: "por_vencer", texto: "Por vencer" },
  { valor: "vencido", texto: "Vencidos" },
  { valor: "desactivado", texto: "Desactivados" },
];
const cumple = (t: TarifarioResumen, f: Filtro) => (f === "todos" ? true : f === "usables" ? t.estado === "en_uso" || t.estado === "por_vencer" : t.estado === f);
/** Vigentes (o por empezar) arriba; vencidos y apagados son "versiones anteriores". */
const esActual = (t: TarifarioResumen) => t.estado !== "vencido" && t.estado !== "desactivado";
const masReciente = (a: TarifarioResumen, b: TarifarioResumen) => (b.vigencia_hasta ?? b.created_at).localeCompare(a.vigencia_hasta ?? a.created_at);

interface AccionesTarjeta { pendiente: boolean; correr: (accion: () => Promise<{ ok: boolean; error?: string }>) => void; eliminar: (t: TarifarioResumen) => void }

function Tarjeta({ t, pendiente, correr, eliminar }: { t: TarifarioResumen } & AccionesTarjeta) {
  const e = ETIQUETA_ESTADO[t.estado];
  const apagado = t.estado === "desactivado" || t.estado === "vencido";
  const estilo = estiloSeccion(t.seccion);
  const Icono = estilo.icono;
  const seccion = SECCIONES.find((s) => s.valor === t.seccion);
  return (
    <div className={cn("flex flex-col rounded-lg border border-l-4 bg-card p-4", estilo.barra, apagado && "bg-muted/30", t.estado === "vencido" && "border-red-200 border-l-red-400")}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/tarifas/${t.id}`} className={cn("font-medium text-primary hover:underline", apagado && "opacity-70")}>{t.nombre}</Link>
        <span className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] font-medium", e.clase)}>{e.texto}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium", estilo.chip)}><Icono className="size-3" /> {seccion?.texto ?? t.seccion}</span>
        <strong className="font-semibold text-foreground">{t.proveedor_nombre ?? "Propio · Dams Cargo"}</strong>
        {t.servicio ? <span>· {infoServicio(t.servicio).texto}</span> : null}
        {t.origen || t.destino ? <span>· {t.origen ?? "—"} → {t.destino ?? "—"}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="num">{t.n_rutas > 0 ? `${t.n_rutas} rutas` : ""}{t.n_rutas > 0 && t.n_conceptos > 0 ? " · " : ""}{t.n_conceptos > 0 ? `${t.n_conceptos} conceptos` : ""}</span>
        {t.documento_url && (
          <a href={t.documento_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <FileText className="size-3" /> Documento
          </a>
        )}
      </div>

      <div className="mt-3 space-y-2 border-t pt-3">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>
            Usar al cotizar
            <span className="block text-[11px] text-muted-foreground">
              {t.estado === "vencido" ? "Venció: aunque esté prendido no se usa" : t.estado === "desactivado" ? "Apagado a mano" : "Disponible en cotizaciones"}
            </span>
          </span>
          <Switch checked={!t.archivado_at} disabled={pendiente} onCheckedChange={(prendido) => correr(() => archivarTarifario(t.id, !prendido))} aria-label={`Usar ${t.nombre} al cotizar`} />
        </label>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={cn(t.estado === "vencido" ? "font-medium text-red-700" : t.estado === "por_vencer" ? "font-medium text-amber-700" : "text-muted-foreground")}>
            {textoVencimiento(t)}
          </span>
          <label className="flex items-center gap-1 text-muted-foreground" title={t.vigencia_hasta ? `Vigente hasta ${formatoFecha(t.vigencia_hasta)}` : "Sin fecha de vencimiento"}>
            {t.estado === "vencido" ? "Renovar hasta" : "Hasta"}
            <input type="date" defaultValue={t.vigencia_hasta ?? ""} disabled={pendiente}
              onChange={(ev) => ev.target.value !== (t.vigencia_hasta ?? "") && correr(() => establecerVigenciaTarifario(t.id, t.vigencia_desde, ev.target.value || null))}
              className="h-7 rounded border bg-background px-1.5 text-xs text-foreground" />
          </label>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/tarifas/${t.id}`} />}>Abrir</Button>
        <Button variant="ghost" size="icon-sm" disabled={pendiente} className="ml-auto text-destructive" onClick={() => eliminar(t)} title="Borrar definitivamente">
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

export function ListaTarifarios({ tarifarios, proveedores, recargos }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [vista, setVista] = useState<"proveedor" | "servicio">("proveedor");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [seccion, setSeccion] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [servicio, setServicio] = useState("");
  const [anterioresAbiertos, setAnterioresAbiertos] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const conteo = (f: Filtro) => tarifarios.filter((t) => cumple(t, f)).length;
  const vencidosSinApagar = tarifarios.filter((t) => t.estado === "vencido").length;

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return tarifarios.filter(
      (x) =>
        cumple(x, filtro) &&
        (!seccion || x.seccion === seccion) &&
        (!proveedor || (proveedor === "propio" ? !x.proveedor_id : x.proveedor_id === proveedor)) &&
        (!servicio || x.servicio === servicio || x.servicio === null) &&
        (!t || `${x.nombre} ${x.proveedor_nombre ?? ""} ${x.origen ?? ""} ${x.destino ?? ""}`.toLowerCase().includes(t)),
    );
  }, [tarifarios, q, filtro, seccion, proveedor, servicio]);

  const porSeccion = SECCIONES.map((s) => ({ ...s, items: visibles.filter((t) => t.seccion === s.valor) })).filter((s) => s.items.length > 0);
  const porProveedor = useMemo(() => {
    const grupos = new Map<string, { clave: string; nombre: string; items: TarifarioResumen[] }>();
    for (const t of visibles) {
      const clave = t.proveedor_id ?? "propio";
      const g = grupos.get(clave) ?? { clave, nombre: t.proveedor_nombre ?? "Propios de Dams Cargo (sin proveedor asignado)", items: [] };
      g.items.push(t);
      grupos.set(clave, g);
    }
    return [...grupos.values()]
      .map((g) => ({ ...g, actuales: g.items.filter(esActual).sort(masReciente), anteriores: g.items.filter((t) => !esActual(t)).sort(masReciente) }))
      .sort((a, b) => (a.clave === "propio" ? 1 : b.clave === "propio" ? -1 : a.nombre.localeCompare(b.nombre)));
  }, [visibles]);

  const correr = (accion: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await accion();
      if (!r.ok) setError(r.error ?? "No se pudo completar.");
      router.refresh();
    });

  const eliminar = (t: TarifarioResumen) => {
    if (!confirm(`¿Borrar DEFINITIVAMENTE "${t.nombre}" con sus ${t.n_conceptos + t.n_rutas} tarifas?\n\nEsto no se puede deshacer. Si solo quieres dejar de usarlo, mejor desactívalo.`)) return;
    correr(() => eliminarTarifario(t.id));
  };
  const acciones: AccionesTarjeta = { pendiente, correr, eliminar };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Entrada placeholder="Buscar tarifario, proveedor o tramo…" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" autoComplete="off" />
        <Selector value={servicio} onChange={(e) => setServicio(e.target.value)} className="w-52">
          <option value="">Todos los servicios</option>
          {SERVICIOS.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
        </Selector>
        <Selector value={seccion} onChange={(e) => setSeccion(e.target.value)} className="w-52">
          <option value="">Todas las secciones</option>
          {SECCIONES.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
        </Selector>
        <Selector value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="w-52">
          <option value="">Todos los proveedores</option>
          <option value="propio">Propios (Dams Cargo)</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>
        <div className="ml-auto flex gap-2">
          <Proveedores proveedores={proveedores} />
          <BotonActualizarTarifa tarifarios={tarifarios} />
          <DialogoTarifarioIA proveedores={proveedores} recargos={recargos} />
          <DialogoTarifario proveedores={proveedores}>
            <Button><Plus /> Nuevo tarifario</Button>
          </DialogoTarifario>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="mr-2 inline-flex overflow-hidden rounded-md border text-xs font-medium">
          {(["proveedor", "servicio"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setVista(v)} className={cn("px-3 py-1.5 hover:bg-muted", vista === v && "bg-primary text-primary-foreground hover:bg-primary")}>
              {v === "proveedor" ? "Por proveedor" : "Por servicio"}
            </button>
          ))}
        </div>
        {FILTROS.map((f) => (
          <button key={f.valor} type="button" onClick={() => setFiltro(f.valor)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted", filtro === f.valor && "border-primary bg-primary text-primary-foreground hover:bg-primary")}>
            {f.texto} <span className="opacity-70">{conteo(f.valor)}</span>
          </button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">Un tarifario <strong>vencido</strong> o <strong>desactivado</strong> no aparece al cotizar.</span>
      </div>

      {vencidosSinApagar > 0 && filtro !== "vencido" && (
        <button type="button" onClick={() => setFiltro("vencido")} className="flex w-full items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-900 hover:bg-red-100">
          <AlertTriangle className="size-4 shrink-0" />
          {vencidosSinApagar === 1 ? "1 tarifario venció y ya no se puede usar al cotizar." : `${vencidosSinApagar} tarifarios vencieron y ya no se pueden usar al cotizar.`} Ver cuáles para renovarlos o subir los nuevos.
        </button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {visibles.length === 0 && (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No hay tarifarios con ese filtro.</div>
      )}

      {vista === "proveedor" && porProveedor.map((g) => (
        <section key={g.clave} className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2 border-b pb-1.5">
            <h2 className="text-lg font-semibold text-primary">{g.nombre}</h2>
            <span className="text-xs text-muted-foreground">{g.actuales.length} {g.actuales.length === 1 ? "tarifario actual" : "tarifarios actuales"}{g.anteriores.length > 0 ? ` · ${g.anteriores.length} ${g.anteriores.length === 1 ? "anterior" : "anteriores"}` : ""}</span>
            <span className="ml-auto"><BotonActualizarTarifa tarifarios={tarifarios} tarifarioInicial={(g.actuales[0] ?? g.anteriores[0])?.id} etiqueta={`Actualizar ${g.clave === "propio" ? "" : "tarifa de "}${g.clave === "propio" ? "con IA" : g.nombre}`} /></span>
          </div>
          {g.actuales.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {g.actuales.map((t) => <Tarjeta key={t.id} t={t} {...acciones} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ningún tarifario vigente de este proveedor: sube el nuevo o renueva uno de los anteriores.</p>
          )}
          {g.anteriores.length > 0 && (
            <div>
              <button type="button" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setAnterioresAbiertos((a) => ({ ...a, [g.clave]: !a[g.clave] }))}>
                {anterioresAbiertos[g.clave] ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                Versiones anteriores y desactivadas ({g.anteriores.length})
              </button>
              {anterioresAbiertos[g.clave] && (
                <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {g.anteriores.map((t) => <Tarjeta key={t.id} t={t} {...acciones} />)}
                </div>
              )}
            </div>
          )}
        </section>
      ))}

      {vista === "servicio" && porSeccion.map((s) => {
        const estilo = estiloSeccion(s.valor);
        const Icono = estilo.icono;
        return (
          <section key={s.valor} className="space-y-2">
            <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2", estilo.banner)}>
              <Icono className="size-5" />
              <h2 className="font-semibold">{s.texto}</h2>
              <span className="text-xs opacity-80">{s.descripcion} · {s.moneda}</span>
              <span className="ml-auto text-xs font-medium">{s.items.length}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[...s.items].sort((a, b) => Number(esActual(b)) - Number(esActual(a)) || masReciente(a, b)).map((t) => <Tarjeta key={t.id} t={t} {...acciones} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
