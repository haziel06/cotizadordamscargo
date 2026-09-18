# Cotizador Dams Cargo

App interna para armar cotizaciones de importación (flete internacional, gastos locales, gastos de naviera) y generar el PDF para el cliente.

- **Spec y decisiones:** `docs/superpowers/specs/2026-09-18-cotizador-dams-cargo-design.md`
- **Stack:** Next.js 16 · TypeScript · Tailwind 4 · shadcn/ui · Supabase (Postgres + Auth + Storage) · @react-pdf/renderer · Vitest

## Correr en local

```bash
npm install
cp .env.example .env.local   # y pega las llaves del proyecto Supabase
npm run dev
```

Pruebas del motor de cálculo: `npm test`.

## Base de datos

Supabase, proyecto `dams-cargo-cotizador`. El esquema vive en `supabase/migrations/` y la semilla en `supabase/seed.sql`.
Los usuarios se crean desde el panel de Supabase (Authentication → Users); no hay registro público.

## Estructura

- `lib/calculo/` — motor de cálculo puro (única fuente de números; tiene tests)
- `lib/cotizaciones/`, `lib/tarifas/`, `lib/config*.ts` — server actions y consultas
- `components/cotizacion/` — editor (datos de carga, servicios, resumen en vivo)
- `components/pdf/DocumentoCotizacion.tsx` — el PDF del cliente (solo precios de venta, nunca costos)
- `app/api/cotizaciones/[id]/pdf` — genera el PDF en el servidor

## Despliegue

Vercel con dos variables de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
