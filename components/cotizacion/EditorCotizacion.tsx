"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { totalesCotizacion } from "@/lib/calculo/totales";
import { pesoCobrable } from "@/lib/calculo/peso";
import { alertasCotizacion } from "@/lib/calculo/alertas";
import { guardarCotizacion } from "@/lib/cotizaciones/acciones";
import type { CabeceraForm, LineaEditable } from "@/lib/cotizaciones/esquema";
import type { Defaults } from "@/lib/config";
import type { Cliente, Concepto } from "@/lib/supabase/tipos";
import { DatosCarga } from "./DatosCarga";
import { Servicios } from "./Servicios";
import { ResumenVivo } from "./ResumenVivo";

export interface EditorProps {
  id: string | null;
  numero: string | null;
  cabecera: CabeceraForm;
  lineas: LineaEditable[];
  conceptos: Concepto[];
  clientes: Cliente[];
  defaults: Defaults;
}

const n = (v: unknown) => (v === "" || v == null ? null : Number(v));

export function EditorCotizacion(p: EditorProps) {
  const router = useRouter();
  const [cabecera, setCabecera] = useState<CabeceraForm>(p.cabecera);
  const [lineas, setLineas] = useState<LineaEditable[]>(p.lineas);
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();
  const [sucio, setSucio] = useState(false);

  const tipoCambio = Number(cabecera.tipo_cambio) || 0;
  const peso = useMemo(() => pesoCobrable(n(cabecera.kilogramos), n(cabecera.kg_volumetricos)), [cabecera.kilogramos, cabecera.kg_volumetricos]);
  const totales = useMemo(() => totalesCotizacion(lineas, tipoCambio), [lineas, tipoCambio]);
  const alertas = useMemo(
    () => alertasCotizacion({ margen_pct: totales.margen_pct, tipo_cambio: tipoCambio, lineas }),
    [totales.margen_pct, tipoCambio, lineas],
  );

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
        lineas: lineas.map(({ _clave, ...l }) => {
          void _clave;
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
            {p.numero && <p className="text-sm text-muted-foreground">Los cambios no se guardan hasta que pulses Guardar.</p>}
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-destructive">{error}</span>}
            <Button onClick={guardar} disabled={guardando || (!sucio && !!p.id)} size="lg">
              {guardando ? "Guardando…" : p.id ? "Guardar cambios" : "Guardar cotización"}
            </Button>
          </div>
        </div>

        <DatosCarga cabecera={cabecera} onChange={cambiarCabecera} clientes={p.clientes} peso={peso} />

        <Servicios
          lineas={lineas}
          conceptos={p.conceptos}
          onChange={cambiarLineas}
          pesoCobrable={peso.peso}
          cbm={n(cabecera.cbm) ?? 0}
          margenDefault={p.defaults.margen_default}
        />
      </div>

      <ResumenVivo totales={totales} alertas={alertas} tipoCambio={tipoCambio} />
    </div>
  );
}
