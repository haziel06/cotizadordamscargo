# Diseño: Cotizador Dams Cargo

**Fecha:** 2026-09-18
**Estado:** aprobado por el usuario. Reemplaza al diseño de 2026-07-12 (archivado en `_legacy/`).

Este documento tiene dos partes:

1. **Decisiones de diseño** — lo que se decidió donde la especificación deja margen. Aprobado en conversación.
2. **Especificación original** — el documento entregado por el usuario, tal cual. Es la fuente de verdad sobre reglas de negocio. Si hay conflicto entre la parte 1 y la parte 2, gana la parte 2.

---

## Parte 1 — Decisiones de diseño

### Punto de partida

En `COTIZADOR/web` existía un intento previo (julio 2026) sobre vinext/Cloudflare D1 con un motor de cálculo distinto (DAI, CIF, roles). Se descartó: su modelo de negocio no coincide con la especificación actual. Se movió a `_legacy/` (ignorado por git) solo como referencia.

### Stack

| Capa | Elección |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| Estilos | Tailwind CSS 4 + shadcn/ui |
| Base de datos | Supabase Postgres — proyecto nuevo `dams-cargo-cotizador`, org `haziel06's Org`, región `us-east-1`, plan gratuito ($0/mes) |
| Auth | Supabase Auth, correo + contraseña, sin roles. Registro público deshabilitado: los usuarios se crean desde el panel de Supabase |
| Storage | Supabase Storage, bucket público `config` para el logo |
| PDF | `@react-pdf/renderer` en un Route Handler del servidor. Fuente Inter embebida. Encabezado con `fixed` para que se repita en página 2 |
| Formularios | React Hook Form + Zod |
| Tests | Vitest, solo sobre el motor de cálculo |
| Hosting | Vercel |

El proyecto Next.js vive en la raíz de `COTIZADOR/`.

### Arquitectura

```
lib/calculo/          motor puro: sin React, sin Supabase. Único módulo con tests.
  linea.ts            ventaLinea(), costoLinea()
  peso.ts             pesoCobrable()
  totales.ts          totalesCotizacion() → totales por bloque, total Q, rentabilidad interna
  formato.ts          formatoMoneda(), formatoFecha()
lib/supabase/         clientes server/browser, tipos generados
lib/config.ts         lectura de la tabla config con valores por defecto
app/(auth)/login      login
app/(app)/            layout con navegación; todo protegido por sesión
  page.tsx            dashboard
  cotizaciones/nueva
  cotizaciones/[id]
  tarifas
  configuracion
app/api/cotizaciones/[id]/pdf/route.ts   genera el PDF
components/cotizacion/   editor: DatosCarga, Servicios, ResumenVivo
components/pdf/          documento react-pdf
supabase/migrations/     SQL versionado
supabase/seed.sql        semilla de la sección 6 + config de la sección 8
```

**Regla:** el formulario y el PDF consumen `totalesCotizacion()`; nunca recalculan por su cuenta. Los totales guardados en `cotizaciones` se calculan con la misma función en el servidor al guardar.

### Puntos abiertos de la sección 13 — asunciones

| Punto | Asunción implementada | Dónde se cambia |
|---|---|---|
| Correlativo | `COT-AAAA-####`, generado por función Postgres `siguiente_numero_cotizacion()` con tabla `correlativos(anio, ultimo)` bajo bloqueo de fila. Sin duplicados con guardado concurrente | La función SQL |
| Tarifas especiales por cliente | No existen | Fuera de alcance |
| IVA del depósito en garantía | `aplica_iva = false` en la semilla | Base de tarifas, en la app |
| Idioma del PDF | Solo español | Fuera de alcance |

### Otras decisiones

