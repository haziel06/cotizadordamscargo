"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Entrada, Selector } from "@/components/Campos";
import { SECCIONES, SERVICIOS, infoServicio } from "@/lib/etiquetas";
import { formatoFecha } from "@/lib/calculo/formato";
import type { Proveedor } from "@/lib/supabase/tipos";
import type { TarifarioResumen } from "@/lib/tarifas/consultas";
import { ETIQUETA_ESTADO, textoVencimiento, type EstadoTarifario } from "@/lib/tarifas/estado";
import { archivarTarifario, eliminarTarifario, establecerVigenciaTarifario } from "@/lib/tarifas/acciones";
import { DialogoTarifario } from "./DialogoTarifario";
import { DialogoTarifarioIA } from "./DialogoTarifarioIA";
import { Proveedores } from "./Proveedores";
import { cn } from "@/lib/utils";

interface Props {
  tarifarios: TarifarioResumen[];
  proveedores: Proveedor[];
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

export function ListaTarifarios({ tarifarios, proveedores }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [seccion, setSeccion] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [servicio, setServicio] = useState("");
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
          <DialogoTarifarioIA proveedores={proveedores} />
          <DialogoTarifario proveedores={proveedores}>
            <Button><Plus /> Nuevo tarifario</Button>
          </DialogoTarifario>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
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

      {porSeccion.length === 0 && (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No hay tarifarios con ese filtro.</div>
      )}

      {porSeccion.map((s) => (
        <section key={s.valor} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h2 className="font-semibold text-primary">{s.texto}</h2>
            <span className="text-xs text-muted-foreground">{s.descripcion} · {s.moneda}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {s.items.map((t) => {
              const e = ETIQUETA_ESTADO[t.estado];
              const apagado = t.estado === "desactivado" || t.estado === "vencido";
              return (
                <div key={t.id} className={cn("flex flex-col rounded-lg border bg-card p-4", apagado && "bg-muted/30", t.estado === "vencido" && "border-red-200")}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/tarifas/${t.id}`} className={cn("font-medium text-primary hover:underline", apagado && "opacity-70")}>{t.nombre}</Link>
                    <span className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] font-medium", e.clase)}>{e.texto}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <strong className="font-semibold text-foreground">{t.proveedor_nombre ?? "Propio · Dams Cargo"}</strong>
                    {t.servicio ? ` · ${infoServicio(t.servicio).texto}` : ""}
                    {t.origen || t.destino ? ` · ${t.origen ?? "—"} → ${t.destino ?? "—"}` : ""}
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
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
