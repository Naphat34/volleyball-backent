import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../utils/i18n/translations';
import { normalizeLanguage, readLanguage } from '../utils/i18n/language';
import { translateUi } from '../utils/i18n/uiTranslations';

const LanguageContext = createContext();
// Exported documents render in a separate React root without the app provider.
export const useOptionalLanguage = () => useContext(LanguageContext) || { language: readLanguage() };

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // Read initial language from localStorage or default to THA
  const [language, setLanguageState] = useState(readLanguage);

  useEffect(() => {
    const syncLanguage = event => {
      if (event.key === 'language' || event.key === null) setLanguageState(readLanguage());
    };
    window.addEventListener('storage', syncLanguage);
    return () => window.removeEventListener('storage', syncLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'ENG' ? 'en' : 'th';
  }, [language]);

  const setLanguage = (lang) => {
    const next = normalizeLanguage(lang);
    setLanguageState(next);
    try { localStorage.setItem('language', next); }
    catch { /* The current page can still switch language without persistent storage. */ }
  };

  // Helper function to fetch nested keys, e.g. t('nav.home')
  const t = (key) => {
    if (!key) return '';
    const keys = key.split('.');
    
    // Attempt to read translation for the active language
    let translation = translations[language];
    for (const k of keys) {
      if (translation && translation[k] !== undefined) {
        translation = translation[k];
      } else {
        // Fallback to ENG if not found in active language
        let engTranslation = translations['ENG'];
        for (const engK of keys) {
          if (engTranslation && engTranslation[engK] !== undefined) {
            engTranslation = engTranslation[engK];
          } else {
            engTranslation = null;
            break;
          }
        }
        return engTranslation !== null ? translateUi(engTranslation, language) : key;
      }
    }
    
    return translateUi(translation, language);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider;
