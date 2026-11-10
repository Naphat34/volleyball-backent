export const value = (...items) => items.find(x => x !== undefined && x !== null && String(x).trim() !== '' && x !== '-') ?? '';
const thai = text => /[\u0E00-\u0E7F]/.test(String(text || ''));
const flag = x => x === true || x === 1 || x === '1';
export function personNames(person) {
  const legacy = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
  const th = value(person.full_name_th, person.name_th, [person.first_name_th, person.middle_name_th, person.last_name_th].filter(Boolean).join(' '), thai(legacy) ? legacy : '');
  return {
    th: th && person.title && !th.startsWith(person.title) ? `${person.title} ${th}` : th,
    first: value([person.first_name_en, person.middle_name_en].filter(Boolean).join(' '), !thai(person.first_name) ? [person.first_name, person.middle_name].filter(Boolean).join(' ') : ''),
    last: value(person.last_name_en, !thai(person.last_name) ? person.last_name : ''),
    en: value(person.full_name_en, person.name_en, [person.first_name_en, person.middle_name_en, person.last_name_en].filter(Boolean).join(' '), !thai(legacy) ? legacy : ''),
  };
}
export function birthDate(raw) {
  const match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}
export const dateLabel = date => date ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date).replaceAll(' ', '-') : '-';
const positive = raw => Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : null;
export function compositionModel(players = [], referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const rows = players.map((p, index) => {
    const birth = birthDate(value(p.birthdate, p.birth_date, p.date_of_birth, p.dob));
    const age = birth && year >= birth.getUTCFullYear() ? year - birth.getUTCFullYear() : null;
    const nationality = String(value(p.nationality, p.country)).toLowerCase();
    return { ...personNames(p), key: p.id ?? index, number: value(p.number, p.shirt_number),
      role: [flag(p.is_captain) ? 'C' : '', flag(p.is_libero1) || flag(p.is_libero2) || (p.entry_role != null ? String(p.entry_role).startsWith('L') : p.position === 'L') ? 'L' : ''].filter(Boolean).join(' '),
      shirt: value(p.jersey_name, p.shirt_name), position: p.position === 'OPP' ? 'OP' : p.position,
      birth: dateLabel(birth), age, height: positive(value(p.height_cm, p.height)), weight: positive(p.weight),
      fivb: value(p.fivb_id, p.fivbId), domicile: value(p.domicile, p.hometown, p.province, p.country),
      foreign: flag(p.is_foreign) || (nationality && !['thai', 'thailand', 'tha', 'th', 'ไทย', 'ประเทศไทย'].includes(nationality)),
    };
  }).sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
  const pages = [];
  for (let index = 0; index < Math.max(rows.length, 1); index += 20) pages.push(rows.slice(index, index + 20));
  const stats = ['age', 'height', 'weight'].map(key => {
    const numbers = rows.map(row => row[key]).filter(x => x !== null && x !== undefined);
    return { key, min: numbers.length ? Math.min(...numbers) : '-', average: numbers.length ? (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(1) : '-', max: numbers.length ? Math.max(...numbers) : '-' };
  });
  return { rows, pages, stats };
}
