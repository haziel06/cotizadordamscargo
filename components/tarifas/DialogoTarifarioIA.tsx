"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Campo, Casilla, Entrada, Selector } from "@/components/Campos";
import { ZonaArchivo } from "@/components/ZonaArchivo";
import { SECCIONES, SERVICIOS, infoSeccion } from "@/lib/etiquetas";
import type { Proveedor } from "@/lib/supabase/tipos";
import { guardarTarifario, guardarConcepto, guardarRuta, type DatosTarifario } from "@/lib/tarifas/acciones";
import { extraerTarifarioIA } from "@/lib/ia/tarifarioAcciones";
import { coincideProveedor, type FilaExtraida } from "@/lib/ia/tarifarioIA";

interface Props { proveedores: Proveedor[] }

type Fila = FilaExtraida & { incluir: boolean; tipo_margen: "porcentaje" | "monto_fijo" | "precio_fijo"; valor_margen: number; aplica_recargos: boolean };

const UNIDADES = ["envio", "contenedor", "kg", "cbm", "libra", "pie_cubico", "guia", "factura"];
const SERVICIO_A_SECCION: Record<string, string> = { maritimo_fcl: "flete_maritimo", maritimo_lcl: "flete_maritimo", aereo: "flete_aereo", courier: "courier", terrestre: "transporte_local", aduanas: "documentacion" };

