"use client";
import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eliminarCotizaciones } from "@/lib/cotizaciones/acciones";

type Ctx = { marcadas: Set<string>; alternar: (id: string) => void; todas: (ids: string[], on: boolean) => void };
const Contexto = createContext<Ctx | null>(null);

/** Envuelve la tabla: casillas por fila y barra flotante para borrar varias cotizaciones. */
export function SeleccionLista({ children, ids }: { children: React.ReactNode; ids: string[] }) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [pendiente, startTransition] = useTransition();
  const alternar = (id: string) => setMarcadas((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todas = (xs: string[], on: boolean) => setMarcadas(() => new Set(on ? xs : []));
  const borrar = () => {
    const n = marcadas.size;
    if (!confirm(`¿Borrar definitivamente ${n === 1 ? "esta cotización" : `estas ${n} cotizaciones`}? No se puede deshacer.`)) return;
    startTransition(async () => {
      const r = await eliminarCotizaciones([...marcadas]);
      if (!r.ok) alert(r.error);
      setMarcadas(new Set());
      router.refresh();
    });
  };
  return (
    <Contexto.Provider value={{ marcadas, alternar, todas }}>
      {children}
      {marcadas.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg lg:left-[calc(50%+8rem)]">
          <span className="text-sm">{marcadas.size} seleccionada{marcadas.size === 1 ? "" : "s"}</span>
          <Button size="sm" variant="ghost" onClick={() => todas(ids, false)}>Quitar selección</Button>
          <Button size="sm" variant="destructive" disabled={pendiente} onClick={borrar}><Trash2 /> Borrar</Button>
        </div>
      )}
    </Contexto.Provider>
  );
}

export function CasillaFila({ id, disabled }: { id: string; disabled?: boolean }) {
  const ctx = useContext(Contexto);
  if (!ctx) return null;
  return <input type="checkbox" className="size-4 accent-primary" checked={ctx.marcadas.has(id)} disabled={disabled} onChange={() => ctx.alternar(id)} aria-label="Seleccionar" />;
}

export function CasillaTodas({ ids }: { ids: string[] }) {
  const ctx = useContext(Contexto);
  if (!ctx) return null;
  const todasOn = ids.length > 0 && ids.every((i) => ctx.marcadas.has(i));
  return <input type="checkbox" className="size-4 accent-primary" checked={todasOn} onChange={(e) => ctx.todas(ids, e.target.checked)} aria-label="Seleccionar todas" />;
}
