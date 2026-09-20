import { crearClienteServidor } from "@/lib/supabase/server";
import { crearGroqProvider } from "./proveedores/groq";
import { crearOpenRouterProvider } from "./proveedores/openrouter";
import { ErrorProveedorIA, type AIProvider, type ContextoHerramienta, type HerramientaIA, type MensajeIA } from "./tipos";

const MAX_VUELTAS_HERRAMIENTAS = 4;

/** Orden de intento para tareas de texto/preguntas. Se agrega un proveedor nuevo solo aquí. */
function proveedoresDeTexto(): AIProvider[] {
  return [crearGroqProvider(), crearOpenRouterProvider()];
}

async function registrarUso(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, fila: {
  user_id: string; proveedor: string; modelo: string; tokens_entrada: number; tokens_salida: number;
  exito: boolean; tipo_error?: string; latencia_ms: number;
}) {
  await supabase.from("ai_usage").insert(fila).then(
    () => {},
    () => {}, // el registro de uso nunca debe tumbar la respuesta al usuario
  );
}

/**
 * Ejecuta el ciclo "el modelo pide herramientas → las corremos → le devolvemos el resultado"
 * hasta que responda texto final, probando cada proveedor de `proveedoresDeTexto()` en orden
 * y solo pasando al siguiente si el actual falla (rate limit, error, timeout, no configurado).
 */
export async function generarConHerramientas(opciones: {
  mensajes: MensajeIA[];
  herramientas: HerramientaIA[];
  contexto: ContextoHerramienta;
}): Promise<{ texto: string; proveedorUsado: string }> {
  const { herramientas, contexto } = opciones;
  const supabase = await crearClienteServidor();
  const candidatos = proveedoresDeTexto();

  let ultimoError: Error | null = null;
  for (const proveedor of candidatos) {
    const inicio = Date.now();
    try {
      const mensajes = [...opciones.mensajes];
      for (let vuelta = 0; vuelta < MAX_VUELTAS_HERRAMIENTAS; vuelta++) {
        const resultado = await proveedor.generar(mensajes, herramientas);
        if (!resultado.toolCalls.length) {
          await registrarUso(supabase, {
            user_id: contexto.sesion.userId, proveedor: proveedor.nombre, modelo: proveedor.modelo,
            tokens_entrada: resultado.tokensEntrada, tokens_salida: resultado.tokensSalida,
            exito: true, latencia_ms: Date.now() - inicio,
          });
          return { texto: resultado.texto || "No encontré una respuesta para eso.", proveedorUsado: proveedor.nombre };
        }
        mensajes.push({ role: "assistant", content: resultado.texto, tool_calls: resultado.toolCalls });
        for (const llamada of resultado.toolCalls) {
          const herramienta = herramientas.find((h) => h.nombre === llamada.nombre);
          const salida = herramienta
            ? await herramienta.ejecutar(llamada.argumentos, contexto).catch((e: Error) => ({ error: e.message }))
            : { error: `Herramienta "${llamada.nombre}" no existe.` };
          mensajes.push({ role: "tool", tool_call_id: llamada.id, content: JSON.stringify(salida) });
        }
      }
      // Se acabaron las vueltas permitidas sin una respuesta final: no seguimos insistiendo.
      throw new ErrorProveedorIA(`${proveedor.nombre}: demasiadas llamadas a herramientas sin concluir.`, "error_proveedor", proveedor.nombre);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      const tipo = e instanceof ErrorProveedorIA ? e.tipo : "error_proveedor";
      await registrarUso(supabase, {
        user_id: contexto.sesion.userId, proveedor: proveedor.nombre, modelo: proveedor.modelo,
        tokens_entrada: 0, tokens_salida: 0, exito: false, tipo_error: tipo, latencia_ms: Date.now() - inicio,
      });
      ultimoError = err;
      // Seguimos al siguiente proveedor de la lista.
    }
  }
  throw ultimoError ?? new Error("Ningún proveedor de IA está disponible.");
}