/** Sube una foto/PDF de tarifario, la IA extrae las filas y las revisas/editas antes de guardar nada. */
export function DialogoTarifarioIA({ proveedores }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<"subir" | "revisar">("subir");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cab, setCab] = useState<DatosTarifario>({ nombre: "", proveedor_id: null, servicio: null, seccion: "flete_maritimo", origen: "", destino: "Guatemala", moneda: "USD", vigencia_desde: "", vigencia_hasta: "", notas: "" });
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const setCabecera = <K extends keyof DatosTarifario>(k: K, v: DatosTarifario[K]) => setCab((x) => ({ ...x, [k]: v }));
  const setFila = <K extends keyof Fila>(i: number, k: K, v: Fila[K]) => setFilas((xs) => xs.map((f, j) => (j === i ? { ...f, [k]: v } : f)));

  const reiniciar = () => { setPaso("subir"); setArchivo(null); setFilas([]); setError(null); };

  const leerConIA = () => {
    if (!archivo) return setError("Elige un archivo primero.");
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("archivo", archivo);
      const r = await extraerTarifarioIA(form);
      if (!r.ok) return setError(r.error);
      const { datos } = r;
      const proveedorMatch = coincideProveedor(datos.proveedor_sugerido, proveedores);
      const seccionSugerida = datos.servicio_sugerido ? SERVICIO_A_SECCION[datos.servicio_sugerido] ?? "flete_maritimo" : "flete_maritimo";
      setCab((x) => ({
        ...x,
        nombre: x.nombre || `${datos.proveedor_sugerido || proveedorMatch?.nombre || "Nuevo tarifario"} · ${new Date().toLocaleDateString("es-GT", { month: "long", year: "numeric" })}`,
        proveedor_id: proveedorMatch?.id ?? x.proveedor_id,
        servicio: datos.servicio_sugerido ?? x.servicio,
        seccion: seccionSugerida,
        moneda: datos.moneda_sugerida,
        vigencia_desde: datos.vigencia_desde || x.vigencia_desde,
        vigencia_hasta: datos.vigencia_hasta || x.vigencia_hasta,
      }));
      setFilas(datos.filas.map((f) => ({ ...f, incluir: true, tipo_margen: "porcentaje", valor_margen: 15, aplica_recargos: true })));
      setPaso("revisar");
    });
  };

  const guardarTodo = () => {
    const incluidas = filas.filter((f) => f.incluir);
    if (!incluidas.length) return setError("Marca al menos una fila para guardar.");
    if (!cab.nombre.trim()) return setError("Ponle un nombre al tarifario.");
    setError(null);
    startTransition(async () => {
      const rt = await guardarTarifario(cab);
      if (!rt.ok) return setError(rt.error);
      if (!rt.id) return setError("No se pudo crear el tarifario.");
      const tarifarioId = rt.id;
      const categoria = infoSeccion(cab.seccion).categoria;
      for (const [i, f] of incluidas.entries()) {
        if (f.tipo === "ruta") {
          await guardarRuta({
            tarifario_id: tarifarioId, pais: null, origen: f.origen || "—", destino: f.destino || "Guatemala", via: f.via || null,
            costo: f.costo, unidad: f.unidad, minimo: f.minimo, transito: f.transito || null,
            tipo_margen: f.tipo_margen, valor_margen: f.valor_margen, aplica_recargos: f.aplica_recargos, notas: f.notas || null,
          });
        } else {
          await guardarConcepto({
            tarifario_id: tarifarioId, proveedor_id: cab.proveedor_id, nombre: f.nombre || "Concepto sin nombre", categoria, seccion: cab.seccion,
            moneda: cab.moneda, unidad: f.unidad, costo: f.costo, minimo: f.minimo, rango_desde: null, rango_hasta: null,
            tipo_margen: f.tipo_margen, valor_margen: f.valor_margen, aplica_recargos: f.aplica_recargos, aplica_iva: true, pendiente: false,
            orden: i, notas: f.notas || null, servicios: [], editable_por_todos: false,
          });
        }
      }
      setAbierto(false);
      reiniciar();
      router.push(`/tarifas/${tarifarioId}`);
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => { setAbierto(v); if (!v) reiniciar(); }}>
      <DialogTrigger nativeButton={false} render={<span className="inline-flex" />}>
        <Button variant="outline"><Sparkles /> Nuevo con IA</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nuevo tarifario con IA</DialogTitle>
        </DialogHeader>

        {paso === "subir" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Sube la foto o el PDF de la hoja de tarifas. La IA solo lee y sugiere las filas — tú decides qué margen aplicarles y confirmas antes de guardar nada.</p>
            <ZonaArchivo archivo={archivo} onArchivo={setArchivo} texto="Elige o arrastra un PDF, PNG, JPG o WEBP (máx. 15 MB)" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
              <Button onClick={leerConIA} disabled={pendiente || !archivo}>{pendiente ? "Leyendo documento…" : "Leer con IA"}</Button>
            </div>
          </div>
        )}

        {paso === "revisar" && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Campo etiqueta="Nombre del tarifario" className="md:col-span-3">
                <Entrada value={cab.nombre} onChange={(e) => setCabecera("nombre", e.target.value)} />
              </Campo>
              <Campo etiqueta="Proveedor">
                <Selector value={cab.proveedor_id ?? ""} onChange={(e) => setCabecera("proveedor_id", e.target.value || null)}>
                  <option value="">Propio (Dams Cargo)</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </Selector>
              </Campo>
              <Campo etiqueta="Servicio">
                <Selector value={cab.servicio ?? ""} onChange={(e) => setCabecera("servicio", (e.target.value || null) as DatosTarifario["servicio"])}>
                  <option value="">Varios / general</option>
                  {SERVICIOS.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
                </Selector>
              </Campo>
              <Campo etiqueta="Sección">
                <Selector value={cab.seccion} onChange={(e) => { setCabecera("seccion", e.target.value); setCabecera("moneda", infoSeccion(e.target.value).moneda); }}>
                  {SECCIONES.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
                </Selector>
              </Campo>
              <Campo etiqueta="Vigente desde">
                <Entrada type="date" value={cab.vigencia_desde ?? ""} onChange={(e) => setCabecera("vigencia_desde", e.target.value)} />
              </Campo>
              <Campo etiqueta="Vigente hasta">
                <Entrada type="date" value={cab.vigencia_hasta ?? ""} onChange={(e) => setCabecera("vigencia_hasta", e.target.value)} />
              </Campo>
            </div>

            <div className="max-h-[45vh] overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 text-left">
                  <tr>
                    <th className="p-1.5"></th>
                    <th className="p-1.5">Tipo</th>
                    <th className="p-1.5">Nombre / Origen</th>
                    <th className="p-1.5">Destino</th>
                    <th className="p-1.5">Costo</th>
                    <th className="p-1.5">Unidad</th>
                    <th className="p-1.5">Mínimo</th>
                    <th className="p-1.5">Margen %</th>
                    <th className="p-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filas.map((f, i) => (
                    <tr key={i} className={!f.incluir ? "opacity-40" : undefined}>
                      <td className="p-1.5"><Casilla checked={f.incluir} onChange={(e) => setFila(i, "incluir", e.target.checked)} /></td>
                      <td className="p-1.5">
                        <Selector value={f.tipo} onChange={(e) => setFila(i, "tipo", e.target.value as Fila["tipo"])} className="h-7 w-24">
                          <option value="ruta">Ruta</option>
                          <option value="concepto">Concepto</option>
                        </Selector>
                      </td>
                      <td className="p-1.5"><Entrada className="h-7 w-32" value={f.tipo === "ruta" ? f.origen : f.nombre} onChange={(e) => setFila(i, f.tipo === "ruta" ? "origen" : "nombre", e.target.value)} /></td>
                      <td className="p-1.5">{f.tipo === "ruta" ? <Entrada className="h-7 w-28" value={f.destino} onChange={(e) => setFila(i, "destino", e.target.value)} /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-1.5"><Entrada type="number" className="h-7 w-20" value={f.costo} onChange={(e) => setFila(i, "costo", Number(e.target.value))} /></td>
                      <td className="p-1.5">
                        <Selector value={f.unidad} onChange={(e) => setFila(i, "unidad", e.target.value as Fila["unidad"])} className="h-7 w-24">
                          {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                        </Selector>
                      </td>
                      <td className="p-1.5"><Entrada type="number" className="h-7 w-20" value={f.minimo ?? ""} onChange={(e) => setFila(i, "minimo", e.target.value ? Number(e.target.value) : null)} /></td>
                      <td className="p-1.5"><Entrada type="number" className="h-7 w-16" value={f.valor_margen} onChange={(e) => setFila(i, "valor_margen", Number(e.target.value))} /></td>
                      <td className="p-1.5"><Button variant="ghost" size="icon-sm" onClick={() => setFilas((xs) => xs.filter((_, j) => j !== i))}><Trash2 className="size-3.5 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">El costo es el que trae el documento; el margen (%) es el que tú decides — nunca lo inventa la IA.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={reiniciar}>Volver a subir</Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
                <Button onClick={guardarTodo} disabled={pendiente}>{pendiente ? "Guardando…" : `Guardar ${filas.filter((f) => f.incluir).length} filas`}</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
