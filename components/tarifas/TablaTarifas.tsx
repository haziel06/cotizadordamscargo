"use client";
import { useMemo, useState, useTransition } from "react";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Casilla, Entrada, Selector } from "@/components/Campos";
import { CATEGORIAS, TIPOS_MARGEN, UNIDADES } from "@/lib/etiquetas";
import { ventaLinea } from "@/lib/calculo/linea";
import { formatoMoneda } from "@/lib/calculo/formato";
import type { Concepto, Proveedor } from "@/lib/supabase/tipos";
import { eliminarConcepto, guardarConcepto, type DatosConcepto } from "@/lib/tarifas/acciones";
import { Proveedores } from "./Proveedores";

type Fila = DatosConcepto & { _clave: string; _estado?: "guardando" | "guardado" | "error"; _error?: string };

const aFila = (c: Concepto): Fila => ({
  _clave: c.id,
  id: c.id,
  nombre: c.nombre,
  categoria: c.categoria,
  proveedor_id: c.proveedor_id,
  moneda: c.moneda,
  unidad: c.unidad,
  costo: Number(c.costo),
  tipo_margen: c.tipo_margen,
  valor_margen: Number(c.valor_margen),
  aplica_iva: c.aplica_iva,
  activo: c.activo,
  orden: c.orden,
  notas: c.notas,
});

const nuevaFila = (categoria: DatosConcepto["categoria"], orden: number): Fila => ({
  _clave: `nuevo-${Date.now()}`,
  nombre: "",
  categoria,
  proveedor_id: null,
  moneda: CATEGORIAS.find((c) => c.valor === categoria)!.moneda,
  unidad: "envio",
  costo: 0,
  tipo_margen: "porcentaje",
  valor_margen: 15,
  aplica_iva: true,
  activo: true,
  orden,
  notas: null,
});

