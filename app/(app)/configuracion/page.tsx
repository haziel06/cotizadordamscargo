import { leerConfig, leerPerfil } from "@/lib/config";
import { sesionRequerida } from "@/lib/sesion";
import { FormDefaults, FormEmpresa, FormPerfil, FormRecargos, FormTextos } from "@/components/configuracion/FormulariosConfig";
import { FormClaveAdmin } from "@/components/configuracion/FormClaveAdmin";

export default async function PaginaConfiguracion() {
  const sesion = await sesionRequerida();
  const [config, perfil] = await Promise.all([leerConfig(), leerPerfil(sesion.userId)]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          {sesion.esAdmin ? "Tu firma, datos de la empresa, logo y sello, textos legales, fórmula y valores por defecto." : "Tu firma para el PDF."}
        </p>
      </div>
      <FormPerfil perfil={perfil} correoSesion={sesion.email} />
      {sesion.esAdmin ? (
        <>
          <FormEmpresa empresa={config.empresa} />
          <FormDefaults defaults={config.defaults} />
          <FormRecargos recargos={config.recargos} />
          <FormTextos textos={config.textos_legales} />
        </>
      ) : (
        <FormClaveAdmin />
      )}
    </div>
  );
}
