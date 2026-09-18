import { FormularioLogin } from "./FormularioLogin";

export default function PaginaLogin() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-primary">Dams Cargo</div>
          <div className="text-sm text-muted-foreground">Cotizador · Aduanas &amp; Logística</div>
        </div>
        <FormularioLogin />
      </div>
    </main>
  );
}
