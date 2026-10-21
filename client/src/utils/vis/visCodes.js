export const VIS_SKILLS = {
  A: { label: 'Attack', shortLabel: 'ATK' },
  S: { label: 'Serve', shortLabel: 'SRV' },
  B: { label: 'Block', shortLabel: 'BLK' },
  R: { label: 'Reception', shortLabel: 'REC' },
  D: { label: 'Dig', shortLabel: 'DIG' },
  E: { label: 'Set', shortLabel: 'SET' },
};

export const VIS_GRADES = {
  '#': { label: 'Win/Perfect', tone: 'emerald' },
  '+': { label: 'Positive', tone: 'blue' },
  '!': { label: 'Playable', tone: 'amber' },
  '-': { label: 'Negative', tone: 'orange' },
  '=': { label: 'Error', tone: 'rose' },
};

export const VIS_QUICK_ACTIONS = [
  { skill: 'A', grade: '#', label: 'A#', hint: 'Attack kill', point: true },
  { skill: 'A', grade: '=', label: 'A=', hint: 'Attack error', pointToOpponent: true },
  { skill: 'S', grade: '#', label: 'S#', hint: 'Serve ace', point: true },
  { skill: 'S', grade: '=', label: 'S=', hint: 'Serve error', pointToOpponent: true },
  { skill: 'B', grade: '#', label: 'B#', hint: 'Block point', point: true },
  { skill: 'R', grade: '#', label: 'R#', hint: 'Perfect reception' },
  { skill: 'R', grade: '+', label: 'R+', hint: 'Positive reception' },
  { skill: 'R', grade: '=', label: 'R=', hint: 'Reception error', pointToOpponent: true },
  { skill: 'D', grade: '+', label: 'D+', hint: 'Successful dig' },
  { skill: 'E', grade: '#', label: 'E#', hint: 'Set assist' },
];

export const getVisActionLabel = (skill, grade) => {
  const skillLabel = VIS_SKILLS[skill]?.shortLabel || skill;
  return `${skillLabel}${grade}`;
};
