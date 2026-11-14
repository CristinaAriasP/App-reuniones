import { db, type Answer, type Deliverable, type Meeting, type Project, type Task } from './db';
import { toISO } from './utils';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toISO(d);
};

/** Carga unos proyectos de ejemplo para probar la app. */
export async function loadSampleData() {
  const now = Date.now();
  await db.transaction('rw', [db.projects, db.meetings, db.tasks, db.deliverables, db.questions, db.answers], async () => {
    const p = async (name: string, company: string, color: string, description: string) =>
      (await db.projects.add({ name, company, color, description, archived: false, createdAt: now } as Project)) as number;
    const m = async (projectId: number, offset: number, title: string, attendees: string, notes: string) =>
      (await db.meetings.add({ projectId, date: day(offset), title, attendees, notes, createdAt: now, updatedAt: now } as Meeting)) as number;
    const t = (projectId: number, meetingId: number | null, title: string, due: number | null, done = false) =>
      db.tasks.add({ projectId, meetingId, title, dueDate: due == null ? '' : day(due), done: done ? 1 : 0, createdAt: now } as Task);
    const d = (projectId: number, title: string, due: number, status: Deliverable['status'], notes = '') =>
      db.deliverables.add({ projectId, title, dueDate: day(due), status, notes, createdAt: now } as Deliverable);

    const web = await p('Rediseño web', 'Acme S.L.', '#4f46e5', 'Nueva web corporativa y tienda online. Contacto: María López (marketing).');
    const app = await p('App de fidelización', 'Acme S.L.', '#0891b2', 'App móvil de puntos para clientes de tienda física.');
    const xmas = await p('Campaña Navidad', 'Globex', '#ea580c', 'Campaña en redes y newsletter para diciembre.');

    const k = await m(web, -21, 'Kick-off con cliente', 'María López, Luis, Ana',
      '# Objetivos\n- Renovar la imagen de la web\n- Vender online: **decisión: usar Shopify** para la tienda\n- Presupuesto aprobado: 18.000 €\n\n# Próximos pasos\n[x] Compartir accesos al hosting actual\n[ ] Enviar propuesta de diseño');
    await t(web, k, 'Pedir accesos al hosting actual', -18, true);
    await t(web, k, 'Preparar maqueta de la home', -1);
    const s = await m(web, -7, 'Revisión de diseño', 'María López, Ana',
      '# Comentarios del cliente\n- Les gusta la propuesta B, más limpia\n- Quieren el logo más grande en móvil\n- **Cambiar el azul por el de su manual de marca**\n\n# Dudas abiertas\n- ¿Blog en la primera fase? Lo confirman la semana que viene');
    await t(web, s, 'Aplicar colores del manual de marca', 3);
    await t(web, s, 'Confirmar si el blog entra en la fase 1', 5);
    const qs = await db.questions.filter((q) => !q.archived).toArray();
    const ans = async (text: string, data: Pick<Answer, 'choice' | 'selected' | 'text'>) => {
      const q = qs.find((x) => x.text === text);
      if (q) await db.answers.add({ meetingId: k, questionId: q.id, projectId: web, ...data, updatedAt: now } as Answer);
    };
    await ans('¿Necesita una plataforma con inicio de sesión?', { choice: 'si', selected: ['Espacio cliente'], text: 'Para que sus clientes vean el estado de sus pedidos' });
    await ans('¿La plataforma va dentro de la web o es externa?', { choice: '', selected: ['Integrada en la web'], text: '' });
    await ans('¿La web va a tener tienda online?', { choice: 'si', selected: [], text: '' });
    await ans('¿La tienda va dentro de la web o es externa?', { choice: '', selected: ['Externa (la web redirige)'], text: 'Shopify' });
    await d(web, 'Propuesta de diseño v2', 4, 'en_curso', 'Con los cambios de la revisión del día ' + day(-7));
    await d(web, 'Lanzamiento de la web', 52, 'pendiente');
    await d(web, 'Propuesta de diseño v1', -10, 'entregado');

    const a = await m(app, -3, 'Llamada de requisitos', 'Jorge (IT Acme), Luis',
      '# Requisitos\n1. Login con el número de socio\n2. Ver puntos y canjear premios\n3. Notificaciones de ofertas\n\n**Importante:** tiene que integrarse con su TPV actual');
    await t(app, a, 'Pedir documentación de la API del TPV', 2);
    await t(app, null, 'Estimar horas de desarrollo', 9);
    await d(app, 'Presupuesto y planificación', 10, 'pendiente');

    const x = await m(xmas, -2, 'Brainstorming de campaña', 'Equipo Globex, Ana',
      '# Ideas\n- Calendario de adviento en Instagram\n- Sorteo entre suscriptores de la newsletter\n- Tono cercano y familiar\n\n# Presupuesto\n- 3.000 € para anuncios');
    await t(xmas, x, 'Redactar calendario de publicaciones', 6);
    await t(xmas, x, 'Diseñar plantilla de newsletter', 8);
    await d(xmas, 'Calendario de contenidos', 7, 'pendiente');
    await d(xmas, 'Inicio de campaña', 18, 'pendiente');
  });
}
