import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { leerConfig } from "@/lib/config";
import { obtenerTarifario, estadoVigencia } from "@/lib/tarifas/consultas";
import { CabeceraTarifario } from "@/components/tarifas/CabeceraTarifario";
import { TablaRutas } from "@/components/tarifas/TablaRutas";
import { TablaConceptos } from "@/components/tarifas/TablaConceptos";

export default async function PaginaTarifario(props: PageProps<"/tarifas/[id]">) {
  const { id } = await props.params;
  const [datos, config] = await Promise.all([obtenerTarifario(id), leerConfig()]);
  if (!datos) notFound();
  const { tarifario, conceptos, rutas, proveedores } = datos;
  const esFlete = tarifario.seccion === "flete_maritimo" || tarifario.seccion === "flete_aereo";

  return (
    <div className="space-y-5">
      <Link href="/tarifas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Base de tarifas
      </Link>
      <CabeceraTarifario tarifario={tarifario} proveedores={proveedores} vigencia={estadoVigencia(tarifario)} />

      {(esFlete || rutas.length > 0) && (
        <TablaRutas key={`r-${rutas.length}-${tarifario.updated_at}`} tarifario={tarifario} rutas={rutas} recargos={config.recargos} />
      )}
      <TablaConceptos key={`c-${conceptos.length}-${tarifario.updated_at}`} tarifario={tarifario} conceptos={conceptos} recargos={config.recargos} />
    </div>
  );
}
