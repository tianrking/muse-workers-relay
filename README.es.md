# Mori · Relay de Muse en Cloudflare Workers

[English](README.md) · [繁體中文](README.zh-TW.md)

El producto principal es el **relay de Cloudflare Workers** para las API de cuenta de Muse y conexiones WebSocket cifradas con Noise. Mori Studio es un cliente React opcional, servido por el mismo Worker. Es un proyecto comunitario independiente de Meta.

## Organización

- `main`: relay independiente del hardware, pruebas y documentación.
- `relay/`: implementación, configuraciones de despliegue y pruebas de contrato.
- `studio/`: aplicación React + TypeScript opcional, sin servidor de aplicación.
- [`test/esp32-spotpear`](https://github.com/tianrking/muse-workers-relay/tree/test/esp32-spotpear): implementación completa de ESP32, adaptación Spotpear V1, herramientas y pruebas de hardware. Conserva el estado anterior a la separación. Los commits antiguos permanecen en el historial compartido.

## Funcionamiento

El cliente conecta con tu Worker mediante HTTPS/WebSocket. El Worker reenvía a destinos oficiales fijos: `api.muse.ai` para cuentas y `hatch.metaaivm.com` para Noise. Conserva cuerpos y estados HTTP del servidor y devuelve la actualización WebSocket. No descifra las tramas Noise ni interpreta conversaciones o audio.

La clave compartida del relay protege las rutas nativas/personalizadas; cada usuario necesita además sus propias credenciales válidas de Muse. Cloudflare termina TLS y puede ver las cabeceras de autorización. Las rutas de navegador adaptan la autenticación WebSocket y validan Origin; esa comprobación no sustituye la autenticación del usuario.

## Desplegar solamente el relay

Requisitos: Node.js 22.18+ y pnpm. Desde la raíz:

```sh
cd relay
pnpm install --frozen-lockfile
cp wrangler.example.jsonc wrangler.local.jsonc
pnpm exec wrangler login
pnpm exec wrangler deploy --config wrangler.local.jsonc
pnpm exec wrangler secret put MUSE_RELAY_KEY --config wrangler.local.jsonc
```

En PowerShell usa `Copy-Item` en lugar de `cp`. Cambia el nombre del Worker en la copia antes de desplegar. Introduce una clave aleatoria propia y configura la misma en los clientes nativos. Hasta configurar el secreto, el Worker devuelve 503. La configuración local y `.dev.vars` se excluyen de Git.

Comprueba `https://<tu-worker>/health`; este endpoint no demuestra que una cuenta esté autorizada ni que una conversación funcione. Puedes añadir un dominio propio desde Cloudflare.

## Incluir el cliente web opcional

Desde la raíz, ejecuta `cd studio`, `pnpm install --frozen-lockfile` y `pnpm build`. Después, en `relay/`, instala dependencias y copia `wrangler.web.example.jsonc` a `wrangler.local.jsonc`. Configura tu nombre y despliega con los comandos anteriores. Esta variante sirve `studio/dist`.

El navegador usa por defecto las rutas del mismo origen, sin pedir la clave compartida del relay ni incluirla en JavaScript. Para otros sitios, configura `BROWSER_ORIGINS` como una cadena JSON con orígenes exactos. El despliegue personal existente es [muse.2fast.cfd](https://muse.2fast.cfd); quien lo aloje por su cuenta utiliza su propio dominio.

Studio ofrece perfiles de cuenta, selección de Muse, conversaciones independientes con UUID, selección explícita de la conversación principal, respuestas Markdown en streaming, servidores personalizados y almacenamiento local cifrado opcional. Consulta la [documentación de Studio](studio/README.zh-CN.md).

## Contrato y credenciales

| Ruta | Autenticación |
| --- | --- |
| `GET /health` | Pública una vez configurado el secreto |
| `GET /fetch_vms` | Bearer de Muse + `X-Muse-Relay-Key` |
| `POST /device_token/mint` | Bearer apropiado de Muse + clave del relay |
| `POST /device_token/refresh` | Bearer de renovación + clave del relay |
| `WS /v1/noise?vm_id=…` | Token de VM + clave del relay |
| `GET /web/account`, `POST /web/refresh` | Bearer correspondiente + Origin permitido |
| `WS /web/official-noise?vm_id=…` | Token de VM en subprotocolo + Origin permitido |
| `WS /web/noise?vm_id=…` | Token de VM y clave del relay en subprotocolo + Origin permitido |

El navegador envía `muse-v1` y `muse-auth.` seguido de JSON codificado en base64url: `{"token":"<vm_auth_token>","key":"<relay_key>"}`. La ruta del adaptador del mismo origen no necesita `key`. El Worker convierte el token en cabecera oficial y no reenvía el subprotocolo secreto. No pongas tokens en la URL.

Un SDK token corto `mgst_…` no permite chatear por sí solo. Las credenciales de dispositivo se obtienen mediante el emparejamiento oficial con la aplicación Muse; después la API de cuenta proporciona el token de VM. Studio admite credenciales de ESP32 y Linux. No sustituimos el inicio de sesión oficial ni el emparejamiento. Los clientes sin modificar pueden necesitar configurar cabeceras y endpoints adicionales.

## Verificación y límites

En `relay/`: `pnpm test` y `pnpm exec wrangler deploy --dry-run --config wrangler.example.jsonc`. En `studio/`: `pnpm test` y `pnpm build`. Hay 16 pruebas de contrato del Worker y 9 del cliente. Las pruebas simuladas no sustituyen la validación del servicio desplegado.

Las pruebas reales anteriores en PC completaron consulta de cuenta, WebSocket 101, handshake Noise y respuestas de texto a través del relay. La rama de hardware conserva la conexión de Spotpear mediante un hotspot ordinario del usuario. El audio no está completamente validado. Esta reorganización no despliega cambios en producción.

El cliente debe poder acceder a Cloudflare y Muse debe aceptar el tráfico saliente. No se garantiza la misma disponibilidad o latencia en todos los países. No se guardan credenciales ni se cachean respuestas de cuenta. Los ejemplos desactivan observabilidad; no incluyen cuotas por usuario. Revisa tu plan y los controles de acceso antes de compartir un servicio.

## Licencia

Consulta [LICENSE](LICENSE), los avisos de cada archivo y el [SDK oficial](https://github.com/facebookincubator/muse-gadget-sdk). La rama ESP32 conserva las licencias originales. Nunca subas tokens, secretos ni claves de firma de producción.