- **Estado `vencida`** no se persiste. Se calcula al leer: `fecha + dias_vigencia < hoy` y estado ∉ {aceptada, rechazada}. Evita un cron.
- **Logo inicial:** el archivo con fondo transparente que entregó el usuario se sube a Storage al correr la semilla y su URL se guarda en `config.empresa.logo_url`. Reemplazable desde Configuración.
- **Duplicar cotización:** copia cabecera y líneas con costos congelados tal como están (no re-lee tarifas actuales), nuevo número, estado `borrador`, fecha de hoy.
- **Desactivar vs borrar concepto:** si el concepto tiene líneas en `cotizacion_lineas`, el botón solo permite desactivar. Si no, permite borrar.
- **Conversión a Q para el total general:** `total_gtq = (total_usd_internacional + total_usd_naviera) × tipo_cambio + total_gtq_local`. Los montos en USD se presentan sin IVA y los de Q con IVA, exactamente como los ve el cliente; el total general no agrega IVA adicional.
- **Rentabilidad interna:** `venta_total_gtq` suma las ventas sin IVA. Para líneas en Q con `lleva_iva = true`, la venta sin IVA es `venta / 1.12`. Para líneas en USD, la venta ya está sin IVA.
- **Modo oscuro:** no en v1.

### Orden de construcción

1. Motor de cálculo con tests (incluye el caso Grupo Aliados de la sección 10)
2. Proyecto Supabase, migraciones, semilla
3. Scaffold Next.js, auth, layout
4. Base de tarifas
5. Editor de cotización con resumen en vivo y alertas
6. PDF
7. Dashboard, cambio de estado, duplicar
8. Configuración (empresa, logo, textos legales, margen por defecto)
9. Despliegue en Vercel

---

## Parte 2 — Especificación original (fuente de verdad)

# Especificación para construir: Cotizador Dams Cargo

**Para:** Claude Code (u otro asistente de código)
**Objetivo:** construir una aplicación web de cotizaciones para una agencia aduanal y de logística en Guatemala.
**Estado:** especificación completa y lista para implementar. Todo lo que está aquí salió de documentos reales de la empresa.

---

## 0. Instrucciones para el asistente que construya esto

Lee esta especificación completa antes de escribir código. Al implementar:

- Este documento es la fuente de verdad sobre las reglas de negocio. Si algo no está aquí, **pregunta antes de inventar**, sobre todo en fórmulas de dinero.
- Las fórmulas de la sección 5 fueron verificadas contra expedientes reales. No las "mejores" ni las simplifiques.
- El usuario final no es técnico. Cero jerga en la interfaz, cero pantallas de configuración escondidas.
- Prioriza que funcione bien en escritorio. Móvil es secundario.
- Todo el texto de la interfaz va en **español de Guatemala**.

---

## 1. Contexto de negocio

**Dams Cargo** (razón social: Agencia Nacional de Carga, S.A.) es una agencia de aduanas y logística en Ciudad de Guatemala. Importa carga para sus clientes por vía marítima, aérea y terrestre, y les cobra por gestionar el trámite aduanero, el flete y los servicios asociados.

**Qué es una cotización aquí:** cuando llega un cliente nuevo con una carga que quiere traer a Guatemala, Dams Cargo le arma un documento que dice cuánto le va a costar traerla. Ese documento separa los costos en tres bloques (flete internacional, gastos locales, gastos de naviera), tiene una fecha de vencimiento, y lleva una lista de exclusiones que protege a la empresa.

**El problema que resuelve esta app:** hoy cada cotización se arma a mano en Excel, copiando el formato de una anterior. Se tarda unos 15 minutos, las tarifas viven en la memoria de una persona, y el margen que se aplica no está estandarizado.

**Quién la va a usar:** una o dos personas del área de facturación. No son técnicas, pero manejan Excel bien.

---

## 2. Glosario (necesario para entender la app)

| Término | Significado |
|---|---|
| **Cotización** | Documento con el precio estimado que se le manda al cliente antes de contratar |
| **Flete internacional** | El costo de traer la carga de origen a Guatemala. Se cotiza en USD |
| **Gastos locales** | Trámite de aduana, transporte del puerto a la ciudad, custodio. Se cotizan en quetzales (Q) |
| **Gastos de naviera** | Cargos que cobra la línea naviera en destino, más un depósito en garantía |
| **Consignatario** | La empresa a cuyo nombre viene la carga (el cliente) |
| **FCL / LCL** | Contenedor completo / carga consolidada |
| **CBM** | Metros cúbicos de la carga |
| **Peso volumétrico** | Peso calculado por dimensiones. Se cobra el mayor entre este y el peso real |
| **Custodio / patrulla** | Escolta de seguridad para el transporte terrestre |
| **IVA** | Impuesto al Valor Agregado de Guatemala: **12%** |
| **Q / GTQ** | Quetzal, moneda de Guatemala |
| **Tipo de cambio** | Q por USD. Ronda entre 7.85 y 8.10. El usuario lo edita a mano |

