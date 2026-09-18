"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Campo, Entrada, Selector } from "@/components/Campos";
import { SECCIONES, SERVICIOS, infoSeccion } from "@/lib/etiquetas";
import type { Proveedor, Tarifario } from "@/lib/supabase/tipos";
import { guardarTarifario, type DatosTarifario } from "@/lib/tarifas/acciones";

interface Props {
  proveedores: Proveedor[];
  tarifario?: Tarifario;
  children: ReactNode;
}

/** Crear o editar la cabecera de un tarifario (nombre, proveedor, servicio, sección, tramo, vigencia). */
export function DialogoTarifario({ proveedores, tarifario, children }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [d, setD] = useState<DatosTarifario>(() => ({
    id: tarifario?.id,
    nombre: tarifario?.nombre ?? "",
    proveedor_id: tarifario?.proveedor_id ?? null,
    servicio: tarifario?.servicio ?? null,
    seccion: tarifario?.seccion ?? "flete_maritimo",
    origen: tarifario?.origen ?? "",
    destino: tarifario?.destino ?? "Guatemala",
    moneda: tarifario?.moneda ?? "USD",
    vigencia_desde: tarifario?.vigencia_desde ?? "",
    vigencia_hasta: tarifario?.vigencia_hasta ?? "",
    notas: tarifario?.notas ?? "",
  }));
  const set = <K extends keyof DatosTarifario>(k: K, v: DatosTarifario[K]) => setD((x) => ({ ...x, [k]: v }));

  const guardar = () => {
    setError(null);
    startTransition(async () => {
      const r = await guardarTarifario(d);
      if (!r.ok) return setError(r.error);
      setAbierto(false);
      if (!tarifario && r.id) router.push(`/tarifas/${r.id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger nativeButton={false} render={<span className="inline-flex" />}>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tarifario ? "Editar tarifario" : "Nuevo tarifario"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo etiqueta="Nombre" className="md:col-span-2">
            <Entrada value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Charter Link · LCL Asia → Guatemala (oct 2026)" autoFocus />
          </Campo>
          <Campo etiqueta="Proveedor">
            <Selector value={d.proveedor_id ?? ""} onChange={(e) => set("proveedor_id", e.target.value || null)}>
              <option value="">Propio (Dams Cargo)</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Servicio">
            <Selector value={d.servicio ?? ""} onChange={(e) => set("servicio", (e.target.value || null) as DatosTarifario["servicio"])}>
              <option value="">Varios / general</option>
              {SERVICIOS.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Sección">
            <Selector value={d.seccion} onChange={(e) => { set("seccion", e.target.value); set("moneda", infoSeccion(e.target.value).moneda); }}>
              {SECCIONES.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Moneda">
            <Selector value={d.moneda} onChange={(e) => set("moneda", e.target.value as "USD" | "GTQ")}>
              <option value="USD">USD</option>
              <option value="GTQ">GTQ</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Origen / tramo">
            <Entrada value={d.origen ?? ""} onChange={(e) => set("origen", e.target.value)} placeholder="Asia, Miami, China…" />
          </Campo>
          <Campo etiqueta="Destino">
            <Entrada value={d.destino ?? ""} onChange={(e) => set("destino", e.target.value)} />
          </Campo>
          <Campo etiqueta="Vigente desde">
            <Entrada type="date" value={d.vigencia_desde ?? ""} onChange={(e) => set("vigencia_desde", e.target.value)} />
          </Campo>
          <Campo etiqueta="Vigente hasta">
            <Entrada type="date" value={d.vigencia_hasta ?? ""} onChange={(e) => set("vigencia_hasta", e.target.value)} />
          </Campo>
          <Campo etiqueta="Notas / condiciones" className="md:col-span-2">
            <textarea className="min-h-20 w-full rounded border border-input bg-white p-2 text-sm" value={d.notas ?? ""} onChange={(e) => set("notas", e.target.value)} />
          </Campo>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
