import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/sesion";
import { leerConfig, leerPerfil } from "@/lib/config";
import { resumenUsuario, resumenUsuarioACsv } from "@/lib/reportes/usuario";
import { ResumenUsuarioPDF } from "@/components/pdf/ResumenUsuarioPDF";
import { registrarFuentes } from "@/components/pdf/DocumentoCotizacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let fuentesListas = false;

/** Descarga el resumen de actividad de un usuario: cada quien el suyo, o cualquiera si eres admin. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return new NextResponse("No autorizado", { status: 401 });

  const { id } = await ctx.params;
  if (id !== sesion.userId && !sesion.esAdmin) return new NextResponse("No autorizado", { status: 403 });

  const formato = new URL(req.url).searchParams.get("formato") === "csv" ? "csv" : "pdf";
  // Un admin ve utilidad de cualquiera; un usuario normal nunca ve utilidad, ni la suya.
  const esAdminParaEsteReporte = sesion.esAdmin;

  const [perfil, resumen] = await Promise.all([leerPerfil(id), resumenUsuario(id)]);
  const nombreArchivo = (perfil.nombre || "usuario").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_");

  if (formato === "csv") {
    const csv = resumenUsuarioACsv(resumen, esAdminParaEsteReporte);
    return new NextResponse(`﻿${csv}`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="Resumen_${nombreArchivo}.csv"`, "Cache-Control": "no-store" },
    });
  }

  const config = await leerConfig();
  if (!fuentesListas) {
    registrarFuentes(path.join(process.cwd(), "public", "fonts"));
    fuentesListas = true;
  }
  const buffer = await renderToBuffer(
    <ResumenUsuarioPDF nombre={perfil.nombre || "Usuario"} correo={perfil.correo} resumen={resumen} empresa={config.empresa} esAdmin={esAdminParaEsteReporte} />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Resumen_${nombreArchivo}.pdf"`, "Cache-Control": "no-store" },
  });
}
