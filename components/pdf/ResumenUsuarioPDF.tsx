import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Config } from "@/lib/config";
import type { ResumenUsuario } from "@/lib/reportes/usuario";
import { formatoFecha, formatoFechaLarga, formatoMoneda } from "@/lib/calculo/formato";

const MARINO = "#1F3864";
const VERDE = "#2E7D4F";
const GRIS = "#5B6472";
const LINEA = "#D9DEE7";

const s = StyleSheet.create({
  pagina: { fontFamily: "Inter", fontSize: 9, color: "#1B2430", padding: 36 },
  titulo: { fontSize: 16, fontWeight: 700, color: MARINO },
  sub: { fontSize: 9, color: GRIS, marginTop: 2 },
  franja: { marginTop: 14, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: LINEA, paddingBottom: 8 },
  tarjetas: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tarjeta: { width: "31%", borderWidth: 1, borderColor: LINEA, borderRadius: 4, padding: 8 },
  tarjetaTitulo: { fontSize: 7.5, color: GRIS, textTransform: "uppercase" },
  tarjetaValor: { fontSize: 14, fontWeight: 700, color: MARINO, marginTop: 3 },
  seccionTitulo: { fontSize: 10.5, fontWeight: 700, color: MARINO, marginTop: 10, marginBottom: 6 },
  filaTabla: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINEA, paddingVertical: 3 },
  encabezadoTabla: { flexDirection: "row", borderBottomWidth: 1.2, borderBottomColor: MARINO, paddingBottom: 3, fontWeight: 700, color: MARINO, fontSize: 8 },
  pie: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: GRIS, textAlign: "center" },
});
const celda = (ancho: number) => ({ width: `${ancho}%`, fontSize: 8 }) as const;

/** Resumen descargable de actividad de un usuario. Nunca incluye utilidad/margen salvo `esAdmin`. */
export function ResumenUsuarioPDF({ nombre, correo, resumen, empresa, esAdmin }: {
  nombre: string; correo: string; resumen: ResumenUsuario; empresa: Config["empresa"]; esAdmin: boolean;
}) {
  const { metricas: m, filas } = resumen;
  return (
    <Document>
      <Page size="LETTER" style={s.pagina}>
        <View>
          <Text style={s.titulo}>{empresa.nombre_comercial} · Resumen de actividad</Text>
          <Text style={s.sub}>{nombre}{correo ? ` · ${correo}` : ""} — generado el {formatoFechaLarga(new Date().toISOString().slice(0, 10))}</Text>
        </View>

        <View style={s.franja} />

        <View style={s.tarjetas}>
          <View style={s.tarjeta}><Text style={s.tarjetaTitulo}>Total cotizaciones</Text><Text style={s.tarjetaValor}>{m.total}</Text></View>
          <View style={s.tarjeta}><Text style={s.tarjetaTitulo}>Tasa de aceptación</Text><Text style={s.tarjetaValor}>{m.tasa_aceptacion}%</Text></View>
          <View style={s.tarjeta}><Text style={s.tarjetaTitulo}>Cotizadas este mes</Text><Text style={s.tarjetaValor}>{m.mes.cotizadas}</Text></View>
          <View style={s.tarjeta}><Text style={s.tarjetaTitulo}>Monto cotizado (mes)</Text><Text style={s.tarjetaValor}>{formatoMoneda(m.mes.monto_gtq, "GTQ")}</Text></View>
          <View style={s.tarjeta}><Text style={s.tarjetaTitulo}>Aceptado (mes)</Text><Text style={s.tarjetaValor}>{formatoMoneda(m.mes.monto_aceptado_gtq, "GTQ")}</Text></View>
          {esAdmin ? (
            <View style={s.tarjeta}><Text style={s.tarjetaTitulo}>Utilidad (mes)</Text><Text style={s.tarjetaValor}>{formatoMoneda(m.mes.utilidad_gtq, "GTQ")}</Text></View>
          ) : (
            <View style={s.tarjeta}><Text style={s.tarjetaTitulo}>Aceptadas (mes)</Text><Text style={s.tarjetaValor}>{m.mes.aceptadas}</Text></View>
          )}
        </View>

        <Text style={s.seccionTitulo}>Por estado</Text>
        <View style={s.tarjetas}>
          {(["borrador", "enviada", "aceptada", "rechazada", "vencida"] as const).map((e) => (
            <View key={e} style={{ ...s.tarjeta, width: "18%" }}>
              <Text style={s.tarjetaTitulo}>{e}</Text>
              <Text style={s.tarjetaValor}>{m.porEstado[e]}</Text>
            </View>
          ))}
        </View>

        <Text style={s.seccionTitulo}>Cotizaciones ({filas.length})</Text>
        <View style={s.encabezadoTabla}>
          <Text style={celda(14)}>Número</Text>
          <Text style={celda(30)}>Cliente</Text>
          <Text style={celda(14)}>Fecha</Text>
          <Text style={celda(14)}>Estado</Text>
          <Text style={celda(esAdmin ? 14 : 28)}>Monto</Text>
          {esAdmin && <Text style={celda(14)}>Utilidad</Text>}
        </View>
        {filas.slice(0, 60).map((f) => (
          <View key={f.id} style={s.filaTabla}>
            <Text style={celda(14)}>{f.numero}</Text>
            <Text style={celda(30)}>{f.cliente_nombre}</Text>
            <Text style={celda(14)}>{formatoFecha(f.fecha)}</Text>
            <Text style={celda(14)}>{f.estado_efectivo}</Text>
            <Text style={celda(esAdmin ? 14 : 28)}>{formatoMoneda(f.total_gtq, "GTQ")}</Text>
            {esAdmin && <Text style={{ ...celda(14), color: VERDE }}>{formatoMoneda(f.utilidad_gtq, "GTQ")}</Text>}
          </View>
        ))}
        {filas.length > 60 && <Text style={{ marginTop: 6, fontSize: 7.5, color: GRIS }}>Mostrando las primeras 60 de {filas.length}. El CSV trae todas.</Text>}

        <Text style={s.pie} fixed>{empresa.nombre_comercial} · Documento interno, no es una cotización ni un comprobante fiscal.</Text>
      </Page>
    </Document>
  );
}
