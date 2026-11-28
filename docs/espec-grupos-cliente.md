# Especificación — Grupos de cliente en Pazque (máquina genérica)

> Estado: **propuesta para decidir** · Autor: Claude + Federico · Fecha: 2026-11-27
> Benchmark: **Shopify B2B** (Companies + Catalogs + payment terms), **Amazon Business** (business groups + group pricing + aprobación), **Faire** (order minimums + net terms). Empresas probadas; no inventamos, copiamos el patrón.
> Regla de oro: **esto es la máquina genérica, no "el modelo de Eric".** Eric es la primera configuración. Mañana es otro distribuidor con otros números, mismo código, sin tocar nada.

---

## 1. Qué estamos construyendo

Una **máquina genérica de segmentación de clientes** para que CUALQUIER distribuidor que use Pazque defina cómo trata a sus distintos tipos de comprador — precios, pago, facturación y envíos — sin que Pazque hardcodee ninguna regla de ningún cliente.

"B2B / B2C" **no es una función de Pazque**. Son etiquetas que pone cada distribuidor. Para Eric es "Mayorista / Minorista"; para otro puede ser "Franquicias / Food service / Retail". La máquina es la misma.

Esto es exactamente lo que hacen los benchmarks:
- **Shopify**: una tienda sirve retail y mayorista; lo mayorista se define con "Companies" y "Catalogs", gateado por login. Ningún comerciante hardcodeado.
- **Amazon Business**: grupos de compra con sus propias políticas y precios.
- **Faire**: cada marca fija sus mínimos y términos; la plataforma sólo da las perillas.

---

## 2. El principio (de Shopify): las reglas cuelgan del comprador

Nada se marca en el producto ni en el pedido. Todo se decide **al entrar al portal**: según de qué grupo es el cliente, Pazque le arma precios, pago, facturación y envíos. El retail no ve lo mayorista, igual que en Shopify.

---

## 3. El modelo: el grupo es un bundle de perillas OPCIONALES

### El grupo de cliente *(nuevo)*
Un segmento por-org, con **nombre editable**. Empaqueta **defaults opcionales** de:

| Perilla del grupo | Si el grupo la deja vacía… | Benchmark |
|---|---|---|
| Lista de precios | cae a la lista default de la org (compartida) | Shopify "Catalog" |
| Forma / condición de pago | cae al pago default de la org | Shopify "payment terms" |
| Facturación / tipo de comprobante | cae al comprobante default de la org | — (DGI UY: e-Factura / e-Ticket) |
| Métodos de envío permitidos + mínimo | cae a los métodos default de la org | Faire "order minimums" |

**Cada perilla está vacía por defecto y sólo pisa si el distribuidor la llena.** Eso es lo que hace a la máquina genérica: cada org llena sólo lo que de verdad difiere entre sus tipos de cliente.

### La ficha del cliente *(extensión mínima)*
El cliente **pertenece a un grupo** (`grupo_id`, columna nueva) y puede tener **overrides puntuales** (su lista / pago / descuento / envíos propios pisan al grupo). Los overrides por-cliente **ya existen**; lo nuevo es el `grupo_id`.

### La resolución (igual que en precios hoy)
```
Para cada regla (precio, pago, facturación, envío):
    valor del cliente  (si lo tiene)     ← gana   (ej: descuento por cliente)
 ▸  si no, valor del grupo                ← default del segmento
 ▸  si no, default de la org              ← base compartida
```
Es el mismo patrón `cliente > grupo > org` que ya usás en precios. **Cero concepto nuevo.** Esta capa es la que hace que TODO lo de abajo funcione para cualquier distribuidor sin casos especiales.

---

## 4. El mínimo vive en el método de envío, no en el cliente

Ya existe `brandcfg.envio.metodos` (`{id, nombre, tipo: propio|agencia|retiro, costo, cobro}`). Se agrega al método:
- `minimo` (número) y `debajoMinimo` (qué hacer si el carrito no llega), relevante para `tipo: 'propio'` (reparto).

El mínimo es una condición de **repartir**, no de **quién compra** → vive en el método, un solo lugar. Opciones de `debajoMinimo`:
- `oculta` → debajo del mínimo el reparto no aparece; quedan agencia/retiro.
- `cobra_flete` → aparece con flete; gratis arriba del mínimo.
- `bloquea` → no deja cerrar hasta llegar al mínimo.

Es el patrón Faire (mínimos de pedido) pero por **monto**, donde Shopify es flojo (sólo tiene mínimos por cantidad de unidades). Acá Pazque queda incluso mejor que un benchmark.

---

