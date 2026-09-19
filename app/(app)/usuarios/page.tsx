import { adminRequerido } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { TablaUsuarios } from "@/components/usuarios/TablaUsuarios";
import { Invitaciones } from "@/components/usuarios/Invitaciones";
import { ClaveAdmin } from "@/components/usuarios/ClaveAdmin";

export default async function PaginaUsuarios() {
  const sesion = await adminRequerido();
  const supabase = await crearClienteServidor();
  const [{ data: perfiles }, { data: invitaciones }] = await Promise.all([
    supabase.from("perfiles").select("user_id, nombre, email, correo, cargo, rol, activo, created_at").order("created_at"),
    supabase.from("invitaciones").select("*").order("created_at", { ascending: false }),
  ]);
  const origen = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Quién entra a la plataforma y con qué permisos. Los administradores ven costos, fórmula y tarifas; los usuarios solo cotizan con precios de venta.
        </p>
      </div>
      <TablaUsuarios perfiles={perfiles ?? []} miId={sesion.userId} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Invitaciones invitaciones={invitaciones ?? []} origen={origen} />
        <ClaveAdmin />
      </div>
    </div>
  );
}
