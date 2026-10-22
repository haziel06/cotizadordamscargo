import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminRequerido } from "@/lib/sesion";
import { cotizacionesDeCliente, obtenerCliente } from "@/lib/clientes/consultas";
import { formatoFecha, formatoMoneda } from "@/lib/calculo/formato";
import { datosEditor } from "@/lib/cotizaciones/consultas";
import { DialogoCliente } from "@/components/clientes/DialogoCliente";
import { TarifasEspeciales } from "@/components/clientes/TarifasEspeciales";
import { Button } from "@/components/ui/button";

export default async function PaginaCliente(props: { params: Promise<{ id: string }> }) {
  await adminRequerido();
  const { id } = await props.params;
  const [datos, { conceptos }, historial] = await Promise.all([obtenerCliente(id), datosEditor(), cotizacionesDeCliente(id, { limite: 50 })]);
  if (!datos) notFound();
  const { cliente, tarifas } = datos;

  return (
    <div className="space-y-4">
      <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{cliente.empresa || cliente.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {cliente.contacto_nombre ? `${cliente.contacto_nombre} · ` : ""}{cliente.contacto_telefono || cliente.contacto_email || "Sin datos de contacto"}
          </p>
        </div>
        <DialogoCliente cliente={cliente}>
          <Button variant="outline">Editar datos</Button>
        </DialogoCliente>
      </div>
      <TarifasEspeciales clienteId={cliente.id} clienteNombre={cliente.empresa || cliente.nombre} tarifas={tarifas} conceptos={conceptos} />
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 font-semibold text-primary">Historial de cotizaciones <span className="text-xs font-normal text-muted-foreground">({historial.length})</span></h2>
        {historial.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cotizaciones para este cliente. Aparecen aquí cuando se cotiza eligiéndolo como cliente guardado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="py-1 font-medium">Número</th><th className="py-1 font-medium">Fecha</th><th className="py-1 font-medium">Servicio</th><th className="py-1 font-medium">Estado</th><th className="py-1 text-right font-medium">Total</th></tr>
            </thead>
            <tbody className="divide-y">
              {historial.map((h) => (
                <tr key={h.id}>
                  <td className="py-1.5"><Link href={`/cotizaciones/${h.id}`} className="font-medium text-primary hover:underline">{h.numero}</Link></td>
                  <td className="py-1.5">{formatoFecha(h.fecha)}</td>
                  <td className="py-1.5">{h.tipo_servicio}</td>
                  <td className="py-1.5 capitalize">{h.estado}</td>
                  <td className="num py-1.5 text-right">{formatoMoneda(h.total_gtq, "GTQ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