## 5. Alta de un cliente nuevo: la pregunta del RUT al pedir acceso

Dos niveles, atados — clavados en cómo lo hacen los benchmarks:

### 5.1 — El distribuidor declara a quién le vende (interruptor maestro, en config)
Al configurar, elige: **sólo con RUT (B2B)** · **sólo sin RUT (B2C)** · **ambos**. Esto decide si al comprador se le pregunta algo (progressive disclosure, patrón de onboarding de Shopify/Amazon):
- Sólo con RUT → nunca se pregunta; pide RUT, e-Factura. *(flujo de hoy, intacto)*
- Sólo sin RUT → nunca se pregunta; flujo liviano, e-Ticket.
- Ambos → se le pregunta al comprador (5.2).

### 5.2 — El comprador, al primer acceso: ¿tenés RUT?
Pregunta **directa y concreta** — NO "empresa o personal" (es difuso: con RUT se compra para uso propio o para revender; el hecho que importa es el RUT):

> *"¿Tenés RUT?"* — Sí / No · **una sola vez**, al entrar; nunca más.

- **Sí** → pide datos fiscales (RUT, razón social, dir. fiscal, contacto — flujo actual intacto). Comprobante: **e-Factura**. Grupo por defecto: Mayorista *(overridable, ver 5.3)*.
- **No** → flujo liviano (nombre, celular, entrega). Comprobante: **e-Ticket / consumo final**. Grupo: Minorista.

### 5.3 — "Tener RUT" y "ser mayorista" son dos ejes distintos
- **Fiscal** (¿RUT?) → datos + comprobante. Lo declara el comprador.
- **Comercial** (grupo: precios/pago/envíos) → lo **concede el distribuidor**.

La respuesta del RUT **setea el grupo por defecto**, pero el distribuidor lo **re-asigna por cliente** cuando quiere (un comercio chico con RUT puede quedar en minorista). Patrón Shopify/Amazon Business: lo comercial se otorga, no se auto-asigna. Esto además **protege**: un comprador que marca "sí" de más sólo cambia su formulario fiscal, NUNCA se auto-habilita precios mayoristas ni crédito.

**Sin fricción**: nadie se bloquea. El que declara RUT compra igual; el grupo mayorista (precios/crédito) se confirma cuando el distribuidor lo asigna.

---

## 6. Ejemplos de configuración (NO hardcode — sólo ilustran el llenado)

### Ejemplo A — Eric (lista compartida + descuentos por cliente)
| Perilla | Grupo Mayorista | Grupo Minorista |
|---|---|---|
| Lista de precios | *(vacía → lista compartida de la org)* | *(vacía → misma lista)* |
| Diferencia de precio | descuentos por cliente (capa `cliente`) | descuentos por cliente |
| Facturación | e-Factura (con datos fiscales) | consumo final / e-Ticket |
| Pago | *(según configure Eric)* | *(según configure Eric)* |
| Envíos | reparto (mín $X, debajo `oculta`) + agencia + retiro | agencia + retiro (sin mínimo) |

Para Eric el grupo prácticamente sólo toca **facturación + envíos**. El precio es una lista compartida y la diferencia la hacen los **descuentos por cliente** que ya existen. El grupo no toca el precio.

### Ejemplo B — Otro distribuidor (listas distintas por grupo)
| Perilla | Grupo A | Grupo B |
|---|---|---|
| Lista de precios | lista A (setea `listaId`) | lista B (setea `listaId`) |
| Envíos | los que defina | los que defina |

Mismo código. Lo único distinto: este distribuidor **sí** llena la perilla de lista en cada grupo. La máquina no asume nada.

---

## 7. Qué es reuso y qué es nuevo

**Reuso (~70%)** — ya en el código:
- Métodos de envío (`brandcfg.envio.metodos`, panel `EnvioPanel`, tipos propio/agencia/retiro).
- Flete neto + IVA 22%, cobro factura/destino (`PedidosPage`).
- Restricción de métodos por-cliente (`session.envioMetodos`, intersección org ∩ cliente).
- Listas de precio (`lista_id`), condición de pago (`cond_pago`), **descuentos por cliente**.
- Resolución en capas (patrón ya usado en precios).
- Alta de cliente nuevo en el primer pedido (pide datos fiscales).

