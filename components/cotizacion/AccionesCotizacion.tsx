"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Selector } from "@/components/Campos";
import { ESTADOS, infoEstado } from "@/lib/etiquetas";
import { cambiarEstado, duplicarCotizacion, eliminarCotizacion } from "@/lib/cotizaciones/acciones";
import type { Database } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";

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
  const info = infoEstado(estadoEfectivo);

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
      <span className={cn("rounded px-2 py-0.5 text-xs font-medium", info.clase)}>{info.texto}</span>
      {!puedeEditar && <span className="text-xs text-muted-foreground">Solo lectura: la creó otra persona.</span>}
      {puedeEditar && <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Cambiar a
        <Selector
          value={estado}
          disabled={pendiente}
          className="w-32"
          onChange={(e) =>
            startTransition(async () => {
              await cambiarEstado(id, e.target.value as Estado);
              router.refresh();
            })
          }
        >
          {ESTADOS.filter((e) => e.valor !== "vencida").map((e) => (
            <option key={e.valor} value={e.valor}>{e.texto}</option>
          ))}
        </Selector>
      </label>}
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
