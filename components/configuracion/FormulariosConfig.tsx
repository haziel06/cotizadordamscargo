"use client";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Entrada, Selector } from "@/components/Campos";
import { TIPOS_MARGEN } from "@/lib/etiquetas";
import type { Config } from "@/lib/config";
import { guardarDefaults, guardarEmpresa, guardarTextosLegales, quitarLogo, subirLogo } from "@/lib/config-acciones";

function useGuardar() {
  const [pendiente, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, texto: "Guardado" } : { ok: false, texto: r.error ?? "Error" });
      setTimeout(() => setMsg(null), 3000);
    });
  return { pendiente, msg, correr };
}

function Estado({ msg }: { msg: { ok: boolean; texto: string } | null }) {
  if (!msg) return null;
  return <span className={msg.ok ? "text-sm text-verde" : "text-sm text-destructive"}>{msg.texto}</span>;
}

/* ---------- Empresa + logo ---------- */
export function FormEmpresa({ empresa }: { empresa: Config["empresa"] }) {
  const [e, setE] = useState(empresa);
  const [logo, setLogo] = useState(empresa.logo_url);
  const { pendiente, msg, correr } = useGuardar();
  const archivo = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof e) => (ev: React.ChangeEvent<HTMLInputElement>) => setE({ ...e, [k]: ev.target.value });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de la empresa</CardTitle>
        <CardDescription>Salen en el encabezado del PDF que recibe el cliente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex h-24 w-72 items-center justify-center rounded border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-sm text-muted-foreground">Sin logo: el PDF mostrará el nombre en texto</span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <input ref={archivo} type="file" accept="image/png,image/svg+xml" className="block text-sm" />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pendiente}
                onClick={() => {
                  const f = archivo.current?.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.set("logo", f);
                  correr(async () => {
                    const r = await subirLogo(fd);
                    if (r.ok) setLogo(r.logo_url ?? null);
                    return r;
                  });
                }}
              >
                Subir logo
              </Button>
              {logo && (
                <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => correr(async () => { const r = await quitarLogo(); if (r.ok) setLogo(null); return r; })}>
                  Quitar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG o SVG con fondo transparente, máximo 2 MB. En el PDF va arriba a la izquierda con 55 px de alto.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Campo etiqueta="Razón social"><Entrada value={e.razon_social} onChange={set("razon_social")} /></Campo>
          <Campo etiqueta="Nombre comercial"><Entrada value={e.nombre_comercial} onChange={set("nombre_comercial")} /></Campo>
          <Campo etiqueta="Eslogan"><Entrada value={e.eslogan} onChange={set("eslogan")} /></Campo>
          <Campo etiqueta="NIT"><Entrada value={e.nit} onChange={set("nit")} /></Campo>
          <Campo etiqueta="Dirección" className="md:col-span-2"><Entrada value={e.direccion} onChange={set("direccion")} /></Campo>
          <Campo etiqueta="Ciudad / código postal" className="md:col-span-2"><Entrada value={e.ciudad} onChange={set("ciudad")} /></Campo>
          <Campo etiqueta="PBX"><Entrada value={e.pbx} onChange={set("pbx")} /></Campo>
          <Campo etiqueta="Sitio web"><Entrada value={e.web} onChange={set("web")} /></Campo>
          <Campo etiqueta="Correo"><Entrada value={e.correo} onChange={set("correo")} /></Campo>
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={pendiente} onClick={() => correr(() => { const { logo_url: _l, ...datos } = e; void _l; return guardarEmpresa(datos); })}>
            Guardar datos
          </Button>
          <Estado msg={msg} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Textos legales ---------- */
export function FormTextos({ textos }: { textos: Config["textos_legales"] }) {
  const [notas, setNotas] = useState(textos.notas.join("\n"));
  const [cuenta, setCuenta] = useState(textos.cuenta_cliente.join("\n"));
  const { pendiente, msg, correr } = useGuardar();
  const area = "min-h-40 w-full rounded border border-input bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-ring/30";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Textos legales del PDF</CardTitle>
        <CardDescription>Una viñeta por línea. Se imprimen al pie de cada cotización.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Campo etiqueta="Notas">
          <textarea className={area} value={notas} onChange={(ev) => setNotas(ev.target.value)} />
        </Campo>
        <Campo etiqueta="Corre por cuenta del cliente lo siguiente">
          <textarea className={`${area} min-h-24`} value={cuenta} onChange={(ev) => setCuenta(ev.target.value)} />
        </Campo>
        <div className="flex items-center gap-3">
          <Button disabled={pendiente} onClick={() => correr(() => guardarTextosLegales({ notas: notas.split("\n"), cuenta_cliente: cuenta.split("\n") }))}>
            Guardar textos
          </Button>
          <Estado msg={msg} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Valores por defecto ---------- */
export function FormDefaults({ defaults }: { defaults: Config["defaults"] }) {
  const [d, setD] = useState(defaults);
  const { pendiente, msg, correr } = useGuardar();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Valores por defecto</CardTitle>
        <CardDescription>Se cargan al crear una cotización nueva; cada cotización los puede cambiar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Campo etiqueta="Tipo de cambio (Q por USD)">
            <Entrada type="number" step="0.01" value={d.tipo_cambio} onChange={(ev) => setD({ ...d, tipo_cambio: Number(ev.target.value) })} />
          </Campo>
          <Campo etiqueta="Días de vigencia">
            <Entrada type="number" min={1} value={d.dias_vigencia} onChange={(ev) => setD({ ...d, dias_vigencia: Number(ev.target.value) })} />
          </Campo>
          <Campo etiqueta="Margen por defecto (líneas manuales)">
            <Selector value={d.margen_default.tipo} onChange={(ev) => setD({ ...d, margen_default: { ...d.margen_default, tipo: ev.target.value as typeof d.margen_default.tipo } })}>
              {TIPOS_MARGEN.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Valor del margen">
            <Entrada type="number" step="0.01" value={d.margen_default.valor} onChange={(ev) => setD({ ...d, margen_default: { ...d.margen_default, valor: Number(ev.target.value) } })} />
          </Campo>
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={pendiente} onClick={() => correr(() => guardarDefaults(d))}>Guardar valores</Button>
          <Estado msg={msg} />
        </div>
      </CardContent>
    </Card>
  );
}
