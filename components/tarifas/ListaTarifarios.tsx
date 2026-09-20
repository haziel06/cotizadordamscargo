"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Casilla, Entrada, Selector } from "@/components/Campos";
import { SECCIONES, SERVICIOS, infoServicio } from "@/lib/etiquetas";
import { formatoFecha } from "@/lib/calculo/formato";
import type { Proveedor } from "@/lib/supabase/tipos";
import type { TarifarioResumen } from "@/lib/tarifas/consultas";
import { archivarTarifario, eliminarTarifario } from "@/lib/tarifas/acciones";
import { DialogoTarifario } from "./DialogoTarifario";
import { DialogoTarifarioIA } from "./DialogoTarifarioIA";
import { Proveedores } from "./Proveedores";
import { cn } from "@/lib/utils";

interface Props {
  tarifarios: TarifarioResumen[];
  proveedores: Proveedor[];
  mostrandoArchivados: boolean;
}

const VIGENCIA = {
  vigente: { texto: "Vigente", clase: "bg-green-100 text-green-900" },
  por_vencer: { texto: "Por vencer", clase: "bg-amber-100 text-amber-900" },
  vencido: { texto: "Vencido", clase: "bg-red-100 text-red-900" },
  sin_fecha: { texto: "Sin vigencia", clase: "bg-muted text-muted-foreground" },
};

export function ListaTarifarios({ tarifarios, proveedores, mostrandoArchivados }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [seccion, setSeccion] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [servicio, setServicio] = useState("");
  const [pendiente, startTransition] = useTransition();

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return tarifarios.filter(
      (x) =>
        (!seccion || x.seccion === seccion) &&
        (!proveedor || (proveedor === "propio" ? !x.proveedor_id : x.proveedor_id === proveedor)) &&
        (!servicio || x.servicio === servicio || x.servicio === null) &&
        (!t || `${x.nombre} ${x.proveedor_nombre ?? ""} ${x.origen ?? ""} ${x.destino ?? ""}`.toLowerCase().includes(t)),
    );
  }, [tarifarios, q, seccion, proveedor, servicio]);

  const porSeccion = SECCIONES.map((s) => ({ ...s, items: visibles.filter((t) => t.seccion === s.valor) })).filter((s) => s.items.length > 0);

  const archivar = (t: TarifarioResumen) =>
    startTransition(async () => {
      const r = await archivarTarifario(t.id, !t.archivado_at);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  const eliminar = (t: TarifarioResumen) => {
    if (!confirm(`¿Borrar DEFINITIVAMENTE "${t.nombre}" con sus ${t.n_conceptos + t.n_rutas} tarifas?\n\nEsto no se puede deshacer. Si solo quieres dejar de usarlo, mejor archívalo.`)) return;
    startTransition(async () => {
      const r = await eliminarTarifario(t.id);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
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
        <label className="flex items-center gap-2 text-sm">
          <Casilla checked={mostrandoArchivados} onChange={(e) => router.push(e.target.checked ? "/tarifas?archivados=1" : "/tarifas")} />
          Mostrar archivados
        </label>
        <div className="ml-auto flex gap-2">
          <Proveedores proveedores={proveedores} />
          <DialogoTarifarioIA proveedores={proveedores} />
          <DialogoTarifario proveedores={proveedores}>
            <Button><Plus /> Nuevo tarifario</Button>
          </DialogoTarifario>
        </div>
      </div>

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
              const v = VIGENCIA[t.vigencia];
              return (
                <div key={t.id} className={cn("flex flex-col rounded-lg border bg-card p-4", t.archivado_at && "opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/tarifas/${t.id}`} className="font-medium text-primary hover:underline">{t.nombre}</Link>
                    <span className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] font-medium", t.archivado_at ? "bg-muted text-muted-foreground" : v.clase)}>
                      {t.archivado_at ? "Archivado" : v.texto}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t.proveedor_nombre ?? "Propio · Dams Cargo"}
                    {t.servicio ? ` · ${infoServicio(t.servicio).texto}` : ""}
                    {t.origen || t.destino ? ` · ${t.origen ?? "—"} → ${t.destino ?? "—"}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {t.vigencia_desde || t.vigencia_hasta ? (
                      <span>Vigencia {t.vigencia_desde ? formatoFecha(t.vigencia_desde) : "…"} – {t.vigencia_hasta ? formatoFecha(t.vigencia_hasta) : "…"}</span>
                    ) : null}
                    <span className="num">{t.n_rutas > 0 ? `${t.n_rutas} rutas` : ""}{t.n_rutas > 0 && t.n_conceptos > 0 ? " · " : ""}{t.n_conceptos > 0 ? `${t.n_conceptos} conceptos` : ""}</span>
                    {t.documento_url && (
                      <a href={t.documento_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <FileText className="size-3" /> Documento
                      </a>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1">
                    <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/tarifas/${t.id}`} />}>Abrir</Button>
                    <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => archivar(t)} title={t.archivado_at ? "Restaurar" : "Archivar: deja de usarse pero queda en el histórico"}>
                      {t.archivado_at ? <ArchiveRestore /> : <Archive />} {t.archivado_at ? "Restaurar" : "Archivar"}
                    </Button>
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
