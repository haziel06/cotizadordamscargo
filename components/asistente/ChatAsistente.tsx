"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, MessageSquarePlus, Send, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { preguntarIA } from "@/lib/ia/acciones";
import { cargarConversacionIA, eliminarConversacionIA, guardarConversacionIA, listarConversacionesIA, type ResumenConversacion } from "@/lib/ia/acciones";
import { TextoFormateado } from "./TextoFormateado";

interface Mensaje { role: "user" | "assistant"; content: string }

const PREGUNTAS_FRECUENTES = [
  "¿Cuántas cotizaciones llevo este mes?",
  "¿Cuál fue la última cotización de un cliente?",
  "¿Cuánto cuesta el trámite aduanal?",
  "¿Cuál es mi tasa de aceptación?",
  "¿Qué proveedores tenemos registrados?",
  "¿Qué tarifarios están por vencer?",
];

export function ChatAsistente({ esAdmin }: { esAdmin: boolean }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [conversaciones, setConversaciones] = useState<ResumenConversacion[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);

  const refrescarLista = () => listarConversacionesIA().then(setConversaciones);
  useEffect(() => {
    refrescarLista();
  }, []);

  const enviar = (pregunta: string) => {
    const limpio = pregunta.trim();
    if (!limpio || pendiente) return;
    setError(null);
    const historial = [...mensajes, { role: "user" as const, content: limpio }];
    setMensajes(historial);
    setTexto("");
    startTransition(async () => {
      const r = await preguntarIA(historial);
      if (r.ok) {
        const conRespuesta = [...historial, { role: "assistant" as const, content: r.texto }];
        setMensajes(conRespuesta);
        const guardado = await guardarConversacionIA(conversacionId, conRespuesta);
        if (guardado.ok) {
          setConversacionId(guardado.id);
          refrescarLista();
        }
      } else {
        setError(r.error);
      }
      setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  };

  const nuevaConversacion = () => {
    setMensajes([]);
    setConversacionId(null);
    setError(null);
  };

  const abrirConversacion = (id: string) => {
    startTransition(async () => {
      const m = await cargarConversacionIA(id);
      if (m) {
        setMensajes(m);
        setConversacionId(id);
        setError(null);
      }
    });
  };

  const borrarConversacion = (id: string) => {
    startTransition(async () => {
      await eliminarConversacionIA(id);
      if (id === conversacionId) nuevaConversacion();
      refrescarLista();
    });
  };

  return (
    <div className="flex h-[calc(100vh-160px)] gap-3">
      <aside className="hidden w-56 shrink-0 flex-col rounded-lg border bg-card p-2 md:flex">
        <Button variant="outline" size="sm" className="mb-2 w-full justify-start gap-2" onClick={nuevaConversacion}>
          <MessageSquarePlus className="size-4" /> Nueva conversación
        </Button>
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {conversaciones.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Sin conversaciones guardadas.</p>}
          {conversaciones.map((c) => (
            <div key={c.id} className={cn("group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted", c.id === conversacionId && "bg-muted font-medium")}>
              <button type="button" className="flex-1 truncate text-left" onClick={() => abrirConversacion(c.id)} title={c.titulo}>
                {c.titulo}
              </button>
              <button type="button" className="shrink-0 opacity-0 group-hover:opacity-100" onClick={() => borrarConversacion(c.id)} aria-label="Borrar">
                <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">Se guardan tus últimas 10; las más viejas se borran solas.</p>
      </aside>

      <div className="flex flex-1 flex-col rounded-lg border bg-card">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {mensajes.length === 0 && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Pregúntame sobre cotizaciones, clientes, tarifas o proveedores{esAdmin ? " — o cuántas lleva alguien del equipo" : ""}. Ejemplos:</p>
              <div className="flex flex-wrap gap-2">
                {PREGUNTAS_FRECUENTES.map((s) => (
                  <button key={s} type="button" onClick={() => enviar(s)} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mensajes.map((m, i) => (
            <div key={i} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {m.role === "assistant" ? <TextoFormateado texto={m.content} /> : m.content}
              </div>
            </div>
          ))}
          {pendiente && <p className="text-sm text-muted-foreground">Buscando información...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div ref={finRef} />
        </div>
        {mensajes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t px-3 pt-2">
            {PREGUNTAS_FRECUENTES.slice(0, 3).map((s) => (
              <button key={s} type="button" onClick={() => enviar(s)} className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2 p-3 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(texto);
          }}
        >
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(texto);
              }
            }}
            placeholder="Escribe tu pregunta..."
            className="min-h-10 resize-none"
            rows={1}
          />
          <Button type="submit" disabled={pendiente || !texto.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
