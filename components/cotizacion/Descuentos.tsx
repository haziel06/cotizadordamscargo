"use client";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Entrada, Selector } from "@/components/Campos";
import { AMBITOS_DESCUENTO } from "@/lib/etiquetas";
import type { DescuentoForm } from "@/lib/cotizaciones/esquema";

interface Props {
  descuentos: DescuentoForm[];
  onChange: (d: DescuentoForm[]) => void;
}

let contador = 0;

export function Descuentos({ descuentos, onChange }: Props) {
  const editar = (k: string, cambios: Partial<DescuentoForm>) =>
    onChange(descuentos.map((d) => (d._clave === k ? { ...d, ...cambios } : d)));
  const agregar = () =>
    onChange([...descuentos, { _clave: `d-${Date.now()}-${contador++}`, ambito: "total", tipo: "porcentaje", valor: 0, moneda: "GTQ" }]);
  const quitar = (k: string) => onChange(descuentos.filter((d) => d._clave !== k));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Descuento</CardTitle>
            <CardDescription>
              Para clientes especiales. El cliente no ve una línea de descuento: ve los precios ya rebajados.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={agregar}>
            <Plus /> Agregar descuento
          </Button>
        </div>
      </CardHeader>
      {descuentos.length > 0 && (
        <CardContent className="space-y-2">
          {descuentos.map((d) => {
            const monedaBloque = d.ambito === "local" ? "GTQ" : d.ambito === "total" ? (d.moneda ?? "GTQ") : "USD";
            return (
              <div key={d._clave} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Aplicar a</span>
                <Selector value={d.ambito} className="w-44" onChange={(e) => editar(d._clave, { ambito: e.target.value as DescuentoForm["ambito"] })}>
                  {AMBITOS_DESCUENTO.map((a) => <option key={a.valor} value={a.valor}>{a.texto}</option>)}
                </Selector>
                <Selector value={d.tipo} className="w-32" onChange={(e) => editar(d._clave, { tipo: e.target.value as DescuentoForm["tipo"] })}>
                  <option value="porcentaje">Porcentaje</option>
                  <option value="monto">Monto fijo</option>
                </Selector>
                <Entrada type="number" step="0.01" min={0} value={d.valor} className="w-28"
                  onChange={(e) => editar(d._clave, { valor: Number(e.target.value) })} />
                {d.tipo === "porcentaje" ? (
                  <span className="text-muted-foreground">%</span>
                ) : d.ambito === "total" ? (
                  <Selector value={d.moneda ?? "GTQ"} className="w-20" onChange={(e) => editar(d._clave, { moneda: e.target.value as "USD" | "GTQ" })}>
                    <option value="GTQ">Q</option>
                    <option value="USD">USD</option>
                  </Selector>
                ) : (
                  <span className="text-muted-foreground">{monedaBloque === "USD" ? "USD" : "Q"}</span>
                )}
                <Button variant="ghost" size="icon-xs" onClick={() => quitar(d._clave)} title="Quitar"><X /></Button>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
