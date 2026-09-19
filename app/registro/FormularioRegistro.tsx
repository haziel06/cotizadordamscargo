"use client";
import { useActionState } from "react";
import Link from "next/link";
import { registrarse } from "@/app/login/acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormularioRegistro({ codigoInicial }: { codigoInicial?: string }) {
  const [estado, accion, pendiente] = useActionState(registrarse, undefined);
  if (estado?.aviso) {
    return (
      <div className="space-y-4 rounded-lg border border-verde/40 bg-verde/5 p-4 text-sm">
        <p className="font-medium text-verde">{estado.aviso}</p>
        <Link href="/login" className="font-medium text-primary underline">Ir a iniciar sesión</Link>
      </div>
    );
  }
  return (
    <form action={accion} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="codigo">Código de invitación</Label>
        <Input id="codigo" name="codigo" defaultValue={codigoInicial} placeholder="INV-XXXXXX" autoComplete="off" required className="font-mono uppercase" />
        <p className="text-xs text-muted-foreground">Te lo da el administrador de Dams Cargo.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Tu nombre</Label>
        <Input id="nombre" name="nombre" autoComplete="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="correo">Correo</Label>
        <Input id="correo" name="correo" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clave">Contraseña</Label>
        <Input id="clave" name="clave" type="password" autoComplete="new-password" minLength={8} required />
        <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
      </div>
      {estado?.error && <p className="text-sm text-destructive">{estado.error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={pendiente}>
        {pendiente ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta? <Link href="/login" className="font-medium text-primary underline">Iniciar sesión</Link>
      </p>
    </form>
  );
}
