"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { leerConfig } from "@/lib/config";

type Resultado = { ok: true; logo_url?: string | null } | { ok: false; error: string };

const esquemaEmpresa = z.object({
  razon_social: z.string().trim().min(1),
  nombre_comercial: z.string().trim().min(1),
  eslogan: z.string().trim(),
  direccion: z.string().trim(),
  ciudad: z.string().trim(),
  nit: z.string().trim(),
  pbx: z.string().trim(),
  web: z.string().trim(),
  correo: z.string().trim(),
});

async function guardarClave(clave: string, valor: unknown): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("config").upsert({ clave, valor: valor as never });
  if (error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function guardarEmpresa(datos: z.infer<typeof esquemaEmpresa>): Promise<Resultado> {
  const parsed = esquemaEmpresa.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "Revisa los datos de la empresa." };
  const actual = await leerConfig();
  return guardarClave("empresa", { ...actual.empresa, ...parsed.data });
}

/** Sube PNG o SVG al bucket público `config` y guarda la URL. */
export async function subirLogo(form: FormData): Promise<Resultado> {
  const archivo = form.get("logo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige un archivo." };
  if (!["image/png", "image/svg+xml"].includes(archivo.type)) return { ok: false, error: "Solo PNG o SVG con fondo transparente." };
  if (archivo.size > 2 * 1024 * 1024) return { ok: false, error: "El logo no debe pesar más de 2 MB." };

  const supabase = await crearClienteServidor();
  const ext = archivo.type === "image/png" ? "png" : "svg";
  const ruta = `logo.${ext}`;
  const { error } = await supabase.storage.from("config").upload(ruta, archivo, { upsert: true, contentType: archivo.type });
  if (error) return { ok: false, error: "No se pudo subir el logo." };

  // Sufijo de versión para que el PDF y la vista previa no usen una copia en caché.
  const { data } = supabase.storage.from("config").getPublicUrl(ruta);
  const logo_url = `${data.publicUrl}?v=${Date.now()}`;
  const actual = await leerConfig();
  const r = await guardarClave("empresa", { ...actual.empresa, logo_url });
  return r.ok ? { ok: true, logo_url } : r;
}

export async function quitarLogo(): Promise<Resultado> {
  const actual = await leerConfig();
  const r = await guardarClave("empresa", { ...actual.empresa, logo_url: null });
  return r.ok ? { ok: true, logo_url: null } : r;
}

export async function guardarTextosLegales(datos: { notas: string[]; cuenta_cliente: string[] }): Promise<Resultado> {
  const limpiar = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  return guardarClave("textos_legales", { notas: limpiar(datos.notas), cuenta_cliente: limpiar(datos.cuenta_cliente) });
}

const esquemaDefaults = z.object({
  tipo_cambio: z.coerce.number().positive(),
  dias_vigencia: z.coerce.number().int().min(1).max(365),
  margen_default: z.object({ tipo: z.enum(["porcentaje", "monto_fijo", "precio_fijo"]), valor: z.coerce.number().min(0) }),
});
export async function guardarDefaults(datos: z.infer<typeof esquemaDefaults>): Promise<Resultado> {
  const parsed = esquemaDefaults.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "Revisa los valores por defecto." };
  return guardarClave("defaults", parsed.data);
}