**Nuevo**:
1. **Entidad grupo** en `brandcfg.gruposCliente` (array `{id, nombre, listaId?, condPago?, facturacion?, envioMetodos?}`, todas opcionales), por-org. Sin tabla nueva: vive en `app_config` como el resto de brandcfg.
2. **Columna `grupo_id`** en `clients` + selector de grupo en la ficha.
3. **Campos `minimo` / `debajoMinimo`** en el método de envío (`EnvioPanel`).
4. **Resolución del grupo**: al armar sesión/catálogo, si el cliente no tiene override, tomar el default de su grupo.
5. **Enforcement del mínimo** en el checkout (`PedidosPage`).
6. **Interruptor del distribuidor** (con RUT / sin RUT / ambos) + pregunta **"¿Tenés RUT?"** al acceso + flujo liviano sin-RUT.
7. **Formas de pago**: lista de config por-org (efectivo / contra entrega / transferencia), que el comprador elige y se registra en el pedido (espeja el patrón de métodos de envío; **sin cobro online** — no pasa plata por Pazque).

---

## 8. Dónde y cuándo lo configura el distribuidor

Todo en su admin `/app`, self-service, sin fee, sin que toquemos código:

| Qué | Dónde | Cuándo |
|---|---|---|
| A quién le vendés (con RUT / sin RUT / ambos) | Configuración → **Tipo de clientes** *(nuevo)* | Una vez, al setup |
| Crear grupos (nombre + perillas que difieran) | Configuración → panel **Grupos** *(nuevo)* | Una vez, al setup |
| Mínimo del reparto + qué pasa debajo | Configuración → panel **Envíos** (`EnvioPanel`) | Una vez |
| Asignar grupo a cada cliente | Ficha del cliente (Clientes) → selector | Al alta / edición de cada cliente |

Dos pantallas de setup una vez, y un desplegable en la ficha después. Los clientes self-serve caen en un grupo por defecto que el distribuidor elige.

---

## 9. Plan de construcción por fases

- **Fase A — Grupos (núcleo).** Entidad grupo + panel admin + `grupo_id` en ficha + resolución. Al terminar, cualquier distribuidor separa sus tipos de cliente con sus perillas.
- **Fase B — Mínimo de reparto.** `minimo` / `debajoMinimo` + enforcement en checkout.
- **Fase C — Alta diferenciada.** Pregunta de intención + flujo liviano B2C + estado "pendiente mayorista" + aprobación del distribuidor.

Deployables en tandas separadas (minimizar builds de Vercel).

---

## 10. Genérico / multi-tenant (el punto central)

- Perillas del grupo **todas opcionales** → cada org llena sólo lo que difiere; el resto cae a defaults compartidos.
- Todo por-org en `brandcfg` + `clients.grupo_id`. Cero `if b2b`/`if b2c` en el código.
- Cada decisión de diseño está copiada de Shopify / Amazon Business / Faire — patrones probados, no inventados.
- "Hoy es Eric, mañana es otro": el otro abre el mismo admin, llena sus grupos con sus números, y funciona sin una línea nueva.

---

## 11. Decisiones

**Tomadas:**
- Máquina genérica de grupos, resolución `cliente > grupo > org`, perillas opcionales.
- Mínimo en el método reparto (por monto).
- Interruptor del distribuidor (¿a quién le vendés?: con RUT / sin RUT / ambos) → decide si al comprador se le pregunta.
- Alta: pregunta literal **"¿Tenés RUT?"** al primer acceso (sólo si vende a ambos), una sola vez. Setea el grupo por defecto, overridable por cliente (ejes fiscal y comercial separados).
- Flujo B2B actual intacto. Nadie se bloquea: lo comercial (precios/crédito) lo concede el distribuidor.
- Precio genérico: soporta lista compartida + descuentos por cliente (Eric) Y listas distintas por grupo (otros), mismo código.

**Tomada (pago B2C):** formas de pago = **efectivo, contra entrega, transferencia** — lista de config que el distribuidor define (como los métodos de envío) y el comprador elige; se registra en el pedido, **no pasa plata por Pazque** → cero riel, cero costo. Cobro online con tarjeta = **después**.

**Decisión de modelo (cuando llegue el cobro online):** la pasarela es **del distribuidor** (modelo **Shopify**), NO de Pazque como intermediario (modelo **Amazon / PedidosYa**). Pazque integra la pasarela que el distribuidor conecta (Mercado Pago, dLocal, etc.); la plata va directo comprador → distribuidor, Pazque **nunca la toca**. Ser el intermediario que mueve la plata = ser *payment facilitator* (licencias, KYC, contracargos, retención de fondos): otro negocio, riesgoso para un bootstrap, y es la **Fase 3 take-rate** deliberada, no esto. No se mezclan: online con pasarela del distribuidor primero; take-rate mucho después y con cuidado.

**Única pendiente (NO bloquea Fase A):** UX del acceso B2C — ¿mismo OTP de WhatsApp o algo más liviano para consumidor final?
