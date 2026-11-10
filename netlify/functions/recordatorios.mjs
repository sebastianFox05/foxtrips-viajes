/*
 * Funcion programada de Netlify (cada hora): recordatorios del viaje en el idioma y la hora de cada dispositivo.
 *   - La tarde antes (19 h): "Mañana empieza «Viaje»".
 *   - Cada mañana del viaje (8 h), si ese dia hay planes: cuantos hay y el primero.
 * La funcion SQL due_reminders decide a quien toca y marca cada recordatorio como enviado.
 * Variable de entorno extra: REMINDERS_SECRET (su huella sha256 esta guardada en la tabla app_settings de Supabase).
 */
import { clip, rpc, sendAll, vapidReady } from '../lib/push.mjs';

const TEXTS = {
  es: {
    tomorrow: (trip) => [`Mañana empieza «${trip}»`, '¿Lo tienes todo? Revisa el equipaje y el plan del primer día.'],
    today: (trip, n, time, title) => [`Hoy en «${trip}»`, `${n === 1 ? '1 plan' : `${n} planes`}${title ? `. Primero: ${title}${time ? ` a las ${time}` : ''}` : ''}.`]
  },
  en: {
    tomorrow: (trip) => [`"${trip}" starts tomorrow`, 'All set? Check your packing list and the first day\'s plan.'],
    today: (trip, n, time, title) => [`Today on "${trip}"`, `${n === 1 ? '1 plan' : `${n} plans`}${title ? `. First up: ${title}${time ? ` at ${time}` : ''}` : ''}.`]
  },
  pt: {
    tomorrow: (trip) => [`«${trip}» começa amanhã`, 'Tudo pronto? Confira a bagagem e o plano do primeiro dia.'],
    today: (trip, n, time, title) => [`Hoje em «${trip}»`, `${n === 1 ? '1 plano' : `${n} planos`}${title ? `. Primeiro: ${title}${time ? ` às ${time}` : ''}` : ''}.`]
  }
};

export default async () => {
  const secret = process.env.REMINDERS_SECRET;
  if (!secret || !vapidReady()) {
    console.log('Recordatorios sin configurar');
    return;
  }
  const rows = await rpc('due_reminders', { secret });
  if (!rows) {
    console.error('No se pudieron leer los recordatorios');
    return;
  }
  const sent = await sendAll(rows, (row) => {
    const texts = TEXTS[row.lang] || TEXTS.es;
    const [title, body] = row.kind === 'tomorrow'
      ? texts.tomorrow(clip(row.trip_name, 60))
      : texts.today(clip(row.trip_name, 60), row.plans, row.first_time, clip(row.first_title, 60));
    return {
      title,
      body,
      url: `/#/viaje/${row.trip_id}/${row.kind === 'tomorrow' ? 'equipaje' : 'itinerario'}`,
      tag: `recordatorio-${row.trip_id}`
    };
  });
  console.log(`Recordatorios enviados: ${sent} de ${rows.length}`);
};

export const config = { schedule: '@hourly' };
