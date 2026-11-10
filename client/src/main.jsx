import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './utils/i18n/alertLocale.js'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import VisTheme from './components/vis/VisTheme.jsx'
import './styles/AppTheme.css'
import './styles/AppThemeUtilities.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => console.error('VIMS Offline shell:', error));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <VisTheme><App /></VisTheme>
    </LanguageProvider>
  </StrictMode>,
)
