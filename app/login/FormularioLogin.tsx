"use client";
import { useActionState } from "react";
import Link from "next/link";
import { iniciarSesion } from "./acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoClave } from "@/components/CampoClave";
import { Label } from "@/components/ui/label";

export function FormularioLogin({ inactivo }: { inactivo?: boolean }) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, undefined);
  return (
    <form action={accion} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="correo">Correo</Label>
        <Input id="correo" name="correo" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clave">Contraseña</Label>
        <CampoClave id="clave" name="clave" autoComplete="current-password" required />
      </div>
      {inactivo && <p className="text-sm text-destructive">Tu cuenta está desactivada. Habla con el administrador.</p>}
      {estado?.error && <p className="text-sm text-destructive">{estado.error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Tienes un código de invitación? <Link href="/registro" className="font-medium text-primary underline">Crear cuenta</Link>
      </p>
    </form>
  );
}
