"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Entrada } from "@/components/Campos";
import { canjearClaveAdmin } from "@/lib/usuarios/acciones";

/** Un usuario normal escribe aquí la clave que le dio el administrador y su cuenta pasa a admin. */
export function FormClaveAdmin() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const enviar = () => {
    setError(null);
    startTransition(async () => {
      const r = await canjearClaveAdmin(clave);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  };
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-1 flex items-center gap-2 font-semibold text-primary"><KeyRound className="size-4" /> Tengo clave de administrador</div>
      <p className="mb-3 text-xs text-muted-foreground">Si el administrador te compartió una clave, escríbela una sola vez. Tu cuenta pasará a administrador.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Entrada value={clave} onChange={(e) => setClave(e.target.value.toUpperCase())} placeholder="DAMS-XXXX-XXXX-XXXX" className="w-64 font-mono" autoComplete="off" />
        <Button size="sm" onClick={enviar} disabled={pendiente || clave.trim().length < 8}>Activar</Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </section>
  );
}
