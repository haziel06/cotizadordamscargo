"use client";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Entrada, Selector } from "@/components/Campos";
import { TIPOS_MARGEN } from "@/lib/etiquetas";
import type { Config } from "@/lib/config";
import type { Perfil } from "@/lib/config";
import { EditorNotas } from "@/components/EditorNotas";
import { guardarDefaults, guardarEmpresa, guardarPerfil, guardarRecargos, guardarTextosLegales, quitarImagenEmpresa, subirLogo, subirSello } from "@/lib/config-acciones";

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

/* ---------- Subir imagen (logo / sello) ---------- */
function SubirImagen({ titulo, ayuda, url, subir, campo, onChange }: {
  titulo: string; ayuda: string; url: string | null;
  subir: (fd: FormData) => Promise<{ ok: boolean; error?: string; logo_url?: string | null }>;
  campo: "logo_url" | "sello_url";
  onChange: (u: string | null) => void;
}) {
  const { pendiente, msg, correr } = useGuardar();
  const archivo = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex h-24 w-72 items-center justify-center rounded border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={titulo} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="px-2 text-center text-xs text-muted-foreground">{ayuda}</span>
        )}
      </div>
      <div className="space-y-2 text-sm">
        <div className="font-medium">{titulo}</div>
        <input ref={archivo} type="file" accept="image/png,image/svg+xml,image/jpeg" className="block text-sm" />
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={pendiente} onClick={() => {
            const f = archivo.current?.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.set("archivo", f);
            correr(async () => { const r = await subir(fd); if (r.ok) onChange(r.logo_url ?? null); return r; });
          }}>
            Subir
          </Button>
          {url && (
            <Button size="sm" variant="ghost" disabled={pendiente}
              onClick={() => correr(async () => { const r = await quitarImagenEmpresa(campo); if (r.ok) onChange(null); return r; })}>
              Quitar
            </Button>
          )}
          <Estado msg={msg} />
        </div>
        <p className="text-xs text-muted-foreground">PNG, SVG o JPG, máximo 2 MB.</p>
      </div>
    </div>
  );
}

/* ---------- Empresa + logo + sello ---------- */
export function FormEmpresa({ empresa }: { empresa: Config["empresa"] }) {
  const [e, setE] = useState(empresa);
  const [logo, setLogo] = useState(empresa.logo_url);
  const [sello, setSello] = useState(empresa.sello_url);
  const { pendiente, msg, correr } = useGuardar();
  const set = (k: keyof typeof e) => (ev: React.ChangeEvent<HTMLInputElement>) => setE({ ...e, [k]: ev.target.value });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de la empresa</CardTitle>
        <CardDescription>Salen en el encabezado, el sello y el pie del PDF que recibe el cliente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SubirImagen titulo="Logo" ayuda="Sin logo: el PDF mostrará el nombre en texto" url={logo} subir={subirLogo} campo="logo_url" onChange={setLogo} />
        <SubirImagen titulo="Sello" ayuda="Sin imagen: el PDF dibuja un sello con la razón social, dirección y PBX" url={sello} subir={subirSello} campo="sello_url" onChange={setSello} />

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
          <Button disabled={pendiente} onClick={() => correr(() => { const { logo_url: _l, sello_url: _s, ...datos } = e; void _l; void _s; return guardarEmpresa(datos); })}>
            Guardar datos
          </Button>
          <Estado msg={msg} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Perfil de quien cotiza (firma del PDF) ---------- */
export function FormPerfil({ perfil, correoSesion }: { perfil: Perfil; correoSesion: string }) {
  const [p, setP] = useState({ ...perfil, correo: perfil.correo || correoSesion });
  const { pendiente, msg, correr } = useGuardar();
  const set = (k: keyof Perfil) => (ev: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: ev.target.value });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi firma</CardTitle>
        <CardDescription>Aparece al pie de las cotizaciones que tú crees. Cada usuario tiene la suya.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Campo etiqueta="Nombre"><Entrada value={p.nombre} onChange={set("nombre")} placeholder="Jose Martinez" /></Campo>
          <Campo etiqueta="Cargo"><Entrada value={p.cargo} onChange={set("cargo")} placeholder="Pricing DAMS Cargo" /></Campo>
          <Campo etiqueta="Correo"><Entrada value={p.correo} onChange={set("correo")} /></Campo>
          <Campo etiqueta="Teléfono"><Entrada value={p.telefono} onChange={set("telefono")} placeholder="4115-5716" /></Campo>
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={pendiente} onClick={() => correr(() => guardarPerfil(p))}>Guardar firma</Button>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Textos legales del PDF</CardTitle>
        <CardDescription>Una viñeta por línea. Puedes poner negrita, subrayado o resaltado amarillo. Se imprimen al pie de cada cotización.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Campo etiqueta="Notas">
          <EditorNotas valor={notas} onChange={setNotas} filas={12} />
        </Campo>
        <Campo etiqueta="Corre por cuenta del cliente lo siguiente">
          <EditorNotas valor={cuenta} onChange={setCuenta} filas={4} />
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

/* ---------- Impuestos sobre costo de proveedor extranjero ---------- */
export function FormRecargos({ recargos }: { recargos: Config["recargos"] }) {
  const [r, setR] = useState(recargos);
  const { pendiente, msg, correr } = useGuardar();
  const factor = (1 + r.isr_pct / 100) * (1 + r.no_domiciliada_pct / 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Impuestos sobre costo de proveedor</CardTitle>
        <CardDescription>
          Se aplican sobre el costo de proveedores extranjeros antes del margen: venta = costo × (1 + ISR) × (1 + no domiciliada) × (1 + margen).
          Cada concepto tiene un interruptor «Imp.» para activarlos o no.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Campo etiqueta="ISR (%)">
            <Entrada type="number" step="0.001" min={0} value={r.isr_pct} onChange={(ev) => setR({ ...r, isr_pct: Number(ev.target.value) })} />
          </Campo>
          <Campo etiqueta="Empresa no domiciliada (%)">
            <Entrada type="number" step="0.001" min={0} value={r.no_domiciliada_pct} onChange={(ev) => setR({ ...r, no_domiciliada_pct: Number(ev.target.value) })} />
          </Campo>
          <div className="md:col-span-2 self-end text-sm text-muted-foreground">
            Ejemplo: costo $1.35 → <strong className="num text-foreground">${(1.35 * factor).toFixed(4)}</strong> antes del margen; con 40% → <strong className="num text-foreground">${(1.35 * factor * 1.4).toFixed(2)}</strong>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={pendiente} onClick={() => correr(() => guardarRecargos(r))}>Guardar impuestos</Button>
          <Estado msg={msg} />
        </div>
      </CardContent>
    </Card>
  );
}
