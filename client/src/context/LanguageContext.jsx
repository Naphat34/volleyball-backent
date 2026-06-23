import React, { createContext, useContext, useState } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // Read initial language from localStorage or default to THA
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('language') || 'THA';
  });

  const setLanguage = (lang) => {
    if (lang === 'THA' || lang === 'ENG') {
      setLanguageState(lang);
      localStorage.setItem('language', lang);
    }
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
        return engTranslation !== null ? engTranslation : key;
      }
    }
    
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