---

## 3. Stack recomendado

Sugerencia, no obligación. Si propones otra cosa, explica por qué.

| Capa | Recomendación | Razón |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Una sola base de código, fácil de desplegar |
| Estilos | **Tailwind CSS + shadcn/ui** | Componentes accesibles y consistentes sin diseñar desde cero |
| Base de datos | **Supabase (Postgres)** | El usuario ya tiene cuenta. Auth incluida |
| Generación de PDF | **React-PDF (@react-pdf/renderer)** o Puppeteer | Ver sección 8, es el requisito más delicado |
| Hosting | **Vercel** | El usuario ya tiene cuenta |
| Formularios | React Hook Form + Zod | Validación tipada |

**Importante sobre el PDF:** no uses "imprimir desde el navegador" como solución final. El PDF debe generarse igual siempre, sin depender de la impresora o el navegador del usuario. Es el documento que va al cliente y representa a la empresa.

---

## 4. Modelo de datos

### Tabla `proveedores`
```
id                uuid PK
nombre            text            -- "Maersk", "Rule Logistics", "Transportes Éxodo"
tipo              enum            -- naviera | agente_origen | transportista | courier | almacenadora | custodio | otro
pais              text
moneda_default    enum            -- USD | GTQ
notas             text
activo            boolean default true
created_at        timestamptz
```

### Tabla `conceptos` (la base de tarifas — el corazón editable)
```
id                uuid PK
proveedor_id      uuid FK → proveedores (nullable)
nombre            text            -- "Flete Marítimo", "Trámite de Aduana"
categoria         enum            -- internacional | local | naviera
moneda            enum            -- USD | GTQ
unidad            enum            -- envio | contenedor | kg | cbm | libra
costo             numeric(12,2)   -- lo que le cuesta a Dams Cargo
tipo_margen       enum            -- porcentaje | monto_fijo | precio_fijo
valor_margen      numeric(12,2)
aplica_iva        boolean         -- ver reglas en sección 5.4
orden             integer         -- para ordenar en la lista
activo            boolean default true
notas             text
```

### Tabla `clientes`
```
id                uuid PK
nombre            text
nit               text
contacto_nombre   text
contacto_email    text
contacto_telefono text
notas             text
activo            boolean default true
```

### Tabla `cotizaciones`
```
id                    uuid PK
numero                text UNIQUE     -- correlativo, ej. "COT-2026-0041"
cliente_id            uuid FK → clientes (nullable, permite cliente nuevo sin registrar)
cliente_nombre        text            -- se guarda copia por si el cliente cambia después
contacto              text
fecha                 date
dias_vigencia         integer default 15
tipo_carga            text            -- "FCL 20GP", "FCL 40HC", "LCL", "Carga aérea", "Terrestre"
kilogramos            numeric
kg_volumetricos       numeric
cbm                   numeric
bultos                integer
medidas               text
mercaderia            text
origen                text
destino               text default 'Guatemala'
transito              text
routing               text
tipo_cambio           numeric(6,4)    -- editable por cotización
estado                enum            -- borrador | enviada | aceptada | rechazada | vencida
total_usd             numeric(12,2)   -- calculado y congelado al guardar
total_gtq             numeric(12,2)
costo_total_gtq       numeric(12,2)
utilidad_gtq          numeric(12,2)
margen_pct            numeric(6,2)
notas_internas        text
created_at            timestamptz
updated_at            timestamptz
```

