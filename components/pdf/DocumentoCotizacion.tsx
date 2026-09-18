import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Config } from "@/lib/config";
import type { Cotizacion, CotizacionLinea } from "@/lib/supabase/tipos";
import { fechaVencimiento, formatoFecha, formatoMoneda } from "@/lib/calculo/formato";
import { redondear } from "@/lib/calculo/linea";
import type { Moneda } from "@/lib/calculo/tipos";

/*
 * PDF para el cliente (spec §8). REGLA CRÍTICA: aquí solo entran precios de venta.
 * Este componente no recibe ni costo_unitario, ni valor_margen, ni utilidad. Usa `venta_total`
 * congelado en cada línea.
 */

const MARINO = "#1F3864";
const VERDE = "#2E7D4F";
const GRIS = "#5B6472";
const LINEA = "#D9DEE7";
const FONDO = "#F4F6F9";

export function registrarFuentes(base: string) {
  Font.register({
    family: "Inter",
    fonts: [
      { src: `${base}/Inter-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Inter-SemiBold.ttf`, fontWeight: 600 },
      { src: `${base}/Inter-Bold.ttf`, fontWeight: 700 },
    ],
  });
  // Evita que react-pdf parta palabras con guiones.
  Font.registerHyphenationCallback((w) => [w]);
}

const s = StyleSheet.create({
  pagina: { fontFamily: "Inter", fontSize: 9, color: "#1B2430", paddingTop: 28, paddingBottom: 40, paddingHorizontal: 40 },
  encabezado: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: MARINO, marginBottom: 12 },
  logo: { height: 55, objectFit: "contain", objectPositionX: 0 },
  logoTexto: { fontSize: 20, fontWeight: 700, color: MARINO },
  eslogan: { fontSize: 9, color: VERDE, fontWeight: 600 },
  empresa: { alignItems: "flex-end" },
  empresaLinea: { fontSize: 7.5, color: GRIS, lineHeight: 1.4 },
  titulo: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  tituloTexto: { fontSize: 15, fontWeight: 700, color: MARINO, letterSpacing: 1 },
  numero: { fontSize: 11, fontWeight: 600, color: MARINO },
  datos: { flexDirection: "row", borderWidth: 1, borderColor: LINEA, borderRadius: 3, marginBottom: 10 },
  columna: { flex: 1 },
  dato: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LINEA },
  datoEtiqueta: { width: 82, color: GRIS, fontWeight: 600, fontSize: 8 },
  datoValor: { flex: 1, fontSize: 8.5 },
  vigencia: { textAlign: "center", fontWeight: 600, color: MARINO, backgroundColor: FONDO, paddingVertical: 5, marginBottom: 12, borderRadius: 3 },
  seccion: { marginBottom: 12 },
  seccionCabecera: { flexDirection: "row", justifyContent: "space-between", backgroundColor: MARINO, color: "#FFFFFF", paddingVertical: 5, paddingHorizontal: 8, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  seccionTitulo: { fontWeight: 700, fontSize: 9, letterSpacing: 0.6 },
  fila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LINEA },
  filaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, paddingHorizontal: 8, backgroundColor: FONDO, fontWeight: 700 },
  monto: { width: 110, textAlign: "right" },
  notasTitulo: { fontWeight: 700, color: MARINO, marginBottom: 3, fontSize: 8.5 },
  nota: { flexDirection: "row", marginBottom: 1.5 },
  vineta: { width: 10, color: VERDE },
  notaTexto: { flex: 1, fontSize: 7.8, color: "#2B3440", lineHeight: 1.35 },
  pie: { position: "absolute", bottom: 18, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: GRIS, borderTopWidth: 1, borderTopColor: LINEA, paddingTop: 5 },
});

interface Props {
  cotizacion: Cotizacion;
  lineas: CotizacionLinea[];
  config: Config;
}

/** Bloques en el orden de la spec §8.3. Un bloque sin líneas se omite completo. */
const BLOQUES: { categoria: CotizacionLinea["categoria"]; titulo: string; moneda: Moneda }[] = [
  { categoria: "internacional", titulo: "FLETE INTERNACIONAL", moneda: "USD" },
  { categoria: "local", titulo: "GASTOS LOCALES", moneda: "GTQ" },
  { categoria: "naviera", titulo: "GASTOS EN NAVIERA", moneda: "USD" },
];

const num = (v: number | null) => (v == null ? null : Number(v).toLocaleString("en-US", { maximumFractionDigits: 3 }));

