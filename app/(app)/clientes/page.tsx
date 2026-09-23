import { adminRequerido } from "@/lib/sesion";
import { listarClientes } from "@/lib/clientes/consultas";
import { ListaClientes } from "@/components/clientes/ListaClientes";

export default async function PaginaClientes() {
  await adminRequerido();
  const clientes = await listarClientes();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Clientes</h1>
        <p className="text-sm text-muted-foreground">Datos de contacto y tarifas especiales guardadas por cliente. Se aplican solas al cotizar para un cliente registrado.</p>
      </div>
      <ListaClientes clientes={clientes} />
    </div>
  );
}
