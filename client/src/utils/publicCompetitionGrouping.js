import { cleanCompetitionTitle } from '../utils';

export const normalizePublicGender = (value) => {
  const gender = String(value || '').trim().toLowerCase();
  if (['male', 'men', 'm', 'ชาย'].includes(gender)) return 'Men';
  if (['female', 'women', 'woman', 'w', 'f', 'หญิง'].includes(gender)) return 'Women';
  if (['mixed', 'mix'].includes(gender)) return 'Mixed';
  return value ? String(value).trim() : '';
};

export const getPublicAgeGroupLabel = (competition) => (
  competition?.age_group_name ||
  competition?.age_group ||
  competition?.category_name ||
  competition?.category ||
  ''
);

export const getPublicGenderLabel = (value, language = 'THA') => {
  const gender = normalizePublicGender(value);
  if (gender === 'Men') return language === 'THA' ? 'ชาย' : 'Men';
  if (gender === 'Women') return language === 'THA' ? 'หญิง' : 'Women';
  if (gender === 'Mixed') return language === 'THA' ? 'ผสม' : 'Mixed';
  return gender;
};

export const getPublicCompetitionVariantLabel = (competition, language = 'THA') => {
  const labels = [
    getPublicAgeGroupLabel(competition),
    getPublicGenderLabel(competition?.gender, language)
  ].filter(Boolean);

  return labels.length > 0
    ? labels.join(' / ')
    : (language === 'THA' ? 'ทุกรุ่น/ทุกประเภท' : 'All categories');
};

export const groupPublicCompetitionCategories = (competitions = [], language = 'THA') => {
  const groups = new Map();
  competitions.forEach((competition) => {
    const ageGroup = String(getPublicAgeGroupLabel(competition) || '').trim();
    const gender = normalizePublicGender(competition?.gender);
    const key = `${ageGroup.toLocaleLowerCase()}|${gender.toLocaleLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: getPublicCompetitionVariantLabel(competition, language),
        items: []
      });
    }
    groups.get(key).items.push(competition);
  });
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, language === 'THA' ? 'th' : 'en'));
};

export const groupPublicCompetitions = (competitions = []) => {
  const groups = new Map();

  competitions.forEach((competition) => {
    const title = cleanCompetitionTitle(competition?.title || competition?.name || '');
    const key = title.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title,
        logo_url: competition.logo_url || '',
        items: []
      });
    }

    const group = groups.get(key);
    if (!group.logo_url && competition.logo_url) group.logo_url = competition.logo_url;
    group.items.push(competition);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const ageCompare = getPublicAgeGroupLabel(a).localeCompare(getPublicAgeGroupLabel(b), 'th');
        if (ageCompare !== 0) return ageCompare;
        return getPublicGenderLabel(a.gender, 'ENG').localeCompare(getPublicGenderLabel(b.gender, 'ENG'));
      })
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'th'));
};

export const findCompetitionGroupById = (groups = [], competitionId) => (
  groups.find((group) => group.items.some((competition) => String(competition.id) === String(competitionId)))
);
