"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut, Menu, Plus, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./NavLinks";
import { cn } from "@/lib/utils";

interface Props {
  nombre: string;
  email: string;
  esAdmin: boolean;
  cerrarSesion: () => Promise<void>;
}

/** Barra lateral fija en escritorio; en móvil se abre con el botón de menú. */
export function BarraLateral({ nombre, email, esAdmin, cerrarSesion }: Props) {
  const [abierta, setAbierta] = useState(false);
  const iniciales = (nombre || email).split(/[\s@]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  const contenido = (
    <div className="flex h-full flex-col">
      <div className="relative flex items-center justify-center px-3 pb-2 pt-5">
        <Link href="/" className="block w-full" onClick={() => setAbierta(false)}>
          <Image src="/logo/dams-cargo-oscuro.png" alt="Dams Cargo · Aduanas & Logística" width={480} height={160} className="mx-auto h-auto w-full max-w-[220px]" priority />
        </Link>
        <button type="button" className="absolute right-2 top-2 rounded p-1 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setAbierta(false)} aria-label="Cerrar menú">
          <X className="size-5" />
        </button>
      </div>
      <div className="px-3 pb-3">
        <Button className="w-full bg-ambar text-marino hover:bg-ambar/90" nativeButton={false} render={<Link href="/cotizaciones/nueva" onClick={() => setAbierta(false)} />}>
          <Plus /> Nueva cotización
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <NavLinks esAdmin={esAdmin} onNavegar={() => setAbierta(false)} />
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">{iniciales || "?"}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{nombre || email}</div>
            <div className="flex items-center gap-1 text-[11px] text-white/60">
              {esAdmin ? <><ShieldCheck className="size-3 text-ambar" /> Administrador</> : "Usuario"}
            </div>
          </div>
          <form action={cerrarSesion}>
            <button type="submit" className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Salir">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Móvil: barra superior */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-marino px-4 text-white lg:hidden">
        <button type="button" className="rounded p-1 hover:bg-white/10" onClick={() => setAbierta(true)} aria-label="Abrir menú">
          <Menu className="size-5" />
        </button>
        <Link href="/">
          <Image src="/logo/dams-cargo-oscuro.png" alt="Dams Cargo" width={300} height={100} className="h-9 w-auto" />
        </Link>
      </header>
      {abierta && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setAbierta(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 bg-marino text-white shadow-xl transition-transform lg:translate-x-0", abierta ? "translate-x-0" : "-translate-x-full")}>
        {contenido}
      </aside>
    </>
  );
}
