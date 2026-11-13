import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { formatLongDate, todayISO } from './utils';

/** Lo que devuelve la IA al ordenar una lluvia de ideas. */
export const OrganizedSchema = z.object({
  title: z.string().describe('Título corto para la reunión (máx. 6 palabras)'),
  summary: z.string().describe('Resumen de 1 a 3 frases'),
  sections: z.array(z.object({
    heading: z.string(),
    points: z.array(z.string()),
  })).describe('Temas tratados, agrupados por tema'),
  decisions: z.array(z.string()).describe('Decisiones tomadas'),
  tasks: z.array(z.object({
    title: z.string().describe('Acción concreta, empezando por un verbo'),
    owner: z.string().describe('Responsable si se menciona, o cadena vacía'),
    dueDate: z.string().describe('Fecha límite en formato YYYY-MM-DD, o cadena vacía si no se menciona'),
  })).describe('Tareas o próximos pasos'),
  questions: z.array(z.string()).describe('Dudas abiertas o temas pendientes de confirmar'),
});

export type Organized = z.infer<typeof OrganizedSchema>;

export interface OrganizeContext {
  projectName: string;
  company: string;
  meetingDate: string;
  attendees: string;
}

export interface OrganizeOptions {
  signal?: AbortSignal;
}

function buildPrompt(raw: string, ctx: OrganizeContext): string {
  return `Eres un asistente que ordena notas de reuniones de trabajo. Escribe siempre en español.

Contexto:
- Proyecto: ${ctx.projectName}${ctx.company ? ` (empresa: ${ctx.company})` : ''}
- Fecha de la reunión: ${formatLongDate(ctx.meetingDate)} (${ctx.meetingDate})
- Hoy es: ${formatLongDate(todayISO())} (${todayISO()})
${ctx.attendees ? `- Asistentes: ${ctx.attendees}\n` : ''}
Te paso una lluvia de ideas desordenada, escrita deprisa durante la reunión. Ordénala:
- Agrupa las ideas por tema, con encabezados cortos y puntos claros. Corrige erratas y abreviaturas, pero conserva todos los datos (cifras, nombres, fechas, importes). No inventes nada que no esté en el texto.
- Separa las decisiones que se tomaron.
- Extrae las tareas o próximos pasos como acciones concretas. Si se menciona una fecha relativa ("el viernes", "la semana que viene"), conviértela a YYYY-MM-DD tomando como referencia la fecha de la reunión. Si no hay fecha, deja dueDate vacío.
- Recoge las dudas o temas pendientes de confirmar.
- Si una lista no tiene contenido, devuélvela vacía.

Lluvia de ideas:
"""
${raw}
"""

Responde solo con un objeto JSON con esta forma:
{"title": string, "summary": string, "sections": [{"heading": string, "points": [string]}], "decisions": [string], "tasks": [{"title": string, "owner": string, "dueDate": "YYYY-MM-DD" o ""}], "questions": [string]}`;
}

// ---------- Proveedores ----------

type Organizer = (raw: string, ctx: OrganizeContext, opts?: OrganizeOptions) => Promise<Organized>;

export class AIError extends Error {
  constructor(message: string, public kind: 'cancelled' | 'not_allowed' | 'other' = 'other') {
    super(message);
  }
}

const KEY_STORAGE = 'reuniones.anthropicKey';

export function getApiKey(): string {
  try { return localStorage.getItem(KEY_STORAGE) ?? ''; } catch { return ''; }
}
export function setApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* almacenamiento no disponible */ }
}

