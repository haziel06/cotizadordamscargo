"use client";
import { useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const ACEPTADOS = "application/pdf,image/png,image/jpeg,image/webp";

/** Casilla para adjuntar un PDF/foto: arrastrar y soltar, o clic para elegir del explorador. */
export function ZonaArchivo({ archivo, onArchivo, texto = "Elige o arrastra un PDF, PNG, JPG o WEBP" }: { archivo: File | null; onArchivo: (f: File | null) => void; texto?: string }) {
  const [sobre, setSobre] = useState(false);

  const soltar = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setSobre(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onArchivo(f);
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
      <input type="file" accept={ACEPTADOS} className="hidden" onChange={(e) => onArchivo(e.target.files?.[0] ?? null)} />
    </label>
  );
}
