"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Casilla, Entrada } from "@/components/Campos";
import type { Cliente } from "@/lib/supabase/tipos";
import { archivarCliente } from "@/lib/clientes/acciones";
import { DialogoCliente } from "./DialogoCliente";
import { cn } from "@/lib/utils";

export function ListaClientes({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [verArchivados, setVerArchivados] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return clientes
      .filter((c) => verArchivados || c.activo)
      .filter((c) => !t || `${c.nombre} ${c.empresa ?? ""} ${c.contacto_nombre ?? ""}`.toLowerCase().includes(t));
  }, [clientes, q, verArchivados]);

  const archivar = (c: Cliente) =>
    startTransition(async () => {
      const r = await archivarCliente(c.id, !c.activo);
      if (!r.ok) alert(r.error);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Entrada placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" autoComplete="off" />
        <label className="flex items-center gap-2 text-sm">
          <Casilla checked={verArchivados} onChange={(e) => setVerArchivados(e.target.checked)} /> Mostrar desactivados
        </label>
        <DialogoCliente>
          <Button className="ml-auto"><Plus /> Nuevo cliente</Button>
        </DialogoCliente>
      </div>

      {visibles.length === 0 && <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No hay clientes con ese filtro.</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibles.map((c) => (
          <div key={c.id} className={cn("flex flex-col rounded-lg border bg-card p-4", !c.activo && "opacity-60")}>
            <Link href={`/clientes/${c.id}`} className="font-medium text-primary hover:underline">{c.empresa || c.nombre}</Link>
            <div className="mt-1 text-xs text-muted-foreground">
              {c.empresa && c.nombre !== c.empresa ? `${c.nombre} · ` : ""}{c.contacto_telefono || c.contacto_email || "Sin contacto"}
            </div>
            <div className="mt-3 flex items-center gap-1">
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/clientes/${c.id}`} />}>Ver / editar</Button>
              <Button variant="ghost" size="sm" disabled={pendiente} className="ml-auto" onClick={() => archivar(c)}>
                {c.activo ? <Archive /> : <ArchiveRestore />} {c.activo ? "Desactivar" : "Reactivar"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