export function DocumentoCotizacion({ cotizacion: c, lineas, config }: Props) {
  const { empresa, textos_legales } = config;
  const vence = fechaVencimiento(c.fecha, c.dias_vigencia);

  const datosIzq: [string, string | null][] = [
    ["Fecha", formatoFecha(c.fecha)],
    ["Consignatario", c.cliente_nombre],
    ["Contacto", c.contacto],
    ["Carga", c.tipo_carga],
    ["Kilogramos", num(c.kilogramos)],
    ["Kg volumétricos", num(c.kg_volumetricos)],
    ["CBM", num(c.cbm)],
  ];
  const datosDer: [string, string | null][] = [
    ["Medidas", c.medidas],
    ["Bultos", num(c.bultos)],
    ["Mercadería", c.mercaderia],
    ["Origen", c.origen],
    ["Destino", c.destino],
    ["Tránsito", c.transito],
    ["Routing", c.routing],
  ];

  return (
    <Document title={`Cotización ${c.numero}`} author={empresa.razon_social} language="es-GT">
      <Page size="LETTER" style={s.pagina}>
        {/* Encabezado fijo: se repite en cada página */}
        <View style={s.encabezado} fixed>
          <View>
            {empresa.logo_url ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={empresa.logo_url} style={s.logo} />
            ) : (
              <View>
                <Text style={s.logoTexto}>{empresa.nombre_comercial}</Text>
                <Text style={s.eslogan}>{empresa.eslogan}</Text>
              </View>
            )}
          </View>
          <View style={s.empresa}>
            <Text style={[s.empresaLinea, { fontWeight: 600, color: MARINO }]}>{empresa.razon_social}</Text>
            <Text style={s.empresaLinea}>{empresa.direccion}</Text>
            <Text style={s.empresaLinea}>{empresa.ciudad}</Text>
            <Text style={s.empresaLinea}>NIT {empresa.nit} · PBX {empresa.pbx}</Text>
            <Text style={s.empresaLinea}>{empresa.web} · {empresa.correo}</Text>
          </View>
        </View>

        <View style={s.titulo}>
          <Text style={s.tituloTexto}>COTIZACIÓN</Text>
          <Text style={s.numero}>No. {c.numero}</Text>
        </View>

        <View style={s.datos}>
          <View style={[s.columna, { borderRightWidth: 1, borderRightColor: LINEA }]}>
            {datosIzq.map(([k, v]) => (
              <View key={k} style={s.dato}>
                <Text style={s.datoEtiqueta}>{k}</Text>
                <Text style={s.datoValor}>{v || "—"}</Text>
              </View>
            ))}
          </View>
          <View style={s.columna}>
            {datosDer.map(([k, v]) => (
              <View key={k} style={s.dato}>
                <Text style={s.datoEtiqueta}>{k}</Text>
                <Text style={s.datoValor}>{v || "—"}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={s.vigencia}>Válido al {formatoFecha(vence)}</Text>

        {BLOQUES.map((b) => {
          const propias = lineas.filter((l) => l.categoria === b.categoria);
          if (propias.length === 0) return null;
          const total = redondear(propias.reduce((acc, l) => acc + Number(l.venta_total), 0));
          return (
            <View key={b.categoria} style={s.seccion} wrap={false}>
              <View style={s.seccionCabecera}>
                <Text style={s.seccionTitulo}>{b.titulo}</Text>
                <Text style={[s.seccionTitulo, s.monto]}>Monto ({b.moneda === "USD" ? "USD" : "Q"})</Text>
              </View>
              {propias.map((l) => (
                <View key={l.id} style={s.fila}>
                  <Text>{l.nombre}{Number(l.cantidad) !== 1 ? `  (${num(l.cantidad)})` : ""}</Text>
                  <Text style={s.monto}>{formatoMoneda(Number(l.venta_total), b.moneda)}</Text>
                </View>
              ))}
              <View style={s.filaTotal}>
                <Text>TOTAL</Text>
                <Text style={s.monto}>{formatoMoneda(total, b.moneda)}</Text>
              </View>
            </View>
          );
        })}

        <View style={{ flexDirection: "row", gap: 16 }} wrap={false}>
          <View style={{ flex: 3 }}>
            <Text style={s.notasTitulo}>Notas</Text>
            {textos_legales.notas.map((n, i) => (
              <View key={i} style={s.nota}>
                <Text style={s.vineta}>•</Text>
                <Text style={s.notaTexto}>{n}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 2 }}>
            <Text style={s.notasTitulo}>Corre por cuenta del cliente lo siguiente:</Text>
            {textos_legales.cuenta_cliente.map((n, i) => (
              <View key={i} style={s.nota}>
                <Text style={s.vineta}>•</Text>
                <Text style={s.notaTexto}>{n}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.pie} fixed>
          <Text>{empresa.nombre_comercial} — {empresa.eslogan}</Text>
          <Text render={({ pageNumber, totalPages }) => `Cotización ${c.numero} · Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