### Tabla `cotizacion_lineas`
```
id                uuid PK
cotizacion_id     uuid FK → cotizaciones ON DELETE CASCADE
concepto_id       uuid FK → conceptos (nullable — permite líneas manuales)
nombre            text            -- copia del nombre al momento de cotizar
categoria         enum
moneda            enum
cantidad          numeric
costo_unitario    numeric(12,2)   -- CONGELADO al momento de cotizar
tipo_margen       enum
valor_margen      numeric(12,2)
lleva_iva         boolean
venta_total       numeric(12,2)   -- calculado
orden             integer
```

### Tabla `config`
```
clave             text PK
valor             jsonb
```
Guarda: datos de la empresa, logo (URL o base64), notas estándar de la cotización, márgenes por defecto.

> **Regla crítica de diseño:** al guardar una cotización, los costos y márgenes se **copian** a `cotizacion_lineas`. Si mañana cambia la tarifa de un proveedor, las cotizaciones viejas NO deben cambiar. Una cotización enviada es un documento histórico.

---

## 5. Reglas de negocio (fórmulas exactas)

### 5.1 Peso a cobrar
```
peso_cobrable = MAX(peso_real, peso_volumetrico)
```
Mostrar en la interfaz cuál de los dos ganó.

### 5.2 Cálculo de venta por línea

Según `tipo_margen`:

```javascript
// porcentaje: margen sobre el costo
venta = costo * cantidad * (1 + valor_margen / 100)

// monto_fijo: se suma una cantidad fija por unidad
venta = (costo + valor_margen) * cantidad

// precio_fijo: el precio de venta es fijo, el costo solo sirve para calcular margen
venta = valor_margen * cantidad
```

### 5.3 Los tres modos de margen deben ser editables en la interfaz

Este es un requisito explícito del usuario. En cada línea de la cotización debe poder elegir entre:
- **Porcentaje** sobre el costo (ej. 20%)
- **Monto fijo** en la moneda de esa línea (ej. +$50 o +Q200)
- **Precio de venta fijo** (ej. "esto siempre se cobra Q600, sin importar el costo")

Además debe haber un **margen por defecto configurable** que se aplique a las líneas nuevas, pero que el usuario pueda sobrescribir línea por línea.

### 5.4 IVA
```
IVA de Guatemala = 12%
```
Regla real observada en las cotizaciones de la empresa:
- Los montos en **USD se presentan SIN IVA** al cliente.
- Los montos en **Q se presentan CON IVA incluido**.

Esto debe salir escrito en las notas del PDF (ver sección 8.5). El campo `aplica_iva` permite excepciones, por ejemplo el depósito en garantía, que no lleva IVA.

### 5.5 Conversión de moneda
```
monto_gtq = monto_usd * tipo_cambio
```
El tipo de cambio es **editable por cotización** y se guarda con ella. Valor por defecto sugerido: 8.05.

Mostrar el tipo de cambio de forma visible y editable en la pantalla principal, no escondido en configuración. El usuario lo cambia seguido, según el día.

### 5.6 Rentabilidad (solo vista interna, NUNCA en el PDF del cliente)
```
costo_total_gtq  = Σ (costo_linea convertido a Q)
venta_total_gtq  = Σ (venta_linea sin IVA, convertido a Q)
utilidad_gtq     = venta_total_gtq - costo_total_gtq
margen_pct       = utilidad_gtq / costo_total_gtq * 100
```

> **Nota:** el porcentaje es **margen sobre costo**, no sobre venta. Así lo calcula la empresa hoy y así debe quedar, para que los números sean comparables con su histórico.

**Referencia de márgenes reales de la empresa** (útil para las alertas de la sección 7.4):
- Marítimo: ~19%
- Courier aéreo: 44% a 72%

---

## 6. Datos semilla (cargar al crear la base)

Tarifas de ejemplo, tomadas de una cotización real. **El usuario las va a corregir**, así que deben ser fáciles de editar y borrar.

### Flete internacional (USD)
| Concepto | Costo | Unidad | Margen sugerido |
|---|---|---|---|
| Flete Marítimo | 5,750.00 | envio | 10% |
| Flete Aéreo | 0.55 | kg | 50% |
| BL / Documentación | 100.00 | envio | +25 fijo |
| Recolección (Pickup) | 750.00 | envio | 15% |
| Gastos Locales en Origen | 1,600.00 | envio | 10% |
| SED | 30.00 | envio | 15% |
| Seguro de mercadería | 0.00 | envio | 15% |

