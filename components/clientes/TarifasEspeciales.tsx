"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Entrada, Selector } from "@/components/Campos";
import { formatoMoneda } from "@/lib/calculo/formato";
import { TIPOS_MARGEN, textoUnidad } from "@/lib/etiquetas";
import type { Concepto } from "@/lib/supabase/tipos";
import type { TarifaClienteFila } from "@/lib/clientes/consultas";
import { guardarTarifaCliente, eliminarTarifaCliente } from "@/lib/clientes/acciones";

interface Props { clienteId: string; clienteNombre: string; tarifas: TarifaClienteFila[]; conceptos: Concepto[] }

/**
 * Precio especial guardado para un cliente, por concepto: se aplica solo cuando cotizas para este
 * cliente registrado. El costo/fórmula sigue siendo la del concepto real; aquí solo se guarda un
 * margen distinto (o un precio fijo) para ÉL, no para todos.
 */
export function TarifasEspeciales({ clienteId, clienteNombre, tarifas, conceptos }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [conceptoId, setConceptoId] = useState("");
  const [tipoMargen, setTipoMargen] = useState<"porcentaje" | "monto_fijo" | "precio_fijo">("precio_fijo");
  const [valorMargen, setValorMargen] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const disponibles = useMemo(() => {
    const yaTienen = new Set(tarifas.map((t) => t.concepto_id));
    const q = busqueda.trim().toLowerCase();
    return conceptos.filter((c) => !yaTienen.has(c.id) && (!q || c.nombre.toLowerCase().includes(q))).slice(0, 8);
  }, [conceptos, busqueda, tarifas]);

  const agregar = () => {
    setError(null);
    const valor = Number(valorMargen);
    if (!conceptoId) return setError("Elige un concepto.");
    if (!Number.isFinite(valor) || valor < 0) return setError("Pon un valor válido.");
    startTransition(async () => {
      const r = await guardarTarifaCliente({ cliente_id: clienteId, concepto_id: conceptoId, tipo_margen: tipoMargen, valor_margen: valor, notas: notas || null });
      if (!r.ok) return setError(r.error);
      setConceptoId(""); setBusqueda(""); setValorMargen(""); setNotas(""); setTipoMargen("precio_fijo");
      router.refresh();
    });
  };

  const quitar = (id: string) => {
    if (!confirm("¿Quitar esta tarifa especial? Al cotizar de nuevo para este cliente se usará el precio normal.")) return;
    startTransition(async () => {
      const r = await eliminarTarifaCliente(id, clienteId);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarifas especiales</CardTitle>
        <CardDescription>Precios guardados solo para {clienteNombre}. Al armar una cotización para este cliente, estas tarifas se aplican automáticamente en vez de la normal, con un aviso de que es un precio guardado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tarifas.length > 0 && (
          <ul className="divide-y rounded border">
            {tarifas.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t.concepto_nombre}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.tipo_margen === "precio_fijo" ? "Precio fijo" : t.tipo_margen === "monto_fijo" ? "Costo + monto fijo" : "% sobre costo"}: {formatoMoneda(t.valor_margen, t.moneda)}
                    {t.unidad !== "envio" ? ` ${textoUnidad(t.unidad)}` : ""}
                    {t.notas ? ` · ${t.notas}` : ""}
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" disabled={pendiente} onClick={() => quitar(t.id)}><Trash2 className="size-3.5 text-destructive" /></Button>
              </li>
            ))}
          </ul>
        )}
        {tarifas.length === 0 && <p className="text-sm text-muted-foreground">Este cliente todavía no tiene tarifas especiales: usa los precios normales de la base de tarifas.</p>}

        <div className="rounded-lg border border-dashed p-3">
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Agregar tarifa especial</div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Campo etiqueta="Concepto">
                <Entrada
                  value={conceptoId ? conceptos.find((c) => c.id === conceptoId)?.nombre ?? "" : busqueda}
                  onChange={(e) => { setConceptoId(""); setBusqueda(e.target.value); }}
                  placeholder="Buscar concepto…"
                  autoComplete="off"
                />
              </Campo>
              {!conceptoId && busqueda.trim() && disponibles.length > 0 && (
                <ul className="absolute top-full z-20 mt-1 w-full rounded border bg-white shadow-md">
                  {disponibles.map((c) => (
                    <li key={c.id}>
                      <button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setConceptoId(c.id); setBusqueda(""); }}>
                        {c.nombre} <span className="text-xs text-muted-foreground">· {c.seccion}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Campo etiqueta="Tipo">
              <Selector value={tipoMargen} onChange={(e) => setTipoMargen(e.target.value as typeof tipoMargen)}>
                {TIPOS_MARGEN.map((t) => <option key={t.valor} value={t.valor}>{t.corto}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Valor">
              <Entrada type="number" step="0.01" min={0} value={valorMargen} onChange={(e) => setValorMargen(e.target.value)} />
            </Campo>
            <Campo etiqueta="Nota (opcional)" className="md:col-span-3">
              <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. acuerdo desde 2026" />
            </Campo>
            <Button onClick={agregar} disabled={pendiente || !conceptoId}><Plus /> Guardar</Button>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
