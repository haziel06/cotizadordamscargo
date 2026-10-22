"use client";
import { useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepararArchivoCliente } from "@/lib/imagen";

const ACEPTADOS_POR_DEFECTO = "application/pdf,image/png,image/jpeg,image/webp";

/** Casilla para adjuntar un PDF/foto: arrastrar y soltar, o clic para elegir del explorador. */
export function ZonaArchivo({ archivo, onArchivo, texto = "Elige o arrastra un PDF, PNG, JPG o WEBP", aceptar = ACEPTADOS_POR_DEFECTO }: { archivo: File | null; onArchivo: (f: File | null) => void; texto?: string; aceptar?: string }) {
  const [sobre, setSobre] = useState(false);

  const soltar = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setSobre(false);
    const f = e.dataTransfer.files?.[0];
    if (f) prepararArchivoCliente(f).then(onArchivo);
  };

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors hover:bg-muted/50",
        sobre && "border-primary bg-primary/5",
      )}
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
      onDragLeave={() => setSobre(false)}
      onDrop={soltar}
    >
      <Upload className={cn("size-5 text-muted-foreground", sobre && "text-primary")} />
      <span>{archivo ? archivo.name : sobre ? "Suelta el archivo aquí" : texto}</span>
      <input type="file" accept={aceptar} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) prepararArchivoCliente(f).then(onArchivo); else onArchivo(null); }} />
    </label>
  );
}
