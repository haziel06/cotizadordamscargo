import { sesionRequerida } from "@/lib/sesion";
import { cerrarSesion } from "@/app/login/acciones";
import { BarraLateral } from "@/components/BarraLateral";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const sesion = await sesionRequerida();
  return (
    <div className="min-h-screen bg-muted/30">
      <BarraLateral nombre={sesion.nombre} email={sesion.email} esAdmin={sesion.esAdmin} cerrarSesion={cerrarSesion} />
      <main className="min-w-0 px-4 py-6 lg:ml-64 lg:px-8">{children}</main>
    </div>
  );
}
