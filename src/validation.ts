import { z } from 'zod';

// =====================================================================
// Validación de datos
//
// Los mismos límites que comprueban las reglas de Firestore (firestore.rules).
// Se usan en los formularios (maxLength) y al restaurar una copia de seguridad,
// para no aceptar archivos manipulados o con datos con otra forma.
// =====================================================================

export const LIMITS = {
  name: 200,
  title: 300,
  shortText: 500,
  attendees: 1000,
  description: 5000,
  notes: 200000,
  options: 50,
} as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_COLOR = '#4f46e5';

/** Un color de proyecto solo puede ser un hexadecimal: evita meter otra cosa en el CSS. */
export function safeColor(c: unknown): string {
  return typeof c === 'string' && HEX_COLOR.test(c) ? c : FALLBACK_COLOR;
}

const id = z.number().int().nonnegative();
const str = (max: number) => z.string().max(max);
const date = z.string().regex(DATE);
const optDate = z.union([z.literal(''), date]);
const ts = z.number().int().nonnegative();

export const BackupSchema = z.object({
  app: z.literal('app-reuniones'),
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string().max(100),
  projects: z.array(z.object({
    id, name: str(LIMITS.name), company: str(LIMITS.name), color: z.string().regex(HEX_COLOR),
    description: str(LIMITS.description), archived: z.boolean(), createdAt: ts,
  }).strict()),
  meetings: z.array(z.object({
    id, projectId: id, date, title: str(LIMITS.title), attendees: str(LIMITS.attendees),
    notes: str(LIMITS.notes), createdAt: ts, updatedAt: ts,
  }).strict()).default([]),
  tasks: z.array(z.object({
    id, projectId: id, meetingId: id.nullable(), title: str(LIMITS.shortText), dueDate: optDate,
    done: z.union([z.literal(0), z.literal(1)]), createdAt: ts,
  }).strict()).default([]),
  deliverables: z.array(z.object({
    id, projectId: id, title: str(LIMITS.shortText), dueDate: date,
    status: z.enum(['pendiente', 'en_curso', 'entregado']), notes: str(LIMITS.description), createdAt: ts,
  }).strict()).default([]),
  questions: z.array(z.object({
    id, text: str(LIMITS.shortText), kind: z.enum(['sino', 'unica', 'opciones', 'texto']),
    options: z.array(str(LIMITS.shortText)).max(LIMITS.options), parentId: id.nullable().optional(),
    order: z.number(), archived: z.boolean(), createdAt: ts,
  }).strict()).optional(),
  answers: z.array(z.object({
    id, meetingId: id, questionId: id, projectId: id, choice: z.enum(['', 'si', 'no', 'nose']),
    selected: z.array(str(LIMITS.shortText)).max(LIMITS.options), text: str(LIMITS.description), updatedAt: ts,
  }).strict()).optional(),
});

export type ValidBackup = z.infer<typeof BackupSchema>;
