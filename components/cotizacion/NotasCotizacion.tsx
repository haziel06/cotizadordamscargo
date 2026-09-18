"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/Campos";
import type { TextosLegales } from "@/lib/config";

interface Props {
  /** null = se usan las de Configuración tal cual. */
  notas: TextosLegales | null;
  porDefecto: TextosLegales;
  onChange: (n: TextosLegales | null) => void;
}

const area = "min-h-32 w-full rounded border border-input bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-ring/30";
const aTexto = (xs: string[]) => xs.join("\n");
const aLista = (t: string) => t.split("\n");

export function NotasCotizacion({ notas, porDefecto, onChange }: Props) {
  const personalizadas = notas !== null;
  const valor = notas ?? porDefecto;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Notas del PDF</CardTitle>
            <CardDescription>
              {personalizadas
                ? "Notas personalizadas para esta cotización. Una viñeta por línea."
                : "Se usan las notas estándar de Configuración. Puedes ajustarlas solo para esta cotización."}
            </CardDescription>
          </div>
          {personalizadas ? (
            <Button variant="outline" size="sm" onClick={() => onChange(null)}>Volver a las estándar</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onChange({ notas: [...porDefecto.notas], cuenta_cliente: [...porDefecto.cuenta_cliente] })}>
              Personalizar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta="Notas">
          <textarea className={area} value={aTexto(valor.notas)} disabled={!personalizadas}
            onChange={(e) => onChange({ ...valor, notas: aLista(e.target.value) })} />
        </Campo>
        <Campo etiqueta="Corre por cuenta del cliente">
          <textarea className={area} value={aTexto(valor.cuenta_cliente)} disabled={!personalizadas}
            onChange={(e) => onChange({ ...valor, cuenta_cliente: aLista(e.target.value) })} />
        </Campo>
      </CardContent>
    </Card>
  );
}
