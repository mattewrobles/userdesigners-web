# SEO / AEO / GEO — checklist del blog UserDesigners

Referencia viva. Todo lo de acá ya está automatizado en el pipeline
(`scripts/lib/seo-rules.mjs`, `generate-blog-draft.js`, `generate-llms-txt.mjs`)
— esta lista es para que un humano entienda el porqué y pueda auditar a mano.

## SEO clásico (ya automatizado)
- Title 30-65 caracteres, description 120-160.
- 1200-2500 palabras, 4-6+ H2, tablas comparativas, checklist accionable.
- 3-5 links internos a posts reales del blog (nunca inventar URLs).
- 1+ link externo a fuente de autoridad (NN/g, IxDF, Baymard, Smashing Magazine).
- Alt text descriptivo en todas las imágenes.

## AEO — Answer Engine Optimization (featured snippets, Google AI Overviews)
- Sección FAQ real, preguntas en negrita (`**¿Pregunta?**`) seguidas de respuesta directa.
- FAQPage schema (`BlogPost.astro` ya lo genera automático si detecta la sección FAQ).
- Cada H2 responde su propia pregunta en la primera frase — no hace falta leer el párrafo completo.

## GEO — Generative Engine Optimization (ChatGPT, Perplexity, Claude)
- **Respuesta directa post-heading**: la oración justo después de cada H2 debe ser citable sola, sin contexto previo.
- **Señal de frescura**: mencionar el año o "actualizado en 2026" — los LLM ponderan recencia.
- **Datos concretos con fuente** en vez de afirmaciones vagas — se cita lo verificable, no lo genérico.
- **`llms.txt`** en la raíz del sitio (`public/llms.txt`) — se regenera automático en cada sync con la lista completa de posts. Es lo primero que leen GPTBot/ClaudeBot/PerplexityBot.
- **`robots.txt`** ya permite explícitamente GPTBot y compañía (ver nota RFC 9309 sobre orden de reglas con Cloudflare).

## E-E-A-T (Experience, Expertise, Authoritativeness, Trust)
- Autor visible (`author: "UserDesigners"` en frontmatter — considerar Person schema si en algún momento hay bylines individuales).
- Ejemplos reales de proyectos propios (Utransfer, Kaito, Airpals) en vez de casos hipotéticos.
- Cero estadísticas inventadas con números redondos "perfectos".

## Pendiente / no automatizado (decisión humana)
- Person schema por autor individual — hoy todo el blog usa autor "UserDesigners" (Organization). Solo vale la pena si se empieza a firmar posts con nombre propio.
- Distribución a newsletters de nicho (Sidebar.io, etc.) — manual, no hay pipeline.
- Auto-post a LinkedIn — ver `docs/LINKEDIN-DISTRIBUTION.md`.
