/**
 * El modelo responde en markdown simple (negritas, listas). Esto NO usa dangerouslySetInnerHTML
 * con el texto crudo: primero se escapa todo como texto plano y solo después se envuelven los
 * `**negrita**` y viñetas "- " en las etiquetas que este componente controla, así un nombre de
 * cliente con caracteres raros nunca puede inyectar HTML.
 */
export function TextoFormateado({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  return (
    <div className="space-y-1">
      {lineas.map((linea, i) => {
        const esViñeta = /^\s*[-*]\s+/.test(linea);
        const contenido = conNegritas(esViñeta ? linea.replace(/^\s*[-*]\s+/, "") : linea);
        if (!linea.trim()) return <div key={i} className="h-1" />;
        return esViñeta ? (
          <div key={i} className="flex gap-1.5 pl-1">
            <span>·</span>
            <span>{contenido}</span>
          </div>
        ) : (
          <p key={i}>{contenido}</p>
        );
      })}
    </div>
  );
}

/** Divide en fragmentos alternando texto normal y `**negrita**`, sin tocar el resto del texto. */
function conNegritas(linea: string) {
  const partes = linea.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(parte);
    return m ? <strong key={i}>{m[1]}</strong> : <span key={i}>{parte}</span>;
  });
}
