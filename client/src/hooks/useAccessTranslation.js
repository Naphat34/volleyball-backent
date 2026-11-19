import { useCallback } from 'react';
import { useOptionalLanguage } from '../context/LanguageContext';
import { translateAccess } from '../utils/i18n/accessCopy';
export default function useAccessTranslation() {
    const { language } = useOptionalLanguage();
    return useCallback((value, params) => translateAccess(value, language, params), [language]);
}
