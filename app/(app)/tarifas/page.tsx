import { crearClienteServidor } from "@/lib/supabase/server";
import { listarTarifarios } from "@/lib/tarifas/consultas";
import { ListaTarifarios } from "@/components/tarifas/ListaTarifarios";

export default async function PaginaTarifas(props: PageProps<"/tarifas">) {
  const sp = await props.searchParams;
  const archivados = sp.archivados === "1";
  const supabase = await crearClienteServidor();
  const [tarifarios, { data: proveedores }] = await Promise.all([
    listarTarifarios(archivados),
    supabase.from("proveedores").select("*").order("nombre"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Base de tarifas</h1>
        <p className="text-sm text-muted-foreground">
          Un tarifario por proveedor y servicio, con su vigencia y el documento original. Editar aquí no cambia cotizaciones ya guardadas.
        </p>
      </div>
      <ListaTarifarios key={`${archivados}-${tarifarios.length}`} tarifarios={tarifarios} proveedores={proveedores ?? []} mostrandoArchivados={archivados} />
    </div>
  );
}
