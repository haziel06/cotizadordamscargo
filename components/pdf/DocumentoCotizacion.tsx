import { Defs, Document, Font, Image, LinearGradient, Page, Rect, Stop, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { Config, Perfil, TextosLegales } from "@/lib/config";
import type { Cotizacion, CotizacionLinea } from "@/lib/supabase/tipos";
import { fechaVencimiento, formatoFecha, formatoMoneda } from "@/lib/calculo/formato";
import { redondear } from "@/lib/calculo/linea";
import type { Moneda } from "@/lib/calculo/tipos";
import { segmentar } from "@/lib/calculo/formato-texto";

/*
 * PDF para el cliente (spec §8). REGLA CRÍTICA: aquí solo entran precios de venta.
 * Este componente no recibe ni costo_unitario, ni valor_margen, ni utilidad, ni descuentos.
 * Usa `venta_total` congelado en cada línea, que ya trae el descuento repartido.
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
  Font.registerHyphenationCallback((w) => [w]);
}

const ALTO_BANDA = 92;

const s = StyleSheet.create({
  pagina: { fontFamily: "Inter", fontSize: 9, color: "#1B2430", paddingTop: ALTO_BANDA + 10, paddingBottom: 34, paddingHorizontal: 40 },
  // Banda de encabezado: foto + degradado blanco encima. Solo decoración.
  banda: { position: "absolute", top: 0, left: 0, right: 0, height: ALTO_BANDA },
  bandaFoto: { position: "absolute", top: 0, left: 0, width: 612, height: ALTO_BANDA, objectFit: "cover" },
  bandaContenido: { position: "absolute", top: 11, left: 40, right: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tarjetaLogo: { backgroundColor: "#FFFFFF", borderRadius: 4, paddingVertical: 6, paddingHorizontal: 12, opacity: 0.96 },
  logo: { height: 48, objectFit: "contain", objectPositionX: 0 },
  logoTexto: { fontSize: 19, fontWeight: 700, color: MARINO },
  eslogan: { fontSize: 8.5, color: VERDE, fontWeight: 600 },
  empresa: { alignItems: "flex-end", backgroundColor: "#FFFFFF", borderRadius: 4, paddingVertical: 5, paddingHorizontal: 12, opacity: 0.94 },
  empresaLinea: { fontSize: 7.3, color: GRIS, lineHeight: 1.4 },
  bandaBorde: { position: "absolute", top: ALTO_BANDA - 3, left: 0, right: 0, height: 3, backgroundColor: MARINO },

  titulo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },
  tituloTexto: { fontSize: 14, fontWeight: 700, color: MARINO, letterSpacing: 0.8 },
  tituloSub: { fontSize: 9, color: GRIS, marginTop: 2 },
  numero: { fontSize: 11, fontWeight: 700, color: MARINO },

  datos: { flexDirection: "row", borderWidth: 1, borderColor: LINEA, borderRadius: 3, marginBottom: 8 },
  columna: { flex: 1 },
  dato: { flexDirection: "row", paddingVertical: 2.4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LINEA },
  datoEtiqueta: { width: 82, color: GRIS, fontWeight: 600, fontSize: 8 },
  datoValor: { flex: 1, fontSize: 8.5 },
  vigencia: { textAlign: "center", fontWeight: 600, color: MARINO, backgroundColor: FONDO, paddingVertical: 3.5, marginBottom: 8, borderRadius: 3 },

  seccion: { marginBottom: 8 },
  seccionCabecera: { flexDirection: "row", justifyContent: "space-between", backgroundColor: MARINO, color: "#FFFFFF", paddingVertical: 5, paddingHorizontal: 8, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  seccionTitulo: { fontWeight: 700, fontSize: 9, letterSpacing: 0.6 },
  fila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LINEA },
  filaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 8, backgroundColor: FONDO, fontWeight: 700 },
  monto: { width: 110, textAlign: "right" },

  notasTitulo: { fontWeight: 700, color: MARINO, marginBottom: 3, fontSize: 8.5 },
  nota: { flexDirection: "row", marginBottom: 0.6 },
  vineta: { width: 10, color: VERDE },
  notaTexto: { flex: 1, fontSize: 7.3, color: "#2B3440", lineHeight: 1.25 },
  resaltado: { backgroundColor: "#FFF176" },
  lineaNota: { fontSize: 7, color: GRIS, marginTop: 1 },

  cierre: { marginTop: 14, gap: 10 },
  firma: { fontSize: 8.2, lineHeight: 1.4 },
  firmaNombre: { fontWeight: 700, color: MARINO, fontSize: 9 },
  sello: { width: 150, borderWidth: 1.6, borderColor: MARINO, borderRadius: 3, paddingVertical: 5, paddingHorizontal: 8, transform: "rotate(-4deg)", opacity: 0.85 },
  selloTexto: { color: MARINO, fontSize: 6.6, textAlign: "center", lineHeight: 1.35 },
  selloTitulo: { color: MARINO, fontSize: 7.8, fontWeight: 700, textAlign: "center", letterSpacing: 0.5, marginBottom: 1 },
  selloImagen: { height: 60, width: 150, objectFit: "contain", transform: "rotate(-4deg)" },

  pie: { position: "absolute", bottom: 0, left: 0, right: 0, height: 26, backgroundColor: MARINO, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 40 },
  pieTexto: { fontSize: 7, color: "#FFFFFF", opacity: 0.9 },
});

interface Props {
  cotizacion: Cotizacion;
  lineas: CotizacionLinea[];
  config: Config;
  perfil: Perfil;
  /** Bytes de la foto de la banda (JPG). Si falta, la banda es lisa. */
  fondo?: Buffer;
}

