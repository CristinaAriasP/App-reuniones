# 🗂️ Reuniones

Web app para tener en un solo sitio las notas de las reuniones, las tareas y las fechas de entrega de cada proyecto.

## Qué hace

- **Proyectos agrupados por empresa/cliente** en la barra lateral (con color, descripción y opción de archivar).
- **Reuniones por día** dentro de cada proyecto, agrupadas por mes. Cada reunión tiene título, fecha, asistentes y notas.
  - Las notas se **guardan solas** mientras escribes.
  - Formato sencillo: `# Título`, `- viñeta`, `**negrita**`, `[ ] casilla`.
- **Tareas**: se pueden crear desde una reunión (quedan enlazadas a ella) o directamente en el proyecto, con fecha límite opcional.
- **Entregas**: fechas clave de cada proyecto en una línea de tiempo, con estado (pendiente / en curso / entregado).
- **Búsqueda por palabras clave** en todas las reuniones, tareas y entregas. No distingue mayúsculas ni tildes
  ("reunion" encuentra "Reunión") y se puede filtrar por proyecto, tipo y rango de fechas.
- **Inicio** con próximas entregas, últimas reuniones y tareas pendientes/vencidas.
- **Cuestionario en cada reunión**: una plantilla de preguntas (Sí/No con opciones, una sola opción, varias opciones o texto libre, con subpreguntas que solo aparecen si la respuesta es «Sí») que se edita en *Ajustes* y aparece en todas las reuniones. Cada proyecto tiene una pestaña con la última respuesta a cada pregunta.
- **Ordenar con IA**: vuelcas la lluvia de ideas de la reunión tal cual y Claude la ordena por temas, separa decisiones y dudas, y propone tareas con fecha y rellena el cuestionario con lo que se mencione. Revisas el resultado antes de guardarlo.
- **Copia de seguridad**: exportar e importar todos los datos en un archivo `.json`.

## Dónde se guardan los datos

En el propio navegador (IndexedDB), en tu ordenador. No hay servidor ni se envía nada fuera.
Por eso conviene descargar una copia de seguridad de vez en cuando (menú *Copia de seguridad*);
ese archivo también sirve para pasar los datos a otro ordenador o navegador.

## Desarrollo

```bash
npm install
npm run dev      # servidor local en http://localhost:5173
npm run build    # genera la versión publicable en dist/
```

Tecnología: React + TypeScript + Vite, con Dexie (IndexedDB) para los datos.

## Publicarla

El workflow `.github/workflows/deploy.yml` publica la app en GitHub Pages cada vez que se sube algo a `main`.
Para activarlo: en GitHub, *Settings → Pages → Source: GitHub Actions*.

## IA (Ordenar con IA)

- **Dentro de claude.ai** (el enlace de artefacto) usa la cuenta de Claude de quien la abre; no hay que configurar nada.
- **Fuera de claude.ai** (GitHub Pages o en local) hace falta una clave de API de Anthropic, que se pega en *Ajustes*.
  La clave se guarda solo en el navegador y la app llama directamente a la API de Anthropic con el modelo `claude-opus-5-5`
  y salidas estructuradas. Cada uso consume un poco de saldo de esa cuenta.
