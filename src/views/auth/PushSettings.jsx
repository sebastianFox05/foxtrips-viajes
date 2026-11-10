/*
 * Tarjeta "Avisos" del perfil: activar los avisos push en este dispositivo y elegir cuales llegan.
 * Solo se muestra en modo nube; si el navegador no puede, explica por que.
 */
import { useEffect, useState } from 'react';
import { m, t } from '../../lib/i18n/index.js';
import { PUSH_TOPICS, disablePush, enablePush, needsInstallForPush, pushStatus, readPushPrefs, updatePushPrefs } from '../../lib/push.js';
import { store } from '../../lib/store/index.js';
import Icon from '../../components/Icon.jsx';
import { useBusy, useUi } from '../../ui/UiContext.jsx';

const TOPIC_LABELS = {
  plan: [m('Cambios en el plan'), m('Planes nuevos, editados, movidos o borrados')],
  votes: [m('Votaciones'), m('Propuestas nuevas y votos')],
  group: [m('El grupo'), m('Fotos, diario, documentos, equipaje y quién se une')],
  reminders: [m('Recordatorios'), m('La tarde antes de salir y cada mañana del viaje')]
};

export default function PushSettings() {
  const { toast, toastError } = useUi();
  const [status, setStatus] = useState('loading');
  const [prefs, setPrefs] = useState(readPushPrefs);
  const [isBusy, runBusy] = useBusy();

  useEffect(() => {
    let isCurrent = true;
    pushStatus().then((value) => isCurrent && setStatus(value));
    return () => {
      isCurrent = false;
    };
  }, []);

  if (store.mode === 'local') return null;

  async function toggleHandler() {
    try {
      await runBusy(async () => {
        if (status === 'on') {
          await disablePush();
          setStatus('off');
          toast(t('Avisos desactivados en este dispositivo'));
          return;
        }
        const next = await enablePush();
        setStatus(next);
        toast(next === 'on' ? t('Avisos activados en este dispositivo') : t('El navegador no dio permiso para los avisos'), { isError: next !== 'on' });
      });
    } catch (error) {
      toastError(new Error(t('No se pudieron activar los avisos. Inténtalo de nuevo.')));
      console.error(error);
    }
  }

  async function topicHandler(topic, isOn) {
    const next = { ...prefs, [topic]: isOn };
    setPrefs(next);
    await updatePushPrefs(next).catch(toastError);
  }

  let note = '';
  if (status === 'unsupported') note = needsInstallForPush()
    ? t('En iPhone y iPad los avisos solo funcionan con la app instalada: pulsa Compartir → «Añadir a pantalla de inicio» y ábrela desde allí.')
    : t('Este navegador no permite avisos. Prueba con Chrome, Edge, Firefox o Safari actualizados.');
  if (status === 'denied') note = t('Bloqueaste los avisos para FoxTrips. Actívalos en los ajustes del navegador (el candado de la barra de direcciones) y vuelve aquí.');

  return (
    <section className="card" aria-labelledby="pushTitle">
      <h2 className="card__title" id="pushTitle"><Icon name="alert" size={18} /> {t('Avisos')}</h2>
      <p className="card__text">{t('Te avisamos en este dispositivo cuando el grupo cambia algo y antes de cada día del viaje.')}</p>
      {note ? <p className="form__help">{note}</p> : null}
      {status === 'on' || status === 'off' ? (
        <>
          <button className={`btn btn--top ${status === 'on' ? '' : 'btn--primary'}`} type="button" onClick={toggleHandler} disabled={isBusy}>
            {isBusy ? t('Guardando…') : status === 'on' ? t('Desactivar avisos') : t('Activar avisos')}
          </button>
          {status === 'on' ? (
            <fieldset className="push-topics">
              <legend className="form__label">{t('Qué quieres recibir')}</legend>
              {PUSH_TOPICS.map((topic) => (
                <label className="form__check push-topics__item" key={topic}>
                  <input type="checkbox" checked={prefs[topic]} onChange={(event) => topicHandler(topic, event.target.checked)} />
                  <span><strong>{t(TOPIC_LABELS[topic][0])}</strong><span className="push-topics__hint">{t(TOPIC_LABELS[topic][1])}</span></span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
