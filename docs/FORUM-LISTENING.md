# Forum Listening — escuchar sin postear automático

Objetivo: enterarnos cuando alguien en Reddit/HN habla de algo relacionado a
UX/design systems/fintech design, para (a) comentar nosotros a mano si aplica,
y (b) usarlo como banco de ideas de blog nuevo. **Cero auto-post.** Mau publica
siempre él mismo.

## Por qué así (research hecha antes de construir)

- GummySearch (la herramienta más citada para esto) cerró en nov-2025 porque
  Reddit subió el precio de su API comercial. El reemplazo gratis estándar
  hoy es **F5Bot**.
- Sí existe un patrón n8n ya probado para esto (F5Bot → parseo → Slack/GPT),
  lo adaptamos acá pero cortando la parte de auto-reply.
- Automatizar la RESPUESTA (no la escucha) es lo que quema cuentas: Reddit
  tiene una regla no escrita 90/10 (9 aportes genuinos por cada 1 promocional)
  y puede shadowbanear sin avisar. Automatizar solo el "avisar" es de bajo
  riesgo — la parte de participar la hace Mau, como persona real, siempre.

## Setup (pasos manuales — requieren cuenta/login humano, no los puedo hacer yo)

1. **F5Bot** (gratis): entrar a [f5bot.com](https://f5bot.com), registrar el
   email que va a recibir las alertas (ideal: una cuenta/alias dedicado, no
   el email personal de Mau) y cargar keywords, por ejemplo:
   - `design system` + `fintech`
   - `necesito diseñador UX Ecuador` / `necesito diseñador UX Latam`
   - `rediseño web` + `ecuador` / `cuenca`
   - `UX research` + `startup`
   Hasta 100 keywords, gratis.
2. **Gmail**: si el email de F5Bot no es Gmail, agregar un forward automático
   hacia una cuenta Gmail (Gmail es lo que soporta el nodo trigger de n8n).
3. **n8n**: importar `scripts/n8n-forum-listening-workflow.json` como workflow
   NUEVO (no tocar el workflow protegido del blog). Conectar:
   - Credencial Gmail OAuth2 (cuenta del paso 2)
   - Credencial Slack (la misma que ya usa el workflow de blog)
   Reemplazar los `REPLACE_WITH_*` en el JSON importado por los IDs reales que
   n8n asigna a esas credenciales.
4. Activar el workflow. Corre cada 6h, revisa emails no leídos de F5Bot, y
   manda un mensaje a Slack por cada hilo encontrado.

## Cómo usar las alertas (Mau/equipo)

- **Si el hilo es una oportunidad real de ayudar** (alguien pregunta algo que
  de verdad sabemos responder): comentar como persona, con la experiencia
  primero y el link al blog solo si aporta, nunca como primera línea del
  comentario.
- **Si no aplica comentar** pero el tema es interesante: es una idea de blog
  nueva. Guardarla en el board de contenido (o pedirle a Cleo `/blog tema`).
- **Nunca**: pegar el mismo comentario en varios hilos, comentar en cuentas
  nuevas sin karma/antigüedad (muchos subreddits lo bloquean o lo marcan como
  spam), usar anchor text con la keyword exacta en vez de lenguaje natural.

## Riesgo real (para que quede documentado, no para asustar)

Como Mau publica manualmente siendo una persona real con contexto genuino,
el riesgo de ban/penalización de Google es bajo — el riesgo real es solo
cuando se automatiza la respuesta en sí, y eso está explícitamente fuera de
este flujo.
