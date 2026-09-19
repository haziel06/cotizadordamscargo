// Generado a partir del esquema de Supabase (proyecto skwucjiiatqxvtozexpm).
// Regenerar con el MCP de Supabase (generate_typescript_types) tras cambiar el esquema.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enums = {
  categoria_concepto: "internacional" | "local" | "naviera";
  estado_cotizacion: "borrador" | "enviada" | "aceptada" | "rechazada" | "vencida";
  moneda: "USD" | "GTQ";
  tipo_margen: "porcentaje" | "monto_fijo" | "precio_fijo";
  tipo_proveedor: "naviera" | "agente_origen" | "transportista" | "courier" | "almacenadora" | "custodio" | "otro";
  unidad_concepto: "envio" | "contenedor" | "kg" | "cbm" | "libra" | "pie_cubico" | "guia" | "factura";
  tipo_servicio: "maritimo_fcl" | "maritimo_lcl" | "aereo" | "courier" | "terrestre" | "aduanas";
};

type ClienteRow = {
  id: string; nombre: string; nit: string | null; contacto_nombre: string | null;
  contacto_email: string | null; contacto_telefono: string | null; notas: string | null;
  activo: boolean; created_at: string; empresa: string | null;
};
type ConceptoRow = {
  id: string; proveedor_id: string | null; nombre: string; categoria: Enums["categoria_concepto"];
  moneda: Enums["moneda"]; unidad: Enums["unidad_concepto"]; costo: number; tipo_margen: Enums["tipo_margen"];
  valor_margen: number; aplica_iva: boolean; orden: number; activo: boolean; notas: string | null;
  created_at: string; updated_at: string;
  seccion: string; tarifario_id: string | null; aplica_recargos: boolean; minimo: number | null;
  rango_desde: number | null; rango_hasta: number | null; pendiente: boolean; archivado_at: string | null;
  cuenta_ajena: boolean; servicios: Enums["tipo_servicio"][];
};
type TarifarioRow = {
  id: string; nombre: string; proveedor_id: string | null; servicio: Enums["tipo_servicio"] | null; seccion: string;
  origen: string | null; destino: string | null; moneda: Enums["moneda"]; vigencia_desde: string | null; vigencia_hasta: string | null;
  documento_url: string | null; notas: string | null; archivado_at: string | null; creado_por: string | null;
  created_at: string; updated_at: string;
};
type TarifaRutaRow = {
  id: string; tarifario_id: string; pais: string | null; origen: string; destino: string; via: string | null;
  costo: number | null; unidad: Enums["unidad_concepto"]; minimo: number | null; transito: string | null;
  tipo_margen: Enums["tipo_margen"]; valor_margen: number; aplica_recargos: boolean; notas: string | null;
  archivado_at: string | null; created_at: string;
};
type TarifaClienteRow = {
  id: string; cliente_id: string; concepto_id: string; tipo_margen: Enums["tipo_margen"]; valor_margen: number;
  notas: string | null; created_at: string;
};
type ConfigRow = { clave: string; valor: Json; updated_at: string };
type CorrelativoRow = { anio: number; ultimo: number };
type LineaRow = {
  id: string; cotizacion_id: string; concepto_id: string | null; nombre: string;
  categoria: Enums["categoria_concepto"]; moneda: Enums["moneda"]; cantidad: number; costo_unitario: number;
  tipo_margen: Enums["tipo_margen"]; valor_margen: number; lleva_iva: boolean; venta_total: number;
  venta_bruta: number; orden: number;
  aplica_recargos: boolean; nota: string | null; nota_visible: boolean; proveedor_nombre: string | null; ruta: string | null;
  cuenta_ajena: boolean; ruta_id: string | null;
};
type CotizacionRow = {
  id: string; numero: string; cliente_id: string | null; cliente_nombre: string; contacto: string | null;
  fecha: string; dias_vigencia: number; tipo_carga: string | null; kilogramos: number | null;
  kg_volumetricos: number | null; cbm: number | null; bultos: number | null; medidas: string | null;
  mercaderia: string | null; origen: string | null; destino: string; transito: string | null;
  routing: string | null; tipo_cambio: number; estado: Enums["estado_cotizacion"]; total_usd: number;
  total_gtq: number; costo_total_gtq: number; utilidad_gtq: number; margen_pct: number;
  notas_internas: string | null; created_at: string; updated_at: string;
  incoterm: string | null; descuentos: Json; notas: Json | null; creado_por: string | null;
  tipo_servicio: Enums["tipo_servicio"]; tipos_servicio: Enums["tipo_servicio"][];
  cliente_telefono: string | null; segmento_courier: SegmentoCourier | null; valor_mercaderia: number | null;
  consignatario: string | null; direccion_entrega: string | null; fuera_perimetro: boolean;
};
export type SegmentoCourier = "ticket" | "consolidado" | "documentos";
export type Rol = "admin" | "usuario";
type PerfilRow = {
  user_id: string; nombre: string; cargo: string; correo: string; telefono: string;
  created_at: string; updated_at: string; rol: Rol; activo: boolean; email: string;
};
type InvitacionRow = {
  id: string; codigo: string; nota: string; usos_max: number; usos: number; vence_at: string | null;
  activo: boolean; creado_por: string | null; usado_por: Json; created_at: string;
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
      conceptos: Tabla<ConceptoRow, "nombre" | "categoria" | "moneda" | "seccion">;
      config: Tabla<ConfigRow, "clave" | "valor">;
      correlativos: Tabla<CorrelativoRow, "anio">;
      cotizacion_lineas: Tabla<LineaRow, "cotizacion_id" | "nombre" | "categoria" | "moneda" | "tipo_margen">;
      cotizaciones: Tabla<CotizacionRow, "numero" | "cliente_nombre" | "tipo_cambio">;
      proveedores: Tabla<ProveedorRow, "nombre">;
      perfiles: Tabla<PerfilRow, "user_id">;
      invitaciones: Tabla<InvitacionRow, "codigo">;
      tarifarios: Tabla<TarifarioRow, "nombre" | "seccion">;
      tarifas_ruta: Tabla<TarifaRutaRow, "tarifario_id" | "origen">;
      tarifas_cliente: Tabla<TarifaClienteRow, "cliente_id" | "concepto_id" | "tipo_margen" | "valor_margen">;
    };
    Views: { [_ in never]: never };
    Functions: {
      siguiente_numero_cotizacion: { Args: Record<string, never>; Returns: string };
      guardar_cotizacion: { Args: { p_id: string | null; p_cabecera: Json; p_lineas: Json }; Returns: string };
      es_admin: { Args: Record<string, never>; Returns: boolean };
      regenerar_clave_admin: { Args: Record<string, never>; Returns: string };
      canjear_clave_admin: { Args: { p_clave: string }; Returns: boolean };
      cambiar_rol_usuario: { Args: { p_user: string; p_rol: string; p_activo: boolean }; Returns: undefined };
      generar_codigo_invitacion: { Args: Record<string, never>; Returns: string };
      validar_invitacion: { Args: { p_codigo: string }; Returns: boolean };
    };
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
export type Perfil = Tables<"perfiles">;
export type Tarifario = Tables<"tarifarios">;
export type TarifaRuta = Tables<"tarifas_ruta">;
export type TarifaCliente = Tables<"tarifas_cliente">;
export type TipoServicio = Enums["tipo_servicio"];
export type Invitacion = Tables<"invitaciones">;
