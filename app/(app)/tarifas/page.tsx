import { adminRequerido } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarTarifarios } from "@/lib/tarifas/consultas";
import { ListaTarifarios } from "@/components/tarifas/ListaTarifarios";

// Leer un tarifario con IA puede tardar más que el límite por defecto del servidor.
export const maxDuration = 60;

export default async function PaginaTarifas() {
  await adminRequerido();
  const supabase = await crearClienteServidor();
  const [tarifarios, { data: proveedores }] = await Promise.all([
    listarTarifarios(true),
    supabase.from("proveedores").select("*").order("nombre"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Base de tarifas</h1>
        <p className="text-sm text-muted-foreground">
          Un tarifario por proveedor y servicio, con su vigencia y el documento original. Cuando llega su fecha de vencimiento se apaga solo y deja de aparecer al cotizar. Editar aquí no cambia cotizaciones ya guardadas.
        </p>
      </div>
      <ListaTarifarios key={tarifarios.map((t) => `${t.id}${t.estado}${t.vigencia_hasta}`).join("|")} tarifarios={tarifarios} proveedores={proveedores ?? []} />
    </div>
  );
}
