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

### Upgrade a card diseñada en Canva (pendiente, requiere setup manual)

Ya existe un template base generado en Canva (4 variantes, dark minimalista,
sin brand kit — pedir a Mau el link si se perdió). Para que el pipeline
suba esa card en vez del heroImage:

1. Elegir/editar una de las 4 variantes en Canva, guardarla como Brand Template
   con campos autofill (título, quizás categoría).
2. Crear una app en [Canva Developer Portal](https://www.canva.com/developers/)
   → Connect API, generar Client ID/Secret.
3. Hacer el consentimiento OAuth una vez (requiere login de Mau) para obtener
   un refresh token de larga duración.
4. Guardar en Doppler: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`,
   `CANVA_REFRESH_TOKEN`, `CANVA_BRAND_TEMPLATE_ID`.
5. En `post-to-linkedin.mjs`, reemplazar la línea que arma `imageUrl` (hoy
   `meta.heroImage`) por una llamada al Autofill API de Canva pasando el
   título del post, esperar el export, y usar esa URL — el resto del flujo
   (`uploadImage` → `linkedinPost`) no cambia.

No se automatizó ahora porque el paso 3 (OAuth) requiere login humano de Mau,
igual que el token de LinkedIn.
