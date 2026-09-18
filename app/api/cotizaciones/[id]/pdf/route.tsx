import path from "node:path";
import { readFile } from "node:fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { leerConfig, leerPerfil } from "@/lib/config";
import { obtenerCotizacion } from "@/lib/cotizaciones/consultas";
import { DocumentoCotizacion, registrarFuentes } from "@/components/pdf/DocumentoCotizacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nombre de archivo: Cotizacion_[Cliente]_[Numero]_[Fecha].pdf (spec §8.4). */
function nombreArchivo(cliente: string, numero: string, fechaIso: string) {
  const limpio = cliente
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const [a, m, d] = fechaIso.slice(0, 10).split("-");
  return `Cotizacion_${limpio || "Cliente"}_${numero}_${d}${m}${a}.pdf`;
}

let fuentesListas = false;

export async function GET(_req: Request, ctx: RouteContext<"/api/cotizaciones/[id]/pdf">) {
  const supabase = await crearClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("No autorizado", { status: 401 });

  const { id } = await ctx.params;
  const [datos, config] = await Promise.all([obtenerCotizacion(id), leerConfig()]);
  if (!datos) return new NextResponse("No encontrada", { status: 404 });
  // Firma: la de quien creó la cotización; si no tiene perfil, la del usuario actual.
  const perfilCreador = await leerPerfil(datos.cotizacion.creado_por);
  const perfil = perfilCreador.nombre || perfilCreador.correo ? perfilCreador : await leerPerfil(auth.user.id);

  if (!fuentesListas) {
    registrarFuentes(path.join(process.cwd(), "public", "fonts"));
    fuentesListas = true;
  }

  const fondo = await readFile(path.join(process.cwd(), "public", "pdf", "fondo-encabezado.jpg")).catch(() => undefined);

  const buffer = await renderToBuffer(
    <DocumentoCotizacion
      cotizacion={datos.cotizacion}
      lineas={datos.lineas}
      config={config}
      perfil={perfil}
      fondo={fondo}
    />,
  );

  const nombre = nombreArchivo(datos.cotizacion.cliente_nombre, datos.cotizacion.numero, datos.cotizacion.fecha);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
