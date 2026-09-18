// Generado a partir del esquema de Supabase (proyecto skwucjiiatqxvtozexpm).
// Regenerar con el MCP de Supabase (generate_typescript_types) tras cambiar el esquema.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enums = {
  categoria_concepto: "internacional" | "local" | "naviera";
  estado_cotizacion: "borrador" | "enviada" | "aceptada" | "rechazada" | "vencida";
  moneda: "USD" | "GTQ";
  tipo_margen: "porcentaje" | "monto_fijo" | "precio_fijo";
  tipo_proveedor: "naviera" | "agente_origen" | "transportista" | "courier" | "almacenadora" | "custodio" | "otro";
  unidad_concepto: "envio" | "contenedor" | "kg" | "cbm" | "libra";
};

type ClienteRow = {
  id: string; nombre: string; nit: string | null; contacto_nombre: string | null;
  contacto_email: string | null; contacto_telefono: string | null; notas: string | null;
  activo: boolean; created_at: string;
};
type ConceptoRow = {
  id: string; proveedor_id: string | null; nombre: string; categoria: Enums["categoria_concepto"];
  moneda: Enums["moneda"]; unidad: Enums["unidad_concepto"]; costo: number; tipo_margen: Enums["tipo_margen"];
  valor_margen: number; aplica_iva: boolean; orden: number; activo: boolean; notas: string | null;
  created_at: string; updated_at: string;
};
type ConfigRow = { clave: string; valor: Json; updated_at: string };
type CorrelativoRow = { anio: number; ultimo: number };
type LineaRow = {
  id: string; cotizacion_id: string; concepto_id: string | null; nombre: string;
  categoria: Enums["categoria_concepto"]; moneda: Enums["moneda"]; cantidad: number; costo_unitario: number;
  tipo_margen: Enums["tipo_margen"]; valor_margen: number; lleva_iva: boolean; venta_total: number; orden: number;
};
type CotizacionRow = {
  id: string; numero: string; cliente_id: string | null; cliente_nombre: string; contacto: string | null;
  fecha: string; dias_vigencia: number; tipo_carga: string | null; kilogramos: number | null;
  kg_volumetricos: number | null; cbm: number | null; bultos: number | null; medidas: string | null;
  mercaderia: string | null; origen: string | null; destino: string; transito: string | null;
  routing: string | null; tipo_cambio: number; estado: Enums["estado_cotizacion"]; total_usd: number;
  total_gtq: number; costo_total_gtq: number; utilidad_gtq: number; margen_pct: number;
  notas_internas: string | null; created_at: string; updated_at: string;
};
type ProveedorRow = {
  id: string; nombre: string; tipo: Enums["tipo_proveedor"]; pais: string | null;
  moneda_default: Enums["moneda"]; notas: string | null; activo: boolean; created_at: string;
};

type Tabla<Row, Requeridas extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Requeridas> & Partial<Omit<Row, Requeridas>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      clientes: Tabla<ClienteRow, "nombre">;
      conceptos: Tabla<ConceptoRow, "nombre" | "categoria" | "moneda">;
      config: Tabla<ConfigRow, "clave" | "valor">;
      correlativos: Tabla<CorrelativoRow, "anio">;
      cotizacion_lineas: Tabla<LineaRow, "cotizacion_id" | "nombre" | "categoria" | "moneda" | "tipo_margen">;
      cotizaciones: Tabla<CotizacionRow, "numero" | "cliente_nombre" | "tipo_cambio">;
      proveedores: Tabla<ProveedorRow, "nombre">;
    };
    Views: { [_ in never]: never };
    Functions: { siguiente_numero_cotizacion: { Args: Record<string, never>; Returns: string } };
    Enums: Enums;
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];

export type Concepto = Tables<"conceptos">;
export type Proveedor = Tables<"proveedores">;
export type Cliente = Tables<"clientes">;
export type Cotizacion = Tables<"cotizaciones">;
export type CotizacionLinea = Tables<"cotizacion_lineas">;
