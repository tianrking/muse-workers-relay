# Mori · Muse Gadgets para Spotpear

[English](README.md) · [Español](README.es.md) · [繁體中文](README.zh-TW.md)

Firmware nativo con **ESP-IDF 6.1** para la **Spotpear ESP32-S3 con pantalla circular de 1,8 pulgadas V1**, un cliente web React y un relay de Cloudflare Workers para conectar con los servicios oficiales de Muse.

La web y el relay funcionan en un solo Worker. Instancia personal actual: [muse.2fast.cfd](https://muse.2fast.cfd/). Puedes alojar tu propia instancia. No se garantiza acceso desde cualquier país, menor latencia ni funcionamiento sin proxy: depende de la red y del servicio oficial.

Proyecto independiente basado en [Meta Muse Gadget SDK](https://github.com/facebookincubator/muse-gadget-sdk), revisión de referencia `8e613f77f3a95a63e70cf8be549db9e589105ea0`. No es un producto oficial de Meta. La documentación original se conserva en [README.upstream.md](README.upstream.md).

## Contenido del repositorio

| Componente                | Función                                                                           | Ubicación                               |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| Firmware Spotpear         | Pantalla, táctil, interfaces de audio, SD, configuración BLE y Muse UI            | `main/`, `components/muse/`, `devices/` |
| Mori Studio               | Cliente React y TypeScript con texto en streaming y conversaciones independientes | `studio/`                               |
| Relay                     | Reenvío REST/WS a destinos oficiales fijos y adaptación para navegadores          | `relay/worker.template.mjs`             |
| Herramientas y resultados | Compilación, diagnóstico de red, pruebas y mediciones                             | `tools/`, `docs/`, `studio/docs/`       |

La web no necesita servidor Python: ejecuta código estático en el navegador y un Worker. Python se utiliza para las herramientas del firmware y el exportador Linux opcional. Los ejemplos Arduino externos son referencias, no dependencias de ejecución.

## Autorización y arquitectura

```text
Primera autorización: token SDK en gadget → BLE cifrado con la app oficial
                                         → access_token + refresh_token

ESP32 ── HTTPS / Noise WebSocket ──┐
                                  ├── Worker ── servicios oficiales de Muse
Navegador Mori ── adaptador web ───┘
```

El Worker reenvía a `api.muse.ai` y al endpoint Noise de la VM oficial. No descifra los mensajes Noise, no guarda tokens de dispositivos y no acepta destinos arbitrarios. El adaptador web gestiona CORS y convierte la autenticación del subprotocolo WebSocket en cabeceras oficiales. El relay no proporciona una cuenta Muse.

| Credencial                | Uso                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Token SDK `mgst_…`        | Configurar el gadget y participar en el emparejamiento; no permite chatear por sí solo |
| Device access token       | Acceder a los servicios de dispositivo de tu Muse                                      |
| Refresh token + device ID | Renovar un par de credenciales existente                                               |
| Clave del relay           | Proteger rutas MCU/personalizadas; no sustituye la autorización Muse                   |

### Ruta principal: ESP32

1. Crea tu propio token en [Muse Gadgets](https://gadgets.muse.ai/settings/sdk-tokens).
2. Guárdalo en `secrets/sdk-token.txt`, compila y graba el firmware.
3. En la app oficial: **Settings → Devices → Developer mode → Add Device**.
4. Selecciona `MuseGadget-XXXXXX`, confirma en la pantalla circular y configura Wi-Fi.
5. Importa en Mori el JSON de tu dispositivo emparejado con `access_token`. Añade `refresh_token` y el `device_id` correspondiente para renovación manual.

El token SDK se entrega al teléfono dentro de la confirmación BLE cifrada. El teléfono aporta la autorización de la cuenta y entrega las credenciales al gadget. Sus propias solicitudes de inicio de sesión no usan automáticamente el relay del MCU. Después del emparejamiento, el chat funciona por Internet, sin BLE.

Todavía no hay una exportación ESP32 de credenciales con un solo clic documentada en este proyecto. Los archivos locales de prueba se excluyen de Git; nunca publiques credenciales ajenas.

### Ruta opcional: Linux

El [SDK Linux oficial](https://github.com/facebookincubator/muse-gadget-sdk/tree/main/linux) sustituye la placa por un ordenador Linux. Necesita BlueZ, un adaptador BLE capaz de actuar como periférico, conexión de red y la app oficial. `confirm_app` elimina el botón físico, no la autorización de la cuenta.

Instala el SDK oficial, ejecuta `sudo musegadget pair` y completa la autorización en el teléfono. Importa `/var/lib/musegadget/pairing.json`; puedes añadir el `identity.json` de ese mismo dispositivo para completar `device_id`. También puedes usar [el exportador local](studio/public/assets/mori-linux-export.py):

```sh
sudo python3 mori-linux-export.py --output ./mori-device.json
```

Solo lee archivos locales y exporta los campos necesarios. Crea un archivo nuevo privado, no imprime tokens, no accede a Internet y no instala ni detiene servicios. Evita renovar el mismo refresh token simultáneamente desde Linux y la web. El emparejamiento BLE real en Linux aún no se ha probado aquí.

Las credenciales Linux importadas en Mori utilizan el mismo relay. El SDK Linux sin modificar no añade nuestra cabecera de clave; cambiar únicamente su hostname no basta para usarlo directamente con las rutas protegidas. No se incluye una app Android auxiliar.

### Límites del token corto

Las pruebas PC de `POST /device_token/mint` usando solo el token SDK devolvieron **401**, tanto directamente como a través del relay, con respuestas idénticas. El código oficial requiere una credencial de usuario/sesión adecuada. No se ha verificado una autorización web pública de Muse personal para obtenerla. No extraemos cookies ni implementamos el login privado. Consulta [el registro](relay/pc-login-authorization-research.json).

## Compilar y grabar el firmware

La placa V1 medida incorpora ESP32-S3, 16 MB flash, 8 MB PSRAM octal, ST77916 QSPI de 360 × 360, CST816S, DAC PCM5100A, micrófono MSM261S4030H0R y SDMMC. Consulta [la guía de placa](devices/spotpear-s3-180-v1.md) y [los pines](components/muse/boards/spotpear_v1/spotpear.h). No se afirma compatibilidad con el micrófono V2.

El wrapper Windows requiere ESP-IDF **6.1** instalado y registrado en `C:/Espressif/tools/eim_idf.json`; no instala el SDK. Lee el token privado y genera `build-spotpear/`. La guía upstream 6.0.1 es histórica: este port utiliza 6.1.

Desde la raíz del repositorio, con un intérprete Python adecuado:

```powershell
python tools/spotpear.py build
python tools/spotpear.py flash --port COM3
python tools/spotpear.py monitor --port COM3
```

Sustituye COM3 por el puerto real y confirma la placa antes de grabar. La grabación normal conserva NVS y el emparejamiento. Borrar toda la flash elimina la configuración y no forma parte de esta guía.

Copia [el ejemplo de backend](relay/muse-relay.example.h) a `secrets/muse-relay.h`. Con `MUSE_RELAY_DIRECT` definido se utilizan los servidores oficiales. Para relay, elimina esa definición, configura `MUSE_RELAY_HOST` y `MUSE_RELAY_KEY`, recompila y graba. No incluyas valores reales en el ejemplo versionado.

El cliente adaptado cubre consulta de VM, emisión, renovación y Noise. Actualizar la web no actualiza automáticamente la placa física.

## Usar Mori Studio

Abre la web, añade una cuenta, selecciona el origen ESP32/Linux, importa el JSON emparejado, asigna un nombre y conecta. El relay predeterminado no pide clave a usuarios de la web, pero sí exige sus propias credenciales Muse. Los ajustes avanzados permiten otro relay HTTPS compatible y requieren confirmar la confianza antes de enviarle credenciales.

Funciones:

- Perfiles de cuenta y credenciales separados; historial local por cuenta.
- Conversaciones independientes con UUID; chat principal mediante selección explícita.
- Comprobación de session ID y estado de hilo en la respuesta oficial.
- Markdown en streaming, código, tablas, copia, seguimiento del scroll y detener recepción.
- Búsqueda, cambio de nombre, archivo/restauración local y exportación Markdown.
- Temas claro/oscuro, barra lateral móvil y diagnóstico.
- Tres intentos de reconexión con esperas de 2/4/8 segundos; no reenvía mensajes automáticamente.
- Bóveda local opcional AES-256-GCM con PBKDF2-SHA256, 210.000 iteraciones; la contraseña no se envía.
- Renovación manual con aviso si las credenciales se comparten con otro dispositivo.

Por defecto, los tokens solo viven en memoria y se pierden al recargar. La persistencia cifrada es opcional. El texto de las conversaciones se guarda localmente sin cifrar. Archivar no elimina datos de la nube; detener recepción no garantiza cancelar la tarea remota. Se necesita HTTPS y Web Crypto X25519 en un navegador moderno. El audio web no está validado.

### Desarrollo frontend

Usa Node compatible con las versiones fijadas de Vite/TypeScript; Node 22.18+ o una LTS posterior compatible es una base práctica. Instala pnpm si no lo tienes.

```sh
cd studio
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm test
```

La dirección local es `http://127.0.0.1:5173`. Configura `VITE_DEV_ADAPTER_URL` en `studio/.env.local` para tu Worker; Vite reenvía REST y WebSocket. Los archivos de entorno locales se ignoran.

## Desplegar tu propio Worker

Compila primero `studio`. Utiliza tu cuenta Cloudflare y la plantilla genérica:

```sh
cd relay
pnpm install --frozen-lockfile
# Copia wrangler.example.jsonc a wrangler.local.jsonc y elige un nombre único.
pnpm exec wrangler login
pnpm exec wrangler deploy --config wrangler.local.jsonc
pnpm exec wrangler secret put MUSE_RELAY_KEY --config wrangler.local.jsonc
```

El primer deploy crea el Worker; responde 503 hasta configurar el Secret. Introduce una clave privada fuerte cuando Wrangler la pida. No la incluyas en JavaScript ni Git. El binding `ASSETS` sirve `../studio/dist` junto a la API.

Usa la URL workers.dev para web y relay, o vincula un dominio propio. El mismo origen se admite automáticamente; añade orígenes externos exactos a `BROWSER_ORIGINS` si alojas el frontend aparte. No se admiten comodines. Vuelve a desplegar tras modificar configuración o assets.

`wrangler.test-account.jsonc` y `wrangler.jsonc` pertenecen a despliegues personales actuales/históricos. No reutilices sus cuentas sin modificar: utiliza `wrangler.example.jsonc`. Se aplican cuotas de Cloudflare; no se promete servicio gratuito ilimitado.

| Ruta                             | Autenticación                                             |
| -------------------------------- | --------------------------------------------------------- |
| `GET /health`                    | Pública después de configurar el Secret                   |
| `GET /web/account`               | Bearer de dispositivo + contexto web permitido            |
| `POST /web/refresh`              | Bearer de renovación + contexto web permitido             |
| `WS /web/official-noise?vm_id=…` | Token VM en subprotocolo + Origin permitido               |
| `GET /fetch_vms`                 | Bearer Muse + clave relay                                 |
| `POST /device_token/mint`        | Bearer Muse adecuado + clave relay                        |
| `POST /device_token/refresh`     | Bearer de renovación + clave relay                        |
| `WS /v1/noise?vm_id=…`           | Bearer Muse + clave relay                                 |
| `WS /web/noise?vm_id=…`          | Token VM y clave relay en subprotocolo + Origin permitido |

`mode=official` es un valor interno histórico para el adaptador del mismo origen, mostrado como relay predeterminado; no significa conexión directa del navegador a Muse. [Contrato detallado](relay/BROWSER-API.zh-CN.md).

## Verificación y límites

Estado registrado el **15 de octubre de 2026**:

- Firmware compilado y grabado con IDF 6.1; pantalla/UI confirmadas por el usuario y conversaciones correctas. Salida audible DAC sin verificar; grabación COM4 y estado Online verificados en esta prueba.
- Trabajo medio de refresco reducido de 105,41 a 39,33 ms. No es una medida de FPS del panel.
- Pruebas web reales de cuenta, Noise, chat principal, hilos independientes, relay personalizado y reanudación. Los perfiles usaron la misma cuenta; no prueban registro de cuentas nuevas.
- Pasaron 9 pruebas cliente/exportador y 16 pruebas Worker. No equivalen a pruebas de resistencia prolongadas.
- Token SDK solo: mint 401. Token de dispositivo existente mediante relay: consulta 200.
- Importación/exportación Linux probada localmente; BLE real y propiedad de archivos en Linux pendientes.
- PC con proxy y conversaciones MCU mediante relay verificadas anteriormente. MCU Online en omg, que el usuario confirmó sin proxy; otras redes y acceso mundial no demostrados.
- Renovación manual y reintentos implementados; rotación real compartida y desconexiones forzadas prolongadas no validadas.

La suite histórica de firmware informó 129 pruebas correctas y 28 omitidas; la suite POSIX upstream completa no pasó en Windows. La importación automatizada por Chrome se bloqueó por falta de permiso de URL de archivo en la extensión; el parser sí tiene pruebas locales. Evidencia: [web](studio/docs/VERIFICATION.zh-CN.md), [Linux](studio/docs/LINUX-ONBOARDING.zh-CN.md), [relay](relay/LIVE-VERIFICATION.zh-CN.md), [pantalla](docs/perf/results.md).

Despliegue web actual: `mori-studio-v1.4`, versión `3fd6e9ef-8f9f-4def-a262-a0ce047e9385`. El MCU ya fue grabado con muse.2fast.cfd y devolvió Connected / Online en el hotspot omg. El usuario confirmó que no había proxy/VPN y que funcionaba. Véase [el registro de hardware](relay/MCU-HOTSPOT-VERIFICATION.md); no constituye una prueba prolongada ni mundial.

## Diagnóstico y publicación

Ready no prueba conexión a la nube: revisa HTTP y Noise. Ante 401, distingue token SDK, device token y clave relay. Ante errores CORS/WS, revisa HTTPS, Origin exacto, VM ID y compatibilidad del relay. No pongas credenciales en la URL.

La conectividad del PC no demuestra la del MCU. La [guía del hotspot Windows con proxy](docs/NETWORK-HOTSPOT.zh-CN.md) conserva el procedimiento probado; revisa sus rutas y contraseña antes de reutilizarlo.

Versiona código, lockfiles, documentación y plantillas. Mantén privados `secrets/`, builds, capturas de red, `.dev.vars`, configuración local Wrangler y `.env.local`. Los binarios contienen el token SDK. Revisa archivos e historial antes de push. Existen commits locales incrementales; el remote se añadirá cuando el propietario facilite su URL.

## Licencia

El código derivado conserva copyright Meta y [Apache-2.0](LICENSE). El avatar Jollybot no está cubierto por esa licencia del SDK; consulta los términos upstream antes de redistribuir assets o firmware. Las dependencias mantienen sus propias licencias: [guía original](README.upstream.md). El acceso al servicio y los tokens están sujetos a los [términos Gadget SDK](https://gadgets.muse.ai/sdk-terms); la licencia del código no concede acceso ilimitado ni permiso para compartir credenciales.

El archivo heredado `dev_signing_key.pem` es una clave privada de firma de desarrollo distribuida públicamente con el código, no una credencial privada de producción. No la uses para confianza de producción ni publiques tus propias claves de firma.
