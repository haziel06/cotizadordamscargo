"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Campo, Casilla, Entrada, Selector } from "@/components/Campos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INCOTERMS, LIMITE_TICKET_USD, SEGMENTOS_COURIER, type CampoCarga, type DefServicio } from "@/lib/etiquetas";
import { SOBREPESO_KG } from "@/lib/calculo/tipos";
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
const aLb = (kg: number) => Math.round(kg * LB_POR_KG * 100) / 100;
const aKg = (lb: number) => Math.round((lb / LB_POR_KG) * 10000) / 10000;

export function DatosCarga({ cabecera: c, onChange, clientes, peso, servicio }: Props) {
  const muestra = (campo: CampoCarga) => servicio.campos.includes(campo);
  const kg = Number(c.kilogramos) || 0;
  const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
  const esCourier = c.tipos_servicio.includes("courier");

  // Las libras se escriben libremente y se convierten a kg al vuelo. Se guarda el texto tal cual
  // se teclea para que "1", "1." o "12" no reboten por el redondeo (antes 1 lb → 0.45 kg → 0.99 lb).
  const [libras, setLibras] = useState(() => (kg ? String(aLb(kg)) : ""));
  const [kgVisto, setKgVisto] = useState(kg);
  if (kg !== kgVisto) {
    // Cambió el kg desde otro lado (campo de kilogramos): sincroniza el texto de libras sin efecto.
    setKgVisto(kg);
    const desdeKg = kg ? aLb(kg) : 0;
    if (Math.abs(desdeKg - (Number(libras) || 0)) > 0.011) setLibras(kg ? String(desdeKg) : "");
  }
  const cambiarLibras = (texto: string) => {
    setLibras(texto);
    const lb = Number(texto);
    onChange({ kilogramos: texto.trim() === "" || Number.isNaN(lb) ? "" : aKg(lb) });
  };

  const buscarCliente = (texto: string) => {
    onChange({ cliente_nombre: texto, cliente_id: null });
    const q = texto.trim().toLowerCase();
    setSugerencias(q.length >= 2 ? clientes.filter((k) => `${k.nombre} ${k.empresa ?? ""} ${k.contacto_nombre ?? ""}`.toLowerCase().includes(q)).slice(0, 6) : []);
  };
  const elegirCliente = (k: Cliente) => {
    onChange({
      cliente_nombre: k.empresa || k.nombre,
      cliente_id: k.id,
      contacto: c.contacto || k.contacto_nombre || (k.empresa ? k.nombre : "") || "",
      cliente_telefono: c.cliente_telefono || k.contacto_telefono || "",
    });
    setSugerencias([]);
  };

  const tc = Number(c.tipo_cambio);
  const tcFuera = !(tc >= 7.5 && tc <= 8.5);
  const sobrepeso = kg > SOBREPESO_KG;
  const valorMerc = Number(c.valor_mercaderia) || 0;
  const textoPeso =
    peso.gano === "real" ? "Se cobra el peso real" : peso.gano === "volumetrico" ? "Se cobra el peso volumétrico" : "Peso real y volumétrico iguales";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cliente y carga</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-12">
        <Campo etiqueta={esCourier ? "Cliente (nombre de la persona o empresa)" : "Cliente / empresa que cotiza"} className="relative md:col-span-4">
          <Entrada
            value={c.cliente_nombre}
            onChange={(e) => buscarCliente(e.target.value)}
            onBlur={() => setTimeout(() => setSugerencias([]), 150)}
            placeholder={esCourier ? "Ej. María Pérez" : "Nombre de la empresa"}
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
                    {k.empresa || k.nombre}
                    {(k.contacto_nombre || (k.empresa && k.nombre)) && <span className="ml-2 text-xs text-muted-foreground">{k.contacto_nombre || k.nombre}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {c.cliente_id && <span className="text-xs text-verde">Cliente registrado</span>}
        </Campo>
        {esCourier ? (
          <Campo etiqueta="Empresa (opcional)" className="md:col-span-3">
            <Entrada value={c.consignatario ?? ""} onChange={(e) => onChange({ consignatario: e.target.value })} placeholder="Solo si pide a nombre de una empresa" autoComplete="off" />
          </Campo>
        ) : (
          <>
            {muestra("consignatario") && (
              <Campo etiqueta="Consignatario (quien recibe)" className="md:col-span-3">
                <Entrada value={c.consignatario ?? ""} onChange={(e) => onChange({ consignatario: e.target.value })} placeholder="Ej. Liling Huarui Ceramic Co." autoComplete="off" />
              </Campo>
            )}
            <Campo etiqueta="Contacto" className="md:col-span-2">
              <Entrada value={c.contacto ?? ""} onChange={(e) => onChange({ contacto: e.target.value })} placeholder="Lic. Hugo Gómez" autoComplete="off" />
            </Campo>
          </>
        )}
        <Campo etiqueta="Teléfono" className="md:col-span-2">
          <Entrada value={c.cliente_telefono ?? ""} onChange={(e) => onChange({ cliente_telefono: e.target.value })} placeholder="5555-5555" autoComplete="off" />
        </Campo>
        <Campo etiqueta="Fecha" className={esCourier ? "md:col-span-2" : "md:col-span-1"}>
          <Entrada type="date" value={c.fecha} onChange={(e) => onChange({ fecha: e.target.value })} />
        </Campo>
        <Campo etiqueta="Vigencia (días)" className="md:col-span-1">
          <Entrada type="number" min={1} value={c.dias_vigencia} onChange={(e) => onChange({ dias_vigencia: e.target.value })} />
        </Campo>

        {esCourier && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 md:col-span-12">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Segmento de courier</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {SEGMENTOS_COURIER.map((s) => {
                const on = c.segmento_courier === s.valor;
                return (
                  <button
                    key={s.valor}
                    type="button"
                    onClick={() => onChange({ segmento_courier: s.valor })}
                    className={cn("rounded-md border bg-white p-2.5 text-left transition-colors hover:border-primary", on && "border-primary ring-2 ring-primary/30")}
                  >
                    <div className={cn("text-sm font-semibold", on ? "text-primary" : "text-foreground")}>{s.texto}</div>
                    <div className="text-[11px] leading-snug text-muted-foreground">{s.descripcion}</div>
                  </button>
                );
              })}
            </div>
            {c.segmento_courier === "consolidado" && valorMerc > LIMITE_TICKET_USD && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-800">
                <AlertTriangle className="size-3.5" /> La mercadería supera ${LIMITE_TICKET_USD.toLocaleString("en-US")}: normalmente se cotiza como <strong>Ticket</strong>.
                <button type="button" className="underline" onClick={() => onChange({ segmento_courier: "ticket" })}>Cambiar a Ticket</button>
              </div>
            )}
          </div>
        )}

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
        {muestra("comercial") && (
          <>
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
          </>
        )}
        <Campo etiqueta="Origen" className="md:col-span-3">
          <Entrada value={c.origen ?? ""} onChange={(e) => onChange({ origen: e.target.value })} placeholder={esCourier ? "Miami, Estados Unidos" : "Xiamen, China"} />
        </Campo>
        <Campo etiqueta="Destino" className="md:col-span-3">
          <Entrada value={c.destino ?? "Guatemala"} onChange={(e) => onChange({ destino: e.target.value })} />
        </Campo>
        {muestra("comercial") && (
          <>
            <Campo etiqueta="Tránsito" className="md:col-span-3">
              <Entrada value={c.transito ?? ""} onChange={(e) => onChange({ transito: e.target.value })} placeholder="35 – 45 días" />
            </Campo>
            <Campo etiqueta="Routing" className="md:col-span-6">
              <Entrada value={c.routing ?? ""} onChange={(e) => onChange({ routing: e.target.value })} placeholder="Vía Hong Kong – Puerto Quetzal" />
            </Campo>
          </>
        )}
        {muestra("entrega") && (
          <div className={cn("rounded-lg border p-3 md:col-span-6", c.fuera_perimetro ? "border-ambar bg-ambar/10" : "border-verde/40 bg-verde/5")}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Campo etiqueta="Dirección de entrega">
                <Entrada value={c.direccion_entrega ?? ""} onChange={(e) => onChange({ direccion_entrega: e.target.value })} placeholder="Ej. 12 av. 3-45 zona 15, Guatemala" autoComplete="off" />
              </Campo>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Casilla checked={c.fuera_perimetro} onChange={(e) => onChange({ fuera_perimetro: e.target.checked })} /> Fuera del perímetro capitalino
              </label>
            </div>
            <p className={cn("mt-1 text-xs", c.fuera_perimetro ? "text-amber-900" : "text-verde")}>
              {c.fuera_perimetro
                ? "Se envía con expreso externo: el costo del transporte se cobra aparte según destino. El PDF lo indica al cliente."
                : "Dentro del perímetro capitalino la entrega va incluida en el precio por libra."}
            </p>
          </div>
        )}

        {muestra("bultos") && (
          <Campo etiqueta="Bultos" className="md:col-span-2">
            <Entrada type="number" min={0} value={c.bultos ?? ""} onChange={(e) => onChange({ bultos: e.target.value })} />
          </Campo>
        )}
        {muestra("libras") && (
          <Campo etiqueta="Libras" className="md:col-span-2">
            <Entrada type="number" step="any" min={0} inputMode="decimal" value={libras} onChange={(e) => cambiarLibras(e.target.value)} className="font-semibold" />
          </Campo>
        )}
        {muestra("kg") && (
          <Campo etiqueta="Kilogramos" className="md:col-span-2">
            <Entrada type="number" step="any" min={0} inputMode="decimal" value={c.kilogramos ?? ""} onChange={(e) => onChange({ kilogramos: e.target.value })}
              className={cn(sobrepeso && "border-red-400 bg-red-50")} />
          </Campo>
        )}
        {muestra("kg_volumetricos") && (
          <Campo etiqueta="Kg volumétricos" className="md:col-span-2">
            <Entrada type="number" step="any" min={0} value={c.kg_volumetricos ?? ""} onChange={(e) => onChange({ kg_volumetricos: e.target.value })} />
          </Campo>
        )}
        {muestra("cbm") && (
          <Campo etiqueta="CBM" className="md:col-span-2">
            <Entrada type="number" step="any" min={0} value={c.cbm ?? ""} onChange={(e) => onChange({ cbm: e.target.value })} />
          </Campo>
        )}
        {muestra("valor_mercaderia") && (
          <Campo etiqueta="Valor mercadería (USD)" className="md:col-span-2">
            <Entrada type="number" step="any" min={0} value={c.valor_mercaderia ?? ""} onChange={(e) => onChange({ valor_mercaderia: e.target.value })} placeholder="Factura" />
          </Campo>
        )}
        {muestra("medidas") && (
          <Campo etiqueta="Medidas" className="md:col-span-4">
            <Entrada value={c.medidas ?? ""} onChange={(e) => onChange({ medidas: e.target.value })} placeholder="120 × 80 × 100 cm" />
          </Campo>
        )}
        {(peso.peso > 0 || sobrepeso) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:col-span-12">
            {peso.peso > 0 && (
              <span>
                {textoPeso}: <strong className="num">{peso.peso.toLocaleString("en-US")} kg</strong>
                {muestra("libras") && <> · <strong className="num">{aLb(peso.peso).toLocaleString("en-US", { maximumFractionDigits: 1 })} lb</strong></>}
              </span>
            )}
            {sobrepeso && (
              <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 font-medium text-red-900">
                <AlertTriangle className="size-3" /> Sobrepeso: más de {SOBREPESO_KG.toLocaleString("en-US")} kg
              </span>
            )}
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
