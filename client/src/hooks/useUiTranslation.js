import { useCallback } from 'react';
import { useOptionalLanguage } from '../context/LanguageContext';
import { translateUi, translateUiMarkup } from '../utils/i18n/uiTranslations';

export default function useUiTranslation(languageOverride) {
    const { language: appLanguage } = useOptionalLanguage();
    const language = languageOverride || appLanguage;
    return useCallback((value, params = []) => (
        typeof value === 'string' && /<[a-z][\s\S]*>/i.test(value)
            ? translateUiMarkup(value, language, params)
            : translateUi(value, language, params)
    ), [language]);
}
