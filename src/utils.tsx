import type { ReactNode } from 'react';

export function todayISO(): string {
  const d = new Date();
  return toISO(d);
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString('es-ES', opts);
}

export function formatLongDate(iso: string): string {
  const s = formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthLabel(iso: string): string {
  const s = formatDate(iso, { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Días desde hoy hasta la fecha (negativo = vencida). */
export function daysUntil(iso: string): number {
  const t = parseISO(todayISO()).getTime();
  return Math.round((parseISO(iso).getTime() - t) / 86400000);
}

export function relativeDue(iso: string): { text: string; tone: 'late' | 'soon' | 'ok' } {
  const n = daysUntil(iso);
  if (n < 0) return { text: n === -1 ? 'Venció ayer' : `Venció hace ${-n} días`, tone: 'late' };
  if (n === 0) return { text: 'Hoy', tone: 'soon' };
  if (n === 1) return { text: 'Mañana', tone: 'soon' };
  if (n <= 7) return { text: `En ${n} días`, tone: 'soon' };
  return { text: formatDate(iso), tone: 'ok' };
}

/** Minúsculas y sin tildes, para que "reunion" encuentre "Reunión". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function searchTerms(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

export function matchesAll(text: string, terms: string[]): boolean {
  const n = normalize(text);
  return terms.every((t) => n.includes(t));
}

/**
 * Resalta los términos en el texto. Como normalize() conserva la longitud
 * para caracteres latinos con tilde, los índices coinciden con el original.
 */
export function highlight(text: string, terms: string[]): ReactNode {
  if (!terms.length || !text) return text;
  const n = normalize(text);
  if (n.length !== text.length) return text;
  const ranges: [number, number][] = [];
  for (const t of terms) {
    let i = n.indexOf(t);
    while (i !== -1) {
      ranges.push([i, i + t.length]);
      i = n.indexOf(t, i + t.length);
    }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const out: ReactNode[] = [];
  let pos = 0;
  merged.forEach(([a, b], k) => {
    if (a > pos) out.push(text.slice(pos, a));
    out.push(<mark key={k}>{text.slice(a, b)}</mark>);
    pos = b;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

/** Quita las marcas de formato de las notas (#, -, **, [ ]) y separa líneas con " · ". */
export function stripFormatting(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(#{1,3}|[-*•]|\d+[.)])\s+/, '').replace(/^\s*\[( |x|X)\]\s+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .join(' · ');
}

/** Fragmento de texto alrededor de la primera coincidencia. */
export function snippet(text: string, terms: string[], radius = 90): string {
  const flat = stripFormatting(text).replace(/\s+/g, ' ').trim();
  if (!terms.length) return flat.slice(0, radius * 2);
  const n = normalize(flat);
  let first = -1;
  for (const t of terms) {
    const i = n.indexOf(t);
    if (i !== -1 && (first === -1 || i < first)) first = i;
  }
  if (first === -1) return flat.slice(0, radius * 2) + (flat.length > radius * 2 ? '…' : '');
  const start = Math.max(0, first - radius);
  const end = Math.min(flat.length, first + radius);
  return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '');
}
