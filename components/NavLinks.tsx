"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Bot, FileText, LayoutDashboard, Settings, UserSquare2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ENLACES = [
  { href: "/", texto: "Inicio", icono: LayoutDashboard, admin: false, exacto: true },
  { href: "/cotizaciones", texto: "Cotizaciones", icono: FileText, admin: false, exacto: false },
  { href: "/asistente", texto: "Asistente", icono: Bot, admin: false, exacto: false },
  { href: "/clientes", texto: "Clientes", icono: UserSquare2, admin: true, exacto: false },
  { href: "/tarifas", texto: "Base de tarifas", icono: BookOpenText, admin: true, exacto: false },
  { href: "/usuarios", texto: "Usuarios", icono: Users, admin: true, exacto: false },
  { href: "/configuracion", texto: "Configuración", icono: Settings, admin: false, exacto: false },
];

/** Menú de la barra lateral. Tarifas y Usuarios solo aparecen para administradores. */
export function NavLinks({ esAdmin, onNavegar }: { esAdmin: boolean; onNavegar?: () => void }) {
  const ruta = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {ENLACES.filter((e) => esAdmin || !e.admin).map((e) => {
        const activo = e.exacto ? ruta === e.href : ruta.startsWith(e.href);
        const Icono = e.icono;
        return (
          <Link
            key={e.href}
            href={e.href}
            onClick={onNavegar}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white",
              activo && "bg-white/15 font-medium text-white",
            )}
          >
            <Icono className="size-4" />
            {e.texto}
          </Link>
        );
      })}
    </nav>
  );
}
