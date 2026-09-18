import { crearClienteServidor } from "@/lib/supabase/server";
import type { TipoMargen } from "@/lib/calculo/tipos";

export interface Empresa {
  razon_social: string;
  nombre_comercial: string;
  eslogan: string;
  direccion: string;
  ciudad: string;
  nit: string;
  pbx: string;
  web: string;
  correo: string;
  logo_url: string | null;
  /** Imagen del sello escaneado. Si es null, el PDF dibuja un sello vectorial con los datos de la empresa. */
  sello_url: string | null;
}
export interface TextosLegales {
  notas: string[];
  cuenta_cliente: string[];
}
export interface Defaults {
  tipo_cambio: number;
  dias_vigencia: number;
  margen_default: { tipo: TipoMargen; valor: number };
}
export interface Config {
  empresa: Empresa;
  textos_legales: TextosLegales;
  defaults: Defaults;
}

/** Valores de respaldo si la tabla config está vacía (spec §8.2, §8.5, §5.5). */
export const CONFIG_DEFAULT: Config = {
  empresa: {
    razon_social: "Agencia Nacional de Carga, S.A.",
    nombre_comercial: "Dams Cargo",
    eslogan: "Aduanas & Logística",
    direccion: "12 calle 2-04 zona 9, Edificio Plaza del Sol, 3er Nivel, Oficina 315",
    ciudad: "Guatemala, Guatemala. Código Postal 01009",
    nit: "54820510",
    pbx: "2225-5400",
    web: "www.damscargo.com",
    correo: "info@damscargo.com",
    logo_url: null,
    sello_url: null,
  },
  textos_legales: {
    notas: [
      "Datos en $ no incluyen IVA",
      "Datos en Q sí incluyen IVA",
      "Se trabaja en base a datos brindados por el cliente",
      "No incluye almacenajes, demoras y sobrepeso",
      "No incluye seguro de mercadería, en caso requerido podemos cotizar",
      "La cotización no es para carga IMO, no aceite, no marca o copia, no baterías, no motores",
      "No incluye pago de impuestos (cliente paga directo a la SAT)",
      "No incluye almacenaje (cliente paga directo a PUERTO o ALMACENADORA)",
      "No incluye estadías ni revisiones por autoridades en puertos",
      "Salidas sujetas a disponibilidad de espacios con la naviera",
    ],
    cuenta_cliente: ["Permisos especiales, incluyendo gastos fitosanitarios, cuarentena", "Multas por sobrepeso"],
  },
  defaults: { tipo_cambio: 8.05, dias_vigencia: 15, margen_default: { tipo: "porcentaje", valor: 15 } },
};

export async function leerConfig(): Promise<Config> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("config").select("clave, valor");
  const mapa = Object.fromEntries((data ?? []).map((r) => [r.clave, r.valor])) as Partial<Record<keyof Config, unknown>>;
  return {
    empresa: { ...CONFIG_DEFAULT.empresa, ...((mapa.empresa as Partial<Empresa>) ?? {}) },
    textos_legales: { ...CONFIG_DEFAULT.textos_legales, ...((mapa.textos_legales as Partial<TextosLegales>) ?? {}) },
    defaults: { ...CONFIG_DEFAULT.defaults, ...((mapa.defaults as Partial<Defaults>) ?? {}) },
  };
}

export interface Perfil {
  nombre: string;
  cargo: string;
  correo: string;
  telefono: string;
}

/** Perfil (firma del PDF) de un usuario; vacío si nunca lo llenó. */
export async function leerPerfil(userId: string | null | undefined): Promise<Perfil> {
  const vacio: Perfil = { nombre: "", cargo: "", correo: "", telefono: "" };
  if (!userId) return vacio;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("perfiles").select("nombre, cargo, correo, telefono").eq("user_id", userId).maybeSingle();
  return data ?? vacio;
}
