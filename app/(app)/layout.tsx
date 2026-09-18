import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioRequerido } from "@/lib/supabase/server";
import { cerrarSesion } from "@/app/login/acciones";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/NavLinks";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { usuario } = await usuarioRequerido();
  if (!usuario) redirect("/login");

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/" className="flex items-baseline gap-2 font-semibold">
            <span className="text-lg">Dams Cargo</span>
            <span className="text-xs font-normal opacity-80">Cotizador</span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden opacity-80 sm:inline">{usuario.email}</span>
            <form action={cerrarSesion}>
              <Button type="submit" variant="secondary" size="sm">Salir</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
