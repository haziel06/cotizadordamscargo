import { PantallaAuth } from "@/components/auth/PantallaAuth";
import { FormularioLogin } from "./FormularioLogin";

export default async function PaginaLogin(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  return (
    <PantallaAuth titulo="Iniciar sesión" subtitulo="Entra con tu correo y contraseña.">
      <FormularioLogin inactivo={sp.inactivo === "1"} />
    </PantallaAuth>
  );
}