/** Dentro de claude.ai: usa la cuenta de Claude de quien ve la página. */
async function claudeViewerOrganizer(): Promise<Organizer | null> {
  const claude = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
  if (!claude?.use) return null;
  type Sample = { json<T>(input: string, opts?: Record<string, unknown>): Promise<T> };
  const sample = (await claude.use('sample')) as Sample | null;
  if (!sample) return null;
  return async (raw, ctx, opts) => {
    try {
      const data = await sample.json<unknown>(buildPrompt(raw, ctx), { signal: opts?.signal, cache: false });
      const parsed = OrganizedSchema.safeParse(data);
      if (!parsed.success) throw new AIError('La IA devolvió una respuesta con un formato inesperado. Prueba otra vez.');
      return parsed.data;
    } catch (e) {
      if (e instanceof AIError) throw e;
      const code = (e as { code?: string }).code;
      if (code === 'cancelled') throw new AIError('Cancelado', 'cancelled');
      if (code === 'not_granted' || code === 'sampling_disabled') {
        throw new AIError('No se ha dado permiso para usar Claude en esta página.', 'not_allowed');
      }
      if (code === 'rate_limited') throw new AIError('Has hecho muchas peticiones seguidas. Espera un poco y vuelve a intentarlo.');
      if (code === 'prompt_too_large') throw new AIError('El texto es demasiado largo. Prueba con una parte.');
      throw new AIError('No se pudo ordenar el texto. Vuelve a intentarlo en un momento.');
    }
  };
}

/** Fuera de claude.ai: llama a la API de Anthropic con la clave guardada en este navegador. */
function apiKeyOrganizer(apiKey: string): Organizer {
  // La clave es del propio usuario y se guarda solo en su navegador.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  return async (raw, ctx, opts) => {
    try {
      const response = await client.beta.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        output_config: { effort: 'medium', format: betaZodOutputFormat(OrganizedSchema) },
        // Si el modelo rechaza la petición, el servidor la reintenta con otro modelo
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{ role: 'user', content: buildPrompt(raw, ctx) }],
      }, { signal: opts?.signal });
      if (response.stop_reason === 'refusal') throw new AIError('La IA no ha podido procesar este texto.');
      if (response.stop_reason === 'max_tokens') throw new AIError('El texto es demasiado largo para ordenarlo de una vez. Prueba con una parte.');
      if (!response.parsed_output) throw new AIError('La IA devolvió una respuesta con un formato inesperado. Prueba otra vez.');
      return response.parsed_output;
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Anthropic.APIUserAbortError) throw new AIError('Cancelado', 'cancelled');
      if (e instanceof Anthropic.AuthenticationError) throw new AIError('La clave de API no es válida. Revísala en Ajustes.', 'not_allowed');
      if (e instanceof Anthropic.PermissionDeniedError) throw new AIError('Tu clave de API no tiene permiso para usar este modelo.', 'not_allowed');
      if (e instanceof Anthropic.RateLimitError) throw new AIError('Has superado el límite de uso de la API. Espera un poco y vuelve a intentarlo.');
      if (e instanceof Anthropic.APIConnectionError) throw new AIError('No se pudo conectar con Claude. Revisa tu conexión a internet.');
      if (e instanceof Anthropic.APIError) throw new AIError(`Error de la API de Claude (${e.status ?? '?'}). Vuelve a intentarlo.`);
      throw new AIError('No se pudo ordenar el texto. Vuelve a intentarlo.');
    }
  };
}

export type AIMode = 'claude' | 'apikey' | null;

/** Devuelve la forma disponible de usar la IA en este entorno, o null. */
export async function getOrganizer(): Promise<{ mode: AIMode; organize: Organizer } | null> {
  const viewer = await claudeViewerOrganizer();
  if (viewer) return { mode: 'claude', organize: viewer };
  const key = getApiKey();
  if (key) return { mode: 'apikey', organize: apiKeyOrganizer(key) };
  return null;
}

export function isInClaudeViewer(): boolean {
  return !!(window as unknown as { claude?: unknown }).claude;
}

/** Convierte el resultado en notas con el formato de la app. */
export function toNotes(o: Organized): string {
  const out: string[] = [];
  if (o.summary.trim()) out.push('# Resumen', o.summary.trim(), '');
  for (const s of o.sections) {
    if (!s.points.length) continue;
    out.push(`# ${s.heading}`, ...s.points.map((p) => `- ${p}`), '');
  }
  if (o.decisions.length) out.push('# Decisiones', ...o.decisions.map((d) => `- **${d}**`), '');
  if (o.tasks.length) {
    out.push('# Próximos pasos', ...o.tasks.map((t) => `[ ] ${t.title}${t.owner ? ` (${t.owner})` : ''}`), '');
  }
  if (o.questions.length) out.push('# Dudas abiertas', ...o.questions.map((q) => `- ${q}`), '');
  return out.join('\n').trim();
}
