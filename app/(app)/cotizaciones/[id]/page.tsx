import { notFound } from "next/navigation";
import { EditorCotizacion } from "@/components/cotizacion/EditorCotizacion";
import { AccionesCotizacion } from "@/components/cotizacion/AccionesCotizacion";
import { leerConfig, type TextosLegales } from "@/lib/config";
import type { DescuentoForm } from "@/lib/cotizaciones/esquema";
import { datosEditor, estadoEfectivo, obtenerCotizacion } from "@/lib/cotizaciones/consultas";

type DescuentoGuardado = Omit<DescuentoForm, "_clave">;

export default async function PaginaCotizacion(props: PageProps<"/cotizaciones/[id]">) {
  const { id } = await props.params;
  const [config, { conceptos, clientes }, datos] = await Promise.all([leerConfig(), datosEditor(), obtenerCotizacion(id)]);
  if (!datos) notFound();
  const { cotizacion: c, lineas } = datos;

  return (
    <div className="space-y-4">
      <AccionesCotizacion id={c.id} numero={c.numero} estado={c.estado} estadoEfectivo={estadoEfectivo(c)} />
      <EditorCotizacion
        key={c.updated_at}
        id={c.id}
        numero={c.numero}
        cabecera={{
          cliente_id: c.cliente_id,
          cliente_nombre: c.cliente_nombre,
          contacto: c.contacto ?? "",
          fecha: c.fecha,
          dias_vigencia: c.dias_vigencia,
          tipo_carga: c.tipo_carga ?? "",
          kilogramos: c.kilogramos ?? "",
          kg_volumetricos: c.kg_volumetricos ?? "",
          cbm: c.cbm ?? "",
          bultos: c.bultos ?? "",
          medidas: c.medidas ?? "",
          mercaderia: c.mercaderia ?? "",
          origen: c.origen ?? "",
          destino: c.destino,
          transito: c.transito ?? "",
          routing: c.routing ?? "",
          tipo_cambio: Number(c.tipo_cambio),
          notas_internas: c.notas_internas ?? "",
          incoterm: c.incoterm ?? "",
          descuentos: ((c.descuentos as DescuentoGuardado[] | null) ?? []).map((d, i) => ({ ...d, _clave: `d-${i}` })),
          notas: (c.notas as TextosLegales | null) ?? null,
        }}
        lineas={lineas.map((l) => ({
          _clave: l.id,
          concepto_id: l.concepto_id,
          nombre: l.nombre,
          categoria: l.categoria,
          moneda: l.moneda,
          cantidad: Number(l.cantidad),
          costo_unitario: Number(l.costo_unitario),
          tipo_margen: l.tipo_margen,
          valor_margen: Number(l.valor_margen),
          lleva_iva: l.lleva_iva,
        }))}
        conceptos={conceptos}
        clientes={clientes}
        defaults={config.defaults}
        textosDefault={config.textos_legales}
      />
    </div>
  );
}
