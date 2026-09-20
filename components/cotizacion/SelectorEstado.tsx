"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Send, X } from "lucide-react";
import { cambiarEstado } from "@/lib/cotizaciones/acciones";
import { infoEstado } from "@/lib/etiquetas";
import type { Database } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";

type Estado = Database["public"]["Enums"]["estado_cotizacion"];

const OPCIONES: { valor: Estado; texto: string; icono: React.ComponentType<{ className?: string }>; activo: string }[] = [
  { valor: "borrador", texto: "Borrador", icono: FileText, activo: "bg-muted text-foreground border-foreground/30" },
  { valor: "enviada", texto: "Enviada", icono: Send, activo: "bg-blue-600 text-white border-blue-600" },
  { valor: "aceptada", texto: "Aceptada", icono: Check, activo: "bg-verde text-white border-verde" },
  { valor: "rechazada", texto: "Rechazada", icono: X, activo: "bg-red-600 text-white border-red-600" },
];

interface Props {
  id: string;
  estado: Estado;
  /** Estado que se muestra (puede ser "vencida", que no se guarda). */
  estadoEfectivo: Estado;
  /** "botones" en la cotización; "compacto" (un select) en la lista. */
  modo?: "botones" | "compacto";
  disabled?: boolean;
}

/** Cambia el estado con un clic. Vencida no se elige: se calcula sola por la fecha de vigencia. */
export function SelectorEstado({ id, estado, estadoEfectivo, modo = "botones", disabled }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const cambiar = (e: Estado) => {
    if (e === estado) return;
    startTransition(async () => {
      const r = await cambiarEstado(id, e);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  };

  if (modo === "compacto") {
    const info = infoEstado(estadoEfectivo);
    return (
      <select
        value={estado}
        disabled={disabled || pendiente}
        onChange={(e) => cambiar(e.target.value as Estado)}
        onClick={(e) => e.stopPropagation()}
        className={cn("h-7 cursor-pointer rounded border-0 px-2 text-xs font-medium outline-none ring-1 ring-transparent focus:ring-primary/40", info.clase)}
        title="Cambiar estado"
      >
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor}>{o.valor === estado && estadoEfectivo === "vencida" ? "Vencida" : o.texto}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPCIONES.map((o) => {
        const Icono = o.icono;
        const on = o.valor === estado;
        return (
          <button
            key={o.valor}
            type="button"
            disabled={disabled || pendiente}
            onClick={() => cambiar(o.valor)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60",
              on ? o.activo : "border-input bg-white text-muted-foreground hover:bg-muted",
            )}
          >
            <Icono className="size-3.5" /> {o.texto}
          </button>
        );
      })}
      {estadoEfectivo === "vencida" && (
        <span className="ml-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">Vencida (pasó la vigencia)</span>
      )}
    </div>
  );
}
