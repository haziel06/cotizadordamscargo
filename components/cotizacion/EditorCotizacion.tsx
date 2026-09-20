"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { totalesCotizacion } from "@/lib/calculo/totales";
import type { Descuento } from "@/lib/calculo/descuentos";
import type { Recargos } from "@/lib/calculo/tipos";
import { pesoCobrable } from "@/lib/calculo/peso";
import { alertasCotizacion } from "@/lib/calculo/alertas";
import { guardarCotizacion } from "@/lib/cotizaciones/acciones";
import type { CabeceraForm, LineaEditable } from "@/lib/cotizaciones/esquema";
import type { Defaults, TextosLegales } from "@/lib/config";
import type { Cliente } from "@/lib/supabase/tipos";
import type { Catalogo } from "@/lib/tarifas/consultas";
import { LIMITE_TICKET_USD, servicioCombinado, textosPorDefecto } from "@/lib/etiquetas";
import { DatosCarga } from "./DatosCarga";
import { Servicios } from "./Servicios";
import { ResumenVivo } from "./ResumenVivo";
import { Descuentos } from "./Descuentos";
import { NotasCotizacion } from "./NotasCotizacion";

export interface EditorProps {
  id: string | null;
  numero: string | null;
  cabecera: CabeceraForm;
  lineas: LineaEditable[];
  catalogo: Catalogo;
  clientes: Cliente[];
  defaults: Defaults;
  recargos: Recargos;
  textosDefault: TextosLegales;
  /** Admin: ve costos, mueve el margen, agrega líneas manuales, edita cualquier cotización. */
  esAdmin: boolean;
  /** false = solo lectura (cotización de otra persona vista por un usuario normal). */
  puedeEditar: boolean;
  /** Viene de "Crear con IA": si hay datos suficientes, arma las líneas de courier sin esperar el clic. */
  autoArmarIA?: boolean;
}

const n = (v: unknown) => (v === "" || v == null ? null : Number(v));

export function EditorCotizacion(p: EditorProps) {
  const router = useRouter();
  const [cabecera, setCabecera] = useState<CabeceraForm>(p.cabecera);
  const [lineas, setLineas] = useState<LineaEditable[]>(p.lineas);
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();
  const [sucio, setSucio] = useState(false);
  const servicio = useMemo(() => servicioCombinado(cabecera.tipos_servicio), [cabecera.tipos_servicio]);
  const esCourier = cabecera.tipos_servicio.includes("courier");
  const valorMerc = n(cabecera.valor_mercaderia) ?? 0;
  const sugiereTicket = esCourier && cabecera.segmento_courier === "consolidado" && valorMerc > LIMITE_TICKET_USD;

  const tipoCambio = Number(cabecera.tipo_cambio) || 0;
  const peso = useMemo(() => pesoCobrable(n(cabecera.kilogramos), n(cabecera.kg_volumetricos)), [cabecera.kilogramos, cabecera.kg_volumetricos]);
  const descuentos = useMemo<Descuento[]>(
    () => cabecera.descuentos.filter((d) => Number(d.valor) > 0).map((d) => ({ ambito: d.ambito, tipo: d.tipo, valor: Number(d.valor), moneda: d.moneda })),
    [cabecera.descuentos],
  );
  const totales = useMemo(() => totalesCotizacion(lineas, tipoCambio, descuentos, p.recargos), [lineas, tipoCambio, descuentos, p.recargos]);
  const alertas = useMemo(() => {
    const base = alertasCotizacion({ margen_pct: totales.margen_pct, tipo_cambio: tipoCambio, lineas, kilogramos: n(cabecera.kilogramos) });
    const pendientes = lineas.filter((l) => l.pendiente).map((l) => ({ tipo: "linea_cero" as const, mensaje: `"${l.nombre}" viene del tarifario sin monto confirmado: revisa el precio` }));
    const ticket = sugiereTicket ? [{ tipo: "linea_cero" as const, mensaje: `La mercadería supera $${LIMITE_TICKET_USD.toLocaleString("en-US")}: normalmente va como Ticket (trámite aduanero + entrega)` }] : [];
    return [...base, ...pendientes, ...ticket];
  }, [totales.margen_pct, tipoCambio, lineas, cabecera.kilogramos, sugiereTicket]);

  const cambiarCabecera = (c: Partial<CabeceraForm>) => {
    setCabecera((x) => ({ ...x, ...c }));
    setSucio(true);
  };
  const cambiarLineas = (fn: (ls: LineaEditable[]) => LineaEditable[]) => {
    setLineas(fn);
    setSucio(true);
  };

  const guardar = () => {
    setError(null);
    startTransition(async () => {
      const r = await guardarCotizacion({
        id: p.id,
        cabecera,
        lineas: lineas.map(({ _clave, unidad, pendiente, seccion, cantidad_manual, ...l }) => {
          void _clave; void unidad; void pendiente; void seccion; void cantidad_manual;
          return l;
        }),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSucio(false);
      if (!p.id) router.push(`/cotizaciones/${r.id}`);
      else router.refresh();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary">{p.numero ? `Cotización ${p.numero}` : "Nueva cotización"}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{servicio.texto}</span>
              {!p.id && (
                <Link href="/cotizaciones/nueva" className="ml-2 underline">cambiar tipo</Link>
              )}
              {p.numero && <span className="ml-2">Los cambios no se guardan hasta que pulses Guardar.</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-destructive">{error}</span>}
            {p.puedeEditar && (
              <Button onClick={guardar} disabled={guardando || (!sucio && !!p.id)} size="lg">
                {guardando ? "Guardando…" : p.id ? "Guardar cambios" : "Guardar cotización"}
              </Button>
            )}
          </div>
        </div>

        <fieldset disabled={!p.puedeEditar} className="min-w-0 space-y-6 disabled:opacity-80">
          <DatosCarga cabecera={cabecera} onChange={cambiarCabecera} clientes={p.clientes} peso={peso} servicio={servicio} />

          <Servicios
            servicio={servicio}
            tipos={cabecera.tipos_servicio}
            segmentoCourier={esCourier ? cabecera.segmento_courier : null}
            fueraPerimetro={cabecera.fuera_perimetro}
            lineas={lineas}
            catalogo={p.catalogo}
            onChange={cambiarLineas}
            medidas={{ pesoCobrable: peso.peso, cbm: n(cabecera.cbm) ?? 0 }}
            margenDefault={p.defaults.margen_default}
            recargos={p.recargos}
            esAdmin={p.esAdmin}
            autoArmar={p.autoArmarIA}
          />

          <Descuentos descuentos={cabecera.descuentos} onChange={(d) => cambiarCabecera({ descuentos: d })} />

          <NotasCotizacion notas={cabecera.notas} porDefecto={textosPorDefecto(cabecera.tipos_servicio, p.textosDefault)} onChange={(nn) => cambiarCabecera({ notas: nn })} />
        </fieldset>
      </div>

      <ResumenVivo totales={totales} alertas={alertas} tipoCambio={tipoCambio} recargos={p.recargos} esAdmin={p.esAdmin} />
    </div>
  );
}
