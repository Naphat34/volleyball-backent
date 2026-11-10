import { useMemo } from 'react';
import { useOptionalLanguage } from '../context/LanguageContext';
import { personName, personNameParts, teamName } from '../utils/i18n/names';
import { getScorerTeamName } from '../utils/scorer/scorerTeamNames';

export default function useDisplayNames() {
    const { language } = useOptionalLanguage();
    return useMemo(() => ({
        personName: value => personName(value, language),
        personFirstName: value => personNameParts(value, language).first,
        personLastName: value => personNameParts(value, language).last,
        teamName: value => teamName(value, language),
        matchTeamName: (value, side) => getScorerTeamName(value, side, language),
        linkedTeamName: value => teamName({ name: value?.team_name, name_th: value?.team_name_th, name_en: value?.team_name_en }, language),
    }), [language]);
}
