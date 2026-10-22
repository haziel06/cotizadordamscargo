"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Campo, Casilla, Entrada, Selector } from "@/components/Campos";
import { ZonaArchivo } from "@/components/ZonaArchivo";
import { SECCIONES, SERVICIOS, infoSeccion } from "@/lib/etiquetas";
import { formatoFecha, hoyIso } from "@/lib/calculo/formato";
import type { Proveedor } from "@/lib/supabase/tipos";
import { guardarTarifario, guardarConcepto, guardarRuta, guardarProveedor, subirDocumentoTarifario, type DatosTarifario } from "@/lib/tarifas/acciones";
import { extraerTarifarioIA } from "@/lib/ia/tarifarioAcciones";
import { ACEPTA_DOCUMENTOS } from "@/lib/ia/documento-tipos";
import { coincideAlgunProveedor, coincideProveedor, type FilaExtraida } from "@/lib/ia/tarifarioIA";

interface Props { proveedores: Proveedor[] }

type Fila = FilaExtraida & { incluir: boolean; tipo_margen: "porcentaje" | "monto_fijo" | "precio_fijo"; valor_margen: number; aplica_recargos: boolean };

const UNIDADES = ["envio", "contenedor", "kg", "cbm", "libra", "pie_cubico", "guia", "factura"];
const SERVICIO_A_SECCION: Record<string, string> = { maritimo_fcl: "flete_maritimo", maritimo_lcl: "flete_maritimo", aereo: "flete_aereo", courier: "courier", terrestre: "transporte_local", aduanas: "documentacion" };
const SERVICIO_A_TIPO_PROVEEDOR: Record<string, "naviera" | "agente_origen" | "transportista" | "courier" | "otro"> = { maritimo_fcl: "agente_origen", maritimo_lcl: "agente_origen", aereo: "agente_origen", courier: "courier", terrestre: "transportista", aduanas: "otro" };
const NUEVO = "__nuevo__";
const CAB_VACIA: DatosTarifario = { nombre: "", proveedor_id: null, servicio: null, seccion: "flete_maritimo", origen: "", destino: "Guatemala", moneda: "USD", vigencia_desde: "", vigencia_hasta: "", notas: "" };

