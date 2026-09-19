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

/** Sube PNG/SVG/JPG al bucket público `config` y guarda la URL en empresa.<campo>. */
async function subirImagenEmpresa(form: FormData, campo: "logo_url" | "sello_url", nombreBase: string): Promise<Resultado> {
  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige un archivo." };
  const tipos: Record<string, string> = { "image/png": "png", "image/svg+xml": "svg", "image/jpeg": "jpg" };
  const ext = tipos[archivo.type];
  if (!ext) return { ok: false, error: "Solo PNG, SVG o JPG." };
  if (archivo.size > 2 * 1024 * 1024) return { ok: false, error: "La imagen no debe pesar más de 2 MB." };

  const supabase = await crearClienteServidor();
  const ruta = `${nombreBase}.${ext}`;
  const { error } = await supabase.storage.from("config").upload(ruta, archivo, { upsert: true, contentType: archivo.type });
  if (error) return { ok: false, error: "No se pudo subir la imagen." };

  // Sufijo de versión para que el PDF y la vista previa no usen una copia en caché.
  const { data } = supabase.storage.from("config").getPublicUrl(ruta);
  const url = `${data.publicUrl}?v=${Date.now()}`;
  const actual = await leerConfig();
  const r = await guardarClave("empresa", { ...actual.empresa, [campo]: url });
  return r.ok ? { ok: true, logo_url: url } : r;
}

export async function subirLogo(form: FormData): Promise<Resultado> {
  return subirImagenEmpresa(form, "logo_url", "logo");
}
export async function subirSello(form: FormData): Promise<Resultado> {
  return subirImagenEmpresa(form, "sello_url", "sello");
}

export async function quitarImagenEmpresa(campo: "logo_url" | "sello_url"): Promise<Resultado> {
  const actual = await leerConfig();
  const r = await guardarClave("empresa", { ...actual.empresa, [campo]: null });
  return r.ok ? { ok: true, logo_url: null } : r;
}

const esquemaPerfil = z.object({
  nombre: z.string().trim(),
  cargo: z.string().trim(),
  correo: z.string().trim(),
  telefono: z.string().trim(),
});
/** Firma de quien cotiza (va al pie del PDF). Cada usuario edita solo la suya. */
export async function guardarPerfil(datos: z.infer<typeof esquemaPerfil>): Promise<Resultado> {
  const parsed = esquemaPerfil.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "Revisa los datos." };
  const supabase = await crearClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sesión vencida." };
  const { error } = await supabase.from("perfiles").upsert({ user_id: auth.user.id, ...parsed.data });
  if (error) return { ok: false, error: "No se pudo guardar el perfil." };
  revalidatePath("/configuracion");
  return { ok: true };
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

const esquemaRecargos = z.object({
  isr_pct: z.coerce.number().min(0).max(100),
  no_domiciliada_pct: z.coerce.number().min(0).max(100),
});
/** ISR y "no domiciliada" que se cargan sobre costos de proveedores extranjeros antes del margen. */
export async function guardarRecargos(datos: z.infer<typeof esquemaRecargos>): Promise<Resultado> {
  const parsed = esquemaRecargos.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "Revisa los porcentajes." };
  return guardarClave("recargos", parsed.data);
}
