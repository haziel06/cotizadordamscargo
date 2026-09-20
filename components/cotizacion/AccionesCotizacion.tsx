"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { duplicarCotizacion, eliminarCotizacion } from "@/lib/cotizaciones/acciones";
import { SelectorEstado } from "./SelectorEstado";
import type { Database } from "@/lib/supabase/tipos";

type Estado = Database["public"]["Enums"]["estado_cotizacion"];

interface Props {
  id: string;
  numero: string;
  estado: Estado;
  estadoEfectivo: Estado;
  /** Admin o dueño de la cotización. Los demás solo pueden ver, descargar el PDF y duplicar. */
  puedeEditar: boolean;
}

export function AccionesCotizacion({ id, numero, estado, estadoEfectivo, puedeEditar }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const duplicar = () =>
    startTransition(async () => {
      const r = await duplicarCotizacion(id);
      if (r.ok) router.push(`/cotizaciones/${r.id}`);
      else alert(r.error);
    });

  const borrar = () => {
    if (!confirm(`¿Borrar la cotización ${numero}? No se puede deshacer.`)) return;
    startTransition(async () => {
      const r = await eliminarCotizacion(id);
      if (r.ok) router.push("/");
      else alert(r.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</span>
      <SelectorEstado id={id} estado={estado} estadoEfectivo={estadoEfectivo} disabled={!puedeEditar || pendiente} />
      {!puedeEditar && <span className="text-xs text-muted-foreground">Solo lectura: la creó otra persona.</span>}
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/cotizaciones/${id}/pdf`} />}>
          <FileDown /> Descargar PDF
        </Button>
        <Button variant="outline" size="sm" disabled={pendiente} onClick={duplicar}>
          <Copy /> Duplicar
        </Button>
        {puedeEditar && (
          <Button variant="ghost" size="sm" disabled={pendiente} className="text-destructive" onClick={borrar}>
            <Trash2 /> Borrar
          </Button>
        )}
      </div>
    </div>
  );
}
