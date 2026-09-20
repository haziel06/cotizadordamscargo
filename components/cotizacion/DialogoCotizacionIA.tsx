"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { extraerCabeceraIA } from "@/lib/ia/cotizacionAcciones";

/** Punto de partida con IA: describes el envío y/o subes un documento (pedido, factura, foto), y llega precargado al editor para que tú termines de elegir tarifas y confirmar. */
export function DialogoCotizacionIA() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const extraer = () => {
    if (!descripcion.trim() && !archivo) return setError("Describe el envío o adjunta un documento.");
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("descripcion", descripcion);
      if (archivo) form.set("archivo", archivo);
      const r = await extraerCabeceraIA(form);
      if (!r.ok) return setError(r.error);
      const d = r.datos;
      const qs = new URLSearchParams({ tipos: d.tipo_servicio_sugerido ?? "" });
      const pon = (k: string, v: string | number | null) => { if (v !== null && v !== "" && v !== 0) qs.set(k, String(v)); };
      pon("cliente_nombre", d.cliente_nombre);
      pon("contacto", d.contacto);
      pon("telefono", d.telefono);
      pon("origen", d.origen);
      pon("destino", d.destino);
      pon("tipo_carga", d.tipo_carga);
      pon("kilogramos", d.kilogramos);
      pon("bultos", d.bultos);
      pon("medidas", d.medidas);
      pon("mercaderia", d.mercaderia);
      pon("valor_mercaderia", d.valor_mercaderia);
      pon("notas_internas", d.notas_internas);
      qs.set("ia", "1");
      setAbierto(false);
      router.push(`/cotizaciones/nueva?${qs.toString()}`);
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger nativeButton={false} render={<span className="inline-flex" />}>
        <Button variant="outline"><Sparkles /> Crear con IA</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear cotización con IA</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Cuéntame qué necesitas cotizar, o sube el documento del cliente (pedido, factura, packing list, una foto). Llegarás al editor con los datos precargados — tú eliges las tarifas y confirmas antes de guardar.</p>
        <textarea
          className="min-h-24 w-full rounded border border-input bg-white p-2 text-sm"
          placeholder="Ej.: Envío de Amazon para María Pérez, 5 libras, de Miami a Guatemala, valor declarado $60…"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed p-3 text-sm hover:bg-muted/50">
          <Upload className="size-4 text-muted-foreground" />
          {archivo ? archivo.name : "Adjuntar documento (opcional)"}
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button onClick={extraer} disabled={pendiente}>{pendiente ? "Leyendo…" : "Continuar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
