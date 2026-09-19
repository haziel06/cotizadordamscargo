import { notFound } from "next/navigation";
import { EditorCotizacion } from "@/components/cotizacion/EditorCotizacion";
import { AccionesCotizacion } from "@/components/cotizacion/AccionesCotizacion";
import { leerConfig, type TextosLegales } from "@/lib/config";
import type { DescuentoForm } from "@/lib/cotizaciones/esquema";
import { datosEditor, estadoEfectivo, obtenerCotizacion } from "@/lib/cotizaciones/consultas";
import { catalogoParaCotizar } from "@/lib/tarifas/consultas";
import { sesionRequerida } from "@/lib/sesion";

type DescuentoGuardado = Omit<DescuentoForm, "_clave">;

export default async function PaginaCotizacion(props: PageProps<"/cotizaciones/[id]">) {
  const { id } = await props.params;
  const sesion = await sesionRequerida();
  const config = await leerConfig();
  const [{ clientes }, datos, catalogo] = await Promise.all([
    datosEditor(),
    obtenerCotizacion(id, { ocultarCostos: !sesion.esAdmin }),
    catalogoParaCotizar({ ocultarCostos: !sesion.esAdmin, recargos: config.recargos }),
  ]);
  if (!datos) notFound();
  const { cotizacion: c, lineas } = datos;
  // Misma regla siempre: el admin edita cualquiera; el usuario normal solo las suyas.
  const puedeEditar = sesion.esAdmin || c.creado_por === sesion.userId;

  return (
    <div className="space-y-4">
      <AccionesCotizacion id={c.id} numero={c.numero} estado={c.estado} estadoEfectivo={estadoEfectivo(c)} puedeEditar={puedeEditar} />
      <EditorCotizacion
        key={c.updated_at}
        id={c.id}
        numero={c.numero}
        esAdmin={sesion.esAdmin}
        puedeEditar={puedeEditar}
        cabecera={{
          tipo_servicio: c.tipo_servicio,
          tipos_servicio: c.tipos_servicio?.length ? c.tipos_servicio : [c.tipo_servicio],
          cliente_id: c.cliente_id,
          cliente_nombre: c.cliente_nombre,
          contacto: c.contacto ?? "",
          cliente_telefono: c.cliente_telefono ?? "",
          segmento_courier: c.segmento_courier,
          valor_mercaderia: c.valor_mercaderia ?? "",
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
          ruta_id: l.ruta_id,
          nombre: l.nombre,
          categoria: l.categoria,
          moneda: l.moneda,
          cantidad: Number(l.cantidad),
          costo_unitario: Number(l.costo_unitario),
          tipo_margen: l.tipo_margen,
          valor_margen: Number(l.valor_margen),
          lleva_iva: l.lleva_iva,
          aplica_recargos: l.aplica_recargos,
          cuenta_ajena: l.cuenta_ajena,
          nota: l.nota,
          nota_visible: l.nota_visible,
          proveedor_nombre: l.proveedor_nombre,
          ruta: l.ruta,
        }))}
        catalogo={catalogo}
        clientes={clientes}
        defaults={config.defaults}
        recargos={config.recargos}
        textosDefault={config.textos_legales}
      />
    </div>
  );
}
