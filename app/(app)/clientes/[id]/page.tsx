import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminRequerido } from "@/lib/sesion";
import { obtenerCliente } from "@/lib/clientes/consultas";
import { datosEditor } from "@/lib/cotizaciones/consultas";
import { DialogoCliente } from "@/components/clientes/DialogoCliente";
import { TarifasEspeciales } from "@/components/clientes/TarifasEspeciales";
import { Button } from "@/components/ui/button";

export default async function PaginaCliente(props: { params: Promise<{ id: string }> }) {
  await adminRequerido();
  const { id } = await props.params;
  const [datos, { conceptos }] = await Promise.all([obtenerCliente(id), datosEditor()]);
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
    </div>
  );
}
