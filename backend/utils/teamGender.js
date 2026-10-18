const normalizeTeamGender = (value) => {
  const gender = String(value || '').trim().toLowerCase();
  if (['male', 'men', 'm', 'ชาย'].includes(gender)) return 'Male';
  if (['female', 'women', 'f', 'หญิง'].includes(gender)) return 'Female';
  return null;
};

module.exports = { normalizeTeamGender };
