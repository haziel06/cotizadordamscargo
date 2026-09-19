import { EditorCotizacion } from "@/components/cotizacion/EditorCotizacion";
import { SelectorServicios } from "@/components/cotizacion/SelectorServicios";
import { leerConfig } from "@/lib/config";
import { datosEditor } from "@/lib/cotizaciones/consultas";
import { catalogoParaCotizar } from "@/lib/tarifas/consultas";
import { hoyIso } from "@/lib/calculo/formato";
import { SERVICIOS } from "@/lib/etiquetas";
import { sesionRequerida } from "@/lib/sesion";
import type { TipoServicio } from "@/lib/supabase/tipos";

export default async function NuevaCotizacion(props: PageProps<"/cotizaciones/nueva">) {
  const sp = await props.searchParams;
  const pedidos = String(sp.tipos ?? sp.tipo ?? "").split(",");
  const tipos = pedidos.map((t) => SERVICIOS.find((s) => s.valor === t)?.valor).filter((t): t is TipoServicio => !!t);

  // Paso 1: elegir uno o varios servicios. Solo aparece lo que aplica.
  if (!tipos.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Nueva cotización</h1>
          <p className="text-sm text-muted-foreground">¿Qué vas a cotizar? Marca uno o varios servicios; solo verás las tarifas y los campos que aplican.</p>
        </div>
        <SelectorServicios />
      </div>
    );
  }

  const sesion = await sesionRequerida();
  const config = await leerConfig();
  const [{ clientes }, catalogo] = await Promise.all([
    datosEditor(),
    catalogoParaCotizar({ ocultarCostos: !sesion.esAdmin, recargos: config.recargos }),
  ]);
  return (
    <EditorCotizacion
      id={null}
      numero={null}
      esAdmin={sesion.esAdmin}
      puedeEditar
      cabecera={{
        tipo_servicio: tipos[0],
        tipos_servicio: tipos,
        cliente_id: null,
        cliente_nombre: "",
        contacto: "",
        cliente_telefono: "",
        consignatario: "",
        direccion_entrega: "",
        fuera_perimetro: false,
        segmento_courier: tipos.includes("courier") ? "consolidado" : null,
        valor_mercaderia: "",
        fecha: hoyIso(),
        dias_vigencia: config.defaults.dias_vigencia,
        tipo_carga: "",
        kilogramos: "",
        kg_volumetricos: "",
        cbm: "",
        bultos: "",
        medidas: "",
        mercaderia: "",
        origen: tipos.includes("courier") ? "Miami, Estados Unidos" : "",
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
