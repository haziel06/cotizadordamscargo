"use client";
import { useState, useTransition } from "react";
import { Copy, Plus, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Entrada, Selector } from "@/components/Campos";
import { crearInvitacion, desactivarInvitacion } from "@/lib/usuarios/acciones";
import { formatoFecha } from "@/lib/calculo/formato";
import type { Invitacion } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";

export function Invitaciones({ invitaciones, origen }: { invitaciones: Invitacion[]; origen: string }) {
  const [pendiente, startTransition] = useTransition();
  const [nota, setNota] = useState("");
  const [usos, setUsos] = useState("1");
  const [dias, setDias] = useState("7");
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const crear = () => {
    setError(null);
    startTransition(async () => {
      const r = await crearInvitacion({ nota, usos_max: Number(usos), dias: Number(dias) });
      if (!r.ok) setError(r.error);
      else {
        setUltimo(r.dato ?? null);
        setNota("");
      }
    });
  };
  const copiar = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(`${origen}/registro?codigo=${codigo}`);
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* sin portapapeles */
    }
  };
  const estadoDe = (i: Invitacion) => {
    if (!i.activo) return { texto: "Desactivada", clase: "bg-muted text-muted-foreground" };
    if (i.vence_at && new Date(i.vence_at) < new Date()) return { texto: "Vencida", clase: "bg-amber-100 text-amber-900" };
    if (i.usos >= i.usos_max) return { texto: "Agotada", clase: "bg-muted text-muted-foreground" };
    return { texto: "Vigente", clase: "bg-green-100 text-green-900" };
  };

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-1 flex items-center gap-2 font-semibold text-primary"><Ticket className="size-4" /> Códigos de invitación</div>
      <p className="mb-3 text-xs text-muted-foreground">
        Nadie puede crear cuenta sin un código. Genera uno por persona (un uso) o uno para varios con fecha de caducidad. Si se filtra, desactívalo.
      </p>
      <div className="flex flex-wrap items-end gap-2 rounded border bg-muted/30 p-3">
        <label className="flex-1 space-y-0.5 text-xs">
          <span className="text-muted-foreground">Para quién / nota</span>
          <Entrada value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. María – ventas" className="h-8" />
        </label>
        <label className="space-y-0.5 text-xs">
          <span className="text-muted-foreground">Usos</span>
          <Selector value={usos} onChange={(e) => setUsos(e.target.value)} className="h-8 w-28">
            <option value="1">1 persona</option>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="50">50</option>
          </Selector>
        </label>
        <label className="space-y-0.5 text-xs">
          <span className="text-muted-foreground">Caduca en</span>
          <Selector value={dias} onChange={(e) => setDias(e.target.value)} className="h-8 w-28">
            <option value="1">1 día</option>
            <option value="7">7 días</option>
            <option value="30">30 días</option>
            <option value="0">Nunca</option>
          </Selector>
        </label>
        <Button size="sm" onClick={crear} disabled={pendiente}><Plus /> Generar</Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {ultimo && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-verde/40 bg-verde/5 px-3 py-2 text-sm">
          <span>Código nuevo:</span>
          <code className="rounded bg-white px-2 py-0.5 font-mono text-base font-semibold text-primary">{ultimo}</code>
          <Button size="xs" variant="outline" onClick={() => copiar(ultimo)}><Copy /> {copiado === ultimo ? "Copiado" : "Copiar enlace"}</Button>
        </div>
      )}
      <ul className="mt-3 divide-y text-sm">
        {invitaciones.length === 0 && <li className="py-2 text-xs text-muted-foreground">Todavía no has generado códigos.</li>}
        {invitaciones.map((i) => {
          const e = estadoDe(i);
          const usados = Array.isArray(i.usado_por) ? (i.usado_por as { email: string }[]) : [];
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
              <code className="font-mono font-semibold">{i.codigo}</code>
              <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", e.clase)}>{e.texto}</span>
              <span className="text-xs text-muted-foreground">
                {i.nota && `${i.nota} · `}{i.usos}/{i.usos_max} usos{i.vence_at ? ` · caduca ${formatoFecha(i.vence_at.slice(0, 10))}` : ""}
              </span>
              {usados.length > 0 && <span className="text-xs text-muted-foreground">· usado por {usados.map((u) => u.email).join(", ")}</span>}
              <div className="ml-auto flex gap-1">
                {e.texto === "Vigente" && <Button size="xs" variant="ghost" onClick={() => copiar(i.codigo)}><Copy /> {copiado === i.codigo ? "Copiado" : "Enlace"}</Button>}
                <Button size="xs" variant="ghost" disabled={pendiente} onClick={() => startTransition(async () => { await desactivarInvitacion(i.id, !i.activo); })}>
                  {i.activo ? "Desactivar" : "Reactivar"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