/** Bloques en el orden de la spec §8.3. Un bloque sin líneas se omite completo. */
const BLOQUES: { categoria: CotizacionLinea["categoria"]; titulo: string; moneda: Moneda }[] = [
  { categoria: "internacional", titulo: "FLETE INTERNACIONAL", moneda: "USD" },
  { categoria: "local", titulo: "GASTOS LOCALES", moneda: "GTQ" },
  { categoria: "naviera", titulo: "GASTOS EN NAVIERA", moneda: "USD" },
];

/** Nota con marcas ligeras → runs con negrita / subrayado / resaltado. */
function TextoConFormato({ texto }: { texto: string }) {
  return (
    <Text style={s.notaTexto}>
      {segmentar(texto).map((seg, i) => (
        <Text
          key={i}
          style={[
            seg.negrita ? { fontWeight: 700 } : {},
            seg.subrayado ? { textDecoration: "underline" } : {},
            seg.resaltado ? s.resaltado : {},
          ]}
        >
          {seg.texto}
        </Text>
      ))}
    </Text>
  );
}

const num = (v: number | null) => (v == null ? null : Number(v).toLocaleString("en-US", { maximumFractionDigits: 3 }));

export function DocumentoCotizacion({ cotizacion: c, lineas, config, perfil, fondo }: Props) {
  const { empresa } = config;
  const textos: TextosLegales = (c.notas as TextosLegales | null) ?? config.textos_legales;
  const vence = fechaVencimiento(c.fecha, c.dias_vigencia);
  const hayFirma = Boolean(perfil.nombre || perfil.correo || perfil.telefono);

  const datosIzq: [string, string | null][] = [
    ["Fecha", formatoFecha(c.fecha)],
    ["Consignatario", c.cliente_nombre],
    ["Contacto", c.contacto],
    ["Carga", c.tipo_carga],
    ["Kilogramos", num(c.kilogramos)],
    ["Kg volumétricos", num(c.kg_volumetricos)],
    ["CBM", num(c.cbm)],
    ["Bultos", num(c.bultos)],
  ];
  const datosDer: [string, string | null][] = [
    ["Medidas", c.medidas],
    ["Mercadería", c.mercaderia],
    ["Origen", c.origen],
    ["Destino", c.destino],
    ["Incoterm", c.incoterm],
    ["Tránsito", c.transito],
    ["Routing", c.routing],
  ];

  return (
    <Document title={`Cotización ${c.numero}`} author={empresa.razon_social} language="es-GT">
      <Page size="LETTER" style={s.pagina}>
        {/* Banda de encabezado fija: se repite en cada página */}
        <View style={s.banda} fixed>
          {fondo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={{ data: fondo, format: "jpg" }} style={s.bandaFoto} />
          ) : (
            <View style={[s.bandaFoto, { backgroundColor: FONDO }]} />
          )}
          {/* Degradado blanco sobre la foto para que nunca compita con el texto */}
          <Svg width={612} height={ALTO_BANDA} style={{ position: "absolute", top: 0, left: 0 }}>
            <Defs>
              <LinearGradient id="velo" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.25} />
                <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.97} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={612} height={ALTO_BANDA} fill="url('#velo')" />
          </Svg>
          <View style={s.bandaContenido}>
            <View style={s.tarjetaLogo}>
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
              <Text style={[s.empresaLinea, { fontWeight: 700, color: MARINO, fontSize: 8 }]}>{empresa.razon_social}</Text>
              <Text style={s.empresaLinea}>{empresa.direccion}</Text>
              <Text style={s.empresaLinea}>{empresa.ciudad}</Text>
              <Text style={s.empresaLinea}>NIT {empresa.nit} · PBX {empresa.pbx}</Text>
              <Text style={s.empresaLinea}>{empresa.web} · {empresa.correo}</Text>
            </View>
          </View>
          <View style={s.bandaBorde} />
        </View>

        <View style={s.titulo}>
          <View>
            <Text style={s.tituloTexto}>COTIZACIÓN</Text>
            <Text style={s.tituloSub}>{c.cliente_nombre}{c.origen ? ` · ${c.origen}` : ""}</Text>
          </View>
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
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text>{l.nombre}{Number(l.cantidad) !== 1 ? `  (${num(l.cantidad)})` : ""}</Text>
                    {l.nota && l.nota_visible ? <Text style={s.lineaNota}>{l.nota}</Text> : null}
                  </View>
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

        <View>
          <Text style={s.notasTitulo} minPresenceAhead={30}>Notas</Text>
          {textos.notas.map((n, i) => (
            <View key={i} style={s.nota} wrap={false}>
              <Text style={s.vineta}>•</Text>
              <TextoConFormato texto={n} />
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 18, marginTop: 6 }} wrap={false}>
          <View style={{ flex: 6 }}>
            <Text style={s.notasTitulo}>Corre por cuenta del cliente lo siguiente:</Text>
            {textos.cuenta_cliente.map((n, i) => (
              <View key={i} style={s.nota}>
                <Text style={s.vineta}>•</Text>
                <TextoConFormato texto={n} />
              </View>
            ))}
          </View>
          {/* Firma de quien cotiza + sello de la empresa */}
          <View style={{ flex: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
            <View style={s.firma}>
              {hayFirma ? (
                <>
                  <Text style={s.firmaNombre}>{perfil.nombre || empresa.nombre_comercial}</Text>
                  {perfil.cargo ? <Text>{perfil.cargo}</Text> : null}
                  {perfil.correo ? <Text style={{ color: GRIS }}>{perfil.correo}</Text> : null}
                  {perfil.telefono ? <Text style={{ color: GRIS }}>{perfil.telefono}</Text> : null}
                </>
              ) : (
                <>
                  <Text style={s.firmaNombre}>{empresa.nombre_comercial}</Text>
                  <Text style={{ color: GRIS }}>{empresa.correo}</Text>
                  <Text style={{ color: GRIS }}>PBX {empresa.pbx}</Text>
                </>
              )}
            </View>
            {empresa.sello_url ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={empresa.sello_url} style={s.selloImagen} />
            ) : (
              <View style={s.sello}>
                <Text style={s.selloTitulo}>{empresa.razon_social.toUpperCase()}</Text>
                <Text style={s.selloTexto}>{empresa.direccion}</Text>
                <Text style={s.selloTexto}>PBX: {empresa.pbx}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.pie} fixed>
          <Text style={s.pieTexto}>{empresa.nombre_comercial} — {empresa.eslogan} · {empresa.web}</Text>
          <Text style={s.pieTexto} render={({ pageNumber, totalPages }) => `Cotización ${c.numero} · Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
