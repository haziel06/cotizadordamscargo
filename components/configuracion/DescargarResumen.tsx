import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props { userId: string; titulo: string; descripcion: string }

/** Enlaces de descarga (GET simple, sin JS) al resumen de un usuario: PDF o CSV/Excel. */
export function DescargarResumen({ userId, titulo, descripcion }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" nativeButton={false} render={<a href={`/api/usuarios/${userId}/resumen?formato=pdf`} />}>
          <FileText /> Descargar PDF
        </Button>
        <Button variant="outline" nativeButton={false} render={<a href={`/api/usuarios/${userId}/resumen?formato=csv`} />}>
          <FileSpreadsheet /> Descargar Excel/CSV
        </Button>
      </CardContent>
    </Card>
  );
}

/** Versión compacta (solo íconos) para usar dentro de una fila de tabla. */
export function DescargarResumenCompacto({ userId }: { userId: string }) {
  return (
    <span className="inline-flex gap-1">
      <Button size="icon-sm" variant="ghost" nativeButton={false} render={<a href={`/api/usuarios/${userId}/resumen?formato=pdf`} title="Descargar PDF" />}>
        <FileText className="size-3.5" />
      </Button>
      <Button size="icon-sm" variant="ghost" nativeButton={false} render={<a href={`/api/usuarios/${userId}/resumen?formato=csv`} title="Descargar Excel/CSV" />}>
        <FileSpreadsheet className="size-3.5" />
      </Button>
    </span>
  );
}
