"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Campo, Casilla, Entrada, Selector } from "@/components/Campos";
import { ZonaArchivo } from "@/components/ZonaArchivo";
import { formatoFecha, hoyIso } from "@/lib/calculo/formato";
import { ACEPTA_DOCUMENTOS } from "@/lib/ia/documento-tipos";
import type { TarifarioResumen } from "@/lib/tarifas/consultas";
import { resumenCambios, type CambioFila, type PropuestaActualizacion } from "@/lib/tarifas/diferencias";
import { aplicarActualizacionAccion, proponerActualizacionAccion } from "@/lib/tarifas/actualizacionAcciones";
import { cn } from "@/lib/utils";

interface Props {
  /** Para elegir qué tarifario actualizar cuando se empieza desde cero. */
  tarifarios?: TarifarioResumen[];
  tarifarioInicial?: string;
  /** Propuesta ya calculada (viene del chat): se abre directo en la revisión. */
  propuestaInicial?: PropuestaActualizacion;
  abierto?: boolean;
  onAbierto?: (v: boolean) => void;
  children?: ReactNode;
}

type FilaUI = CambioFila & { incluir: boolean; costoNuevo: number; valor_margen: number };

const aFilas = (p: PropuestaActualizacion): FilaUI[] =>
  p.cambios.filter((c) => c.estado !== "igual").map((c) => ({ ...c, incluir: true, costoNuevo: c.fila.costo, valor_margen: 15 }));

