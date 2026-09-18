# Cotizador Dams Cargo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web para que facturación de Dams Cargo arme cotizaciones en <3 min, con base de tarifas editable, tres tipos de margen, rentabilidad interna y PDF impecable para el cliente.

**Architecture:** Next.js App Router con Server Actions para escritura y Supabase (Postgres + Auth + Storage) como backend. Un motor de cálculo puro en `lib/calculo/` es la única fuente de números; formulario, guardado y PDF lo consumen. Al guardar, costos y márgenes se congelan en `cotizacion_lineas`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind 4, shadcn/ui, Supabase (`@supabase/ssr`), `@react-pdf/renderer`, React Hook Form + Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-cotizador-dams-cargo-design.md`
**Supabase:** proyecto `dams-cargo-cotizador`, ref `skwucjiiatqxvtozexpm`, región us-east-1.

---

## Estructura de archivos

```
COTIZADOR/
  package.json, next.config.ts, tsconfig.json, vitest.config.ts, components.json
  .env.local (no se commitea), .env.example
  supabase/migrations/0001_schema.sql        tablas, enums, correlativo, RLS
  supabase/seed.sql                          conceptos sección 6 + config sección 8
  lib/calculo/tipos.ts                       tipos del motor
  lib/calculo/linea.ts                       ventaLinea, costoLinea, ventaSinIva
  lib/calculo/peso.ts                        pesoCobrable
  lib/calculo/totales.ts                     totalesCotizacion
  lib/calculo/formato.ts                     formatoMoneda, formatoFecha, fechaVencimiento
  lib/calculo/alertas.ts                     alertasCotizacion
  lib/calculo/__tests__/*.test.ts
  lib/supabase/server.ts, client.ts, middleware.ts, tipos.ts
  lib/config.ts                              lee config con defaults
  lib/cotizaciones/acciones.ts               server actions: guardar, duplicar, cambiarEstado
  lib/cotizaciones/consultas.ts              listar, obtener con líneas
  lib/tarifas/acciones.ts                    CRUD conceptos
  middleware.ts                              refresca sesión / redirige a /login
  app/layout.tsx, app/globals.css
  app/login/page.tsx, app/login/acciones.ts
  app/(app)/layout.tsx                       nav + sesión requerida
  app/(app)/page.tsx                         dashboard
  app/(app)/cotizaciones/nueva/page.tsx
  app/(app)/cotizaciones/[id]/page.tsx
  app/(app)/tarifas/page.tsx
  app/(app)/configuracion/page.tsx
  app/api/cotizaciones/[id]/pdf/route.ts
  components/ui/*                            shadcn
  components/cotizacion/EditorCotizacion.tsx  estado del formulario, orquesta A/B/C
  components/cotizacion/DatosCarga.tsx
  components/cotizacion/Servicios.tsx
  components/cotizacion/ResumenVivo.tsx
  components/tarifas/TablaTarifas.tsx
  components/pdf/DocumentoCotizacion.tsx
  components/pdf/fuentes.ts
  public/fonts/Inter-*.ttf
```

---

### Task 1: Scaffold del proyecto

**Files:** raíz de `COTIZADOR/`

- [ ] `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --yes`
- [ ] `npm i @supabase/supabase-js @supabase/ssr @react-pdf/renderer react-hook-form @hookform/resolvers zod`
- [ ] `npm i -D vitest`
- [ ] `npx shadcn@latest init -d` y `npx shadcn@latest add button input label select table card badge dialog textarea checkbox separator tabs alert dropdown-menu popover command`
- [ ] Crear `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { include: ["lib/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});
```
- [ ] Agregar script `"test": "vitest run"` en package.json
- [ ] Paleta en `globals.css`: `--primary: #1F3864`, fondo `#F4F6F9`, ámbar `#E8A33D`, verde `#2E7D4F`; `font-variant-numeric: tabular-nums` en `td, .num`.
- [ ] Commit: `chore: scaffold Next.js + shadcn + vitest`

### Task 2: Motor de cálculo (TDD)

**Files:** `lib/calculo/tipos.ts`, `linea.ts`, `peso.ts`, `totales.ts`, `formato.ts`, `alertas.ts`, tests.

- [ ] Tipos:
```ts
export type Moneda = "USD" | "GTQ";
export type Categoria = "internacional" | "local" | "naviera";
export type TipoMargen = "porcentaje" | "monto_fijo" | "precio_fijo";
export type Unidad = "envio" | "contenedor" | "kg" | "cbm" | "libra";
export const IVA = 0.12;
export interface LineaCalculo {
  nombre: string; categoria: Categoria; moneda: Moneda; cantidad: number;
  costo_unitario: number; tipo_margen: TipoMargen; valor_margen: number; lleva_iva: boolean;
}
```
- [ ] Tests de `ventaLinea` (los tres modos, redondeo a 2 decimales), `costoLinea`, `ventaSinIva` (GTQ con IVA → /1.12; USD y sin IVA → igual).
- [ ] Tests de `pesoCobrable(real, vol)` → `{ peso, gano: "real" | "volumetrico" | "empate" }`.
- [ ] Tests de `totalesCotizacion(lineas, tipoCambio)` → `{ internacional_usd, local_gtq, naviera_usd, total_gtq, costo_total_gtq, venta_total_gtq, utilidad_gtq, margen_pct }`. Incluir el **caso Grupo Aliados**: con costos de semilla y márgenes de semilla, verificar que las ventas den 5,750 / 100 / 750 / 1,600 y 5,000 / 2,500 / 1,500 / 750 (ver Task 3 para costos hacia atrás). `margen_pct` = 0 si costo total = 0.
- [ ] Tests de `formatoMoneda(5750, "USD") === "$ 5,750.00"`, `formatoMoneda(9750, "GTQ") === "Q 9,750.00"`, `formatoFecha("2026-09-18") === "18/09/2026"`, `fechaVencimiento("2026-09-18", 15) === "2026-10-03"`.
- [ ] Tests de `alertasCotizacion` (margen < 15, TC fuera 7.50–8.50, línea costo 0 + porcentaje).
- [ ] Implementar hasta que `npm test` pase. Commit: `feat: motor de cálculo de cotizaciones con tests`

### Task 3: Esquema Supabase + semilla

**Files:** `supabase/migrations/0001_schema.sql`, `supabase/seed.sql`

- [ ] Enums, tablas de la sección 4 de la spec, `correlativos(anio int pk, ultimo int)`, función `siguiente_numero_cotizacion()` (INSERT … ON CONFLICT DO UPDATE SET ultimo = correlativos.ultimo+1 RETURNING → `COT-YYYY-0000`), trigger `updated_at`.
- [ ] RLS: todas las tablas `enable row level security`; política `authenticated` all para todo (un solo tipo de usuario).
- [ ] Bucket `config` público para el logo (`insert into storage.buckets`), política de escritura para authenticated.
- [ ] Semilla: costos **hacia atrás** para que el caso de prueba dé exacto:
  - Flete Marítimo costo 5,227.27 @ 10% → 5,750.00 (5227.27×1.1 = 5749.997 → 5,750.00)
  - BL costo 75.00 + 25 fijo → 100.00
  - Recolección costo 652.17 @ 15% → 749.9955 → 750.00
  - Gastos Locales en Origen 1,454.55 @ 10% → 1,600.005 → 1,600.01 ✗ → usar 1,454.54 → 1,599.994 → 1,599.99 ✗. **Usar `precio_fijo` no; ajustar**: 1,600/1.1 = 1454.5454… no cierra en 2 decimales. Cambiar margen semilla a **monto_fijo +145.45** sobre costo 1,454.55 → 1,600.00. Anotar en `notas` del concepto.
  - Flete terrestre 4,347.83 @ 15% → 5,000.0045 → 5,000.00
  - Trámite de Aduana 2,083.33 @ 20% → 2,499.996 → 5,000? no: 2,500.00 ✓
  - Patrulla 1,300 + 200 → 1,500 ✓; Custodio 600 + 150 → 750 ✓
  - Resto de conceptos con los valores literales de la sección 6.
  - El test de Task 2 usa estos mismos números.
- [ ] Config: `empresa` (8.2), `textos_legales` (8.5), `defaults` `{ tipo_cambio: 8.05, dias_vigencia: 15, margen_default: { tipo: "porcentaje", valor: 15 } }`.
- [ ] Aplicar con el MCP de Supabase (`apply_migration`, luego `execute_sql` con la semilla). Generar tipos → `lib/supabase/tipos.ts`.
- [ ] Commit: `feat: esquema y semilla de Supabase`

### Task 4: Auth y layout

- [ ] `lib/supabase/server.ts` / `client.ts` / `middleware.ts` según docs `@supabase/ssr`. `.env.example` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] `middleware.ts`: sin sesión → `/login`; con sesión en `/login` → `/`.
- [ ] `app/login/page.tsx` con formulario correo/contraseña y server action `iniciarSesion`. Sin registro.
- [ ] `app/(app)/layout.tsx`: barra superior con logo pequeño, links Cotizaciones · Tarifas · Configuración, botón Salir.
- [ ] Crear usuario inicial desde el MCP (`auth.users` vía SQL no; usar panel o `supabase.auth.admin` — dejar instrucción al usuario).
- [ ] Commit: `feat: autenticación y layout`

### Task 5: Base de tarifas

- [ ] `lib/tarifas/acciones.ts`: `guardarConcepto`, `desactivarConcepto`, `eliminarConcepto` (rechaza si tiene líneas), `listarConceptos`, `listarProveedores`, `guardarProveedor`.
- [ ] `components/tarifas/TablaTarifas.tsx`: tabla editable en línea (una fila = un `<form>` con inputs; Enter/blur guarda). Filtro por categoría, buscador, toggle "mostrar inactivos", botón "Nuevo concepto", diálogo de proveedores.
- [ ] Commit: `feat: base de tarifas editable`

### Task 6: Editor de cotización

- [ ] `lib/cotizaciones/acciones.ts`: `guardarCotizacion(datos, lineas)` — valida con Zod, calcula totales con `totalesCotizacion`, inserta/actualiza cabecera + reemplaza líneas en transacción (RPC `guardar_cotizacion` en SQL o dos llamadas con manejo de error), asigna número con `siguiente_numero_cotizacion()` solo al crear.
- [ ] `components/cotizacion/EditorCotizacion.tsx`: estado con `useState` de `{ cabecera, lineas }`; deriva `totales`, `pesoCobrable`, `alertas` con `useMemo`.
- [ ] `DatosCarga.tsx`: campos sección 7.2-A; tipo de cambio grande; autocompletado de clientes con `Command`; muestra "Se cobra peso real/volumétrico".
- [ ] `Servicios.tsx`: tres grupos con checkboxes; al marcar agrega línea con cantidad según unidad; tabla de líneas con inputs cantidad/costo/tipo margen/valor y columna Venta (solo lectura); botones ↑ ↓ ✕; "Agregar línea manual".
- [ ] `ResumenVivo.tsx`: sticky; tres bloques + total Q; caja "INTERNO — no aparece en el PDF del cliente" con costo/utilidad/margen; alertas ámbar.
- [ ] Páginas `nueva` y `[id]` montan el editor; `[id]` además tiene botones PDF, Duplicar, cambiar estado.
- [ ] Commit: `feat: editor de cotización con resumen en vivo`

### Task 7: PDF

- [ ] Descargar Inter (Regular, SemiBold, Bold) a `public/fonts/`; `components/pdf/fuentes.ts` registra con `Font.register`.
- [ ] `DocumentoCotizacion.tsx`: estructura 8.3; header `fixed`; logo desde URL o texto de respaldo; secciones vacías omitidas; formatos de 8.4; notas de config.
- [ ] `app/api/cotizaciones/[id]/pdf/route.ts`: carga cotización + config, `renderToBuffer`, `Content-Disposition: attachment; filename="Cotizacion_<Cliente>_<Numero>_<DDMMAAAA>.pdf"` (cliente saneado a `[A-Za-z0-9_-]`). Requiere sesión.
- [ ] Verificar manualmente con el caso Grupo Aliados que el PDF muestre 8,200.00 y 9,750.00 y **ningún** costo/margen.
- [ ] Commit: `feat: PDF de cotización`

### Task 8: Dashboard, estados, duplicar

- [ ] `consultas.ts` `listarCotizaciones({ estado, q })` calcula `vencida` al vuelo.
- [ ] `app/(app)/page.tsx`: botón grande "Nueva cotización", filtros, tabla número/cliente/fecha/estado(badge)/total Q/margen %, fila con aviso si vencida.
- [ ] `duplicarCotizacion(id)` y `cambiarEstado(id, estado)`.
- [ ] Commit: `feat: dashboard, estados y duplicar`

### Task 9: Configuración

- [ ] `app/(app)/configuracion/page.tsx` con tabs: Empresa (campos 8.2 + subir logo a Storage con vista previa), Textos legales (dos textareas, una viñeta por línea), Valores por defecto (TC, días vigencia, margen por defecto).
- [ ] Subir el logo transparente del usuario como valor inicial.
- [ ] Commit: `feat: configuración de empresa, textos y defaults`

### Task 10: Verificación y despliegue

- [ ] `npm run build` limpio, `npm test` verde.
- [ ] Recorrer criterios de aceptación de la sección 10 en el navegador; capturas.
- [ ] Desplegar en Vercel con las dos variables de entorno.
- [ ] Commit final.
