const VIS_SKILLS = {
  A: { label: 'Attack', aliases: ['ATTACK', 'SPIKE'] },
  S: { label: 'Serve', aliases: ['SERVE', 'SERVICE'] },
  B: { label: 'Block', aliases: ['BLOCK'] },
  R: { label: 'Reception', aliases: ['RECEPTION', 'RECEIVE'] },
  D: { label: 'Dig', aliases: ['DIG', 'DEFENSE'] },
  E: { label: 'Set', aliases: ['SET', 'SETTING'] },
};

const VIS_GRADES = {
  '#': { label: 'Winning / Perfect' },
  '+': { label: 'Positive' },
  '!': { label: 'Playable' },
  '-': { label: 'Negative' },
  '=': { label: 'Error' },
};

const normalizeVisSkill = (value) => {
  const text = String(value || '').trim().toUpperCase();
  if (VIS_SKILLS[text]) return text;
  return Object.entries(VIS_SKILLS).find(([, config]) => config.aliases.includes(text))?.[0] || text;
};

const normalizeVisGrade = (value) => String(value || '').trim().toUpperCase();

const isVisSkill = (value) => Boolean(VIS_SKILLS[normalizeVisSkill(value)]);
const isVisGrade = (value) => Boolean(VIS_GRADES[normalizeVisGrade(value)]);

module.exports = {
  VIS_GRADES,
  VIS_SKILLS,
  isVisGrade,
  isVisSkill,
  normalizeVisGrade,
  normalizeVisSkill,
};
