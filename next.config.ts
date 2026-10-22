import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Subir fotos/PDF de tarifarios a una acción del servidor: el tope por defecto (1 MB) las rechazaba.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // Las fuentes del PDF se leen del disco en el servidor; hay que incluirlas en el bundle de la función.
  outputFileTracingIncludes: {
    "/api/cotizaciones/[id]/pdf": ["./public/fonts/*.ttf", "./public/pdf/*.jpg"],
  },
};

export default nextConfig;
