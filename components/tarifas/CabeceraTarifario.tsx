"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SECCIONES, infoServicio } from "@/lib/etiquetas";
import { formatoFecha } from "@/lib/calculo/formato";
import type { Proveedor, Tarifario } from "@/lib/supabase/tipos";
import { ETIQUETA_ESTADO, textoVencimiento, type EstadoTarifario } from "@/lib/tarifas/estado";
import { archivarTarifario, eliminarTarifario, subirDocumentoTarifario } from "@/lib/tarifas/acciones";
import { DialogoTarifario } from "./DialogoTarifario";
import { cn } from "@/lib/utils";

export function CabeceraTarifario({ tarifario: t, proveedores, estado }: { tarifario: Tarifario; proveedores: Proveedor[]; estado: EstadoTarifario }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const prov = proveedores.find((p) => p.id === t.proveedor_id);
  const sec = SECCIONES.find((s) => s.valor === t.seccion);
  const v = ETIQUETA_ESTADO[estado];

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
    <div className={cn("rounded-lg border bg-card p-5", (estado === "desactivado" || estado === "vencido") && "bg-muted/30")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-primary">{t.nombre}</h1>
            <span className={cn("rounded px-2 py-0.5 text-[11px] font-medium", v.clase)}>{v.texto}</span>
            <span className="text-xs text-muted-foreground">{textoVencimiento(t)}</span>
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
          <label className="flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm">
            Usar al cotizar
            <Switch checked={!t.archivado_at} disabled={pendiente} aria-label="Usar al cotizar"
              onCheckedChange={(prendido) => startTransition(async () => { await archivarTarifario(t.id, !prendido); router.refresh(); })} />
          </label>
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
