import { leerConfig, leerPerfil } from "@/lib/config";
import { sesionRequerida } from "@/lib/sesion";
import { FormDefaults, FormEmpresa, FormPerfil, FormRecargos, FormTextos } from "@/components/configuracion/FormulariosConfig";
import { FormClaveAdmin } from "@/components/configuracion/FormClaveAdmin";
import { FormContrasena } from "@/components/configuracion/FormContrasena";
import { DescargarResumen } from "@/components/configuracion/DescargarResumen";
import { UsoIA } from "@/components/configuracion/UsoIA";
import { resumenUsoIA } from "@/lib/ia/uso";

export default async function PaginaConfiguracion() {
  const sesion = await sesionRequerida();
  const [config, perfil, usoIA] = await Promise.all([leerConfig(), leerPerfil(sesion.userId), sesion.esAdmin ? resumenUsoIA() : Promise.resolve(null)]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          {sesion.esAdmin ? "Tu firma, datos de la empresa, logo y sello, textos legales, fórmula y valores por defecto." : "Tu firma para el PDF."}
        </p>
      </div>
      <FormPerfil perfil={perfil} correoSesion={sesion.email} />
      <FormContrasena />
      <DescargarResumen userId={sesion.userId} titulo="Mi actividad" descripcion="Tus cotizaciones y métricas, para guardar o compartir." />
      {sesion.esAdmin && usoIA ? <UsoIA resumen={usoIA} /> : null}
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
