function stadiumNames(input, current = {}) {
  const clean = value => {
    if (value == null) return '';
    if (typeof value !== 'string' || value.trim().length > 255) {
      throw Object.assign(new Error('Stadium names must be text up to 255 characters'), { status: 400 });
    }
    return value.trim();
  };
  const names = {};
  for (const lang of ['th', 'en']) {
    const key = `name_${lang}`;
    names[key] = clean(input[key] === undefined ? current[key] : input[key]);
  }
  const legacy = clean(input.name === undefined ? current.name : input.name);
  if (input.name_th === undefined && input.name_en === undefined && legacy) {
    names[/[ก-๙]/.test(legacy) ? 'name_th' : 'name_en'] = legacy;
  }
  const name = names.name_th || names.name_en;
  if (!name) throw Object.assign(new Error('Please enter a stadium name in Thai or English'), { status: 400 });
  return { name, name_th: names.name_th || null, name_en: names.name_en || null };
}
module.exports = { stadiumNames };
