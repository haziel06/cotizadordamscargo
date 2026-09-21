"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/Campos";
import { CampoClave } from "@/components/CampoClave";
import { cambiarContrasenaPropia } from "@/lib/usuarios/acciones";

/**
 * Nadie, ni tú ni un administrador, puede "ver" tu contraseña actual: Supabase solo guarda un
 * hash, no el texto real (así debe ser). Lo que sí se puede hacer, y es lo que importa de verdad,
 * es cambiarla aquí mismo con un clic, confirmando la actual primero.
 */
export function FormContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const cambiar = () => {
    setMsg(null);
    if (nueva !== confirmar) return setMsg({ ok: false, texto: "La confirmación no coincide con la nueva contraseña." });
    startTransition(async () => {
      const r = await cambiarContrasenaPropia({ actual, nueva });
      if (r.ok) {
        setMsg({ ok: true, texto: "Contraseña actualizada." });
        setActual(""); setNueva(""); setConfirmar("");
      } else {
        setMsg({ ok: false, texto: r.error });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contraseña</CardTitle>
        <CardDescription>Por seguridad nadie puede ver tu contraseña actual, ni siquiera un administrador — pero la puedes cambiar aquí cuando quieras.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Campo etiqueta="Contraseña actual"><CampoClave value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" /></Campo>
          <Campo etiqueta="Nueva contraseña"><CampoClave value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></Campo>
          <Campo etiqueta="Confirmar nueva"><CampoClave value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" /></Campo>
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={pendiente || !actual || !nueva} onClick={cambiar}>{pendiente ? "Cambiando…" : "Cambiar contraseña"}</Button>
          {msg && <span className={msg.ok ? "text-sm text-verde" : "text-sm text-destructive"}>{msg.texto}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