### Gastos locales (GTQ)
| Concepto | Costo | Unidad | Margen sugerido |
|---|---|---|---|
| Flete Terrestre Puerto a Ciudad | 5,000.00 | envio | 15% |
| Trámite de Aduana | 2,500.00 | envio | 20% |
| Patrulla | 1,500.00 | envio | +200 fijo |
| Custodio | 750.00 | envio | +150 fijo |
| Marchamo Electrónico | 120.00 | envio | +30 fijo |
| Servicios Prestados | 300.00 | envio | precio fijo 600 |
| Transmisión de Declaración | 0.00 | envio | precio fijo 300 |
| Rectificación | 0.00 | envio | precio fijo 475 |
| Entrega Local | 300.00 | envio | 20% |
| Ayudante | 100.00 | envio | +50 fijo |
| Rayos X | 15.00 | envio | +10 fijo |

### Gastos de naviera (USD)
| Concepto | Costo | Unidad | Margen sugerido |
|---|---|---|---|
| Gastos Locales en Naviera | 500.00 | envio | +50 fijo |
| Depósito en Garantía (reembolsable) | 500.00 | envio | precio fijo 500, sin IVA |

---

## 7. Pantallas

### 7.1 Dashboard / inicio
- Lista de cotizaciones recientes con: número, cliente, fecha, estado, total, margen.
- Filtros por estado y búsqueda por cliente.
- Botón grande: **Nueva cotización**.
- Aviso visual de cotizaciones **vencidas** (fecha + días de vigencia ya pasó).

### 7.2 Nueva / editar cotización

Tres secciones en una sola pantalla, sin wizard de varios pasos (el usuario quiere velocidad):

**A. Datos del cliente y la carga**
Cliente (con autocompletado de clientes existentes + opción de escribir uno nuevo), contacto, fecha, días de vigencia, tipo de carga, origen, destino, tránsito, routing, bultos, kilogramos, kg volumétricos, CBM, medidas, mercadería.

**Tipo de cambio** va aquí, visible y editable, con el valor actual grande.

**B. Servicios**
- Lista de conceptos disponibles agrupados por categoría, con checkbox.
- Al marcar uno, se agrega como línea editable con: cantidad, costo, tipo de margen, valor de margen.
- La cantidad se autocompleta según la unidad (si es `kg`, jala el peso cobrable; si es `cbm`, jala el CBM; si es `envio`, pone 1).
- Botón para **agregar una línea manual** que no esté en la base de conceptos.
- Poder reordenar y eliminar líneas.

**C. Resumen en vivo (panel lateral fijo)**
Se actualiza mientras edita:
- Total flete internacional (USD)
- Total gastos locales (Q)
- Total gastos naviera (USD)
- **Total general en Q**
- Costo total, utilidad y margen % → **claramente marcado como INTERNO**, con un color distinto y la leyenda "no aparece en el PDF del cliente"

### 7.3 Base de tarifas
Tabla editable en línea (estilo hoja de cálculo) con: nombre, categoría, proveedor, moneda, unidad, costo, tipo de margen, valor, activo.
- Agregar, editar y desactivar conceptos.
- **Desactivar en vez de borrar** cuando el concepto ya se usó en alguna cotización.
- Buscador y filtro por categoría.
- Importar/exportar CSV sería un plus.

### 7.4 Alertas útiles (no bloqueantes)
- Si el margen total queda **por debajo de 15%**, mostrar aviso ámbar: "Margen bajo comparado con el histórico".
- Si el tipo de cambio está fuera del rango 7.50–8.50, avisar: "Verifica el tipo de cambio".
- Si una línea quedó con costo 0 y margen porcentaje, avisar que el precio saldrá en 0.

---

## 8. El PDF para el cliente (lo más importante)

Este documento representa a la empresa frente al cliente. Tiene que verse impecable.

