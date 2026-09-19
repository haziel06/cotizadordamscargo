import { PantallaAuth } from "@/components/auth/PantallaAuth";
import { FormularioRegistro } from "./FormularioRegistro";

export default async function PaginaRegistro(props: PageProps<"/registro">) {
  const sp = await props.searchParams;
  const codigo = typeof sp.codigo === "string" ? sp.codigo : undefined;
  return (
    <PantallaAuth titulo="Crear cuenta" subtitulo="Solo con código de invitación. Entrarás como usuario; el administrador puede darte más permisos.">
      <FormularioRegistro codigoInicial={codigo} />
    </PantallaAuth>
  );
}
