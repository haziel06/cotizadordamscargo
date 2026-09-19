import Link from "next/link";
import { Anchor, Boxes, FileCheck2, Package, Plane, Truck } from "lucide-react";
import { EditorCotizacion } from "@/components/cotizacion/EditorCotizacion";
import { leerConfig } from "@/lib/config";
import { datosEditor } from "@/lib/cotizaciones/consultas";
import { catalogoParaCotizar } from "@/lib/tarifas/consultas";
import { hoyIso } from "@/lib/calculo/formato";
import { SERVICIOS } from "@/lib/etiquetas";
import type { TipoServicio } from "@/lib/supabase/tipos";

const ICONOS: Record<TipoServicio, React.ComponentType<{ className?: string }>> = {
  maritimo_fcl: Boxes,
  maritimo_lcl: Anchor,
  aereo: Plane,
  courier: Package,
  terrestre: Truck,
  aduanas: FileCheck2,
};

export default async function NuevaCotizacion(props: PageProps<"/cotizaciones/nueva">) {
  const sp = await props.searchParams;
  const tipo = SERVICIOS.find((s) => s.valor === sp.tipo)?.valor;

  // Paso 1: elegir el tipo de cotización. Solo aparece lo que aplica a ese servicio.
  if (!tipo) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Nueva cotización</h1>
          <p className="text-sm text-muted-foreground">¿Qué servicio vas a cotizar? Así solo verás las tarifas y los campos que aplican.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICIOS.map((s) => {
            const Icono = ICONOS[s.valor];
            return (
              <Link
                key={s.valor}
                href={`/cotizaciones/nueva?tipo=${s.valor}`}
                className="group flex flex-col gap-3 rounded-lg border bg-card p-5 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icono className="size-5" />
                  </span>
                  <div>
                    <div className="font-semibold text-primary">{s.texto}</div>
                    <div className="text-xs text-muted-foreground">{s.descripcion}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Ej.: {s.ejemplo}</div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const [config, { clientes }, catalogo] = await Promise.all([leerConfig(), datosEditor(), catalogoParaCotizar()]);
  return (
    <EditorCotizacion
      id={null}
      numero={null}
      cabecera={{
        tipo_servicio: tipo,
        cliente_id: null,
        cliente_nombre: "",
        contacto: "",
        fecha: hoyIso(),
        dias_vigencia: config.defaults.dias_vigencia,
        tipo_carga: "",
        kilogramos: "",
        kg_volumetricos: "",
        cbm: "",
        bultos: "",
        medidas: "",
        mercaderia: "",
        origen: "",
        destino: "Guatemala",
        transito: "",
        routing: "",
        tipo_cambio: config.defaults.tipo_cambio,
        notas_internas: "",
        incoterm: "",
        descuentos: [],
        notas: null,
      }}
      lineas={[]}
      catalogo={catalogo}
      clientes={clientes}
      defaults={config.defaults}
      recargos={config.recargos}
      textosDefault={config.textos_legales}
    />
  );
}
