"use client";
import { useEffect, useRef, useState, useTransition } from "react";

export type EstadoFila = "guardando" | "guardado" | "error";
export type Fila<T> = T & { _clave: string; _estado?: EstadoFila; _error?: string };

/**
 * Estado compartido de una tabla editable estilo hoja de cálculo: cada celda edita la fila local,
 * y al salir de la celda (o cambiar un select/casilla) se guarda con el estado más reciente.
 */
export function useFilasEditables<T extends { id?: string }>(
  iniciales: Fila<T>[],
  guardarFn: (datos: T) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>,
  esValida: (f: T) => boolean = () => true,
) {
  const [filas, setFilas] = useState<Fila<T>[]>(iniciales);
  const [, startTransition] = useTransition();
  const ref = useRef(filas);
  useEffect(() => {
    ref.current = filas;
  }, [filas]);

  const actualizar = (clave: string, cambios: Partial<Fila<T>>) =>
    setFilas((fs) => fs.map((f) => (f._clave === clave ? { ...f, ...cambios } : f)));

  /** Aplica cambios (si hay) y guarda la fila. */
  const guardar = (clave: string, cambios: Partial<Fila<T>> = {}) => {
    const actual = ref.current.find((f) => f._clave === clave);
    if (!actual) return;
    const fila = { ...actual, ...cambios } as Fila<T>;
    if (!esValida(fila)) {
      actualizar(clave, cambios);
      return;
    }
    actualizar(clave, { ...cambios, _estado: "guardando" } as Partial<Fila<T>>);
    startTransition(async () => {
      const { _clave, _estado, _error, ...datos } = fila;
      void _clave; void _estado; void _error;
      const r = await guardarFn(datos as unknown as T);
      actualizar(
        clave,
        (r.ok ? { id: r.id ?? fila.id, _estado: "guardado", _error: undefined } : { _estado: "error", _error: r.error }) as Partial<Fila<T>>,
      );
    });
  };

  const agregar = (nueva: Fila<T>) => setFilas((fs) => [nueva, ...fs]);
  const quitar = (clave: string) => setFilas((fs) => fs.filter((f) => f._clave !== clave));

  return { filas, actualizar, guardar, agregar, quitar, setFilas };
}

let contador = 0;
export const claveNueva = () => `nuevo-${Date.now()}-${contador++}`;
