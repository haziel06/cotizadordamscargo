"use client";
import { useRef } from "react";
import { Bold, Highlighter, Underline } from "lucide-react";
import { alternarMarca, segmentar } from "@/lib/calculo/formato-texto";
import { cn } from "@/lib/utils";

interface Props {
  /** Una nota por línea; el formato va como marcas ligeras dentro del texto. */
  valor: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  filas?: number;
}

/**
 * Editor de notas con formato mínimo (negrita, subrayado, resaltado): selecciona texto y pulsa el botón
 * o Ctrl+B / Ctrl+U / Ctrl+H. Abajo se ve cómo quedará en el PDF.
 */
export function EditorNotas({ valor, onChange, disabled, filas = 8 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const aplicar = (token: string) => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const r = alternarMarca(valor, ta.selectionStart, ta.selectionEnd, token);
    onChange(r.texto);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(r.ini, r.fin);
    });
  };

  const teclas = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); aplicar("**"); }
    if (k === "u") { e.preventDefault(); aplicar("__"); }
    if (k === "h") { e.preventDefault(); aplicar("=="); }
  };

  const lineas = valor.split("\n");

  return (
    <div className={cn("rounded border border-input bg-white", disabled && "opacity-70")}>
      <div className="flex items-center gap-1 border-b px-2 py-1">
        <Boton onClick={() => aplicar("**")} disabled={disabled} title="Negrita (Ctrl+B)"><Bold className="size-3.5" /></Boton>
        <Boton onClick={() => aplicar("__")} disabled={disabled} title="Subrayado (Ctrl+U)"><Underline className="size-3.5" /></Boton>
        <Boton onClick={() => aplicar("==")} disabled={disabled} title="Resaltar en amarillo (Ctrl+H)"><Highlighter className="size-3.5" /></Boton>
        <span className="ml-2 text-[11px] text-muted-foreground">Selecciona texto y pulsa un botón. Una nota por línea.</span>
      </div>
      <textarea
        ref={ref}
        value={valor}
        rows={filas}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={teclas}
        className="w-full resize-y bg-transparent p-2 font-mono text-xs outline-none"
        spellCheck={false}
      />
      <div className="border-t bg-muted/40 px-3 py-2">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vista previa</div>
        <ul className="space-y-0.5 text-xs">
          {lineas.filter((l) => l.trim()).map((l, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-verde">•</span>
              <span>
                {segmentar(l).map((s, j) => (
                  <span key={j} className={cn(s.negrita && "font-bold", s.subrayado && "underline", s.resaltado && "bg-yellow-200")}>{s.texto}</span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Boton({ children, ...p }: React.ComponentProps<"button">) {
  return (
    <button type="button" {...p} className="rounded p-1 hover:bg-muted disabled:opacity-50">
      {children}
    </button>
  );
}
