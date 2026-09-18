import { leerConfig } from "@/lib/config";
import { FormDefaults, FormEmpresa, FormTextos } from "@/components/configuracion/FormulariosConfig";

export default async function PaginaConfiguracion() {
  const config = await leerConfig();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Configuración</h1>
        <p className="text-sm text-muted-foreground">Datos de la empresa, logo, textos legales y valores por defecto.</p>
      </div>
      <FormEmpresa empresa={config.empresa} />
      <FormDefaults defaults={config.defaults} />
      <FormTextos textos={config.textos_legales} />
      <p className="text-xs text-muted-foreground">
        Usuarios: se crean desde el panel de Supabase (Authentication → Users). No hay registro público.
      </p>
    </div>
  );
}
