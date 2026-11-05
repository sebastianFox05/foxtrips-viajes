/* Avatar (foto de perfil o iniciales con color) y pila de avatares. Mismo marcado que avatarHtml(). */
import { avatarInfo } from '../lib/utils.js';

export function Avatar({ name, userId = null, extraClass = '' }) {
  const { text, photo, hue, initials } = avatarInfo(name, userId);
  if (photo) {
    return (
      <span className={`avatar avatar--photo ${extraClass}`} title={text} aria-hidden="true">
        <img className="avatar__img" src={photo} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }
  return (
    <span className={`avatar ${extraClass}`} style={{ '--avatar-hue': hue }} title={text} aria-hidden="true">{initials}</span>
  );
}

/* people: nombres o { name, user_id } */
export function AvatarStack({ people, max = 3 }) {
  if (!people?.length) return null;
  const list = people.map((person) => (typeof person === 'string' ? { name: person } : person));
  return (
    <span className="avatar-stack" aria-label={list.map((person) => person.name).join(', ')}>
      {list.slice(0, max).map((person, index) => <Avatar key={`${person.user_id || person.name}-${index}`} name={person.name} userId={person.user_id} />)}
      {list.length > max ? <span className="avatar-stack__more">+{list.length - max}</span> : null}
    </span>
  );
}
