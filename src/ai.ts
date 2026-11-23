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
  answers: z.array(z.object({
    questionId: z.number().describe('id de la pregunta del cuestionario'),
    choice: z.enum(['si', 'no', 'nose', '']).describe('Para preguntas sino: si, no, nose (por confirmar); vacío en otras'),
    selected: z.array(z.string()).describe('Opciones de la lista que aplican, escritas exactamente igual'),
    text: z.string().describe('Comentario o respuesta libre; vacío si no hace falta'),
  })).describe('Respuestas al cuestionario, solo de las preguntas que el texto permite responder'),
});

export type Organized = z.infer<typeof OrganizedSchema>;

export interface OrganizeQuestion {
  id: number;
  text: string;
  kind: 'sino' | 'unica' | 'opciones' | 'texto';
  parentId?: number | null;
  options: string[];
}

export interface OrganizeContext {
  questions: OrganizeQuestion[];
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
${questionsBlock(ctx.questions)}
Lluvia de ideas:
"""
${raw}
"""

Responde solo con un objeto JSON con esta forma:
{"title": string, "summary": string, "sections": [{"heading": string, "points": [string]}], "decisions": [string], "tasks": [{"title": string, "owner": string, "dueDate": "YYYY-MM-DD" o ""}], "questions": [string], "answers": [{"questionId": number, "choice": "si"|"no"|"nose"|"", "selected": [string], "text": string}]}`;
}

function questionsBlock(qs: OrganizeQuestion[]): string {
  if (!qs.length) return '- No hay cuestionario: devuelve "answers" vacío.\n';
  const lines = qs.map((q) => {
    const kind = q.kind === 'sino' ? 'sí/no' : q.kind === 'unica' ? 'elegir UNA opción' : q.kind === 'opciones' ? 'marcar opciones' : 'respuesta libre';
    const opts = q.options.length ? `; opciones: ${q.options.map((o) => `"${o}"`).join(', ')}` : '';
    const parent = q.parentId ? qs.find((p) => p.id === q.parentId) : undefined;
    const dep = parent ? `; subpregunta de la id ${parent.id}: respóndela solo si esa es «si»` : '';
    return `  - id ${q.id}: ${q.text} (${kind}${opts}${dep})`;
  });
  return `- Además, responde el cuestionario de la reunión SOLO con lo que diga el texto. Si el texto no dice nada de una pregunta, no la incluyas en "answers". Si se menciona pero no está decidido, usa choice "nose". En "selected" usa solo opciones de la lista, escritas igual; si se menciona algo que no está en la lista, ponlo en "text".
  Cuestionario:
${lines.join('\n')}
`;
}

/** Descarta respuestas a preguntas desconocidas u opciones que no existen. */
export function cleanAnswers(o: Organized, qs: OrganizeQuestion[]): Organized['answers'] {
  const byId = new Map(qs.map((q) => [q.id, q]));
  const out: Organized['answers'] = [];
  for (const a of o.answers) {
    const q = byId.get(Number(a.questionId));
    if (!q) continue;
    const extra = a.selected.filter((s) => !q.options.includes(s));
    const ans = {
      questionId: q.id,
      choice: q.kind === 'sino' ? a.choice : ('' as const),
      selected: q.kind === 'texto' ? [] : a.selected.filter((s) => q.options.includes(s)).slice(0, q.kind === 'unica' ? 1 : undefined),
      text: [a.text.trim(), ...extra].filter(Boolean).join('. '),
    };
    if (ans.choice || ans.selected.length || ans.text) out.push(ans);
  }
  return out;
}

// ---------- Proveedores ----------

type Organizer = (raw: string, ctx: OrganizeContext, opts?: OrganizeOptions) => Promise<Organized>;

export class AIError extends Error {
  constructor(message: string, public kind: 'cancelled' | 'not_allowed' | 'other' = 'other') {
    super(message);
  }
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
      // Si falta alguna lista, se toma como vacía
      const lists = { sections: [], decisions: [], tasks: [], questions: [], answers: [] };
      const parsed = OrganizedSchema.safeParse(data && typeof data === 'object' ? { ...lists, ...data } : data);
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

/**
 * La IA solo funciona dentro de claude.ai (enlace de Claude), con la cuenta de Claude de quien la usa.
 * En la versión de Firebase no hay IA: no se usa ninguna clave de API.
 */
export type AIMode = 'claude' | null;

export async function getOrganizer(): Promise<{ mode: AIMode; organize: Organizer } | null> {
  const viewer = await claudeViewerOrganizer();
  return viewer ? { mode: 'claude', organize: viewer } : null;
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
