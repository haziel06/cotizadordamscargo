import { crearClienteServidor } from "@/lib/supabase/server";
import { crearGeminiProvider } from "./proveedores/gemini";
import { ErrorProveedorIA, type AdjuntoChat, type ContextoHerramienta, type HerramientaIA, type MensajeIA } from "./tipos";

const MAX_VUELTAS_HERRAMIENTAS = 6;
const INTENTOS = 2;

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
 * hasta que responda texto final. Gemini es el único proveedor; ante una falla pasajera
 * (saturado, timeout) se reintenta una vez desde cero, pero no ante un límite de uso o
 * una API key ausente, donde reintentar no cambia nada.
 */
export async function generarConHerramientas(opciones: {
  mensajes: MensajeIA[];
  herramientas: HerramientaIA[];
  contexto: ContextoHerramienta;
}): Promise<{ texto: string; adjuntos: AdjuntoChat[] }> {
  const { herramientas, contexto } = opciones;
  const supabase = await crearClienteServidor();
  const proveedor = crearGeminiProvider();

  let ultimoError: Error | null = null;
  for (let intento = 0; intento < INTENTOS; intento++) {
    if (intento > 0) await new Promise((r) => setTimeout(r, 1500));
    const inicio = Date.now();
    let tokensEntrada = 0;
    let tokensSalida = 0;
    try {
      const mensajes = [...opciones.mensajes];
      for (let vuelta = 0; vuelta < MAX_VUELTAS_HERRAMIENTAS; vuelta++) {
        const resultado = await proveedor.generar(mensajes, herramientas);
        tokensEntrada += resultado.tokensEntrada;
        tokensSalida += resultado.tokensSalida;
        if (!resultado.toolCalls.length) {
          await registrarUso(supabase, {
            user_id: contexto.sesion.userId, proveedor: proveedor.nombre, modelo: proveedor.modelo,
            tokens_entrada: tokensEntrada, tokens_salida: tokensSalida, exito: true, latencia_ms: Date.now() - inicio,
          });
          return { texto: resultado.texto || "No encontré una respuesta para eso.", adjuntos: contexto.adjuntos };
        }
        mensajes.push({ role: "assistant", content: resultado.texto, tool_calls: resultado.toolCalls, partes_crudas: resultado.partesCrudas });
        for (const llamada of resultado.toolCalls) {
          const herramienta = herramientas.find((h) => h.nombre === llamada.nombre);
          const salida = herramienta
            ? await herramienta.ejecutar(llamada.argumentos, contexto).catch((e: Error) => ({ error: e.message }))
            : { error: `Herramienta "${llamada.nombre}" no existe.` };
          mensajes.push({ role: "tool", tool_call_id: llamada.id, nombre: llamada.nombre, content: JSON.stringify(salida) });
        }
      }
      throw new ErrorProveedorIA(`${proveedor.nombre}: demasiadas llamadas a herramientas sin concluir.`, "error_proveedor", proveedor.nombre);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      const tipo = e instanceof ErrorProveedorIA ? e.tipo : "error_proveedor";
      await registrarUso(supabase, {
        user_id: contexto.sesion.userId, proveedor: proveedor.nombre, modelo: proveedor.modelo,
        tokens_entrada: tokensEntrada, tokens_salida: tokensSalida, exito: false, tipo_error: tipo, latencia_ms: Date.now() - inicio,
      });
      ultimoError = err;
      if (tipo === "rate_limit" || tipo === "sin_configurar") break;
      // Si ya se creó algo (ej. una cotización) no se repite el ciclo: duplicaría el registro.
      if (contexto.adjuntos.length) break;
    }
  }
  throw ultimoError ?? new Error("La IA no está disponible.");
}
