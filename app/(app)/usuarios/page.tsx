import { adminRequerido } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { TablaUsuarios } from "@/components/usuarios/TablaUsuarios";
import { Invitaciones } from "@/components/usuarios/Invitaciones";
import { ClaveAdmin } from "@/components/usuarios/ClaveAdmin";

export default async function PaginaUsuarios() {
  const sesion = await adminRequerido();
  const supabase = await crearClienteServidor();
  const inicioMes = new Date(); inicioMes.setDate(1);
  const mesIso = inicioMes.toISOString().slice(0, 10);
  const [{ data: perfiles }, { data: invitaciones }, { data: cots }] = await Promise.all([
    supabase.from("perfiles").select("user_id, nombre, email, correo, cargo, rol, activo, created_at").order("created_at"),
    supabase.from("invitaciones").select("*").order("created_at", { ascending: false }),
    supabase.from("cotizaciones").select("creado_por, estado, fecha, total_gtq, utilidad_gtq"),
  ]);
  // Resumen por persona: total, aceptadas, cotizado y aceptado del mes, utilidad del mes.
  const resumen = new Map<string, { total: number; aceptadas: number; mes: number; monto_mes: number; aceptado_mes: number; utilidad_mes: number }>();
  for (const c of cots ?? []) {
    if (!c.creado_por) continue;
    const r = resumen.get(c.creado_por) ?? { total: 0, aceptadas: 0, mes: 0, monto_mes: 0, aceptado_mes: 0, utilidad_mes: 0 };
    r.total++;
    if (c.estado === "aceptada") r.aceptadas++;
    if (c.fecha >= mesIso) {
      r.mes++;
      r.monto_mes += Number(c.total_gtq);
      if (c.estado === "aceptada") { r.aceptado_mes += Number(c.total_gtq); r.utilidad_mes += Number(c.utilidad_gtq); }
    }
    resumen.set(c.creado_por, r);
  }
  const origen = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Quién entra a la plataforma y con qué permisos. Los administradores ven costos, fórmula y tarifas; los usuarios solo cotizan con precios de venta.
        </p>
      </div>
      <TablaUsuarios perfiles={perfiles ?? []} miId={sesion.userId} resumen={Object.fromEntries(resumen)} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Invitaciones invitaciones={invitaciones ?? []} origen={origen} />
        <ClaveAdmin />
      </div>
    </div>
  );
}
