import { leerConfig, leerPerfil } from "@/lib/config";
import { usuarioRequerido } from "@/lib/supabase/server";
import { FormDefaults, FormEmpresa, FormPerfil, FormRecargos, FormTextos } from "@/components/configuracion/FormulariosConfig";

export default async function PaginaConfiguracion() {
  const { usuario } = await usuarioRequerido();
  const [config, perfil] = await Promise.all([leerConfig(), leerPerfil(usuario?.id)]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Configuración</h1>
        <p className="text-sm text-muted-foreground">Tu firma, datos de la empresa, logo y sello, textos legales y valores por defecto.</p>
      </div>
      <FormPerfil perfil={perfil} correoSesion={usuario?.email ?? ""} />
      <FormEmpresa empresa={config.empresa} />
      <FormDefaults defaults={config.defaults} />
      <FormRecargos recargos={config.recargos} />
      <FormTextos textos={config.textos_legales} />
      <p className="text-xs text-muted-foreground">
        Usuarios: se crean desde el panel de Supabase (Authentication → Users). No hay registro público.
      </p>
    </div>
  );
}
