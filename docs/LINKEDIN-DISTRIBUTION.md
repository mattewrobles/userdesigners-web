# Distribución automática a LinkedIn

Cada vez que el sync semanal publica un post nuevo, `sync-blog.yml` intenta
postearlo en la página de LinkedIn de UserDesigners (`scripts/post-to-linkedin.mjs`).
Si faltan credenciales, el paso se salta solo — nunca rompe el sync.

## Setup (pasos manuales — requieren login/consentimiento OAuth humano)

1. Crear una app en [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
   asociada a la página de empresa de UserDesigners.
2. Solicitar el producto **"Share on LinkedIn"** o **"Community Management API"**
   (según cuál esté disponible — LinkedIn cambia esto de nombre seguido).
3. Generar un **access token** con scope `w_organization_social` mediante el
   flujo OAuth 2.0 (requiere login de un admin de la página).
4. Obtener el **Organization URN** de la página (`urn:li:organization:XXXXXXXX`)
   desde la URL del admin panel de la página de LinkedIn.
5. Guardar ambos en Doppler (`project user-designers`, config `prd`):
   - `LINKEDIN_ACCESS_TOKEN`
   - `LINKEDIN_ORG_URN`
6. Agregarlos como GitHub Secrets del repo (`Settings → Secrets → Actions`):
   - `LINKEDIN_ACCESS_TOKEN`
   - `LINKEDIN_ORG_URN`

## Vida del token

Los access tokens de LinkedIn expiran (típicamente 60 días). Cuando el paso
empiece a fallar en el sync, es casi seguro por esto — regenerar el token
siguiendo el paso 3 y actualizar el secret.

## Por qué no se automatiza el paso 3

LinkedIn exige el consentimiento OAuth de un humano logueado como admin de la
página — no existe forma de automatizar esto sin las credenciales de sesión
de Mau, que no corresponde pedir ni manejar por acá.

## Descripción + imagen (Ago 20 2026)

`post-to-linkedin.mjs` ya no copia el meta description (ese está optimizado
para SEO, no para feed social): genera una descripción corta a la medida del
tema vía TokenRouter (necesita también `TOKENROUTER_API_KEY` en Doppler, ya
existe) + CTA fija "Lee más en nuestro blog: <url>". La imagen se sube como
asset nativo de LinkedIn (`shareMediaCategory: IMAGE`) en vez de depender del
scraping de OG tags — hoy usa el `heroImage` del post (Unsplash).

### Card diseñada en Canva (LIVE desde Ago 20 2026)

`post-to-linkedin.mjs` genera la card vía Canva Autofill API antes de subirla
a LinkedIn: título + descripción + el heroImage del post (real, varía por
post, no es una imagen fija) rellenan el Brand Template `EAHSzCLIu-E`
(diseñado por Mau en Canva, campos `title`/`description`/`image` marcados
para autofill). Si Canva falla por cualquier motivo, cae al heroImage plano
sin la card — nunca rompe el sync.

Credenciales en Doppler (`project user-designers`, config `prd`):
`CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REFRESH_TOKEN`,
`CANVA_BRAND_TEMPLATE_ID`.

**Gotcha crítico — el refresh_token de Canva ROTA en cada uso.** Cada
llamada a `/oauth/token` con `grant_type=refresh_token` devuelve un
refresh_token NUEVO e invalida el anterior. Si no se persiste el nuevo,
el siguiente run falla con `"Refresh token used twice"` (le pasó a esta
sesión probando dos veces seguidas). `getCanvaAccessToken()` ya lo maneja:
detecta que vino un refresh_token distinto y lo guarda solo en Doppler vía
`doppler secrets set --no-interactive` (necesita que `DOPPLER_TOKEN_USER_DESIGNERS`,
el secret de GitHub Actions, tenga permiso de ESCRITURA en Doppler, no solo
lectura — verificar esto si el paso empieza a fallar).

**Variedad de templates:** si se quieren 2-4 diseños distintos rotando (no
siempre la misma card), armar más Brand Templates en Canva con el mismo
schema de campos (`title`/`description`/`image`) y guardar sus IDs — el
código elegiría uno al azar entre `CANVA_BRAND_TEMPLATE_ID` (convertir a
lista). No implementado todavía, es la siguiente mejora obvia si Mau la pide.

**Límite de layout:** la descripción se cortó a ~110-130 caracteres a
propósito — el cuadro de highlight detrás del texto NO crece automático vía
Autofill API (solo se ajusta a mano en el editor de Canva), así que un texto
más largo se desborda del cuadro. Si se necesita más texto, hay que agrandar
el cuadro en el template o aceptar el límite de caracteres.
