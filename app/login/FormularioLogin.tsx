"use client";
import { useActionState } from "react";
import { iniciarSesion } from "./acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, undefined);
  return (
    <form action={accion} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="correo">Correo</Label>
        <Input id="correo" name="correo" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clave">Contraseña</Label>
        <Input id="clave" name="clave" type="password" autoComplete="current-password" required />
      </div>
      {estado?.error && <p className="text-sm text-destructive">{estado.error}</p>}
      <Button type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
