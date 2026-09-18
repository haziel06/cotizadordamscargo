"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Casilla, Entrada, Selector } from "@/components/Campos";
import { TIPOS_PROVEEDOR } from "@/lib/etiquetas";
import type { Proveedor } from "@/lib/supabase/tipos";
import { guardarProveedor, type DatosProveedor } from "@/lib/tarifas/acciones";

type Fila = DatosProveedor & { _clave: string };

const aFila = (p: Proveedor): Fila => ({
  _clave: p.id, id: p.id, nombre: p.nombre, tipo: p.tipo, pais: p.pais, moneda_default: p.moneda_default, activo: p.activo,
});

export function Proveedores({ proveedores }: { proveedores: Proveedor[] }) {
  const [filas, setFilas] = useState<Fila[]>(() => proveedores.map(aFila));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const actualizar = (clave: string, cambios: Partial<Fila>) =>
    setFilas((fs) => fs.map((f) => (f._clave === clave ? { ...f, ...cambios } : f)));

  const guardar = (clave: string, cambios: Partial<Fila> = {}) => {
    setFilas((fs) => {
      const nuevas = fs.map((f) => (f._clave === clave ? { ...f, ...cambios } : f));
      const fila = nuevas.find((f) => f._clave === clave)!;
      if (fila.nombre.trim()) {
        startTransition(async () => {
          const { _clave, ...datos } = fila;
          void _clave;
          const r = await guardarProveedor(datos);
          if (r.ok) setFilas((xs) => xs.map((f) => (f._clave === clave ? { ...f, id: r.id ?? f.id } : f)));
          else setError(r.error);
        });
      }
      return nuevas;
    });
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Proveedores</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Proveedores</DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 font-medium">Nombre</th>
              <th className="py-1 pr-2 font-medium">Tipo</th>
              <th className="py-1 pr-2 font-medium">País</th>
              <th className="py-1 pr-2 font-medium">Moneda</th>
              <th className="py-1 text-center font-medium">Activo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f._clave}>
                <td className="py-1 pr-2">
                  <Entrada value={f.nombre} autoFocus={!f.id} placeholder="Nombre"
                    onChange={(e) => actualizar(f._clave, { nombre: e.target.value })}
                    onBlur={() => guardar(f._clave)} />
                </td>
                <td className="py-1 pr-2">
                  <Selector value={f.tipo} onChange={(e) => guardar(f._clave, { tipo: e.target.value as Fila["tipo"] })}>
                    {TIPOS_PROVEEDOR.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
                  </Selector>
                </td>
                <td className="py-1 pr-2">
                  <Entrada value={f.pais ?? ""} onChange={(e) => actualizar(f._clave, { pais: e.target.value || null })}
                    onBlur={() => guardar(f._clave)} className="w-28" />
                </td>
                <td className="py-1 pr-2">
                  <Selector value={f.moneda_default} className="w-20"
                    onChange={(e) => guardar(f._clave, { moneda_default: e.target.value as Fila["moneda_default"] })}>
                    <option value="USD">USD</option>
                    <option value="GTQ">GTQ</option>
                  </Selector>
                </td>
                <td className="py-1 text-center">
                  <Casilla checked={f.activo} onChange={(e) => guardar(f._clave, { activo: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          variant="outline"
          onClick={() =>
            setFilas((fs) => [
              ...fs,
              { _clave: `nuevo-${Date.now()}`, nombre: "", tipo: "otro", pais: null, moneda_default: "USD", activo: true },
            ])
          }
        >
          Agregar proveedor
        </Button>
      </DialogContent>
    </Dialog>
  );
}
