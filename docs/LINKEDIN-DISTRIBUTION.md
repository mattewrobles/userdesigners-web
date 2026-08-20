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
