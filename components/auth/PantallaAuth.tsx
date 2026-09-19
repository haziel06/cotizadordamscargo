import Image from "next/image";
import { Anchor, FileText, ShieldCheck } from "lucide-react";

/**
 * Marco de las pantallas de entrada: banda con la foto del puerto y la marca a la izquierda,
 * formulario a la derecha. Mismo lenguaje visual que el PDF.
 */
export function PantallaAuth({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-marino text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Image src="/pdf/fondo-encabezado.jpg" alt="" fill priority className="object-cover opacity-40" sizes="55vw" />
        <div className="absolute inset-0 bg-gradient-to-br from-marino via-marino/85 to-marino/40" />
        <div className="relative">
          <div className="inline-flex items-center gap-3 rounded-xl bg-white/95 px-4 py-3 shadow-lg">
            <Image src="/logo/dams-cargo.png" alt="Dams Cargo" width={160} height={48} className="h-10 w-auto" priority />
          </div>
        </div>
        <div className="relative space-y-6">
          <div>
            <h2 className="text-3xl font-semibold leading-tight">Cotizador de aduanas y logística</h2>
            <p className="mt-2 max-w-md text-sm text-white/80">
              Marítimo, aéreo, courier, transporte y gestión aduanera. Tarifas actualizadas, márgenes protegidos y PDF listo para el cliente en minutos.
            </p>
          </div>
          <ul className="grid gap-3 text-sm text-white/90 sm:grid-cols-3">
            <li className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><Anchor className="size-4 text-ambar" /> Tarifas por proveedor</li>
            <li className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><FileText className="size-4 text-ambar" /> PDF con tu firma</li>
            <li className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><ShieldCheck className="size-4 text-ambar" /> Costos solo para admin</li>
          </ul>
        </div>
        <div className="relative text-xs text-white/60">Agencia Nacional de Carga, S.A. · Guatemala</div>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Image src="/logo/dams-cargo.png" alt="Dams Cargo" width={140} height={42} className="h-9 w-auto" priority />
          </div>
          <h1 className="text-2xl font-semibold text-primary">{titulo}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{subtitulo}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