/** Actualiza un tarifario existente con un archivo nuevo: solo cambia lo que el documento trae distinto o nuevo. */
export function DialogoActualizarTarifa({ tarifarios = [], tarifarioInicial, propuestaInicial, abierto, onAbierto, children }: Props) {
  const router = useRouter();
  const [abiertoInterno, setAbiertoInterno] = useState(false);
  const open = abierto ?? abiertoInterno;
  const setOpen = (v: boolean) => { setAbiertoInterno(v); onAbierto?.(v); };

  const [paso, setPaso] = useState<"subir" | "revisar" | "listo">(propuestaInicial ? "revisar" : "subir");
  const [tarifarioId, setTarifarioId] = useState(tarifarioInicial ?? "");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [propuesta, setPropuesta] = useState<PropuestaActualizacion | null>(propuestaInicial ?? null);
  const [filas, setFilas] = useState<FilaUI[]>(propuestaInicial ? aFilas(propuestaInicial) : []);
  const [hasta, setHasta] = useState(propuestaInicial?.vigencia_hasta ?? "");
  const [desde, setDesde] = useState(propuestaInicial?.vigencia_desde ?? "");
  const [respaldo, setRespaldo] = useState(true);
  const [modo, setModo] = useState<"version" | "reemplazar">("version");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const reiniciar = () => { setPaso(propuestaInicial ? "revisar" : "subir"); setArchivo(null); setError(null); setResultado(null); };
  const setFila = <K extends keyof FilaUI>(i: number, k: K, v: FilaUI[K]) => setFilas((xs) => xs.map((f, j) => (j === i ? { ...f, [k]: v } : f)));

  const leer = () => {
    if (!archivo || !tarifarioId) return setError("Elige el tarifario y el archivo.");
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("archivo", archivo);
      form.set("tarifarioId", tarifarioId);
      const r = await proponerActualizacionAccion(form);
      if (!r.ok) return setError(r.error);
      setPropuesta(r.propuesta);
      setFilas(aFilas(r.propuesta));
      setHasta(r.propuesta.vigencia_hasta);
      setDesde(r.propuesta.vigencia_desde);
      setModo("version");
      setPaso("revisar");
    });
  };

  const aplicar = () => {
    if (!propuesta) return;
    if (!hasta) return setError("Pon hasta qué fecha vale este tarifario.");
    const elegidas = filas.filter((f) => f.incluir);
    setError(null);
    startTransition(async () => {
      const r = await aplicarActualizacionAccion({
        tarifarioId: propuesta.tarifarioId, modo: empiezaDespues ? modo : "reemplazar", vigencia_desde: desde || null, vigencia_hasta: hasta, crearRespaldo: respaldo,
        cambios: elegidas.map((f) => ({
          tipo: f.tipo, estado: f.estado === "nuevo" ? "nuevo" : "cambia", existenteId: f.existenteId, tipo_margen: "porcentaje", valor_margen: f.valor_margen,
          fila: { ...f.fila, costo: f.costoNuevo, minimo: f.fila.minimo },
        })),
      });
      if (!r.ok) return setError(r.error);
      setResultado(`${r.actualizadas} precios actualizados, ${r.nuevas} nuevos. ${r.aviso}`);
      setPaso("listo");
      router.refresh();
    });
  };

  const resumen = propuesta ? resumenCambios(propuesta.cambios) : null;
  // Si las nuevas tarifas empiezan en el futuro, pisar el tarifario actual lo dejaría sin poder usarse hasta esa fecha.
  const empiezaDespues = Boolean(desde && desde > hoyIso());
  const elegibles = tarifarios.filter((t) => t.estado !== "desactivado");

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reiniciar(); }}>
      {children && <DialogTrigger nativeButton={false} render={<span className="inline-flex" />}>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{propuesta ? `Actualizar «${propuesta.tarifarioNombre}»` : "Actualizar un tarifario con IA"}</DialogTitle>
        </DialogHeader>

        {paso === "subir" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Cuando el proveedor solo cambió algunos precios: sube su foto, PDF o Excel y la IA compara contra el tarifario actual. Solo se cambia lo que viene distinto o nuevo; lo demás no se toca y la versión anterior se guarda.</p>
            <Campo etiqueta="Tarifario a actualizar">
              <Selector value={tarifarioId} onChange={(e) => setTarifarioId(e.target.value)}>
                <option value="">Elige un tarifario…</option>
                {elegibles.map((t) => <option key={t.id} value={t.id}>{t.proveedor_nombre ? `${t.proveedor_nombre} · ` : ""}{t.nombre}{t.estado === "vencido" ? " (vencido)" : ""}</option>)}
              </Selector>
            </Campo>
            <ZonaArchivo archivo={archivo} onArchivo={setArchivo} aceptar={ACEPTA_DOCUMENTOS} texto="Elige o arrastra foto, PDF o Excel (máx. 4 MB; las fotos grandes se reducen solas)" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={leer} disabled={pendiente || !archivo || !tarifarioId}>{pendiente ? "Leyendo y comparando…" : "Leer y comparar"}</Button>
            </div>
          </div>
        )}

        {paso === "revisar" && propuesta && resumen && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-900">{resumen.nuevos} nuevos</span>
              <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-900">{resumen.cambian} cambian de precio</span>
              <span className="text-muted-foreground">{resumen.iguales} iguales (no se tocan)</span>
            </div>
            {propuesta.condiciones && <p className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Condiciones del documento: {propuesta.condiciones}</p>}

            <div className="grid gap-3 md:grid-cols-3">
              <Campo etiqueta="Vigente desde (opcional)">
                <Entrada type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </Campo>
              <Campo etiqueta="Vigente hasta (obligatorio)">
                <Entrada type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={cn(!hasta && "border-ambar bg-ambar/10")} />
              </Campo>
              <div className="self-end pb-1 text-xs">
                {!hasta ? <span className="font-medium text-amber-800">El documento no dice hasta cuándo vale: ponlo aquí.</span>
                  : hasta < hoyIso() ? <span className="font-medium text-red-700">Esa fecha ya pasó: quedaría vencido.</span>
                  : <span className="text-green-700">Se podrá usar hasta el {formatoFecha(hasta)}.</span>}
              </div>
            </div>

            {empiezaDespues ? (
              <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="font-medium text-primary">Estas tarifas empiezan el {formatoFecha(desde)}: ¿cómo las guardo?</div>
                <label className="flex items-start gap-2"><input type="radio" checked={modo === "version"} onChange={() => setModo("version")} className="mt-1" />
                  <span><strong>Crear una versión nueva</strong> (recomendado). La tarifa actual sigue valiendo hasta su fecha y la nueva entra sola el {formatoFecha(desde)}.</span></label>
                <label className="flex items-start gap-2"><input type="radio" checked={modo === "reemplazar"} onChange={() => setModo("reemplazar")} className="mt-1" />
                  <span>Reemplazar la actual. Ojo: no se podrá cotizar con este tarifario hasta el {formatoFecha(desde)}.</span></label>
              </div>
            ) : null}

            {filas.length === 0 ? (
              <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Todos los precios del documento ya están así en el tarifario. Solo se actualizaría la fecha de vigencia.</p>
            ) : (
              <div className="max-h-[42vh] overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 text-left">
                    <tr><th className="p-1.5"></th><th className="p-1.5">Cambio</th><th className="p-1.5">Tarifa</th><th className="p-1.5 text-right">Antes</th><th className="p-1.5">Ahora</th><th className="p-1.5">Margen % (nuevas)</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {filas.map((f, i) => (
                      <tr key={f.clave} className={!f.incluir ? "opacity-40" : undefined}>
                        <td className="p-1.5"><Casilla checked={f.incluir} onChange={(e) => setFila(i, "incluir", e.target.checked)} /></td>
                        <td className="p-1.5"><span className={cn("rounded px-1.5 py-0.5 font-medium", f.estado === "nuevo" ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900")}>{f.estado === "nuevo" ? "Nuevo" : "Cambia"}</span></td>
                        <td className="p-1.5"><span className="font-medium">{f.etiqueta}</span> <span className="text-muted-foreground">{f.tipo === "ruta" ? "ruta" : "cargo"}</span></td>
                        <td className="num p-1.5 text-right text-muted-foreground">{f.anterior?.costo ?? "—"}</td>
                        <td className="p-1.5"><Entrada type="number" step="0.01" className="h-7 w-24" value={f.costoNuevo} onChange={(e) => setFila(i, "costoNuevo", Number(e.target.value))} /></td>
                        <td className="p-1.5">{f.estado === "nuevo" ? <Entrada type="number" className="h-7 w-16" value={f.valor_margen} onChange={(e) => setFila(i, "valor_margen", Number(e.target.value))} /> : <span className="text-muted-foreground">se conserva</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(!empiezaDespues || modo === "reemplazar") && (
              <label className="flex items-center gap-2 text-sm"><Casilla checked={respaldo} onChange={(e) => setRespaldo(e.target.checked)} /> Guardar una copia de la versión anterior (queda en «versiones anteriores» del proveedor)</label>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-between gap-2">
              {propuestaInicial ? <span /> : <Button variant="ghost" onClick={reiniciar}>Volver a subir</Button>}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={aplicar} disabled={pendiente}>{pendiente ? "Aplicando…" : `Aplicar ${filas.filter((f) => f.incluir).length} cambios`}</Button>
              </div>
            </div>
          </div>
        )}

        {paso === "listo" && (
          <div className="space-y-3">
            <p className="text-sm">{resultado}</p>
            <div className="flex justify-end"><Button onClick={() => setOpen(false)}>Cerrar</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BotonActualizarTarifa({ tarifarios, tarifarioInicial, etiqueta = "Actualizar con IA" }: { tarifarios: TarifarioResumen[]; tarifarioInicial?: string; etiqueta?: string }) {
  return (
    <DialogoActualizarTarifa tarifarios={tarifarios} tarifarioInicial={tarifarioInicial}>
      <Button variant="outline" size="sm"><RefreshCw /> {etiqueta}</Button>
    </DialogoActualizarTarifa>
  );
}