export function TablaTarifas({ conceptos, proveedores }: { conceptos: Concepto[]; proveedores: Proveedor[] }) {
  const [filas, setFilas] = useState<Fila[]>(() => conceptos.map(aFila));
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<"" | DatosConcepto["categoria"]>("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [, startTransition] = useTransition();

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter(
      (f) =>
        (verInactivos || f.activo || !f.id) &&
        (!categoria || f.categoria === categoria) &&
        (!q || f.nombre.toLowerCase().includes(q)),
    );
  }, [filas, busqueda, categoria, verInactivos]);

  const actualizar = (clave: string, cambios: Partial<Fila>) =>
    setFilas((fs) => fs.map((f) => (f._clave === clave ? { ...f, ...cambios } : f)));

  /** Aplica cambios (si hay) y guarda la fila con el estado más reciente. */
  const cambiarYGuardar = (clave: string, cambios: Partial<Fila> = {}) => {
    setFilas((fs) => {
      const nuevas = fs.map((f) => (f._clave === clave ? { ...f, ...cambios, _estado: "guardando" as const } : f));
      const fila = nuevas.find((f) => f._clave === clave)!;
      if (!fila.nombre.trim()) return fs.map((f) => (f._clave === clave ? { ...f, ...cambios } : f));
      startTransition(async () => {
        const { _clave, _estado, _error, ...datos } = fila;
        void _clave; void _estado; void _error;
        const r = await guardarConcepto(datos);
        setFilas((xs) =>
          xs.map((f) =>
            f._clave === clave
              ? r.ok
                ? { ...f, id: r.id ?? f.id, _estado: "guardado", _error: undefined }
                : { ...f, _estado: "error", _error: r.error }
              : f,
          ),
        );
      });
      return nuevas;
    });
  };
  const guardar = (clave: string) => cambiarYGuardar(clave);

  const borrar = (fila: Fila) => {
    if (!fila.id) {
      setFilas((fs) => fs.filter((f) => f._clave !== fila._clave));
      return;
    }
    if (!confirm(`¿Borrar "${fila.nombre}"?`)) return;
    startTransition(async () => {
      const r = await eliminarConcepto(fila.id!);
      if (r.ok) setFilas((fs) => fs.filter((f) => f._clave !== fila._clave));
      else alert(r.error);
    });
  };

  const agregar = () => {
    const cat = categoria || "internacional";
    const maxOrden = Math.max(0, ...filas.filter((f) => f.categoria === cat).map((f) => f.orden));
    setFilas((fs) => [nuevaFila(cat, maxOrden + 10), ...fs]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Entrada
          placeholder="Buscar concepto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-64"
        />
        <Selector value={categoria} onChange={(e) => setCategoria(e.target.value as typeof categoria)} className="w-52">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>{c.texto}</option>
          ))}
        </Selector>
        <label className="flex items-center gap-2 text-sm">
          <Casilla checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Mostrar inactivos
        </label>
        <div className="ml-auto flex gap-2">
          <Proveedores proveedores={proveedores} />
          <Button onClick={agregar}>
            <Plus /> Nuevo concepto
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Concepto</th>
              <th className="px-2 py-2 font-medium">Categoría</th>
              <th className="px-2 py-2 font-medium">Proveedor</th>
              <th className="px-2 py-2 font-medium">Moneda</th>
              <th className="px-2 py-2 font-medium">Unidad</th>
              <th className="px-2 py-2 text-right font-medium">Costo</th>
              <th className="px-2 py-2 font-medium">Margen</th>
              <th className="px-2 py-2 text-right font-medium">Valor</th>
              <th className="px-2 py-2 text-right font-medium">Venta</th>
              <th className="px-2 py-2 text-center font-medium">IVA</th>
              <th className="px-2 py-2 text-center font-medium">Activo</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibles.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                  No hay conceptos que coincidan.
                </td>
              </tr>
            )}
            {visibles.map((f) => {
              const venta = ventaLinea({ ...f, cantidad: 1, costo_unitario: f.costo, lleva_iva: f.aplica_iva });
              return (
                <tr key={f._clave} className={!f.activo ? "opacity-50" : undefined}>
                  <td className="px-3 py-1.5">
                    <Entrada
                      value={f.nombre}
                      placeholder="Nombre del concepto"
                      autoFocus={!f.id}
                      onChange={(e) => actualizar(f._clave, { nombre: e.target.value })}
                      onBlur={() => guardar(f._clave)}
                      className="min-w-48"
                    />
                    {f._error && <div className="mt-1 text-xs text-destructive">{f._error}</div>}
                  </td>
                  <td className="px-2 py-1.5">
                    <Selector
                      value={f.categoria}
                      onChange={(e) => cambiarYGuardar(f._clave, { categoria: e.target.value as Fila["categoria"] })}
                      className="w-36"
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c.valor} value={c.valor}>{c.texto}</option>
                      ))}
                    </Selector>
                  </td>
                  <td className="px-2 py-1.5">
                    <Selector
                      value={f.proveedor_id ?? ""}
                      onChange={(e) => cambiarYGuardar(f._clave, { proveedor_id: e.target.value || null })}
                      className="w-36"
                    >
                      <option value="">—</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </Selector>
                  </td>
                  <td className="px-2 py-1.5">
                    <Selector
                      value={f.moneda}
                      onChange={(e) => cambiarYGuardar(f._clave, { moneda: e.target.value as Fila["moneda"] })}
                      className="w-[4.5rem]"
                    >
                      <option value="USD">USD</option>
                      <option value="GTQ">GTQ</option>
                    </Selector>
                  </td>
                  <td className="px-2 py-1.5">
                    <Selector
                      value={f.unidad}
                      onChange={(e) => cambiarYGuardar(f._clave, { unidad: e.target.value as Fila["unidad"] })}
                      className="w-28"
                    >
                      {UNIDADES.map((u) => (
                        <option key={u.valor} value={u.valor}>{u.texto}</option>
                      ))}
                    </Selector>
                  </td>
                  <td className="px-2 py-1.5">
                    <Entrada
                      type="number" step="0.01" min={0}
                      value={f.costo}
                      onChange={(e) => actualizar(f._clave, { costo: Number(e.target.value) })}
                      onBlur={() => guardar(f._clave)}
                      className="w-28"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Selector
                      value={f.tipo_margen}
                      onChange={(e) => cambiarYGuardar(f._clave, { tipo_margen: e.target.value as Fila["tipo_margen"] })}
                      className="w-32"
                    >
                      {TIPOS_MARGEN.map((t) => (
                        <option key={t.valor} value={t.valor}>{t.corto}</option>
                      ))}
                    </Selector>
                  </td>
                  <td className="px-2 py-1.5">
                    <Entrada
                      type="number" step="0.01" min={0}
                      value={f.valor_margen}
                      onChange={(e) => actualizar(f._clave, { valor_margen: Number(e.target.value) })}
                      onBlur={() => guardar(f._clave)}
                      className="w-24"
                    />
                  </td>
                  <td className="num px-2 py-1.5 text-right font-medium whitespace-nowrap">
                    {formatoMoneda(venta, f.moneda)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Casilla checked={f.aplica_iva} onChange={(e) => cambiarYGuardar(f._clave, { aplica_iva: e.target.checked })} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Casilla checked={f.activo} onChange={(e) => cambiarYGuardar(f._clave, { activo: e.target.checked })} />
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <span className="mr-1 inline-block w-16 text-right text-xs text-muted-foreground">
                      {f._estado === "guardando" && "Guardando…"}
                      {f._estado === "guardado" && "Guardado"}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={() => borrar(f)} title="Borrar (solo si no se ha usado)">
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Los cambios se guardan solos al salir de cada celda. La columna <strong>Venta</strong> muestra el precio por 1 unidad con el margen actual.
        Un concepto que ya se usó en cotizaciones no se puede borrar: desactívalo.
      </p>
    </div>
  );
}