### 8.1 Manejo del logo
El usuario va a proporcionar el archivo del logo de Dams Cargo.

- Debe haber una pantalla de **Configuración → Datos de la empresa** donde se pueda **subir el logo** (PNG o SVG, con fondo transparente).
- Guardarlo en Supabase Storage o como base64 en la tabla `config`.
- Si no hay logo cargado, usar un marcador de posición con el nombre de la empresa en texto — **nunca** dejar un espacio roto o un ícono de imagen rota.
- En el PDF el logo va arriba a la izquierda, con altura de ~55px y ancho proporcional.

### 8.2 Datos de la empresa (también editables en Configuración)
```
Razón social:  Agencia Nacional de Carga, S.A.
Nombre comercial: Dams Cargo — Aduanas & Logística
Dirección: 12 calle 2-04 zona 9, Edificio Plaza del Sol, 3er Nivel, Oficina 315
           Guatemala, Guatemala. Código Postal 01009
NIT: 54820510
PBX: 2225-5400
Web: www.damscargo.com
Correo: info@damscargo.com
```

### 8.3 Estructura del PDF (respetar este orden)

```
┌──────────────────────────────────────────────┐
│ [LOGO]  Dams Cargo                           │
│         Aduanas & Logística                  │
│                                              │
│      COTIZACIÓN  ·  No. COT-2026-0041        │
├──────────────────────────────────────────────┤
│ Tabla de datos de la carga (2 columnas)      │
│  Fecha · Consignatario · Contacto · Carga    │
│  Kilogramos · Kg Volumétricos · CBM          │
│  Medidas · Bultos · Mercadería               │
│  Origen · Destino · Tránsito · Routing       │
├──────────────────────────────────────────────┤
│        Válido al [fecha + días vigencia]     │
├──────────────────────────────────────────────┤
│ FLETE INTERNACIONAL          Monto (USD)     │
│  Descripción            │         $ 0,000.00 │
│  ...                                          │
│  TOTAL                  │         $ 0,000.00 │
├──────────────────────────────────────────────┤
│ GASTOS LOCALES               Monto (Q)       │
│  ...                                          │
│  TOTAL                  │         Q 0,000.00 │
├──────────────────────────────────────────────┤
│ GASTOS EN NAVIERA            Monto (USD)     │
│  ...                                          │
├──────────────────────────────────────────────┤
│ Notas (ver 8.5)                              │
│ Corre por cuenta del cliente (ver 8.5)       │
└──────────────────────────────────────────────┘
```

### 8.4 Reglas del PDF
- **NUNCA mostrar costo, margen ni utilidad.** Solo precios de venta. Esto es crítico.
- Si una sección no tiene líneas, se omite completa (no dejar tablas vacías).
- Formato de moneda: `$ 5,750.00` y `Q 9,750.00`, con separador de miles.
- Fechas en formato `DD/MM/AAAA`.
- Nombre del archivo al descargar: `Cotizacion_[Cliente]_[Numero]_[Fecha].pdf`
- Debe caber en 1 o 2 páginas. Si son 2, repetir el encabezado.

### 8.5 Textos legales (van tal cual, son de la empresa)

**Notas:**
- Datos en $ no incluyen IVA
- Datos en Q sí incluyen IVA
- Se trabaja en base a datos brindados por el cliente
- No incluye almacenajes, demoras y sobrepeso
- No incluye seguro de mercadería, en caso requerido podemos cotizar
- La cotización no es para carga IMO, no aceite, no marca o copia, no baterías, no motores
- No incluye pago de impuestos (cliente paga directo a la SAT)
- No incluye almacenaje (cliente paga directo a PUERTO o ALMACENADORA)
- No incluye estadías ni revisiones por autoridades en puertos
- Salidas sujetas a disponibilidad de espacios con la naviera

**Corre por cuenta del cliente lo siguiente:**
- Permisos especiales, incluyendo gastos fitosanitarios, cuarentena
- Multas por sobrepeso

Estos textos deben ser **editables en Configuración**, porque pueden cambiar.

---

## 9. Diseño visual

