import { sesionRequerida } from "@/lib/sesion";
import { ChatAsistente } from "@/components/asistente/ChatAsistente";

export default async function PaginaAsistente() {
  const sesion = await sesionRequerida();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Asistente</h1>
        <p className="text-sm text-muted-foreground">Pregunta por cotizaciones, clientes, tarifas o proveedores. Los datos vienen siempre del sistema, nunca inventados.</p>
      </div>
      <ChatAsistente esAdmin={sesion.esAdmin} />
    </div>
  );
}
