"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bot, Download, FileText, MessageSquarePlus, Send, Ship, Sparkles, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AdjuntoChat } from "@/lib/ia/tipos";
import { preguntarIA } from "@/lib/ia/acciones";
import { cargarConversacionIA, eliminarConversacionIA, guardarConversacionIA, listarConversacionesIA, type ResumenConversacion } from "@/lib/ia/acciones";
import { TextoFormateado } from "./TextoFormateado";

interface Mensaje { role: "user" | "assistant"; content: string; adjuntos?: AdjuntoChat[] }

const ATAJOS = [
  { titulo: "Crear una cotización", texto: "Quiero hacer una cotización", ayuda: "Te voy preguntando lo que falta" },
  { titulo: "Cotización de contenedor", texto: "Quiero cotizar un contenedor de 20 pies desde Shanghai para un cliente", ayuda: "Comparo fletes de cada proveedor" },
  { titulo: "Courier de Miami", texto: "Cotización courier consolidado de 25 kg para un cliente", ayuda: "Armo libra, entrega y trámite" },
  { titulo: "¿Qué cotizaciones llevo?", texto: "¿Cuántas cotizaciones llevo este mes?", ayuda: "Resumen de tu actividad" },
];
const PREGUNTAS_FRECUENTES = [
  "¿Cuántas cotizaciones llevo este mes?",
  "¿Cuál es mi tasa de aceptación?",
  "¿Qué tarifarios están por vencer?",
  "¿Qué proveedores tenemos registrados?",
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
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes.length, pendiente]);

  const enviar = (pregunta: string) => {
    const limpio = pregunta.trim();
    if (!limpio || pendiente) return;
    setError(null);
    const historial = [...mensajes, { role: "user" as const, content: limpio }];
    setMensajes(historial);
    setTexto("");
    startTransition(async () => {
      const r = await preguntarIA(historial.map(({ role, content }) => ({ role, content })));
      if (r.ok) {
        const conRespuesta = [...historial, { role: "assistant" as const, content: r.texto, ...(r.adjuntos.length ? { adjuntos: r.adjuntos } : {}) }];
        setMensajes(conRespuesta);
        const guardado = await guardarConversacionIA(conversacionId, conRespuesta);
        if (guardado.ok) {
          setConversacionId(guardado.id);
          refrescarLista();
        }
      } else {
        setError(r.error);
      }
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

  const ultimo = mensajes.length - 1;

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

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {mensajes.length === 0 && (
            <div className="mx-auto max-w-2xl space-y-4 py-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Sparkles className="size-5" /></div>
                <div>
                  <h2 className="text-lg font-semibold text-primary">¿En qué te ayudo hoy?</h2>
                  <p className="text-sm text-muted-foreground">Armo cotizaciones preguntándote lo necesario, comparo fletes y respondo sobre clientes, tarifas y proveedores{esAdmin ? ", y cuántas lleva cada quien del equipo" : ""}.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {ATAJOS.map((a) => (
                  <button key={a.titulo} type="button" onClick={() => enviar(a.texto)} className="rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5">
                    <div className="text-sm font-semibold text-primary">{a.titulo}</div>
                    <div className="text-xs text-muted-foreground">{a.ayuda}</div>
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
              <div className={cn("max-w-[85%] space-y-2 rounded-lg px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {m.role === "assistant" ? <TextoFormateado texto={m.content} /> : m.content}
                {m.adjuntos?.map((a, j) =>
                  a.tipo === "cotizacion" ? (
                    <div key={j} className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 text-foreground">
                      <FileText className="size-4 text-primary" />
                      <div className="mr-auto min-w-0 text-xs">
                        <div className="font-medium">Cotización {a.numero}</div>
                        <div className="truncate text-muted-foreground">{a.cliente} · {a.total}</div>
                      </div>
                      <Button size="sm" nativeButton={false} render={<a href={`/api/cotizaciones/${a.id}/pdf`} download />}>
                        <Download className="size-3.5" /> PDF
                      </Button>
                      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/cotizaciones/${a.id}`} />}>Abrir</Button>
                    </div>
                  ) : (
                    <div key={j} className="rounded-md border bg-background p-2 text-foreground">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary"><Ship className="size-3.5" /> {a.titulo}</div>
                      <ul className="divide-y">
                        {a.opciones.map((o, k) => (
                          <li key={o.ref} className="flex flex-wrap items-center gap-2 py-1.5 text-xs">
                            <div className="mr-auto min-w-0">
                              <div className="font-medium">{o.etiqueta}</div>
                              <div className="text-muted-foreground">{o.detalle}</div>
                            </div>
                            <span className="num font-semibold">{o.precio}</span>
                            {i === ultimo && (
                              <Button size="xs" disabled={pendiente} onClick={() => enviar(`Elijo la opción ${k + 1}: ${o.detalle} · ${o.precio} (ref:${o.ref})`)}>Elegir</Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
          {pendiente && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex size-7 items-center justify-center rounded-full bg-muted"><Bot className="size-4" /></div>
              <span className="flex gap-1"><span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" /><span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" /><span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" /></span>
              Trabajando en eso…
            </div>
          )}
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
            placeholder="Escribe aquí… (Enter envía, Shift+Enter hace un salto de línea)"
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
