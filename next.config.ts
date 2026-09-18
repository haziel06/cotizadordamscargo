import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las fuentes del PDF se leen del disco en el servidor; hay que incluirlas en el bundle de la función.
  outputFileTracingIncludes: {
    "/api/cotizaciones/[id]/pdf": ["./public/fonts/*.ttf"],
  },
};

export default nextConfig;
