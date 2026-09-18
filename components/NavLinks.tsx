"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const enlaces = [
  { href: "/", texto: "Cotizaciones" },
  { href: "/tarifas", texto: "Base de tarifas" },
  { href: "/configuracion", texto: "Configuración" },
];

export function NavLinks() {
  const ruta = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {enlaces.map((e) => {
        const activo = e.href === "/" ? ruta === "/" || ruta.startsWith("/cotizaciones") : ruta.startsWith(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            className={cn("rounded px-3 py-1.5 transition-colors hover:bg-white/10", activo && "bg-white/15 font-medium")}
          >
            {e.texto}
          </Link>
        );
      })}
    </nav>
  );
}
