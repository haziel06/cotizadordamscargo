import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ResumenUsoIA } from "@/lib/ia/uso";

const NOMBRE_ERROR: Record<string, string> = {
  rate_limit: "Límite de uso alcanzado",
  timeout: "Tiempo de espera agotado",
  error_proveedor: "Error del proveedor",
  sin_configurar: "Falta la clave configurada",
};

/** Cómo ha estado funcionando el asistente/lector de IA en la práctica: solo para admin. */
export function UsoIA({ resumen }: { resumen: ResumenUsoIA }) {
  if (!resumen.total) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Uso de IA</CardTitle>
          <CardDescription>Todavía no hay actividad registrada del asistente ni del lector de documentos.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const tasaExito = Math.round((resumen.exitos / resumen.total) * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uso de IA</CardTitle>
        <CardDescription>Últimas {resumen.total} llamadas del asistente y del lector de documentos (preguntas, cotizaciones y tarifarios con IA).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs uppercase text-muted-foreground">Tasa de éxito</div>
            <div className={cn("num mt-1 text-2xl font-semibold", tasaExito >= 90 ? "text-verde" : tasaExito >= 70 ? "text-amber-700" : "text-destructive")}>{tasaExito}%</div>
          </div>
          {resumen.porProveedor.map((p) => (
            <div key={p.proveedor} className="rounded-lg border p-3">
              <div className="text-xs uppercase text-muted-foreground">{p.proveedor}</div>
              <div className="num mt-1 text-2xl font-semibold text-primary">{p.llamadas}</div>
              <div className="text-xs text-muted-foreground">{p.exitos} exitosas</div>
            </div>
          ))}
        </div>
        {resumen.ultimosErrores.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Últimos errores (ya con reintento automático)</div>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {resumen.ultimosErrores.map((e, i) => (
                <li key={i}>
                  {new Date(e.created_at).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })} · {e.proveedor} · {NOMBRE_ERROR[e.tipo_error ?? ""] ?? e.tipo_error ?? "—"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
