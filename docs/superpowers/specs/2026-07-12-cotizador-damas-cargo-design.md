# Diseño: Cotizador de importaciones Damas Cargo

## Objetivo

Crear una aplicación web privada y desplegada para que el equipo de Damas Cargo cotice importaciones hacia Guatemala de forma rápida, consistente y presentable. La aplicación será una **herramienta de estimación comercial**, no una liquidación tributaria oficial.

## Usuarios y permisos

| Rol | Capacidades |
| --- | --- |
| Asesor | Crear, editar, duplicar y consultar sus cotizaciones; modificar los renglones de una cotización; generar una vista para compartir. |
| Administrador | Todas las capacidades del asesor y administración de proveedores, rutas, tarifas, recargos, tipo de cambio, valores predeterminados y usuarios. |

La primera versión se desplegará en un enlace privado con autenticación por correo y contraseña. Las tarifas centrales no podrán modificarse desde la vista del asesor.

## Flujo principal

1. El asesor inicia una cotización y registra cliente, proveedor y descripción de mercancía.
2. Selecciona país/puerto de origen, destino/aduana en Guatemala, modalidad (marítima, aérea o terrestre) y condición de carga (consolidada o contenedor completo).
3. Introduce Incoterm, moneda, valor de mercancía, peso bruto, volumen y, si corresponde, tipo de contenedor y partida SAC.
4. La aplicación aplica la tarifa de ruta/proveedor, los recargos y las reglas configuradas; el asesor puede ajustar cada renglón.
5. Se presenta el costo estimado, junto con el detalle y la vigencia. El asesor guarda o comparte un resumen apto para el cliente.

## Datos de la cotización

### Comercial y carga

