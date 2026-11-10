/*
 * Idioma y region: idioma de la app, formato de hora, unidades y moneda de casa.
 * - <RegionSettings /> es la tarjeta del perfil.
 * - <LanguagePicker /> es el selector suelto de la pantalla de acceso (antes de tener cuenta).
 * Todo se guarda en este navegador. Cambiar el idioma recarga la app para aplicarlo en todas las pantallas.
 */
import { useState } from 'react';
import { LANGUAGES, deviceLanguage, getLanguageChoice, setLanguageChoice, t } from '../../lib/i18n/index.js';
import { automaticValue, getPreference, setPreference } from '../../lib/locale.js';
import { currencyOptions, homeCurrency, setHomeCurrency } from '../../lib/currencies.js';
import Icon from '../../components/Icon.jsx';

function changeLanguage(value) {
  if (setLanguageChoice(value)) window.location.reload();
}

function languageOptions() {
  const device = LANGUAGES.find((language) => language.code === deviceLanguage());
  return [{ code: 'auto', name: t('Automático ({value})', { value: device?.name || '' }) }, ...LANGUAGES];
}

export function LanguagePicker({ id = 'languagePicker', className = '' }) {
  const [choice, setChoice] = useState(getLanguageChoice);
  return (
    <label className={className} htmlFor={id}>
      <Icon name="translate" size={14} />
      <span className="visually-hidden">{t('Idioma de la app')}</span>
      <select id={id} value={choice} onChange={(event) => { setChoice(event.target.value); changeLanguage(event.target.value); }}>
        {languageOptions().map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
      </select>
    </label>
  );
}

function PreferenceField({ id, label, name, options }) {
  const [value, setValue] = useState(() => getPreference(name));
  function changeHandler(event) {
    setPreference(name, event.target.value);
    setValue(event.target.value);
  }
  return (
    <div className="form__field">
      <label className="form__label" htmlFor={id}>{label}</label>
      <select className="form__select" id={id} value={value} onChange={changeHandler}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

export default function RegionSettings() {
  const [language, setLanguage] = useState(getLanguageChoice);
  const [currency, setCurrency] = useState(homeCurrency);
  // "Automático (…)" dice lo que corresponde a la region de este dispositivo
  const automatic = (value) => t('Automático ({value})', { value });

  return (
    <section className="card" aria-labelledby="regionTitle">
      <h2 className="card__title" id="regionTitle">{t('Idioma y región')}</h2>
      <p className="card__text">{t('Se guardan en este dispositivo. Las horas de los planes son siempre las del destino.')}</p>
      <div className="form">
        <div className="form__row">
          <div className="form__field">
            <label className="form__label" htmlFor="prefLanguage">{t('Idioma de la app')}</label>
            <select className="form__select" id="prefLanguage" value={language} onChange={(event) => { setLanguage(event.target.value); changeLanguage(event.target.value); }}>
              {languageOptions().map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
            </select>
          </div>
          <div className="form__field">
            <label className="form__label" htmlFor="prefCurrency">{t('Tu moneda')}</label>
            <select className="form__select" id="prefCurrency" value={currency} onChange={(event) => { setHomeCurrency(event.target.value); setCurrency(event.target.value); }}>
              {currencyOptions(currency).map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form__row">
          <PreferenceField
            id="prefHour"
            name="hour"
            label={t('Formato de hora')}
            options={[
              { value: 'auto', label: automatic(automaticValue('hour') === '12' ? t('12 horas') : t('24 horas')) },
              { value: '24', label: t('24 horas (14:30)') },
              { value: '12', label: t('12 horas (2:30 p. m.)') }
            ]}
          />
          <PreferenceField
            id="prefTemp"
            name="temp"
            label={t('Temperatura')}
            options={[
              { value: 'auto', label: automatic(`°${automaticValue('temp')}`) },
              { value: 'C', label: t('Celsius (°C)') },
              { value: 'F', label: t('Fahrenheit (°F)') }
            ]}
          />
        </div>
        <div className="form__row">
          <PreferenceField
            id="prefDistance"
            name="dist"
            label={t('Distancias')}
            options={[
              { value: 'auto', label: automatic(automaticValue('dist')) },
              { value: 'km', label: t('Kilómetros') },
              { value: 'mi', label: t('Millas') }
            ]}
          />
        </div>
      </div>
    </section>
  );
}
