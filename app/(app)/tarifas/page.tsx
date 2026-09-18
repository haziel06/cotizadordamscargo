import { crearClienteServidor } from "@/lib/supabase/server";
import { TablaTarifas } from "@/components/tarifas/TablaTarifas";

export default async function PaginaTarifas() {
  const supabase = await crearClienteServidor();
  const [{ data: conceptos }, { data: proveedores }] = await Promise.all([
    supabase.from("conceptos").select("*").order("categoria").order("orden").order("nombre"),
    supabase.from("proveedores").select("*").order("nombre"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Base de tarifas</h1>
        <p className="text-sm text-muted-foreground">
          Costos y márgenes que se cargan al armar una cotización. Editar aquí no cambia cotizaciones ya guardadas.
        </p>
      </div>
      <TablaTarifas key={JSON.stringify(conceptos?.map((c) => c.updated_at))} conceptos={conceptos ?? []} proveedores={proveedores ?? []} />
    </div>
  );
}