/** Sube una foto/PDF de tarifario, la IA extrae las filas y las revisas/editas antes de guardar nada. */
export function DialogoTarifarioIA({ proveedores }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<"subir" | "revisar">("subir");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [extra, setExtra] = useState<File | null>(null);
  const [cab, setCab] = useState<DatosTarifario>(CAB_VACIA);
  const [provSel, setProvSel] = useState("");
  const [provNuevo, setProvNuevo] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const setCabecera = <K extends keyof DatosTarifario>(k: K, v: DatosTarifario[K]) => setCab((x) => ({ ...x, [k]: v }));
  const setFila = <K extends keyof Fila>(i: number, k: K, v: Fila[K]) => setFilas((xs) => xs.map((f, j) => (j === i ? { ...f, [k]: v } : f)));

  const reiniciar = () => { setPaso("subir"); setArchivo(null); setExtra(null); setCab(CAB_VACIA); setProvSel(""); setProvNuevo(""); setFilas([]); setError(null); };

  const leer = (file: File, agregar: boolean) => {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("archivo", file);
      const r = await extraerTarifarioIA(form);
      if (!r.ok) return setError(r.error);
      const { datos } = r;
      const nuevasFilas = datos.filas.map((f): Fila => ({ ...f, incluir: true, tipo_margen: "porcentaje", valor_margen: 15, aplica_recargos: true }));

      if (agregar) {
        setFilas((xs) => [...xs, ...nuevasFilas]);
        setCab((x) => ({ ...x, vigencia_desde: x.vigencia_desde || datos.vigencia_desde, vigencia_hasta: x.vigencia_hasta || datos.vigencia_hasta }));
        setExtra(null);
        return;
      }

      // Empresa emisora: se empareja con un proveedor registrado; si no existe, se propone crearlo con el nombre que salió en el documento.
      const emisor = datos.proveedor_sugerido.trim();
      const encontrado = emisor ? coincideProveedor(emisor, proveedores) : coincideAlgunProveedor(datos.nombres_empresa_vistos, proveedores);
      if (encontrado) { setProvSel(encontrado.id); setProvNuevo(""); }
      else if (emisor) { setProvSel(NUEVO); setProvNuevo(emisor); }
      else { setProvSel(""); setProvNuevo(""); }

      const quien = encontrado?.nombre || emisor;
      const mes = new Date().toLocaleDateString("es-GT", { month: "long", year: "numeric" });
      const nombre = datos.nombre_tarifario
        ? (quien && !datos.nombre_tarifario.toLowerCase().includes(quien.toLowerCase()) ? `${quien} · ${datos.nombre_tarifario}` : datos.nombre_tarifario)
        : `${quien || "Nuevo tarifario"} · ${mes}`;
      setCab({
        ...CAB_VACIA,
        nombre,
        servicio: datos.servicio_sugerido,
        seccion: datos.servicio_sugerido ? SERVICIO_A_SECCION[datos.servicio_sugerido] ?? "flete_maritimo" : "flete_maritimo",
        moneda: datos.moneda_sugerida,
        vigencia_desde: datos.vigencia_desde,
        vigencia_hasta: datos.vigencia_hasta,
        notas: datos.condiciones_generales,
      });
      setFilas(nuevasFilas);
      setPaso("revisar");
    });
  };

  const guardarTodo = () => {
    const incluidas = filas.filter((f) => f.incluir);
    if (!incluidas.length) return setError("Marca al menos una fila para guardar.");
    if (!cab.nombre.trim()) return setError("Ponle un nombre al tarifario.");
    if (provSel === NUEVO && !provNuevo.trim()) return setError("Escribe el nombre del proveedor nuevo.");
    setError(null);
    startTransition(async () => {
      let proveedorId: string | null = provSel && provSel !== NUEVO ? provSel : null;
      if (provSel === NUEVO) {
        const rp = await guardarProveedor({ nombre: provNuevo.trim(), tipo: SERVICIO_A_TIPO_PROVEEDOR[cab.servicio ?? ""] ?? "otro", pais: null, moneda_default: cab.moneda, activo: true });
        if (!rp.ok || !rp.id) return setError(rp.ok ? "No se pudo crear el proveedor." : rp.error);
        proveedorId = rp.id;
      }
      const rt = await guardarTarifario({ ...cab, proveedor_id: proveedorId });
      if (!rt.ok) return setError(rt.error);
      if (!rt.id) return setError("No se pudo crear el tarifario.");
      const tarifarioId = rt.id;
      const categoria = infoSeccion(cab.seccion).categoria;

      const guardarFila = async (f: Fila, i: number) => {
        if (f.tipo === "ruta") {
          return guardarRuta({
            tarifario_id: tarifarioId, pais: f.pais || null, origen: f.origen || "—", destino: f.destino || "Guatemala", via: f.via || null, variante: f.variante || null,
            costo: f.costo, unidad: f.unidad, minimo: f.minimo, transito: f.transito || null,
            tipo_margen: f.tipo_margen, valor_margen: f.valor_margen, aplica_recargos: f.aplica_recargos, notas: f.notas || null,
          });
        }
        return guardarConcepto({
          tarifario_id: tarifarioId, proveedor_id: proveedorId, nombre: `${f.nombre || "Concepto sin nombre"}${f.variante ? ` (${f.variante})` : ""}`, categoria, seccion: cab.seccion,
          moneda: cab.moneda, unidad: f.unidad, costo: f.costo, minimo: f.minimo, rango_desde: null, rango_hasta: null,
          tipo_margen: f.tipo_margen, valor_margen: f.valor_margen, aplica_recargos: f.aplica_recargos, aplica_iva: true, pendiente: false,
          orden: i, notas: f.notas || null, servicios: [], editable_por_todos: false,
        });
      };
      // De 8 en 8: una hoja con cientos de tarifas no tarda minutos y un fallo suelto no frena a las demás.
      let fallidas = 0;
      for (let i = 0; i < incluidas.length; i += 8) {
        const resultados = await Promise.all(incluidas.slice(i, i + 8).map((f, j) => guardarFila(f, i + j)));
        fallidas += resultados.filter((r) => !r.ok).length;
      }
      // Se conserva el documento original junto al tarifario, para consultarlo después.
      if (archivo) {
        const fd = new FormData();
        fd.set("archivo", archivo);
        await subirDocumentoTarifario(tarifarioId, fd);
      }
      if (fallidas) alert(`Se guardó el tarifario, pero ${fallidas} de ${incluidas.length} filas no se pudieron guardar. Revísalo y agrega las que falten.`);
      setAbierto(false);
      reiniciar();
      router.push(`/tarifas/${tarifarioId}`);
    });
  };

  const hoy = hoyIso();
  const rutas = filas.filter((f) => f.tipo === "ruta").length;

  return (
    <Dialog open={abierto} onOpenChange={(v) => { setAbierto(v); if (!v) reiniciar(); }}>
      <DialogTrigger nativeButton={false} render={<span className="inline-flex" />}>
        <Button variant="outline"><Sparkles /> Nuevo con IA</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Nuevo tarifario con IA</DialogTitle>
        </DialogHeader>

        {paso === "subir" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Sube la foto o el PDF de la hoja de tarifas, en el formato que venga. La IA lee la empresa, la vigencia y todas las tarifas; tú revisas, decides el margen y confirmas antes de guardar nada.</p>
            <ZonaArchivo archivo={archivo} onArchivo={setArchivo} aceptar={ACEPTA_DOCUMENTOS} texto="Elige o arrastra foto, PDF o Excel (máx. 4 MB; las fotos grandes se reducen solas)" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
              <Button onClick={() => archivo && leer(archivo, false)} disabled={pendiente || !archivo}>{pendiente ? "Leyendo documento…" : "Leer con IA"}</Button>
            </div>
          </div>
        )}

        {paso === "revisar" && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Campo etiqueta="Nombre del tarifario" className="md:col-span-3">
                <Entrada value={cab.nombre} onChange={(e) => setCabecera("nombre", e.target.value)} />
              </Campo>
              <Campo etiqueta="Proveedor / empresa">
                <Selector value={provSel} onChange={(e) => setProvSel(e.target.value)}>
                  <option value="">Propio (Dams Cargo)</option>
                  {provNuevo && <option value={NUEVO}>➕ Crear proveedor nuevo</option>}
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </Selector>
              </Campo>
              {provSel === NUEVO ? (
                <Campo etiqueta="Nombre del proveedor nuevo (como salió en el documento)">
                  <Entrada value={provNuevo} onChange={(e) => setProvNuevo(e.target.value)} />
                </Campo>
              ) : (
                <Campo etiqueta="Servicio">
                  <Selector value={cab.servicio ?? ""} onChange={(e) => setCabecera("servicio", (e.target.value || null) as DatosTarifario["servicio"])}>
                    <option value="">Varios / general</option>
                    {SERVICIOS.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
                  </Selector>
                </Campo>
              )}
              <Campo etiqueta="Sección">
                <Selector value={cab.seccion} onChange={(e) => { setCabecera("seccion", e.target.value); setCabecera("moneda", infoSeccion(e.target.value).moneda); }}>
                  {SECCIONES.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
                </Selector>
              </Campo>
              <Campo etiqueta="Vigente desde">
                <Entrada type="date" value={cab.vigencia_desde ?? ""} onChange={(e) => setCabecera("vigencia_desde", e.target.value)} />
              </Campo>
              <Campo etiqueta="Vigente hasta (después se apaga solo)">
                <Entrada type="date" value={cab.vigencia_hasta ?? ""} onChange={(e) => setCabecera("vigencia_hasta", e.target.value)} />
              </Campo>
              <div className="self-end pb-1 text-xs">
                {!cab.vigencia_hasta ? <span className="text-amber-700">Sin fecha de vencimiento: no se apagará solo.</span>
                  : cab.vigencia_hasta < hoy ? <span className="font-medium text-red-700">Esa fecha ya pasó: quedará vencido y no se podrá usar al cotizar.</span>
                  : <span className="text-green-700">Se podrá usar hasta el {formatoFecha(cab.vigencia_hasta)}.</span>}
              </div>
            </div>
            {cab.notas && (
              <Campo etiqueta="Condiciones del documento (se guardan en el tarifario)">
                <Entrada value={cab.notas} onChange={(e) => setCabecera("notas", e.target.value)} />
              </Campo>
            )}

            <p className="text-xs text-muted-foreground">Se leyeron <strong>{filas.length}</strong> tarifas ({rutas} rutas, {filas.length - rutas} conceptos). Revisa que estén todas.</p>
            <div className="max-h-[40vh] overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 text-left">
                  <tr>
                    <th className="p-1.5"></th>
                    <th className="p-1.5">Tipo</th>
                    <th className="p-1.5">Nombre / Origen</th>
                    <th className="p-1.5">Destino</th>
                    <th className="p-1.5">Variante</th>
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
                      <td className="p-1.5"><Entrada className="h-7 w-20" value={f.variante} placeholder="40HQ" onChange={(e) => setFila(i, "variante", e.target.value)} /></td>
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

            <details className="rounded-lg border p-2 text-sm">
              <summary className="cursor-pointer font-medium">¿Faltan tarifas? Agrega otra página o imagen</summary>
              <div className="mt-2 space-y-2">
                <ZonaArchivo archivo={extra} onArchivo={setExtra} aceptar={ACEPTA_DOCUMENTOS} texto="Arrastra otra página o parte del mismo tarifario" />
                <Button size="sm" variant="outline" disabled={pendiente || !extra} onClick={() => extra && leer(extra, true)}>{pendiente ? "Leyendo…" : "Leer y sumar estas filas"}</Button>
              </div>
            </details>

            <p className="text-xs text-muted-foreground">El costo es el que trae el documento; el margen (%) es el que tú decides — nunca lo inventa la IA. El documento original se guarda junto al tarifario.</p>
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
