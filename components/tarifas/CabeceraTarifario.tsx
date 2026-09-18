"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, FileText, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SECCIONES, infoServicio } from "@/lib/etiquetas";
import { formatoFecha } from "@/lib/calculo/formato";
import type { Proveedor, Tarifario } from "@/lib/supabase/tipos";
import type { EstadoVigencia } from "@/lib/tarifas/consultas";
import { archivarTarifario, eliminarTarifario, subirDocumentoTarifario } from "@/lib/tarifas/acciones";
import { DialogoTarifario } from "./DialogoTarifario";
import { cn } from "@/lib/utils";

const VIGENCIA: Record<EstadoVigencia, { texto: string; clase: string }> = {
  vigente: { texto: "Vigente", clase: "bg-green-100 text-green-900" },
  por_vencer: { texto: "Por vencer", clase: "bg-amber-100 text-amber-900" },
  vencido: { texto: "Vencido", clase: "bg-red-100 text-red-900" },
  sin_fecha: { texto: "Sin vigencia definida", clase: "bg-muted text-muted-foreground" },
};

export function CabeceraTarifario({ tarifario: t, proveedores, vigencia }: { tarifario: Tarifario; proveedores: Proveedor[]; vigencia: EstadoVigencia }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const prov = proveedores.find((p) => p.id === t.proveedor_id);
  const sec = SECCIONES.find((s) => s.valor === t.seccion);
  const v = VIGENCIA[vigencia];

  const subir = () => {
    const f = archivo.current?.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set("archivo", f);
    startTransition(async () => {
      const r = await subirDocumentoTarifario(t.id, fd);
      setMsg(r.ok ? "Documento guardado" : r.error);
      router.refresh();
    });
  };

  return (
    <div className={cn("rounded-lg border bg-card p-5", t.archivado_at && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-primary">{t.nombre}</h1>
            <span className={cn("rounded px-2 py-0.5 text-[11px] font-medium", t.archivado_at ? "bg-muted text-muted-foreground" : v.clase)}>
              {t.archivado_at ? "Archivado" : v.texto}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {prov?.nombre ?? "Propio · Dams Cargo"} · {sec?.texto ?? t.seccion}
            {t.servicio ? ` · ${infoServicio(t.servicio).texto}` : ""} · {t.moneda}
            {t.origen || t.destino ? ` · ${t.origen ?? "—"} → ${t.destino ?? "—"}` : ""}
          </div>
          {(t.vigencia_desde || t.vigencia_hasta) && (
            <div className="mt-1 text-sm">
              Vigencia: <strong>{t.vigencia_desde ? formatoFecha(t.vigencia_desde) : "…"}</strong> al <strong>{t.vigencia_hasta ? formatoFecha(t.vigencia_hasta) : "…"}</strong>
            </div>
          )}
          {t.notas && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t.notas}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DialogoTarifario proveedores={proveedores} tarifario={t}>
            <Button variant="outline" size="sm"><Pencil /> Editar</Button>
          </DialogoTarifario>
          <Button variant="outline" size="sm" disabled={pendiente} onClick={() => startTransition(async () => { await archivarTarifario(t.id, !t.archivado_at); router.refresh(); })}>
            {t.archivado_at ? <><ArchiveRestore /> Restaurar</> : <><Archive /> Archivar</>}
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={pendiente}
            onClick={() => {
              if (!confirm(`¿Borrar DEFINITIVAMENTE "${t.nombre}" y todas sus tarifas? No se puede deshacer.`)) return;
              startTransition(async () => { const r = await eliminarTarifario(t.id); if (r.ok) router.push("/tarifas"); else alert(r.error); });
            }}>
            <Trash2 /> Borrar
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
        {t.documento_url ? (
          <a href={t.documento_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <FileText className="size-4" /> Ver documento original
          </a>
        ) : (
          <span className="text-muted-foreground">Sin documento original adjunto.</span>
        )}
        <input ref={archivo} type="file" accept=".pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg" className="text-sm" />
        <Button size="sm" variant="outline" disabled={pendiente} onClick={subir}><Upload /> {t.documento_url ? "Reemplazar" : "Adjuntar PDF / Excel"}</Button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
