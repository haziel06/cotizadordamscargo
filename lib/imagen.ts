/** Un celular entrega fotos de 4–8 MB y el servidor solo recibe ~4 MB por envío: se reducen en el navegador antes de subirlas. */
const LIMITE_SIN_REDUCIR = 3 * 1024 * 1024;
const LADO_MAXIMO = 2400;

export async function prepararArchivoCliente(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size <= LIMITE_SIN_REDUCIR) return f;
  try {
    const bmp = await createImageBitmap(f);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    lienzo.getContext("2d")?.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
    return blob ? new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch {
    return f;
  }
}
