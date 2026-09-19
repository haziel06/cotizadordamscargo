"use client";
import { useState, useTransition } from "react";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerarClaveAdmin } from "@/lib/usuarios/acciones";

/** La clave se muestra una sola vez al generarla; en la base solo queda su hash. */
export function ClaveAdmin() {
  const [pendiente, startTransition] = useTransition();
  const [clave, setClave] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);

  const generar = () => {
    if (clave && !confirm("Se generará una clave nueva y la anterior dejará de servir. ¿Continuar?")) return;
    setError(null);
    startTransition(async () => {
      const r = await regenerarClaveAdmin();
      if (!r.ok) setError(r.error);
      else setClave(r.dato ?? null);
    });
  };
  const copiar = async () => {
    if (!clave) return;
    try {
      await navigator.clipboard.writeText(clave);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 1500);
    } catch {
      /* sin portapapeles */
    }
  };

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-1 flex items-center gap-2 font-semibold text-primary"><KeyRound className="size-4" /> Clave de administrador</div>
      <p className="mb-3 text-xs text-muted-foreground">
        Compártela solo con quien deba ver costos y tarifas. La persona la escribe una vez en Configuración → «Tengo clave de administrador» y queda como admin.
        Cada vez que la regeneres, la anterior deja de servir (quien ya es admin lo sigue siendo; quítale el rol arriba si hace falta).
      </p>
      {clave ? (
        <div className="flex flex-wrap items-center gap-2 rounded border border-ambar bg-ambar/10 px-3 py-2">
          <code className="font-mono text-lg font-semibold tracking-wide text-primary">{clave}</code>
          <Button size="xs" variant="outline" onClick={copiar}><Copy /> {copiada ? "Copiada" : "Copiar"}</Button>
          <span className="w-full text-xs text-amber-900">Guárdala ahora: al salir de esta página no se vuelve a mostrar.</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Por seguridad la clave actual no se puede ver; solo generar una nueva.</p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <Button size="sm" variant="outline" className="mt-3" onClick={generar} disabled={pendiente}>
        <RefreshCw /> {clave ? "Generar otra" : "Generar clave"}
      </Button>
    </section>
  );
}