- Cliente, proveedor y descripción de mercancía.
- País y puerto de origen, puerto/aduana de destino, modalidad de transporte.
- Incoterm, moneda, valor comercial/FOB y tipo de cambio.
- Consolidado o contenedor completo; tipo de contenedor (20', 40', 40' HC), peso bruto, volumen CBM y cantidad de bultos.
- Partida SAC de 8 dígitos, país de origen y país de procedencia.

### Costos calculados y editables

- Flete internacional, seguro, gastos de origen, manejo/terminal, agente aduanal, documentos, transporte local, bodegaje y otros cargos.
- DAI y IVA estimados.
- Margen Damas Cargo y total mostrado al cliente.

La base CIF estimada será `FOB + flete + seguro`. Cada cargo conserva su método de cálculo (fijo, por peso, por CBM, por contenedor o porcentaje) y su valor final editable.

## Impuestos y advertencias

El cálculo tributario es referencial. La aplicación mostrará DAI e IVA usando porcentajes configurables; los valores deben poder ser sobreescritos por el asesor. Si falta la partida SAC o el país de origen, el sistema indicará que la tasa debe validarse.

La cotización compartible incluirá: “Estimación sujeta a clasificación arancelaria, valor en aduana, permisos, selectividad y revisión documental.” No afirmará que el monto es liquidación oficial.

## Administración de tarifas

El administrador podrá crear y modificar:

- Proveedores, navieras/agentes y vigencia de sus tarifas.
- Rutas por origen, destino, modalidad, servicio y contenedor/consolidado.
- Recargos y reglas de cálculo.
- Tipo de cambio, tasas predeterminadas de DAI/IVA y margen recomendado.

Las tarifas nuevas no alterarán cotizaciones ya guardadas: cada cotización conservará una copia de los valores usados al momento de generarse.

## Interfaz

La página principal será el cotizador: formulario guiado a la izquierda y una tarjeta de total persistente a la derecha. La captura se dividirá en “Ruta y carga”, “Valor y aduana” y “Desglose”, evitando una tabla extensa desde el inicio.

La estética será logística editorial: azul noche como color base, ámbar para estados/acción y blanco cálido para superficies. Tipografía expresiva para cifras clave, interfaz densa pero legible y controles amplios para trabajo de oficina. Debe funcionar en escritorio y móvil.

## Arquitectura propuesta

- Aplicación web de una ruta inicial: cotizador, historial y administración bajo navegación protegida.
- Persistencia central para usuarios, configuración/tarifas y cotizaciones.
- Motor de cálculo puro y testeable, separado de la interfaz y de la base de datos.
- Despliegue administrado con URL privada para el equipo.

## Reglas de calidad

- Validar números positivos, moneda y campos necesarios según modalidad de carga.
- Mostrar claramente la moneda de cada monto y la fecha de vigencia.
- Recalcular de forma inmediata al editar un dato.
- Permitir guardar borrador sin partida SAC, pero señalar el impuesto pendiente de validar.
- Pruebas unitarias para CIF, cargos por unidad y total; pruebas de interfaz para los flujos de cotización y permisos.

## Alcance de la primera versión

Incluye el flujo de cotización, administración de datos operativos, autenticación, historial y compartir el resumen. Quedan fuera: transmisión de DUCA, consulta automática del arancel SAT, carga documental, facturación y portal de clientes.

## Reglas operativas precisas

### Moneda, cargos e impuestos

La salida se presenta en USD. Se aceptan importes USD y GTQ; las tarifas pueden tener su propia moneda. Un tipo de cambio administrado, fechado y guardado en la cotización convierte cada valor a USD. Los cargos se redondean a dos decimales; los cálculos internos conservan cuatro decimales hasta el resultado.

El valor de factura se registra conforme al Incoterm. Para Incoterms distintos de FOB, el asesor marca los componentes de flete y seguro ya incluidos para no duplicarlos. CIF se forma con el valor FOB equivalente, flete y seguro. DAI se estima sobre CIF e IVA sobre CIF + DAI; otros cargos no se incluyen en la base de impuesto. La tasa partida-origen prevalece sobre la tasa global; ambas son configurables. Un asesor puede ajustar un cargo o impuesto sólo con motivo obligatorio; la interfaz muestra siempre si es tarifa, regla, predeterminado o ajuste manual.

Cada regla de cargo define método (fijo, peso, CBM, contenedor o porcentaje), unidades, base porcentual, mínimo, condiciones y redondeo de unidad. El margen se calcula al final sobre su base configurada.

### Resolución de tarifas y ciclos

La tarifa se resuelve por coincidencia exacta de modalidad, origen, destino, proveedor, tipo de carga/contenedor y vigencia. Luego se admiten coincidencias con proveedor o tipo genéricos y, por último, el predeterminado. Entre coincidencias se usa prioridad configurable y luego la más recientemente actualizada. Si no hay tarifa, se crea un renglón pendiente y no se puede finalizar hasta que el asesor ingrese un valor.

Cada cotización tiene número consecutivo, creador, fechas, vigencia, fecha efectiva de tarifas y estado: borrador, finalizada, compartida, vencida o revocada. Al refinalizar se crea una nueva versión. Toda versión conserva la instantánea de tarifas, reglas, tasas, tipo de cambio y ajustes, además de los montos finales.

### Seguridad y operación

El primer administrador se configura durante la puesta en marcha y administra altas, bajas y restablecimiento de contraseñas. Los asesores sólo ven sus cotizaciones; los administradores ven y editan todas. La desactivación conserva los registros históricos. Los cambios administrativos generan auditoría.

Un enlace compartido es de solo lectura, no adivinable, no indexable, revocable y con vencimiento configurable. Expone sólo la versión publicada y la información para cliente; permite impresión/PDF, pero no muestra tarifas internas ni notas privadas. Producción y desarrollo usan configuración separada, secretos protegidos por HTTPS, respaldo de datos y retención configurable.

### Validación ampliada

Marítimo exige origen, destino y tipo de carga; FCL exige contenedor y consolidado exige CBM. Aéreo exige peso o peso volumétrico y terrestre exige ruta. Los campos de contenedor no aparecen fuera de marítimo. Peso admite tres decimales y volumen cuatro. Las pruebas incluyen conversión/redondeo, Incoterms, DAI/IVA, precedencia y ausencia de tarifas, instantáneas tras cambios, revocación de enlace y autorización asesor/administrador.

### Normalización adicional

El tipo de cambio se guarda como GTQ por USD. Para un importe GTQ, el sistema calcula USD como `GTQ / tipo_de_cambio`; para mostrar GTQ, calcula `USD * tipo_de_cambio`. Cada importe se convierte antes de aplicar reglas y se redondea sólo al mostrar el renglón.

Para Incoterm FOB, CIF es `valor_factura + flete + seguro`. Para CFR/CPT, el valor factura ya contiene flete: CIF es `valor_factura + seguro`. Para CIF/CIP, la factura ya contiene flete y seguro: CIF es el valor factura. Para EXW/FCA, el asesor registra FOB equivalente o agrega origen hasta llegar a FOB y luego se añaden flete y seguro. Para DAP/DDP, el asesor debe separar en el formulario el valor hasta destino de los componentes posteriores a la importación; el sistema usa el valor hasta CIF declarado. Si no puede desglosarse, la cotización marca impuestos “pendientes de validar” y no calcula DAI/IVA.

El administrador mantiene tasas DAI por partida SAC de ocho dígitos y país de origen, con vigencia y prioridad; si no existe una coincidencia aplicable se usa el valor DAI global. IVA mantiene un valor global configurable.

Para aéreo, el peso cobrable es el mayor entre peso bruto y peso volumétrico. Peso volumétrico es `CBM * 167 kg`; se permite registrar CBM o dimensiones para obtenerlo. Las reglas aéreas siempre usan peso cobrable en kg y redondean hacia arriba a 0.5 kg, salvo que la regla de tarifa defina otro incremento.
