"use client";
import { useMemo, useState } from "react";
import { Phone, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Entrada } from "@/components/Campos";
import { clientesSimilares } from "@/lib/clientes/buscar";
import type { Cliente } from "@/lib/supabase/tipos";

/**
 * Primer paso de una cotización nueva: ¿para quién? Un cliente guardado trae todos sus datos (contacto, teléfono,
 * consignatario, dirección) y sus precios preferenciales; «Nuevo cliente» deja el formulario en blanco como siempre.
 */
export function ElegirCliente({ clientes, onElegir, onNuevo }: { clientes: Cliente[]; onElegir: (c: Cliente) => void; onNuevo: () => void }) {
  const [q, setQ] = useState("");
  const lista = useMemo(() => (q.trim().length >= 2 ? clientesSimilares(q.trim(), clientes) : clientes), [q, clientes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Para quién es esta cotización?</CardTitle>
        <p className="text-sm text-muted-foreground">Elige un cliente guardado y se copian sus datos y sus precios preferenciales, o empieza con uno nuevo.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Entrada value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${clientes.length} clientes guardados…`} className="pl-8" autoComplete="off" autoFocus />
          </div>
          <Button type="button" onClick={onNuevo}><Plus /> Nuevo cliente</Button>
        </div>
        {lista.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No hay un cliente guardado con ese nombre. Pulsa «Nuevo cliente» para empezar con él.</p>
        ) : (
          <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((k) => (
              <button key={k.id} type="button" onClick={() => onElegir(k)} className="rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5">
                <div className="font-medium text-primary">{k.empresa || k.nombre}</div>
                {k.empresa && k.nombre && <div className="text-xs text-muted-foreground">{k.nombre}</div>}
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {k.contacto_nombre && <div>{k.contacto_nombre}</div>}
                  {k.contacto_telefono && <div className="flex items-center gap-1"><Phone className="size-3" /> {k.contacto_telefono}</div>}
                  {k.consignatario && <div>Consignatario: {k.consignatario}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