El usuario pidió explícitamente que se vea bien y sea fácil de usar. Lineamientos:

- **Paleta:** azul marino corporativo (`#1F3864`) como color principal, gris claro de fondo (`#F4F6F9`), blanco para tarjetas, ámbar (`#E8A33D`) solo para acentos y alertas, verde (`#2E7D4F`) para indicadores positivos.
- **Tipografía:** una sans-serif limpia (Inter o similar). Números tabulares en las tablas para que las columnas de dinero se alineen.
- **Densidad:** que quepa información sin sentirse apretado. Este usuario viene de Excel, no le tengas miedo a las tablas.
- Soporte de modo oscuro es un plus, no un requisito.
- **Nada de animaciones innecesarias.** Es una herramienta de trabajo, no una landing page.

---

## 10. Criterios de aceptación

La app está lista cuando:

- [ ] Se puede crear una cotización completa en menos de 3 minutos
- [ ] Los tres tipos de margen (porcentaje, monto fijo, precio fijo) funcionan y son editables por línea
- [ ] El tipo de cambio se edita desde la pantalla principal y afecta los totales en vivo
- [ ] El panel interno muestra costo, utilidad y margen, claramente separado de lo que ve el cliente
- [ ] Se pueden agregar, editar y desactivar conceptos de la base de tarifas sin tocar código
- [ ] El PDF se genera con el logo, los tres bloques, la vigencia y las notas legales
- [ ] El PDF **no contiene** ningún dato de costo o margen
- [ ] Editar una tarifa hoy no cambia el total de una cotización guardada ayer
- [ ] Se puede duplicar una cotización existente para crear una nueva
- [ ] Todo el texto de la interfaz está en español

### Caso de prueba con números reales

Cargar esta cotización y verificar los cálculos:

```
Cliente: Grupo Aliados Estratégicos, S.A.
Carga: FCL 20GP · Origen China · Destino Guatemala
Tipo de cambio: 8.05

Flete internacional (USD, sin IVA):
  Flete Marítimo               $ 5,750.00
  BL                           $   100.00
  Recolección                  $   750.00
  Gastos Locales en Origen     $ 1,600.00
  TOTAL                        $ 8,200.00

Gastos locales (Q, con IVA):
  Flete terrestre Puerto-Ciudad  Q 5,000.00
  Trámite de Aduana              Q 2,500.00
  Patrulla                       Q 1,500.00
  Custodio                       Q   750.00
  TOTAL                          Q 9,750.00
```
Estos son precios de **venta** al cliente. Configura los costos hacia atrás para que los márgenes den estos totales, y verifica que el PDF muestre exactamente estos números.

---

## 11. Qué NO construir (fuera de alcance)

Para evitar que el proyecto se infle:

- Sin facturación electrónica (FEL). Eso es otro sistema.
- Sin módulo de seguimiento de carga ni tracking.
- Sin portal para que el cliente entre. Por ahora el PDF se manda por correo a mano.
- Sin integración con contabilidad.
- Sin app móvil nativa.
- Sin multi-empresa. Solo Dams Cargo.
- Sin roles complejos. Un login simple basta para arrancar.

Si se piden después, se agregan. Primero que esto funcione bien.

---

## 12. Mejoras para una segunda versión

Anotarlas pero **no construirlas ahora**:

- Consultar el tipo de cambio automáticamente del Banco de Guatemala
- Convertir una cotización aceptada en un expediente
- Enviar el PDF por correo desde la misma app
- Historial de cambios de tarifas
- Reporte de márgenes por cliente y por tipo de operación
- Plantillas de cotización por tipo de carga

---

## 13. Lo que le falta a esta especificación

Puntos que el usuario debe confirmar con la empresa antes de que se consideren cerrados:

1. Formato exacto del correlativo de cotización (aquí se asumió `COT-AAAA-####`).
2. Si hay clientes con tarifas especiales distintas a la base general.
3. Si el depósito en garantía lleva IVA o no.
4. Si quieren que el PDF vaya en español únicamente o también en inglés para proveedores.

Implementa asumiendo lo que dice esta especificación y deja esos puntos fáciles de cambiar.
