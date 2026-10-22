/** Tipos de archivo que se pueden mandar a la IA (sin dependencias de servidor: lo usa también el navegador). */
export const ACEPTA_DOCUMENTOS = [
  "application/pdf", "image/png", "image/jpeg", "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", ".xlsx", ".csv",
].join(",");
