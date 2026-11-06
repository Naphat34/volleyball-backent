import { createContext, useContext } from 'react';

export const VisThemeContext = createContext(null);
export const useVisTheme = () => useContext(VisThemeContext);
