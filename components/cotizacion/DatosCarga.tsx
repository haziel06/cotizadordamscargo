"use client";
import { useState } from "react";
import { Campo, Entrada, Selector } from "@/components/Campos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INCOTERMS, type DefServicio } from "@/lib/etiquetas";
import type { CabeceraForm } from "@/lib/cotizaciones/esquema";
import type { Cliente } from "@/lib/supabase/tipos";
import type { GanadorPeso } from "@/lib/calculo/peso";
import { cn } from "@/lib/utils";

interface Props {
  cabecera: CabeceraForm;
  onChange: (c: Partial<CabeceraForm>) => void;
  clientes: Cliente[];
  peso: { peso: number; gano: GanadorPeso };
  servicio: DefServicio;
}

const LB_POR_KG = 2.20462;

export function DatosCarga({ cabecera: c, onChange, clientes, peso, servicio }: Props) {
  const muestra = (campo: DefServicio["campos"][number]) => servicio.campos.includes(campo);
  const kg = Number(c.kilogramos) || 0;
  const [sugerencias, setSugerencias] = useState<Cliente[]>([]);

  const buscarCliente = (texto: string) => {
    onChange({ cliente_nombre: texto, cliente_id: null });
    const q = texto.trim().toLowerCase();
    setSugerencias(q.length >= 2 ? clientes.filter((k) => k.nombre.toLowerCase().includes(q)).slice(0, 6) : []);
  };
  const elegirCliente = (k: Cliente) => {
    onChange({ cliente_nombre: k.nombre, cliente_id: k.id, contacto: c.contacto || k.contacto_nombre || "" });
    setSugerencias([]);
  };

  const tc = Number(c.tipo_cambio);
  const tcFuera = !(tc >= 7.5 && tc <= 8.5);
  const textoPeso =
    peso.gano === "real" ? "Se cobra el peso real" : peso.gano === "volumetrico" ? "Se cobra el peso volumétrico" : "Peso real y volumétrico iguales";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cliente y carga</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-12">
        <Campo etiqueta="Cliente (consignatario)" className="relative md:col-span-5">
          <Entrada
            value={c.cliente_nombre}
            onChange={(e) => buscarCliente(e.target.value)}
            onBlur={() => setTimeout(() => setSugerencias([]), 150)}
            placeholder="Nombre de la empresa"
            autoComplete="off"
          />
          {sugerencias.length > 0 && (
            <ul className="absolute top-full z-20 mt-1 w-full rounded border bg-white shadow-md">
              {sugerencias.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => elegirCliente(k)}
                  >
                    {k.nombre}
                    {k.contacto_nombre && <span className="ml-2 text-xs text-muted-foreground">{k.contacto_nombre}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {c.cliente_id && <span className="text-xs text-verde">Cliente registrado</span>}
        </Campo>
        <Campo etiqueta="Contacto" className="md:col-span-3">
          <Entrada value={c.contacto ?? ""} onChange={(e) => onChange({ contacto: e.target.value })} />
        </Campo>
        <Campo etiqueta="Fecha" className="md:col-span-2">
          <Entrada type="date" value={c.fecha} onChange={(e) => onChange({ fecha: e.target.value })} />
        </Campo>
        <Campo etiqueta="Vigencia (días)" className="md:col-span-2">
          <Entrada type="number" min={1} value={c.dias_vigencia} onChange={(e) => onChange({ dias_vigencia: e.target.value })} />
        </Campo>

        <div className={cn("rounded-lg border-2 p-3 md:col-span-3 md:row-span-2", tcFuera ? "border-ambar bg-ambar/10" : "border-primary/30 bg-primary/5")}>
          <div className="text-xs font-medium text-muted-foreground">Tipo de cambio (Q por USD)</div>
          <Entrada
            type="number"
            step="0.01"
            min={0}
            value={c.tipo_cambio}
            onChange={(e) => onChange({ tipo_cambio: e.target.value })}
            className="mt-1 h-12 text-2xl font-semibold"
          />
          {tcFuera && <div className="mt-1 text-xs text-amber-800">Verifica el tipo de cambio</div>}
        </div>
        <Campo etiqueta="Tipo de carga" className="md:col-span-3">
          <Selector value={c.tipo_carga ?? ""} onChange={(e) => onChange({ tipo_carga: e.target.value })}>
            <option value="">—</option>
            {servicio.tiposCarga.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            {c.tipo_carga && !servicio.tiposCarga.includes(c.tipo_carga) && <option value={c.tipo_carga}>{c.tipo_carga}</option>}
          </Selector>
        </Campo>
        <Campo etiqueta="Incoterm" className="md:col-span-3">
          <Selector value={c.incoterm ?? ""} onChange={(e) => onChange({ incoterm: e.target.value })}>
            <option value="">—</option>
            {INCOTERMS.map((i) => (
              <option key={i.valor} value={i.valor}>{i.texto}</option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Origen" className="md:col-span-3">
          <Entrada value={c.origen ?? ""} onChange={(e) => onChange({ origen: e.target.value })} placeholder="Xiamen, China" />
        </Campo>
        <Campo etiqueta="Destino" className="md:col-span-3">
          <Entrada value={c.destino ?? "Guatemala"} onChange={(e) => onChange({ destino: e.target.value })} />
        </Campo>
        <Campo etiqueta="Tránsito" className="md:col-span-3">
          <Entrada value={c.transito ?? ""} onChange={(e) => onChange({ transito: e.target.value })} placeholder="35 – 45 días" />
        </Campo>
        <Campo etiqueta="Routing" className="md:col-span-6">
          <Entrada value={c.routing ?? ""} onChange={(e) => onChange({ routing: e.target.value })} placeholder="Vía Hong Kong – Puerto Quetzal" />
        </Campo>

        {muestra("bultos") && (
          <Campo etiqueta="Bultos" className="md:col-span-2">
            <Entrada type="number" min={0} value={c.bultos ?? ""} onChange={(e) => onChange({ bultos: e.target.value })} />
          </Campo>
        )}
        {muestra("kg") && (
          <Campo etiqueta="Kilogramos" className="md:col-span-2">
            <Entrada type="number" step="0.01" min={0} value={c.kilogramos ?? ""} onChange={(e) => onChange({ kilogramos: e.target.value })} />
          </Campo>
        )}
        {muestra("libras") && (
          <Campo etiqueta="Libras" className="md:col-span-2">
            <Entrada type="number" step="0.01" min={0} value={kg ? Math.round(kg * LB_POR_KG * 100) / 100 : ""}
              onChange={(e) => onChange({ kilogramos: e.target.value === "" ? "" : Math.round((Number(e.target.value) / LB_POR_KG) * 100) / 100 })} />
          </Campo>
        )}
        {muestra("kg_volumetricos") && (
          <Campo etiqueta="Kg volumétricos" className="md:col-span-2">
            <Entrada type="number" step="0.01" min={0} value={c.kg_volumetricos ?? ""} onChange={(e) => onChange({ kg_volumetricos: e.target.value })} />
          </Campo>
        )}
        {muestra("cbm") && (
          <Campo etiqueta="CBM" className="md:col-span-2">
            <Entrada type="number" step="0.001" min={0} value={c.cbm ?? ""} onChange={(e) => onChange({ cbm: e.target.value })} />
          </Campo>
        )}
        {muestra("medidas") && (
          <Campo etiqueta="Medidas" className="md:col-span-4">
            <Entrada value={c.medidas ?? ""} onChange={(e) => onChange({ medidas: e.target.value })} placeholder="120 × 80 × 100 cm" />
          </Campo>
        )}
        {peso.peso > 0 && (
          <div className="text-xs text-muted-foreground md:col-span-12">
            {textoPeso}: <strong className="num">{peso.peso.toLocaleString("en-US")} kg</strong>
            {muestra("libras") && <> · <strong className="num">{(peso.peso * LB_POR_KG).toLocaleString("en-US", { maximumFractionDigits: 1 })} lb</strong></>}
          </div>
        )}
        <Campo etiqueta="Mercadería" className="md:col-span-8">
          <Entrada value={c.mercaderia ?? ""} onChange={(e) => onChange({ mercaderia: e.target.value })} placeholder="Descripción de la carga" />
        </Campo>
        <Campo etiqueta="Notas internas (no salen en el PDF)" className="md:col-span-4">
          <Entrada value={c.notas_internas ?? ""} onChange={(e) => onChange({ notas_internas: e.target.value })} />
        </Campo>
      </CardContent>
    </Card>
  );
}
