import { competitionName } from '../i18n/competitionNames.js';

export function adminScorerCompetitionTitle(record, language) {
    return String(competitionName(record, language)).replace(/\s*\(?(Men|Women|Male|Female|ชาย|หญิง)\)?$/i, '').trim();
}

export function adminScorerMatchTitle(match, competitions, language) {
    // Older cached matches may contain only a single display string. Resolve
    // their linked competition without overwriting a custom manual match title.
    const competition = !match.is_manual_scorer && match.manual_owner_id == null
        ? competitions.find(item => String(item.id) === String(match.competition_id)) : null;
    return adminScorerCompetitionTitle(competition ? { ...match, ...competition } : match, language);
}
