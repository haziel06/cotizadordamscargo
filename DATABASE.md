# Base de datos de Dams Cargo (Supabase compartido)

Este Supabase (hoy con project ref `skwucjiiatqxvtozexpm`) es la **base de datos central de Dams Cargo**,
no algo exclusivo del Cotizador. El Cotizador fue la primera aplicación en usarla; el Portal interno
(hecho con Codex) se conecta al **mismo proyecto**, nunca a uno nuevo.

Este documento es la fuente de verdad del esquema. Antes de agregar o cambiar cualquier tabla,
**cualquier agente (Claude Code o Codex) debe leer este archivo primero**, y actualizarlo si el
cambio afecta algo aquí descrito.

## Reglas para ambas aplicaciones

1. **Nunca borres ni renombres** una tabla, columna, función, trigger o política sin antes revisar
   en este documento (o preguntando) quién más la usa.
2. Todo cambio de esquema se hace con una **migración versionada** en `supabase/migrations/`
   (numeradas: `0010_algo.sql`, `0011_otra_cosa.sql`...). Nunca se edita el esquema a mano desde el
   dashboard de Supabase en producción.
3. RLS (Row Level Security) está **activo en todas las tablas** — no se desactiva nunca. Cada
   aplicación agrega sus propias políticas (`create policy`), no quita las que ya existen.
4. Las claves de Supabase viven solo en variables de entorno del servidor de cada app
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). La `service_role key` nunca se usa
   desde el navegador ni se expone en el código; solo en funciones de servidor cuando de verdad haga falta.
5. Nombres de tablas y campos están **en español**, siguiendo la convención ya establecida — no
   introducir tablas nuevas en inglés (`customers`, `quotes`, etc.) que dupliquen lo que ya existe.

## Tablas existentes (dueño: Cotizador, hoy)

| Tabla | Para qué sirve | ¿La puede usar el Portal? |
|---|---|---|
| `perfiles` | Empleados: nombre, correo, rol (`admin`/`usuario`), activo. Vinculada 1-a-1 con `auth.users`. | **Sí, reutilizar.** Es la tabla de usuarios internos de toda la empresa, no solo del Cotizador. |
| `clientes` | Catálogo de clientes (nombre, contacto). | **Sí, reutilizar.** Si el Portal necesita más campos de cliente (NIT, dirección fiscal, etc.), agregarlos con una migración a esta misma tabla, no crear `portal_clientes`. |
| `cotizaciones` + `cotizacion_lineas` | Cotizaciones creadas en el Cotizador: cabecera y líneas congeladas con su cálculo. | **Sí, leer.** El Portal puede mostrar/consultar cotizaciones (ej. para convertir una aceptada en una operación), pero **no debe escribir aquí** — la lógica de cálculo (motor de márgenes, recargos, mínimos) vive en el código del Cotizador. Si el Portal necesita "crear una operación desde una cotización aceptada", que lea la cotización y cree su propio registro en una tabla nueva del Portal (ej. `operaciones`) que referencie `cotizaciones.id`. |
| `proveedores`, `conceptos`, `tarifarios`, `tarifas_ruta`, `tarifas_cliente` | Base de tarifas: proveedores, precios por concepto/ruta, tarifas especiales por cliente. | Solo lectura si el Portal necesita mostrar tarifas; la edición de tarifas sigue siendo del Cotizador. |
| `invitaciones` | Códigos de invitación para que un empleado nuevo se registre. | Si el Portal tiene su propio registro de empleados, puede reutilizar esta tabla o crear una propia — a definir según si comparten el mismo flujo de alta de usuarios. |
| `config` | Configuración de la empresa (datos fiscales, textos legales, recargos, valores por defecto) usada por el Cotizador para el PDF y los cálculos. | Solo lectura si el Portal necesita mostrar el mismo membrete/datos de empresa. |
| `correlativos` | Contador interno del número de cotización (COT-2026-00xx). | No tocar; es interno del Cotizador. |
| `secretos` | Hash de la clave de administrador (para que un usuario normal se autoasigne admin). | No tocar; es interno del Cotizador. |
| `ai_usage` | Registro de uso del asistente de IA del Cotizador (proveedor, tokens, éxito/error). | No relevante para el Portal. |
| `ia_conversaciones` | Historial de chat del asistente de IA del Cotizador (máx. 10 por usuario). | No relevante para el Portal. |

## Qué debería crear el Portal

Tablas **nuevas**, con prefijo o nombre propio que no choque con lo anterior (ej. `operaciones`,
`embarques`, `documentos_embarque`, `eventos_seguimiento`, `accesos_externos`), que:

- Referencien `cotizaciones.id` / `clientes.id` / `perfiles.user_id` con foreign keys cuando corresponda,
  en vez de copiar los datos.
- Tengan sus propias políticas de RLS.

**Punto abierto que el Portal debe resolver explícitamente, no asumir:** si el Portal va a dar acceso
a **clientes externos** (no empleados) para ver sus propios datos, eso necesita un mecanismo de acceso
distinto al de `perfiles` (que hoy es solo `admin`/`usuario`, pensado para empleados). No extender el
enum de rol de `perfiles` para meter ahí un rol de "cliente externo": mejor una tabla nueva
(ej. `accesos_externos` con su propio `auth.users` o un sistema de invitación/token) y políticas de
RLS separadas que solo dejen ver las filas de `cotizaciones`/`operaciones` que le correspondan a ese
cliente. Esto es una decisión de diseño real, no un detalle menor.

## Historial de migraciones

Vive en `supabase/migrations/` de este repo (Cotizador), numeradas `0001` a `0009` hasta ahora.
El Portal debe traer su propio directorio de migraciones (en su propio repo) pero **contra el mismo
proyecto de Supabase** — cada quien numera las suyas de forma independiente; lo que importa es que
ambos revisen este documento antes de tocar una tabla compartida.
