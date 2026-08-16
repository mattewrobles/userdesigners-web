---
title: "Auto Layout en Figma: de la frustración a la fluidez"
description: "El Auto Layout de Figma es poderoso pero confuso al principio. Esta guía práctica te lleva de cero a dominio con patrones reutilizables para tus componentes."
category: "UI Design"
author: "UserDesigners"
tags: ["UI Design"]
heroImage: "/assets/blog/auto-layout-figma-frustracion-a-fluidez.jpg"
heroImageSource: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=1600&h=900&fit=crop"
date: "2026-08-08"
readTime: "2 min"
---

Abres Figma. Arrastras un botón. El auto layout se comporta como si tuviera voluntad propia. Los elementos se estiran cuando no deberían, los gaps no se alinean y terminas forcejeando con el panel de propiedades durante 20 minutos.

Auto Layout es la herramienta más poderosa de Figma y también la más frustrante cuando no la entiendes.

## El error conceptual

La mayoría de la gente piensa Auto Layout como "una forma de que los elementos se acomoden solos". Eso es incorrecto. Auto Layout es un sistema de contenedores flexibles que responden a reglas específicas. Cuando entiendes las reglas, deja de ser frustrante.

## Las 3 reglas que lo cambian todo

- Padding vs Gap — Padding es el espacio entre el borde del contenedor y su contenido. Gap es el espacio entre elementos hijos. Si tus elementos no se alinean como esperas, probablemente confundiste estos dos valores.
- Dirección y alineación — Un contenedor con Auto Layout tiene una dirección (horizontal o vertical) y una alineación (centro, izquierda, derecha, arriba, abajo). Cambiar la dirección sin ajustar la alineación produce resultados que parecen aleatorios.
- Fill vs Hug — Fill hace que el elemento se estire para llenar el espacio disponible. Hug hace que se ajuste al contenido. Un botón en Hug solo crecerá hasta el tamaño de su texto. Un botón en Fill ocupará todo el ancho del contenedor. Usa Hug para componentes internos y Fill para contenedores estructurales.
## El flujo de trabajo que funciona

1. Construye de adentro hacia afuera. Primero el contenido, luego el contenedor, luego el contenedor del contenedor.

2. Usa Auto Layout en todo. Incluso en componentes simples. Te obliga a pensar en términos de sistema desde el principio.

3. Anida contenedores. Un solo Auto Layout no resuelve layouts complejos. Tres contenedores anidados con diferentes direcciones sí.

## El shortcut que te ahorrará horas

Selecciona cualquier grupo y presiona Shift + A. Automáticamente se convierte en un contenedor con Auto Layout. No necesitas configurar nada desde cero cada vez.

## Haz esto hoy

Abre tu componente más usado en Figma. Conviértelo a Auto Layout si no lo está. Si ya lo está, revisa si puedes eliminar contenedores anidados innecesarios. Un componente con menos contenedores es más fácil de mantener.
