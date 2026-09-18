import { EditorCotizacion } from "@/components/cotizacion/EditorCotizacion";
import { leerConfig } from "@/lib/config";
import { datosEditor } from "@/lib/cotizaciones/consultas";
import { hoyIso } from "@/lib/calculo/formato";

export default async function NuevaCotizacion() {
  const [config, { conceptos, clientes }] = await Promise.all([leerConfig(), datosEditor()]);
  return (
    <EditorCotizacion
      id={null}
      numero={null}
      cabecera={{
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
      }}
      lineas={[]}
      conceptos={conceptos}
      clientes={clientes}
      defaults={config.defaults}
    />
  );
}
