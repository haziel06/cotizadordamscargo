"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Campo, Entrada } from "@/components/Campos";
import type { Cliente } from "@/lib/supabase/tipos";
import { guardarCliente, type DatosCliente } from "@/lib/clientes/acciones";

interface Props { cliente?: Cliente; children: ReactNode; onGuardado?: (id: string) => void }

/** Crear o editar los datos de contacto de un cliente. */
export function DialogoCliente({ cliente, children, onGuardado }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [d, setD] = useState<DatosCliente>(() => ({
    id: cliente?.id,
    nombre: cliente?.nombre ?? "",
    empresa: cliente?.empresa ?? null,
    contacto_nombre: cliente?.contacto_nombre ?? null,
    contacto_telefono: cliente?.contacto_telefono ?? null,
    contacto_email: cliente?.contacto_email ?? null,
    nit: cliente?.nit ?? null,
    notas: cliente?.notas ?? null,
    activo: cliente?.activo ?? true,
  }));
  const set = <K extends keyof DatosCliente>(k: K, v: DatosCliente[K]) => setD((x) => ({ ...x, [k]: v }));

  const guardar = () => {
    setError(null);
    startTransition(async () => {
      const r = await guardarCliente(d);
      if (!r.ok) return setError(r.error);
      setAbierto(false);
      if (onGuardado && r.id) onGuardado(r.id);
      else if (!cliente && r.id) router.push(`/clientes/${r.id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger nativeButton={false} render={<span className="inline-flex" />}>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo etiqueta="Nombre / empresa" className="md:col-span-2">
            <Entrada value={d.nombre} onChange={(e) => set("nombre", e.target.value)} autoFocus />
          </Campo>
          <Campo etiqueta="Empresa (si el nombre es de una persona)">
            <Entrada value={d.empresa ?? ""} onChange={(e) => set("empresa", e.target.value || null)} />
          </Campo>
          <Campo etiqueta="NIT">
            <Entrada value={d.nit ?? ""} onChange={(e) => set("nit", e.target.value || null)} />
          </Campo>
          <Campo etiqueta="Contacto (nombre)">
            <Entrada value={d.contacto_nombre ?? ""} onChange={(e) => set("contacto_nombre", e.target.value || null)} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <Entrada value={d.contacto_telefono ?? ""} onChange={(e) => set("contacto_telefono", e.target.value || null)} />
          </Campo>
          <Campo etiqueta="Correo" className="md:col-span-2">
            <Entrada value={d.contacto_email ?? ""} onChange={(e) => set("contacto_email", e.target.value || null)} />
          </Campo>
          <Campo etiqueta="Notas" className="md:col-span-2">
            <Entrada value={d.notas ?? ""} onChange={(e) => set("notas", e.target.value || null)} />
          </Campo>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={pendiente || !d.nombre.trim()}>{pendiente ? "Guardando…" : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
