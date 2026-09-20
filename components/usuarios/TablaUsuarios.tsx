"use client";
import { useState, useTransition } from "react";
import { ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cambiarRolUsuario } from "@/lib/usuarios/acciones";
import Link from "next/link";
import { formatoFecha, formatoMoneda } from "@/lib/calculo/formato";
import type { Rol } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";

interface Fila { user_id: string; nombre: string; email: string; correo: string; cargo: string; rol: Rol; activo: boolean; created_at: string }
type Resumen = { total: number; aceptadas: number; mes: number; monto_mes: number; aceptado_mes: number; utilidad_mes: number };

const CORREO_RAIZ = "hazielrsm0006@gmail.com";

export function TablaUsuarios({ perfiles, miId, resumen }: { perfiles: Fila[]; miId: string; resumen: Record<string, Resumen> }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cambiar = (f: Fila, cambios: Partial<Pick<Fila, "rol" | "activo">>) => {
    setError(null);
    startTransition(async () => {
      const r = await cambiarRolUsuario({ user_id: f.user_id, rol: cambios.rol ?? f.rol, activo: cambios.activo ?? f.activo });
      if (!r.ok) setError(r.error);
    });
  };
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold text-primary">Cuentas ({perfiles.length})</h2>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Persona</th>
            <th className="px-3 py-2 font-medium">Rol</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 text-right font-medium" title="Cotizaciones en total / aceptadas">Cotizaciones</th>
            <th className="px-3 py-2 text-right font-medium" title="Este mes: cotizado / aceptado">Este mes (Q)</th>
            <th className="px-3 py-2 text-right font-medium" title="Utilidad de lo aceptado este mes (interno)">Utilidad mes</th>
            <th className="px-3 py-2 font-medium">Desde</th>
            <th className="px-3 py-2 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {perfiles.map((f) => {
            const soyYo = f.user_id === miId;
            const esRaiz = f.email === CORREO_RAIZ;
            const r = resumen[f.user_id] ?? { total: 0, aceptadas: 0, mes: 0, monto_mes: 0, aceptado_mes: 0, utilidad_mes: 0 };
            return (
              <tr key={f.user_id} className={cn(!f.activo && "opacity-60")}>
                <td className="px-4 py-2">
                  <div className="font-medium">
                    {f.nombre || "(sin nombre)"} {soyYo && <span className="text-xs text-muted-foreground">(tú)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{f.email || f.correo}{f.cargo ? ` · ${f.cargo}` : ""}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", f.rol === "admin" ? "bg-ambar/20 text-amber-900" : "bg-muted")}>
                    {f.rol === "admin" ? <ShieldCheck className="size-3" /> : <User className="size-3" />}
                    {f.rol === "admin" ? "Administrador" : "Usuario"}
                  </span>
                  {esRaiz && <span className="ml-1 text-[11px] text-muted-foreground">raíz</span>}
                </td>
                <td className="px-3 py-2 text-xs">{f.activo ? <span className="text-verde">Activa</span> : <span className="text-destructive">Desactivada</span>}</td>
                <td className="num px-3 py-2 text-right text-xs">
                  <Link href={`/?usuario=${f.user_id}`} className="text-primary hover:underline" title="Ver su panel">{r.total}</Link>
                  <span className="text-muted-foreground"> · {r.aceptadas} acept.</span>
                </td>
                <td className="num px-3 py-2 text-right text-xs">
                  {formatoMoneda(r.monto_mes, "GTQ")}
                  <div className="text-verde">{formatoMoneda(r.aceptado_mes, "GTQ")} acept.</div>
                </td>
                <td className="num px-3 py-2 text-right text-xs text-verde">{formatoMoneda(r.utilidad_mes, "GTQ")}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatoFecha(f.created_at.slice(0, 10))}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="xs" variant="ghost" nativeButton={false} render={<Link href={`/?usuario=${f.user_id}`} />}>Ver panel</Button>
                  {!soyYo && !esRaiz && (
                    <>
                      <Button size="xs" variant="outline" disabled={pendiente} onClick={() => cambiar(f, { rol: f.rol === "admin" ? "usuario" : "admin" })}>
                        {f.rol === "admin" ? "Quitar admin" : "Hacer admin"}
                      </Button>
                      <Button size="xs" variant={f.activo ? "ghost" : "outline"} disabled={pendiente} className={cn(f.activo && "text-destructive")} onClick={() => cambiar(f, { activo: !f.activo })}>
                        {f.activo ? "Desactivar" : "Reactivar"}
                      </Button>
                    </>
                  )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
