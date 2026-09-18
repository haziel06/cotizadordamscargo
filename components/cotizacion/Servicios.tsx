"use client";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Casilla, Entrada, Selector } from "@/components/Campos";
import { CATEGORIAS, TIPOS_MARGEN, textoUnidad } from "@/lib/etiquetas";
import { ventaLinea } from "@/lib/calculo/linea";
import { formatoMoneda } from "@/lib/calculo/formato";
import type { LineaEditable } from "@/lib/cotizaciones/esquema";
import type { Concepto } from "@/lib/supabase/tipos";
import type { Categoria, TipoMargen, Unidad } from "@/lib/calculo/tipos";

interface Props {
  lineas: LineaEditable[];
  conceptos: Concepto[];
  onChange: (fn: (ls: LineaEditable[]) => LineaEditable[]) => void;
  pesoCobrable: number;
  cbm: number;
  margenDefault: { tipo: TipoMargen; valor: number };
}

let contador = 0;
const clave = () => `l-${Date.now()}-${contador++}`;

export function Servicios({ lineas, conceptos, onChange, pesoCobrable, cbm, margenDefault }: Props) {
  /** Cantidad inicial según la unidad del concepto (spec §7.2-B). */
  const cantidadPara = (u: Unidad) => (u === "kg" ? pesoCobrable : u === "cbm" ? cbm : 1);

  const alternarConcepto = (c: Concepto, marcado: boolean) => {
    if (marcado) {
      onChange((ls) => [
        ...ls,
        {
          _clave: clave(),
          concepto_id: c.id,
          nombre: c.nombre,
          categoria: c.categoria,
          moneda: c.moneda,
          cantidad: cantidadPara(c.unidad),
          costo_unitario: Number(c.costo),
          tipo_margen: c.tipo_margen,
          valor_margen: Number(c.valor_margen),
          lleva_iva: c.aplica_iva,
        },
      ]);
    } else {
      onChange((ls) => ls.filter((l) => l.concepto_id !== c.id));
    }
  };

  const agregarManual = (categoria: Categoria) =>
    onChange((ls) => [
      ...ls,
      {
        _clave: clave(),
        concepto_id: null,
        nombre: "",
        categoria,
        moneda: CATEGORIAS.find((k) => k.valor === categoria)!.moneda,
        cantidad: 1,
        costo_unitario: 0,
        tipo_margen: margenDefault.tipo,
        valor_margen: margenDefault.valor,
        lleva_iva: true,
      },
    ]);

  const editar = (k: string, cambios: Partial<LineaEditable>) =>
    onChange((ls) => ls.map((l) => (l._clave === k ? { ...l, ...cambios } : l)));
  const quitar = (k: string) => onChange((ls) => ls.filter((l) => l._clave !== k));
  const mover = (k: string, dir: -1 | 1) =>
    onChange((ls) => {
      const i = ls.findIndex((l) => l._clave === k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length || ls[j].categoria !== ls[i].categoria) return ls;
      const copia = [...ls];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  const marcados = new Set(lineas.map((l) => l.concepto_id).filter(Boolean));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Servicios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {CATEGORIAS.map((cat) => {
          const disponibles = conceptos.filter((c) => c.categoria === cat.valor && c.activo);
          const propias = lineas.filter((l) => l.categoria === cat.valor);
          return (
            <section key={cat.valor} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-primary">
                  {cat.texto} <span className="text-xs font-normal text-muted-foreground">({cat.moneda})</span>
                </h3>
                <Button variant="outline" size="sm" onClick={() => agregarManual(cat.valor)}>
                  <Plus /> Línea manual
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {disponibles.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <Casilla checked={marcados.has(c.id)} onChange={(e) => alternarConcepto(c, e.target.checked)} />
                    {c.nombre}
                    {c.unidad !== "envio" && <span className="text-xs text-muted-foreground">({textoUnidad(c.unidad)})</span>}
                  </label>
                ))}
                {disponibles.length === 0 && <span className="text-xs text-muted-foreground">Sin conceptos activos en esta categoría.</span>}
              </div>

              {propias.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Descripción</th>
                      <th className="py-1 pr-2 text-right font-medium">Cant.</th>
                      <th className="py-1 pr-2 text-right font-medium">Costo unit.</th>
                      <th className="py-1 pr-2 font-medium">Margen</th>
                      <th className="py-1 pr-2 text-right font-medium">Valor</th>
                      <th className="py-1 pr-2 text-center font-medium" title="Lleva IVA">IVA</th>
                      <th className="py-1 pr-2 text-right font-medium">Venta</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {propias.map((l, idx) => {
                      const venta = ventaLinea(l);
                      const cero = l.tipo_margen === "porcentaje" && Number(l.costo_unitario) === 0;
                      return (
                        <tr key={l._clave}>
                          <td className="py-1 pr-2">
                            <Entrada
                              value={l.nombre}
                              placeholder="Descripción"
                              autoFocus={!l.concepto_id && !l.nombre}
                              onChange={(e) => editar(l._clave, { nombre: e.target.value })}
                              className="min-w-44"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Entrada type="number" step="0.001" min={0} value={l.cantidad}
                              onChange={(e) => editar(l._clave, { cantidad: Number(e.target.value) })} className="w-20" />
                          </td>
                          <td className="py-1 pr-2">
                            <Entrada type="number" step="0.01" min={0} value={l.costo_unitario}
                              onChange={(e) => editar(l._clave, { costo_unitario: Number(e.target.value) })}
                              className={cero ? "w-28 border-ambar" : "w-28"} />
                          </td>
                          <td className="py-1 pr-2">
                            <Selector value={l.tipo_margen} className="w-36"
                              onChange={(e) => editar(l._clave, { tipo_margen: e.target.value as TipoMargen })}>
                              {TIPOS_MARGEN.map((t) => <option key={t.valor} value={t.valor}>{t.corto}</option>)}
                            </Selector>
                          </td>
                          <td className="py-1 pr-2">
                            <Entrada type="number" step="0.01" min={0} value={l.valor_margen}
                              onChange={(e) => editar(l._clave, { valor_margen: Number(e.target.value) })} className="w-24" />
                          </td>
                          <td className="py-1 pr-2 text-center">
                            <Casilla checked={l.lleva_iva} onChange={(e) => editar(l._clave, { lleva_iva: e.target.checked })} />
                          </td>
                          <td className="num py-1 pr-2 text-right font-semibold whitespace-nowrap">{formatoMoneda(venta, l.moneda)}</td>
                          <td className="py-1 text-right whitespace-nowrap">
                            <Button variant="ghost" size="icon-xs" disabled={idx === 0} onClick={() => mover(l._clave, -1)} title="Subir"><ArrowUp /></Button>
                            <Button variant="ghost" size="icon-xs" disabled={idx === propias.length - 1} onClick={() => mover(l._clave, 1)} title="Bajar"><ArrowDown /></Button>
                            <Button variant="ghost" size="icon-xs" onClick={() => quitar(l._clave)} title="Quitar"><X /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
